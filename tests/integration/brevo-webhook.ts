import {up as upIdentities,down as downIdentities} from '../../migrations/20261024_071409_brevo_send_recipients'
import {up as upWebhooks,down as downWebhooks} from '../../migrations/20261024_070440_brevo_webhook_events'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir,writeFile,mkdtemp,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { type PostgresAdapter } from '@payloadcms/db-postgres'
import { seedRelationship } from '../fixtures/relationship'
import { requestMagnet,confirmMagnet,unsubscribe } from '../../src/modules/marketing/service'
import { processDelivery } from '../../src/modules/marketing/delivery'
import { CONSENT_VERSION } from '../../src/modules/marketing/validation'
import { preparePromotionBatches } from '../../src/modules/marketing/batches'
import { dispatchBrevoBatchCampaign } from '../../src/modules/marketing/campaign-send'
import { quotaWindow } from '../../src/modules/marketing/quota-policy'
import { createBrevoCampaigns } from '../../src/integrations/brevo/campaigns'
import { createBrevoCampaignDispatch } from '../../src/integrations/brevo/campaign-dispatch'
import type { BrevoLists } from '../../src/integrations/brevo/lists'
import type { BrevoContacts } from '../../src/integrations/brevo/contacts'
import type { BrevoPreferences } from '../../src/integrations/brevo/preferences'
import { atomic } from '../../src/modules/marketing/transaction'
import {ingestBrevoWebhook,replayBrevoWebhook} from '../../src/modules/marketing/brevo-webhook'
import {webhookConfig,type MarketingWebhookEvent,type WebhookEventKind} from '../../src/integrations/brevo/webhook'

const seed=await seedRelationship(),{payload,magnet}=seed
const secret=randomBytes(32).toString('hex'),origin='http://127.0.0.1:3001',start=Date.now(),due=start+2*86_400_000,checks:string[]=[]
const peopleIds=new Map<string,number>(),links=new Map<string,string>()
const directory:BrevoContacts={inspect:async email=>{if(!peopleIds.has(email))peopleIds.set(email,peopleIds.size+1);return{state:'found',id:peopleIds.get(email)!,blocked:false}},block:async()=>{throw new Error('No network block')}}
const preferences:BrevoPreferences={ensure:async(_id,email,url)=>{links.set(email,url);return{state:'verified'}}}
const listRows=new Map<number,{id:number;name:string;folderId:number;ids:number[]}>()
const lists:BrevoLists={folderId:10,find:async name=>{const row=[...listRows.values()].find(item=>item.name===name);return row?{state:'found',id:row.id}:{state:'absent'}},create:async name=>{const id=100+listRows.size;listRows.set(id,{id,name,folderId:10,ids:[]});return{state:'created',id}},details:async id=>{const item=listRows.get(id);return item?{state:'found',list:{id,name:item.name,folderId:10}}:{state:'absent'}},members:async id=>{const row=listRows.get(id);return row?{state:'members',contacts:row.ids.map(id=>({id,blocked:false,unsubscribed:false}))}:{state:'absent'}},add:async(id,ids)=>{listRows.get(id)!.ids.push(...ids);return{state:'acknowledged'}}}
type Campaign={id:number;body:Record<string,unknown>;status:string}
const remote=new Map<number,Campaign>(),modes=new Map<string,string>(),sends=new Map<string,number>(),peopleByBatch=new Map<string,string[]>()
let entered:(()=>void)|undefined,release:Promise<void>|undefined
function report(row:Campaign){const b=row.body;return{id:row.id,...b,status:row.status,recipients:{lists:(b.recipients as {listIds:number[]}).listIds,exclusionLists:[]}}}
const transport:typeof fetch=async(input,options)=>{
 const url=new URL(String(input));assert.equal(url.origin,'https://api.brevo.com');
 if(url.pathname.endsWith('/sendNow')){
  assert.equal(options?.method,'POST');assert.equal(options?.body,undefined)
  const id=Number(url.pathname.split('/').at(-2)),row=remote.get(id);assert.ok(row)
  const name=String(row.body.name),mode=modes.get(name);sends.set(name,(sends.get(name)||0)+1)
  if(mode==='reject')return new Response(null,{status:402})
  row.status='scheduled'
  if(mode==='inflight'||mode==='abandoned'){entered?.();await release}
  if(mode==='lost')throw new Error('synthetic response lost after acceptance')
  return new Response(null,{status:204})
 }
 if(url.pathname==='/v3/emailCampaigns'&&options?.method==='POST'){
  const body=JSON.parse(String(options.body)),row={id:1000+remote.size,body,status:'draft'};remote.set(row.id,row);return Response.json({id:row.id},{status:201})
 }
 assert.equal(options?.method,'GET')
 if(url.pathname==='/v3/emailCampaigns'){const all=[...remote.values()],offset=Number(url.searchParams.get('offset'));return Response.json({count:all.length,campaigns:all.slice(offset,offset+50).map(row=>({id:row.id,name:row.body.name}))})}
 const id=Number(url.pathname.split('/').at(-1)),row=remote.get(id);if(!row)return new Response(null,{status:404})
 if(modes.get(String(row.body.name))==='hold-verify'){entered?.();await release}
 if(modes.get(String(row.body.name))==='withdraw-before-claim'){
  const email=peopleByBatch.get(String(row.body.name))![0]
  await unsubscribe(payload,new URL(links.get(email)!).searchParams.get('t'),due)
 }
 return Response.json(report(row))
}
const campaigns=createBrevoCampaigns('synthetic',41,transport),dispatch=createBrevoCampaignDispatch('synthetic',transport)
const settings={campaigns,lists,contacts:directory,preferences,secret,origin,dispatch}
const run=(id:string,now=due,more:Partial<Parameters<typeof dispatchBrevoBatchCampaign>[2]>={})=>dispatchBrevoBatchCampaign(payload,id,{...settings,now,...more})
const jobFor=async(batch:string)=>(await payload.find({collection:'brevo-campaign-sends',where:{batch:{equals:batch}},limit:1,depth:0,overrideAccess:true})).docs[0]
const usedAt=async(now:number)=>(await payload.find({collection:'mail-quota',where:{day:{equals:quotaWindow(now).day}},depth:0,overrideAccess:true})).docs[0]?.reserved??0
let revision=1
const envEnabled={...process.env,BREVO_CONTACT_SYNC_ENABLED:'true',BREVO_CONTACT_REGISTRATION_ENABLED:'false',BREVO_LIST_SYNC_ENABLED:'true',BREVO_LIST_FOLDER_ID:'10',BREVO_PREFERENCE_SYNC_ENABLED:'true',BREVO_CAMPAIGN_SYNC_ENABLED:'true',BREVO_CAMPAIGN_SENDER_ID:'41',BREVO_CAMPAIGN_SEND_ENABLED:'true',BREVO_API_KEY:'synthetic',LEAD_TOKEN_SECRET:secret,PUBLIC_SITE_URL:origin,EMAIL_TRANSPORT_ENABLED:'false'}
try{
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=(payload.db as unknown as PostgresAdapter).sessions[id].db;await downIdentities({db,payload,req});await downWebhooks({db,payload,req});await upWebhooks({db,payload,req});await upIdentities({db,payload,req});throw new Error('synthetic rollback')}),/synthetic rollback/)
 const copy=Object.fromEntries([2,4,7,10].map(day=>[`day${day}`,{subject:`Disparo sintético ${day}`,text:`Conteúdo manual sintético ${day}.`}]))
 const sequence=await payload.create({collection:'email-sequences',...seed.auth,data:{name:'Disparos totalmente sintéticos',key:'synthetic',magnet:magnet.id,magnetVersion:magnet.version,revision,offer:seed.offers[0].id,active:true,...copy}})
 async function group(name:string,count=1){
  await payload.update({collection:'email-sequences',id:sequence.id,...seed.auth,data:{revision:++revision,day2:{subject:`Grupo sintético ${revision}`}}})
  const people=[]
  for(let i=0;i<count;i++){
   const email=`${name}-${i}-${randomBytes(4).toString('hex')}@example.invalid`
   await requestMagnet(payload,{email,magnetId:magnet.id,marketingOptIn:true,consentVersion:CONSENT_VERSION},secret,start)
   const person=(await payload.find({collection:'contacts',where:{email:{equals:email}},depth:0,overrideAccess:true})).docs[0]
   const delivery=(await payload.find({collection:'email-deliveries',where:{and:[{contact:{equals:person.id}},{kind:{equals:'confirmation'}}]},depth:0,overrideAccess:true})).docs[0]
   let token='';await processDelivery(payload,delivery.id,{secret,origin,now:start,transport:async message=>{token=/confirmar\?t=([\w-]+)/.exec(message.text)![1];return{state:'sent',messageId:'synthetic'}}});await confirmMagnet(payload,token,secret,start);people.push(person)
  }
  await preparePromotionBatches(payload,due)
  const delivery=(await payload.find({collection:'promotion-deliveries',where:{and:[{contact:{equals:people[0].id}},{stage:{equals:'2'}}]},depth:0,overrideAccess:true})).docs[0]
  const id=typeof delivery.batch==='string'?delivery.batch:delivery.batch!.id,nameKey=`bibliotheon-${id}`
  peopleByBatch.set(nameKey,people.map(person=>person.email));return{id,name:nameKey,people}
 }
 const config=webhookConfig({...process.env,BREVO_WEBHOOK_ENABLED:'true',BREVO_WEBHOOK_TOKEN:'w'.repeat(64),BREVO_WEBHOOK_PREVIOUS_TOKEN:'',BREVO_WEBHOOK_EVENT_SECRET:'v'.repeat(64),LEAD_TOKEN_SECRET:secret})!
 assert.ok(config)
 const makeEvent=(email:string,campaignId:number,event:WebhookEventKind='delivered',offset=10):MarketingWebhookEvent=>({email,campaignId,event,webhookId:123,sentAt:new Date(Math.floor(due/1000)*1000).toISOString(),occurredAt:new Date(Math.floor(due/1000)*1000+offset*1000).toISOString()})
 const ingest=(event:MarketingWebhookEvent)=>ingestBrevoWebhook(payload,event,config,due+60_000)
 const rowFor=async(campaignId:number,event='delivered')=>(await payload.find({collection:'brevo-webhook-events',where:{and:[{providerCampaignId:{equals:campaignId}},{event:{equals:event}}]},depth:0,overrideAccess:true})).docs[0]
 const receiptFor=async(send:string)=>(await payload.find({collection:'brevo-delivery-receipts',where:{send:{equals:send}},depth:0,overrideAccess:true})).docs[0]
 const normal=await group('normal');modes.set(normal.name,'lost');assert.equal((await run(normal.id)).state,'uncertain')
 const before=await jobFor(normal.id),quota=await usedAt(due),event=makeEvent(normal.people[0].email,before.providerCampaignId!)
 const results=await Promise.all([ingest(event),ingest({...event,webhookId:124})]);assert.equal(results.filter(r=>r.state==='processed').length,1);assert.equal(results.filter(r=>r.state==='duplicate').length,1)
 const after=await jobFor(normal.id);assert.equal(after.state,'observed');assert.deepEqual(after.history,before.history);assert.equal(after.responseCode,null);assert.equal(await usedAt(due),quota)
 assert.equal((await receiptFor(after.id)).deliveredAt,event.occurredAt)
 const envelope=await rowFor(after.providerCampaignId!);assert.equal(JSON.stringify(envelope).includes('@example.invalid'),false);assert.equal(envelope.state,'processed')
 assert.equal((await run(normal.id,due,{retryRejected:true})).state,'observed');assert.equal(sends.get(normal.name),1)
 checks.push('Migração vazia down/up revertida; notificações concorrentes com IDs de webhook distintos deduplicam uma entrega, sem fabricar 204, mexer na quota ou permitir reenvio.')
 const contactBefore=await payload.findByID({collection:'contacts',id:normal.people[0].id,depth:0,overrideAccess:true})
 await ingest(makeEvent(normal.people[0].email,after.providerCampaignId!,'soft_bounce',5));assert.deepEqual(await payload.findByID({collection:'contacts',id:contactBefore.id,depth:0,overrideAccess:true}),contactBefore)
 let receipt=await receiptFor(after.id);assert.ok(receipt.deliveredAt);assert.ok(receipt.softBouncedAt)
 checks.push('Devolução temporária não retira consentimento; resultados fora de ordem preservam entrega e devolução separadamente.')
 const withdrawn=await group('withdrawn');await run(withdrawn.id);const withdrawJob=await jobFor(withdrawn.id)
 const sampleBefore=(await payload.find({collection:'email-deliveries',where:{and:[{contact:{equals:withdrawn.people[0].id}},{kind:{equals:'delivery'}}]},depth:0,overrideAccess:true})).docs[0]
 assert.ok(sampleBefore)
 const withdrawEvent=makeEvent(withdrawn.people[0].email,withdrawJob.providerCampaignId!,'unsubscribe')
 assert.equal((await ingest(withdrawEvent)).state,'processed')
 const person=await payload.findByID({collection:'contacts',id:withdrawn.people[0].id,depth:0,overrideAccess:true});assert.ok(person.globalSuppressedAt);assert.equal(person.deliveryState,'ok')
 assert.equal((await payload.findByID({collection:'email-deliveries',id:sampleBefore.id,overrideAccess:true})).state,sampleBefore.state)
 assert.equal((await payload.find({collection:'subscriptions',where:{contact:{equals:person.id}},overrideAccess:true})).docs.every(x=>x.state==='unsubscribed'),true)
 assert.ok((await payload.find({collection:'brevo-suppressions',where:{contact:{equals:person.id}},overrideAccess:true})).docs.length)
 const auditBefore=(await payload.count({collection:'consent-events',where:{contact:{equals:person.id}},overrideAccess:true})).totalDocs
 assert.equal((await replayBrevoWebhook(payload,(await rowFor(withdrawJob.providerCampaignId!,'unsubscribe')).id,config,due+90_000)).state,'duplicate');assert.equal((await payload.count({collection:'consent-events',where:{contact:{equals:person.id}},overrideAccess:true})).totalDocs,auditBefore)
 checks.push('Cancelamento autenticado retira marketing e agenda bloqueio no mesmo commit, preservando amostra solicitada; replay não duplica auditoria.')
 await ingest(makeEvent(normal.people[0].email,after.providerCampaignId!,'hard_bounce',20))
 assert.equal((await payload.findByID({collection:'contacts',id:contactBefore.id,overrideAccess:true})).deliveryState,'bounced')
 await ingest(makeEvent(normal.people[0].email,after.providerCampaignId!,'spam',30))
 assert.equal((await payload.findByID({collection:'contacts',id:contactBefore.id,overrideAccess:true})).deliveryState,'complaint')
 await ingest(makeEvent(normal.people[0].email,after.providerCampaignId!,'delivered',40))
 assert.equal((await payload.findByID({collection:'contacts',id:contactBefore.id,overrideAccess:true})).deliveryState,'complaint')
 receipt=await receiptFor(after.id);assert.equal(receipt.deliveredAt,event.occurredAt);assert.ok(receipt.hardBouncedAt);assert.ok(receipt.spamAt)
 checks.push('Hard bounce/reclamação tornam bloqueio mais restritivo, cancelam entregas pendentes e nunca são apagados por entrega tardia; datas de ocorrências são preservadas.')
 const unknownEmail='unknown-webhook@example.invalid',unknown=makeEvent(unknownEmail,999999)
 const count=(await payload.count({collection:'contacts',overrideAccess:true})).totalDocs
 assert.equal((await ingest(unknown)).state,'quarantined');assert.equal((await payload.count({collection:'contacts',overrideAccess:true})).totalDocs,count)
 const unknownRow=await rowFor(999999);assert.equal(unknownRow.reason,'unknown_contact');assert.equal(JSON.stringify(unknownRow).includes(unknownEmail),false)
 await payload.create({collection:'contacts',data:{email:unknownEmail,deliveryState:'ok'},overrideAccess:true})
 assert.equal((await replayBrevoWebhook(payload,unknownRow.id,config,due+90_000)).state,'quarantined');assert.equal((await payload.findByID({collection:'brevo-webhook-events',id:unknownRow.id,overrideAccess:true})).reason,'unknown_contact')
 const foreign=await group('foreign');assert.equal((await ingest(makeEvent(foreign.people[0].email,999998,'unsubscribe'))).state,'quarantined');assert.ok((await payload.findByID({collection:'contacts',id:foreign.people[0].id,overrideAccess:true})).globalSuppressedAt)
 checks.push('Desconhecidos ficam em quarentena sem criar contatos ou guardar endereço; replay não associa contato criado depois. Retirada válida de contato conhecido vale mesmo em campanha não mapeada.')
 const outsider=await group('outsider');assert.equal((await ingest(makeEvent(outsider.people[0].email,after.providerCampaignId!))).state,'quarantined')
 const outsiderRows=await payload.find({collection:'brevo-webhook-events',where:{contact:{equals:outsider.people[0].id}},overrideAccess:true});assert.equal(outsiderRows.docs[0].reason,'recipient_mismatch')
 const old=makeEvent(outsider.people[0].email,after.providerCampaignId!);old.sentAt=new Date(due-10000).toISOString();old.occurredAt=new Date(due-5000).toISOString();await ingest(old)
 assert.equal((await payload.find({collection:'brevo-webhook-events',where:{and:[{contact:{equals:outsider.people[0].id}},{reason:{equals:'emission_mismatch'}}]},overrideAccess:true})).docs.length,1)
 checks.push('Campanha própria exige destinatário do conjunto e tempo compatível com intenção; payload antigo ou contato externo não cria comprovante local.')
 const rollback=await group('rollback');await run(rollback.id);const rollbackJob=await jobFor(rollback.id)
 const hooks=payload.collections['brevo-webhook-events'].config.hooks,previous=hooks.afterChange
 hooks.afterChange=[...previous,async({doc})=>{if(doc.state==='processed')throw new Error('synthetic webhook rollback')}]
 const rollbackEvent=makeEvent(rollback.people[0].email,rollbackJob.providerCampaignId!,'spam')
 try{await assert.rejects(ingest(rollbackEvent),/synthetic webhook rollback/)}finally{hooks.afterChange=previous}
 assert.equal((await payload.findByID({collection:'contacts',id:rollback.people[0].id,overrideAccess:true})).deliveryState,'ok');assert.equal(await receiptFor(rollbackJob.id),undefined);assert.equal(await rowFor(rollbackJob.providerCampaignId!,'spam'),undefined)
 assert.equal((await ingest(rollbackEvent)).state,'processed')
 checks.push('Falha de commit reverte envelope, supressão e comprovante juntos; nova notificação conclui sem efeito parcial.')
 const race=await group('retry-race');modes.set(race.name,'reject');assert.equal((await run(race.id)).state,'rejected');const raceJob=await jobFor(race.id),beforeRace=await usedAt(due)
 modes.set(race.name,'hold-verify');let unlock!:()=>void;const gate=new Promise<void>(r=>{entered=r});release=new Promise<void>(r=>{unlock=r})
 const retry=run(race.id,due,{retryRejected:true});await gate
 assert.equal((await ingest(makeEvent(race.people[0].email,raceJob.providerCampaignId!))).state,'processed');unlock();assert.equal((await retry).state,'held')
 assert.equal((await jobFor(race.id)).state,'observed');assert.equal(sends.get(race.name),1);assert.equal(await usedAt(due),beforeRace)
 checks.push('Notificação durante preparação de retry revoga lease e impede que callback posterior rearme ou emita outra campanha.')
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);await downWebhooks({db:(payload.db as unknown as PostgresAdapter).sessions[id].db,payload,req})}),/Downgrade recusado/)
 await assert.rejects(payload.update({collection:'brevo-webhook-events',id:envelope.id,data:{state:'pending'},overrideAccess:false,user:{...seed.owner,collection:'admin-users'}}))
 await assert.rejects(payload.update({collection:'brevo-delivery-receipts',id:(await receiptFor(after.id)).id,data:{providerCampaignId:1},overrideAccess:false,user:{...seed.owner,collection:'admin-users'}}))
 const temp=await mkdtemp(path.join(tmpdir(),'bibliotheon-webhook-cli-'))
 try{
  const bootstrap=path.join(temp,'network.mjs');await writeFile(bootstrap,`import assert from 'node:assert/strict';let calls=0;process.on('exit',()=>assert.equal(calls,0));globalThis.fetch=async()=>{calls++;throw new Error('No network')};`)
  const output=execFileSync(process.execPath,['--env-file-if-exists=.env.local','--import',bootstrap,'.release/replay-brevo-webhook.js',unknownRow.id],{env:{...envEnabled,BREVO_WEBHOOK_ENABLED:'true',BREVO_WEBHOOK_TOKEN:config.token,BREVO_WEBHOOK_EVENT_SECRET:config.eventSecret,LEAD_TOKEN_SECRET:secret},encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30_000})
  assert.equal(JSON.parse(output.trim().split('\n').at(-1)!).state,'quarantined')
 }finally{await rm(temp,{recursive:true,force:true})}
 checks.push('Downgrade não apaga envelopes/resultados; owner não forja coleções; replay empacotado usa apenas envelope mínimo sem rede.')
 const deferred=await group('deferred'),expectedId=1000+remote.size
 assert.equal((await ingest(makeEvent(deferred.people[0].email,expectedId))).state,'quarantined')
 const deferredRow=await rowFor(expectedId);assert.equal(deferredRow.reason,'unknown_campaign')
 await run(deferred.id);assert.equal((await jobFor(deferred.id)).providerCampaignId,expectedId)
 assert.equal((await replayBrevoWebhook(payload,deferredRow.id,config,due+120_000)).state,'processed');assert.ok((await receiptFor((await jobFor(deferred.id)).id)).deliveredAt)
 checks.push('Replay explícito reconcilia envelope com contato já conhecido quando o manifesto local compatível se torna disponível, sem repetir transporte ou supressão.')
 const changed=await group('changed-address');await run(changed.id);const changedJob=await jobFor(changed.id)
 const newEmail='changed-address@example.invalid';await payload.update({collection:'contacts',id:changed.people[0].id,data:{email:newEmail},overrideAccess:true})
 assert.equal((await ingest(makeEvent(newEmail,changedJob.providerCampaignId!))).state,'quarantined');assert.equal(await receiptFor(changedJob.id),undefined)
 assert.equal((await rowFor(changedJob.providerCampaignId!)).reason,'recipient_mismatch')
 const legacy=await group('legacy');await run(legacy.id);const legacyJob=await jobFor(legacy.id)
 await payload.update({collection:'brevo-campaign-sends',id:legacyJob.id,data:{recipientIdentities:null},overrideAccess:true})
 assert.equal((await ingest(makeEvent(legacy.people[0].email,legacyJob.providerCampaignId!))).state,'quarantined')
 assert.equal((await ingest(makeEvent(legacy.people[0].email,legacyJob.providerCampaignId!,'hard_bounce'))).state,'quarantined')
 assert.equal((await payload.findByID({collection:'contacts',id:legacy.people[0].id,overrideAccess:true})).deliveryState,'bounced');assert.equal(await receiptFor(legacyJob.id),undefined)
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);await downIdentities({db:(payload.db as unknown as PostgresAdapter).sessions[id].db,payload,req})}),/Downgrade recusado/)
 checks.push('Identidade HMAC capturada antes do POST recusa endereço alterado; legado sem prova fica em quarentena sem inventar backfill, preservando supressão negativa e guard de downgrade.')


}finally{await seed.cleanup()}
await mkdir('artifacts/brevo-webhook',{recursive:true})
await writeFile('artifacts/brevo-webhook/local-results.json',JSON.stringify({date:new Date().toISOString(),timezone:'America/Belem',environment:'PostgreSQL loopback; eventos totalmente sintéticos; Brevo HTTP interceptado; CLI sem rede',checks,externalCalls:false,realMessagesSent:0,limits:'Delivered é notificação do provedor, sem comprovar leitura/compra. Sem conta real, autenticação real homologada, GitHub ou VPS.'},null,2)+'\n')
console.log(`Webhook Brevo: ${checks.length} grupos aprovados; nenhum evento real.`)
process.exit(0)
