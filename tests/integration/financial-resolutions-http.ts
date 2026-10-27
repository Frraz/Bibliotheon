import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {testOrigin as base} from '../fixtures/origin'
import {seedCommerce} from '../fixtures/commerce'
import {receiveCommercialWebhook,processCommercialInbox} from '../../src/modules/commerce/inbox'
import {commercialEventKey,type NormalizedCommercialEvent,type CommercialAdapter} from '../../src/modules/commerce/events'
assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true')
const seed=await seedCommerce(),{payload}=seed,checks:string[]=[],path='/api/v1/admin/transaction-resolutions'
const e:NormalizedCommercialEvent={provider:'hotmart',accountKey:'synthetic',eventKey:'financial-http-event',externalTransactionId:'financial-http-transaction',externalProductId:'synthetic-product',externalOfferId:null,kind:'approved',occurredAt:'2026-10-20T11:01:00.000Z',approvedAt:'2026-10-20T11:01:00.000Z',currency:'BRL',grossCents:10000,feesCents:null,producerNetCents:null,refundedCents:null,chargebackCents:null,refundBasis:null,externalRefundId:null,externalClickReference:null}
const adapter:CommercialAdapter={provider:'hotmart',version:'financial-http:1',verify:async()=>true,normalize:bytes=>JSON.parse(Buffer.from(bytes).toString())}
try{
 const choice={provider:e.provider,accountKey:e.accountKey,externalTransactionId:e.externalTransactionId,action:'reconcile',selections:[]}
 const post=(target:string,input:unknown,headers:Record<string,string>={})=>fetch(base+target,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(input)})
 assert.equal((await post(path,{})).status,403)
 const login=await post('/api/admin-users/login',{email:seed.owner.email,password:seed.password});assert.equal(login.status,200);const {token}=await login.json(),auth={Authorization:`JWT ${token}`}
 assert.equal((await post(path,{}, {...auth,Origin:'https://other.invalid'})).status,403)
 assert.equal((await post(path,{},auth)).status,422)
 assert.equal((await fetch(base+path,{method:'POST',headers:{...auth,Origin:base,'Content-Type':'text/csv'},body:'fixture'})).status,415)
 await receiveCommercialWebhook(payload,adapter,e,Buffer.from(JSON.stringify(e)),new Headers())
 const receipt=(await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey(e)}},overrideAccess:true})).docs[0];await processCommercialInbox(payload,receipt.id)
 await receiveCommercialWebhook(payload,adapter,e,Buffer.from(JSON.stringify({...e,grossCents:20000})),new Headers())
 const inspectResponse=await post(path+'/preview',choice,auth);assert.equal(inspectResponse.status,200);const inspect=await inspectResponse.json()
 const selections=inspect.context.receipts.map((r:{id:string;variants:{hash:string;source:string}[]})=>({inboxId:r.id,envelopeHash:r.variants.find(v=>v.source==='conflict')!.hash,reason:'source_confirmed'}))
 const simulation=await post(path+'/preview',{...choice,selections},auth);assert.equal(simulation.status,200);const plan=await simulation.json();assert.equal(plan.processable,true)
 const input={...plan.choice,planHash:plan.planHash,sourceKind:'provider_report',sourceReference:'financial-http-synthetic',reason:'incorrect_source_reconciled',evidenceVerified:true,confirmed:true},idem=randomUUID(),headers={...auth,'Idempotency-Key':idem}
 assert.equal((await post(path,{...input,actor:seed.owner.id},headers)).status,422)
 assert.equal((await post(path,{...input,evidenceVerified:false},headers)).status,422)
 assert.equal((await post(path,{...input,confirmed:false},headers)).status,422)
 assert.equal((await post(path,{...input,planHash:'0'.repeat(64)},headers)).status,409)
 assert.equal((await payload.count({collection:'financial-resolutions',overrideAccess:true})).totalDocs,0)
 checks.push('HTTP real exige owner/origem/MIME/idempotência e evidência atestada; ator forjado, confirmação ausente e plano stale não escrevem decisões.')
 const committed=await post(path,input,headers);assert.equal(committed.status,201);assert.equal(committed.headers.get('cache-control'),'private, no-store');assert.equal(committed.headers.get('referrer-policy'),'no-referrer');const result=await committed.json();assert.equal(result.duplicate,false)
 const repeated=await post(path,input,{...headers,'Idempotency-Key':idem.toUpperCase()});assert.equal(repeated.status,200);assert.equal((await repeated.json()).id,result.id)
 assert.equal((await post(path,{...input,sourceReference:'different-synthetic-source'},headers)).status,409)
 const transaction=(await payload.find({collection:'transactions',limit:1,depth:0,overrideAccess:true})).docs[0];assert.equal(transaction.grossCents,20000);assert.equal(transaction.needsReview,false)
 assert.equal((await payload.count({collection:'financial-resolution-applications',overrideAccess:true})).totalDocs,1)
 checks.push('Confirmação aplica a variante selecionada, responde 201 privado e repetição responde 200; chave reutilizada com outra prova é conflito e não duplica aplicações.')
 for(const collection of ['financial-resolutions','financial-resolution-applications']){
  assert.equal((await post('/api/'+collection,{},auth)).status,403)
  assert.equal((await fetch(base+'/api/'+collection)).status,403)
 }
 const denied=await fetch(base+'/api/financial-resolutions/'+result.id,{method:'DELETE',headers:auth});assert.equal(denied.status,403)
 checks.push('API nativa nega escrita até ao owner e leitura anônima; confirmação controlada é o caminho autorizado. Decisão histórica não pode ser apagada.')
}finally{await seed.cleanup()}
await mkdir('artifacts/financial-resolutions',{recursive:true})
await writeFile('artifacts/financial-resolutions/http-results.json',JSON.stringify({date:new Date().toISOString(),checks,schemaMigrations:25,externalCalls:false,limits:'HTTP local sintético, sem relatório nativo, conta externa, UI ou produção.'},null,2)+'\n')
console.log(`Decisões financeiras HTTP: ${checks.length} grupos aprovados; fixtures limpas.`)
process.exit(0)
