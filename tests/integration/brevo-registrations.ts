import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { seedRelationship } from '../fixtures/relationship'
import { confirmMagnet, requestMagnet, unsubscribe } from '../../src/modules/marketing/service'
import { processDelivery } from '../../src/modules/marketing/delivery'
import { CONSENT_VERSION } from '../../src/modules/marketing/validation'
import { createOpaqueToken, UNSUBSCRIBE_TTL } from '../../src/modules/marketing/tokens'
import { createBrevoContacts } from '../../src/integrations/brevo/contacts'
import { processBrevoRegistration, syncBrevoRegistrations, syncBrevoRegistrationCleanup, retryFailedBrevoRegistrations } from '../../src/modules/marketing/brevo-registration'
import { processBrevoSuppression } from '../../src/modules/marketing/brevo-suppression'
import { atomic } from '../../src/modules/marketing/transaction'
import { up, down } from '../../migrations/20261022_060415_brevo_registrations'

const seed = await seedRelationship(), { payload, magnet } = seed
const secret = randomBytes(32).toString('hex'), suffix = randomBytes(6).toString('hex'), now = Date.now(), checks: string[] = []
const jobFor = async (contact: string) => (await payload.find({ collection: 'brevo-registrations', where: { contact: { equals: contact } }, depth: 0, overrideAccess: true })).docs[0]
const blockFor = async (contact: string) => (await payload.find({ collection: 'brevo-suppressions', where: { contact: { equals: contact } }, depth: 0, overrideAccess: true })).docs[0]
const remote = new Map<string, { id: number; blocked: boolean }>(), postCounts = new Map<string, number>(), uncertain = new Set<string>(), getFails = new Set<string>(), rejected = new Set<string>()
let puts = 0
const client = createBrevoContacts('synthetic-only-key', async (url, options) => {
  const target = new URL(String(url))
  assert.equal(target.origin, 'https://api.brevo.com')
  if (options?.method === 'POST') {
    const data = JSON.parse(String(options.body)), email = data.email as string
    assert.deepEqual(data, { email, updateEnabled: false, forceMerge: false })
    postCounts.set(email, (postCounts.get(email) ?? 0) + 1)
    if (rejected.has(email)) return new Response(null, { status: 400 })
    if (remote.has(email)) return new Response(null, { status: 400 })
    remote.set(email, { id: remote.size + 1, blocked: false })
    if (uncertain.delete(email)) { getFails.add(email); throw new Error('synthetic response lost after creation') }
    return new Response('{}', { status: 201 })
  }
  const email = decodeURIComponent(target.pathname.slice('/v3/contacts/'.length))
  if (getFails.delete(email)) throw new Error('synthetic lookup unavailable')
  const value = remote.get(email)
  if (!value) return new Response(null, { status: 404 })
  if (options?.method === 'PUT') { assert.deepEqual(JSON.parse(String(options.body)), { emailBlacklisted: true }); puts++; value.blocked = true; return new Response(null, { status: 204 }) }
  return new Response(JSON.stringify({ email, id: value.id, emailBlacklisted: value.blocked }), { status: 200 })
})
async function pending(name: string, optIn = true, emailOverride?: string, time = now) {
  const email = emailOverride || `${name}-${suffix}@example.invalid`
  await requestMagnet(payload, { email, magnetId: magnet.id, marketingOptIn: optIn, ...(optIn ? { consentVersion: CONSENT_VERSION } : {}) }, secret, time)
  const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, depth: 0, overrideAccess: true })).docs[0]
  const request = (await payload.find({ collection: 'magnet-requests', where: { contact: { equals: contact.id } }, sort: '-createdAt', depth: 0, overrideAccess: true })).docs[0]
  const confirmation = (await payload.find({ collection: 'email-deliveries', where: { and: [{ request: { equals: request.id } }, { kind: { equals: 'confirmation' } }] }, depth: 0, overrideAccess: true })).docs[0]
  let token = ''
  await processDelivery(payload, confirmation.id, { secret, now: time, origin: 'http://127.0.0.1:3000', transport: async message => { token = /\/amostras\/confirmar\?t=([\w-]+)/.exec(message.text)?.[1] || ''; return { state: 'sent', messageId: 'synthetic-contact-confirmation' } } })
  assert.ok(token)
  return { contact, request, token, time }
}
async function confirmed(name: string) { const person = await pending(name); await confirmMagnet(payload, person.token, secret, person.time); return { ...person, job: await jobFor(person.contact.id) } }
async function withdraw(contact: string, time = now) {
  const token = createOpaqueToken()
  await payload.create({ collection: 'preference-tokens', data: { contact, tokenHash: token.hash, expiresAt: new Date(time + UNSUBSCRIBE_TTL).toISOString() }, overrideAccess: true })
  await unsubscribe(payload, token.token, time, secret)
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
try {
  await assert.rejects(atomic(payload, async req => {
    const transaction = await req.transactionID; assert.ok(transaction)
    const db = (payload.db as unknown as PostgresAdapter).sessions[transaction].db
    await down({ db, payload, req })
    await db.execute(sql`INSERT INTO contacts (email, confirmed_at, global_suppressed_at, delivery_state) VALUES
      (${`legacy-opted-${suffix}@example.invalid`}, now(), NULL, 'ok'),
      (${`legacy-sample-${suffix}@example.invalid`}, now(), NULL, 'ok'),
      (${`legacy-blocked-${suffix}@example.invalid`}, now(), now(), 'ok'),
      (${`legacy-pending-${suffix}@example.invalid`}, NULL, NULL, 'ok')`)
    await db.execute(sql`INSERT INTO subscriptions (contact_id, theme_id, key, state) SELECT id, ${seed.theme.id}, email, 'subscribed' FROM contacts WHERE email <> ${`legacy-sample-${suffix}@example.invalid`}`)
    await up({ db, payload, req })
    const result = await db.execute(sql`SELECT count(*)::int AS total FROM brevo_registrations`)
    assert.equal(Number(result.rows[0]?.total), 1)
    throw new Error('synthetic registration migration rollback')
  }), /synthetic registration migration rollback/)
  assert.equal((await payload.count({ collection: 'contacts', overrideAccess: true })).totalDocs, 0)
  checks.push('Up/down e preenchimento histórico testados em transação revertida: somente confirmado com assinatura ativa, sem bloqueio, entra na fila.')

  const sample = await pending('sample-only', false)
  await confirmMagnet(payload, sample.token, secret, now)
  assert.equal(await jobFor(sample.contact.id), undefined)
  const first = await pending('confirmed')
  assert.equal(await jobFor(first.contact.id), undefined)
  const hooks = payload.collections['brevo-registrations'].config.hooks, previous = hooks.afterChange
  hooks.afterChange = [...previous, async () => { throw new Error('synthetic registration enqueue rollback') }]
  try { await assert.rejects(confirmMagnet(payload, first.token, secret, now), /synthetic registration enqueue rollback/) }
  finally { hooks.afterChange = previous }
  assert.equal((await payload.findByID({ collection: 'magnet-requests', id: first.request.id, depth: 0, overrideAccess: true })).confirmedAt, null)
  assert.equal((await payload.count({ collection: 'subscriptions', where: { contact: { equals: first.contact.id } }, overrideAccess: true })).totalDocs, 0)
  await confirmMagnet(payload, first.token, secret, now); await confirmMagnet(payload, first.token, secret, now)
  const job = await jobFor(first.contact.id)
  assert.equal(job.revision, 1); assert.equal(job.state, 'pending')
  assert.equal((await syncBrevoRegistrations(payload, { client: null, secret, now })).enabled, false)
  assert.equal((await jobFor(first.contact.id)).attempts, 0)
  assert.equal(JSON.stringify(job).includes(first.contact.email), false)
  const claims = await Promise.all([processBrevoRegistration(payload, job.id, { client, secret, now }), processBrevoRegistration(payload, job.id, { client, secret, now })])
  assert.equal(claims.filter(result => result.state === 'synced').length, 1)
  assert.equal(postCounts.get(first.contact.email), 1)
  checks.push('Amostra sem marketing e pedido não confirmado não cadastram; confirmação/outbox são atômicas, replay não duplica e claim concorrente cria uma vez, sem endereço na fila.')

  const blocked = await confirmed('existing-blocked')
  remote.set(blocked.contact.email, { id: remote.size + 1, blocked: true })
  assert.equal((await processBrevoRegistration(payload, blocked.job.id, { client, secret, now })).state, 'canceled')
  assert.equal(postCounts.get(blocked.contact.email), undefined)
  const blockedContact = await payload.findByID({ collection: 'contacts', id: blocked.contact.id, depth: 0, overrideAccess: true })
  assert.ok(blockedContact.globalSuppressedAt); assert.equal(blockedContact.deliveryState, 'ok')
  assert.equal((await payload.count({ collection: 'consent-events', where: { and: [{ contact: { equals: blocked.contact.id } }, { action: { equals: 'provider_blocked' } }] }, overrideAccess: true })).totalDocs, 1)
  checks.push('Contato já bloqueado não recebe POST/reativação; observação importa bloqueio local com action própria e preserva independência da amostra.')

  const lost = await confirmed('lost-response'); uncertain.add(lost.contact.email)
  assert.equal((await processBrevoRegistration(payload, lost.job.id, { client, secret, now })).state, 'pending')
  assert.equal((await processBrevoRegistration(payload, lost.job.id, { client, secret, now: now + 59_999 })).state, 'held')
  assert.equal((await processBrevoRegistration(payload, lost.job.id, { client, secret, now: now + 60_000 })).state, 'synced')
  assert.equal(postCounts.get(lost.contact.email), 1)
  checks.push('Timeout após criação e GET indisponível deixam pendência; retomada reconcilia por GET antes de qualquer POST e não duplica o contato criado.')

  const race = await confirmed('withdraw-in-flight'), entered = deferred<void>(), release = deferred<void>()
  const flight = processBrevoRegistration(payload, race.job.id, { client: { ...client, ensure: async () => { entered.resolve(); await release.promise; return { state: 'retry' } } }, secret, now })
  await entered.promise
  try {
    await withdraw(race.contact.id)
    assert.equal((await jobFor(race.contact.id)).state, 'processing')
    assert.equal((await processBrevoSuppression(payload, (await blockFor(race.contact.id)).id, { client, now })).state, 'synced')
    assert.equal((await blockFor(race.contact.id)).outcome, 'absent')
  } finally { release.resolve() }
  assert.equal((await flight).state, 'canceling')
  assert.equal((await blockFor(race.contact.id)).state, 'pending')
  await syncBrevoRegistrationCleanup(payload, { client, secret, now: now + 60_000 })
  assert.equal((await jobFor(race.contact.id)).state, 'canceling', '404 durante cadastro incerto não encerra a compensação.')
  const beforePosts = postCounts.get(race.contact.email) ?? 0, beforePuts = puts
  remote.set(race.contact.email, { id: remote.size + 1, blocked: false }) // Simulate the prior POST finally being applied.
  await syncBrevoRegistrationCleanup(payload, { client, secret, now: now + 180_000 })
  assert.equal((await jobFor(race.contact.id)).state, 'canceled')
  assert.equal(remote.get(race.contact.email)?.blocked, true)
  assert.equal(postCounts.get(race.contact.email) ?? 0, beforePosts); assert.equal(puts, beforePuts + 1)
  checks.push('Descadastro em voo reabre bloqueio antes observado ausente; 404 não esquece criação incerta. Compensação continua com cadastro desabilitado, só GET/PUT, e confirma bloqueio tardio.')

  const stale = await confirmed('lost-worker'), started = deferred<void>(), finish = deferred<void>()
  let ensureCalls = 0
  const old = processBrevoRegistration(payload, stale.job.id, { client: { ...client, ensure: async email => { ensureCalls++; remote.set(email, { id: remote.size + 1, blocked: false }); started.resolve(); await finish.promise; return { state: 'retry' } } }, secret, now })
  await started.promise
  try {
    assert.equal((await processBrevoRegistration(payload, stale.job.id, { client, secret, now: now + 30 * 60_000 - 1 })).state, 'held')
    await syncBrevoRegistrationCleanup(payload, { client, secret, now: now + 30 * 60_000 })
    assert.equal((await jobFor(stale.contact.id)).state, 'synced')
  } finally { finish.resolve() }
  assert.equal((await old).state, 'held'); assert.equal(ensureCalls, 1)
  checks.push('Lease de 30 minutos retoma processo perdido por consulta, mesmo sem criar novos contatos; resposta antiga não sobrescreve resultado novo.')

  const renewed = await confirmed('new-consent-in-flight'), renewStarted = deferred<void>(), renewFinish = deferred<void>()
  const renewing = processBrevoRegistration(payload, renewed.job.id, { client: { ...client, ensure: async email => { remote.set(email, { id: remote.size + 1, blocked: false }); renewStarted.resolve(); await renewFinish.promise; return client.inspect(email) } }, secret, now })
  await renewStarted.promise
  try {
    const newer = await pending('new-confirmation', true, renewed.contact.email, now + 16 * 60_000)
    await confirmMagnet(payload, newer.token, secret, newer.time)
    assert.equal((await jobFor(renewed.contact.id)).revision, 2)
    assert.equal((await jobFor(renewed.contact.id)).state, 'processing')
  } finally { renewFinish.resolve() }
  assert.equal((await renewing).state, 'pending')
  assert.equal((await jobFor(renewed.contact.id)).attempts, 1)
  assert.equal((await processBrevoRegistration(payload, renewed.job.id, { client, secret, now: now + 16 * 60_000 })).state, 'synced')
  assert.equal(postCounts.get(renewed.contact.email), undefined)
  checks.push('Nova confirmação em voo aumenta revisão sem perder lease/histórico; conclusão anterior não confirma geração nova e retomada consulta sem outro POST.')

  const bad = await confirmed('rejected'); rejected.add(bad.contact.email)
  assert.equal((await processBrevoRegistration(payload, bad.job.id, { client, secret, now })).state, 'failed')
  rejected.delete(bad.contact.email)
  assert.equal((await retryFailedBrevoRegistrations(payload, now)).queued, 1)
  assert.equal((await processBrevoRegistration(payload, bad.job.id, { client, secret, now })).state, 'synced')
  await assert.rejects(payload.find({ collection: 'brevo-registrations', user: null, overrideAccess: false }))
  await assert.rejects(payload.update({ collection: 'brevo-registrations', id: job.id, ...seed.auth, data: { state: 'synced' } }))
  assert.ok((await payload.find({ collection: 'brevo-registrations', ...seed.auth })).totalDocs > 0)
  await assert.rejects(atomic(payload, async req => {
    const transaction = await req.transactionID; assert.ok(transaction)
    await down({ db: (payload.db as unknown as PostgresAdapter).sessions[transaction].db, payload, req })
  }), /Downgrade recusado/)
  checks.push('Recusa definitiva requer retry explícito; coleção privada é somente leitura para owner; downgrade recusa perder tentativas/compensações.')

  const observed = await confirmed('observed-after-call')
  let observedClock = now
  await processBrevoRegistration(payload, observed.job.id, { client: { ...client, ensure: async () => { observedClock += 45_000; return { state: 'found', id: 9000, blocked: true } } }, secret, clock: () => observedClock })
  const observation = (await payload.find({ collection: 'consent-events', where: { and: [{ contact: { equals: observed.contact.id } }, { action: { equals: 'provider_blocked' } }] }, depth: 0, overrideAccess: true })).docs[0]
  assert.equal(observation.occurredAt, new Date(now + 45_000).toISOString())
  checks.push('Auditoria usa o instante após a resposta externa, sem retroagir o bloqueio ao início da consulta e enfraquecer a ordem de novas confirmações.')

  const packed = await confirmed('packed-cli')
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'bibliotheon-registration-cli-'))
  try {
    const bootstrap = path.join(temporary, 'synthetic-http.mjs')
    await writeFile(bootstrap, `import assert from 'node:assert/strict'
let created = false
 globalThis.fetch = async (input, options) => {
  const url = new URL(String(input))
  assert.equal(url.origin, 'https://api.brevo.com')
  if (options?.method === 'POST' && url.pathname === '/v3/contacts') {
    const value = JSON.parse(options.body)
    assert.ok(value.email.endsWith('@example.invalid'))
    assert.deepEqual(value, { email: value.email, updateEnabled: false, forceMerge: false })
    created = true
    return new Response('{}', { status: 201 })
  }
  if (options?.method === 'GET' && url.pathname.startsWith('/v3/contacts/')) {
    return created ? new Response(JSON.stringify({ id: 18001, emailBlacklisted: false, email: decodeURIComponent(url.pathname.slice('/v3/contacts/'.length)) }), { status: 200 }) : new Response(null, { status: 404 })
  }
  throw new Error('Operação externa inesperada no teste sintético.')
}
`)
    const output = execFileSync(process.execPath, ['--env-file-if-exists=.env.local', '--import', bootstrap, '.release/sync-brevo-registrations.js'], { env: { ...process.env, BREVO_API_KEY: 'synthetic-only-key', BREVO_CONTACT_SYNC_ENABLED: 'true', BREVO_CONTACT_REGISTRATION_ENABLED: 'true', LEAD_TOKEN_SECRET: secret, EMAIL_TRANSPORT_ENABLED: 'false' }, encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] })
    const result = JSON.parse(output.trim().split('\n').at(-1)!)
    assert.equal(result.enabled, true); assert.equal(result.synced, 1)
    assert.equal((await jobFor(packed.contact.id)).providerId, 18001)
  } finally { await rm(temporary, { recursive: true, force: true }) }
  checks.push('CLI empacotado executado com cadastro habilitado, HTTP integralmente interceptado e banco sintético: GET/POST/GET persistem ID observado sem rede externa.')

  await mkdir('artifacts/brevo-registrations', { recursive: true })
  await writeFile('artifacts/brevo-registrations/local-results.json', JSON.stringify({ date: '2026-10-22 America/Belem', environment: 'PostgreSQL loopback, relógio controlado e HTTP de contatos inteiramente sintético', checks, externalCalls: false, messagesSent: 0, limits: 'Cadastro de contatos sem listas/campanhas, preferências promocionais, webhook ou envio. Homologação da conta/automatismos externos pendente; identidade de contato não é editável por API.' }, null, 2))
  console.log(`Cadastros consentidos: ${checks.length} grupos aprovados; nenhuma chamada externa ou mensagem.`)
} finally { await seed.cleanup() }
process.exit(0)
