import { migrations } from '../../migrations'
import { webhookRecipient } from '../../src/integrations/brevo/webhook'
import { sendRecipientFingerprint } from '../../src/modules/marketing/send-recipients'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { seedRelationship } from '../fixtures/relationship'
import { requestMagnet } from '../../src/modules/marketing/service'
import { serial, atomic } from '../../src/modules/marketing/transaction'
import { expireClosedIdentities } from '../../src/modules/marketing/privacy-identity-retention'
import { exportPrivacyRecoveryManifest, replayPrivacyRecoveryManifest } from '../../src/modules/marketing/privacy-recovery'
import { calendarMonths } from '../../src/modules/marketing/privacy-recovery-manifest'
import { contactFingerprint } from '../../src/modules/marketing/contact'
import { suppressionFingerprint } from '../../src/modules/marketing/suppression-tombstone'
import { exportContactData } from '../../src/modules/marketing/privacy-export'
import { down, up } from '../../migrations/20261026_231335_contact_retirements'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true','Somente banco sintético exclusivo.')
const seed=await seedRelationship(),{payload}=seed,now=Date.now()+1000,secret='synthetic-identity-retention-'.padEnd(48,'x')
const nowISO=new Date(now).toISOString(),old=calendarMonths(nowISO,-36),suppressed=new Date(now-40*86400000).toISOString(),fresh=calendarMonths(nowISO,-12),checks:string[]=[]
const previousFlags={...process.env},originalFetch=globalThis.fetch
for(const flag of Object.keys(process.env).filter(key=>key.endsWith('_ENABLED')))process.env[flag]='false'
const webhookSecret='synthetic-retention-webhook-'.padEnd(48,'x')
process.env.BREVO_WEBHOOK_EVENT_SECRET=webhookSecret
let externalCalls=0
globalThis.fetch=(async()=>{externalCalls++;throw new Error('Rede externa proibida.')}) as typeof fetch
async function born(id:string,createdAt=old) {
  await atomic(payload,async req=>{const tid=await req.transactionID;assert.ok(tid);const db=(payload.db as unknown as PostgresAdapter).sessions[tid].db;await db.execute(sql`UPDATE contacts SET created_at=${createdAt}::timestamptz WHERE id=${id}::uuid`)})
}
async function contact(label:string,globalSuppressedAt:string|null=suppressed,email=`identity-${label}-${randomUUID()}@example.invalid`) {
  const row=await payload.create({collection:'contacts',overrideAccess:true,data:{email,globalSuppressedAt,deliveryState:'ok'}})
  await born(row.id);return row
}
async function proof(id:string,occurredAt=old) {
  const row=await payload.create({collection:'consent-events',overrideAccess:true,data:{contact:id,theme:seed.theme.id,purpose:'marketing',action:'unsubscribed',occurredAt,key:randomUUID()}})
  await atomic(payload,async req=>{const tid=await req.transactionID;assert.ok(tid);const db=(payload.db as unknown as PostgresAdapter).sessions[tid].db;await db.execute(sql`UPDATE consent_events SET updated_at=${occurredAt}::timestamptz WHERE id=${row.id}::uuid`)})
  return row
}
async function sample(id:string,createdAt=old) {
  const row=await payload.create({collection:'magnet-requests',overrideAccess:true,data:{contact:id,magnet:seed.magnet.id,theme:seed.theme.id,magnetVersion:seed.magnet.version,marketingOptIn:false,confirmedAt:createdAt,expiresAt:createdAt}})
  const mail=await payload.create({collection:'email-deliveries',overrideAccess:true,data:{key:`delivery:${row.id}`,kind:'delivery',contact:id,request:row.id,state:'pending',attempts:0,nextAttemptAt:createdAt}})
  await atomic(payload,async req=>{const tid=await req.transactionID;assert.ok(tid);const db=(payload.db as unknown as PostgresAdapter).sessions[tid].db;await db.execute(sql`UPDATE magnet_requests SET created_at=${createdAt}::timestamptz WHERE id=${row.id}::uuid`)})
  return {row,mail}
}
try {
  const bare=await contact('bare'),closed=await contact('closed'),mixed=await contact('mixed'),requested=await contact('sample'),pending=await contact('pending'),shared=await contact('shared'),active=await contact('active',null),recent=await contact('recent',new Date(now-29*86400000).toISOString()),future=await contact('future'),onlyFresh=await contact('fresh')
  await born(future.id,new Date(now+10000).toISOString())
  const a=await proof(closed.id),b=await proof(closed.id),expired=await proof(mixed.id),kept=await proof(mixed.id,fresh)
  await proof(onlyFresh.id,fresh)
  const unfinished=await sample(requested.id)
  await payload.create({collection:'privacy-request-audit',overrideAccess:true,data:{subjectFingerprint:contactFingerprint(pending.email,secret),action:'delete',outcome:'pending',counts:{},actor:seed.owner.id,occurredAt:suppressed}})
  await payload.create({collection:'email-campaign-batches',overrideAccess:true,data:{key:randomUUID(),groupKey:randomUUID(),theme:seed.theme.id,stage:'2',day:suppressed.slice(0,10),copy:{synthetic:true},members:{legacy:[shared.id]},recipientCount:1,state:'canceled',nextAttemptAt:suppressed}})
  const missingSuppression=await contact('missing-suppression')
  await payload.create({collection:'marketing-suppression-tombstones',overrideAccess:true,data:{fingerprint:suppressionFingerprint(closed.email,secret),expiresAt:calendarMonths(suppressed,12)}})
  const orphan=await contact('orphan-webhook'),fingerprintOnly=await contact('fingerprint-only')
  for(const row of [orphan,fingerprintOnly])await payload.create({collection:'marketing-suppression-tombstones',overrideAccess:true,data:{fingerprint:suppressionFingerprint(row.email,secret),expiresAt:calendarMonths(suppressed,12)}})
  await payload.create({collection:'brevo-webhook-events',overrideAccess:true,data:{key:randomUUID(),recipientFingerprint:webhookRecipient(orphan.email,webhookSecret),event:'unsubscribe',providerCampaignId:11,providerWebhookId:12,occurredAt:suppressed,sentAt:suppressed,receivedAt:suppressed,state:'quarantined',reason:'unknown_contact',suppressionApplied:false}})
  await payload.create({collection:'email-campaign-batches',overrideAccess:true,data:{key:randomUUID(),groupKey:randomUUID(),theme:seed.theme.id,stage:'2',day:suppressed.slice(0,10),copy:{synthetic:true},members:{legacyFingerprint:sendRecipientFingerprint(fingerprintOnly.email,secret)},recipientCount:1,state:'canceled',nextAttemptAt:suppressed}})
  const originalExpiry=calendarMonths(nowISO,6)
  const tombstone=await payload.create({collection:'marketing-suppression-tombstones',overrideAccess:true,data:{fingerprint:suppressionFingerprint(bare.email,secret),expiresAt:originalExpiry}})
  const preview=await expireClosedIdentities(payload,now,false,secret)
  assert.equal(preview.candidates,11);assert.equal(preview.eligible,3);assert.equal(preview.processed,0)
  assert.equal((await payload.count({collection:'contacts',overrideAccess:true})).totalDocs,13)
  checks.push('preview sem escrita; contato ativo, supressão recente, amostra, pending, manifesto e identidade posterior preservados')
  delete process.env.BREVO_WEBHOOK_EVENT_SECRET
  assert.equal((await expireClosedIdentities(payload,now,false,secret)).eligible,0)
  process.env.BREVO_WEBHOOK_EVENT_SECRET=webhookSecret
  const applied=await expireClosedIdentities(payload,now,true,secret)
  assert.equal(applied.processed,3);assert.equal(applied.removedContacts,2);assert.equal(applied.removedConsentEvents,3)
  for(const row of [active,recent])assert.ok(await payload.findByID({collection:'contacts',id:row.id,overrideAccess:true}))
  for(const row of [bare,closed])assert.equal(await payload.findByID({collection:'contacts',id:row.id,overrideAccess:true,disableErrors:true}),null)
  for(const row of [a,b,expired])assert.equal(await payload.findByID({collection:'consent-events',id:row.id,overrideAccess:true,disableErrors:true}),null)
  assert.ok(await payload.findByID({collection:'consent-events',id:kept.id,overrideAccess:true}))
  assert.ok(await payload.findByID({collection:'contacts',id:mixed.id,overrideAccess:true}))
  assert.equal((await payload.findByID({collection:'email-deliveries',id:unfinished.mail.id,overrideAccess:true})).state,'pending')
  assert.ok(await payload.findByID({collection:'contacts',id:missingSuppression.id,overrideAccess:true}))
  const markers=(await payload.find({collection:'contact-retirements',pagination:false,overrideAccess:true})).docs
  assert.equal(markers.length,2)
  for(const row of markers){assert.equal(row.retiredAt,nowISO);assert.equal(row.expiresAt,calendarMonths(nowISO,24))}
  assert.equal((await payload.findByID({collection:'marketing-suppression-tombstones',id:tombstone.id,overrideAccess:true})).expiresAt,originalExpiry)
  const secondTomb=(await payload.find({collection:'marketing-suppression-tombstones',where:{fingerprint:{equals:suppressionFingerprint(closed.email,secret)}},limit:1,overrideAccess:true})).docs[0]
  assert.equal(secondTomb.expiresAt,calendarMonths(suppressed,12))
  const privateMarkers=JSON.stringify(markers)
  for(const value of [bare.email,bare.id,closed.email,closed.id,seed.owner.id])assert.ok(!privateMarkers.includes(value))
  assert.equal((await payload.count({collection:'privacy-request-audit',where:{action:{equals:'delete'}},overrideAccess:true})).totalDocs,1)
  assert.equal((await expireClosedIdentities(payload,now,true,secret)).removedContacts,0)
  assert.equal((await expireClosedIdentities(payload,now,true,undefined)).guardAvailable,false)
  checks.push('provas encerradas expiram em 24 meses; identidades sem finalidade são expurgadas com fato HMAC próprio; supressão não renova')
  const exported=await exportContactData(payload,bare.email,seed.owner.id,secret)
  assert.equal(exported.counts['contact-retirements'],1);assert.ok(exported.data?.['contact-retirements'])
  assert.ok(!JSON.stringify(exported.data).includes(contactFingerprint(bare.email,secret)))
  await assert.rejects(payload.find({collection:'contact-retirements',overrideAccess:false}))
  assert.equal((await payload.find({collection:'contact-retirements',...seed.auth})).totalDocs,2)
  await assert.rejects(payload.create({collection:'contact-retirements',...seed.auth,data:{subjectFingerprint:'a'.repeat(64),retiredAt:nowISO,expiresAt:calendarMonths(nowISO,24)}}))
  checks.push('registro pseudônimo disponível na exportação do titular mesmo sem contato; API Local nega anônimo/escrita owner')
  for(const row of [orphan,fingerprintOnly])assert.ok(await payload.findByID({collection:'contacts',id:row.id,overrideAccess:true}))
  checks.push('referência só por HMAC e callback sem FK preservam a identidade; chave de callback ausente impede inferir ausência de vínculo')

  const rollback=await contact('rollback');await payload.create({collection:'marketing-suppression-tombstones',overrideAccess:true,data:{fingerprint:suppressionFingerprint(rollback.email,secret),expiresAt:calendarMonths(suppressed,12)}});const rollbackProof=await proof(rollback.id),originalCreate=payload.create
  payload.create=((args:unknown)=>{const data=args as {collection:string;data?:{subjectFingerprint?:string}};if(data.collection==='contact-retirements'&&data.data?.subjectFingerprint===contactFingerprint(rollback.email,secret))throw new Error('Falha sintética de registro.');return originalCreate.call(payload,args as never)}) as typeof payload.create
  try{await assert.rejects(expireClosedIdentities(payload,now,true,secret))}finally{payload.create=originalCreate}
  assert.ok(await payload.findByID({collection:'contacts',id:rollback.id,overrideAccess:true}));assert.ok(await payload.findByID({collection:'consent-events',id:rollbackProof.id,overrideAccess:true}))
  await payload.update({collection:'contacts',id:rollback.id,overrideAccess:true,data:{globalSuppressedAt:null}})
  await payload.delete({collection:'marketing-suppression-tombstones',where:{fingerprint:{equals:suppressionFingerprint(rollback.email,secret)}},overrideAccess:true})
  checks.push('falha ao persistir fato HMAC reverte expurgo do contato e de suas provas na mesma transação')

  const restored=await contact('restored',null,bare.email)
  const signed=await exportPrivacyRecoveryManifest(payload,secret,now+2000)
  assert.equal(signed.version,3);assert.equal(signed.entries.filter(row=>row.kind==='retention').length,2)
  const options={secret,snapshotAt:new Date(now-86400000).toISOString(),ownerId:seed.owner.id,isolated:true,now:now+3000}
  const dry=await replayPrivacyRecoveryManifest(payload,JSON.stringify(signed),options)
  assert.equal(dry.processedContacts,0);assert.ok(await payload.findByID({collection:'contacts',id:restored.id,overrideAccess:true}))
  const replay=await replayPrivacyRecoveryManifest(payload,JSON.stringify(signed),{...options,apply:true})
  assert.equal(replay.retiredContacts,1);assert.equal(replay.pendingCoverage,true)
  assert.equal(await payload.findByID({collection:'contacts',id:restored.id,overrideAccess:true,disableErrors:true}),null)
  const repeated=await replayPrivacyRecoveryManifest(payload,JSON.stringify(signed),{...options,apply:true})
  assert.equal(repeated.retiredContacts,0)
  const after=(await payload.find({collection:'contact-retirements',pagination:false,overrideAccess:true})).docs
  assert.deepEqual(after.map(row=>[row.subjectFingerprint,row.retiredAt,row.expiresAt]).sort(),markers.map(row=>[row.subjectFingerprint,row.retiredAt,row.expiresAt]).sort())
  checks.push('manifesto v3 reaplica fato automático sem pedido humano, com preview, importação e repetição sem renovar prazo')

  await requestMagnet(payload,{email:bare.email,magnetId:seed.magnet.id,marketingOptIn:false},secret,now+1000)
  const newer=(await payload.find({collection:'contacts',where:{email:{equals:bare.email}},limit:1,overrideAccess:true})).docs[0]
  await born(newer.id,new Date(now+1000).toISOString())
  const newRequest=(await payload.find({collection:'magnet-requests',where:{contact:{equals:newer.id}},limit:1,overrideAccess:true})).docs[0]
  const newMail=(await payload.find({collection:'email-deliveries',where:{request:{equals:newRequest.id}},limit:1,overrideAccess:true})).docs[0]
  const newSample={row:newRequest,mail:newMail}
  assert.equal((await payload.count({collection:'subscriptions',where:{contact:{equals:newer.id}},overrideAccess:true})).totalDocs,0)
  assert.equal((await payload.findByID({collection:'marketing-suppression-tombstones',id:tombstone.id,overrideAccess:true})).expiresAt,originalExpiry)
  const refreshed=await exportPrivacyRecoveryManifest(payload,secret,now+2000)
  const protectedReplay=await replayPrivacyRecoveryManifest(payload,JSON.stringify(refreshed),{...options,apply:true})
  assert.ok(protectedReplay.protectedNewerPurposes>=1)
  assert.ok(await payload.findByID({collection:'contacts',id:newer.id,overrideAccess:true}))
  assert.equal((await payload.findByID({collection:'email-deliveries',id:newSample.mail.id,overrideAccess:true})).state,'pending')
  assert.equal((await payload.findByID({collection:'magnet-requests',id:newSample.row.id,overrideAccess:true})).revokedAt,null)
  const futurePurpose=await payload.create({collection:'consent-events',overrideAccess:true,data:{contact:newer.id,purpose:'sample',action:'requested',occurredAt:new Date(now+2500).toISOString(),key:randomUUID()}})
  await assert.rejects(replayPrivacyRecoveryManifest(payload,JSON.stringify(refreshed),{...options,apply:true}))
  await payload.delete({collection:'consent-events',id:futurePurpose.id,overrideAccess:true})
  checks.push('finalidade/amostra posterior ao expurgo é protegida; manifesto anterior a nova finalidade é recusado')

  const linked=await contact('linked',null,closed.email),oldSample=await sample(linked.id)
  const linkedReplay=await replayPrivacyRecoveryManifest(payload,JSON.stringify(refreshed),{...options,apply:true})
  assert.equal(linkedReplay.retirementPendingContacts,1)
  assert.ok(await payload.findByID({collection:'contacts',id:linked.id,overrideAccess:true}))
  assert.equal((await payload.findByID({collection:'email-deliveries',id:oldSample.mail.id,overrideAccess:true})).state,'canceled')
  assert.ok((await payload.findByID({collection:'magnet-requests',id:oldSample.row.id,overrideAccess:true})).revokedAt)
  assert.equal((await payload.count({collection:'privacy-request-audit',where:{and:[{action:{equals:'delete'}},{outcome:{equals:'completed'}}]},overrideAccess:true})).totalDocs,0)
  checks.push('cópia restaurada com relações antigas fica em quarentena, sem inventar entrega nem pedido owner concluído')

  const racing=await contact('race')
  let unlock!:()=>void,ready!:()=>void,observed!:()=>void
  const release=new Promise<void>(resolve=>{unlock=resolve}),acquired=new Promise<void>(resolve=>{ready=resolve}),read=new Promise<void>(resolve=>{observed=resolve})
  const holder=atomic(payload,async req=>{await serial(req,`contact:${racing.id}`);ready();await release;await payload.create({collection:'magnet-requests',overrideAccess:true,req,data:{contact:racing.id,magnet:seed.magnet.id,theme:seed.theme.id,magnetVersion:seed.magnet.version,marketingOptIn:false,expiresAt:new Date(now+86400000).toISOString()}})})
  await acquired
  const originalFind=payload.find
  payload.find=(async(args:unknown)=>{const found=await originalFind.call(payload,args as never);const query=args as {collection:string;sort?:string};if(query.collection==='contacts'&&query.sort==='id')observed();return found}) as typeof payload.find
  const raced=expireClosedIdentities(payload,now,true,secret)
  try{await read;unlock();await holder;await raced}finally{unlock();payload.find=originalFind}
  assert.ok(await payload.findByID({collection:'contacts',id:racing.id,overrideAccess:true}))
  checks.push('propósito concorrente criado após a seleção impede o expurgo sob o lock compartilhado')

  for(let index=0;index<100;index++) {
    const row=await payload.create({collection:'contacts',overrideAccess:true,data:{id:`00000000-0000-4000-8000-${index.toString(16).padStart(12,'0')}`,email:`held-identity-${index}-${randomUUID()}@example.invalid`,globalSuppressedAt:suppressed,deliveryState:'ok'}})
    await born(row.id);await proof(row.id,fresh)
  }
  const tail=await payload.create({collection:'contacts',overrideAccess:true,data:{id:'ffffffff-ffff-4fff-8fff-ffffffffffff',email:`tail-identity-${randomUUID()}@example.invalid`,globalSuppressedAt:suppressed,deliveryState:'ok'}})
  await born(tail.id)
  await payload.create({collection:'marketing-suppression-tombstones',overrideAccess:true,data:{fingerprint:suppressionFingerprint(tail.email,secret),expiresAt:calendarMonths(suppressed,12)}})
  const backlog=await expireClosedIdentities(payload,now,true,secret)
  assert.equal(backlog.removedContacts,1)
  assert.equal(await payload.findByID({collection:'contacts',id:tail.id,overrideAccess:true,disableErrors:true}),null)
  checks.push('100 provas recentes na primeira página não impedem expurgo sem finalidade no fim do backlog')

  await payload.delete({collection:'email-deliveries',id:oldSample.mail.id,overrideAccess:true})
  await payload.delete({collection:'magnet-requests',id:oldSample.row.id,overrideAccess:true})
  await payload.delete({collection:'marketing-suppression-tombstones',id:secondTomb.id,overrideAccess:true})
  const beforeReconciliation=(await payload.find({collection:'contacts',pagination:false,overrideAccess:true})).docs.map(item=>item.id)
  const afterReconciliation=await expireClosedIdentities(payload,now+40*86400000,true,secret)
  const afterIds=new Set((await payload.find({collection:'contacts',pagination:false,overrideAccess:true})).docs.map(item=>item.id))
  const labels={bare:bare.id,closed:closed.id,mixed:mixed.id,requested:requested.id,pending:pending.id,shared:shared.id,active:active.id,recent:recent.id,future:future.id,onlyFresh:onlyFresh.id,missingSuppression:missingSuppression.id,rollback:rollback.id,newer:newer.id,linked:linked.id,racing:racing.id,tail:tail.id}
  const removedLabels=beforeReconciliation.filter(id=>!afterIds.has(id)).map(id=>Object.entries(labels).find(([,value])=>value===id)?.[0]??'other-synthetic')
  assert.equal(afterReconciliation.removedContacts,1,JSON.stringify(removedLabels))
  const restoredFact=(await payload.find({collection:'contact-retirements',where:{subjectFingerprint:{equals:contactFingerprint(closed.email,secret)}},limit:1,overrideAccess:true})).docs[0]
  assert.equal(restoredFact.retiredAt,nowISO);assert.equal(restoredFact.expiresAt,calendarMonths(nowISO,24))
  assert.equal((await payload.count({collection:'marketing-suppression-tombstones',where:{fingerprint:{equals:suppressionFingerprint(closed.email,secret)}},overrideAccess:true})).totalDocs,0)
  checks.push('cópia restaurada reconciliada é removida sem reiniciar prazo de expurgo nem recriar supressão vencida')

  await atomic(payload,async req=>{const tid=await req.transactionID;assert.ok(tid);const db=(payload.db as unknown as PostgresAdapter).sessions[tid].db;await assert.rejects(down({db,payload,req} as never))})
  await payload.create({collection:'contact-retirements',overrideAccess:true,data:{subjectFingerprint:'e'.repeat(64),retiredAt:calendarMonths(nowISO,-25),expiresAt:calendarMonths(nowISO,-1)}})
  const expiry=await expireClosedIdentities(payload,now,true,undefined)
  assert.equal(expiry.expiredMarkers,1)
  await payload.delete({collection:'contact-retirements',where:{id:{exists:true}},overrideAccess:true})
  await atomic(payload,async req=>{const tid=await req.transactionID;assert.ok(tid);const db=(payload.db as unknown as PostgresAdapter).sessions[tid].db;await down({db,payload,req} as never);await up({db,payload,req} as never)})
  assert.equal((await payload.count({collection:'contact-retirements',overrideAccess:true})).totalDocs,0)
  checks.push('registro expira após 24 meses; migration down recusa dados e faz roundtrip vazio transacional')
  assert.equal(externalCalls,0)
  await mkdir('artifacts/privacy-retention',{recursive:true})
  await writeFile('artifacts/privacy-retention/d110-results.json',JSON.stringify({phase:'D110',date:new Date().toISOString(),environment:'PostgreSQL sintético exclusivo',checks,preview,applied,replay:{retiredContacts:replay.retiredContacts,protectedNewerPurposes:protectedReplay.protectedNewerPurposes,pendingRestoredCopies:linkedReplay.retirementPendingContacts},manifestVersion:3,migrations:migrations.length,externalCalls,humanDeletionRequestFabricated:false,physicalRestoreInThisSuite:false,productionChanged:false},null,2)+'\n')
  console.log(`Retenção de identidades aprovada: ${checks.length} grupos; expurgo, rollback, v3, finalidade posterior, quarentena e migration.`)
}finally{globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in previousFlags))delete process.env[key];Object.assign(process.env,previousFlags);await seed.cleanup()}
process.exit(0)
