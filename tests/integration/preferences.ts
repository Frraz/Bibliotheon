import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { POST as preferencesPost } from '../../src/app/(site)/api/v1/preferences/route'
import { seedRelationship } from '../fixtures/relationship'
import { requestMagnet, confirmMagnet, unsubscribe, LeadFlowError } from '../../src/modules/marketing/service'
import { processDelivery } from '../../src/modules/marketing/delivery'
import { readPreferences, unsubscribeTheme } from '../../src/modules/marketing/preferences'
import { createOpaqueToken, UNSUBSCRIBE_TTL } from '../../src/modules/marketing/tokens'
import { CONSENT_VERSION } from '../../src/modules/marketing/validation'
import { sequenceDays } from '../../src/modules/marketing/sequence-copy'
import { preparePromotionBatches, claimPromotionBatch } from '../../src/modules/marketing/batches'

const seed = await seedRelationship(), { payload } = seed
const secret = randomBytes(32).toString('hex'), now = Date.now(), checks: string[] = []
try {
  const theme2 = await payload.create({ collection: 'themes', ...seed.auth, data: { name: 'Segundo assunto sintético', introduction: 'Assunto exclusivo para testar preferências.', slug: `segundo-${randomUUID()}`, _status: 'published' } })
  seed.extraThemes.push(theme2.id)
  // Keep the seed's book untouched: use its pre-existing draft as another real material.
  await payload.update({ collection: 'ebooks', id: seed.draft.id, ...seed.auth, data: { theme: theme2.id } })
  // A pending second theme is sufficient to prove no new consent can be granted by this endpoint.
  const messages = Object.fromEntries(sequenceDays.map(day => [`day${day}`, { subject: `Preferências ${day}`, text: `Texto sintético ${day}.` }]))
  await payload.create({ collection: 'email-sequences', ...seed.auth, data: { name: 'Calendário de preferências', magnet: seed.magnet.id, magnetVersion: seed.magnet.version, revision: 1, key: 'synthetic', offer: seed.offers[1].id, active: true, ...messages } })
  const endpoint = (input: unknown, headers: Record<string, string> = {}) => preferencesPost(new Request('http://127.0.0.1:3001/api/v1/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(input) }))
  const email = `preferences-${randomUUID()}@example.invalid`
  await requestMagnet(payload, { email, magnetId: seed.magnet.id, marketingOptIn: true, consentVersion: CONSENT_VERSION }, secret, now)
  const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, overrideAccess: true })).docs[0]
  const request = (await payload.find({ collection: 'magnet-requests', where: { contact: { equals: contact.id } }, overrideAccess: true })).docs[0]
  const delivery = (await payload.find({ collection: 'email-deliveries', where: { request: { equals: request.id } }, overrideAccess: true })).docs[0]
  let confirmation = ''
  await processDelivery(payload, delivery.id, { secret, origin: 'http://127.0.0.1:3001', now, transport: async message => { confirmation = /confirmar\?t=([\w-]+)/.exec(message.text)![1]; return { state: 'sent', messageId: 'synthetic' } } })
  await confirmMagnet(payload, confirmation, secret, now)
  const firstSub = (await payload.find({ collection: 'subscriptions', where: { contact: { equals: contact.id } }, overrideAccess: true })).docs[0]
  const secondSub = await payload.create({ collection: 'subscriptions', data: { contact: contact.id, theme: theme2.id, key: `${contact.id}:${theme2.id}`, state: 'subscribed', consentVersion: CONSENT_VERSION, subscribedAt: new Date(now).toISOString() }, overrideAccess: true })
  const token = createOpaqueToken()
  await payload.create({ collection: 'preference-tokens', data: { contact: contact.id, tokenHash: token.hash, expiresAt: new Date(now + UNSUBSCRIBE_TTL).toISOString() }, overrideAccess: true })
  const summary = await readPreferences(payload, token.token, now)
  assert.equal(summary.themes.length, 2)
  assert.equal(JSON.stringify(summary).includes(email), false)
  assert.equal((await payload.findByID({ collection: 'subscriptions', id: firstSub.id, overrideAccess: true })).state, 'subscribed')
  checks.push('Consulta autorizada lista somente temas do contato, sem endereço e sem alterar consentimento.')

  await assert.rejects(readPreferences(payload, createOpaqueToken().token, now), e => e instanceof LeadFlowError && e.status === 410)
  await assert.rejects(readPreferences(payload, token.token, now + UNSUBSCRIBE_TTL), e => e instanceof LeadFlowError && e.status === 410)
  await assert.rejects(unsubscribeTheme(payload, token.token, randomUUID(), now), e => e instanceof LeadFlowError && e.status === 422)
  await assert.rejects(unsubscribeTheme(payload, token.token, [], now), e => e instanceof LeadFlowError && e.status === 422)
  checks.push('Tokens inválidos/expirados e tema não pertencente ao contato são recusados sem mutação.')
  const other = await payload.create({ collection: 'contacts', data: { email: `other-${randomUUID()}@example.invalid`, deliveryState: 'ok' }, overrideAccess: true })
  const otherToken = createOpaqueToken()
  await payload.create({ collection: 'preference-tokens', data: { contact: other.id, tokenHash: otherToken.hash, expiresAt: new Date(now + UNSUBSCRIBE_TTL).toISOString() }, overrideAccess: true })
  assert.deepEqual((await readPreferences(payload, otherToken.token, now)).themes, [])
  await assert.rejects(unsubscribeTheme(payload, otherToken.token, seed.theme.id, now), e => e instanceof LeadFlowError && e.status === 422)
  const result = await endpoint({ token: token.token, action: 'read' })
  assert.equal(result.status, 200); assert.equal(result.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(result.headers.get('Referrer-Policy'), 'no-referrer')
  assert.equal((await result.json()).themes.length, 2)
  assert.equal((await endpoint({ token: token.token, action: 'subscribe', theme: theme2.id })).status, 422)
  assert.equal((await endpoint({ token: token.token, action: 'read', email })).status, 422)
  assert.equal((await endpoint({ token: token.token, action: 'read' }, { Origin: 'https://foreign.example.invalid' })).status, 422)
  assert.equal((await endpoint({ token: 'x'.repeat(5000), action: 'read' })).status, 422)
  assert.equal((await endpoint({ token: createOpaqueToken().token, action: 'read' })).status, 410)
  checks.push('POST privado e estrito: isolamento entre contatos, no-store/no-referrer, origem externa, excesso de corpo e tentativa de inscrição recusados.')


  const due = now + 2 * 86_400_000
  await preparePromotionBatches(payload, due)
  const batch = (await payload.find({ collection: 'email-campaign-batches', overrideAccess: true })).docs[0]
  assert.ok(batch)
  const events = await payload.count({ collection: 'consent-events', overrideAccess: true })
  const hooks = payload.collections['consent-events'].config.hooks, previous = hooks.afterChange
  hooks.afterChange = [...previous, async () => { throw new Error('synthetic rollback') }]
  try { await assert.rejects(unsubscribeTheme(payload, token.token, seed.theme.id, due)) } finally { hooks.afterChange = previous }
  assert.equal((await payload.findByID({ collection: 'subscriptions', id: firstSub.id, overrideAccess: true })).state, 'subscribed')
  assert.equal((await payload.find({ collection: 'sequence-enrollments', overrideAccess: true })).docs[0].state, 'active')
  assert.equal((await payload.count({ collection: 'consent-events', overrideAccess: true })).totalDocs, events.totalDocs)
  checks.push('Falha de auditoria reverte assinatura e cancelamento do calendário atomicamente.')

  await Promise.all([unsubscribeTheme(payload, token.token, seed.theme.id, due), unsubscribeTheme(payload, token.token, seed.theme.id, due)])
  assert.equal((await readPreferences(payload, token.token, due)).themes[0].id, theme2.id)
  assert.equal((await payload.findByID({ collection: 'subscriptions', id: secondSub.id, overrideAccess: true })).state, 'subscribed')
  assert.equal((await payload.findByID({ collection: 'contacts', id: contact.id, overrideAccess: true })).globalSuppressedAt, null)
  assert.equal((await payload.count({ collection: 'brevo-suppressions', overrideAccess: true })).totalDocs, 0)
  assert.equal((await payload.count({ collection: 'consent-events', where: { and: [{ action: { equals: 'unsubscribed' } }, { theme: { equals: seed.theme.id } }] }, overrideAccess: true })).totalDocs, 1)
  let inspected = 0
  const claim = await claimPromotionBatch(payload, batch.id, { now: due, secret, client: { inspect: async () => { inspected++; return { state: 'found', id: 1, blocked: false } }, block: async () => { throw new Error('No HTTP') } } })
  assert.equal(claim.state, 'canceled'); assert.equal(inspected, 0)
  checks.push('Cancelamento concorrente é idempotente, preserva outro tema e impede claim de lote já preparado antes da quota/HTTP.')

  await assert.rejects(confirmMagnet(payload, confirmation, secret, due), e => e instanceof LeadFlowError && e.status === 410)
  assert.equal((await payload.findByID({ collection: 'subscriptions', id: firstSub.id, overrideAccess: true })).state, 'unsubscribed')
  const download = (await payload.find({ collection: 'email-deliveries', where: { and: [{ request: { equals: request.id } }, { kind: { equals: 'delivery' } }] }, overrideAccess: true })).docs[0]
  assert.equal(download.state, 'pending')
  checks.push('Repetição de confirmação antiga não reativa assinatura; entrega de amostra continua independente.')

  assert.equal((await endpoint({ token: token.token, action: 'unsubscribe-theme', theme: theme2.id })).status, 200)
  assert.equal((await readPreferences(payload, token.token, due)).themes.length, 0)
  assert.equal((await payload.find({ collection: 'brevo-registrations', overrideAccess: true })).docs[0].state, 'canceled')
  assert.equal((await payload.count({ collection: 'brevo-suppressions', overrideAccess: true })).totalDocs, 1)
  await Promise.all([unsubscribe(payload, token.token, due + 1), unsubscribeTheme(payload, token.token, theme2.id, due + 1)])
  assert.equal((await readPreferences(payload, token.token, due + 1)).suppressed, true)
  checks.push('Último tema cancela cadastro e enfileira bloqueio externo; cancelamento global concorrente continua válido, sem reativação.')
  await mkdir('artifacts/preferences', { recursive: true })
  await writeFile('artifacts/preferences/local-results.json', JSON.stringify({ date: '2026-10-22 America/Belem', environment: 'PostgreSQL local; fixtures sintéticas; sem API real', checks, externalCalls: false, messagesSent: 0, limits: 'Segundo tema semeado sinteticamente; apenas primeiro tema usa fluxo completo de confirmação e calendário. Não comprova personalização Brevo ou UI renderizada.' }, null, 2)+'\n')
  console.log(`Preferências: ${checks.length} grupos aprovados; nenhum envio real.`)
} finally {
  await payload.update({ collection: 'ebooks', id: seed.draft.id, ...seed.auth, data: { theme: null } })
  await seed.cleanup()
}

process.exit(0)
