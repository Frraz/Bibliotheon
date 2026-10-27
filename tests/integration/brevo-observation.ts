import {up as upIdentities,down as downIdentities} from '../../migrations/20261024_071409_brevo_send_recipients'
import {up as upWebhooks,down as downWebhooks} from '../../migrations/20261024_070440_brevo_webhook_events'
import {up as upObservations,down as downObservations} from '../../migrations/20261024_064354_brevo_campaign_observations'
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
import {createBrevoCampaignObserver} from '../../src/integrations/brevo/campaign-observer'
import {observeBrevoCampaign,observePromotionCampaigns} from '../../src/modules/marketing/campaign-observation'

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
  row.status='queued'
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
  await unsubscribe(payload,new URL(links.get(email)!).searchParams.get('t'),due, secret)
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
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=(payload.db as unknown as PostgresAdapter).sessions[id].db;await downIdentities({db,payload,req});await downWebhooks({db,payload,req});await downObservations({db,payload,req});await upObservations({db,payload,req});await upWebhooks({db,payload,req});await upIdentities({db,payload,req});throw new Error('synthetic rollback')}),/synthetic rollback/)
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
 const remoteCallsForDriver=()=>[...sends.values()].reduce((sum,count)=>sum+count,0)
 const observer=createBrevoCampaignObserver('synthetic',transport)
 const observe=(id:string,refresh=true)=>observeBrevoCampaign(payload,id,{client:observer,now:due,refresh})
 const observationFor=async(send:string)=>(await payload.find({collection:'brevo-campaign-observations',where:{send:{equals:send}},depth:0,overrideAccess:true})).docs[0]
 assert.equal((await observeBrevoCampaign(null as never,'invalid',{client:null})).state,'disabled')
 const lost=await group('lost');modes.set(lost.name,'lost');assert.equal((await run(lost.id)).state,'uncertain')
 const before=await jobFor(lost.id),quota=await usedAt(due)
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=(payload.db as unknown as PostgresAdapter).sessions[id].db;await downObservations({db,payload,req});await upObservations({db,payload,req});const rows=await payload.find({collection:'brevo-campaign-observations',where:{send:{equals:before.id}},depth:0,overrideAccess:true,req});assert.equal(rows.docs.length,1);assert.equal(rows.docs[0].attemptToken,before.attemptToken);throw new Error('synthetic backfill rollback')}),/synthetic backfill rollback/)

 const results=await Promise.all([observe(lost.id),observe(lost.id)])
 assert.equal(results.filter(r=>r.state==='observed').length,1)
 const after=await jobFor(lost.id);assert.equal(after.state,'observed');assert.deepEqual(after.history,before.history);assert.equal(after.responseCode,null);assert.equal(await usedAt(due),quota)
 const proof=await observationFor(after.id);assert.equal(proof.lastStatus,'queued');assert.equal(proof.activityStatus,'queued');assert.ok(proof.activityObservedAt)
 assert.equal((await run(lost.id,due,{retryRejected:true})).state,'observed');assert.equal(sends.get(lost.name),1)
 checks.push('GET concorrente resolve atividade de campanha com POST incerto sem inventar 204, alterar histórico/quota ou autorizar reenvio.')
 remote.get(after.providerCampaignId!)!.status='sent'
 assert.equal((await observe(lost.id)).state,'observed');const sent=await observationFor(after.id);assert.ok(sent.sentObservedAt);assert.equal(sent.nextCheckAt,null)
 remote.get(after.providerCampaignId!)!.status='draft';assert.equal((await observe(lost.id)).state,'unresolved');assert.equal((await observationFor(after.id)).activityStatus,'sent');assert.equal((await jobFor(lost.id)).state,'observed')
 remote.get(after.providerCampaignId!)!.body.subject='foreign';assert.equal((await observe(lost.id)).state,'unresolved');assert.equal((await observationFor(after.id)).state,'conflict');assert.equal((await jobFor(lost.id)).state,'observed')
 checks.push('Atividade positiva é preservada após estado posterior regressivo ou conteúdo divergente; envio da campanha encerra polling sem afirmar entrega individual.')
 const rejected=await group('rejected');modes.set(rejected.name,'reject');assert.equal((await run(rejected.id)).state,'rejected')
 const rejectedJob=await jobFor(rejected.id),rejectedQuota=await usedAt(due)
 assert.equal((await observe(rejected.id)).state,'unresolved');assert.equal((await jobFor(rejected.id)).state,'rejected')
 let releaseRead!:()=>void,enteredRead!:()=>void
 const gate=new Promise<void>(r=>{enteredRead=r}),releaseGate=new Promise<void>(r=>{releaseRead=r})
 const pending=observeBrevoCampaign(payload,rejected.id,{now:due,refresh:true,client:{inspect:async()=>{enteredRead();await releaseGate;return{state:'report',status:'queued'}}}})
 await gate;assert.equal((await run(rejected.id,due,{retryRejected:true})).state,'held');releaseRead();assert.equal((await pending).state,'observed')
 assert.deepEqual((await jobFor(rejected.id)).history,rejectedJob.history);assert.equal(await usedAt(due),rejectedQuota)
 checks.push('Rascunho não prova aceitação ou ausência de envio; lease de consulta impede retry concorrente e prova observada preserva recusa HTTP histórica.')
 const withdrawn=await group('withdrawn');await run(withdrawn.id)
 await unsubscribe(payload,new URL(links.get(withdrawn.people[0].email)!).searchParams.get('t'),due, secret)
 const contact=await payload.findByID({collection:'contacts',id:withdrawn.people[0].id,depth:0,overrideAccess:true})
 assert.equal((await observe(withdrawn.id)).state,'observed');assert.deepEqual(await payload.findByID({collection:'contacts',id:contact.id,depth:0,overrideAccess:true}),contact)
 checks.push('Retirada de consentimento permanece intacta após observação de campanha já emitida; rotina não reinscreve contatos.')
 const inflight=await group('inflight');modes.set(inflight.name,'inflight')
 let releaseSend!:()=>void;const sendGate=new Promise<void>(r=>{entered=r});release=new Promise<void>(r=>{releaseSend=r})
 const sendPending=run(inflight.id);await sendGate;assert.equal((await observe(inflight.id)).state,'observed');releaseSend();assert.equal((await sendPending).state,'observed');assert.equal((await jobFor(inflight.id)).responseCode,204)
 checks.push('ACK HTTP tardio registra código real sem apagar prova observada; histórico e observação seguem separados.')
 const rollback=await group('rollback');await run(rollback.id)
 const hooks=payload.collections['brevo-campaign-observations'].config.hooks,previous=hooks.afterChange
 hooks.afterChange=[...previous,async({doc})=>{if(doc.state==='matched')throw new Error('synthetic observation rollback')}]
 try{await assert.rejects(observe(rollback.id),/synthetic observation rollback/)}finally{hooks.afterChange=previous}
 assert.equal((await jobFor(rollback.id)).state,'submitted');assert.equal((await observationFor((await jobFor(rollback.id)).id)).state,'processing')
 assert.equal((await observeBrevoCampaign(payload,rollback.id,{client:observer,now:due+31*60_000,refresh:true})).state,'observed')
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);await downObservations({db:(payload.db as unknown as PostgresAdapter).sessions[id].db,payload,req})}),/Downgrade recusado/)
 await assert.rejects(payload.update({collection:'brevo-campaign-observations',id:proof.id,data:{state:'matched'},overrideAccess:false,user:{...seed.owner,collection:'admin-users'}}))
 assert.equal((await observePromotionCampaigns(payload,{client:null})).state,'disabled')
 checks.push('Rollback pós-GET preserva emissão e lease recuperável; downgrade e API owner não removem nem forjam prova.')
 const temporary=await mkdtemp(path.join(tmpdir(),'bibliotheon-observe-cli-'))
 try{
  const bootstrap=path.join(temporary,'http.mjs'),row=remote.get((await jobFor(inflight.id)).providerCampaignId!)!
  await writeFile(bootstrap,`import assert from 'node:assert/strict';Date.now=()=>Number(process.env.SYNTHETIC_NOW);let calls=0;process.on('exit',()=>assert.equal(calls,1));globalThis.fetch=async(input,options)=>{assert.equal(options.method,'GET');assert.equal(new URL(String(input)).origin,'https://api.brevo.com');calls++;return Response.json(JSON.parse(process.env.SYNTHETIC_REPORT))};`)
  const output=execFileSync(process.execPath,['--env-file-if-exists=.env.local','--import',bootstrap,'.release/observe-brevo-campaign.js',inflight.id,'--refresh'],{env:{...envEnabled,BREVO_CAMPAIGN_OBSERVE_ENABLED:'true',BREVO_CAMPAIGN_SEND_ENABLED:'false',SYNTHETIC_NOW:String(due),SYNTHETIC_REPORT:JSON.stringify(report(row))},encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30_000})
  assert.equal(JSON.parse(output.trim().split('\n').at(-1)!).state,'observed')
 }finally{await rm(temporary,{recursive:true,force:true})}
 checks.push('CLI empacotado habilitado faz exatamente um GET interceptado, com envio desligado.')
 const driver=await group('driver');modes.set(driver.name,'lost');await run(driver.id)
 const callsBeforeDriver=remoteCallsForDriver()
 assert.deepEqual(await observePromotionCampaigns(payload,{client:observer,now:due,limit:1}),{state:'checked',examined:1})
 assert.equal((await jobFor(driver.id)).state,'observed');assert.equal(remoteCallsForDriver(),callsBeforeDriver)
 checks.push('Coordenador consulta lote vencido sem emitir outro POST; limit=1 respeitado na fila durável.')

}finally{await seed.cleanup()}
const temporary=await mkdtemp(path.join(tmpdir(),'bibliotheon-observe-worker-'))
try{
 const bootstrap=path.join(temporary,'http.mjs')
 await writeFile(bootstrap,`import assert from 'node:assert/strict';let calls=0;process.on('exit',()=>assert.equal(calls,0));globalThis.fetch=async()=>{calls++;throw new Error('Unexpected network')};`)
 const output=execFileSync(process.execPath,['--env-file-if-exists=.env.local','--import',bootstrap,'.release/worker.js','--once'],{env:{...envEnabled,BREVO_CAMPAIGN_OBSERVE_ENABLED:'true',BREVO_CAMPAIGN_SEND_ENABLED:'false',BREVO_CAMPAIGN_SYNC_ENABLED:'false',BREVO_CONTACT_SYNC_ENABLED:'false',BREVO_LIST_SYNC_ENABLED:'false',BREVO_PREFERENCE_SYNC_ENABLED:'false',LEAD_TOKEN_SECRET:'',EMAIL_TRANSPORT_ENABLED:'false'},encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30_000})
 assert.equal(output.includes('Ciclo operacional falhou'),false)
}finally{await rm(temporary,{recursive:true,force:true})}
checks.push('Worker somente observador funciona com fila vazia, SMTP/cadastro/envio desligados e sem chave de links; fixtures limpas.')
await mkdir('artifacts/brevo-observation',{recursive:true})
await writeFile('artifacts/brevo-observation/local-results.json',JSON.stringify({date:new Date().toISOString(),timezone:'America/Belem',environment:'PostgreSQL loopback; HTTP sintético interceptado; CLI/worker empacotados',checks,externalCalls:false,realMessagesSent:0,limits:'Atividade da campanha não comprova entrega individual ou autoria exclusiva do POST; sem conta real, webhook ou VPS.'},null,2)+'\n')
console.log(`Observação Brevo: ${checks.length} grupos aprovados; nenhuma chamada real.`)
process.exit(0)
