import { storeContactRetirement } from '../../src/modules/marketing/privacy-identity-retention'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { seedRelationship } from '../fixtures/relationship'
import { atomic, serial } from '../../src/modules/marketing/transaction'
import { contactFingerprint } from '../../src/modules/marketing/contact'
import { backfillThemeWithdrawals } from '../../src/modules/marketing/legacy-theme-withdrawal'
import { expireWithdrawnThemes } from '../../src/modules/marketing/privacy-theme-retention'
import { exportPrivacyRecoveryManifest, replayPrivacyRecoveryManifest } from '../../src/modules/marketing/privacy-recovery'
import { retainSuppressionTombstone } from '../../src/modules/marketing/suppression-tombstone'
import { calendarMonths, verifyPrivacyRecoveryManifest } from '../../src/modules/marketing/privacy-recovery-manifest'
import { runPrivacyRequestAuditRetention } from '../../src/modules/marketing/privacy-retention'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true','Somente banco sintético exclusivo.')
const seed=await seedRelationship(), {payload}=seed
const now=Date.now(), old=new Date(now-40*86400000).toISOString(), secret='synthetic-legacy-withdrawal-'.padEnd(48,'x'), checks:string[]=[]
const originalFetch=globalThis.fetch, env={...process.env}
let externalCalls=0
for(const key of Object.keys(process.env).filter(key=>key.endsWith('_ENABLED')))process.env[key]='false'
globalThis.fetch=(async()=>{externalCalls++;throw new Error('Rede externa proibida.')}) as typeof fetch
async function fixture(mode='valid',at=old,id?:string,eventTheme=seed.theme.id){
  const contact=await payload.create({collection:'contacts',overrideAccess:true,data:{email:`legacy-${randomUUID()}@example.invalid`,deliveryState:'ok'}})
  const sub=await payload.create({collection:'subscriptions',overrideAccess:true,data:{...(id?{id}:{}),contact:contact.id,theme:seed.theme.id,key:`${contact.id}:${seed.theme.id}`,state:'unsubscribed',unsubscribedAt:at}})
  if(mode!=='missing')await payload.create({collection:'consent-events',overrideAccess:true,data:{contact:contact.id,theme:eventTheme,purpose:mode==='purpose'?'sample':'marketing',action:'unsubscribed',occurredAt:mode==='date'?new Date(Date.parse(at)-1000).toISOString():at,key:mode==='prefix'?randomUUID():`theme-unsubscribe:${sub.id}:${at}`}})
  await atomic(payload,async req=>{const db=(payload.db as unknown as PostgresAdapter).sessions[(await req.transactionID)!].db;await db.execute(sql`UPDATE subscriptions SET updated_at=${at}::timestamptz WHERE id=${sub.id}::uuid`)})
  return {contact,sub}
}
const markers=(email:string)=>payload.find({collection:'theme-withdrawals',where:{subjectFingerprint:{equals:contactFingerprint(email,secret)}},overrideAccess:true,depth:0})
try {
  const valid=await fixture()
  const preview=await backfillThemeWithdrawals(payload,now,false,secret)
  assert.equal(preview.verified,1);assert.equal(preview.persisted,0)
  const manifest=await exportPrivacyRecoveryManifest(payload,secret,now)
  assert.equal(manifest.version,4);assert.equal(manifest.entries.length,1)
  assert.equal(manifest.entries[0].occurredAt,old)
  assert.equal((await markers(valid.contact.email)).totalDocs,0)
  assert.equal((await expireWithdrawnThemes(payload,now,false,secret)).eligible,1)
  checks.push('prova nativa exata permite preview e manifesto v4 read-only antes de existir fato, sem inventar data')
  const first=await backfillThemeWithdrawals(payload,now,true,secret)
  assert.equal(first.persisted,1)
  const marker=(await markers(valid.contact.email)).docs[0]
  assert.equal(marker.withdrawnAt,old);assert.equal(marker.expiresAt,calendarMonths(old,24))
  await backfillThemeWithdrawals(payload,now+1000,true,secret)
  assert.equal((await markers(valid.contact.email)).docs[0].updatedAt,marker.updatedAt)
  await expireWithdrawnThemes(payload,now,true,secret)
  assert.equal(await payload.findByID({collection:'subscriptions',id:valid.sub.id,overrideAccess:true,disableErrors:true}),null)
  const restored=await payload.create({collection:'subscriptions',overrideAccess:true,data:{id:valid.sub.id,contact:valid.contact.id,theme:seed.theme.id,key:valid.sub.key,state:'subscribed',subscribedAt:old}})
  const replay=await replayPrivacyRecoveryManifest(payload,JSON.stringify(manifest),{secret,snapshotAt:new Date(now-86400000).toISOString(),ownerId:seed.owner.id,isolated:true,apply:true,now})
  assert.equal(replay.withdrawnThemes,1)
  assert.equal((await payload.findByID({collection:'subscriptions',id:restored.id,overrideAccess:true})).unsubscribedAt,old)
  assert.equal((await markers(valid.contact.email)).docs[0].expiresAt,marker.expiresAt)
  checks.push('backfill mantém vencimento original; expurgo e replay preservam retirada e idempotência sem pedido owner')

  const contradictory=await payload.create({collection:'consent-events',overrideAccess:true,data:{contact:valid.contact.id,theme:seed.theme.id,purpose:'marketing',action:'subscribed',occurredAt:new Date(Date.parse(old)+1000).toISOString(),key:randomUUID()}})
  await assert.rejects(exportPrivacyRecoveryManifest(payload,secret,now),/sem prova verificável/)
  await payload.delete({collection:'consent-events',id:contradictory.id,overrideAccess:true})
  const renewed=await fixture('missing')
  await atomic(payload,req=>storeContactRetirement(req,contactFingerprint(renewed.contact.email,secret),new Date(now-86400000).toISOString()))
  await assert.rejects(exportPrivacyRecoveryManifest(payload,secret,now),/sem prova verificável/)
  // A restored older identity without any later purpose is still covered by the automatic fact.
  await atomic(payload,async req=>{const db=(payload.db as unknown as PostgresAdapter).sessions[(await req.transactionID)!].db;await db.execute(sql`UPDATE contacts SET created_at=${new Date(now-2*86400000).toISOString()}::timestamptz WHERE id=${renewed.contact.id}::uuid`)})
  const coveredRetirement=await exportPrivacyRecoveryManifest(payload,secret,now)
  assert.ok(coveredRetirement.entries.some(entry=>entry.kind==='retention'&&entry.fingerprint===contactFingerprint(renewed.contact.email,secret)))
  await payload.delete({collection:'subscriptions',id:renewed.sub.id,overrideAccess:true})
  const missing=await fixture('missing')
  await assert.rejects(exportPrivacyRecoveryManifest(payload,secret,now),/sem prova verificável/)
  assert.equal((await markers(missing.contact.email)).totalDocs,0)
  await retainSuppressionTombstone(payload,missing.contact.email,secret,now)
  const covered=await exportPrivacyRecoveryManifest(payload,secret,now)
  assert.ok(covered.entries.some(entry=>entry.kind==='suppression'))
  assert.ok(!covered.entries.some(entry=>entry.kind==='theme-unsubscribe'&&entry.fingerprint===contactFingerprint(missing.contact.email,secret)))
  await payload.delete({collection:'subscriptions',id:missing.sub.id,overrideAccess:true})
  const expired=await fixture('valid',new Date(now-3*366*86400000).toISOString())
  const expiredManifest=await exportPrivacyRecoveryManifest(payload,secret,now)
  assert.ok(!expiredManifest.entries.some(entry=>entry.fingerprint===contactFingerprint(expired.contact.email,secret)))
  assert.equal((await backfillThemeWithdrawals(payload,now,true,secret)).expired,1)
  assert.equal((await markers(expired.contact.email)).totalDocs,0)
  await assert.rejects(async()=>verifyPrivacyRecoveryManifest(JSON.stringify(expiredManifest),secret,new Date(Date.parse(expired.sub.unsubscribedAt!)-1000).toISOString(),now),/fora da janela/)
  const expiredClosure=await expireWithdrawnThemes(payload,now,true,secret)
  assert.equal(expiredClosure.expiredProofClosures,1)
  assert.equal(await payload.findByID({collection:'subscriptions',id:expired.sub.id,overrideAccess:true,disableErrors:true}),null)
  assert.equal((await markers(expired.contact.email)).totalDocs,0)
  assert.ok(await payload.findByID({collection:'contacts',id:expired.contact.id,overrideAccess:true}))
  checks.push('exportação recusa lacuna e cobertura automática anterior a nova finalidade, aceita bloqueio global real e encerra estado com prova vencida sem criar novo prazo')

  const purpose=await fixture('purpose'),prefix=await fixture('prefix'),date=await fixture('date'),newer=await fixture(),noncanonical=await fixture()
  await payload.create({collection:'consent-events',overrideAccess:true,data:{contact:newer.contact.id,theme:seed.theme.id,purpose:'marketing',action:'subscribed',occurredAt:new Date(Date.parse(old)+1000).toISOString(),key:randomUUID()}})
  await payload.update({collection:'subscriptions',id:noncanonical.sub.id,overrideAccess:true,data:{key:randomUUID()}})
  const otherTheme=await payload.create({collection:'themes',...seed.auth,data:{name:'Assunto legado divergente',slug:`tema-${randomUUID()}`,introduction:'Somente fixture.',_status:'published'}})
  seed.extraThemes.push(otherTheme.id)
  const wrongTheme=await fixture('valid',old,undefined,otherTheme.id),future=await fixture('valid',new Date(now+60000).toISOString()),ambiguous=await fixture()
  await payload.create({collection:'consent-events',overrideAccess:true,data:{contact:ambiguous.contact.id,theme:seed.theme.id,purpose:'marketing',action:'subscribed',occurredAt:old,key:randomUUID()}})
  const held=[purpose,prefix,date,newer,noncanonical,wrongTheme,future,ambiguous]
  assert.equal((await backfillThemeWithdrawals(payload,now,true,secret)).persisted,0)
  for(const item of held)assert.equal((await markers(item.contact.email)).totalDocs,0)
  assert.equal((await backfillThemeWithdrawals(payload,now,true,undefined)).guardAvailable,false)
  const provider=await fixture()
  await payload.create({collection:'brevo-registrations',overrideAccess:true,data:{contact:provider.contact.id,revision:1,state:'canceled',attempts:0,nextAttemptAt:old}})
  assert.equal((await backfillThemeWithdrawals(payload,now,true,secret)).persisted,1)
  await expireWithdrawnThemes(payload,now,true,secret)
  assert.ok(await payload.findByID({collection:'subscriptions',id:provider.sub.id,overrideAccess:true}))
  checks.push('finalidade/prefixo/data divergentes, consentimento posterior, chave de assinatura divergente e chave ausente não geram fato; provedor preserva dados')

  const rollback=await fixture(), originalDelete=payload.delete
  payload.delete=((args:unknown)=>{const item=args as {collection:string;id?:string};if(item.collection==='subscriptions'&&item.id===rollback.sub.id)throw new Error('Falha sintética após fato legado.');return originalDelete.call(payload,args as never)}) as typeof payload.delete
  try {await assert.rejects(expireWithdrawnThemes(payload,now,true,secret),/após fato legado/)}finally{payload.delete=originalDelete}
  assert.equal((await markers(rollback.contact.email)).totalDocs,0)
  assert.ok(await payload.findByID({collection:'subscriptions',id:rollback.sub.id,overrideAccess:true}))
  const direct=await expireWithdrawnThemes(payload,now,true,secret)
  assert.equal(direct.backfilledMarkers,1);assert.equal(direct.removedSubscriptions,1)
  checks.push('chamada direta da retenção persiste fato e apaga estado atomicamente; falha reverte ambos')

  const racing=await fixture()
  let unlock!:()=>void,acquired!:()=>void,observed!:()=>void
  const release=new Promise<void>(resolve=>{unlock=resolve}),locked=new Promise<void>(resolve=>{acquired=resolve}),read=new Promise<void>(resolve=>{observed=resolve})
  const holder=atomic(payload,async req=>{await serial(req,`contact:${racing.contact.id}`);acquired();await release;await payload.update({collection:'subscriptions',id:racing.sub.id,data:{state:'subscribed',unsubscribedAt:null},overrideAccess:true,req})})
  await locked
  const originalFind=payload.find
  payload.find=(async(args:unknown)=>{const result=await originalFind.call(payload,args as never);const item=args as {collection:string;sort?:string};if(item.collection==='subscriptions'&&item.sort==='id')observed();return result}) as typeof payload.find
  const race=backfillThemeWithdrawals(payload,now,true,secret)
  try{await read;unlock();await holder;await race}finally{unlock();payload.find=originalFind}
  assert.equal((await markers(racing.contact.email)).totalDocs,0)
  checks.push('revalidação sob lock não cria retirada para assinatura reativada após seleção')
  for(let index=0;index<100;index++)await fixture('missing',old,`00000000-0000-4000-8000-${index.toString(16).padStart(12,'0')}`)
  const tail=await fixture('valid',old,'ffffffff-ffff-4fff-8fff-ffffffffffff')
  const drained=await backfillThemeWithdrawals(payload,now,true,secret)
  assert.equal(drained.persisted,1);assert.equal((await markers(tail.contact.email)).totalDocs,1)
  checks.push('página com 100 estados sem prova não impede derivação válida no fim do backlog')
  const routine=await runPrivacyRequestAuditRetention(payload,{now,secret,apply:true})
  assert.ok(routine.legacyThemeWithdrawals.unverified>=100)
  assert.ok(routine.marketingDeadline.reviewRequired)
  assert.equal(await payload.findByID({collection:'subscriptions',id:tail.sub.id,overrideAccess:true,disableErrors:true}),null)
  assert.equal((await payload.count({collection:'privacy-request-audit',where:{action:{in:['delete','correct']}},overrideAccess:true})).totalDocs,0)
  assert.ok(!JSON.stringify(routine.legacyThemeWithdrawals).includes(valid.contact.email))
  assert.equal(externalCalls,0)
  checks.push('rotina incorpora derivação e retenção mantendo exceções visíveis, relatório sem PII e zero rede')
  await mkdir('artifacts/privacy-retention',{recursive:true})
  await writeFile('artifacts/privacy-retention/d114-results.json',JSON.stringify({phase:'D114',date:new Date().toISOString(),environment:'PostgreSQL sintético exclusivo',checks,preview,applied:first,backlog:drained,manifestVersion:manifest.version,externalCalls,syntheticReplayValidated:true,physicalRestoreValidated:false,humanDeletionRequestFabricated:false,productionChanged:false},null,2)+'\n')
  console.log(`Legado temático: ${checks.length} grupos aprovados; prova exata, v4, rollback e paginação.`)
}finally{globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);await seed.cleanup()}
process.exit(0)
