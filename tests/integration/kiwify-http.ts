import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {testOrigin as base} from '../fixtures/origin'
import {seedCommerce,commercialCollections} from '../fixtures/commerce'
import {kiwifyFixture,kiwifyBytes,signKiwify,kiwifyEnv,seedKiwifyCatalog} from '../fixtures/kiwify'
import {commercialEventKey} from '../../src/modules/commerce/events'
import {processCommercialInbox} from '../../src/modules/commerce/inbox'

const seed=await seedCommerce(),{payload}=seed,checks:string[]=[],path='/api/v1/webhooks/kiwify'
const post=(value:unknown,headers:Record<string,string>={},query?:string)=>{const body=kiwifyBytes(value);return fetch(base+path+(query??`?signature=${signKiwify(body)}`),{method:'POST',headers:{'Content-Type':'application/json',...headers},body})}
const row=async(id:string,type='order_approved')=>(await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey({provider:'kiwify',accountKey:'synthetic',eventKey:createHash('sha256').update(JSON.stringify([id,type])).digest('hex')})}},depth:0,overrideAccess:true})).docs[0]
const count=async(collection:typeof commercialCollections[number])=>(await payload.count({collection,overrideAccess:true})).totalDocs
try{
 await seedKiwifyCatalog(seed)
 const native=kiwifyFixture({id:'kiwify-http-approved'});native.Commissions.charge_amount=29;native.Commissions.kiwify_fee=3
 assert.equal((await post(native,{},'?signature='+'0'.repeat(40))).status,401)
 assert.equal((await post(native,{'X-Kiwify-Token':kiwifyEnv.KIWIFY_WEBHOOK_TOKEN},'')).status,401)
 const signature=signKiwify(kiwifyBytes(native))
 assert.equal((await post(native,{},`?signature=${signature}&signature=${signature}`)).status,401)
 assert.equal((await post(JSON.stringify(native)+' ',{},`?signature=${signature}`)).status,401)
 assert.equal((await post(native,{'Content-Type':'text/plain'})).status,415);assert.equal((await post(native,{'Content-Encoding':'gzip'})).status,415);assert.equal((await post('{')).status,422)
 assert.equal(await count('commercial-inbox'),0)
 checks.push('Rota real exige uma signature na query e HMAC dos bytes exatos; header/token, query duplicada, adulteração de espaço, MIME/encoding e JSON inválidos não persistem.')
 const response=await post(native);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual(await response.json(),{code:'accepted'})
 const first=await row(native.order_id);assert.equal(first.state,'pending');assert.equal(first.adapterVersion,'kiwify-orders:1');assert.equal(await count('transactions'),0)
 assert.equal((first.envelope as {grossCents:number}).grossCents,29)
 assert.equal((await processCommercialInbox(payload,first.id)).state,'applied')
 const before=(await payload.find({collection:'transactions',depth:0,overrideAccess:true})).docs[0];assert.equal(before.grossCents,29);assert.equal(before.state,'approved');assert.equal(before.feesCents,3);assert.equal(before.producerNetCents,null)
 checks.push('ACK 200 depois do commit da inbox; recepção com worker desligado não cria venda. Processamento explícito conserva 29 centavos, sem multiplicar por cem ou inferir líquido.')
 assert.deepEqual((await Promise.all([post(native),post(native)])).map(result=>result.status),[200,200]);assert.equal(await count('transactions'),1);assert.equal(await count('transaction-events'),1)
 const changed=structuredClone(native);changed.Commissions.charge_amount=31;assert.equal((await post(changed)).status,200);assert.equal((await row(native.order_id)).conflicted,true);assert.equal(await count('commercial-conflicts'),1)
 assert.deepEqual((await payload.findByID({collection:'transactions',id:before.id,depth:0,overrideAccess:true})).projection,before.projection)
 checks.push('Replay concorrente conserva um único fato; colisão autenticada é durável, marca revisão e preserva projeção.')
 const pending=kiwifyFixture({id:'kiwify-http-pix',event:'pix_created',status:'waiting_payment'});pending.approved_date='';await post(pending)
 assert.equal((await processCommercialInbox(payload,(await row(pending.order_id,'pix_created')).id)).state,'applied')
 const pix=(await payload.find({collection:'transactions',where:{externalTransactionId:{equals:pending.order_id}},overrideAccess:true})).docs[0];assert.equal(pix.state,'pending');assert.equal(pix.approvedAt,null)
 const unknown=kiwifyFixture({id:'kiwify-http-subscription',event:'subscription_canceled'});await post(unknown);assert.equal((await row(unknown.order_id,'subscription_canceled')).state,'ignored')
 const chargeback=kiwifyFixture({id:'kiwify-http-chargeback',event:'chargeback',status:'chargedback'});await post(chargeback);assert.equal((await processCommercialInbox(payload,(await row(chargeback.order_id,'chargeback')).id)).state,'needs_review');assert.equal((await row(chargeback.order_id,'chargeback')).errorCode,'unknown_event_time')
 for(const item of (await payload.find({collection:'commercial-inbox',depth:0,overrideAccess:true})).docs)for(const forbidden of ['never-store','SYNTHETIC-DOCUMENT',kiwifyEnv.KIWIFY_WEBHOOK_TOKEN,signature])assert.equal(JSON.stringify(item).includes(forbidden),false)
 checks.push('PIX permanece pendente; cancelamento de assinatura é ignorado; chargeback sem instante confirmado exige conciliação. Inbox sem PII, segredo ou assinatura da URL.')
}finally{await seed.cleanup()}
await mkdir('artifacts/kiwify',{recursive:true})
await writeFile('artifacts/kiwify/http-results.json',JSON.stringify({date:new Date().toISOString(),origin:base,checks,realProvider:false,externalCalls:false,realSales:0,limits:'Next loopback com credenciais/payloads sintéticos. Aplicação da fila explícita nos testes; sem conta ou webhook real da Kiwify.'},null,2)+'\n')
console.log(`Kiwify HTTP: ${checks.length} grupos aprovados; fixtures limpas.`)
process.exit(0)
