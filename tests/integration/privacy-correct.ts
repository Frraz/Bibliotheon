import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { seedRelationship } from '../fixtures/relationship'
import { requestMagnet } from '../../src/modules/marketing/service'
import { correctContactEmail } from '../../src/modules/marketing/privacy-correct'
import { contactFingerprint } from '../../src/modules/marketing/contact'

const seed = await seedRelationship(), { payload } = seed
const secret = 'synthetic-correction-secret-'.padEnd(48, 'x')
try {
  const oldEmail = `orphan-${randomUUID()}@example.com`, newEmail = `fixed-${randomUUID()}@example.com`
  const contact = await payload.create({ collection: 'contacts', data: { email: oldEmail, deliveryState: 'ok' }, overrideAccess: true })
  assert.equal((await correctContactEmail(payload, oldEmail, newEmail, seed.owner.id, secret)).outcome, 'completed')
  assert.equal((await payload.findByID({ collection: 'contacts', id: contact.id, overrideAccess: true })).email, newEmail)
  assert.equal((await correctContactEmail(payload, oldEmail, newEmail, seed.owner.id, secret)).outcome, 'completed')
  await assert.rejects(requestMagnet(payload, { email: oldEmail, magnetId: seed.magnet.id, marketingOptIn: false }, secret), error => !!error && typeof error === 'object' && 'code' in error && error.code === 'unavailable')
  const thirdEmail = `third-${randomUUID()}@example.com`
  await payload.create({ collection: 'contacts', data: { email: thirdEmail, deliveryState: 'ok' }, overrideAccess: true })
  const tombstoneTarget = await correctContactEmail(payload, thirdEmail, oldEmail, seed.owner.id, secret)
  assert.equal(tombstoneTarget.outcome, 'pending')
  assert.ok(tombstoneTarget.blockers.includes('corrected_address_has_privacy_tombstone'))

  const linkedEmail = `linked-${randomUUID()}@example.com`, correctedLinkedEmail = `corrected-${randomUUID()}@example.com`
  await requestMagnet(payload, { email: linkedEmail, magnetId: seed.magnet.id, marketingOptIn: false }, secret)
  const linkedContact = (await payload.find({ collection: 'contacts', where: { email: { equals: linkedEmail } }, limit: 1, overrideAccess: true })).docs[0]
  const request = (await payload.find({ collection: 'magnet-requests', where: { contact: { equals: linkedContact.id } }, limit: 1, overrideAccess: true })).docs[0]
  const confirmation = (await payload.find({ collection: 'email-deliveries', where: { contact: { equals: linkedContact.id } }, limit: 1, overrideAccess: true })).docs[0]
  const consentCount = (await payload.count({ collection: 'consent-events', where: { contact: { equals: linkedContact.id } }, overrideAccess: true })).totalDocs
  const corrected = await correctContactEmail(payload, linkedEmail, correctedLinkedEmail, seed.owner.id, secret)
  assert.equal(corrected.outcome, 'completed')
  assert.equal((await payload.findByID({ collection: 'contacts', id: linkedContact.id, overrideAccess: true })).email, correctedLinkedEmail)
  const revokedRequest = await payload.findByID({ collection: 'magnet-requests', id: request.id, overrideAccess: true })
  assert.ok(revokedRequest.revokedAt)
  assert.equal(revokedRequest.confirmationTokenHash, null)
  assert.equal((await payload.findByID({ collection: 'email-deliveries', id: confirmation.id, overrideAccess: true })).state, 'canceled')
  assert.equal((await payload.count({ collection: 'consent-events', where: { contact: { equals: linkedContact.id } }, overrideAccess: true })).totalDocs, consentCount)
  await assert.rejects(requestMagnet(payload, { email: linkedEmail, magnetId: seed.magnet.id, marketingOptIn: false }, secret), error => !!error && typeof error === 'object' && 'code' in error && error.code === 'unavailable')

  const subscribedEmail = `subscribed-${randomUUID()}@example.com`, correctedSubscribedEmail = `subscribed-fixed-${randomUUID()}@example.com`
  const confirmedAt = new Date().toISOString()
  const subscribedContact = await payload.create({ collection: 'contacts', data: { email: subscribedEmail, confirmedAt, deliveryState: 'ok' }, overrideAccess: true })
  const theme = seed.theme
  await payload.create({ collection: 'subscriptions', data: { contact: subscribedContact.id, theme: theme.id, key: `${subscribedContact.id}:${theme.id}`, state: 'subscribed', consentVersion: 'marketing-tematico-v1', subscribedAt: confirmedAt }, overrideAccess: true })
  await payload.create({ collection: 'consent-events', data: { contact: subscribedContact.id, theme: theme.id, purpose: 'marketing', action: 'subscribed', version: 'marketing-tematico-v1', occurredAt: confirmedAt, key: `synthetic-subscription:${randomUUID()}` }, overrideAccess: true })
  await payload.create({ collection: 'brevo-registrations', data: { contact: subscribedContact.id, revision: 1, state: 'pending', attempts: 0, nextAttemptAt: confirmedAt }, overrideAccess: true })
  const preference = await payload.create({ collection: 'preference-tokens', data: { contact: subscribedContact.id, tokenHash: randomUUID().replaceAll('-', '').repeat(2), expiresAt: new Date(Date.now() + 86_400_000).toISOString() }, overrideAccess: true })
  assert.equal((await correctContactEmail(payload, subscribedEmail, correctedSubscribedEmail, seed.owner.id, secret)).outcome, 'completed')
  assert.equal((await payload.findByID({ collection: 'subscriptions', id: (await payload.find({ collection: 'subscriptions', where: { contact: { equals: subscribedContact.id } }, limit: 1, overrideAccess: true })).docs[0].id, overrideAccess: true })).state, 'subscribed')
  await assert.rejects(payload.findByID({ collection: 'preference-tokens', id: preference.id, overrideAccess: true }))
  const registration = (await payload.find({ collection: 'brevo-registrations', where: { contact: { equals: subscribedContact.id } }, limit: 1, overrideAccess: true })).docs[0]
  assert.equal(registration?.state, 'pending')
  assert.equal(registration?.revision, 2)

  const blockedEmail = `uncertain-${randomUUID()}@example.com`, replacement = `replacement-${randomUUID()}@example.com`
  await requestMagnet(payload, { email: blockedEmail, magnetId: seed.magnet.id, marketingOptIn: false }, secret)
  const blockedContact = (await payload.find({ collection: 'contacts', where: { email: { equals: blockedEmail } }, limit: 1, overrideAccess: true })).docs[0]
  const blockedDelivery = (await payload.find({ collection: 'email-deliveries', where: { contact: { equals: blockedContact.id } }, limit: 1, overrideAccess: true })).docs[0]
  await payload.update({ collection: 'email-deliveries', id: blockedDelivery.id, data: { state: 'uncertain' }, overrideAccess: true })
  const pending = await correctContactEmail(payload, blockedEmail, replacement, seed.owner.id, secret)
  assert.equal(pending.outcome, 'pending')
  assert.ok(pending.blockers.includes('delivery_in_flight_or_uncertain'))
  assert.equal((await payload.findByID({ collection: 'contacts', id: blockedContact.id, overrideAccess: true })).email, blockedEmail)
  assert.equal((await payload.count({ collection: 'privacy-request-audit', where: { and: [{ subjectFingerprint: { equals: contactFingerprint(blockedEmail, secret) } }, { action: { equals: 'correct' } }, { outcome: { equals: 'pending' } }] }, overrideAccess: true })).totalDocs, 1)
  await mkdir('artifacts/privacy-correct', { recursive: true })
  await writeFile('artifacts/privacy-correct/local-results.json', JSON.stringify({ date: '2026-10-25 America/Belem', environment: 'PostgreSQL local sintético; titulares fictícios', checks: ['correção mantém relações locais e replay idempotente', 'pedido não confirmado invalidado e outbox de confirmação cancelado', 'subscription/consentimento preservados; job de registro ainda não enviado é revisado para novo endereço', 'tokens de preferência antigos invalidados', 'tombstone impede recaptura do endereço anterior e impede reutilizá-lo como destino', 'entrega uncertain retorna pending sem alterar contato'], externalCalls: false, messagesSent: 0 }, null, 2) + '\n')
  console.log('Correção de privacidade: consentimento preservado, confirmação invalidada e estados incertos bloqueados.')
} finally { await seed.cleanup() }
process.exit(0)
