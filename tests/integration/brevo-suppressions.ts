import assert from 'node:assert/strict'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { atomic } from '../../src/modules/marketing/transaction'
import { up, down } from '../../migrations/20261022_053258_brevo_suppressions'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { seedRelationship } from '../fixtures/relationship'
import { applySuppression } from '../../src/modules/marketing/suppression'
import { unsubscribe } from '../../src/modules/marketing/service'
import { createOpaqueToken, UNSUBSCRIBE_TTL } from '../../src/modules/marketing/tokens'
import { processBrevoSuppression, syncBrevoSuppressions, retryFailedBrevoSuppressions } from '../../src/modules/marketing/brevo-suppression'
import { createBrevoContacts, type BrevoContacts } from '../../src/integrations/brevo/contacts'
import { suppressionFingerprint } from '../../src/modules/marketing/suppression-tombstone'

const seed = await seedRelationship(), { payload } = seed
const secret = randomBytes(32).toString('hex'), suffix = randomBytes(6).toString('hex'), now = Date.now(), checks: string[] = []
const jobFor = async (contact: string) => (await payload.find({ collection: 'brevo-suppressions', where: { contact: { equals: contact } }, depth: 0, overrideAccess: true })).docs[0]
async function suppress(name: string) {
  const email = `${name}-${suffix}@example.invalid`
  await applySuppression(payload, { email, reason: 'unsubscribed', source: 'manual', reference: `${name}-${suffix}` }, secret, now)
  const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, depth: 0, overrideAccess: true })).docs[0]
  const tombstone = (await payload.find({ collection: 'marketing-suppression-tombstones', where: { fingerprint: { equals: suppressionFingerprint(email, secret) } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  assert.ok(tombstone)
  const expires = new Date(now); expires.setUTCFullYear(expires.getUTCFullYear() + 1)
  assert.equal(tombstone.expiresAt, expires.toISOString())
  assert.equal(JSON.stringify(tombstone).includes(email), false)
  return { contact, job: await jobFor(contact.id) }
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
const blockedClient: BrevoContacts = { inspect: async () => ({ state: 'found', id: 1, blocked: true }), block: async () => ({ state: 'blocked' }) }
try {
  await assert.rejects(atomic(payload, async req => {
    const transaction = await req.transactionID
    assert.ok(transaction)
    const db = (payload.db as unknown as PostgresAdapter).sessions[transaction].db
    await down({ db, payload, req })
    await db.execute(sql`INSERT INTO contacts (email, global_suppressed_at, delivery_state) VALUES
      (${`legacy-suppressed-${suffix}@example.invalid`}, now(), 'ok'),
      (${`legacy-bounced-${suffix}@example.invalid`}, NULL, 'bounced'),
      (${`legacy-active-${suffix}@example.invalid`}, NULL, 'ok')`)
    await up({ db, payload, req })
    const backfill = await db.execute(sql`SELECT count(*)::int AS total FROM brevo_suppressions WHERE state='pending' AND revision=1 AND attempts=0`)
    assert.equal(Number(backfill.rows[0]?.total), 2)
    throw new Error('synthetic migration check rollback')
  }), /synthetic migration check rollback/)
  assert.equal((await payload.count({ collection: 'contacts', overrideAccess: true })).totalDocs, 0)
  assert.equal((await payload.count({ collection: 'brevo-suppressions', overrideAccess: true })).totalDocs, 0)
  checks.push('Up/down e backfill exercitados dentro de transação revertida: bloqueios anteriores entram na fila e contato ativo permanece fora; schema/dados originais preservados.')
  const basic = await suppress('basic')
  assert.equal(basic.job.state, 'pending')
  assert.equal(JSON.stringify(basic.job).includes(basic.contact.email), false)
  checks.push('Supressão persiste somente fingerprint HMAC e expiração de 12 meses sem FK nem email.')
  assert.deepEqual(await syncBrevoSuppressions(payload, { client: null, now }), { enabled: false, examined: 0, synced: 0, pending: 0, failed: 0 })
  assert.equal((await jobFor(basic.contact.id)).attempts, 0)
  await applySuppression(payload, { email: basic.contact.email, reason: 'unsubscribed', source: 'manual', reference: `basic-${suffix}` }, secret, now)
  assert.equal((await jobFor(basic.contact.id)).revision, 1)
  let remoteBlocked = false, writes = 0, requests = 0
  const client = createBrevoContacts('synthetic-only', async (_url, options) => {
    requests++
    if (options?.method === 'PUT') { assert.deepEqual(JSON.parse(String(options.body)), { emailBlacklisted: true }); writes++; remoteBlocked = true; return new Response(null, { status: 204 }) }
    return new Response(JSON.stringify({ id: 42, email: basic.contact.email, emailBlacklisted: remoteBlocked, statistics: { secret: 'discarded' } }), { status: 200 })
  })
  const outcomes = await Promise.all([processBrevoSuppression(payload, basic.job.id, { client, now }), processBrevoSuppression(payload, basic.job.id, { client, now })])
  assert.equal(outcomes.filter(result => result.state === 'synced').length, 1)
  assert.equal(writes, 1); assert.equal(requests, 3)
  assert.equal((await jobFor(basic.contact.id)).outcome, 'blocked')
  checks.push('Supressão local grava outbox mesmo offline; replay não duplica/reinicia; claim concorrente faz um PUT e confere o bloqueio, sem guardar endereço ou corpo na fila.')

  const contact = await payload.create({ collection: 'contacts', data: { email: `rollback-${suffix}@example.invalid`, confirmedAt: new Date(now).toISOString(), deliveryState: 'ok' }, overrideAccess: true })
  const subscription = await payload.create({ collection: 'subscriptions', data: { contact: contact.id, theme: seed.theme.id, key: `${contact.id}:${seed.theme.id}`, state: 'subscribed' }, overrideAccess: true })
  const token = createOpaqueToken()
  await payload.create({ collection: 'preference-tokens', data: { contact: contact.id, tokenHash: token.hash, expiresAt: new Date(now + UNSUBSCRIBE_TTL).toISOString() }, overrideAccess: true })
  const hooks = payload.collections['brevo-suppressions'].config.hooks, previous = hooks.afterChange
  hooks.afterChange = [...previous, async () => { throw new Error('synthetic suppression rollback') }]
  try { await assert.rejects(unsubscribe(payload, token.token, now, secret), /synthetic suppression rollback/) }
  finally { hooks.afterChange = previous }
  assert.equal((await payload.findByID({ collection: 'contacts', id: contact.id, depth: 0, overrideAccess: true })).globalSuppressedAt, null)
  assert.equal((await payload.findByID({ collection: 'subscriptions', id: subscription.id, depth: 0, overrideAccess: true })).state, 'subscribed')
  assert.equal(await jobFor(contact.id), undefined)
  assert.equal((await payload.count({ collection: 'marketing-suppression-tombstones', where: { fingerprint: { equals: suppressionFingerprint(contact.email, secret) } }, overrideAccess: true })).totalDocs, 0)
  await unsubscribe(payload, token.token, now, secret)
  assert.equal((await jobFor(contact.id)).state, 'pending')
  assert.equal((await payload.count({ collection: 'marketing-suppression-tombstones', where: { fingerprint: { equals: suppressionFingerprint(contact.email, secret) } }, overrideAccess: true })).totalDocs, 1)
  await processBrevoSuppression(payload, (await jobFor(contact.id)).id, { client: blockedClient, now })
  checks.push('Falha ao persistir outbox reverte tombstone, cancelamento e assinatura; descadastro confirmado grava tombstone/outbox na mesma transação e preserva confirmação/amostra independentes.')

  const lost = await suppress('lost-response')
  let blocked = false, put = 0, get = 0
  const timeout = createBrevoContacts('synthetic-only', async (_url, options) => {
    if (options?.method === 'PUT') { put++; blocked = true; throw new Error('synthetic timeout after provider applied block') }
    get++; return new Response(JSON.stringify({ id: 43, email: lost.contact.email, emailBlacklisted: blocked }), { status: 200 })
  })
  assert.equal((await processBrevoSuppression(payload, lost.job.id, { client: timeout, now })).state, 'pending')
  const pending = await jobFor(lost.contact.id)
  assert.equal(pending.errorCode, 'provider_unavailable'); assert.equal(pending.nextAttemptAt, new Date(now + 60_000).toISOString())
  assert.equal((await processBrevoSuppression(payload, lost.job.id, { client: timeout, now: now + 59_999 })).state, 'held')
  assert.equal((await processBrevoSuppression(payload, lost.job.id, { client: timeout, now: now + 60_000 })).state, 'synced')
  assert.equal(put, 1); assert.equal(get, 2)
  checks.push('Timeout após bloqueio mantém pendência com backoff; tentativa seguinte reconcilia por GET, sem repetir a escrita já aplicada.')

  const race = await suppress('new-intent'), entered = deferred<void>(), release = deferred<void>()
  const flight = processBrevoSuppression(payload, race.job.id, { now, client: { ...blockedClient, block: async () => { entered.resolve(); await release.promise; return { state: 'blocked' } } } })
  await entered.promise
  try {
    await applySuppression(payload, { email: race.contact.email, reason: 'complaint', source: 'manual', reference: `new-revision-${suffix}` }, secret, now + 1)
    const current = await jobFor(race.contact.id)
    assert.equal(current.state, 'processing'); assert.equal(current.revision, 2)
  } finally { release.resolve() }
  assert.equal((await flight).state, 'pending')
  assert.equal((await jobFor(race.contact.id)).revision, 2)
  assert.equal((await processBrevoSuppression(payload, race.job.id, { client: blockedClient, now: now + 1 })).state, 'synced')
  checks.push('Nova supressão durante chamada externa aumenta revisão; conclusão antiga não apaga intenção nova e a última revisão é retomada.')

  const stale = await suppress('stale'), claimed = deferred<void>(), finish = deferred<void>()
  const older = processBrevoSuppression(payload, stale.job.id, { now, client: { ...blockedClient, block: async () => { claimed.resolve(); await finish.promise; return { state: 'retry' } } } })
  await claimed.promise
  try {
    assert.equal((await processBrevoSuppression(payload, stale.job.id, { client: blockedClient, now: now + 30 * 60_000 - 1 })).state, 'held')
    assert.equal((await processBrevoSuppression(payload, stale.job.id, { client: blockedClient, now: now + 30 * 60_000 })).state, 'synced')
  } finally { finish.resolve() }
  assert.equal((await older).state, 'held')
  assert.equal((await jobFor(stale.contact.id)).state, 'synced')
  assert.equal((await jobFor(stale.contact.id)).attempts, 2)
  checks.push('Processo perdido é retomado após lease de 30 minutos; resposta antiga não sobrescreve tentativa mais recente já confirmada.')

  const rejected = await suppress('rejected')
  assert.equal((await processBrevoSuppression(payload, rejected.job.id, { now, client: { ...blockedClient, block: async () => ({ state: 'rejected' }) } })).state, 'failed')
  assert.equal((await processBrevoSuppression(payload, rejected.job.id, { now, client: blockedClient })).state, 'held')
  assert.equal((await retryFailedBrevoSuppressions(payload, now)).queued, 1)
  assert.equal((await syncBrevoSuppressions(payload, { client: blockedClient, now })).synced, 1)
  assert.ok((await payload.findByID({ collection: 'contacts', id: rejected.contact.id, depth: 0, overrideAccess: true })).globalSuppressedAt)
  const absent = await suppress('absent'), calls: string[] = []
  const notFound = createBrevoContacts('synthetic-only', async (_url, options) => { calls.push(String(options?.method)); return new Response(null, { status: 404 }) })
  assert.equal((await processBrevoSuppression(payload, absent.job.id, { client: notFound, now })).state, 'synced')
  assert.equal((await jobFor(absent.contact.id)).outcome, 'absent'); assert.deepEqual(calls, ['GET'])
  checks.push('Recusa definitiva exige retry explícito após correção; ausência no provedor não cria contato; sincronização nunca reativa consentimento nem desbloqueia.')

  await assert.rejects(payload.find({ collection: 'brevo-suppressions', user: null, overrideAccess: false }))
  await assert.rejects(payload.update({ collection: 'brevo-suppressions', id: basic.job.id, ...seed.auth, data: { state: 'synced' } }))
  assert.ok((await payload.find({ collection: 'brevo-suppressions', ...seed.auth })).totalDocs > 0)
  assert.equal((await payload.count({ collection: 'mail-quota', overrideAccess: true })).totalDocs, 0)
  assert.equal((await payload.count({ collection: 'email-deliveries', overrideAccess: true })).totalDocs, 0)
  checks.push('Coleção privada: anônimo não lê e owner não altera estados; nenhum e-mail criado ou quota de mensagem consumida.')
  await mkdir('artifacts/brevo-suppressions', { recursive: true })
  await writeFile('artifacts/brevo-suppressions/local-results.json', JSON.stringify({ date: '2026-10-25 America/Belem', environment: 'PostgreSQL loopback, relógio controlado, transporte de contatos/HTTP inteiramente sintético', checks, externalCalls: false, messagesSent: 0, limits: 'Fluxo local de bloqueio outbound; conta Brevo, webhooks inbound, listas/campanhas, preferências promocionais e envio ainda não homologados.' }, null, 2))
  console.log(`Sincronização de bloqueios: ${checks.length} grupos aprovados; nenhuma chamada externa ou mensagem.`)
} finally { await seed.cleanup() }
process.exit(0)
