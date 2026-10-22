import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir,writeFile,mkdtemp,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { seedRelationship } from '../fixtures/relationship'
import { requestMagnet,confirmMagnet,unsubscribe } from '../../src/modules/marketing/service'
import { processDelivery } from '../../src/modules/marketing/delivery'
import { CONSENT_VERSION } from '../../src/modules/marketing/validation'
import { preparePromotionBatches } from '../../src/modules/marketing/batches'
import { prepareBrevoBatchCampaign } from '../../src/modules/marketing/batch-campaigns'
import { dispatchBrevoBatchCampaign } from '../../src/modules/marketing/campaign-send'
import { quotaWindow } from '../../src/modules/marketing/quota-policy'
import { createBrevoCampaigns } from '../../src/integrations/brevo/campaigns'
import { createBrevoCampaignDispatch } from '../../src/integrations/brevo/campaign-dispatch'
import type { BrevoLists } from '../../src/integrations/brevo/lists'
import type { BrevoContacts } from '../../src/integrations/brevo/contacts'
import type { BrevoPreferences } from '../../src/integrations/brevo/preferences'
import { atomic } from '../../src/modules/marketing/transaction'
import { up,down } from '../../migrations/20261022_123536_brevo_campaign_sends'

const seed=await seedRelationship(),{payload,magnet}=seed
const secret=randomBytes(32).toString('hex'),origin='http://127.0.0.1:3001',start=Date.now(),due=start+2*86_400_000,checks:string[]=[]
const peopleIds=new Map<string,number>(),links=new Map<string,string>()
const directory:BrevoContacts={inspect:async email=>{if(!peopleIds.has(email))peopleIds.set(email,peopleIds.size+1);return{state:'found',id:peopleIds.get(email)!,blocked:false}},block:async()=>{throw new Error('No network block')}}
const preferences:BrevoPreferences={ensure:async(_id,email,url)=>{links.set(email,url);return{state:'verified'}}}
const listRows=new Map<number,{id:number;name:string;folderId:number;ids:number[]}>()
const lists:BrevoLists={folderId:10,find:async name=>{const row=[...listRows.values()].find(item=>item.name===name);return row?{state:'found',id:row.id}:{state:'absent'}},create:async name=>{const id=100+listRows.size;listRows.set(id,{id,name,folderId:10,ids:[]});return{state:'created',id}},details:async id=>{const item=listRows.get(id);return item?{state:'found',list:{id,name:item.name,folderId:10}}:{state:'absent'}},members:async id=>{const row=listRows.get(id);return row?{state:'members',contacts:row.ids.map(id=>({id,blocked:false,unsubscribed:false}))}:{state:'absent'}},add:async(id,ids)=>{listRows.get(id)!.ids.push(...ids);return{state:'acknowledged'}}}
type Campaign={id:number;body:Record<string,unknown>;status:string}
const remote=new Map<number,Campaign>(),modes=new Map<string,string>(),sends=new Map<string,number>(),peopleByBatch=new Map<string,string[]>()
let entered:(()=>void)|undefined,release:Promise<void>|undefined,remoteCalls=0
function report(row:Campaign){const b=row.body;return{id:row.id,...b,status:row.status,recipients:{lists:(b.recipients as {listIds:number[]}).listIds,exclusionLists:[]}}}
const transport:typeof fetch=async(input,options)=>{
 const url=new URL(String(input));assert.equal(url.origin,'https://api.brevo.com');remoteCalls++
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
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=(payload.db as unknown as PostgresAdapter).sessions[id].db;await down({db,payload,req});await up({db,payload,req});throw new Error('synthetic rollback')}),/synthetic rollback/)
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
 const normal=await group('normal',2),initial=await usedAt(due)
 assert.deepEqual(await dispatchBrevoBatchCampaign(payload,normal.id,{dispatch:null}),{state:'disabled'})
 assert.equal((await payload.count({collection:'brevo-campaign-sends',overrideAccess:true})).totalDocs,0)
 const results=await Promise.all([run(normal.id),run(normal.id)])
 assert.equal(results.filter(result=>result.state==='submitted').length,1);assert.equal(sends.get(normal.name),1)
 let normalJob=await jobFor(normal.id);assert.equal(normalJob.attempts,1);assert.equal(normalJob.responseCode,204);assert.equal(await usedAt(due),initial+2)
 assert.equal(JSON.stringify(normalJob).includes('@example.invalid'),false);assert.equal(JSON.stringify(normalJob).includes('?t='),false)
 const snapshot=remoteCalls;assert.equal((await run(normal.id)).state,'submitted');assert.equal(remoteCalls,snapshot)
 checks.push('Migração vazia revertida; desativação sem intenção. Concorrência emite um POST e reserva dois destinatários uma vez; 204 registra solicitação, não entrega; repetição não consulta nem reenvia.')

 const rollback=await group('rollback'),beforeRollback=await usedAt(due),hooks=payload.collections['brevo-campaign-sends'].config.hooks,previous=hooks.afterChange
 hooks.afterChange=[...previous,async({doc})=>{if(doc.state==='issuing')throw new Error('synthetic rollback before wire')}]
 try{assert.equal((await run(rollback.id)).state,'held')}finally{hooks.afterChange=previous}
 const rollbackJob=await jobFor(rollback.id);assert.equal(rollbackJob.attempts,0);assert.deepEqual(rollbackJob.history,[]);assert.equal(await usedAt(due),beforeRollback);assert.equal(sends.get(rollback.name),undefined)
 assert.equal((await payload.findByID({collection:'email-campaign-batches',id:rollback.id,overrideAccess:true})).state,'prepared')
 assert.equal((await run(rollback.id,due+60_001)).state,'submitted');assert.equal(sends.get(rollback.name),1)
 checks.push('Falha ao gravar intenção de emissão reverte quota/lote/etapas antes do POST; retomada prepara novamente e cobra somente a tentativa efetiva.')

 const quota=await group('quota'),beforeQuota=await usedAt(due)
 assert.equal((await run(quota.id,due,{policy:{limit:1,transactionalReserve:1}})).state,'quota');assert.equal(sends.get(quota.name),undefined);assert.equal((await jobFor(quota.id)).attempts,0);assert.equal(await usedAt(due),beforeQuota)
 const next=Date.parse(quotaWindow(due).nextDayAt)+1,beforeNext=await usedAt(next)
 assert.equal((await run(quota.id,next)).state,'submitted');assert.equal(await usedAt(next),beforeNext+1)
 const quotaJob=await jobFor(quota.id);assert.equal((quotaJob.history as {quotaDay:string}[])[0].quotaDay,quotaWindow(next).day)
 checks.push('Reserva transacional não é consumida por promoções; quota insuficiente não emite POST e a passagem UTC cobra a nova janela correta.')

 const lost=await group('lost'),beforeLost=await usedAt(due);modes.set(lost.name,'lost')
 assert.equal((await run(lost.id)).state,'uncertain');const lostCalls=remoteCalls
 assert.equal((await run(lost.id,due+60_000,{retryRejected:true})).state,'uncertain');assert.equal(remoteCalls,lostCalls);assert.equal(sends.get(lost.name),1);assert.equal(await usedAt(due),beforeLost+1)
 checks.push('Resposta perdida após aceitação mantém quota e estado incerto; nem retry explícito de recusas repete ou consulta essa tentativa.')

 const rejected=await group('rejected'),beforeRejected=await usedAt(due);modes.set(rejected.name,'reject')
 assert.equal((await run(rejected.id)).state,'rejected');assert.equal((await run(rejected.id)).state,'rejected');assert.equal(sends.get(rejected.name),1)
 modes.delete(rejected.name);assert.equal((await run(rejected.id,due+1,{retryRejected:true})).state,'submitted')
 const retried=await jobFor(rejected.id);assert.equal(retried.attempts,2);assert.equal((retried.history as {state:string}[])[0].state,'rejected');assert.equal(await usedAt(due),beforeRejected+2)
 checks.push('402 é recusa confirmada; nova tentativa exige ação explícita e pré-requisitos frescos, com outra reserva conservadora e histórico anterior preservado.')

 const withdrawn=await group('withdrawn'),beforeWithdraw=await usedAt(due);modes.set(withdrawn.name,'withdraw-before-claim')
 assert.equal((await run(withdrawn.id)).state,'canceled');assert.equal(sends.get(withdrawn.name),undefined);assert.equal(await usedAt(due),beforeWithdraw)
 const retryWithdrawn=await group('retry-withdrawn');modes.set(retryWithdrawn.name,'reject');assert.equal((await run(retryWithdrawn.id)).state,'rejected')
 await unsubscribe(payload,new URL(links.get(retryWithdrawn.people[0].email)!).searchParams.get('t'),due+1)
 const beforeRetryWithdraw=await usedAt(due);assert.equal((await run(retryWithdrawn.id,due+2,{retryRejected:true})).state,'canceled');assert.equal(sends.get(retryWithdrawn.name),1);assert.equal(await usedAt(due),beforeRetryWithdraw)
 checks.push('Descadastro antes da reserva impede disparo; retirada após recusa cancela etapas e torna retry inelegível sem reativar calendário ou consentimento.')

 const inflight=await group('inflight');modes.set(inflight.name,'inflight')
 let unlock!:()=>void;const gate=new Promise<void>(resolve=>{entered=resolve});release=new Promise(resolve=>{unlock=resolve})
 const pending=run(inflight.id);await gate
 assert.equal((await jobFor(inflight.id)).state,'issuing')
 await unsubscribe(payload,new URL(links.get(inflight.people[0].email)!).searchParams.get('t'),due+1);unlock()
 assert.equal((await pending).state,'submitted');assert.ok((await payload.findByID({collection:'contacts',id:inflight.people[0].id,overrideAccess:true})).globalSuppressedAt)
 checks.push('Retirada após intenção/POST em voo não promete recall: supressão permanece e aceitação tardia do pedido não é marcada como entrega individual.')

 const abandoned=await group('abandoned');modes.set(abandoned.name,'abandoned')
 let time=due,unlockAbandoned!:()=>void;const abandonedGate=new Promise<void>(resolve=>{entered=resolve});release=new Promise(resolve=>{unlockAbandoned=resolve})
 const abandonedCall=run(abandoned.id,due,{clock:()=>time});await abandonedGate;const usedBeforeRecovery=await usedAt(due)
 time+=30*60_000+1
 assert.equal((await run(abandoned.id,time)).state,'uncertain');assert.equal(sends.get(abandoned.name),1);assert.equal(await usedAt(due),usedBeforeRecovery)
 unlockAbandoned();assert.equal((await abandonedCall).state,'submitted');assert.equal((await jobFor(abandoned.id)).attempts,1)
 checks.push('Intenção emitida abandonada vira incerta, sem novo POST/quota; resposta tardia da mesma tentativa pode confirmar solicitação sem duplicá-la.')

 const settlement=await group('settlement');hooks.afterChange=[...previous,async({doc})=>{if(doc.state==='submitted')throw new Error('synthetic lost settlement')}]
 try{await assert.rejects(run(settlement.id),/synthetic lost settlement/)}finally{hooks.afterChange=previous}
 assert.equal((await jobFor(settlement.id)).state,'issuing');assert.equal(sends.get(settlement.name),1)
 assert.equal((await run(settlement.id,due+30*60_000+1)).state,'uncertain');assert.equal(sends.get(settlement.name),1)
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);await down({db:(payload.db as unknown as PostgresAdapter).sessions[id].db,payload,req})}),/Downgrade recusado/)
 await assert.rejects(payload.update({collection:'brevo-campaign-sends',id:normalJob.id,data:{state:'submitted'},overrideAccess:false,user:{...seed.owner,collection:'admin-users'}}))
 checks.push('Falha de liquidação após HTTP preserva intenção emitida e orçamento para reconciliação; downgrade e API owner não apagam/forjam tentativas.')

 const packed=await group('packed');assert.equal((await prepareBrevoBatchCampaign(payload,packed.id,{...settings,now:due})).state,'ready')
 const draft=(await payload.find({collection:'brevo-campaign-drafts',where:{batch:{equals:packed.id}},depth:0,overrideAccess:true})).docs[0]
 const list=listRows.get((draft.content as {listId:number}).listId)!,temporary=await mkdtemp(path.join(tmpdir(),'bibliotheon-send-cli-'))
 try{
  const bootstrap=path.join(temporary,'http.mjs')
  await writeFile(bootstrap,`import assert from 'node:assert/strict';Date.now=()=>Number(process.env.SYNTHETIC_NOW);const source=JSON.parse(process.env.SYNTHETIC_STATE);let sends=0;process.on('exit',()=>assert.equal(sends,1));globalThis.fetch=async(input,options)=>{const url=new URL(String(input));assert.equal(url.origin,'https://api.brevo.com');if(url.pathname.endsWith('/sendNow')){assert.equal(options.method,'POST');sends++;return new Response(null,{status:204})}assert.equal(options.method,'GET');if(url.pathname==='/v3/contacts/attributes')return Response.json({attributes:[{name:'BIBLIOTHEON_PREFERENCES',category:'normal',type:'text'}]});if(url.pathname.endsWith('/contacts')&&url.pathname.includes('/lists/'))return Response.json({count:source.list.ids.length,contacts:source.list.ids.map(id=>({id,emailBlacklisted:false,listUnsubscribed:[]}))});if(url.pathname.startsWith('/v3/contacts/lists/'))return Response.json({id:source.list.id,name:source.list.name,folderId:10});if(url.pathname.startsWith('/v3/emailCampaigns/'))return Response.json(source.campaign);const identifier=decodeURIComponent(url.pathname.split('/').at(-1)),person=source.people.find(p=>p.email===identifier||String(p.id)===identifier);assert.ok(person);return Response.json({id:person.id,email:person.email,emailBlacklisted:false,attributes:{BIBLIOTHEON_PREFERENCES:person.url}})};`)
  const state={list,campaign:report(remote.get(draft.providerCampaignId!)!),people:packed.people.map(person=>({email:person.email,id:peopleIds.get(person.email),url:links.get(person.email)}))}
  const output=execFileSync(process.execPath,['--env-file-if-exists=.env.local','--import',bootstrap,'.release/send-brevo-campaign.js',packed.id],{env:{...envEnabled,SYNTHETIC_STATE:JSON.stringify(state),SYNTHETIC_NOW:String(due)},encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30_000})
  assert.deepEqual(JSON.parse(output.trim().split('\n').at(-1)!),{state:'submitted'});assert.equal((await jobFor(packed.id)).attempts,1)
 }finally{await rm(temporary,{recursive:true,force:true})}
 checks.push('CLI empacotado habilitado solicita exatamente um disparo sintético e persiste tentativa/quota; cada requisição externa foi interceptada.')
}finally{await seed.cleanup()}
// Own fixture has ended. Empty operational queue allows a real --once worker check with all fetch blocked.
const temporary=await mkdtemp(path.join(tmpdir(),'bibliotheon-send-worker-'))
try{
 const bootstrap=path.join(temporary,'http.mjs')
 await writeFile(bootstrap,`import assert from 'node:assert/strict';let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Network disabled in synthetic worker')};process.on('exit',()=>assert.equal(calls,0));`)
 execFileSync(process.execPath,['--env-file-if-exists=.env.local','--import',bootstrap,'.release/worker.js','--once'],{env:envEnabled,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30_000})
 checks.push('Worker --once empacotado com promoção habilitada e fila vazia termina sem rede; fixtures limpas antes da execução.')
}finally{await rm(temporary,{recursive:true,force:true})}
await mkdir('artifacts/brevo-send',{recursive:true})
await writeFile('artifacts/brevo-send/local-results.json',JSON.stringify({date:'2026-10-22 America/Belem',environment:'PostgreSQL loopback; HTTP sintético; CLI/worker empacotados interceptados',checks,externalCalls:false,realMessagesSent:0,limits:'204 é solicitação aceita/agendada, sem comprovar entrega. Sem API/conta real; homologação e webhook/observação/conciliação completos continuam pendentes.'},null,2)+'\n')
console.log(`Transporte promocional: ${checks.length} grupos aprovados; nenhuma chamada real ou mensagem.`)
process.exit(0)
