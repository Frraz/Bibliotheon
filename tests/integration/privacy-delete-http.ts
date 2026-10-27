import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { seedRelationship } from '../fixtures/relationship'
import { testOrigin } from '../fixtures/origin'
import { requestMagnet } from '../../src/modules/marketing/service'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true')
const seed = await seedRelationship(), { payload } = seed
const secret = 'synthetic-delete-http-secret-'.padEnd(48, 'x')
const post = (data: unknown, token?: string, origin = testOrigin) => fetch(`${testOrigin}/api/v1/admin/privacy/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(token ? { Authorization: `JWT ${token}` } : {}) }, body: JSON.stringify(data) })
try {
  const email = `delete-http-${randomUUID()}@example.invalid`
  await requestMagnet(payload, { email, magnetId: seed.magnet.id, marketingOptIn: false }, secret)
  const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, limit: 1, overrideAccess: true })).docs[0]
  const login = await payload.login({ collection: 'admin-users', data: { email: seed.owner.email, password: seed.password } })
  assert.ok(login.token)
  assert.equal((await post({ email, identityVerified: true, confirmDelete: 'EXCLUIR' })).status, 403)
  assert.equal((await post({ email, identityVerified: true, confirmDelete: 'EXCLUIR' }, login.token, 'https://foreign.example.invalid')).status, 403)
  assert.equal((await post({ email, identityVerified: true, confirmDelete: 'APAGAR' }, login.token)).status, 422)
  const result = await post({ email, identityVerified: true, confirmDelete: 'EXCLUIR' }, login.token)
  assert.equal(result.status, 200)
  assert.equal(result.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(result.headers.get('Referrer-Policy'), 'no-referrer')
  assert.equal(JSON.stringify(await result.json()).includes(email), false)
  await assert.rejects(payload.findByID({ collection: 'contacts', id: contact.id, overrideAccess: true }))
  assert.equal((await post({ email, identityVerified: true, confirmDelete: 'EXCLUIR' }, login.token)).status, 200)

  const blockedEmail = `delete-http-pending-${randomUUID()}@example.invalid`
  await requestMagnet(payload, { email: blockedEmail, magnetId: seed.magnet.id, marketingOptIn: false }, secret)
  const blockedContact = (await payload.find({ collection: 'contacts', where: { email: { equals: blockedEmail } }, limit: 1, overrideAccess: true })).docs[0]
  const delivery = (await payload.find({ collection: 'email-deliveries', where: { contact: { equals: blockedContact.id } }, limit: 1, overrideAccess: true })).docs[0]
  await payload.update({ collection: 'email-deliveries', id: delivery.id, data: { state: 'uncertain' }, overrideAccess: true })
  const pending = await post({ email: blockedEmail, identityVerified: true, confirmDelete: 'EXCLUIR' }, login.token)
  assert.equal(pending.status, 200)
  assert.equal((await pending.json()).outcome, 'pending')
  assert.ok(await payload.findByID({ collection: 'contacts', id: blockedContact.id, overrideAccess: true }))
  await mkdir('artifacts/privacy-delete', { recursive: true })
  await writeFile('artifacts/privacy-delete/http-results.json', JSON.stringify({ date: '2026-10-25 America/Belem', environment: 'Next standalone e PostgreSQL local sintético; dados fictícios', checks: ['owner obrigatório', 'origem exata e confirmação explícita', 'no-store/no-referrer sem eco de email', 'conclusão repetida sem falha', 'estado uncertain retorna pending e preserva contato'], externalCalls: false, messagesSent: 0 }, null, 2) + '\n')
  console.log('Exclusão HTTP de privacidade: owner, origem, repetição e pending aprovados.')
} finally { await seed.cleanup() }
process.exit(0)
