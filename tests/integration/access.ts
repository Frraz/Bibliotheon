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
const suppressionEmail = `access-suppression-${randomBytes(8).toString('hex')}@example.invalid`
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
  for (const collection of ['commercial-inbox','commercial-conflicts','transactions','transaction-events','commercial-audit','analytics-grants','visits','page-views','checkout-clicks','analytics-limits','email-campaign-batches', 'promotion-deliveries', 'sequence-enrollments', 'brevo-suppressions', 'brevo-registrations', 'brevo-webhook-events', 'brevo-delivery-receipts', 'brevo-campaign-observations', 'brevo-campaign-sends', 'brevo-campaign-drafts', 'brevo-batch-lists', 'preference-tokens']) {
    assert.equal((await fetch(base + `/api/${collection}`)).status, 403)
    assert.equal((await post(`/api/${collection}`, {})).status, 403)
  }
  assert.equal((await post('/api/admin-users/first-register', { email, password })).status, 403)
  const login = await post('/api/admin-users/login', { email, password })
  assert.equal(login.status, 200)
  const sessionCookie = login.headers.get('set-cookie') || ''
  assert.equal(/httponly/i.test(sessionCookie), true, 'Cookie de sessão deve ser HttpOnly.')
  assert.equal(/samesite=lax/i.test(sessionCookie), true, 'Cookie de sessão deve ser SameSite Lax.')
  assert.equal(/;\s*secure/i.test(sessionCookie), true, 'Execute integração HTTP no build de produção com cookie Secure.')
  const { token } = await login.json() as { token: string }
  assert.ok(token)
  const suppression = await fetch(base + '/api/v1/admin/suppressions', { method: 'POST', headers: { Authorization: `JWT ${token}`, Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: suppressionEmail, reason: 'unsubscribed', source: 'manual', reference: 'synthetic-http-suppression' }) })
  assert.equal(suppression.status, 200)
  const forgedObservation = await fetch(base + '/api/v1/admin/suppressions', { method: 'POST', headers: { Authorization: `JWT ${token}`, Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: suppressionEmail, reason: 'provider_blocked', source: 'brevo-review', reference: 'synthetic-forged-provider-observation' }) })
  assert.equal(forgedObservation.status, 422, 'Action observada pelo provedor não pode ser fabricada por entrada manual.')
  const suppressed = (await payload.find({ collection: 'contacts', where: { email: { equals: suppressionEmail } }, depth: 0, overrideAccess: true })).docs[0]
  assert.ok(suppressed.globalSuppressedAt)
  const queued = (await payload.find({ collection: 'brevo-suppressions', where: { contact: { equals: suppressed.id } }, depth: 0, overrideAccess: true })).docs[0]
  assert.equal(queued.state, 'pending')
  const ownerRead = await fetch(base + '/api/admin-users', { headers: { Authorization: `JWT ${token}` } })
  assert.equal(ownerRead.status, 200)
  for (const collection of ['commercial-inbox','commercial-conflicts','transactions','transaction-events','commercial-audit','analytics-grants','visits','page-views','checkout-clicks','analytics-limits','email-campaign-batches', 'brevo-suppressions', 'brevo-registrations', 'brevo-webhook-events', 'brevo-delivery-receipts', 'brevo-campaign-observations', 'brevo-campaign-sends', 'brevo-campaign-drafts', 'brevo-batch-lists', 'preference-tokens']) assert.equal((await fetch(base + `/api/${collection}`, { headers: { Authorization: `JWT ${token}` } })).status, 200)
  for (const collection of ['commercial-inbox','commercial-conflicts','transactions','transaction-events','commercial-audit']) {
    assert.equal((await fetch(base + `/api/${collection}`, {method:'POST',headers:{Authorization:`JWT ${token}`,'Content-Type':'application/json'},body:'{}'})).status,403)
    for(const method of ['PATCH','DELETE'])assert.equal((await fetch(base + `/api/${collection}/00000000-0000-4000-8000-000000000000`,{method,headers:{Authorization:`JWT ${token}`,'Content-Type':'application/json'},...(method==='PATCH'?{body:'{}'}:{})})).status,403)
  }
  assert.equal((await post('/api/v1/admin/inbox/00000000-0000-4000-8000-000000000000/retry',{reason:'service_restored'})).status,403)
  const retryInput=await fetch(base+'/api/v1/admin/inbox/invalid/retry',{method:'POST',headers:{Authorization:`JWT ${token}`,Origin:base,'Content-Type':'application/json'},body:'{"reason":"service_restored"}'})
  assert.equal(retryInput.status,422)
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
  const synthetic = await payload.find({ collection: 'contacts', where: { email: { equals: suppressionEmail } }, depth: 0, overrideAccess: true })
  for (const contact of synthetic.docs) {
    for (const collection of ['brevo-suppressions', 'consent-events'] as const) await payload.delete({ collection, where: { contact: { equals: contact.id } }, overrideAccess: true })
    await payload.delete({ collection: 'contacts', id: contact.id, overrideAccess: true })
  }
  if (id) await payload.delete({ collection: 'admin-users', id, overrideAccess: true })
  await payload.destroy()
}
// Payload CLI also exits explicitly; ancillary framework handles may remain open.
process.exit(0)
