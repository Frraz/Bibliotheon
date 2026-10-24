import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {seedCommerce,commercialCollections} from '../fixtures/commerce'
import {kiwifyFixture,kiwifyEnv,kiwifyRequest,seedKiwifyCatalog} from '../fixtures/kiwify'
import {handleKiwifyWebhook} from '../../src/integrations/kiwify/webhook-http'
import {processCommercialInbox,retryCommercialInbox,processCommercialQueue} from '../../src/modules/commerce/inbox'
import {commercialEventKey} from '../../src/modules/commerce/events'

const seed=await seedCommerce(),{payload}=seed,checks:string[]=[],actor={...seed.owner,collection:'admin-users' as const}
const ingest=(value:unknown,token=kiwifyEnv.KIWIFY_WEBHOOK_TOKEN,env:Record<string,string|undefined>=kiwifyEnv)=>handleKiwifyWebhook(kiwifyRequest(value,token),async()=>payload,env)
const key=(id:string,type='order_approved',accountKey='synthetic')=>commercialEventKey({provider:'kiwify',accountKey,eventKey:nativeKey(id,type)})
// Provider documents order_id + webhook_event_type as its replay identity.
function nativeKey(id:string,type:string){return createHash('sha256').update(JSON.stringify([id,type])).digest('hex')}
const row=async(id:string,type='order_approved',account='synthetic')=>(await payload.find({collection:'commercial-inbox',where:{key:{equals:key(id,type,account)}},limit:1,depth:0,overrideAccess:true})).docs[0]
const tx=async(id:string,accountKey='synthetic')=>(await payload.find({collection:'transactions',where:{and:[{provider:{equals:'kiwify'}},{externalTransactionId:{equals:id}},{accountKey:{equals:accountKey}}]},depth:0,overrideAccess:true})).docs[0]
const run=async(id:string,type='order_approved')=>processCommercialInbox(payload,(await row(id,type)).id)
try{
 await seedKiwifyCatalog(seed)
 const first=kiwifyFixture({id:'kiwify-approved'})
 assert.equal((await ingest(first,'wrong')).status,401);assert.equal((await payload.count({collection:'commercial-inbox',overrideAccess:true})).totalDocs,0)
 assert.deepEqual((await Promise.all([ingest(first),ingest(first)])).map(response=>response.status),[200,200])
 assert.equal((await payload.count({collection:'commercial-inbox',overrideAccess:true})).totalDocs,1);assert.equal(await tx(first.order_id),undefined)
 assert.equal((await processCommercialQueue(payload,{enabled:false})).state,'disabled');assert.equal((await run(first.order_id)).state,'applied')
 let sale=await tx(first.order_id);assert.equal(sale.state,'approved');assert.equal(sale.grossCents,9990);assert.equal(sale.feesCents,990);assert.equal(sale.producerNetCents,null);assert.equal(sale.approvedAt,'2026-10-20T11:01:00.000Z');assert.equal(sale.offer,seed.offers[1].id)
 for(const marker of ['never-store','SYNTHETIC-DOCUMENT','never-trust','never-use','never-infer'])assert.equal(JSON.stringify((await row(first.order_id)).envelope).includes(marker),false)
 checks.push('HMAC inválido não persiste. Reenvio concorrente gera um recibo e ACK durável; worker desligado não aplica venda. Aplicação explícita usa produto/oferta, centavos e aprovação original, sem PII ou líquido inferido.')

 const refund=kiwifyFixture({id:first.order_id,event:'order_refunded',status:'refunded'});refund.refunded_at='2026-10-20 09:00'
 assert.equal((await ingest(refund)).status,200);assert.equal((await run(first.order_id,'order_refunded')).state,'applied')
 sale=await tx(first.order_id);assert.equal(sale.state,'refunded');assert.equal(sale.refundedCents,null)
 assert.equal((await ingest(first)).status,200);assert.equal((await tx(first.order_id)).state,'refunded')
 const reverse=kiwifyFixture({id:'kiwify-reverse-order',event:'order_refunded',status:'refunded'});reverse.refunded_at=refund.refunded_at
 await ingest(reverse);assert.equal((await run(reverse.order_id,'order_refunded')).state,'applied')
 await ingest(kiwifyFixture({id:reverse.order_id}));assert.equal((await run(reverse.order_id)).state,'applied');assert.equal((await tx(reverse.order_id)).state,'refunded')
 checks.push('Reembolso com refunded_at conserva quantia desconhecida; replay de aprovação e chegada invertida não apagam reversão nem confundem pagamento com recebimento.')

 const chargeback=kiwifyFixture({id:first.order_id,event:'chargeback',status:'chargedback'}),before=structuredClone((await tx(first.order_id)).projection)
 assert.equal((await ingest(chargeback)).status,200);assert.equal((await run(first.order_id,'chargeback')).state,'needs_review');assert.equal((await row(first.order_id,'chargeback')).errorCode,'unknown_event_time');assert.deepEqual((await tx(first.order_id)).projection,before)
 const declined=kiwifyFixture({id:'kiwify-declined',event:'order_rejected',status:'refused'});await ingest(declined);assert.equal((await run(declined.order_id,'order_rejected')).state,'needs_review');assert.equal((await tx(declined.order_id)).grossCents,null)
 checks.push('Chargeback/recusa sem instante financeiro confirmado permanecem para conciliação. updated_at não substitui evidência temporal; projeção anterior permanece preservada.')

 const mutable=structuredClone(first);mutable.updated_at='2026-10-21 09:00';mutable.Customer.email='changed@example.invalid';assert.equal((await ingest(mutable)).status,200);assert.equal((await payload.count({collection:'commercial-conflicts',overrideAccess:true})).totalDocs,0)
 mutable.Commissions.charge_amount=10000;assert.equal((await ingest(mutable)).status,200);assert.equal((await ingest(mutable)).status,200);assert.equal((await row(first.order_id)).conflicted,true);assert.equal((await payload.count({collection:'commercial-conflicts',overrideAccess:true})).totalDocs,1);assert.deepEqual((await tx(first.order_id)).projection,before)
 checks.push('Mudança em dados pessoais/updated_at não altera digest; mesma ordem/tipo com valor diferente abre colisão uma vez e preserva histórico/projeção.')

 for(const extra of [{sale_type:'affiliate',Customer:null},{subscription_id:'never-store-subscriber'},{product_type:'physical'}]){
  const value={...kiwifyFixture({id:`kiwify-shape-${checks.length}-${Object.keys(extra)[0]}`}),...extra};await ingest(value);assert.equal((await run(value.order_id)).state,'needs_review');assert.equal((await row(value.order_id)).errorCode,'unsupported_purchase_shape')
 }
 const pending=kiwifyFixture({id:'kiwify-pix',event:'pix_created',status:'waiting_payment'});pending.approved_date='';await ingest(pending);assert.equal((await run(pending.order_id,'pix_created')).state,'applied');assert.equal((await tx(pending.order_id)).state,'pending');assert.equal((await tx(pending.order_id)).approvedAt,null)
 const ignored=kiwifyFixture({id:'kiwify-subscription',event:'subscription_canceled'});await ingest(ignored);assert.equal((await row(ignored.order_id,'subscription_canceled')).state,'ignored');assert.equal(await tx(ignored.order_id),undefined)
 checks.push('Afiliado/assinatura/físico ficam em revisão; PIX gerado permanece pendente. Cancelamento de assinatura não é reembolso e não cria transação.')

 const unknown=kiwifyFixture({id:'kiwify-catalog'});unknown.Product.product_id='kiwify-new-product';await ingest(unknown);assert.equal((await run(unknown.order_id)).state,'needs_review');assert.equal(await tx(unknown.order_id),undefined)
 const mapped=await payload.create({collection:'offers',...seed.auth,data:{name:'Kiwify sintético',provider:'kiwify',accountKey:'synthetic',externalProductId:unknown.Product.product_id,externalOfferId:unknown.Product.product_offer_id,ebook:seed.books[0].id,active:false,currency:'BRL'}})
 await retryCommercialInbox(payload,(await row(unknown.order_id)).id,'catalog_updated',actor);assert.equal((await run(unknown.order_id)).state,'applied');assert.equal((await tx(unknown.order_id)).offer,mapped.id)
 checks.push('Produto desconhecido não é inferido: mapeamento exato e retry owner auditado recuperam o envelope, conservando tentativas e identidade.')

 const rollback=kiwifyFixture({id:'kiwify-rollback'}),hooks=payload.collections['commercial-audit'].config.hooks,old=hooks.afterChange
 hooks.afterChange=[...(old||[]),async()=>{throw new Error('synthetic Kiwify rollback')}]
 try{assert.equal((await ingest(rollback)).status,503)}finally{hooks.afterChange=old}
 assert.equal(await row(rollback.order_id),undefined);assert.equal((await ingest(rollback)).status,200)
 const otherEnv={...kiwifyEnv,KIWIFY_ACCOUNT_KEY:'synthetic-two',KIWIFY_WEBHOOK_TOKEN:'synthetic-kiwify-second-account-token-32-characters'}
 await payload.create({collection:'offers',...seed.auth,data:{name:'Kiwify conta dois',provider:'kiwify',accountKey:'synthetic-two',externalProductId:first.Product.product_id,externalOfferId:first.Product.product_offer_id,ebook:seed.books[0].id,active:false,currency:'BRL'}})
 assert.equal((await ingest(first,kiwifyEnv.KIWIFY_WEBHOOK_TOKEN,otherEnv)).status,401);assert.equal((await ingest(first,otherEnv.KIWIFY_WEBHOOK_TOKEN,otherEnv)).status,200)
 assert.equal((await processCommercialInbox(payload,(await row(first.order_id,'order_approved','synthetic-two')).id)).state,'applied');assert.notEqual((await tx(first.order_id,'synthetic-two')).id,(await tx(first.order_id)).id)
 assert.equal((await ingest(kiwifyFixture({id:'kiwify-old-token'}),kiwifyEnv.KIWIFY_WEBHOOK_PREVIOUS_TOKEN)).status,200)
 checks.push('Rollback da auditoria impede ACK sem commit; reenvio recupera. Outra conta exige outro token e mantém namespace próprio; token anterior explícito aceita rotação.')
}finally{
 for(const collection of commercialCollections)await payload.delete({collection,where:{id:{exists:true}},overrideAccess:true})
 await payload.delete({collection:'offers',where:{id:{not_in:seed.offers.map(offer=>offer.id)}},overrideAccess:true})
 await seed.cleanup()
}
await mkdir('artifacts/kiwify',{recursive:true})
await writeFile('artifacts/kiwify/local-results.json',JSON.stringify({date:new Date().toISOString(),checks,environment:'PostgreSQL loopback, dados sintéticos e handler HTTP real',externalCalls:false,realSales:0,limits:'Sem conta Kiwify ou homologação externa. Chargeback e recusa sem instante confirmado exigem conciliação. Afiliado/recorrência/parcelamentos especiais fora da projeção automática inicial; líquido, liquidação, atribuição e quantia devolvida não inferidos.'},null,2)+'\n')
console.log(`Kiwify: ${checks.length} grupos locais aprovados; fixtures limpas.`)
process.exit(0)
