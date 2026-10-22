import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { getPayload } from 'payload'
import config from '../../src/payload.config'

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Teste permitido apenas em loopback.')
assert.ok(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL || '').hostname), 'Teste permitido apenas em banco loopback.')
const payload = await getPayload({ config })
const email = `owner-${randomBytes(8).toString('hex')}@example.invalid`
const password = randomBytes(32).toString('hex')
let id: string | undefined
const post = (path: string, body: unknown) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
try {
  assert.equal((await payload.count({ collection: 'admin-users', overrideAccess: true })).totalDocs, 0, 'Use banco de teste sem owner.')
  assert.equal((await post('/api/admin-users/first-register', { email, password })).status, 403)
  assert.equal((await payload.count({ collection: 'admin-users', overrideAccess: true })).totalDocs, 0)
  assert.equal((await post('/api/admin-users', { email, password, role: 'owner' })).status, 403)
  await assert.rejects(payload.find({ collection: 'admin-users', overrideAccess: false, user: null }))
  await assert.rejects(payload.create({ collection: 'admin-users', data: { email, password, role: 'owner' }, overrideAccess: true }))
  const created = await payload.create({ collection: 'admin-users', data: { email, password, role: 'owner' }, overrideAccess: true, context: { provisionAdmin: true } })
  id = created.id
  const anonymous = await fetch(base + '/api/admin-users')
  assert.equal(anonymous.status, 403)
  assert.equal((await post('/api/admin-users/first-register', { email, password })).status, 403)
  const login = await post('/api/admin-users/login', { email, password })
  assert.equal(login.status, 200)
  const sessionCookie = login.headers.get('set-cookie') || ''
  assert.equal(/httponly/i.test(sessionCookie), true, 'Cookie de sessão deve ser HttpOnly.')
  assert.equal(/samesite=lax/i.test(sessionCookie), true, 'Cookie de sessão deve ser SameSite Lax.')
  assert.equal(/;\s*secure/i.test(sessionCookie), true, 'Execute integração HTTP no build de produção com cookie Secure.')
  const { token } = await login.json() as { token: string }
  assert.ok(token)
  const ownerRead = await fetch(base + '/api/admin-users', { headers: { Authorization: `JWT ${token}` } })
  assert.equal(ownerRead.status, 200)
  const body = await ownerRead.json() as { docs: { email: string }[] }
  assert.equal(body.docs.length, 1)
  assert.equal(body.docs[0].email, email)
  const csrf = await fetch(base + `/api/admin-users/${created.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: sessionCookie.split(';')[0], Origin: 'https://origem-nao-autorizada.example.invalid' }, body: JSON.stringify({ email }) })
  assert.equal(csrf.status, 403, 'Sessão não deve autorizar mutação por origem externa.')
  const localRead = await payload.find({ collection: 'admin-users', overrideAccess: false, user: { ...created, collection: 'admin-users' } })
  assert.equal(localRead.totalDocs, 1)
  assert.equal((await post('/api/graphql', { query: '{ AdminUsers { docs { email } } }' })).status, 404)
  assert.equal((await fetch(base + '/health/live')).status, 200)
  assert.equal((await fetch(base + '/health/ready')).status, 200)
  console.log('T01 aprovado: first-register bloqueado antes/depois, criação pública e Local API negadas, owner autorizado, GraphQL ausente, saúde OK.')
} finally {
  if (id) await payload.delete({ collection: 'admin-users', id, overrideAccess: true })
  await payload.destroy()
}
// Payload CLI also exits explicitly; ancillary framework handles may remain open.
process.exit(0)
