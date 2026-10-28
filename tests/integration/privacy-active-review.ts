import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { seedRelationship } from '../fixtures/relationship'
import { requestMagnet, confirmMagnet } from '../../src/modules/marketing/service'
import { processDelivery } from '../../src/modules/marketing/delivery'
import { preparePromotions } from '../../src/modules/marketing/sequence'
import { sequenceDays } from '../../src/modules/marketing/sequence-copy'
import { CONSENT_VERSION } from '../../src/modules/marketing/validation'
import { runPrivacyRequestAuditRetention } from '../../src/modules/marketing/privacy-retention'
import { activeMarketingReviewCutoff } from '../../src/modules/marketing/retention-policy'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true', 'Somente banco sintético exclusivo.')
const seed = await seedRelationship(), { payload } = seed
const secret = randomBytes(32).toString('hex'), now = Date.now(), checks: string[] = []
const originalFetch = globalThis.fetch
let externalCalls = 0
globalThis.fetch = (async () => { externalCalls++; throw new Error('Rede externa proibida.') }) as typeof fetch

async function optIn(email: string, at: number, marketingOptIn = true) {
  await requestMagnet(payload, { email, magnetId: seed.magnet.id, marketingOptIn, ...(marketingOptIn ? { consentVersion: CONSENT_VERSION } : {}) }, secret, at)
  const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, depth: 0, overrideAccess: true })).docs[0]
  const request = (await payload.find({ collection: 'magnet-requests', where: { contact: { equals: contact.id } }, sort: '-createdAt', depth: 0, overrideAccess: true })).docs[0]
  const delivery = (await payload.find({ collection: 'email-deliveries', where: { and: [{ request: { equals: request.id } }, { kind: { equals: 'confirmation' } }] }, depth: 0, overrideAccess: true })).docs[0]
  let token = ''
  await processDelivery(payload, delivery.id, { secret, origin: 'http://127.0.0.1:3000', now: at, transport: async message => { token = /\/amostras\/confirmar\?t=([\w-]+)/.exec(message.text)?.[1] ?? ''; return { state: 'sent', messageId: 'synthetic-active-review' } } })
  assert.ok(token)
  await confirmMagnet(payload, token, secret, at)
  return { contact, request }
}

try {
  const sequenceDaysCopy = Object.fromEntries(sequenceDays.map(day => [`day${day}`, { subject: `Assunto sintético ${day}`, text: `Mensagem sintética ${day}; sem transporte real.` }]))
  await payload.create({ collection: 'email-sequences', ...seed.auth, data: { name: 'Revisão de opt-in sintética', magnet: seed.magnet.id, magnetVersion: seed.magnet.version, revision: 1, offer: seed.offers[0].id, key: 'gerada-no-servidor', ...sequenceDaysCopy, active: true } })
  const email = `active-review-${randomBytes(5).toString('hex')}@example.invalid`
  const person = await optIn(email, now)
  const subscription = (await payload.find({ collection: 'subscriptions', where: { contact: { equals: person.contact.id } }, depth: 0, overrideAccess: true })).docs[0]
  assert.ok(subscription.subscribedAt)
  const cutoff = activeMarketingReviewCutoff(now + 13 * 30 * 86_400_000)
  await payload.update({ collection: 'subscriptions', id: subscription.id, overrideAccess: true, data: { subscribedAt: new Date(Date.parse(cutoff) - 1).toISOString() } })
  const dueAt = now + 13 * 30 * 86_400_000 + 2 * 86_400_000
  const preview = await runPrivacyRequestAuditRetention(payload, { now: dueAt, secret })
  assert.equal(preview.activeMarketingReview.staleSubscriptions, 1)
  assert.equal(preview.activeMarketingReview.reviewRequired, true)
  const stages = await payload.find({ collection: 'promotion-deliveries', where: { contact: { equals: person.contact.id } }, depth: 0, overrideAccess: true })
  assert.equal(stages.docs.length, 4)
  const prepared = await preparePromotions(payload, dueAt)
  assert.equal(prepared.ready, 0)
  const held = await payload.findByID({ collection: 'promotion-deliveries', id: stages.docs[0].id, depth: 0, overrideAccess: true })
  assert.equal(held.state, 'scheduled')
  assert.equal(held.errorCode, 'marketing_review_due')
  const activeEnrollment = (await payload.find({ collection: 'sequence-enrollments', where: { contact: { equals: person.contact.id } }, depth: 0, overrideAccess: true })).docs[0]
  assert.equal(activeEnrollment.state, 'active')
  checks.push('opt-in com 12 meses fica em revisão; a etapa promocional é retida sem alterar consentimento, identidade ou inscrição')

  const sampleOnlyAt = dueAt + 86_400_000
  await optIn(email, sampleOnlyAt, false)
  const unchanged = await payload.findByID({ collection: 'subscriptions', id: subscription.id, depth: 0, overrideAccess: true })
  assert.equal(unchanged.subscribedAt, new Date(Date.parse(cutoff) - 1).toISOString())
  assert.equal((await preparePromotions(payload, sampleOnlyAt + 86_400_000)).ready, 0)
  checks.push('pedido de amostra confirmado sem opt-in não renova interesse de marketing nem libera a etapa')

  const renewedAt = sampleOnlyAt + 86_400_000
  await optIn(email, renewedAt, true)
  const renewed = await payload.findByID({ collection: 'subscriptions', id: subscription.id, depth: 0, overrideAccess: true })
  assert.equal(renewed.subscribedAt, new Date(renewedAt).toISOString())
  assert.equal((await preparePromotions(payload, renewedAt + 86_400_000)).ready, 4)
  const released = await payload.findByID({ collection: 'promotion-deliveries', id: stages.docs[0].id, depth: 0, overrideAccess: true })
  assert.equal(released.state, 'ready')
  assert.equal(released.errorCode, null)
  checks.push('novo opt-in confirmado pelo titular renova a data e libera novamente o calendário elegível')

  assert.equal(externalCalls, 0)
  await mkdir('artifacts/privacy-retention', { recursive: true })
  await writeFile('artifacts/privacy-retention/d116-results.json', JSON.stringify({ phase: 'D116', date: new Date().toISOString(), environment: 'PostgreSQL sintético exclusivo', checks, reviewMonths: 12, reviewCutoff: preview.activeMarketingReview.cutoff, preview: preview.activeMarketingReview, externalCalls, realRecipientContacted: false, productionChanged: false }, null, 2) + '\n')
  console.log(`Revisão de contatos ativos: ${checks.length} cenários sintéticos aprovados; sem chamadas externas.`)
} finally { globalThis.fetch = originalFetch; await seed.cleanup() }
process.exit(0)
