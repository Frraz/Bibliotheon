import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { seedRelationship } from '../fixtures/relationship'
import { requestMagnet, confirmMagnet } from '../../src/modules/marketing/service'
import { processDelivery } from '../../src/modules/marketing/delivery'
import { CONSENT_VERSION } from '../../src/modules/marketing/validation'
import { preparePromotionBatches } from '../../src/modules/marketing/batches'
import { readBatchMembers } from '../../src/modules/marketing/batch-copy'
import { deleteContactData } from '../../src/modules/marketing/privacy-delete'
import { correctContactEmail } from '../../src/modules/marketing/privacy-correct'
import { atomic, serial } from '../../src/modules/marketing/transaction'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true', 'Somente banco sintético exclusivo.')
const seed = await seedRelationship(), { payload } = seed
const secret = 'synthetic-local-batch-privacy-'.padEnd(48, 'x')
const start = Date.now() - 2 * 86400000, now = start + 2 * 86400000, at = new Date(now).toISOString()
const checks: string[] = [], originalFetch = globalThis.fetch
let externalCalls = 0, revision = 1
globalThis.fetch = (async () => { externalCalls++; throw new Error('Rede externa proibida no ensaio.') }) as typeof fetch
try {
  const messages = Object.fromEntries([2, 4, 7, 10].map(day => [`day${day}`, { subject: `Etapa sintética ${day}`, text: 'Conteúdo manual sintético para teste local.' }]))
  const sequence = await payload.create({ collection: 'email-sequences', ...seed.auth, data: { name: 'Privacidade de lotes locais', key: 'synthetic', magnet: seed.magnet.id, magnetVersion: seed.magnet.version, revision: 1, offer: seed.offers[0].id, active: true, ...messages } })
  async function person() {
    const email = `local-batch-${randomUUID()}@example.invalid`
    await requestMagnet(payload, { email, magnetId: seed.magnet.id, marketingOptIn: true, consentVersion: CONSENT_VERSION }, secret, start)
    const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, depth: 0, overrideAccess: true })).docs[0]
    const delivery = (await payload.find({ collection: 'email-deliveries', where: { contact: { equals: contact.id } }, limit: 1, overrideAccess: true })).docs[0]
    let token = ''
    await processDelivery(payload, delivery.id, { secret, origin: 'http://127.0.0.1:3000', now: start, transport: async message => { token = /\/amostras\/confirmar\?t=([\w-]+)/.exec(message.text)?.[1] || ''; return { state: 'sent', messageId: 'synthetic-only' } } })
    assert.ok(token)
    await confirmMagnet(payload, token, secret, start)
    return contact
  }
  async function fixture() {
    revision++
    await payload.update({ collection: 'email-sequences', id: sequence.id, ...seed.auth, data: { revision, day2: { subject: `Grupo sintético ${revision}` } } })
    const contact = await person(), peer = await person()
    await preparePromotionBatches(payload, now)
    const batch = (await payload.find({ collection: 'email-campaign-batches', limit: 100, depth: 0, overrideAccess: true })).docs.find(row => readBatchMembers(row.members)?.some(member => member.contact === contact.id))!
    assert.ok(batch)
    assert.equal(batch.recipientCount, 2)
    const members = readBatchMembers(batch.members)!
    const peerDelivery = members.find(member => member.contact === peer.id)!.delivery
    return { contact, peer, batch, members, peerDelivery }
  }
  const exists = <C extends 'contacts' | 'email-campaign-batches' | 'promotion-deliveries'>(collection: C, id: string) => payload.findByID({ collection, id, depth: 0, overrideAccess: true, disableErrors: true })
  async function unchanged(item: Awaited<ReturnType<typeof fixture>>) {
    assert.ok(await exists('email-campaign-batches', item.batch.id))
    assert.ok(await exists('contacts', item.contact.id))
    for (const member of item.members) assert.equal((await exists('promotion-deliveries', member.delivery))?.batch, item.batch.id)
  }

  const erased = await fixture()
  await payload.create({ collection: 'brevo-suppressions', overrideAccess: true, data: { contact: erased.contact.id, revision: 1, state: 'pending', attempts: 0, nextAttemptAt: at } })
  const quotaBefore = (await payload.find({ collection: 'mail-quota', pagination: false, overrideAccess: true })).docs
  const deleted = await deleteContactData(payload, erased.contact.email, seed.owner.id, secret, now)
  assert.equal(deleted.outcome, 'completed')
  assert.equal(deleted.counts.dissolvedLocalBatches, 1)
  assert.equal(deleted.counts.detachedPromotions, 2)
  assert.equal(await exists('contacts', erased.contact.id), null)
  assert.equal(await exists('email-campaign-batches', erased.batch.id), null)
  assert.equal((await exists('promotion-deliveries', erased.peerDelivery))?.state, 'ready')
  assert.equal((await exists('promotion-deliveries', erased.peerDelivery))?.batch, null)
  assert.ok(await exists('contacts', erased.peer.id))
  assert.equal((await payload.count({ collection: 'brevo-registrations', where: { contact: { equals: erased.contact.id } }, overrideAccess: true })).totalDocs, 0)
  assert.equal((await payload.count({ collection: 'brevo-suppressions', where: { contact: { equals: erased.contact.id } }, overrideAccess: true })).totalDocs, 0)
  assert.deepEqual((await deleteContactData(payload, erased.contact.email, seed.owner.id, secret, now)).counts, deleted.counts)
  assert.deepEqual((await payload.find({ collection: 'mail-quota', pagination: false, overrideAccess: true })).docs, quotaBefore)
  checks.push('exclusão dissolve lote local compartilhado, remove intenções nunca emitidas, preserva outro titular e não altera quota; repetição idempotente')

  const corrected = await fixture(), replacement = `corrected-${randomUUID()}@example.invalid`
  const consentBefore = (await payload.find({ collection: 'consent-events', where: { contact: { equals: corrected.contact.id } }, pagination: false, depth: 0, overrideAccess: true })).docs
  const correction = await correctContactEmail(payload, corrected.contact.email, replacement, seed.owner.id, secret, now)
  assert.equal(correction.outcome, 'completed')
  assert.equal(correction.counts.dissolvedLocalBatches, 1)
  assert.equal((await exists('contacts', corrected.contact.id))?.email, replacement)
  assert.equal(await exists('email-campaign-batches', corrected.batch.id), null)
  assert.deepEqual((await payload.find({ collection: 'consent-events', where: { contact: { equals: corrected.contact.id } }, pagination: false, depth: 0, overrideAccess: true })).docs, consentBefore)
  await preparePromotionBatches(payload, now)
  const regrouped = (await payload.find({ collection: 'email-campaign-batches', limit: 100, overrideAccess: true })).docs.find(batch => readBatchMembers(batch.members)?.some(member => member.contact === corrected.contact.id))!
  assert.ok(regrouped)
  assert.notEqual(regrouped.id, corrected.batch.id)
  assert.ok(readBatchMembers(regrouped.members)!.some(member => member.contact === corrected.peer.id))
  checks.push('correção preserva consentimento e ambos os titulares; reagrupamento usa lote novo sem reativar estados')

  const blocked = await fixture()
  const sample = (await payload.find({ collection: 'email-deliveries', where: { contact: { equals: blocked.contact.id } }, limit: 1, overrideAccess: true })).docs[0]
  await payload.update({ collection: 'email-deliveries', id: sample.id, data: { state: 'uncertain' }, overrideAccess: true })
  assert.equal((await deleteContactData(payload, blocked.contact.email, seed.owner.id, secret, now)).outcome, 'pending')
  assert.equal((await correctContactEmail(payload, blocked.contact.email, `pending-${randomUUID()}@example.invalid`, seed.owner.id, secret, now)).outcome, 'pending')
  await unchanged(blocked)
  checks.push('outro bloqueio mantém todo o lote e seus vínculos; pending não executa limpeza parcial')

  for (const kind of ['provider-list', 'claimed', 'provider-check', 'invalid-copy', 'legacy-provider-id'] as const) {
    const item = await fixture()
    if (kind === 'provider-list') await payload.create({ collection: 'brevo-batch-lists', overrideAccess: true, data: { batch: item.batch.id, name: 'synthetic', folderId: 1, audienceKey: 'synthetic', snapshot: {}, attemptedIds: [], state: 'creating', nextAttemptAt: at } })
    if (kind === 'claimed') await payload.update({ collection: 'email-campaign-batches', id: item.batch.id, data: { state: 'canceled', claimedAt: at }, overrideAccess: true })
    if (kind === 'provider-check') await payload.update({ collection: 'email-campaign-batches', id: item.batch.id, data: { providerCheck: { synthetic: true } }, overrideAccess: true })
    if (kind === 'invalid-copy') await payload.update({ collection: 'email-campaign-batches', id: item.batch.id, data: { copy: { ...(item.batch.copy as object), unknownHistory: true } }, overrideAccess: true })
    if (kind === 'legacy-provider-id') {
      const registration = (await payload.find({ collection: 'brevo-registrations', where: { contact: { equals: item.contact.id } }, limit: 1, overrideAccess: true })).docs[0]
      await payload.update({ collection: 'brevo-registrations', id: registration.id, data: { providerId: 999, attempts: 0, state: 'canceled' }, overrideAccess: true })
    }
    assert.equal((await deleteContactData(payload, item.contact.email, seed.owner.id, secret, now)).outcome, 'pending')
    assert.equal((await correctContactEmail(payload, item.contact.email, `blocked-${randomUUID()}@example.invalid`, seed.owner.id, secret, now)).outcome, 'pending')
    await unchanged(item)
    checks.push(`${kind}: evidência externa, reserva prévia ou estrutura desconhecida impede dissolução e mantém pending`)
  }

  const rollback = await fixture(), originalDelete = payload.delete
  payload.delete = ((args: { collection: string; id?: string }) => {
    if (args.collection === 'contacts' && args.id === rollback.contact.id) throw new Error('Falha sintética após dissolução do lote.')
    return originalDelete.call(payload, args as never)
  }) as typeof payload.delete
  try { await assert.rejects(deleteContactData(payload, rollback.contact.email, seed.owner.id, secret, now), /Falha sintética/) } finally { payload.delete = originalDelete }
  await unchanged(rollback)
  checks.push('falha na exclusão reverte dissolução, vínculos e intenção de cadastro de todos os titulares')

  const concurrent = await fixture()
  let release!: () => void, locked!: () => void
  const ready = new Promise<void>(resolve => { locked = resolve }), gate = new Promise<void>(resolve => { release = resolve })
  const writer = atomic(payload, async req => {
    await serial(req, `promotion-batch:${concurrent.batch.id}`)
    locked()
    await gate
    await payload.update({ collection: 'email-campaign-batches', id: concurrent.batch.id, data: { state: 'claimed', claimedAt: at }, overrideAccess: true, req })
  })
  await ready
  const originalFind = payload.find
  payload.find = (async (args: { collection: string }) => {
    const result = await originalFind.call(payload, args as never)
    if (args.collection === 'email-campaign-batches') release()
    return result
  }) as typeof payload.find
  try {
    assert.equal((await deleteContactData(payload, concurrent.contact.email, seed.owner.id, secret, now)).outcome, 'pending')
    await writer
  } finally { release(); payload.find = originalFind; await writer }
  await unchanged(concurrent)
  checks.push('reserva concorrente ganha lock do lote; privacidade relê estado e preserva pending sem deadlock')

  assert.equal(externalCalls, 0)
  const sources = ['src/modules/marketing/privacy-local-batches.ts', 'src/modules/marketing/privacy-local-intents.ts', 'src/modules/marketing/privacy-delete.ts', 'src/modules/marketing/privacy-correct.ts', 'src/modules/marketing/privacy-shared-reference.ts', 'src/modules/marketing/privacy-marketing-retention.ts', 'tests/integration/privacy-local-batches.ts']
  const sourceSHA256 = Object.fromEntries(await Promise.all(sources.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])))
  await mkdir('artifacts/privacy-retention', { recursive: true })
  await writeFile('artifacts/privacy-retention/d119-results.json', JSON.stringify({ phase: 'D119', completedAt: new Date().toISOString(), environment: 'PostgreSQL sintético descartável', checks, externalCalls, externalReconciliationPerformed: false, productionChanged: false, sourceSHA256 }, null, 2) + '\n')
  console.log(`Privacidade de lotes nunca emitidos: ${checks.length} grupos aprovados; zero rede.`)
} finally { globalThis.fetch = originalFetch; await seed.cleanup() }
process.exit(0)
