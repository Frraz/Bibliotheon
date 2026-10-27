import {up as upIdentities,down as downIdentities} from '../../migrations/20261024_071409_brevo_send_recipients'
import {up as upWebhooks,down as downWebhooks} from '../../migrations/20261024_070440_brevo_webhook_events'
import {up as upObservations,down as downObservations} from '../../migrations/20261024_064354_brevo_campaign_observations'
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
import { createBrevoCampaigns,type BrevoCampaigns } from '../../src/integrations/brevo/campaigns'
import type { BrevoLists } from '../../src/integrations/brevo/lists'
import type { BrevoContacts } from '../../src/integrations/brevo/contacts'
import type { BrevoPreferences } from '../../src/integrations/brevo/preferences'
import { atomic } from '../../src/modules/marketing/transaction'
import { up,down } from '../../migrations/20261022_120651_brevo_campaign_drafts'
import { up as upSends, down as downSends } from '../../migrations/20261022_123536_brevo_campaign_sends'

const seed=await seedRelationship(),{payload,magnet}=seed
const secret=randomBytes(32).toString('hex'),origin='http://127.0.0.1:3001',start=Date.now(),due=start+2*86_400_000,checks:string[]=[]
const peopleIds=new Map<string,number>(),links=new Map<string,string>()
const directory:BrevoContacts={inspect:async email=>{if(!peopleIds.has(email))peopleIds.set(email,peopleIds.size+1);return{state:'found',id:peopleIds.get(email)!,blocked:false}},block:async()=>{throw new Error('No network block')}}
const preferences:BrevoPreferences={ensure:async(_id,email,url)=>{links.set(email,url);return{state:'verified'}}}
const listRows=new Map<number,{id:number;name:string;folderId:number;ids:number[]}>()
const lists:BrevoLists={folderId:10,find:async name=>{const row=[...listRows.values()].find(item=>item.name===name);return row?{state:'found',id:row.id}:{state:'absent'}},create:async name=>{const id=100+listRows.size;listRows.set(id,{id,name,folderId:10,ids:[]});return{state:'created',id}},details:async id=>{const item=listRows.get(id);return item?{state:'found',list:{id,name:item.name,folderId:10}}:{state:'absent'}},members:async id=>{const row=listRows.get(id);return row?{state:'members',contacts:row.ids.map(id=>({id,blocked:false,unsubscribed:false}))}:{state:'absent'}},add:async(id,ids)=>{listRows.get(id)!.ids.push(...ids);return{state:'acknowledged'}}}
type Campaign={id:number;body:Record<string,unknown>}
const remote=new Map<number,Campaign>(),modes=new Map<string,string>(),creates=new Map<string,number>()
let entered:(()=>void)|undefined,release:Promise<void>|undefined
function report(row:Campaign){const b=row.body;return{id:row.id,...b,status:'draft',recipients:{lists:(b.recipients as {listIds:number[]}).listIds,exclusionLists:[]},...(modes.get(String(b.name))==='changed'?{subject:'Alteração externa'}:{}),...(modes.get(String(b.name))==='sent'?{status:'sent'}:{})}}
const transport:typeof fetch=async(input,options)=>{
 const url=new URL(String(input));assert.equal(url.origin,'https://api.brevo.com')
 if(url.pathname==='/v3/emailCampaigns'&&options?.method==='POST'){
  const body=JSON.parse(String(options.body)),name=String(body.name),mode=modes.get(name);creates.set(name,(creates.get(name)||0)+1)
  assert.equal(body.scheduledAt,undefined);assert.equal(body.type,'classic');assert.equal(body.sendAtBestTime,false)
  if(mode==='collision')return Response.json({id:1000},{status:201})
  if(mode==='reject')return new Response(null,{status:400})
  const row={id:1000+remote.size,body};remote.set(row.id,row)
  if(mode==='withdraw'||mode==='lease'){entered?.();await release}
  if(mode==='lost'||mode==='lost-absent'){if(mode==='lost-absent')remote.delete(row.id);throw new Error('synthetic timeout')}
  return Response.json({id:row.id},{status:201})
 }
 assert.equal(options?.method,'GET')
 if(url.pathname==='/v3/emailCampaigns'){const all=[...remote.values()],offset=Number(url.searchParams.get('offset'));return Response.json({count:all.length,campaigns:all.slice(offset,offset+50).map(row=>({id:row.id,name:row.body.name}))})}
 const id=Number(url.pathname.split('/').at(-1)),row=remote.get(id)
 if(!row)return new Response(null,{status:404})
 if(modes.get(String(row.body.name))==='metadata')return new Response(null,{status:503})
 return Response.json(report(row))
}
const campaigns=createBrevoCampaigns('synthetic',41,transport)
const run=(id:string,now=due,more:Partial<Parameters<typeof prepareBrevoBatchCampaign>[2]>={})=>prepareBrevoBatchCampaign(payload,id,{campaigns,lists,contacts:directory,preferences,secret,origin,now,...more})
const jobFor=async(batch:string)=>(await payload.find({collection:'brevo-campaign-drafts',where:{batch:{equals:batch}},limit:1,depth:0,overrideAccess:true})).docs[0]
let revision=1
try{
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=(payload.db as unknown as PostgresAdapter).sessions[id].db;await downIdentities({db,payload,req});await downWebhooks({db,payload,req});await downObservations({db,payload,req});await downSends({db,payload,req});await down({db,payload,req});await up({db,payload,req});await upSends({db,payload,req});await upObservations({db,payload,req});await upWebhooks({db,payload,req});await upIdentities({db,payload,req});throw new Error('synthetic rollback')}),/synthetic rollback/)
 const copy=Object.fromEntries([2,4,7,10].map(day=>[`day${day}`,{subject:`Campanha sintética ${day}`,text:`Conteúdo manual sintético ${day}.`}]))
 const sequence=await payload.create({collection:'email-sequences',...seed.auth,data:{name:'Rascunhos de campanhas sintéticas',key:'synthetic',magnet:magnet.id,magnetVersion:magnet.version,revision,offer:seed.offers[0].id,active:true,...copy}})
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
  const id=typeof delivery.batch==='string'?delivery.batch:delivery.batch!.id
  return{id,name:`bibliotheon-${id}`,people}
 }
 const normal=await group('normal',2)
 assert.deepEqual(await prepareBrevoBatchCampaign(payload,normal.id,{campaigns:null}),{state:'disabled'})
 const concurrency=await Promise.all([run(normal.id),run(normal.id)])
 assert.ok(concurrency.some(result=>result.state==='ready'));assert.ok(concurrency.every(result=>['ready','held'].includes(result.state)));assert.equal(creates.get(normal.name),1)
 const first=await jobFor(normal.id);assert.equal(first.state,'ready');assert.ok(first.providerCampaignId);assert.deepEqual(first.observedIds,[first.providerCampaignId])
 assert.equal((await run(normal.id)).state,'ready');assert.equal(creates.get(normal.name),1)
 assert.equal(JSON.stringify(first).includes('@example.invalid'),false);assert.equal(JSON.stringify(first).includes('?t='),false)
 checks.push('Migração vazia down/up revertida; desativação sem banco; concorrência cria um rascunho e retenção de ID/cópia sem tokens ou destinatários no manifesto.')

 const lost=await group('lost');modes.set(lost.name,'lost');assert.equal((await run(lost.id)).state,'uncertain');modes.delete(lost.name)
 assert.equal((await run(lost.id,due+900_001)).state,'ready');assert.equal(creates.get(lost.name),1)
 const absent=await group('absent');modes.set(absent.name,'lost-absent');assert.equal((await run(absent.id)).state,'uncertain');modes.delete(absent.name)
 assert.equal((await run(absent.id,due+900_001)).state,'uncertain');assert.equal(creates.get(absent.name),1)
 assert.equal((await run(absent.id,due+900_002,{adoptCampaignId:first.providerCampaignId!})).state,'failed')
 checks.push('Criação com resposta perdida reconcilia nome/ID sem outro POST; ausência posterior não autoriza recriar e ID estrangeiro não é adotado.')

 const metadata=await group('metadata');modes.set(metadata.name,'metadata');assert.equal((await run(metadata.id)).state,'uncertain')
 const retained=await jobFor(metadata.id);assert.ok(retained.providerCampaignId);assert.deepEqual(retained.observedIds,[retained.providerCampaignId]);modes.delete(metadata.name)
 assert.equal((await run(metadata.id,due+900_001)).state,'ready')
 modes.set(metadata.name,'changed');assert.equal((await run(metadata.id,due+900_002)).state,'failed');assert.equal(creates.get(metadata.name),1)
 checks.push('ID retornado é persistido antes de GET falhar; cópia alterada no provedor bloqueia sem PUT ou nova criação.')

 const collision=await group('collision');modes.set(collision.name,'collision')
 assert.equal((await run(collision.id)).state,'failed')
 const conflicted=await jobFor(collision.id);assert.equal(conflicted.providerCampaignId,null);assert.deepEqual(conflicted.observedIds,[first.providerCampaignId]);assert.equal(conflicted.errorCode,'campaign_conflict')
 checks.push('ID retornado já vinculado a outro lote é retido no inventário sem quebrar unicidade nem apropriar campanha alheia.')

 const rejected=await group('rejected');await assert.rejects(run(rejected.id,due,{retryRejected:true}),/Retentativa exige manifesto/);assert.equal(creates.get(rejected.name),undefined);modes.set(rejected.name,'reject');assert.equal((await run(rejected.id)).state,'failed');modes.delete(rejected.name)
 assert.equal((await run(rejected.id,due+900_001)).state,'failed');assert.equal(creates.get(rejected.name),1)
 assert.equal((await run(rejected.id,due+900_002,{retryRejected:true})).state,'ready');assert.equal(creates.get(rejected.name),2)
 checks.push('Recusa explícita permanece até retry privado; somente criação recusada sem ID pode renovar a intenção de POST.')

 const withdrawn=await group('withdrawn');modes.set(withdrawn.name,'withdraw')
 const gate=new Promise<void>(resolve=>{entered=resolve});let unlock!:()=>void;release=new Promise(resolve=>{unlock=resolve})
 const inflight=run(withdrawn.id);await gate
 await unsubscribe(payload,new URL(links.get(withdrawn.people[0].email)!).searchParams.get('t'),due, secret);unlock()
 assert.equal((await inflight).state,'canceled');const canceled=await jobFor(withdrawn.id);assert.equal(canceled.state,'canceled');assert.ok(canceled.providerCampaignId);assert.equal(canceled.verifiedAt,null)
 modes.delete(withdrawn.name)
 checks.push('Descadastro durante POST impede ready e conserva ID do rascunho órfão; nenhuma promoção é reservada/agendada/enviada.')

 const lease=await group('lease');modes.set(lease.name,'lease')
 const leaseGate=new Promise<void>(resolve=>{entered=resolve});let unlockLease!:()=>void;release=new Promise(resolve=>{unlockLease=resolve})
 const original=run(lease.id);await leaseGate
 assert.equal((await run(lease.id,due+30*60_000+1)).state,'ready');unlockLease();assert.equal((await original).state,'held')
 assert.equal((await jobFor(lease.id)).state,'ready');assert.equal(creates.get(lease.name),1);modes.delete(lease.name)
 const slow=await group('slow');let now=due
 const slowClient:BrevoCampaigns={...campaigns,verify:async(id,spec)=>{now+=300_001;return campaigns.verify(id,spec)}}
 assert.equal((await prepareBrevoBatchCampaign(payload,slow.id,{campaigns:slowClient,lists,contacts:directory,preferences,secret,origin,clock:()=>now})).state,'uncertain')
 checks.push('Lease expirado recupera rascunho pelo nome e resposta antiga não sobrescreve conclusão; GET/provas expirados não renovam validade.')

 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);await down({db:(payload.db as unknown as PostgresAdapter).sessions[id].db,payload,req})}),/Downgrade recusado/)
 await assert.rejects(payload.update({collection:'brevo-campaign-drafts',id:first.id,data:{state:'ready'},overrideAccess:false,user:{...seed.owner,collection:'admin-users'}}))
 const temporary=await mkdtemp(path.join(tmpdir(),'bibliotheon-campaign-cli-'))
 try{
  const bootstrap=path.join(temporary,'http.mjs')
  const listing=listRows.get((first.content as {listId:number}).listId)!
  await writeFile(bootstrap,`import assert from 'node:assert/strict';Date.now=()=>Number(process.env.SYNTHETIC_NOW);const source=JSON.parse(process.env.SYNTHETIC_STATE);globalThis.fetch=async(input,options)=>{const url=new URL(String(input));assert.equal(url.origin,'https://api.brevo.com');assert.equal(options.method,'GET');if(url.pathname==='/v3/contacts/attributes')return Response.json({attributes:[{name:'BIBLIOTHEON_PREFERENCES',category:'normal',type:'text'}]});if(url.pathname.endsWith('/contacts')&&url.pathname.includes('/lists/'))return Response.json({count:source.list.ids.length,contacts:source.list.ids.map(id=>({id,emailBlacklisted:false,listUnsubscribed:[]}))});if(url.pathname.startsWith('/v3/contacts/lists/'))return Response.json({id:source.list.id,name:source.list.name,folderId:10});if(url.pathname.startsWith('/v3/emailCampaigns/'))return Response.json(source.campaign);const identifier=decodeURIComponent(url.pathname.split('/').at(-1));const person=source.people.find(p=>p.email===identifier||String(p.id)===identifier);assert.ok(person);return Response.json({id:person.id,email:person.email,emailBlacklisted:false,attributes:{BIBLIOTHEON_PREFERENCES:person.url}})};`)
  const state={list:listing,campaign:report(remote.get(first.providerCampaignId!)!),people:normal.people.map(person=>({email:person.email,id:peopleIds.get(person.email),url:links.get(person.email)}))}
  const output=execFileSync(process.execPath,['--env-file-if-exists=.env.local','--import',bootstrap,'.release/prepare-brevo-campaign.js',normal.id],{env:{...process.env,SYNTHETIC_STATE:JSON.stringify(state),SYNTHETIC_NOW:String(due),BREVO_CONTACT_SYNC_ENABLED:'true',BREVO_LIST_SYNC_ENABLED:'true',BREVO_LIST_FOLDER_ID:'10',BREVO_PREFERENCE_SYNC_ENABLED:'true',BREVO_CAMPAIGN_SYNC_ENABLED:'true',BREVO_CAMPAIGN_SENDER_ID:'41',BREVO_API_KEY:'synthetic',LEAD_TOKEN_SECRET:secret,PUBLIC_SITE_URL:origin,EMAIL_TRANSPORT_ENABLED:'false'},encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30_000})
  assert.equal(JSON.parse(output.trim().split('\n').at(-1)!).state,'ready')
 }finally{await rm(temporary,{recursive:true,force:true})}
 assert.equal((await payload.count({collection:'email-campaign-batches',where:{state:{equals:'claimed'}},overrideAccess:true})).totalDocs,0)
 checks.push('Guard de downgrade e API owner protegem manifesto; CLI empacotado habilitado usa apenas HTTP sintético interceptado e não faz claim.')
 await mkdir('artifacts/brevo-campaigns',{recursive:true})
 await writeFile('artifacts/brevo-campaigns/local-results.json',JSON.stringify({date:'2026-10-22 America/Belem',environment:'PostgreSQL loopback; contratos HTTP sintéticos; CLI empacotado interceptado',checks,externalCalls:false,realMessagesSent:0,limits:'Rascunho ready não autoriza sendNow. Conta/remetente/HTML/placeholder e controles da campanha exigem homologação; sem teste de disparo, webhook ou resultados reais.'},null,2)+'\n')
 console.log(`Rascunhos Brevo: ${checks.length} grupos aprovados; nenhuma chamada real ou envio.`)
}finally{await seed.cleanup()}
process.exit(0)
