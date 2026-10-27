import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { seedRelationship } from '../fixtures/relationship'
import { atomic, serial } from '../../src/modules/marketing/transaction'
import { contactFingerprint } from '../../src/modules/marketing/contact'
import { unsubscribeTheme } from '../../src/modules/marketing/preferences'
import { createOpaqueToken } from '../../src/modules/marketing/tokens'
import { confirmMagnet, requestMagnet } from '../../src/modules/marketing/service'
import { processDelivery } from '../../src/modules/marketing/delivery'
import { CONSENT_VERSION } from '../../src/modules/marketing/validation'
import { storeThemeWithdrawal } from '../../src/modules/marketing/theme-withdrawal'
import { exportPrivacyRecoveryManifest, replayPrivacyRecoveryManifest } from '../../src/modules/marketing/privacy-recovery'
import { expireWithdrawnThemes } from '../../src/modules/marketing/privacy-theme-retention'
import { calendarMonths, signPrivacyRecoveryManifest, type PrivacyRecoveryEntry } from '../../src/modules/marketing/privacy-recovery-manifest'
import { exportContactData } from '../../src/modules/marketing/privacy-export'
import { down, up } from '../../migrations/20261027_001515_theme_withdrawals'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true', 'Somente banco sintético exclusivo.')
const seed = await seedRelationship(), { payload } = seed
const env = { ...process.env }, network = globalThis.fetch, checks: string[] = []
const now = Date.now(), old = new Date(now - 40 * 86400000).toISOString(), secret = 'synthetic-theme-withdrawal-'.padEnd(48, 'x')
let externalCalls = 0
for (const key of Object.keys(process.env).filter(key => key.endsWith('_ENABLED'))) process.env[key] = 'false'
globalThis.fetch = (async () => { externalCalls++; throw new Error('Rede externa proibida.') }) as typeof fetch
const auth = { user: { ...seed.owner, collection: 'admin-users' as const }, overrideAccess: false }
const copy = Object.fromEntries([2,4,7,10].map(day => [`day${day}`, { subject: 'Assunto sintético', text: 'Texto sintético sem envio.' }]))
const sequence = await payload.create({ collection: 'email-sequences', ...seed.auth, data: { name: 'Calendário temático', key: randomUUID(), magnet: seed.magnet.id, magnetVersion: seed.magnet.version, revision: 1, offer: seed.offers[0].id, ...copy } })
const otherTheme = await payload.create({ collection: 'themes', ...seed.auth, data: { name: 'Outro assunto sintético', slug: `tema-${randomUUID()}`, introduction: 'Somente testes.', _status: 'published' } })
seed.extraThemes.push(otherTheme.id)
async function agedSubscription(id: string, enrollment?: string, promotion?: string) {
  await atomic(payload, async req => {
    const db = (payload.db as unknown as PostgresAdapter).sessions[(await req.transactionID)!].db
    await db.execute(sql`UPDATE subscriptions SET updated_at=${old}::timestamptz WHERE id=${id}::uuid`)
    if (enrollment) await db.execute(sql`UPDATE sequence_enrollments SET updated_at=${old}::timestamptz WHERE id=${enrollment}::uuid`)
    if (promotion) await db.execute(sql`UPDATE promotion_deliveries SET updated_at=${old}::timestamptz WHERE id=${promotion}::uuid`)
  })
}
async function fixture(label: string, marker = true, subId?: string) {
  const contact = await payload.create({ collection: 'contacts', overrideAccess: true, data: { email: `theme-${label}-${randomUUID()}@example.invalid`, deliveryState: 'ok', confirmedAt: old } })
  const sub = await payload.create({ collection: 'subscriptions', overrideAccess: true, data: { ...(subId ? {id:subId} : {}), contact: contact.id, theme: seed.theme.id, key: `${contact.id}:${seed.theme.id}`, state: 'unsubscribed', unsubscribedAt: old } })
  if (marker) await atomic(payload, req => storeThemeWithdrawal(req, contactFingerprint(contact.email, secret), seed.theme.id, old))
  await agedSubscription(sub.id)
  return { contact, sub }
}
try {
  const local = await fixture('local')
  const other = await payload.create({ collection: 'subscriptions', overrideAccess: true, data: { contact: local.contact.id, theme: otherTheme.id, key: `${local.contact.id}:${otherTheme.id}`, state: 'subscribed', subscribedAt: old } })
  const sample = await payload.create({ collection: 'magnet-requests', overrideAccess: true, data: { contact: local.contact.id, theme: seed.theme.id, magnet: seed.magnet.id, magnetVersion: seed.magnet.version, confirmedAt: old, expiresAt: old, marketingOptIn: false } })
  const consent = await payload.create({ collection: 'consent-events', overrideAccess: true, data: { contact: local.contact.id, theme: seed.theme.id, purpose: 'marketing', action: 'unsubscribed', occurredAt: old, key: randomUUID() } })
  const enrollment = await payload.create({ collection: 'sequence-enrollments', overrideAccess: true, data: { key: randomUUID(), contact: local.contact.id, theme: seed.theme.id, request: sample.id, magnet: seed.magnet.id, sequence: sequence.id, magnetVersion: seed.magnet.version, confirmedAt: old, state: 'canceled', canceledAt: old, snapshot: { synthetic: true } } })
  const promotion = await payload.create({ collection: 'promotion-deliveries', overrideAccess: true, data: { key: randomUUID(), contact: local.contact.id, enrollment: enrollment.id, stage: '2', dueAt: old, nextCheckAt: old, state: 'canceled' } })
  await agedSubscription(local.sub.id, enrollment.id, promotion.id)
  const before = await expireWithdrawnThemes(payload, now, false, secret)
  assert.equal(before.eligible, 1); assert.equal(before.processed, 0)
  const applied = await expireWithdrawnThemes(payload, now, true, secret)
  assert.equal(applied.removedSubscriptions, 1); assert.equal(applied.removedEnrollments, 1); assert.equal(applied.removedPromotions, 1)
  for (const [collection, id] of [['contacts', local.contact.id], ['subscriptions', other.id], ['magnet-requests', sample.id], ['consent-events', consent.id]] as const) assert.ok(await payload.findByID({ collection, id, overrideAccess: true }))
  checks.push('preview sem escrita e expurgo de um assunto preservam identidade, outro assunto ativo, amostra e prova')

  const manifest = await exportPrivacyRecoveryManifest(payload, secret, now)
  assert.equal(manifest.version, 4)
  assert.ok(manifest.entries.some(entry => entry.kind === 'theme-unsubscribe'))
  const recovery = { secret, snapshotAt: new Date(now - 86400000).toISOString(), ownerId: seed.owner.id, isolated: true, now }
  const restored = await payload.create({ collection: 'subscriptions', overrideAccess: true, data: { contact: local.contact.id, theme: seed.theme.id, key: `${local.contact.id}:${seed.theme.id}`, state: 'subscribed', subscribedAt: old } })
  const preview = await replayPrivacyRecoveryManifest(payload, JSON.stringify(manifest), recovery)
  assert.equal(preview.withdrawnThemes, 0)
  assert.equal((await payload.findByID({ collection: 'subscriptions', id: restored.id, overrideAccess: true })).state, 'subscribed')
  const replay = await replayPrivacyRecoveryManifest(payload, JSON.stringify(manifest), { ...recovery, apply: true })
  assert.equal(replay.withdrawnThemes, 1)
  assert.equal((await payload.findByID({ collection: 'subscriptions', id: restored.id, overrideAccess: true })).unsubscribedAt, old)
  assert.equal((await payload.findByID({ collection: 'subscriptions', id: other.id, overrideAccess: true })).state, 'subscribed')
  assert.equal((await payload.findByID({ collection: 'contacts', id: local.contact.id, overrideAccess: true })).globalSuppressedAt ?? null, null)
  const marker = (await payload.find({ collection: 'theme-withdrawals', overrideAccess: true })).docs[0]
  const subscriptionBeforeRepeat = await payload.findByID({ collection:'subscriptions',id:restored.id,overrideAccess:true })
  await replayPrivacyRecoveryManifest(payload, JSON.stringify(manifest), { ...recovery, apply: true })
  assert.equal((await payload.findByID({ collection:'subscriptions',id:restored.id,overrideAccess:true })).updatedAt,subscriptionBeforeRepeat.updatedAt)
  assert.equal((await payload.findByID({ collection: 'theme-withdrawals', id: marker.id, overrideAccess: true })).expiresAt, marker.expiresAt)
  assert.equal((await payload.count({ collection: 'privacy-request-audit', overrideAccess: true })).totalDocs, 0)
  checks.push('manifesto v4 reaplica só o assunto, preview não escreve e repetição não renova prazo nem fabrica pedido owner')

  await payload.create({ collection: 'consent-events', overrideAccess: true, data: { contact: local.contact.id, theme: seed.theme.id, purpose: 'marketing', action: 'subscribed', occurredAt: new Date(now - 1000).toISOString(), key: randomUUID() } })
  await payload.update({ collection: 'subscriptions', id: restored.id, overrideAccess: true, data: { state: 'subscribed', subscribedAt: new Date(now - 1000).toISOString(), unsubscribedAt: null } })
  assert.equal((await replayPrivacyRecoveryManifest(payload, JSON.stringify(manifest), { ...recovery, apply: true })).protectedNewerThemeConsents, 1)
  assert.equal((await payload.findByID({ collection: 'subscriptions', id: restored.id, overrideAccess: true })).state, 'subscribed')
  const missing: PrivacyRecoveryEntry = { kind: 'theme-unsubscribe', fingerprint: 'f'.repeat(64), theme: randomUUID(), occurredAt: old, expiresAt: calendarMonths(old,24), deliveryState: null, outcome: 'completed' }
  await replayPrivacyRecoveryManifest(payload, JSON.stringify(signPrivacyRecoveryManifest([missing],secret,now)), { ...recovery, apply: true })
  assert.equal((await payload.count({ collection: 'theme-withdrawals', where: { subjectFingerprint: { equals: missing.fingerprint } }, overrideAccess: true })).totalDocs, 1)
  checks.push('consentimento temático posterior é preservado; fato sem contato/tema local é importado sem criar identidade ou FK')

  const legacy = await fixture('missing-proof', false), provider = await fixture('provider'), shared = await fixture('shared'), rollback = await fixture('rollback')
  await payload.create({ collection: 'brevo-registrations', overrideAccess: true, data: { contact: provider.contact.id, revision: 1, state: 'canceled', attempts: 0, nextAttemptAt: old } })
  await payload.create({ collection: 'email-campaign-batches', overrideAccess: true, data: { key: randomUUID(), groupKey: randomUUID(), theme: seed.theme.id, stage: '2', day: old.slice(0,10), copy: { synthetic: true }, members: { legacy: [contactFingerprint(shared.contact.email,secret)] }, recipientCount: 1, state: 'canceled', nextAttemptAt: old } })
  const rollbackRequest = await payload.create({ collection:'magnet-requests', overrideAccess:true, data:{contact:rollback.contact.id,theme:seed.theme.id,magnet:seed.magnet.id,magnetVersion:seed.magnet.version,confirmedAt:old,expiresAt:old,marketingOptIn:false} })
  const rollbackEnrollment = await payload.create({ collection:'sequence-enrollments',overrideAccess:true,data:{key:randomUUID(),contact:rollback.contact.id,theme:seed.theme.id,request:rollbackRequest.id,magnet:seed.magnet.id,sequence:sequence.id,magnetVersion:seed.magnet.version,confirmedAt:old,state:'canceled',canceledAt:old,snapshot:{synthetic:true}} })
  const rollbackPromotion = await payload.create({ collection:'promotion-deliveries',overrideAccess:true,data:{key:randomUUID(),contact:rollback.contact.id,enrollment:rollbackEnrollment.id,stage:'2',dueAt:old,nextCheckAt:old,state:'canceled'} })
  await agedSubscription(rollback.sub.id,rollbackEnrollment.id,rollbackPromotion.id)
  const originalDelete = payload.delete
  payload.delete = ((args: unknown) => { const item = args as { collection: string; id?: string }; if (item.collection === 'subscriptions' && item.id === rollback.sub.id) throw new Error('Rollback temático sintético.'); return originalDelete.call(payload, args as never) }) as typeof payload.delete
  try { await assert.rejects(expireWithdrawnThemes(payload, now, true, secret), /Rollback temático/) } finally { payload.delete = originalDelete }
  assert.ok(await payload.findByID({ collection: 'subscriptions', id: rollback.sub.id, overrideAccess: true }))
  assert.ok(await payload.findByID({ collection:'sequence-enrollments',id:rollbackEnrollment.id,overrideAccess:true }))
  assert.ok(await payload.findByID({ collection:'promotion-deliveries',id:rollbackPromotion.id,overrideAccess:true }))
  await payload.update({ collection: 'subscriptions', id: rollback.sub.id, overrideAccess: true, data: { state: 'subscribed', unsubscribedAt: null } })
  assert.equal((await expireWithdrawnThemes(payload, now, true, undefined)).processed, 0)
  await expireWithdrawnThemes(payload, now, true, secret)
  for (const item of [legacy,provider,shared]) assert.ok(await payload.findByID({ collection: 'subscriptions', id: item.sub.id, overrideAccess: true }))
  checks.push('prova ausente, provedor, manifesto HMAC e chave ausente preservam dados; falha de delete reverte a transação')

  const racing = await fixture('racing')
  let unlock!:()=>void, acquired!:()=>void, observed!:()=>void
  const release = new Promise<void>(resolve=>{unlock=resolve}), locked = new Promise<void>(resolve=>{acquired=resolve}), read = new Promise<void>(resolve=>{observed=resolve})
  const holder = atomic(payload,async req=>{await serial(req,`contact:${racing.contact.id}`);acquired();await release;await payload.update({collection:'subscriptions',id:racing.sub.id,data:{state:'subscribed',unsubscribedAt:null},overrideAccess:true,req})})
  await locked
  const originalFind=payload.find
  payload.find=(async(args:unknown)=>{const result=await originalFind.call(payload,args as never);if((args as {collection:string;sort?:string}).collection==='subscriptions'&&(args as {sort?:string}).sort==='id')observed();return result}) as typeof payload.find
  const race=expireWithdrawnThemes(payload,now,true,secret)
  try {await read;unlock();await holder;await race} finally {unlock();payload.find=originalFind}
  assert.equal((await payload.findByID({collection:'subscriptions',id:racing.sub.id,overrideAccess:true})).state,'subscribed')
  checks.push('revalidação sob lock preserva nova assinatura concorrente após a seleção')
  for(let index=0;index<100;index++) await fixture(`page-${index}`,false,`00000000-0000-4000-8000-${index.toString(16).padStart(12,'0')}`)
  const tail=await fixture('tail',true,'ffffffff-ffff-4fff-8fff-ffffffffffff')
  assert.equal((await expireWithdrawnThemes(payload,now,true,secret)).processed,1)
  assert.equal(await payload.findByID({collection:'subscriptions',id:tail.sub.id,overrideAccess:true,disableErrors:true}),null)
  checks.push('100 candidatos retidos não impedem expurgo elegível no fim do backlog')
  const providerTime=Date.now()
  const providerEntry:PrivacyRecoveryEntry={kind:'theme-unsubscribe',fingerprint:contactFingerprint(provider.contact.email,secret),theme:seed.theme.id,occurredAt:old,expiresAt:calendarMonths(old,24),deliveryState:null,outcome:'completed'}
  const held=await replayPrivacyRecoveryManifest(payload,JSON.stringify(signPrivacyRecoveryManifest([providerEntry],secret,providerTime)),{...recovery,now:providerTime,apply:true})
  assert.equal(held.themePendingWithdrawals,1);assert.equal(held.pendingContacts,1);assert.equal(held.releaseAuthorized,false)
  const flow = await fixture('confirmation', false), token = createOpaqueToken(), preference = createOpaqueToken()
  const request = await payload.create({ collection: 'magnet-requests', overrideAccess: true, data: { contact: flow.contact.id, theme: seed.theme.id, magnet: seed.magnet.id, magnetVersion: seed.magnet.version, marketingOptIn: true, consentVersion: CONSENT_VERSION, confirmationTokenHash: token.hash, expiresAt: new Date(now+86400000).toISOString() } })
  await atomic(payload, async req => { const db = (payload.db as unknown as PostgresAdapter).sessions[(await req.transactionID)!].db; await db.execute(sql`UPDATE magnet_requests SET created_at=${new Date(now-7200000).toISOString()}::timestamptz WHERE id=${request.id}::uuid`) })
  await payload.create({ collection: 'preference-tokens', overrideAccess: true, data: { contact: flow.contact.id, tokenHash: preference.hash, expiresAt: new Date(now+86400000).toISOString() } })
  await payload.update({ collection: 'subscriptions', id: flow.sub.id, overrideAccess: true, data: { state: 'subscribed', unsubscribedAt: null } })
  await unsubscribeTheme(payload, preference.token, seed.theme.id, now-3600000, secret)
  await unsubscribeTheme(payload, preference.token, seed.theme.id, now, secret)
  await payload.delete({ collection: 'subscriptions', id: flow.sub.id, overrideAccess: true })
  await confirmMagnet(payload, token.token, secret, now)
  assert.equal((await payload.count({ collection: 'subscriptions', where: { contact: { equals: flow.contact.id } }, overrideAccess: true })).totalDocs, 0)
  assert.equal((await payload.count({ collection: 'email-deliveries', where: { and: [{ request: { equals: request.id } }, { kind: { equals: 'delivery' } }] }, overrideAccess: true })).totalDocs, 1)
  await requestMagnet(payload, { email: flow.contact.email, magnetId: seed.magnet.id, marketingOptIn: true, consentVersion: CONSENT_VERSION }, secret, now+1)
  const fresh = (await payload.find({ collection: 'magnet-requests', where: { and: [{ contact: { equals: flow.contact.id } }, { confirmedAt: { exists: false } }] }, overrideAccess: true })).docs[0]
  const delivery = (await payload.find({ collection: 'email-deliveries', where: { request: { equals: fresh.id } }, overrideAccess: true })).docs[0]
  let confirmation = ''
  await processDelivery(payload, delivery.id, { secret, origin: 'http://127.0.0.1:3000', now: now+2, transport: async message => { confirmation = /confirmar\?t=([\w-]+)/.exec(message.text)![1]; return { state:'sent', messageId:'synthetic' } } })
  await confirmMagnet(payload, confirmation, secret, now+3)
  assert.equal((await payload.count({ collection: 'subscriptions', where: { and: [{ contact: { equals: flow.contact.id } }, { state: { equals: 'subscribed' } }] }, overrideAccess: true })).totalDocs, 1)
  checks.push('descadastro idempotente bloqueia confirmação antiga após remover assinatura, entrega amostra e permite novo opt-in confirmado')

  const exported = await exportContactData(payload, flow.contact.email, seed.owner.id, secret)
  assert.ok(exported.counts['theme-withdrawals'])
  assert.ok(!JSON.stringify(exported.data?.['theme-withdrawals']).includes(contactFingerprint(flow.contact.email,secret)))
  await assert.rejects(payload.find({ collection: 'theme-withdrawals', overrideAccess: false, user: null }))
  assert.ok((await payload.find({ collection: 'theme-withdrawals', ...auth })).totalDocs > 0)
  await assert.rejects(payload.create({ collection: 'theme-withdrawals', ...auth, data: { key: randomUUID(), subjectFingerprint: 'a'.repeat(64), themeId: seed.theme.id, withdrawnAt: old, expiresAt: calendarMonths(old,24) } }))
  await atomic(payload, async req => { const db = (payload.db as unknown as PostgresAdapter).sessions[(await req.transactionID)!].db; await assert.rejects(down({ db } as never), /impedem rollback/) })
  const factCount=(await payload.count({collection:'theme-withdrawals',overrideAccess:true})).totalDocs
  await assert.rejects(atomic(payload,async req=>{
    const db=(payload.db as unknown as PostgresAdapter).sessions[(await req.transactionID)!].db
    await db.execute(sql`DELETE FROM theme_withdrawals`)
    await down({db} as never);await up({db} as never)
    throw new Error('Rollback do roundtrip vazio.')
  }),/roundtrip vazio/)
  assert.equal((await payload.count({collection:'theme-withdrawals',overrideAccess:true})).totalDocs,factCount)
  const agedFact = new Date(now-3*366*86400000).toISOString()
  await atomic(payload, req => storeThemeWithdrawal(req, 'a'.repeat(64), seed.theme.id, agedFact))
  assert.equal((await expireWithdrawnThemes(payload, now, true, secret)).expiredMarkers, 1)
  checks.push('API owner somente leitura, exportação sem HMAC/chave, prazo de 24 meses e down com dados recusado')
  assert.equal(externalCalls, 0)
  await mkdir('artifacts/privacy-retention', { recursive: true })
  await writeFile('artifacts/privacy-retention/d112-results.json', JSON.stringify({ phase:'D112', date:new Date().toISOString(), environment:'PostgreSQL sintético exclusivo', checks, preview:before, applied, replay:{manifestVersion:manifest.version,withdrawnThemes:replay.withdrawnThemes}, migrations:34, externalCalls, physicalRestoreValidated:false, productionChanged:false }, null, 2)+'\n')
  console.log(`Retenção temática: ${checks.length} grupos aprovados; v4, consentimento posterior e amostra independente.`)
} finally {
  globalThis.fetch = network
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]
  Object.assign(process.env, env)
  await seed.cleanup()
}
process.exit(0)
