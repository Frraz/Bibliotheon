import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { type PostgresAdapter } from '@payloadcms/db-postgres'
import { seedRelationship } from '../fixtures/relationship'
import { confirmMagnet, requestMagnet, unsubscribe } from '../../src/modules/marketing/service'
import { processDelivery } from '../../src/modules/marketing/delivery'
import { CONSENT_VERSION } from '../../src/modules/marketing/validation'
import { sequenceDays } from '../../src/modules/marketing/sequence-copy'
import { preparePromotionBatches, claimPromotionBatch } from '../../src/modules/marketing/batches'
import { checkPromotionBatch } from '../../src/modules/marketing/batch-preflight'
import { PROVIDER_CHECK_TTL } from '../../src/modules/marketing/batch-check-copy'
import { createOpaqueToken, UNSUBSCRIBE_TTL } from '../../src/modules/marketing/tokens'
import { applyObservedProviderBlock, parseSuppressionInput } from '../../src/modules/marketing/suppression'
import { atomic } from '../../src/modules/marketing/transaction'
import { down } from '../../migrations/20261022_054929_provider_preflight'
import type { BrevoContacts } from '../../src/integrations/brevo/contacts'

const seed = await seedRelationship(), { payload, magnet } = seed
const secret = randomBytes(32).toString('hex'), suffix = randomBytes(6).toString('hex'), start = Date.now(), due = start + 2 * 86_400_000, checks: string[] = []
const ids = new Map<string, number>()
const ready: BrevoContacts = { inspect: async email => { if (!ids.has(email)) ids.set(email, ids.size + 1); return { state: 'found', id: ids.get(email)!, blocked: false } }, block: async () => { throw new Error('Preflight não pode escrever no provedor.') } }
let revision = 1
try {
  const messages = Object.fromEntries(sequenceDays.map(day => [`day${day}`, { subject: `Assunto sintético ${day}`, text: `Cópia sintética ${day}.` }]))
  const sequence = await payload.create({ collection: 'email-sequences', ...seed.auth, data: { name: 'Conferência sintética de destinatários', key: 'server-overwrites-synthetic', magnet: magnet.id, magnetVersion: magnet.version, revision, offer: seed.offers[0].id, active: true, ...messages } })
  async function group(name: string) {
    revision++
    await payload.update({ collection: 'email-sequences', id: sequence.id, ...seed.auth, data: { revision, day2: { subject: `Revisão sintética ${revision}` } } })
    const email = `${name}-${suffix}@example.invalid`
    await requestMagnet(payload, { email, magnetId: magnet.id, marketingOptIn: true, consentVersion: CONSENT_VERSION }, secret, start)
    const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, depth: 0, overrideAccess: true })).docs[0]
    const confirmation = (await payload.find({ collection: 'email-deliveries', where: { and: [{ contact: { equals: contact.id } }, { kind: { equals: 'confirmation' } }] }, depth: 0, overrideAccess: true })).docs[0]
    let token = ''
    await processDelivery(payload, confirmation.id, { now: start, secret, origin: 'http://127.0.0.1:3000', transport: async message => { token = /\/amostras\/confirmar\?t=([\w-]+)/.exec(message.text)?.[1] || ''; return { state: 'sent', messageId: 'synthetic-preflight-confirmation' } } })
    assert.ok(token)
    await confirmMagnet(payload, token, secret, start)
    await preparePromotionBatches(payload, due)
    const stage = (await payload.find({ collection: 'promotion-deliveries', where: { and: [{ contact: { equals: contact.id } }, { stage: { equals: '2' } }] }, depth: 0, overrideAccess: true })).docs[0]
    assert.ok(stage.batch)
    return { contact, batch: typeof stage.batch === 'string' ? stage.batch : stage.batch.id }
  }
  const batch = (id: string) => payload.findByID({ collection: 'email-campaign-batches', id, depth: 0, overrideAccess: true })
  const quota = async () => (await payload.find({ collection: 'mail-quota', where: { day: { equals: new Date(due).toISOString().slice(0, 10) } }, depth: 0, overrideAccess: true })).docs[0]?.reserved ?? 0
  const first = await group('ready')
  assert.equal((await claimPromotionBatch(payload, first.batch, { client: null, secret, now: due })).state, 'disabled')
  assert.equal(await quota(), 0)
  assert.equal((await checkPromotionBatch(payload, first.batch, { client: ready, secret, now: due })).state, 'ready')
  const proof = (await batch(first.batch)).providerCheck
  assert.ok(proof); assert.equal(JSON.stringify(proof).includes(first.contact.email), false)
  assert.equal((await claimPromotionBatch(payload, first.batch, { client: ready, secret, now: due })).state, 'claimed')
  assert.equal(await quota(), 1)
  checks.push('Claim exige preflight habilitado; somente contato encontrado/desbloqueado produz conferência vinculada ao lote e versão local; receipt privado não guarda endereço/token/corpo.')

  for (const state of ['absent', 'retry', 'rejected'] as const) {
    const person = await group(state)
    const before = await quota()
    assert.equal((await claimPromotionBatch(payload, person.batch, { client: { ...ready, inspect: async () => ({ state }) }, secret, now: due })).state, 'provider_check')
    const held = await batch(person.batch)
    assert.equal(held.state, 'prepared'); assert.equal(held.providerCheck, null)
    assert.equal(held.errorCode, state === 'absent' ? 'provider_absent' : state === 'rejected' ? 'provider_rejected' : 'provider_unavailable')
    assert.equal(await quota(), before)
    assert.equal((await payload.findByID({ collection: 'contacts', id: person.contact.id, depth: 0, overrideAccess: true })).globalSuppressedAt, null)
  }
  checks.push('Contato ausente, falha transitória e recusa definitiva seguram lote sem quota, criação de contato ou alteração de consentimento.')

  const blocked = await group('provider-blocked')
  const hooks = payload.collections['consent-events'].config.hooks, previous = hooks.afterChange
  hooks.afterChange = [...previous, async ({ doc }) => { if (doc.action === 'provider_blocked') throw new Error('synthetic provider audit rollback'); return doc }]
  const blockedClient: BrevoContacts = { ...ready, inspect: async () => ({ state: 'found', id: 500, blocked: true }) }
  try { await assert.rejects(checkPromotionBatch(payload, blocked.batch, { client: blockedClient, secret, now: due }), /synthetic provider audit rollback/) }
  finally { hooks.afterChange = previous }
  assert.equal((await payload.findByID({ collection: 'contacts', id: blocked.contact.id, depth: 0, overrideAccess: true })).globalSuppressedAt, null)
  assert.equal((await payload.count({ collection: 'brevo-suppressions', where: { contact: { equals: blocked.contact.id } }, overrideAccess: true })).totalDocs, 0)
  const before = await quota()
  assert.equal((await claimPromotionBatch(payload, blocked.batch, { client: blockedClient, secret, now: due })).state, 'canceled')
  const contact = await payload.findByID({ collection: 'contacts', id: blocked.contact.id, depth: 0, overrideAccess: true })
  assert.ok(contact.globalSuppressedAt); assert.equal(contact.deliveryState, 'ok')
  const event = (await payload.find({ collection: 'consent-events', where: { and: [{ contact: { equals: contact.id } }, { action: { equals: 'provider_blocked' } }] }, depth: 0, overrideAccess: true })).docs
  assert.equal(event.length, 1)
  assert.ok((await payload.find({ collection: 'promotion-deliveries', where: { contact: { equals: contact.id } }, depth: 0, overrideAccess: true })).docs.every(item => item.state === 'canceled'))
  assert.equal((await payload.find({ collection: 'email-deliveries', where: { and: [{ contact: { equals: contact.id } }, { kind: { equals: 'delivery' } }] }, depth: 0, overrideAccess: true })).docs[0].state, 'pending')
  assert.equal(await quota(), before)
  checks.push('Bloqueio observado gera action própria, cancela marketing e lote sem inventar bounce/complaint; amostra solicitada permanece. Falha na auditoria reverte importação/outbox juntos.')

  const contactCount = (await payload.count({ collection: 'contacts', overrideAccess: true })).totalDocs
  assert.deepEqual(await applyObservedProviderBlock(payload, { contactId: first.contact.id, email: `mismatched-${suffix}@example.invalid`, providerId: 500, observedAt: due }, secret), { applied: false })
  assert.deepEqual(await applyObservedProviderBlock(payload, { contactId: contact.id, email: contact.email, providerId: 500, observedAt: due }, secret), { applied: false })
  assert.equal((await payload.count({ collection: 'contacts', overrideAccess: true })).totalDocs, contactCount)
  assert.equal((await payload.count({ collection: 'consent-events', where: { action: { equals: 'provider_blocked' } }, overrideAccess: true })).totalDocs, 1)
  assert.equal(parseSuppressionInput({ email: contact.email, reason: 'provider_blocked', source: 'brevo-review', reference: 'synthetic-forged-observation' }), null)
  checks.push('Observação repetida não duplica auditoria; identidade local divergente não é suprimida nem criada; entrada manual não pode inventar action autenticada do provedor.')

  const racing = await group('local-unsubscribe')
  let release!: () => void, entered!: () => void
  const gate = new Promise<void>(resolve => { release = resolve }), started = new Promise<void>(resolve => { entered = resolve })
  const flight = claimPromotionBatch(payload, racing.batch, { client: { ...ready, inspect: async email => { entered(); await gate; return ready.inspect(email) } }, secret, now: due })
  await started
  try {
    const token = createOpaqueToken()
    await payload.create({ collection: 'preference-tokens', data: { contact: racing.contact.id, tokenHash: token.hash, expiresAt: new Date(due + UNSUBSCRIBE_TTL).toISOString() }, overrideAccess: true })
    await unsubscribe(payload, token.token, due)
  } finally { release() }
  assert.equal((await flight).state, 'canceled')
  assert.equal(await quota(), before)
  let queries = 0
  assert.equal((await checkPromotionBatch(payload, racing.batch, { client: { ...ready, inspect: async email => { queries++; return ready.inspect(email) } }, secret, now: due })).state, 'held')
  assert.equal(queries, 0)
  checks.push('Descadastro durante GET não espera lock mantido em HTTP e vence o claim; lote cancelado não consulta contato nem usa quota.')

  const old = await group('slow-query')
  let clock = due
  assert.equal((await claimPromotionBatch(payload, old.batch, { client: { ...ready, inspect: async email => { clock += PROVIDER_CHECK_TTL + 1; return ready.inspect(email) } }, secret, clock: () => clock })).state, 'provider_check')
  assert.equal((await batch(old.batch)).providerCheck, null)
  assert.equal(await quota(), before)
  checks.push('Consulta lenta expira a conferência após cinco minutos antes da reserva; ausência de prova fresca não autoriza claim.')

  const changed = await group('changed-version')
  const batchHooks = payload.collections['email-campaign-batches'].config.hooks, original = batchHooks.afterChange
  let changedOnce = false
  batchHooks.afterChange = [...original, async ({ doc, req }) => {
    if (doc.id === changed.batch && doc.providerCheck && !changedOnce) {
      changedOnce = true
      await payload.update({ collection: 'contacts', id: changed.contact.id, data: { confirmedAt: new Date(start - 1).toISOString() }, overrideAccess: true, req })
    }
    return doc
  }]
  try { assert.equal((await claimPromotionBatch(payload, changed.batch, { client: ready, secret, now: due })).state, 'provider_check') }
  finally { batchHooks.afterChange = original }
  assert.equal(changedOnce, true); assert.equal(await quota(), before)
  await assert.rejects(atomic(payload, async req => {
    const transaction = await req.transactionID; assert.ok(transaction)
    const db = (payload.db as unknown as PostgresAdapter).sessions[transaction].db
    await down({ db, payload, req })
  }), /Downgrade recusado/)
  assert.equal((await payload.count({ collection: 'consent-events', where: { action: { equals: 'provider_blocked' } }, overrideAccess: true })).totalDocs, 1)
  checks.push('Mudança local após gravar conferência invalida o claim e preserva quota; downgrade recusa apagar/reclassificar observações do provedor.')

  await mkdir('artifacts/provider-preflight', { recursive: true })
  await writeFile('artifacts/provider-preflight/local-results.json', JSON.stringify({ date: '2026-10-22 America/Belem', environment: 'PostgreSQL loopback, relógio controlado e consultas de contato inteiramente sintéticas', checks, externalCalls: false, messagesSent: 0, limits: 'Preflight pontual obrigatório no claim interno; sem listas/campanhas, criação de contato, webhook, envio ou homologação de conta. Claim continua fora do worker.' }, null, 2))
  console.log(`Conferência de destinatários: ${checks.length} grupos aprovados; nenhuma chamada externa ou mensagem.`)
} finally { await seed.cleanup() }
process.exit(0)
