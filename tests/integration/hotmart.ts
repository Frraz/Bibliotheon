import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {seedCommerce} from '../fixtures/commerce'
import {hotmartFixture,hotmartEnv,seedHotmartCatalog} from '../fixtures/hotmart'
import {handleHotmartWebhook} from '../../src/integrations/hotmart/webhook-http'
import {processCommercialInbox,retryCommercialInbox,processCommercialQueue} from '../../src/modules/commerce/inbox'
import {commercialEventKey} from '../../src/modules/commerce/events'

const seed=await seedCommerce(),{payload}=seed,checks:string[]=[],now=Date.now()-120000,actor={...seed.owner,collection:'admin-users' as const}
const make=(extra:Parameters<typeof hotmartFixture>[0]={})=>hotmartFixture({now,...extra})
const request=(value:unknown,token=hotmartEnv.HOTMART_HOTTOK)=>new Request('http://127.0.0.1/api/v1/webhooks/hotmart',{method:'POST',headers:{'Content-Type':'application/json','X-HOTMART-HOTTOK':token},body:JSON.stringify(value)})
const ingest=(value:unknown,token=hotmartEnv.HOTMART_HOTTOK,env:Record<string,string|undefined>=hotmartEnv)=>handleHotmartWebhook(request(value,token),async()=>payload,env)
const row=async(id:string,accountKey='synthetic')=>(await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey({provider:'hotmart',accountKey,eventKey:id})}},limit:1,depth:0,overrideAccess:true})).docs[0]
const tx=async(transaction:string,accountKey='synthetic')=>(await payload.find({collection:'transactions',where:{and:[{externalTransactionId:{equals:transaction}},{accountKey:{equals:accountKey}}]},depth:0,overrideAccess:true})).docs[0]
const run=async(id:string)=>processCommercialInbox(payload,(await row(id)).id,{now:Date.now()})
try{
 await seedHotmartCatalog(seed)
 const first=make({id:'native-approved',transaction:'native-purchase'})
 assert.equal((await ingest(first,'wrong')).status,401);assert.equal((await payload.count({collection:'commercial-inbox',overrideAccess:true})).totalDocs,0)
 const duplicate=await Promise.all([ingest(first),ingest(first)])
 assert.deepEqual(duplicate.map(x=>x.status),[200,200]);assert.deepEqual(await duplicate[0].json(),{code:'accepted'});assert.equal((await payload.count({collection:'commercial-inbox',overrideAccess:true})).totalDocs,1)
 assert.equal(await tx('native-purchase'),undefined);assert.equal((await row(first.id)).state,'pending');assert.equal((await processCommercialQueue(payload,{enabled:false})).state,'disabled')
 assert.equal((await run(first.id)).state,'applied');let sale=await tx('native-purchase');assert.equal(sale.state,'approved');assert.equal(sale.grossCents,9990);assert.equal(sale.feesCents,null);assert.equal(sale.producerNetCents,null);assert.equal(sale.approvedAt,new Date(first.data.purchase.approved_date).toISOString());assert.equal(sale.offer,seed.offers[0].id)
 const saved=JSON.stringify((await row(first.id)).envelope);for(const fragment of ['never-store','SYNTHETIC-DOCUMENT','private-pix','untrusted-personal','untrusted-body'])assert.equal(saved.includes(fragment),false)
 checks.push('Autenticação antes da persistência; duplicatas simultâneas recebem ACK após um commit. Recepção independe do worker desligado; aplicação posterior usa ucode/oferta, total pago e data original, sem PII/comissão/liquidação inferida.')

 const refund=make({id:'native-refund',event:'PURCHASE_REFUNDED',transaction:'native-purchase',now:now+30000});refund.data.purchase.status='PARTIALLY_REFUNDED';refund.data.purchase.approved_date=first.data.purchase.approved_date
 assert.equal((await ingest(refund)).status,200);assert.equal((await run(refund.id)).state,'applied');sale=await tx('native-purchase');assert.equal(sale.state,'partially_refunded');assert.equal(sale.refundedCents,null)
 const complete=make({id:'native-complete',event:'PURCHASE_COMPLETE',transaction:'native-purchase',now:now+60000});complete.data.purchase.approved_date=first.data.purchase.approved_date
 assert.equal((await ingest(complete)).status,200);assert.equal((await run(complete.id)).state,'applied');assert.equal((await tx('native-purchase')).state,'partially_refunded');assert.equal((await tx('native-purchase')).approvedAt,sale.approvedAt)
 const reversal=make({id:'native-chargeback',event:'PURCHASE_CHARGEBACK',transaction:'native-purchase',now:now+90000});reversal.data.purchase.approved_date=first.data.purchase.approved_date;assert.equal((await ingest(reversal)).status,200);assert.equal((await run(reversal.id)).state,'applied');assert.equal((await tx('native-purchase')).chargebackCents,null);assert.equal(((await tx('native-purchase')).projection as {refundAndChargebackOverlap:boolean}).refundAndChargebackOverlap,true)
 checks.push('Reembolso parcial sem quantia fica desconhecido; COMPLETE tardio reforça aprovação original sem apagar reversão. Chargeback permanece separado, com sobreposição explícita e sem duplicar devolução.')

 const beforeConflict=(await tx('native-purchase')).projection,conflict=structuredClone(first);conflict.data.purchase.full_price.value=98.9
 assert.equal((await ingest(conflict)).status,200);assert.equal((await ingest(conflict)).status,200);assert.equal((await payload.count({collection:'commercial-conflicts',overrideAccess:true})).totalDocs,1);assert.equal((await row(first.id)).conflicted,true);assert.deepEqual((await tx('native-purchase')).projection,beforeConflict)
 checks.push('Colisão de payload autenticado é ACK durável, inventariada uma vez e marcada em revisão; não reescreve projeção nem cria retry externo infinito.')

 const future=make({id:'native-future',transaction:'native-future',now:Date.now()+3600000});future.data.purchase.approved_date=first.data.purchase.approved_date
 assert.equal((await ingest(future)).status,200);assert.equal((await run(future.id)).state,'needs_review');assert.equal((await row(future.id)).errorCode,'future_event_time');assert.equal(await tx('native-future'),undefined)
 const yen=make({id:'native-yen',transaction:'native-yen'});yen.data.purchase.full_price.currency_value='JPY';assert.equal((await ingest(yen)).status,200);assert.equal((await run(yen.id)).state,'needs_review');assert.equal((await tx('native-yen')).state,'unknown');assert.equal((await tx('native-yen')).grossCents,null)
 const recurring=make({id:'native-recurring',transaction:'native-recurring'});Object.assign(recurring.data,{subscription:{status:'ACTIVE',subscriber:{code:'never-store-subscriber'}}});assert.equal((await ingest(recurring)).status,200);assert.equal((await run(recurring.id)).state,'needs_review');assert.equal((await row(recurring.id)).errorCode,'unsupported_purchase_shape');assert.equal(JSON.stringify((await row(recurring.id)).envelope).includes('never-store-subscriber'),false)
 checks.push('Data de criação futura continua em revisão mesmo com aprovação original passada. Moeda com outra precisão e assinatura ficam duráveis/unknown, sem aplicar uma venda avulsa ou guardar assinante.')

 const unknown=make({id:'native-unknown',transaction:'native-unknown'});unknown.data.product.ucode='synthetic-new-product';assert.equal((await ingest(unknown)).status,200);assert.equal((await run(unknown.id)).state,'needs_review');assert.equal(await tx('native-unknown'),undefined)
 const newOffer=await payload.create({collection:'offers',...seed.auth,data:{name:'Mapeamento Hotmart sintético',provider:'hotmart',accountKey:'synthetic',externalProductId:unknown.data.product.ucode,externalOfferId:unknown.data.purchase.offer.code,ebook:seed.books[0].id,active:false,currency:'BRL'}})
 await retryCommercialInbox(payload,(await row(unknown.id)).id,'catalog_updated',actor);assert.equal((await run(unknown.id)).state,'applied');assert.equal((await tx('native-unknown')).offer,newOffer.id)
 checks.push('Produto desconhecido não cria transação; cadastro exato e retry owner auditado aplicam o envelope preservado, sem inferir oferta primária ou preço.')

 const rollback=make({id:'native-rollback',transaction:'native-rollback'}),hooks=payload.collections['commercial-audit'].config.hooks,old=hooks.afterChange
 hooks.afterChange=[...(old||[]),async()=>{throw new Error('synthetic native receipt failure')}]
 try{assert.equal((await ingest(rollback)).status,503)}finally{hooks.afterChange=old}
 assert.equal(await row(rollback.id),undefined);assert.equal((await ingest(rollback)).status,200)
 const ignored=make({id:'native-ignored',event:'SUBSCRIPTION_CANCELLATION'});assert.equal((await ingest(ignored)).status,200);assert.equal((await row(ignored.id)).state,'ignored');assert.equal((await row(ignored.id)).transaction,null)
 checks.push('Falha na auditoria de recepção reverte inbox e responde 503; reenvio recupera. Evento não financeiro fica ignorado/auditado sem nova transação.')

 const secondEnv={...hotmartEnv,HOTMART_ACCOUNT_KEY:'synthetic-two',HOTMART_HOTTOK:'synthetic-second-native-token'}
 await payload.create({collection:'offers',...seed.auth,data:{name:'Conta sintética separada',provider:'hotmart',accountKey:'synthetic-two',externalProductId:first.data.product.ucode,externalOfferId:first.data.purchase.offer.code,ebook:seed.books[0].id,active:false,currency:'BRL'}})
 assert.equal((await ingest(first,hotmartEnv.HOTMART_HOTTOK,secondEnv)).status,401);assert.equal((await ingest(first,secondEnv.HOTMART_HOTTOK,secondEnv)).status,200)
 const secondRow=await row(first.id,'synthetic-two');assert.equal((await processCommercialInbox(payload,secondRow.id)).state,'applied');assert.notEqual((await tx('native-purchase','synthetic-two')).id,(await tx('native-purchase')).id)
 assert.equal((await ingest(make({id:'native-previous',transaction:'native-previous'}),hotmartEnv.HOTMART_PREVIOUS_HOTTOK)).status,200)
 checks.push('Mesmo ID de evento/transação em outra conta exige o outro token e gera identidade independente. Token anterior explicitamente configurado aceita transição; conta do corpo não escolhe namespace.')
}finally{
 // All extra offers are exclusively synthetic mappings created after seedCommerce asserted an empty ledger.
 const {commercialCollections}=await import('../fixtures/commerce')
 for(const collection of commercialCollections)await payload.delete({collection,where:{id:{exists:true}},overrideAccess:true})
 await payload.delete({collection:'offers',where:{id:{not_in:seed.offers.map(x=>x.id)}},overrideAccess:true})
 await seed.cleanup()
}
await mkdir('artifacts/hotmart',{recursive:true})
await writeFile('artifacts/hotmart/local-results.json',JSON.stringify({date:new Date().toISOString(),checks,environment:'PostgreSQL loopback; payloads nativos v2 sintéticos; handler HTTP real sem provedor externo',externalCalls:false,realSales:0,limits:'Sem conta, transação ou webhook real; autenticação, campos e retry precisam de homologação pelo proprietário. Origem de clique não atribuída; taxas/líquido/liquidação/reembolso monetário não inferidos.'},null,2)+'\n')
console.log(`Hotmart v2: ${checks.length} grupos locais aprovados; fixtures limpas.`)
process.exit(0)
