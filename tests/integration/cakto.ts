import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {seedCommerce,commercialCollections} from '../fixtures/commerce'
import {caktoFixture,caktoOrder,caktoEnv,caktoRequest,seedCaktoCatalog} from '../fixtures/cakto'
import {handleCaktoWebhook} from '../../src/integrations/cakto/webhook-http'
import {commercialEventKey} from '../../src/modules/commerce/events'
import {processCommercialInbox,processCommercialQueue,retryCommercialInbox} from '../../src/modules/commerce/inbox'
const seed=await seedCommerce(),{payload}=seed,checks:string[]=[],actor={...seed.owner,collection:'admin-users' as const}
const ingest=(value:unknown,secret=caktoEnv.CAKTO_WEBHOOK_SECRET,env:Record<string,string|undefined>=caktoEnv)=>handleCaktoWebhook(caktoRequest(value,secret),async()=>payload,env)
const row=async(id:string,type='purchase_approved',accountKey='synthetic')=>(await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey({provider:'cakto',accountKey,eventKey:createHash('sha256').update(JSON.stringify([id,type])).digest('hex')})}},depth:0,limit:1,overrideAccess:true})).docs[0]
const tx=async(id:string,accountKey='synthetic')=>(await payload.find({collection:'transactions',where:{and:[{provider:{equals:'cakto'}},{accountKey:{equals:accountKey}},{externalTransactionId:{equals:id}}]},depth:0,limit:1,overrideAccess:true})).docs[0]
const run=async(id:string,type='purchase_approved')=>processCommercialInbox(payload,(await row(id,type)).id)
const count=async(collection:typeof commercialCollections[number])=>(await payload.count({collection,overrideAccess:true})).totalDocs
try{
 await seedCaktoCatalog(seed)
 const first=caktoOrder('cakto-approved')
 assert.equal((await ingest(caktoFixture({data:first}),'wrong')).status,401);assert.equal(await count('commercial-inbox'),0)
 assert.deepEqual((await Promise.all([ingest(caktoFixture({data:first})),ingest(caktoFixture({data:first}))])).map(result=>result.status),[200,200]);assert.equal(await count('commercial-inbox'),1)
 assert.equal(await tx(first.id),undefined);assert.equal((await processCommercialQueue(payload,{enabled:false})).state,'disabled');assert.equal((await run(first.id)).state,'applied')
 const sale=await tx(first.id);assert.equal(sale.state,'approved');assert.equal(sale.grossCents,9990);assert.equal(sale.feesCents,990);assert.equal(sale.producerNetCents,null);assert.equal(sale.approvedAt,'2026-10-20T11:01:00.741Z');assert.equal(sale.offer,seed.offers[2].id)
 for(const marker of ['never-store','never-use','never-infer','SYNTHETIC-DOCUMENT',caktoEnv.CAKTO_WEBHOOK_SECRET])assert.equal(JSON.stringify((await row(first.id)).envelope).includes(marker),false)
 checks.push('Assinatura inválida não persiste. V1 concorrente gera um recibo e ACK após commit; recepção independe do worker. Aplicação explícita conserva ids, total decimal exato, taxa e aprovação original, sem segredo/PII/líquido inferido.')

 const refund={...first,status:'refunded',refundedAt:'2026-10-20T09:00:00-03:00'};await ingest(caktoFixture({event:'refund',data:refund}));assert.equal((await run(first.id,'refund')).state,'applied');assert.equal((await tx(first.id)).state,'refunded');assert.equal((await tx(first.id)).refundedCents,null)
 const reversal={...refund,status:'chargedback',chargedbackAt:'2026-10-20T10:00:00-03:00'};await ingest(caktoFixture({event:'chargeback',data:reversal}));assert.equal((await run(first.id,'chargeback')).state,'applied');assert.equal((await tx(first.id)).state,'chargeback');assert.equal((await tx(first.id)).chargebackCents,null)
 const reverse={...refund,id:'cakto-reversed-arrival'};await ingest(caktoFixture({event:'refund',data:reverse}));assert.equal((await run(reverse.id,'refund')).state,'applied');await ingest(caktoFixture({data:{...first,id:reverse.id}}));assert.equal((await run(reverse.id)).state,'applied');assert.equal((await tx(reverse.id)).state,'refunded')
 checks.push('Reembolso/chargeback usam suas datas sem deduzir quantia/recebimento; aprovação recebida depois da devolução não regride o estado financeiro.')

 const main=caktoOrder('cakto-batch-main'),bump={...caktoOrder('cakto-batch-bump'),offer_type:'orderbump',parent_order:'synthetic-parent'};main.amount=0.29;main.fees=0.03
 assert.deepEqual((await Promise.all([ingest(caktoFixture({data:[main,bump]})),ingest(caktoFixture({data:[bump,main]}))])).map(result=>result.status),[200,200])
 for(const id of [main.id,bump.id]){assert.equal((await row(id)).state,'pending');assert.equal(await tx(id),undefined);assert.equal((await run(id)).state,'applied')}
 assert.equal((await tx(main.id)).grossCents,29);assert.equal((await tx(main.id)).feesCents,3);assert.equal((await tx(bump.id)).grossCents,9990)
 checks.push('V2 em ordem invertida concorrente não causa deadlock/duplicação: cada pedido tem recibo/identidade próprios e centavos exatos; ACK cobre o lote inteiro.')

 const invalid=caktoOrder('cakto-batch-invalid-companion'),beforeInvalid=await count('commercial-inbox')
 assert.equal((await ingest(caktoFixture({data:[invalid,{id:'malformed'}]}))).status,422);assert.equal(await count('commercial-inbox'),beforeInvalid);assert.equal(await row(invalid.id),undefined)
 const rollbackA=caktoOrder('cakto-rollback-a'),rollbackB=caktoOrder('cakto-rollback-b'),hooks=payload.collections['commercial-audit'].config.hooks,old=hooks.afterChange,beforeAudit=await count('commercial-audit');let emitted=0
 hooks.afterChange=[...(old||[]),async()=>{if(++emitted===2)throw new Error('synthetic second receipt audit failure')}]
 try{assert.equal((await ingest(caktoFixture({data:[rollbackA,rollbackB]}))).status,503)}finally{hooks.afterChange=old}
 assert.equal(emitted,2);assert.equal(await row(rollbackA.id),undefined);assert.equal(await row(rollbackB.id),undefined);assert.equal(await count('commercial-audit'),beforeAudit)
 assert.equal((await ingest(caktoFixture({data:[rollbackA,rollbackB]}))).status,200)
 checks.push('Item malformado rejeita todo V2 antes do banco. Falha na segunda auditoria reverte inclusive primeiro recibo/auditoria; nunca há ACK ou persistência parcial, e reenvio recupera.')

 const aProjection=structuredClone((await tx(main.id)).projection),bProjection=structuredClone((await tx(bump.id)).projection),beforeConflicts=await count('commercial-conflicts'),changedA={...main,amount:0.31},changedB={...bump,amount:100}
 assert.deepEqual((await Promise.all([ingest(caktoFixture({data:[changedA,changedB]})),ingest(caktoFixture({data:[changedB,changedA]}))])).map(result=>result.status),[200,200])
 assert.equal(await count('commercial-conflicts'),beforeConflicts+2);assert.equal((await row(main.id)).conflicted,true);assert.equal((await row(bump.id)).conflicted,true);assert.deepEqual((await tx(main.id)).projection,aProjection);assert.deepEqual((await tx(bump.id)).projection,bProjection)
 const fresh=caktoOrder('cakto-mixed-batch');assert.equal((await ingest(caktoFixture({data:[changedA,fresh]}))).status,200);assert.equal((await row(fresh.id)).state,'pending')
 checks.push('Colisões concorrentes de duas transações aplicadas usam locks ordenados e registram dois conflitos sem substituir projeções. Lote misto com colisão confirmada também persiste seu pedido novo antes do ACK.')

 const med={...first,id:'cakto-med',status:'MED',chargedbackAt:'2026-10-20T09:00:00-03:00'};await ingest(caktoFixture({event:'chargeback',data:med}));assert.equal((await run(med.id,'chargeback')).state,'needs_review');assert.equal((await row(med.id,'chargeback')).errorCode,'dispute_not_final');assert.equal((await tx(med.id)).grossCents,null)
 const declined={...first,id:'cakto-declined',status:'refused',paidAt:null};await ingest(caktoFixture({event:'purchase_refused',data:declined}));assert.equal((await run(declined.id,'purchase_refused')).state,'needs_review');assert.equal((await row(declined.id,'purchase_refused')).errorCode,'unknown_event_time')
 const recurring={...first,id:'cakto-recurring',subscription:{subscriber:'never-store-subscriber'}};await ingest(caktoFixture({data:recurring}));assert.equal((await run(recurring.id)).state,'needs_review');assert.equal((await row(recurring.id)).errorCode,'unsupported_purchase_shape')
 const pending={...first,id:'cakto-pix',status:'waiting_payment',paidAt:null};await ingest(caktoFixture({event:'pix_gerado',data:pending}));assert.equal((await run(pending.id,'pix_gerado')).state,'applied');assert.equal((await tx(pending.id)).state,'pending');assert.equal((await tx(pending.id)).approvedAt,null)
 checks.push('MED/pré-chargeback não confirma perda definitiva; recusa sem instante e assinatura ficam em revisão. Pix gerado permanece pendente, sem aprovação inventada.')

 const ignored={...first,id:'cakto-ignored'};await ingest(caktoFixture({event:'refund_requested',data:ignored}));assert.equal((await row(ignored.id,'refund_requested')).state,'ignored');assert.equal(await tx(ignored.id),undefined)
 const cart={offer:{id:'synthetic-cart-offer'},product:{id:'synthetic-cart-product'},createdAt:'2026-10-20T08:00:00-03:00',customerEmail:'never-store@example.invalid'},beforeCart=await count('transactions'),beforeCartInbox=await count('commercial-inbox')
 assert.equal((await ingest(caktoFixture({event:'checkout_abandonment',data:cart}))).status,200);assert.equal((await ingest(caktoFixture({event:'checkout_abandonment',data:[{...cart,customerEmail:'other@example.invalid'}]}))).status,200);assert.equal(await count('transactions'),beforeCart);assert.equal(await count('commercial-inbox'),beforeCartInbox+1)
 checks.push('Pedido de reembolso não é devolução. Abandono V1/V2 sem id de pedido é ignorado/agrupado por produto/oferta/data sem PII, contato ou contagem de compradores/abandono.')

 const unknown={...first,id:'cakto-unknown-product',product:{...first.product,id:'cakto-new-product'}};await ingest(caktoFixture({data:unknown}));assert.equal((await run(unknown.id)).state,'needs_review');assert.equal(await tx(unknown.id),undefined)
 const mapped=await payload.create({collection:'offers',...seed.auth,data:{name:'Cakto sintético',provider:'cakto',accountKey:'synthetic',externalProductId:unknown.product.id,externalOfferId:first.offer.id,ebook:seed.books[0].id,active:false,currency:'BRL'}})
 await retryCommercialInbox(payload,(await row(unknown.id)).id,'catalog_updated',actor);assert.equal((await run(unknown.id)).state,'applied');assert.equal((await tx(unknown.id)).offer,mapped.id)
 const future={...first,id:'cakto-future',createdAt:new Date(Date.now()+3600000).toISOString()};await ingest(caktoFixture({data:future}));assert.equal((await run(future.id)).state,'needs_review');assert.equal((await row(future.id)).errorCode,'future_event_time');assert.equal(await tx(future.id),undefined)
 checks.push('Produto desconhecido exige mapeamento exato/retry owner auditado; data nativa futura fica em revisão antes da criação de transação.')

 const otherEnv={...caktoEnv,CAKTO_ACCOUNT_KEY:'synthetic-two',CAKTO_WEBHOOK_SECRET:'synthetic-cakto-second-account-secret-32-characters'}
 await payload.create({collection:'offers',...seed.auth,data:{name:'Cakto conta dois',provider:'cakto',accountKey:'synthetic-two',externalProductId:first.product.id,externalOfferId:first.offer.id,ebook:seed.books[0].id,active:false,currency:'BRL'}})
 assert.equal((await ingest(caktoFixture({data:first}),caktoEnv.CAKTO_WEBHOOK_SECRET,otherEnv)).status,401);assert.equal((await ingest(caktoFixture({data:first}),otherEnv.CAKTO_WEBHOOK_SECRET,otherEnv)).status,200)
 assert.equal((await processCommercialInbox(payload,(await row(first.id,'purchase_approved','synthetic-two')).id)).state,'applied');assert.notEqual((await tx(first.id,'synthetic-two')).id,(await tx(first.id)).id)
 assert.equal((await ingest(caktoFixture({id:'cakto-previous'}),caktoEnv.CAKTO_WEBHOOK_PREVIOUS_SECRET)).status,200)
 for(const item of (await payload.find({collection:'commercial-inbox',depth:0,limit:100,overrideAccess:true})).docs)for(const marker of ['never-store','SYNTHETIC-DOCUMENT',caktoEnv.CAKTO_WEBHOOK_SECRET])assert.equal(JSON.stringify(item).includes(marker),false)
 checks.push('Outro segredo seleciona namespace próprio configurado, sem confiar no secret/conta do corpo. Aceitação anterior explícita permite transição; nenhum recibo conserva segredo, dados de acesso ou PII.')
}finally{
 for(const collection of commercialCollections)await payload.delete({collection,where:{id:{exists:true}},overrideAccess:true})
 await payload.delete({collection:'offers',where:{id:{not_in:seed.offers.map(offer=>offer.id)}},overrideAccess:true})
 await seed.cleanup()
}
await mkdir('artifacts/cakto',{recursive:true})
await writeFile('artifacts/cakto/local-results.json',JSON.stringify({date:new Date().toISOString(),checks,environment:'PostgreSQL loopback, dados nativos sintéticos V1/V2 e handler HTTP real',externalCalls:false,realSales:0,limits:'Sem conta Cakto ou homologação. Recusa/instante desconhecido, assinatura/físico e MED exigem conciliação. Valores devolvidos, liquidação, líquido e atribuição não inferidos. V2 limitado a 25 itens/256 KiB; abandono ignorado agrupado sem identificação de comprador.'},null,2)+'\n')
console.log(`Cakto: ${checks.length} grupos locais aprovados; fixtures limpas.`)
process.exit(0)
