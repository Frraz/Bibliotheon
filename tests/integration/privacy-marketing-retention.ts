import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { seedRelationship } from '../fixtures/relationship'
import { atomic, serial } from '../../src/modules/marketing/transaction'
import { contactFingerprint } from '../../src/modules/marketing/contact'
import { retainSuppressionTombstone } from '../../src/modules/marketing/suppression-tombstone'
import { expireSuppressedMarketing } from '../../src/modules/marketing/privacy-marketing-retention'
import { runPrivacyRequestAuditRetention } from '../../src/modules/marketing/privacy-retention'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true','Somente banco sintético exclusivo.')
const seed = await seedRelationship(), { payload } = seed
const now = Date.now(), old = new Date(now-40*86400000).toISOString(), boundary = new Date(now-28*86400000).toISOString()
const secret = 'synthetic-marketing-retention-'.padEnd(48,'x'), checks: string[] = []
const originalFetch = globalThis.fetch
let externalCalls = 0
globalThis.fetch = (async()=>{ externalCalls++; throw new Error('Rede externa proibida no ensaio.') }) as typeof fetch
const copy = Object.fromEntries([2,4,7,10].map(day=>[`day${day}`,{subject:'Assunto sintético',text:'Conteúdo sintético sem envio.'}]))
const sequence = await payload.create({collection:'email-sequences',...seed.auth,data:{name:'Sequência de retenção promocional',key:'synthetic-generated-key',magnet:seed.magnet.id,magnetVersion:seed.magnet.version,revision:1,offer:seed.offers[0].id,...copy}})
async function age(sub: string, enrollment?: string, promotion?: string, at = old) {
  await atomic(payload,async req=>{
    const transactionID=await req.transactionID;assert.ok(transactionID)
    const db=(payload.db as unknown as PostgresAdapter).sessions[transactionID].db
    await db.execute(sql`UPDATE subscriptions SET updated_at=${at}::timestamptz WHERE id=${sub}::uuid`)
    if(enrollment) await db.execute(sql`UPDATE sequence_enrollments SET updated_at=${at}::timestamptz WHERE id=${enrollment}::uuid`)
    if(promotion) await db.execute(sql`UPDATE promotion_deliveries SET updated_at=${at}::timestamptz WHERE id=${promotion}::uuid`)
  })
}
async function fixture(label: string, suppressedAt: string|null = old) {
  const contact=await payload.create({collection:'contacts',overrideAccess:true,data:{email:`retention-${label}-${randomUUID()}@example.invalid`,globalSuppressedAt:suppressedAt,confirmedAt:old,deliveryState:'ok'}})
  const subscription=await payload.create({collection:'subscriptions',overrideAccess:true,data:{contact:contact.id,theme:seed.theme.id,key:`${contact.id}:${seed.theme.id}`,state:'unsubscribed',unsubscribedAt:old}})
  const request=await payload.create({collection:'magnet-requests',overrideAccess:true,data:{contact:contact.id,magnet:seed.magnet.id,theme:seed.theme.id,magnetVersion:seed.magnet.version,marketingOptIn:false,confirmedAt:old,expiresAt:old}})
  const sample=await payload.create({collection:'email-deliveries',overrideAccess:true,data:{key:`delivery:${request.id}`,kind:'delivery',contact:contact.id,request:request.id,state:'pending',attempts:0,nextAttemptAt:old}})
  const consent=await payload.create({collection:'consent-events',overrideAccess:true,data:{contact:contact.id,theme:seed.theme.id,purpose:'sample',action:'confirmed',occurredAt:old,key:`confirmed:${request.id}`}})
  const enrollment=await payload.create({collection:'sequence-enrollments',overrideAccess:true,data:{key:randomUUID(),contact:contact.id,request:request.id,magnet:seed.magnet.id,theme:seed.theme.id,sequence:sequence.id,magnetVersion:seed.magnet.version,confirmedAt:old,state:'canceled',canceledAt:old,snapshot:{synthetic:true}}})
  const promotion=await payload.create({collection:'promotion-deliveries',overrideAccess:true,data:{key:randomUUID(),contact:contact.id,enrollment:enrollment.id,stage:'2',dueAt:old,nextCheckAt:old,state:'canceled',errorCode:'recipient_suppressed'}})
  await age(subscription.id,enrollment.id,promotion.id)
  return {contact,subscription,request,sample,consent,enrollment,promotion}
}
try {
  const local=await fixture('local'), exact=await fixture('boundary',boundary), recent=await fixture('recent',new Date(now-27*86400000).toISOString()), active=await fixture('active',null), fresh=await fixture('fresh'), pending=await fixture('pending'), provider=await fixture('provider'), shared=await fixture('shared'), uncertain=await fixture('uncertain'), contradictory=await fixture('contradictory')
  await age(fresh.subscription.id,fresh.enrollment.id,fresh.promotion.id,new Date(now).toISOString())
  await payload.update({collection:'subscriptions',id:contradictory.subscription.id,overrideAccess:true,data:{state:'subscribed',subscribedAt:old}})
  await payload.create({collection:'privacy-request-audit',overrideAccess:true,data:{subjectFingerprint:contactFingerprint(pending.contact.email,secret),action:'delete',outcome:'pending',counts:{},actor:seed.owner.id,occurredAt:old}})
  await payload.create({collection:'brevo-registrations',overrideAccess:true,data:{contact:provider.contact.id,revision:1,state:'canceled',attempts:0,nextAttemptAt:old}})
  await payload.create({collection:'email-campaign-batches',overrideAccess:true,data:{key:randomUUID(),groupKey:randomUUID(),theme:seed.theme.id,stage:'2',day:old.slice(0,10),copy:{synthetic:true},members:{legacy:[shared.enrollment.id.toUpperCase()]},recipientCount:1,state:'canceled',nextAttemptAt:old}})
  await payload.update({collection:'email-deliveries',id:uncertain.sample.id,overrideAccess:true,data:{state:'uncertain',attempts:1}})
  await retainSuppressionTombstone(payload,local.contact.email,secret,now-40*86400000)
  const tombstone=(await payload.find({collection:'marketing-suppression-tombstones',limit:1,overrideAccess:true})).docs[0]
  const preview=await expireSuppressedMarketing(payload,now,false,secret)
  assert.equal(preview.candidates,8);assert.equal(preview.eligible,2);assert.equal(preview.processed,0);assert.equal(preview.preservedForReconciliation,5);assert.equal(preview.withoutExpiredMarketing,1)
  assert.equal((await payload.count({collection:'subscriptions',overrideAccess:true})).totalDocs,10)
  checks.push('preview agregado sem escrita; cutoff inclusivo de 28 dias, estado recente e contato ativo preservados')
  const applied=await expireSuppressedMarketing(payload,now,true,secret)
  assert.equal(applied.processed,2);assert.equal(applied.removedSubscriptions,2);assert.equal(applied.removedEnrollments,2);assert.equal(applied.removedPromotions,2)
  for(const item of [local,exact]) {
    assert.equal(await payload.findByID({collection:'subscriptions',id:item.subscription.id,overrideAccess:true,disableErrors:true}),null)
    assert.ok(await payload.findByID({collection:'contacts',id:item.contact.id,overrideAccess:true}))
    assert.ok(await payload.findByID({collection:'magnet-requests',id:item.request.id,overrideAccess:true}))
    assert.ok(await payload.findByID({collection:'consent-events',id:item.consent.id,overrideAccess:true}))
    assert.equal((await payload.findByID({collection:'email-deliveries',id:item.sample.id,overrideAccess:true})).state,'pending')
  }
  assert.equal((await payload.findByID({collection:'marketing-suppression-tombstones',id:tombstone.id,overrideAccess:true})).expiresAt,tombstone.expiresAt)
  for(const item of [recent,active,fresh,pending,provider,shared,uncertain,contradictory]) assert.ok(await payload.findByID({collection:'sequence-enrollments',id:item.enrollment.id,overrideAccess:true}))
  assert.equal((await expireSuppressedMarketing(payload,now,true,secret)).processed,0)
  checks.push('aplicação remove apenas estado promocional elegível; preserva identidade, amostra, prova e TTL da supressão; repetição sem trabalho')
  const unavailable=await expireSuppressedMarketing(payload,now,true,undefined)
  assert.equal(unavailable.guardAvailable,false);assert.equal(unavailable.processed,0)
  checks.push('pending, vínculo de provedor, manifesto JSON sem FK, estado contraditório e envio incerto bloqueiam; chave ausente não permite expurgo')

  const rollback=await fixture('rollback'), originalDelete=payload.delete
  payload.delete=((args: unknown)=>{
    const input=args as {collection:string;id?:string}
    if(input.collection==='sequence-enrollments'&&input.id===rollback.enrollment.id) throw new Error('Falha sintética de rollback.')
    return originalDelete.call(payload,args as never)
  }) as typeof payload.delete
  try {await assert.rejects(expireSuppressedMarketing(payload,now,true,secret))} finally {payload.delete=originalDelete}
  for(const [collection,id] of [['subscriptions',rollback.subscription.id],['sequence-enrollments',rollback.enrollment.id],['promotion-deliveries',rollback.promotion.id]] as const) assert.ok(await payload.findByID({collection,id,overrideAccess:true}))
  await payload.update({collection:'contacts',id:rollback.contact.id,overrideAccess:true,data:{globalSuppressedAt:null}})
  checks.push('falha após remover etapa reverte o contato inteiro, sem apagar parcialmente calendário ou assinatura')

  const racing=await fixture('race')
  let unlocked!:()=>void, locked!:()=>void, observed!:()=>void
  const release=new Promise<void>(resolve=>{unlocked=resolve}), acquired=new Promise<void>(resolve=>{locked=resolve}), readCandidates=new Promise<void>(resolve=>{observed=resolve})
  const holder=atomic(payload,async req=>{await serial(req,`contact:${racing.contact.id}`);locked();await release;await payload.update({collection:'contacts',id:racing.contact.id,overrideAccess:true,req,data:{globalSuppressedAt:null}})})
  await acquired
  const originalFind=payload.find
  payload.find=(async(args:unknown)=>{const result=await originalFind.call(payload,args as never);const input=args as {collection:string;sort?:string};if(input.collection==='contacts'&&input.sort==='id')observed();return result}) as typeof payload.find
  const raced=expireSuppressedMarketing(payload,now,true,secret)
  try {await readCandidates;unlocked();await holder;await raced} finally {unlocked();payload.find=originalFind}
  assert.ok(await payload.findByID({collection:'subscriptions',id:racing.subscription.id,overrideAccess:true}))
  checks.push('revalidação sob lock preserva contato reativado depois da seleção inicial')

  const parent=await fixture('cross-parent'), foreign=await fixture('cross-foreign')
  await payload.update({collection:'promotion-deliveries',id:foreign.promotion.id,overrideAccess:true,data:{enrollment:parent.enrollment.id,stage:'4'}})
  await expireSuppressedMarketing(payload,now,true,secret)
  for(const item of [parent,foreign]) {
    assert.ok(await payload.findByID({collection:'sequence-enrollments',id:item.enrollment.id,overrideAccess:true}))
    assert.ok(await payload.findByID({collection:'promotion-deliveries',id:item.promotion.id,overrideAccess:true}))
  }
  checks.push('referências cruzadas entre contato e calendário são preservadas antes de qualquer delete por FK')

  for(let index=0;index<100;index++) {
    const contact=await payload.create({collection:'contacts',overrideAccess:true,data:{id:`00000000-0000-4000-8000-${index.toString(16).padStart(12,'0')}`,email:`held-${index}-${randomUUID()}@example.invalid`,globalSuppressedAt:old,deliveryState:'ok'}})
    await payload.create({collection:'subscriptions',overrideAccess:true,data:{key:randomUUID(),contact:contact.id,theme:seed.theme.id,state:'subscribed',subscribedAt:old}})
  }
  const tail=await payload.create({collection:'contacts',overrideAccess:true,data:{id:'ffffffff-ffff-4fff-8fff-ffffffffffff',email:`tail-${randomUUID()}@example.invalid`,globalSuppressedAt:old,deliveryState:'ok'}})
  const tailSub=await payload.create({collection:'subscriptions',overrideAccess:true,data:{key:randomUUID(),contact:tail.id,theme:seed.theme.id,state:'unsubscribed',unsubscribedAt:old}})
  await age(tailSub.id)
  const drained=await expireSuppressedMarketing(payload,now,true,secret)
  assert.equal(drained.processed,1);assert.equal(await payload.findByID({collection:'subscriptions',id:tailSub.id,overrideAccess:true,disableErrors:true}),null)
  checks.push('página inicial com 100 contatos retidos não impede expurgo elegível no fim do backlog')
  const routine=await runPrivacyRequestAuditRetention(payload,{now,secret})
  assert.equal(routine.suppressedMarketing.guardAvailable,true);assert.equal(routine.mode,'preview')
  assert.ok(!JSON.stringify(applied).includes(local.contact.id)&&!JSON.stringify(applied).includes(local.contact.email))
  assert.equal(externalCalls,0)
  checks.push('rotina de privacidade incorpora o relatório sem PII; nenhuma chamada externa')
  await mkdir('artifacts/privacy-retention',{recursive:true})
  await writeFile('artifacts/privacy-retention/d109-results.json',JSON.stringify({phase:'D109',date:new Date().toISOString(),environment:'PostgreSQL sintético exclusivo',checks,preview,applied,backlog:{candidates:drained.candidates,processed:drained.processed},externalCalls,identityDeletionPerformed:false,externalReconciliationPerformed:false,productionChanged:false},null,2)+'\n')
  console.log(`Retenção promocional aprovada: ${checks.length} grupos; preview, rollback, concorrência, paginação e zero rede.`)
} finally {globalThis.fetch=originalFetch;await seed.cleanup()}
process.exit(0)
