import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {testOrigin as base} from '../fixtures/origin'
import {seedCommerce,commercialCollections} from '../fixtures/commerce'
import {receiveCommercialWebhook,processCommercialInbox} from '../../src/modules/commerce/inbox'
import {commercialEventKey,type NormalizedCommercialEvent,type CommercialAdapter} from '../../src/modules/commerce/events'
assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true')
const seed=await seedCommerce(),{payload}=seed,checks:string[]=[],path='/api/v1/admin/transaction-resolutions/preview'
const event=(key:string,id:string):NormalizedCommercialEvent=>({provider:'hotmart',accountKey:'synthetic',eventKey:key,externalTransactionId:id,externalProductId:'synthetic-product',externalOfferId:null,kind:'approved',occurredAt:'2026-10-20T11:01:00.000Z',approvedAt:'2026-10-20T11:01:00.000Z',currency:'BRL',grossCents:10000,feesCents:null,producerNetCents:null,refundedCents:null,chargebackCents:null,refundBasis:null,externalRefundId:null,externalClickReference:null})
const receive=async(e:NormalizedCommercialEvent,apply=false)=>{
 const adapter:CommercialAdapter={provider:'hotmart',version:'synthetic-review-http:1',verify:async()=>true,normalize:bytes=>JSON.parse(Buffer.from(bytes).toString())}
 await receiveCommercialWebhook(payload,adapter,e,Buffer.from(JSON.stringify(e)),new Headers())
 if(apply){const receipt=(await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey(e)}},overrideAccess:true})).docs[0];assert.equal((await processCommercialInbox(payload,receipt.id)).state,'applied')}
}
const snapshot=async()=>{const state:Record<string,unknown>={};for(const collection of commercialCollections)state[collection]=(await payload.find({collection,limit:10001,sort:'id',depth:0,overrideAccess:true})).docs;return state}
try{
 const choice={provider:'hotmart',accountKey:'synthetic',externalTransactionId:'http-review-a',action:'reconcile',selections:[]}
 const post=(input:unknown,headers:Record<string,string>={})=>fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(input)})
 assert.equal((await post(choice)).status,403)
 const login=await fetch(base+'/api/admin-users/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:seed.owner.email,password:seed.password})});assert.equal(login.status,200);const {token}=await login.json(),auth={Authorization:`JWT ${token}`}
 assert.equal((await post(choice,{...auth,Origin:'https://other.invalid'})).status,403)
 assert.equal((await post({...choice,actor:seed.owner.id},auth)).status,422)
 assert.equal((await post({...choice,confirmed:true},auth)).status,422)
 assert.equal((await fetch(base+path,{method:'POST',headers:{...auth,Origin:base,'Content-Type':'text/csv'},body:'fixture'})).status,415)
 assert.equal((await post(choice,auth)).status,404)
 checks.push('Rota real exige owner/origem exata, recusa ator/confirmação fora do contrato e MIME errado; sem fonte retorna 404 em vez de inventar transação.')
 const a=event('http-review-collision','http-review-a'),b=event('http-review-clean-b','http-review-b')
 await receive(a,true);await receive(b,true);await receive({...a,externalTransactionId:'http-review-b',grossCents:20000})
 const before=await snapshot(),response=await post(choice,auth);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');const inspect=await response.json()
 assert.equal(inspect.committable,false);assert.equal(inspect.processable,false);assert.equal(inspect.context.transactionScopes.length,2);assert.equal(inspect.context.receipts.length,2)
 const selections=inspect.context.receipts.map((receipt:{id:string;variants:{source:string;hash:string}[]})=>({inboxId:receipt.id,envelopeHash:receipt.variants.find(variant=>variant.source==='original')!.hash,reason:'source_confirmed'}))
 const simulation=await post({...choice,selections},auth);assert.equal(simulation.status,200);const result=await simulation.json();assert.equal(result.processable,true);assert.equal(result.committable,false);assert.equal(result.outcomes.filter((outcome:{state:string})=>outcome.state==='projected').length,2)
 assert.deepEqual(await snapshot(),before)
 checks.push('Prévia HTTP inclui os dois lados da colisão; plano integral pode ser simulado, mas permanece committable=false. Nenhuma transação, valor, fato ou auditoria é alterado pela prévia.')
 assert.equal((await post({...choice,selections:[selections[0],selections[0]]},auth)).status,422)
 assert.equal((await post({...choice,selections:[{...selections[0],envelopeHash:'0'.repeat(64)}]},auth)).status,422)
 const hold=await post({...choice,action:'hold'},auth);assert.equal(hold.status,200);assert.equal((await hold.json()).committable,false)
 assert.deepEqual(await snapshot(),before)
 checks.push('Variantes desconhecidas/duplicadas não simulam decisão válida; hold mantém revisão e não altera valores conhecidos. Endpoint de aplicação financeira continua pendente.')
}finally{await seed.cleanup()}
await mkdir('artifacts/transaction-review',{recursive:true})
await writeFile('artifacts/transaction-review/http-results.json',JSON.stringify({date:new Date().toISOString(),origin:base,checks,externalCalls:false,limits:'HTTP local sintético de prévia; não confirma decisão nem aplica financeiro. Sem homologação de contas ou UI customizada.'},null,2)+'\n')
console.log(`Revisão de transações HTTP: ${checks.length} grupos aprovados; fixtures limpas.`)
process.exit(0)
