import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {testOrigin as base} from '../fixtures/origin'
import {seedCommerce,commercialCollections} from '../fixtures/commerce'
import {caktoFixture,caktoOrder,caktoBytes,caktoHeaders,caktoEnv,seedCaktoCatalog} from '../fixtures/cakto'
import {commercialEventKey} from '../../src/modules/commerce/events'
import {processCommercialInbox} from '../../src/modules/commerce/inbox'
import {previewFinancialReport} from '../../src/modules/commerce/financial-ledger'
const seed=await seedCommerce(),{payload}=seed,checks:string[]=[],path='/api/v1/webhooks/cakto'
const post=(value:unknown,extra:Record<string,string>={})=>{const body=caktoBytes(value),headers=caktoHeaders(body);for(const [key,value]of Object.entries(extra))headers.set(key,value);return fetch(base+path,{method:'POST',headers,body})}
const row=async(id:string,type='purchase_approved')=>(await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey({provider:'cakto',accountKey:'synthetic',eventKey:createHash('sha256').update(JSON.stringify([id,type])).digest('hex')})}},depth:0,limit:1,overrideAccess:true})).docs[0]
const count=async(collection:typeof commercialCollections[number])=>(await payload.count({collection,overrideAccess:true})).totalDocs
const tx=async(id:string)=>(await payload.find({collection:'transactions',where:{externalTransactionId:{equals:id}},limit:1,depth:0,overrideAccess:true})).docs[0]
let consentGrantId:string|undefined,consentVisitId:string|undefined
try{
 for(const collection of ['analytics-grants','visits','checkout-clicks'] as const)assert.equal((await payload.count({collection,overrideAccess:true})).totalDocs,0,`Fixture analítica exige ${collection} vazio.`)
 await seedCaktoCatalog(seed)
 await payload.update({collection:'campaigns',id:seed.campaign.id,...seed.auth,data:{offer:seed.offers[2].id}})
 const clickTime=Date.parse('2026-10-20T11:00:00.000Z'),token=randomUUID(),grant=await payload.create({collection:'analytics-grants',overrideAccess:true,data:{tokenHash:createHash('sha256').update(token).digest('hex'),consentVersion:'synthetic-v1',grantedAt:new Date(clickTime-60000).toISOString(),expiresAt:new Date(clickTime+86400000).toISOString(),attributionExpiresAt:new Date(clickTime+30*86400000).toISOString()}});consentGrantId=grant.id
 const visit=await payload.create({collection:'visits',overrideAccess:true,data:{grant:grant.id,startedAt:new Date(clickTime).toISOString(),lastSeenAt:new Date(clickTime).toISOString(),expiresAt:new Date(clickTime+30*60000).toISOString()}});consentVisitId=visit.id
 const click=await payload.create({collection:'checkout-clicks',overrideAccess:true,data:{offer:seed.offers[2].id,ebook:seed.books[0].id,campaign:seed.campaign.id,provider:'cakto',visit:visit.id,attributionAllowed:true,occurredAt:new Date(clickTime).toISOString()}})
 const main=caktoOrder('cakto-http-main'),bump={...caktoOrder('cakto-http-bump'),offer_type:'orderbump',parent_order:'synthetic-parent'};main.amount=0.29;main.fees=0.03
 const native=caktoFixture({data:[main,bump]}),bytes=caktoBytes(native),signed=caktoHeaders(bytes)
 assert.equal((await post(native,{'X-Cakto-Signature':'v1='+'0'.repeat(64)})).status,401)
 assert.equal((await post(native,{'X-Cakto-Signature':''})).status,401)
 const stale=caktoHeaders(bytes,caktoEnv.CAKTO_WEBHOOK_SECRET,String(Math.floor(Date.now()/1000)-301))
 assert.equal((await post(native,Object.fromEntries(stale))).status,401)
 assert.equal((await post(JSON.stringify(native)+' ',Object.fromEntries(signed))).status,401)
 assert.equal((await post(native,{'Content-Type':'text/plain'})).status,415);assert.equal((await post(native,{'Content-Encoding':'gzip'})).status,415)
 assert.equal((await post('{')).status,422);assert.equal((await post(' '.repeat(262145))).status,413)
 assert.equal((await post(caktoFixture({data:[main,{id:'invalid'}]}))).status,422);assert.equal(await count('commercial-inbox'),0)
 assert.equal((await fetch(base+path)).status,405)
 checks.push('Rota real exige HMAC/timestamp fresco e bytes exatos; secret no corpo não basta. MIME/encoding, JSON inválido, limite e item V2 malformado rejeitados sem recibo parcial; GET retorna 405.')
 const response=await post(native);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual(await response.json(),{code:'accepted'})
 assert.equal(await count('commercial-inbox'),2);assert.equal(await count('transactions'),0)
 for(const id of [main.id,bump.id]){const item=await row(id);assert.equal(item.state,'pending');assert.equal(item.adapterVersion,'cakto-orders-v1-v2:1');assert.equal((await processCommercialInbox(payload,item.id)).state,'applied')}
 const sale=(await payload.find({collection:'transactions',where:{externalTransactionId:{equals:main.id}},depth:0,overrideAccess:true})).docs[0];assert.equal(sale.grossCents,29);assert.equal(sale.feesCents,3);assert.equal(sale.producerNetCents,null);assert.equal(sale.approvedAt,'2026-10-20T11:01:00.741Z')
 checks.push('ACK real somente com dois recibos V2 duráveis; worker desligado não cria venda. Aplicação posterior conserva 29 centavos, taxa de três e data original, sem líquido inferido.')
 assert.deepEqual((await Promise.all([post(native),post(caktoFixture({data:[bump,main]}))])).map(result=>result.status),[200,200]);assert.equal(await count('transactions'),2);assert.equal(await count('transaction-events'),2)
 const fresh=caktoOrder('cakto-http-fresh'),changed={...main,amount:0.31};assert.equal((await post(caktoFixture({data:[changed,fresh]}))).status,200)
 assert.equal((await row(main.id)).conflicted,true);assert.equal((await row(fresh.id)).state,'pending');assert.equal(await count('commercial-conflicts'),1);assert.deepEqual((await payload.findByID({collection:'transactions',id:sale.id,depth:0,overrideAccess:true})).projection,sale.projection)
 checks.push('Reenvio HTTP de V2 com ordem trocada conserva dois fatos; lote misto registra colisão e novo recibo no mesmo commit, preservando projeção anterior.')
 const refund={...bump,status:'refunded',refundedAt:'2026-10-20T09:00:00-03:00'};await post(caktoFixture({event:'refund',data:refund}));assert.equal((await processCommercialInbox(payload,(await row(bump.id,'refund')).id)).state,'applied')
 const reverted=(await payload.find({collection:'transactions',where:{externalTransactionId:{equals:bump.id}},overrideAccess:true})).docs[0];assert.equal(reverted.state,'refunded');assert.equal(reverted.refundedCents,null)
 const pending={...main,id:'cakto-http-pix',status:'waiting_payment',paidAt:null};await post(caktoFixture({event:'pix_gerado',data:pending}));assert.equal((await processCommercialInbox(payload,(await row(pending.id,'pix_gerado')).id)).state,'applied')
 const med={...main,id:'cakto-http-med',status:'MED',chargedbackAt:'2026-10-20T09:00:00-03:00'};await post(caktoFixture({event:'chargeback',data:med}));assert.equal((await processCommercialInbox(payload,(await row(med.id,'chargeback')).id)).state,'needs_review');assert.equal((await row(med.id,'chargeback')).errorCode,'dispute_not_final')
 for(const item of (await payload.find({collection:'commercial-inbox',depth:0,limit:100,overrideAccess:true})).docs)for(const forbidden of ['never-store','SYNTHETIC-DOCUMENT',caktoEnv.CAKTO_WEBHOOK_SECRET,signed.get('x-cakto-signature')!])assert.equal(JSON.stringify(item).includes(forbidden),false)
 checks.push('V1 e V2 compartilham histórico sem misturar Pix/estorno/MED. Devolução monetária desconhecida e MED para conciliação; recibos não contêm segredo/assinatura/PII.')
 const attributed=caktoOrder('cakto-http-attributed') as ReturnType<typeof caktoOrder>&{sck?:string};attributed.sck=click.id;const attributedEvent=caktoFixture({data:attributed})
 assert.equal((await post(attributedEvent)).status,200);assert.equal((await post(attributedEvent)).status,200);assert.equal((await processCommercialInbox(payload,(await row(attributed.id)).id)).state,'applied');assert.equal((await row(attributed.id)).attempts,1)
 assert.equal(((await tx('cakto-http-attributed')).projection as {externalClickReference?:string|null}).externalClickReference,click.id)
 const reportDate=new Date().toISOString().slice(0,10),report=await previewFinancialReport(payload,{...seed.owner,collection:'admin-users'},{from:'2026-10-20',through:reportDate}),campaign=report.dimensions.byCampaign.find(item=>item.campaignId===seed.campaign.id&&item.currency==='BRL')!
 assert.equal(campaign.attributedTransactions,1);assert.equal(campaign.attributionCoverage.known,0);assert.equal(campaign.attributedRevenueCents,null);checks.push('Callback HTTP Cakto sintético liga data.sck ao clique consentido e relatório; replay não duplica. Reversões sem quantia mantêm receita null.')
}finally{
 await payload.delete({collection:'checkout-clicks',where:{offer:{in:seed.offers.map(offer=>offer.id)}},overrideAccess:true})
 if(consentVisitId)await payload.delete({collection:'visits',id:consentVisitId,overrideAccess:true})
 if(consentGrantId)await payload.delete({collection:'analytics-grants',id:consentGrantId,overrideAccess:true})
 await seed.cleanup()
}
await mkdir('artifacts/attribution',{recursive:true})
await writeFile('artifacts/attribution/cakto-http-d88.json',JSON.stringify({date:new Date().toISOString(),origin:base,checks,realProvider:false,externalCalls:false,realSales:0,fixturesCleaned:true,limits:'Next loopback e payloads/segredo sintéticos. Aplicação da fila explícita; sem conta ou webhook real da Cakto.'},null,2)+'\n')
console.log(`Cakto HTTP: ${checks.length} grupos aprovados; fixtures limpas.`)
process.exit(0)
