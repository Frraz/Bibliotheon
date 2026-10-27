import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {testOrigin as base} from '../fixtures/origin'
import {seedCommerce,commercialCollections} from '../fixtures/commerce'
import {kiwifyFixture,kiwifyBytes,signKiwify,kiwifyEnv,seedKiwifyCatalog} from '../fixtures/kiwify'
import {commercialEventKey} from '../../src/modules/commerce/events'
import {processCommercialInbox} from '../../src/modules/commerce/inbox'
import {previewFinancialReport} from '../../src/modules/commerce/financial-ledger'

const seed=await seedCommerce(),{payload}=seed,checks:string[]=[],path='/api/v1/webhooks/kiwify'
const post=(value:unknown,headers:Record<string,string>={},query?:string)=>{const body=kiwifyBytes(value);return fetch(base+path+(query??`?signature=${signKiwify(body)}`),{method:'POST',headers:{'Content-Type':'application/json',...headers},body})}
const row=async(id:string,type='order_approved')=>(await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey({provider:'kiwify',accountKey:'synthetic',eventKey:createHash('sha256').update(JSON.stringify([id,type])).digest('hex')})}},depth:0,overrideAccess:true})).docs[0]
const count=async(collection:typeof commercialCollections[number])=>(await payload.count({collection,overrideAccess:true})).totalDocs
const tx=async(id:string)=>(await payload.find({collection:'transactions',where:{externalTransactionId:{equals:id}},limit:1,depth:0,overrideAccess:true})).docs[0]
let consentGrantId:string|undefined,consentVisitId:string|undefined
try{
 for(const collection of ['analytics-grants','visits','checkout-clicks'] as const)assert.equal((await payload.count({collection,overrideAccess:true})).totalDocs,0,`Fixture analítica exige ${collection} vazio.`)
 await seedKiwifyCatalog(seed)
 await payload.update({collection:'campaigns',id:seed.campaign.id,...seed.auth,data:{offer:seed.offers[1].id}})
 const clickTime=Date.parse('2026-10-20T11:00:00.000Z'),token=randomUUID(),grant=await payload.create({collection:'analytics-grants',overrideAccess:true,data:{tokenHash:createHash('sha256').update(token).digest('hex'),consentVersion:'synthetic-v1',grantedAt:new Date(clickTime-60000).toISOString(),expiresAt:new Date(clickTime+86400000).toISOString(),attributionExpiresAt:new Date(clickTime+30*86400000).toISOString()}});consentGrantId=grant.id
 const visit=await payload.create({collection:'visits',overrideAccess:true,data:{grant:grant.id,startedAt:new Date(clickTime).toISOString(),lastSeenAt:new Date(clickTime).toISOString(),expiresAt:new Date(clickTime+30*60000).toISOString()}});consentVisitId=visit.id
 const click=await payload.create({collection:'checkout-clicks',overrideAccess:true,data:{offer:seed.offers[1].id,ebook:seed.books[0].id,campaign:seed.campaign.id,provider:'kiwify',visit:visit.id,attributionAllowed:true,occurredAt:new Date(clickTime).toISOString()}})
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
 const attributed=kiwifyFixture({id:'kiwify-http-attributed'});(attributed.TrackingParameters as typeof attributed.TrackingParameters&{sck?:string}).sck=click.id
 assert.equal((await post(attributed)).status,200);assert.equal((await post(attributed)).status,200);assert.equal((await processCommercialInbox(payload,(await row(attributed.order_id)).id)).state,'applied');assert.equal((await row(attributed.order_id)).attempts,1)
 assert.equal(((await tx('kiwify-http-attributed')).projection as {externalClickReference?:string|null}).externalClickReference,click.id)
 const reportDate=new Date().toISOString().slice(0,10),report=await previewFinancialReport(payload,{...seed.owner,collection:'admin-users'},{from:'2026-10-20',through:reportDate}),campaign=report.dimensions.byCampaign.find(item=>item.campaignId===seed.campaign.id&&item.currency==='BRL')!
 assert.equal(campaign.attributedTransactions,1);assert.equal(campaign.attributionCoverage.known,0);assert.equal(campaign.attributedRevenueCents,null);checks.push('Callback HTTP Kiwify sintético liga TrackingParameters.sck ao clique consentido e relatório; replay não duplica. Reversões sem quantia mantêm receita null.')
}finally{
 await payload.delete({collection:'checkout-clicks',where:{offer:{in:seed.offers.map(offer=>offer.id)}},overrideAccess:true})
 if(consentVisitId)await payload.delete({collection:'visits',id:consentVisitId,overrideAccess:true})
 if(consentGrantId)await payload.delete({collection:'analytics-grants',id:consentGrantId,overrideAccess:true})
 await seed.cleanup()
}
await mkdir('artifacts/attribution',{recursive:true})
await writeFile('artifacts/attribution/kiwify-http-d88.json',JSON.stringify({date:new Date().toISOString(),origin:base,checks,realProvider:false,externalCalls:false,realSales:0,fixturesCleaned:true,limits:'Next loopback com credenciais/payloads sintéticos. Aplicação da fila explícita; sem conta ou webhook real da Kiwify.'},null,2)+'\n')
console.log(`Kiwify HTTP: ${checks.length} grupos aprovados; fixtures limpas.`)
process.exit(0)
