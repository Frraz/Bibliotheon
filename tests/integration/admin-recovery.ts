import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { getPayload } from 'payload'
import config from '../../src/payload.config'
import { testOrigin } from '../fixtures/origin'

assert.ok(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL || '').hostname), 'Teste somente em banco loopback.')
const payload = await getPayload({ config })
assert.equal((await payload.count({ collection: 'admin-users', overrideAccess: true })).totalDocs, 0, 'Use banco sem owner.')
const email = `recovery-${randomBytes(5).toString('hex')}@example.invalid`, password = randomBytes(32).toString('hex'), replacement = randomBytes(32).toString('hex')
const owner = await payload.create({ collection: 'admin-users', data: { email, password, role: 'owner' }, overrideAccess: true, context: { provisionAdmin: true } })
try {
  async function post(path: string, data: unknown, token?: string) {
    return fetch(testOrigin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: testOrigin, ...(token ? { Authorization: `JWT ${token}` } : {}) }, body: JSON.stringify(data) })
  }
  async function cli(value: unknown) {
    return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
      const child = spawn(process.execPath, ['--env-file-if-exists=.env.local', '--import', 'tsx', 'scripts/recover-admin.ts'], { stdio: ['pipe', 'pipe', 'pipe'] })
      const timeout = setTimeout(() => child.kill('SIGTERM'), 30_000)
      let output = ''
      child.stdout.on('data', bytes => { output += bytes.toString() })
      child.stderr.on('data', bytes => { output += bytes.toString() })
      child.on('error', error => { clearTimeout(timeout); reject(error) })
      child.on('close', code => { clearTimeout(timeout); resolve({ code, output }) })
      child.stdin.end(JSON.stringify(value))
    })
  }
  const login = await post('/api/admin-users/login', { email, password })
  assert.equal(login.status, 200)
  const { token } = await login.json() as { token: string }
  assert.ok(token)
  const before = await fetch(`${testOrigin}/api/admin-users/me`, { headers: { Authorization: `JWT ${token}` } })
  assert.equal((await before.json()).user?.id, owner.id)
  const forgotKnown = await post('/api/admin-users/forgot-password', { email })
  const forgotUnknown = await post('/api/admin-users/forgot-password', { email: 'not-owner@example.invalid' })
  assert.equal(forgotKnown.status, 503); assert.equal(forgotUnknown.status, 503)
  assert.deepEqual(await forgotKnown.json(), await forgotUnknown.json())
  assert.match(forgotKnown.headers.get('cache-control') || '', /no-store/)
  const publicReset = await post('/api/admin-users/reset-password', { token: 'synthetic-only', password: replacement })
  assert.equal(publicReset.status, 503)
  const publicUnlock = await post('/api/admin-users/unlock', { email })
  assert.equal(publicUnlock.status, 403)
  const unchanged = await payload.findByID({ collection: 'admin-users', id: owner.id, overrideAccess: true, showHiddenFields: true })
  assert.equal(unchanged.resetPasswordToken || null, null)
  const short = await cli({ email, password: 'short' })
  assert.equal(short.code, 1); assert.equal(short.output.includes(email), false)
  const missing = await cli({ email: 'not-owner@example.invalid', password: replacement })
  assert.equal(missing.code, 1)
  assert.equal(missing.output.includes('not-owner@example.invalid'), false)
  assert.equal(missing.output.includes(replacement), false)
  await payload.update({ collection: 'admin-users', id: owner.id, data: { loginAttempts: 5, lockUntil: new Date(Date.now() + 900_000).toISOString(), resetPasswordToken: 'synthetic-old-recovery-token', resetPasswordExpiration: new Date(Date.now() + 900_000).toISOString(), resetPasswordRequestedAt: new Date().toISOString() }, overrideAccess: true })
  const recovered = await cli({ email, password: replacement })
  assert.equal(recovered.code, 0, 'CLI deveria concluir sem imprimir dados privados.')
  for (const sensitive of [email, password, replacement, token]) assert.equal(recovered.output.includes(sensitive), false)
  const updated = await payload.findByID({ collection: 'admin-users', id: owner.id, depth: 0, overrideAccess: true, showHiddenFields: true })
  assert.equal(updated.sessions?.length || 0, 0)
  assert.equal(updated.loginAttempts || 0, 0)
  assert.equal(updated.lockUntil || null, null)
  assert.equal(updated.resetPasswordToken || null, null)
  assert.equal(updated.resetPasswordExpiration || null, null)
  assert.equal(updated.resetPasswordRequestedAt || null, null)
  const stale = await fetch(`${testOrigin}/api/admin-users/me`, { headers: { Authorization: `JWT ${token}` } })
  assert.equal((await stale.json()).user || null, null)
  const old = await post('/api/admin-users/login', { email, password })
  assert.equal(old.status, 401)
  const fresh = await post('/api/admin-users/login', { email, password: replacement })
  assert.equal(fresh.status, 200)
  assert.equal((await fresh.json()).user?.id, owner.id)
  assert.equal((await payload.count({ collection: 'admin-users', overrideAccess: true })).totalDocs, 1)
  await mkdir('artifacts/admin-recovery', { recursive: true })
  await writeFile('artifacts/admin-recovery/local-results.json', JSON.stringify({ environment: 'PostgreSQL/standalone loopback; owner sintético', origin: testOrigin, checks: ['recuperação pública por e-mail/reset indisponível com resposta igual; unlock público negado; nenhum token criado', 'entrada curta/contato desconhecido recusados sem eco', 'senha trocada pela CLI privada, sem nova conta', 'sessões, reset token, cooldown e lockout anteriores removidos', 'JWT anterior sem acesso; senha antiga recusada; nova senha aceita'], externalCalls: false, limits: 'Recuperação por operador local; não homologa recuperação por e-mail ou acesso real à VPS.' }, null, 2))
  console.log('Recuperação administrativa: CLI privada, revogação de sessões, senha e desbloqueio aprovados localmente.')
} finally {
  await payload.delete({ collection: 'admin-users', id: owner.id, overrideAccess: true })
  await payload.destroy()
}
process.exit(0)
