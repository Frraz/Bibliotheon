import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { seedRelationship } from '../fixtures/relationship'
import { requestMagnet } from '../../src/modules/marketing/service'
import { deleteContactData } from '../../src/modules/marketing/privacy-delete'

const seed = await seedRelationship(), { payload } = seed
const secret = 'synthetic-delete-secret-'.padEnd(48, 'x')
const email = `erase-${randomUUID()}@example.com`
try {
  await requestMagnet(payload, { email, magnetId: seed.magnet.id, marketingOptIn: false }, secret)
  const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, limit: 1, overrideAccess: true })).docs[0]
  const done = await deleteContactData(payload, email, seed.owner.id, secret)
  assert.equal(done.outcome, 'completed')
  assert.equal(done.counts.contacts, 1)
  await assert.rejects(payload.findByID({ collection: 'contacts', id: contact.id, overrideAccess: true }))
  assert.equal((await payload.count({ collection: 'magnet-requests', where: { contact: { equals: contact.id } }, overrideAccess: true })).totalDocs, 0)
  assert.equal((await payload.count({ collection: 'consent-events', where: { contact: { equals: contact.id } }, overrideAccess: true })).totalDocs, 0)
  assert.equal((await payload.count({ collection: 'email-deliveries', where: { contact: { equals: contact.id } }, overrideAccess: true })).totalDocs, 0)
  await assert.rejects(requestMagnet(payload, { email, magnetId: seed.magnet.id, marketingOptIn: false }, secret), error => !!error && typeof error === 'object' && 'code' in error && error.code === 'unavailable')
  assert.equal((await payload.count({ collection: 'privacy-request-audit', where: { action: { equals: 'delete' }, outcome: { equals: 'completed' } }, overrideAccess: true })).totalDocs, 1)
  assert.equal((await deleteContactData(payload, email, seed.owner.id, secret)).outcome, 'completed')
  assert.equal((await payload.count({ collection: 'privacy-request-audit', where: { action: { equals: 'delete' }, outcome: { equals: 'completed' } }, overrideAccess: true })).totalDocs, 1)

  const blockedEmail = `pending-${randomUUID()}@example.com`
  await requestMagnet(payload, { email: blockedEmail, magnetId: seed.magnet.id, marketingOptIn: false }, secret)
  const blockedContact = (await payload.find({ collection: 'contacts', where: { email: { equals: blockedEmail } }, limit: 1, overrideAccess: true })).docs[0]
  const delivery = (await payload.find({ collection: 'email-deliveries', where: { contact: { equals: blockedContact.id } }, limit: 1, overrideAccess: true })).docs[0]
  await payload.update({ collection: 'email-deliveries', id: delivery.id, data: { state: 'uncertain' }, overrideAccess: true })
  const pending = await deleteContactData(payload, blockedEmail, seed.owner.id, secret)
  assert.equal(pending.outcome, 'pending')
  assert.ok(pending.blockers.includes('delivery_in_flight_or_uncertain'))
  assert.ok(await payload.findByID({ collection: 'contacts', id: blockedContact.id, overrideAccess: true }))
  assert.equal((await deleteContactData(payload, blockedEmail, seed.owner.id, secret)).outcome, 'pending')
  assert.equal((await payload.count({ collection: 'privacy-request-audit', where: { action: { equals: 'delete' }, outcome: { equals: 'pending' } }, overrideAccess: true })).totalDocs, 1)
  console.log('Exclusão de privacidade: 2 verificações PostgreSQL sintéticas aprovadas.')
} finally { await seed.cleanup() }
process.exit(0)
