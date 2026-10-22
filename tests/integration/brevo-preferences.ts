import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { seedRelationship } from '../fixtures/relationship'
import { requestMagnet, confirmMagnet, unsubscribe } from '../../src/modules/marketing/service'
import { readPreferences } from '../../src/modules/marketing/preferences'
import { processDelivery } from '../../src/modules/marketing/delivery'
import { CONSENT_VERSION } from '../../src/modules/marketing/validation'
import { preparePromotionBatches } from '../../src/modules/marketing/batches'
import { prepareBrevoBatchPreferences } from '../../src/modules/marketing/batch-preferences'
import { readListSnapshot } from '../../src/modules/marketing/batch-list-copy'
import { issuePreferenceLink } from '../../src/modules/marketing/preference-links'
import { createBrevoPreferences, PREFERENCE_ATTRIBUTE } from '../../src/integrations/brevo/preferences'
import type { BrevoContacts } from '../../src/integrations/brevo/contacts'
import { atomic, serial } from '../../src/modules/marketing/transaction'
import { hashOpaqueToken, UNSUBSCRIBE_TTL } from '../../src/modules/marketing/tokens'
import { up, down } from '../../migrations/20261022_115043_brevo_preferences'

const seed = await seedRelationship(), { payload, magnet } = seed
const secret=randomBytes(32).toString('hex'), start=Date.now(), due=start+2*86_400_000, origin='http://127.0.0.1:3001', checks:string[]=[]
const identities=new Map<string,number>(), attributes=new Map<number,string>(), writes=new Map<number,number>()
const directory:BrevoContacts={ inspect:async email=>{if(!identities.has(email)) identities.set(email,identities.size+1);return {state:'found',id:identities.get(email)!,blocked:false}},block:async()=>{throw new Error('No external block')}}
let mode='normal', entered:(()=>void)|undefined, release:Promise<void>|undefined
const remote:typeof fetch=async(input,options)=>{
  const url=new URL(String(input))
  if(url.pathname==='/v3/contacts/attributes') return Response.json({attributes:[{name:PREFERENCE_ATTRIBUTE,category:'normal',type:'text'}]})
  const id=Number(url.pathname.split('/').at(-1)),email=[...identities].find(([,value])=>value===id)?.[0]
  assert.ok(email,'ID sintético conhecido');assert.equal(url.searchParams.get('identifierType'),'contact_id')
  if(options?.method==='PUT'){
    const data=JSON.parse(String(options.body));assert.deepEqual(Object.keys(data),['attributes']);assert.deepEqual(Object.keys(data.attributes),[PREFERENCE_ATTRIBUTE])
    writes.set(id,(writes.get(id)||0)+1)
    if(mode==='withdraw'){entered?.();await release}
    if(mode!=='ignored') attributes.set(id,data.attributes[PREFERENCE_ATTRIBUTE])
    if(mode==='lost') throw new Error('synthetic lost acknowledgement')
    return new Response(null,{status:204})
  }
  return Response.json({id,email,emailBlacklisted:mode==='blocked',attributes:attributes.has(id)?{[PREFERENCE_ATTRIBUTE]:attributes.get(id)}:{}})
}
const client=createBrevoPreferences('synthetic',origin,remote)
const run=(id:string,now=due)=>prepareBrevoBatchPreferences(payload,id,{preferences:client,contacts:directory,secret,origin,now})
const batch=(id:string)=>payload.findByID({collection:'email-campaign-batches',id,depth:0,overrideAccess:true})
let revision=1
try{
  await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=(payload.db as unknown as PostgresAdapter).sessions[id].db;await down({db,payload,req});await up({db,payload,req});throw new Error('synthetic rollback')}),/synthetic rollback/)
  const copy=Object.fromEntries([2,4,7,10].map(day=>[`day${day}`,{subject:`Preferências ${day}`,text:`Conteúdo sintético ${day}.`}]))
  const sequence=await payload.create({collection:'email-sequences',...seed.auth,data:{name:'Links individuais sintéticos',key:'synthetic',magnet:magnet.id,magnetVersion:magnet.version,revision,offer:seed.offers[0].id,active:true,...copy}})
  async function group(name:string,count=1){
    await payload.update({collection:'email-sequences',id:sequence.id,...seed.auth,data:{revision:++revision,day2:{subject:`Grupo sintético ${revision}`}}})
    const people=[]
    for(let i=0;i<count;i++){
      const email=`${name}-${i}-${randomBytes(4).toString('hex')}@example.invalid`
      await requestMagnet(payload,{email,magnetId:magnet.id,marketingOptIn:true,consentVersion:CONSENT_VERSION},secret,start)
      const person=(await payload.find({collection:'contacts',where:{email:{equals:email}},depth:0,overrideAccess:true})).docs[0]
      const delivery=(await payload.find({collection:'email-deliveries',where:{and:[{contact:{equals:person.id}},{kind:{equals:'confirmation'}}]},depth:0,overrideAccess:true})).docs[0]
      let token=''
      await processDelivery(payload,delivery.id,{secret,origin,now:start,transport:async message=>{token=/confirmar\?t=([\w-]+)/.exec(message.text)![1];return{state:'sent',messageId:'synthetic'}}})
      await confirmMagnet(payload,token,secret,start);people.push(person)
    }
    await preparePromotionBatches(payload,due)
    const stage=(await payload.find({collection:'promotion-deliveries',where:{and:[{contact:{equals:people[0].id}},{stage:{equals:'2'}}]},depth:0,overrideAccess:true})).docs[0]
    const id=typeof stage.batch==='string'?stage.batch:stage.batch!.id
    return{people,id}
  }
  const normal=await group('normal',2)
  assert.deepEqual(await prepareBrevoBatchPreferences(payload,normal.id,{preferences:null}),{state:'disabled'})
  assert.equal((await payload.count({collection:'preference-tokens',overrideAccess:true})).totalDocs,0)
  assert.equal((await run(normal.id)).state,'ready')
  const rows=(await payload.find({collection:'preference-tokens',depth:0,overrideAccess:true})).docs
  assert.equal(rows.length,2);assert.notEqual(rows[0].tokenHash,rows[1].tokenHash)
  const urls=normal.people.map(person=>attributes.get(identities.get(person.email)!)!)
  assert.notEqual(urls[0],urls[1])
  for(let i=0;i<urls.length;i++){
    const token=new URL(urls[i]).searchParams.get('t')!
    assert.equal(rows.some(row=>row.tokenHash===hashOpaqueToken(token)),true)
    assert.equal(JSON.stringify(rows).includes(token),false)
    assert.equal((await readPreferences(payload,token,due)).themes.length,1)
  }
  assert.equal(JSON.stringify((await batch(normal.id)).preferenceCheck).includes('?t='),false)
  checks.push('Migração vazia down/up revertida; flag desligada não emite tokens. Dois destinatários recebem links distintos válidos; banco/prova sem token bruto ou endereço.')
  const before=JSON.stringify([...writes])
  assert.ok((await Promise.all([run(normal.id),run(normal.id)])).every(result=>result.state==='ready'))
  assert.equal((await payload.count({collection:'preference-tokens',overrideAccess:true})).totalDocs,2)
  assert.equal(JSON.stringify([...writes]),before)
  checks.push('Preparação concorrente reutiliza intenção/token por contato; GET de valor já correto evita PUT redundante.')

  mode='lost';const lost=await group('lost');assert.equal((await run(lost.id)).state,'ready')
  mode='ignored';const ignored=await group('ignored');assert.equal((await run(ignored.id)).state,'preference_check');assert.equal((await batch(ignored.id)).preferenceCheck,null)
  const count=await payload.count({collection:'preference-tokens',overrideAccess:true})
  mode='normal';assert.equal((await run(ignored.id,due+900_001)).state,'ready')
  assert.equal((await payload.count({collection:'preference-tokens',overrideAccess:true})).totalDocs,count.totalDocs)
  checks.push('Timeout aplicado é conciliado por GET; 204 sem valor observado não autoriza prova; retentativa reutiliza token sem estender validade.')

  const withdrawn=await group('withdrawn');mode='withdraw'
  const gate=new Promise<void>(resolve=>{entered=resolve});let unlock!:()=>void;release=new Promise(resolve=>{unlock=resolve})
  const inflight=run(withdrawn.id);await gate
  const pref=(await payload.find({collection:'preference-tokens',where:{contact:{equals:withdrawn.people[0].id}},depth:0,overrideAccess:true})).docs[0]
  const raw=(await atomic(payload,async req=>{await serial(req,`contact:${withdrawn.people[0].id}`);return issuePreferenceLink(req,withdrawn.people[0].id,secret,origin,due)})).url
  await unsubscribe(payload,new URL(raw).searchParams.get('t'),due);unlock()
  assert.equal((await inflight).state,'canceled');assert.equal((await batch(withdrawn.id)).preferenceCheck,null)
  assert.ok((await payload.findByID({collection:'preference-tokens',id:pref.id,overrideAccess:true})).tokenHash)
  mode='normal'
  checks.push('Descadastro durante PUT vence conferência final e preserva token para retirada; não há quota/campanha/envio.')

  const blocked=await group('blocked');mode='blocked'
  assert.equal((await run(blocked.id)).state,'canceled');mode='normal'
  assert.equal((await payload.findByID({collection:'contacts',id:blocked.people[0].id,overrideAccess:true})).deliveryState,'ok')
  const changed=await group('identity-changed')
  const changeResult=await prepareBrevoBatchPreferences(payload,changed.id,{contacts:directory,preferences:{ensure:async()=>{
    const current=await batch(changed.id)
    const proof=readListSnapshot(current.providerCheck,current.key);assert.ok(proof)
    await payload.update({collection:'email-campaign-batches',id:changed.id,data:{providerCheck:{...proof,recipients:proof.recipients.map(person=>({...person,providerId:999999}))}},overrideAccess:true})
    return{state:'verified'}
  }},secret,origin,now:due})
  assert.equal(changeResult.state,'preference_check');assert.equal((await batch(changed.id)).preferenceCheck,null)
  checks.push('Bloqueio observado no atributo cancela marketing sem inferir bounce; mudança concorrente de ID no preflight invalida prova de links anterior.')

  const person=normal.people[0],first=urls[0],firstToken=new URL(first).searchParams.get('t')!
  const issue=(time:number,key=secret)=>atomic(payload,async req=>{await serial(req,`contact:${person.id}`);return issuePreferenceLink(req,person.id,key,origin,time)})
  const reused=await issue(due+1);assert.equal(reused.url,first)
  const rotated=await issue(due+174*86_400_000);assert.notEqual(rotated.url,first)
  assert.equal((await readPreferences(payload,firstToken,due+174*86_400_000)).themes.length,1)
  await assert.rejects(readPreferences(payload,firstToken,due+UNSUBSCRIBE_TTL),/expired/)
  const keyed=await issue(due+174*86_400_000,secret+'new');assert.notEqual(keyed.url,rotated.url)
  assert.equal((await readPreferences(payload,new URL(keyed.url).searchParams.get('t'),due+174*86_400_000)).themes.length,1)
  checks.push('Renovação antes do vencimento e troca de chave geram novo link; hash antigo preserva somente validade original, sem extensão silenciosa.')

  const failing=await group('rollback'), hooks=payload.collections['preference-tokens'].config.hooks,previous=hooks.afterChange
  hooks.afterChange=[...previous,async()=>{throw new Error('synthetic token rollback')}]
  try{await assert.rejects(run(failing.id),/synthetic token rollback/)}finally{hooks.afterChange=previous}
  assert.equal((await payload.count({collection:'preference-tokens',where:{contact:{equals:failing.people[0].id}},overrideAccess:true})).totalDocs,0)
  assert.equal(identities.has(failing.people[0].email),true)
  assert.equal(attributes.has(identities.get(failing.people[0].email)!),false)
  const slow=await group('slow');let time=due
  assert.equal((await prepareBrevoBatchPreferences(payload,slow.id,{contacts:directory,preferences:{ensure:async()=>{time+=300_001;return{state:'verified'}}},secret,origin,clock:()=>time})).state,'preference_check')
  await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);await down({db:(payload.db as unknown as PostgresAdapter).sessions[id].db,payload,req})}),/Downgrade recusado/)
  checks.push('Falha de emissão reverte intenção antes de PUT; prova expirada é recusada; downgrade não apaga nonces/intenção ou conferências.')

  const packed=await group('packed'),temporary=await mkdtemp(path.join(tmpdir(),'bibliotheon-preference-cli-'))
  try{
    const bootstrap=path.join(temporary,'http.mjs')
    await writeFile(bootstrap,`import assert from 'node:assert/strict';const now=Number(process.env.SYNTHETIC_NOW);Date.now=()=>now;let value;globalThis.fetch=async(input,options)=>{const url=new URL(String(input));assert.equal(url.origin,'https://api.brevo.com');if(url.pathname==='/v3/contacts/attributes')return Response.json({attributes:[{name:'BIBLIOTHEON_PREFERENCES',category:'normal',type:'text'}]});if(options?.method==='PUT'){const body=JSON.parse(options.body);assert.deepEqual(Object.keys(body),['attributes']);value=body.attributes.BIBLIOTHEON_PREFERENCES;return new Response(null,{status:204})}const email=process.env.SYNTHETIC_EMAIL;return Response.json({id:70001,email,emailBlacklisted:false,attributes:value?{BIBLIOTHEON_PREFERENCES:value}:{}})};`)
    const output=execFileSync(process.execPath,['--env-file-if-exists=.env.local','--import',bootstrap,'.release/prepare-brevo-preferences.js',packed.id],{env:{...process.env,SYNTHETIC_NOW:String(due),SYNTHETIC_EMAIL:packed.people[0].email,BREVO_PREFERENCE_SYNC_ENABLED:'true',BREVO_CONTACT_SYNC_ENABLED:'true',BREVO_API_KEY:'synthetic-only',LEAD_TOKEN_SECRET:secret,PUBLIC_SITE_URL:origin,EMAIL_TRANSPORT_ENABLED:'false'},encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30_000})
    assert.deepEqual(JSON.parse(output.trim().split('\n').at(-1)!),{state:'ready'})
    assert.ok((await batch(packed.id)).preferenceCheck)
  }finally{await rm(temporary,{recursive:true,force:true})}
  assert.equal((await payload.count({collection:'mail-quota',where:{reserved:{greater_than:0}},overrideAccess:true})).totalDocs,1) // only synthetic transactional confirmations, same day
  assert.equal((await payload.count({collection:'email-campaign-batches',where:{state:{equals:'claimed'}},overrideAccess:true})).totalDocs,0)
  checks.push('CLI empacotado habilitado com HTTP totalmente interceptado persiste prova mínima; nenhum claim ou transporte promocional.')
  await mkdir('artifacts/brevo-preferences',{recursive:true})
  await writeFile('artifacts/brevo-preferences/local-results.json',JSON.stringify({date:'2026-10-22 America/Belem',environment:'PostgreSQL loopback, HTTP sintético e CLI interceptado',checks,externalCalls:false,realMessagesSent:0,limits:'Prova pontual não autoriza envio. Atributo e renderização do placeholder requerem homologação na conta; sem campanha criada ou enviada.'},null,2)+'\n')
  console.log(`Links individuais Brevo: ${checks.length} grupos aprovados; nenhuma chamada real.`)
}finally{await seed.cleanup()}
process.exit(0)
