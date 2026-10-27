import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { seedRelationship } from '../fixtures/relationship'
import { expireConfirmedSamples } from '../../src/modules/marketing/privacy-sample-retention'
import { runPrivacyRequestAuditRetention } from '../../src/modules/marketing/privacy-retention'
import { atomic } from '../../src/modules/marketing/transaction'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true', 'Exige banco sintético exclusivo.')
const seed = await seedRelationship(), { payload } = seed
const now = Date.now(), old = new Date(now - 3 * 365 * 86_400_000).toISOString(), recent = new Date(now - 86_400_000).toISOString()
const cutoffDate = new Date(now); cutoffDate.setUTCFullYear(cutoffDate.getUTCFullYear() - 2)
const cutoff = cutoffDate.toISOString(), checks: string[] = []
async function request(state: 'sent'|'pending'|'uncertain'|'failed'|'canceled' = 'sent', marketingOptIn = false, confirmedAt = old) {
  const contact = await payload.create({ collection: 'contacts', overrideAccess: true, data: { email: `sample-retention-${randomUUID()}@example.invalid`, confirmedAt, deliveryState: 'ok' } })
  const row = await payload.create({ collection: 'magnet-requests', overrideAccess: true, data: { contact: contact.id, magnet: seed.magnet.id, theme: seed.theme.id, magnetVersion: seed.magnet.version, marketingOptIn, consentVersion: marketingOptIn ? 'synthetic-v1' : null, confirmedAt, expiresAt: new Date(Date.parse(confirmedAt) + 86_400_000).toISOString() } })
  for (const action of ['requested', 'confirmed', ...(marketingOptIn ? ['subscribed'] : [])] as const) await payload.create({ collection: 'consent-events', overrideAccess: true, data: { contact: contact.id, theme: seed.theme.id, purpose: action === 'subscribed' ? 'marketing' : 'sample', action: action as 'requested'|'confirmed'|'subscribed', version: 'synthetic-v1', occurredAt: confirmedAt, key: `${action}:${row.id}` } })
  for (const kind of ['confirmation', 'delivery'] as const) await payload.create({ collection: 'email-deliveries', overrideAccess: true, data: { key: `${kind}:${row.id}`, contact: contact.id, request: row.id, kind, state: kind === 'confirmation' ? 'sent' : state, attempts: 1, nextAttemptAt: confirmedAt, sentAt: kind === 'confirmation' || state === 'sent' ? confirmedAt : null } })
  // Fixture-only timestamps reproduce records last touched years ago.
  await atomic(payload, async req => {
    const id = await req.transactionID; assert.ok(id)
    const db = (payload.db as unknown as PostgresAdapter).sessions[id].db
    await db.execute(sql`UPDATE magnet_requests SET updated_at=${confirmedAt}::timestamptz WHERE id=${row.id}::uuid`)
    await db.execute(sql`UPDATE email_deliveries SET updated_at=${confirmedAt}::timestamptz WHERE request_id=${row.id}::uuid`)
  })
  return { row, contact }
}
try {
  const completed = await request(), uncertain = await request('uncertain'), pending = await request('pending'), active = await request('sent', true), superseded = await request('sent', true), refreshed = await request(), recentDelivery = await request(), linked = await request(), incomplete = await request()
  const failed = await request('failed'), canceled = await request('canceled'), missingProof = await request('sent', true)
  const recentRequest = await request('sent', false, recent), boundary = await request('sent', false, cutoff)
  for (const [fixture, subscribedAt] of [[active, old], [superseded, recent]] as const) await payload.create({ collection: 'subscriptions', overrideAccess: true, data: { contact: fixture.contact.id, theme: seed.theme.id, key: `${fixture.contact.id}:${seed.theme.id}`, state: 'subscribed', subscribedAt, consentVersion: 'synthetic-v1' } })
  await payload.create({ collection: 'subscriptions', overrideAccess: true, data: { contact: missingProof.contact.id, theme: seed.theme.id, key: `${missingProof.contact.id}:${seed.theme.id}`, state: 'subscribed', subscribedAt: recent, consentVersion: 'synthetic-v1' } })
  await payload.create({ collection: 'consent-events', overrideAccess: true, data: { contact: superseded.contact.id, theme: seed.theme.id, purpose: 'marketing', action: 'subscribed', occurredAt: recent, version: 'synthetic-v1', key: `subscribed:newer-${randomUUID()}` } })
  const suppressionEvent = await payload.create({ collection: 'consent-events', overrideAccess: true, data: { contact: completed.contact.id, purpose: 'marketing', action: 'unsubscribed', occurredAt: old, key: `suppression:manual:${randomUUID()}` } })
  await payload.update({ collection: 'magnet-requests', id: refreshed.row.id, overrideAccess: true, data: { campaignCode: 'recent-synthetic-update' } })
  const delivery = (await payload.find({ collection: 'email-deliveries', where: { and: [{ request: { equals: recentDelivery.row.id } }, { kind: { equals: 'delivery' } }] }, overrideAccess: true })).docs[0]
  await payload.update({ collection: 'email-deliveries', id: delivery.id, overrideAccess: true, data: { providerMessageId: 'recent-synthetic-delivery' } })
  await payload.delete({ collection: 'email-deliveries', where: { and: [{ request: { equals: incomplete.row.id } }, { kind: { equals: 'delivery' } }] }, overrideAccess: true })
  const copy = Object.fromEntries([2,4,7,10].map(day => [`day${day}`, { subject: 'Assunto sintético', text: 'Conteúdo sintético sem envio.' }]))
  const sequence = await payload.create({ collection: 'email-sequences', ...seed.auth, data: { name: 'Sequência sintética de retenção', key: 'synthetic-generated-key', magnet: seed.magnet.id, magnetVersion: seed.magnet.version, revision: 1, offer: seed.offers[0].id, ...copy } })
  await payload.create({ collection: 'sequence-enrollments', overrideAccess: true, data: { key: randomUUID(), contact: linked.contact.id, request: linked.row.id, magnet: seed.magnet.id, theme: seed.theme.id, sequence: sequence.id, magnetVersion: seed.magnet.version, confirmedAt: old, state: 'canceled', canceledAt: old, snapshot: { synthetic: true } } })
  const preview = await runPrivacyRequestAuditRetention(payload, { now })
  assert.deepEqual(preview.confirmedSamples, { candidates: 12, eligible: 4, processed: 0, removedDeliveries: 0, removedConsentEvents: 0, preservedForReconciliation: 8 })
  assert.equal((await payload.count({ collection: 'magnet-requests', overrideAccess: true })).totalDocs, 14)
  assert.ok(!JSON.stringify(preview).includes(completed.contact.email) && !JSON.stringify(preview).includes(completed.row.id))
  checks.push('preview integrado sem escrita/PII; cutoff de 24 meses e limite exato preservados')

  const originalDelete = payload.delete.bind(payload)
  try {
    payload.delete = (async (options: Parameters<typeof payload.delete>[0]) => {
      if (options.collection === 'magnet-requests' && 'id' in options && options.id === completed.row.id) throw new Error('synthetic-retention-rollback')
      return originalDelete(options as never)
    }) as unknown as typeof payload.delete
    await assert.rejects(expireConfirmedSamples(payload, cutoff, now, true), /synthetic-retention-rollback/)
  } finally { payload.delete = originalDelete }
  assert.equal((await payload.count({ collection: 'email-deliveries', where: { request: { equals: completed.row.id } }, overrideAccess: true })).totalDocs, 2)
  assert.equal((await payload.count({ collection: 'consent-events', where: { contact: { equals: completed.contact.id } }, overrideAccess: true })).totalDocs, 3)
  checks.push('falha depois do expurgo de outbox/eventos reverte o pedido inteiro')

  // A failed pass may have committed an earlier independent request; combine all subsequent results.
  const applied = await runPrivacyRequestAuditRetention(payload, { now, apply: true })
  for (const fixture of [completed, superseded, failed, canceled]) await assert.rejects(payload.findByID({ collection: 'magnet-requests', id: fixture.row.id, overrideAccess: true }))
  for (const fixture of [uncertain, pending, active, refreshed, recentDelivery, linked, incomplete, recentRequest, boundary, missingProof]) assert.ok(await payload.findByID({ collection: 'magnet-requests', id: fixture.row.id, overrideAccess: true }))
  assert.ok(await payload.findByID({ collection: 'contacts', id: completed.contact.id, overrideAccess: true }))
  assert.equal((await payload.find({ collection: 'subscriptions', where: { contact: { equals: superseded.contact.id } }, overrideAccess: true })).docs[0].state, 'subscribed')
  assert.ok(await payload.findByID({ collection: 'consent-events', id: suppressionEvent.id, overrideAccess: true }))
  assert.ok(applied.confirmedSamples.processed >= 1)
  checks.push('pedido/outbox/eventos antigos removidos atomicamente; contato e assinatura atual preservados')
  checks.push('prova do opt-in ativo, sequência dependente, entrega pendente/incerta e atividade recente preservadas')
  const repeat = await runPrivacyRequestAuditRetention(payload, { now, apply: true })
  assert.equal(repeat.confirmedSamples.processed, 0)
  checks.push('reexecução idempotente sem apagar estado de consentimento ou supressão')
  await mkdir('artifacts/privacy-retention', { recursive: true })
  await writeFile('artifacts/privacy-retention/d102-results.json', JSON.stringify({ date: new Date(now).toISOString(), environment: 'PostgreSQL local sintético exclusivo', checks, checksPassed: checks.length, migrationAdded: false, externalCalls: false, messagesSent: 0 }, null, 2) + '\n')
  console.log(`Retenção de amostras: ${checks.length} grupos aprovados.`)
} finally { await seed.cleanup() }
process.exit(0)
