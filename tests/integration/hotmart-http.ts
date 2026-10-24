import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {testOrigin as base} from '../fixtures/origin'
import {seedCommerce,commercialCollections} from '../fixtures/commerce'
import {hotmartFixture,hotmartEnv,seedHotmartCatalog} from '../fixtures/hotmart'
import {commercialEventKey} from '../../src/modules/commerce/events'
import {processCommercialInbox} from '../../src/modules/commerce/inbox'

const seed=await seedCommerce(),{payload}=seed,checks:string[]=[],now=Date.now()-120000,path='/api/v1/webhooks/hotmart'
const post=(body:unknown,headers:Record<string,string>={},suffix='')=>fetch(base+path+suffix,{method:'POST',headers:{'Content-Type':'application/json','X-HOTMART-HOTTOK':hotmartEnv.HOTMART_HOTTOK,...headers},body:typeof body==='string'?body:JSON.stringify(body)})
const row=async(id:string)=>(await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey({provider:'hotmart',accountKey:'synthetic',eventKey:id})}},depth:0,overrideAccess:true})).docs[0]
const count=async(collection:typeof commercialCollections[number])=>(await payload.count({collection,overrideAccess:true})).totalDocs
try{
 await seedHotmartCatalog(seed)
 const native=hotmartFixture({id:'native-http-approved',transaction:'native-http-transaction',now});native.data.purchase.full_price.value=0.29
 assert.equal((await post(native,{'X-HOTMART-HOTTOK':'wrong'})).status,401)
 assert.equal((await post(native,{'X-HOTMART-HOTTOK':'',Cookie:`hottok=${hotmartEnv.HOTMART_HOTTOK}`},`?hottok=${hotmartEnv.HOTMART_HOTTOK}`)).status,401)
 assert.equal(await count('commercial-inbox'),0)
 assert.equal((await post(native,{'Content-Type':'text/plain'})).status,415);assert.equal((await post(native,{'Content-Encoding':'gzip'})).status,415);assert.equal((await post('{')).status,422);assert.equal((await post({...native,version:'1.0.0'})).status,422)
 assert.equal(await count('commercial-inbox'),0)
 checks.push('Endpoint real exige Hottok no cabeçalho, rejeita query/cookie/MIME/encoding/JSON/versão incorretos antes de persistência.')
 const response=await post(native);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual(await response.json(),{code:'accepted'})
 const first=await row(native.id);assert.equal(first.state,'pending');assert.equal(first.adapterVersion,'hotmart-purchase-v2:1');assert.equal(await count('transactions'),0)
 const envelope=first.envelope as {grossCents:number;approvedAt:string;sourceCreatedAt:string};assert.equal(envelope.grossCents,29);assert.equal(envelope.approvedAt,new Date(native.data.purchase.approved_date).toISOString());assert.equal(envelope.sourceCreatedAt,new Date(native.creation_date).toISOString())
 assert.equal((await processCommercialInbox(payload,first.id)).state,'applied');const before=(await payload.find({collection:'transactions',depth:0,overrideAccess:true})).docs[0];assert.equal(before.grossCents,29);assert.equal(before.state,'approved');assert.equal(before.producerNetCents,null)
 checks.push('ACK 200 real após inbox durável; worker desligado não aplica aprovação. Processamento posterior explícito aplica 29 centavos exatos e data original, sem deduzir líquido.')
 for(let i=0;i<2;i++)assert.equal((await post(native)).status,200)
 assert.equal(await count('transactions'),1);assert.equal(await count('transaction-events'),1);assert.equal((await row(native.id)).attempts,1)
 const conflict=structuredClone(native);conflict.data.purchase.full_price.value=0.31;assert.equal((await post(conflict)).status,200);assert.equal((await row(native.id)).conflicted,true);assert.equal(await count('commercial-conflicts'),1)
 const after=await payload.findByID({collection:'transactions',id:before.id,depth:0,overrideAccess:true});assert.equal(after.needsReview,true);assert.deepEqual(after.projection,before.projection)
 checks.push('Reenvios HTTP preservam uma única transação/fato/tentativa; colisão é ACK durável e mantém projeção anterior em revisão.')
 const pending=hotmartFixture({id:'native-http-pix',transaction:'native-http-pix',event:'PURCHASE_DELAYED',now});pending.data.purchase.status='WAITING_PAYMENT'
 assert.equal((await post(pending)).status,200);assert.equal((await processCommercialInbox(payload,(await row(pending.id)).id)).state,'applied');const pix=(await payload.find({collection:'transactions',where:{externalTransactionId:{equals:pending.data.purchase.transaction}},overrideAccess:true})).docs[0];assert.equal(pix.state,'pending');assert.equal(pix.approvedAt,null)
 const ignored=hotmartFixture({id:'native-http-ignored',event:'CLUB_FIRST_ACCESS',now});assert.equal((await post(ignored)).status,200);assert.equal((await row(ignored.id)).state,'ignored');assert.equal(await count('transactions'),2)
 for(const item of (await payload.find({collection:'commercial-inbox',depth:0,overrideAccess:true})).docs)for(const forbidden of ['never-store','SYNTHETIC-DOCUMENT','private-pix',hotmartEnv.HOTMART_HOTTOK])assert.equal(JSON.stringify(item).includes(forbidden),false)
 checks.push('Metadados PIX não aprovam evento pendente; evento não financeiro não vira transação. Respostas/envelopes não contêm PII ou Hottok.')
}finally{await seed.cleanup()}
await mkdir('artifacts/hotmart',{recursive:true})
await writeFile('artifacts/hotmart/http-results.json',JSON.stringify({date:new Date().toISOString(),origin:base,checks,realProvider:false,externalCalls:false,realSales:0,limits:'Servidor loopback com credenciais e payloads sintéticos; aplicação da fila feita explicitamente pelo teste. Sem contato com Hotmart ou homologação na conta.'},null,2)+'\n')
console.log(`Hotmart HTTP: ${checks.length} grupos aprovados; fixtures limpas.`)
process.exit(0)
