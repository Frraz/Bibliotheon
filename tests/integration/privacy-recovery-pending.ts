import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { seedRelationship } from '../fixtures/relationship'
import { deleteContactData } from '../../src/modules/marketing/privacy-delete'
import { correctContactEmail } from '../../src/modules/marketing/privacy-correct'
import { contactFingerprint } from '../../src/modules/marketing/contact'
import { confirmMagnet, requestMagnet } from '../../src/modules/marketing/service'
import { processDelivery } from '../../src/modules/marketing/delivery'
import { reviewPromotion } from '../../src/modules/marketing/sequence'
import { processBrevoRegistration } from '../../src/modules/marketing/brevo-registration'
import { applySuppression } from '../../src/modules/marketing/suppression'
import { createOpaqueToken } from '../../src/modules/marketing/tokens'
import { exportPrivacyRecoveryManifest, replayPrivacyRecoveryManifest } from '../../src/modules/marketing/privacy-recovery'
import { runPrivacyRequestAuditRetention } from '../../src/modules/marketing/privacy-retention'
import { atomic } from '../../src/modules/marketing/transaction'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true')
const seed = await seedRelationship(), {payload} = seed, secret='synthetic-pending-recovery-key'.padEnd(48,'x'), now=Date.now(), at=new Date(now).toISOString(), old=new Date(now-3*365*86400000).toISOString()
const env={...process.env}, originalFetch=globalThis.fetch, checks:string[]=[]
for (const key of Object.keys(process.env).filter(key=>key.endsWith('_ENABLED'))) process.env[key]='false'
process.env.LEAD_TOKEN_SECRET=secret
let externalCalls=0
globalThis.fetch=(async()=>{externalCalls++;throw new Error('Rede proibida no ensaio.')}) as typeof fetch
async function person(label:string) {
  const token=createOpaqueToken(),email=`pending-${label}-${randomUUID()}@example.invalid`
  const contact=await payload.create({collection:'contacts',overrideAccess:true,data:{email,confirmedAt:at,deliveryState:'ok'}})
  const request=await payload.create({collection:'magnet-requests',overrideAccess:true,data:{contact:contact.id,magnet:seed.magnet.id,theme:seed.theme.id,magnetVersion:seed.magnet.version,marketingOptIn:false,confirmationTokenHash:token.hash,expiresAt:new Date(now+86400000).toISOString()}})
  const delivery=await payload.create({collection:'email-deliveries',overrideAccess:true,data:{key:`confirmation:${request.id}`,contact:contact.id,request:request.id,kind:'confirmation',state:'uncertain',attempts:1,nextAttemptAt:at}})
  return {contact,request,delivery,email,token}
}
try {
  const deletion=await person('delete'),correction=await person('correct'),missingEmail=`pending-missing-${randomUUID()}@example.invalid`
  const correctedEmail=`resolved-${randomUUID()}@example.invalid`
  assert.equal((await deleteContactData(payload,deletion.email,seed.owner.id,secret,now)).outcome,'pending')
  assert.equal((await correctContactEmail(payload,correction.email,correctedEmail,seed.owner.id,secret,now)).outcome,'pending')
  const missing=await payload.create({collection:'privacy-request-audit',overrideAccess:true,data:{subjectFingerprint:contactFingerprint(missingEmail,secret),action:'delete',outcome:'pending',counts:{},actor:seed.owner.id,occurredAt:old}})
  await assert.rejects(requestMagnet(payload,{email:deletion.email,magnetId:seed.magnet.id,marketingOptIn:false},secret,now))
  await assert.rejects(confirmMagnet(payload,correction.token.token,secret,now))
  assert.equal((await payload.findByID({collection:'contacts',id:correction.contact.id,overrideAccess:true})).email,correction.email)
  assert.equal((await payload.findByID({collection:'email-deliveries',id:deletion.delivery.id,overrideAccess:true})).state,'uncertain')
  checks.push('pedido pending mantém identidade e envio incerto, mas bloqueia nova captura e confirmação')

  const mail=await payload.create({collection:'email-deliveries',overrideAccess:true,data:{key:`pending-test:${deletion.request.id}`,contact:deletion.contact.id,request:deletion.request.id,kind:'confirmation',state:'pending',attempts:0,nextAttemptAt:at}})
  await processDelivery(payload,mail.id,{secret,origin:'http://127.0.0.1:3000',now,transport:async()=>{externalCalls++;return {state:'sent',messageId:'should-not-send'}}})
  const canceled=await payload.findByID({collection:'email-deliveries',id:mail.id,overrideAccess:true})
  assert.equal(canceled.state,'canceled');assert.equal(canceled.errorCode,'recipient_suppressed')
  await payload.create({collection:'subscriptions',overrideAccess:true,data:{contact:deletion.contact.id,theme:seed.theme.id,key:`${deletion.contact.id}:${seed.theme.id}`,state:'subscribed',subscribedAt:at,consentVersion:'synthetic'}})
  const registration=await payload.create({collection:'brevo-registrations',overrideAccess:true,data:{contact:deletion.contact.id,revision:1,state:'pending',attempts:0,nextAttemptAt:at}})
  const client={ensure:async()=>{externalCalls++;return {state:'absent' as const}},inspect:async()=>{externalCalls++;return {state:'absent' as const}},block:async()=>{externalCalls++;return {state:'blocked' as const}}}
  assert.equal((await processBrevoRegistration(payload,registration.id,{client,secret,now})).state,'canceled')
  const template=await payload.create({collection:'email-sequences',...seed.auth,data:{name:'Sequência sintética pending',key:'generated-by-server',magnet:seed.magnet.id,magnetVersion:seed.magnet.version,revision:1,offer:seed.offers[0].id}})
  const enrollment=await payload.create({collection:'sequence-enrollments',overrideAccess:true,data:{key:randomUUID(),contact:deletion.contact.id,request:deletion.request.id,magnet:seed.magnet.id,theme:seed.theme.id,sequence:template.id,magnetVersion:seed.magnet.version,confirmedAt:at,state:'active',snapshot:{synthetic:true}}})
  const promotion=await payload.create({collection:'promotion-deliveries',overrideAccess:true,data:{key:randomUUID(),contact:deletion.contact.id,enrollment:enrollment.id,stage:'2',dueAt:at,nextCheckAt:at,state:'ready'}})
  assert.equal((await atomic(payload,req=>reviewPromotion(req,promotion,now,secret))).state,'canceled')
  assert.equal((await payload.findByID({collection:'promotion-deliveries',id:promotion.id,overrideAccess:true})).errorCode,'recipient_suppressed')
  assert.equal(externalCalls,0)
  checks.push('envio transacional, promoção e cadastro novo são barrados antes de transporte ou quota')

  await runPrivacyRequestAuditRetention(payload,{now,apply:true})
  assert.equal((await payload.findByID({collection:'privacy-request-audit',id:missing.id,overrideAccess:true})).outcome,'pending')
  await payload.create({collection:'privacy-request-audit',overrideAccess:true,data:{subjectFingerprint:contactFingerprint(deletion.email,secret),action:'delete',outcome:'completed',counts:{},actor:seed.owner.id,occurredAt:new Date(now-86400000).toISOString()}})
  const manifest=await exportPrivacyRecoveryManifest(payload,secret,now+1000),input=JSON.stringify(manifest),snapshotAt=new Date(now-3600000).toISOString()
  assert.equal(manifest.version,2);assert.equal(manifest.entries.length,3)
  assert.ok(manifest.entries.every(entry=>entry.outcome==='pending'&&entry.expiresAt===null))
  for (const value of [deletion.email,correction.email,correctedEmail,missingEmail]) assert.ok(!input.includes(value))
  checks.push('auditoria pending de três anos preservada e manifesto v2 prefere pending a completed mais antigo, sem prazo automático')

  // Exclusive synthetic restore: discard the newer audits and reinstate queued work from before the requests.
  await payload.delete({collection:'privacy-request-audit',where:{id:{exists:true}},overrideAccess:true})
  for (const fixture of [deletion,correction]) await payload.update({collection:'email-deliveries',id:fixture.delivery.id,overrideAccess:true,data:{state:'pending',attempts:0}})
  const options={secret,snapshotAt,ownerId:seed.owner.id,isolated:true,now:now+2000}
  const preview=await replayPrivacyRecoveryManifest(payload,input,options)
  assert.equal(preview.pendingDecisions,3);assert.equal(preview.processedContacts,0)
  assert.equal((await payload.count({collection:'privacy-request-audit',overrideAccess:true})).totalDocs,0)
  const applied=await replayPrivacyRecoveryManifest(payload,input,{...options,apply:true})
  assert.equal(applied.deletedContacts,0);assert.equal(applied.pendingContacts,2);assert.equal(applied.pendingDecisions,3)
  for (const fixture of [deletion,correction]) {
    assert.ok(await payload.findByID({collection:'contacts',id:fixture.contact.id,overrideAccess:true}))
    assert.equal((await payload.findByID({collection:'email-deliveries',id:fixture.delivery.id,overrideAccess:true})).state,'canceled')
  }
  assert.equal((await payload.count({collection:'privacy-request-audit',where:{outcome:{equals:'completed'}},overrideAccess:true})).totalDocs,0)
  await assert.rejects(requestMagnet(payload,{email:missingEmail,magnetId:seed.magnet.id,marketingOptIn:false},secret,now+2000))
  await assert.rejects(applySuppression(payload,{email:missingEmail,reason:'unsubscribed',source:'manual',reference:'synthetic-pending-missing'},secret,now+2000))
  checks.push('replay mantém pending sem excluir identidade nem fabricar conclusão; ausente também permanece bloqueado')

  const repeated=await replayPrivacyRecoveryManifest(payload,input,{...options,apply:true})
  assert.equal(repeated.importedDecisions,0);assert.equal(repeated.pendingDecisions,3)
  assert.equal((await payload.count({collection:'privacy-request-audit',overrideAccess:true})).totalDocs,3)
  await runPrivacyRequestAuditRetention(payload,{now:now+2000,apply:true})
  assert.equal((await payload.count({collection:'privacy-request-audit',where:{outcome:{equals:'pending'}},overrideAccess:true})).totalDocs,3)
  checks.push('repetição não duplica pending e a retenção não apaga sua conciliação aberta')

  await payload.update({collection:'contacts',id:deletion.contact.id,overrideAccess:true,data:{globalSuppressedAt:null}})
  await payload.update({collection:'email-deliveries',id:mail.id,overrideAccess:true,data:{state:'pending'}})
  await processDelivery(payload,mail.id,{secret,origin:'http://127.0.0.1:3000',now:now+2000,transport:async()=>{externalCalls++;return {state:'sent',messageId:'should-not-send'}}})
  assert.equal((await payload.findByID({collection:'email-deliveries',id:mail.id,overrideAccess:true})).errorCode,'recipient_suppressed')
  assert.equal(externalCalls,0)
  checks.push('auditoria pending bloqueia entrega mesmo sem globalSuppressedAt e sem decisão completed')

  assert.equal((await correctContactEmail(payload,correction.email,correctedEmail,seed.owner.id,secret,now+2500)).outcome,'completed')
  const fresh=await exportPrivacyRecoveryManifest(payload,secret,now+3000)
  const resolved=fresh.entries.find(entry=>entry.kind==='correct'&&entry.fingerprint===contactFingerprint(correction.email,secret))!
  assert.equal(resolved.outcome,'completed');assert.ok(resolved.expiresAt)
  assert.equal(fresh.entries.filter(entry=>entry.outcome==='pending').length,2)
  checks.push('somente resolução explícita muda pending para completed e inicia a retenção da decisão concluída')
  await mkdir('artifacts/privacy-recovery',{recursive:true})
  await writeFile('artifacts/privacy-recovery/d105-results.json',JSON.stringify({date:new Date().toISOString(),environment:'PostgreSQL local sintético; histórico de restore simulado',checks,checksPassed:checks.length,externalCalls,physicalRestoreValidated:false,productionChanged:false},null,2)+'\n')
  console.log(`Privacidade pendente: ${checks.length} grupos aprovados.`)
} finally {
  globalThis.fetch=originalFetch
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]
  Object.assign(process.env,env)
  await seed.cleanup()
}
process.exit(0)
