import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { seedRelationship } from '../fixtures/relationship'
import { requestMagnet, confirmMagnet, unsubscribe } from '../../src/modules/marketing/service'
import { processDelivery } from '../../src/modules/marketing/delivery'
import { sequenceDays, enrollmentKey } from '../../src/modules/marketing/sequence-copy'
import { CONSENT_VERSION } from '../../src/modules/marketing/validation'
import { preparePromotionBatches } from '../../src/modules/marketing/batches'
import { preparePromotions } from '../../src/modules/marketing/sequence'
import { PROVIDER_CHECK_TTL } from '../../src/modules/marketing/batch-check-copy'
import { prepareBrevoBatchList } from '../../src/modules/marketing/batch-lists'
import { createBrevoLists } from '../../src/integrations/brevo/lists'
import type { BrevoContacts } from '../../src/integrations/brevo/contacts'
import { createOpaqueToken, UNSUBSCRIBE_TTL } from '../../src/modules/marketing/tokens'
import { atomic } from '../../src/modules/marketing/transaction'
import { up, down } from '../../migrations/20261022_110941_brevo_batch_lists'

const seed = await seedRelationship(), { payload, magnet } = seed
const secret = randomBytes(32).toString('hex'), suffix = randomBytes(5).toString('hex'), start = Date.now(), due = start + 2 * 86_400_000, checks: string[] = []
const contacts = new Map<string, number>()
const directory: BrevoContacts = { inspect: async email => { if (!contacts.has(email)) contacts.set(email, contacts.size + 1); return { state: 'found', id: contacts.get(email)!, blocked: false } }, block: async () => { throw new Error('Não bloquear no fixture de listas.') } }
type Remote = { id: number; name: string; folderId: number; ids: number[]; unknown?: boolean }
const remote = new Map<number, Remote>(), creates = new Map<string, number>(), adds = new Map<string, number[]>(), modes = new Map<string, string>()
let entered: (() => void) | undefined, release: Promise<void> | undefined
function makeList(name: string, ids: number[] = []) { const item: Remote = { id: 1000 + remote.size, name, folderId: 10, ids }; remote.set(item.id, item); return item }
const lists = createBrevoLists('synthetic-only-key', 10, async (input, options) => {
  const url = new URL(String(input)); assert.equal(url.origin, 'https://api.brevo.com')
  if (url.pathname === '/v3/contacts/lists' && options?.method === 'POST') {
    const value = JSON.parse(String(options.body)); assert.deepEqual(value, { name: value.name, folderId: 10 })
    creates.set(value.name, (creates.get(value.name) ?? 0) + 1)
    if (modes.get(value.name) === 'reject') return new Response('{}', { status: 400 })
    if (modes.get(value.name) === 'missing-create') throw new Error('synthetic ambiguous creation')
    const item = makeList(value.name)
    if (modes.get(value.name) === 'lease') { entered?.(); await release }
    if (modes.get(value.name) === 'lost-create') throw new Error('synthetic lost creation acknowledgement')
    return new Response(JSON.stringify({ id: item.id }), { status: 201 })
  }
  if (url.pathname === '/v3/contacts/folders/10/lists') {
    const all = [...remote.values()], offset = Number(url.searchParams.get('offset'))
    return new Response(JSON.stringify({ count: all.length, lists: all.slice(offset, offset + 50).map(item => ({ id: item.id, name: item.name })) }), { status: 200 })
  }
  const match = /^\/v3\/contacts\/lists\/(\d+)(\/contacts(?:\/add)?)?$/.exec(url.pathname)
  if (!match) throw new Error('Operação externa não permitida.')
  const item = remote.get(Number(match[1])); if (!item) return new Response(null, { status: 404 })
  if (!match[2] && modes.get(item.name) === 'metadata-unavailable') return new Response(null, { status: 503 })
  if (!match[2]) return new Response(JSON.stringify({ id: item.id, name: item.name, folderId: item.folderId }), { status: 200 })
  if (match[2] === '/contacts/add') {
    const data = JSON.parse(String(options?.body)); assert.ok(data.ids.length <= 150)
    adds.set(item.name, [...(adds.get(item.name) ?? []), data.ids.length])
    if (modes.get(item.name) === 'withdraw') { entered?.(); await release }
    for (const id of modes.get(item.name) === 'partial' ? data.ids.slice(0, 1) : data.ids) if (!item.ids.includes(id)) item.ids.push(id)
    return new Response(JSON.stringify({ success: [], failure: [] }), { status: 201 })
  }
  const offset = Number(url.searchParams.get('offset'))
  return new Response(JSON.stringify({ count: item.ids.length, contacts: item.ids.slice(offset, offset + 50).map(id => ({ id, emailBlacklisted: false, ...(item.unknown ? {} : { listUnsubscribed: [] }), attributes: { DISCARDED: 'synthetic private data' } })) }), { status: 200 })
})
let revision = 1
const jobFor = async (batch: string) => (await payload.find({ collection: 'brevo-batch-lists', where: { batch: { equals: batch } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
const run = (id: string, now = due, more: { adoptListId?: number; retryRejected?: boolean } = {}) => prepareBrevoBatchList(payload, id, { lists, contacts: directory, secret, now, ...more })
try {
  await assert.rejects(atomic(payload, async req => { const id = await req.transactionID; assert.ok(id); const db = (payload.db as unknown as PostgresAdapter).sessions[id].db; await down({ db, payload, req }); await up({ db, payload, req }); throw new Error('synthetic list migration rollback') }), /synthetic list migration rollback/)
  const copy = Object.fromEntries(sequenceDays.map(day => [`day${day}`, { subject: `Assunto sintético ${day}`, text: `Conteúdo sintético ${day}.` }]))
  const sequence = await payload.create({ collection: 'email-sequences', ...seed.auth, data: { name: 'Listas sintéticas', key: 'server-overwrites-key', magnet: magnet.id, magnetVersion: magnet.version, revision, offer: seed.offers[0].id, active: true, ...copy } })
  async function group(name: string, count = 1, prepare = true) {
    revision++
    await payload.update({ collection: 'email-sequences', id: sequence.id, ...seed.auth, data: { revision, day2: { subject: `Revisão sintética ${revision}` } } })
    const people = []
    for (let index = 0; index < count; index++) {
      const email = `${name}-${index}-${suffix}@example.invalid`
      await requestMagnet(payload, { email, magnetId: magnet.id, marketingOptIn: true, consentVersion: CONSENT_VERSION }, secret, start)
      const person = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, depth: 0, overrideAccess: true })).docs[0]
      const delivery = (await payload.find({ collection: 'email-deliveries', where: { and: [{ contact: { equals: person.id } }, { kind: { equals: 'confirmation' } }] }, depth: 0, overrideAccess: true })).docs[0]
      let token = ''
      await processDelivery(payload, delivery.id, { secret, now: start, origin: 'http://127.0.0.1:3000', transport: async message => { token = /\/amostras\/confirmar\?t=([\w-]+)/.exec(message.text)?.[1] || ''; return { state: 'sent', messageId: 'synthetic-list-confirmation' } } })
      assert.ok(token); await confirmMagnet(payload, token, secret, start); people.push(person)
    }
    if (prepare) await preparePromotionBatches(payload, due)
    const stage = (await payload.find({ collection: 'promotion-deliveries', where: { and: [{ contact: { equals: people[0].id } }, { stage: { equals: '2' } }] }, depth: 0, overrideAccess: true })).docs[0]
    const batch = stage.batch ? typeof stage.batch === 'string' ? stage.batch : stage.batch.id : ''
    return { people, batch, name: `bibliotheon-${batch}` }
  }
  const first = await group('normal', 2)
  assert.equal((await prepareBrevoBatchList(payload, first.batch, { lists: null, secret })).state, 'disabled')
  assert.equal(await jobFor(first.batch), undefined)
  const concurrent = await Promise.all([run(first.batch), run(first.batch)])
  assert.equal(concurrent.filter(result => result.state === 'ready').length, 1)
  assert.equal(creates.get(first.name), 1)
  assert.deepEqual(adds.get(first.name), [2])
  const firstJob = await jobFor(first.batch)
  assert.equal(firstJob.state, 'ready'); assert.ok(firstJob.providerListId)
  assert.equal(JSON.stringify(firstJob).includes('@example.invalid'), false)
  assert.equal((await run(first.batch)).state, 'ready'); assert.deepEqual(adds.get(first.name), [2])
  checks.push('Migração up/down revertida; flag desligada não cria intenção. Concorrência cria uma lista e uma inclusão, persiste ID antes dos membros e reconcilia sem repetir; manifesto não contém endereço/token.')

  const lost = await group('lost-create'); modes.set(lost.name, 'lost-create')
  assert.equal((await run(lost.batch)).state, 'uncertain')
  assert.equal((await run(lost.batch)).state, 'held')
  assert.equal((await run(lost.batch, due + 900_000)).state, 'ready')
  assert.equal(creates.get(lost.name), 1)
  const missing = await group('missing-create'); modes.set(missing.name, 'missing-create')
  assert.equal((await run(missing.batch)).state, 'uncertain')
  assert.equal((await run(missing.batch, due + 900_000)).state, 'uncertain')
  assert.equal(creates.get(missing.name), 1)
  const wrong = makeList('foreign-list')
  assert.equal((await run(missing.batch, due + 900_000, { adoptListId: wrong.id })).state, 'failed')
  assert.equal(wrong.ids.length, 0)
  const reviewed = makeList(missing.name)
  assert.equal((await run(missing.batch, due + 900_000, { adoptListId: reviewed.id })).state, 'ready')
  checks.push('Timeout de criação reconcilia nome exclusivo sem outro POST; ausência não autoriza recriar. Reconciliação explícita por ID confere nome/pasta e não altera lista estrangeira.')

  const partial = await group('partial', 2); modes.set(partial.name, 'partial')
  assert.equal((await run(partial.batch)).state, 'uncertain')
  assert.equal((await jobFor(partial.batch)).errorCode, 'membership_uncertain')
  assert.equal((await run(partial.batch, due + 900_000)).state, 'uncertain')
  assert.deepEqual(adds.get(partial.name), [2])
  const item = remote.get((await jobFor(partial.batch)).providerListId!)!
  for (const person of partial.people) if (!item.ids.includes(contacts.get(person.email)!)) item.ids.push(contacts.get(person.email)!) // reviewed account repair, no automatic re-add
  assert.equal((await run(partial.batch, due + 1_800_000)).state, 'ready')
  assert.deepEqual(adds.get(partial.name), [2])
  const extra = 999_999; item.ids.push(extra)
  assert.equal((await run(partial.batch, due + 1_800_000)).state, 'failed')
  assert.ok(item.ids.includes(extra))
  checks.push('201 parcial não prova composição: inclusões já tentadas não são repetidas. Reparação observada permite concluir; destinatário extra bloqueia sem remoção arbitrária.')

  const flags = await group('flags')
  const flagsList = makeList(flags.name); flagsList.unknown = true
  assert.equal((await run(flags.batch, due, { adoptListId: flagsList.id })).state, 'uncertain')
  assert.equal((await jobFor(flags.batch)).errorCode, 'membership_unverified')
  flagsList.unknown = false
  assert.equal((await run(flags.batch, due + 900_000)).state, 'ready')
  const rejected = await group('rejected'); modes.set(rejected.name, 'reject')
  assert.equal((await run(rejected.batch)).state, 'failed')
  modes.delete(rejected.name)
  assert.equal((await run(rejected.batch, due + 900_000)).state, 'failed')
  assert.equal((await jobFor(rejected.batch)).errorCode, 'creation_rejected')
  assert.equal((await run(rejected.batch, due, { retryRejected: true })).state, 'ready')
  assert.equal(creates.get(rejected.name), 2)
  checks.push('Preferências de lista ausentes não são presumidas livres; criação explicitamente recusada admite retry privado após correção, preservando intenção.')

  const race = await group('withdraw'); modes.set(race.name, 'withdraw')
  let signal!: () => void, finish!: () => void
  const started = new Promise<void>(resolve => { signal = resolve }); release = new Promise<void>(resolve => { finish = resolve }); entered = signal
  const flight = run(race.batch)
  await started
  try {
    const token = createOpaqueToken()
    await payload.create({ collection: 'preference-tokens', data: { contact: race.people[0].id, tokenHash: token.hash, expiresAt: new Date(due + UNSUBSCRIBE_TTL).toISOString() }, overrideAccess: true })
    await unsubscribe(payload, token.token, due)
  } finally { finish() }
  assert.equal((await flight).state, 'canceled')
  assert.equal((await jobFor(race.batch)).state, 'canceled')
  checks.push('Descadastro em inclusão externa vence a conferência final; lote/lista ficam cancelados com ID e intenção preservados, sem quota ou envio.')

  const lease = await group('lease'); modes.set(lease.name, 'lease')
  let leaseSignal!: () => void, leaseFinish!: () => void
  const leaseStarted = new Promise<void>(resolve => { leaseSignal = resolve }); release = new Promise<void>(resolve => { leaseFinish = resolve }); entered = leaseSignal
  const old = run(lease.batch); await leaseStarted
  try { assert.equal((await run(lease.batch, due + 30 * 60_000)).state, 'ready') }
  finally { leaseFinish() }
  assert.equal((await old).state, 'held'); assert.equal(creates.get(lease.name), 1)
  assert.equal((await jobFor(lease.batch)).state, 'ready')
  checks.push('Lease expirado recupera ID pelo nome, compõe e confirma; resposta antiga não sobrescreve tentativa mais recente nem repete criação.')

  const metadata = await group('metadata-unavailable'); modes.set(metadata.name, 'metadata-unavailable')
  assert.equal((await run(metadata.batch)).state, 'uncertain')
  assert.ok((await jobFor(metadata.batch)).providerListId, 'ID conhecido deve sobreviver à falha posterior do GET de metadados.')
  modes.delete(metadata.name)
  assert.equal((await run(metadata.batch, due + 900_000)).state, 'ready')
  assert.equal(creates.get(metadata.name), 1)
  const creating = await group('withdraw-creating'); modes.set(creating.name, 'lease')
  let createSignal!: () => void, createFinish!: () => void
  const createStarted = new Promise<void>(resolve => { createSignal = resolve }); release = new Promise<void>(resolve => { createFinish = resolve }); entered = createSignal
  const creatingFlight = run(creating.batch); await createStarted
  try {
    const token = createOpaqueToken()
    await payload.create({ collection: 'preference-tokens', data: { contact: creating.people[0].id, tokenHash: token.hash, expiresAt: new Date(due + UNSUBSCRIBE_TTL).toISOString() }, overrideAccess: true })
    await unsubscribe(payload, token.token, due)
  } finally { createFinish() }
  await creatingFlight
  const canceledCreation = await jobFor(creating.batch)
  assert.equal(canceledCreation.state, 'canceled'); assert.ok(canceledCreation.providerListId)
  assert.equal(adds.get(creating.name), undefined)
  checks.push('ID retornado é persistido imediatamente, inclusive após falha de metadados ou descadastro em criação; nenhuma composição é autorizada por essa retenção.')

  const slow = await group('slow-membership')
  let slowClock = due
  const slowLists = { ...lists, members: async (id: number) => { const result = await lists.members(id); if (result.state === 'members' && result.contacts.length) slowClock += PROVIDER_CHECK_TTL + 1; return result } }
  assert.equal((await prepareBrevoBatchList(payload, slow.batch, { lists: slowLists, contacts: directory, secret, clock: () => slowClock })).state, 'uncertain')
  assert.equal((await jobFor(slow.batch)).verification, null)
  checks.push('Composição expirada não ganha validade nova só por outro preflight de contatos; relógio da conferência de membros também é verificado antes de ready.')

  const big = await group('large', 1, false)
  await preparePromotions(payload, due)
  const original = (await payload.find({ collection: 'sequence-enrollments', where: { contact: { equals: big.people[0].id } }, depth: 0, overrideAccess: true })).docs[0]
  const rows = Array.from({ length: 199 }, (_, index) => { const contact = randomUUID(); return { contact, request: randomUUID(), enrollment: randomUUID(), email: `bulk-${suffix}-${index}@example.invalid`, key: enrollmentKey(contact, magnet.id, magnet.version) } })
  await atomic(payload, async req => {
    const tx = await req.transactionID; assert.ok(tx); const db = (payload.db as unknown as PostgresAdapter).sessions[tx].db
    const data = JSON.stringify(rows)
    await db.execute(sql`INSERT INTO contacts(id,email,confirmed_at,delivery_state) SELECT (x->>'contact')::uuid,x->>'email',${new Date(start).toISOString()}::timestamptz,'ok' FROM jsonb_array_elements(${data}::jsonb) x`)
    await db.execute(sql`INSERT INTO subscriptions(contact_id,theme_id,key,state,consent_version,subscribed_at) SELECT (x->>'contact')::uuid,${seed.theme.id},x->>'key','subscribed',${CONSENT_VERSION},${new Date(start).toISOString()}::timestamptz FROM jsonb_array_elements(${data}::jsonb) x`)
    await db.execute(sql`INSERT INTO magnet_requests(id,contact_id,magnet_id,theme_id,magnet_version,marketing_opt_in,consent_version,expires_at,confirmed_at) SELECT (x->>'request')::uuid,(x->>'contact')::uuid,${magnet.id},${seed.theme.id},${magnet.version},true,${CONSENT_VERSION},${new Date(start + 86_400_000).toISOString()}::timestamptz,${new Date(start).toISOString()}::timestamptz FROM jsonb_array_elements(${data}::jsonb) x`)
    await db.execute(sql`INSERT INTO sequence_enrollments(id,key,contact_id,request_id,magnet_id,theme_id,sequence_id,magnet_version,confirmed_at,state,snapshot) SELECT (x->>'enrollment')::uuid,x->>'key',(x->>'contact')::uuid,(x->>'request')::uuid,${magnet.id},${seed.theme.id},${sequence.id},${magnet.version},${original.confirmedAt}::timestamptz,'active',${JSON.stringify(original.snapshot)}::jsonb FROM jsonb_array_elements(${data}::jsonb) x`)
    await db.execute(sql`INSERT INTO promotion_deliveries(key,enrollment_id,contact_id,stage,due_at,next_check_at,state) SELECT (x->>'key')||':2',(x->>'enrollment')::uuid,(x->>'contact')::uuid,'2',${new Date(due).toISOString()}::timestamptz,${new Date(due).toISOString()}::timestamptz,'ready' FROM jsonb_array_elements(${data}::jsonb) x`)
  })
  await preparePromotionBatches(payload, due)
  const bigStage = (await payload.find({ collection: 'promotion-deliveries', where: { and: [{ contact: { equals: big.people[0].id } }, { stage: { equals: '2' } }] }, depth: 0, overrideAccess: true })).docs[0]
  const bigBatch = typeof bigStage.batch === 'string' ? bigStage.batch : bigStage.batch!.id
  assert.equal((await payload.findByID({ collection: 'email-campaign-batches', id: bigBatch, depth: 0, overrideAccess: true })).recipientCount, 200)
  assert.equal((await run(bigBatch)).state, 'ready')
  assert.deepEqual(adds.get(`bibliotheon-${bigBatch}`), [150, 50])
  checks.push('Dataset de 200 destinatários sintéticos no PostgreSQL: conjunto completo validado com paginação e duas inclusões de 150/50, sem quota promocional.')

  const packed = await group('packed-cli'), temporary = await mkdtemp(path.join(os.tmpdir(), 'bibliotheon-lists-cli-'))
  try {
    const bootstrap = path.join(temporary, 'http.mjs')
    await writeFile(bootstrap, `import assert from 'node:assert/strict'
let list, ids = []
Date.now = () => Number(process.env.SYNTHETIC_NOW)
globalThis.fetch = async (input, options) => {
 const u = new URL(String(input)); assert.equal(u.origin, 'https://api.brevo.com')
 if (u.pathname === '/v3/contacts/lists' && options?.method === 'POST') { const body=JSON.parse(options.body); list={id:321,name:body.name,folderId:10}; return new Response(JSON.stringify({id:321}),{status:201}) }
 if (u.pathname === '/v3/contacts/folders/10/lists') return new Response(JSON.stringify({count:list?1:0,lists:list?[list]:[]}),{status:200})
 if (u.pathname === '/v3/contacts/lists/321') return new Response(JSON.stringify(list),{status:200})
 if (u.pathname === '/v3/contacts/lists/321/contacts/add') { ids=JSON.parse(options.body).ids; return new Response('{}',{status:201}) }
 if (u.pathname === '/v3/contacts/lists/321/contacts') return new Response(JSON.stringify({count:ids.length,contacts:ids.map(id=>({id,emailBlacklisted:false,listUnsubscribed:[]}))}),{status:200})
 if (u.pathname.startsWith('/v3/contacts/') && options?.method === 'GET') return new Response(JSON.stringify({id:19001,emailBlacklisted:false,email:decodeURIComponent(u.pathname.slice('/v3/contacts/'.length))}),{status:200})
 throw new Error('Operação externa inesperada.')
}
`)
    const output = execFileSync(process.execPath, ['--env-file-if-exists=.env.local', '--import', bootstrap, '.release/prepare-brevo-list.js', packed.batch], { env: { ...process.env, SYNTHETIC_NOW: String(due), BREVO_LIST_SYNC_ENABLED: 'true', BREVO_LIST_FOLDER_ID: '10', BREVO_CONTACT_SYNC_ENABLED: 'true', BREVO_API_KEY: 'synthetic-only-key', LEAD_TOKEN_SECRET: secret, EMAIL_TRANSPORT_ENABLED: 'false' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 })
    assert.equal(JSON.parse(output.trim().split('\n').at(-1)!).state, 'ready')
    assert.equal((await jobFor(packed.batch)).providerListId, 321)
  } finally { await rm(temporary, { recursive: true, force: true }) }
  await assert.rejects(payload.find({ collection: 'brevo-batch-lists', user: null, overrideAccess: false }))
  await assert.rejects(payload.update({ collection: 'brevo-batch-lists', id: firstJob.id, ...seed.auth, data: { state: 'ready' } }))
  await assert.rejects(atomic(payload, async req => { const tx = await req.transactionID; assert.ok(tx); await down({ db: (payload.db as unknown as PostgresAdapter).sessions[tx].db, payload, req }) }), /Downgrade recusado/)
  assert.equal((await payload.find({ collection: 'mail-quota', where: { day: { equals: new Date(due).toISOString().slice(0, 10) } }, overrideAccess: true })).totalDocs, 0)
  checks.push('CLI empacotado habilitado com HTTP totalmente interceptado persiste lista conferida; coleção privada e guard de downgrade preservam intenção/IDs; nenhum envio ou quota promocional.')
  await mkdir('artifacts/brevo-lists', { recursive: true })
  await writeFile('artifacts/brevo-lists/local-results.json', JSON.stringify({ date: '2026-10-22 America/Belem', environment: 'PostgreSQL loopback, fixtures de 200 destinatários e HTTP inteiramente sintético; CLI empacotado interceptado', checks, externalCalls: false, messagesSent: 0, limits: 'Lista preparada não é campanha/aceitação/entrega. Conta/pasta/automações e campos opcionais do provedor precisam de homologação; sem remoção automática de listas ou resolução arbitrária de destinatários extras.' }, null, 2))
  console.log(`Listas de lotes: ${checks.length} grupos aprovados; nenhum envio ou chamada externa.`)
} finally { await seed.cleanup() }
process.exit(0)
