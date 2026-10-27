import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {type PostgresAdapter} from '@payloadcms/db-postgres'
import {seedCommerce,commercialCollections,clearFinancialResolutionFixtures} from '../fixtures/commerce'
import {commercialEventKey,commercialTransactionKey,type NormalizedCommercialEvent,type CommercialAdapter} from '../../src/modules/commerce/events'
import {receiveCommercialWebhook,processCommercialInbox,retryCommercialInbox} from '../../src/modules/commerce/inbox'
import {previewTransactionReview,type ReviewChoice} from '../../src/modules/commerce/transaction-review'
import {decideFinancialResolution,financialStatuses} from '../../src/modules/commerce/financial-resolutions'
import {previewCommercialCSV} from '../../src/modules/commerce/import-preview'
import {stageCommercialImport,commitCommercialImport} from '../../src/modules/commerce/import-service'
import {canonicalCSV,csvFields} from '../fixtures/commercial-csv'
import {atomic} from '../../src/modules/marketing/transaction'
import {up,down} from '../../migrations/20261025_031113_financial_resolutions'
assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true')
const seed=await seedCommerce(),{payload}=seed,actor={...seed.owner,collection:'admin-users'},checks:string[]=[],extras:string[]=[]
const scope={provider:'hotmart' as const,accountKey:'synthetic'}
const event=(eventKey:string,externalTransactionId:string,more:Partial<NormalizedCommercialEvent>={}):NormalizedCommercialEvent=>({...scope,eventKey,externalTransactionId,externalProductId:'synthetic-product',externalOfferId:null,kind:'approved',occurredAt:'2026-10-20T11:01:00.000Z',approvedAt:'2026-10-20T11:01:00.000Z',currency:'BRL',grossCents:10000,feesCents:null,producerNetCents:null,refundedCents:null,chargebackCents:null,refundBasis:null,externalRefundId:null,externalClickReference:null,...more})
const receive=async(e:NormalizedCommercialEvent)=>{const adapter:CommercialAdapter={provider:e.provider,version:'synthetic-financial:1',verify:async()=>true,normalize:bytes=>JSON.parse(Buffer.from(bytes).toString())};return receiveCommercialWebhook(payload,adapter,e,Buffer.from(JSON.stringify(e)),new Headers())}
const row=async(e:NormalizedCommercialEvent)=>(await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey(e)}},depth:0,overrideAccess:true})).docs[0]
const run=async(e:NormalizedCommercialEvent)=>processCommercialInbox(payload,(await row(e)).id)
const tx=async(id:string)=>(await payload.find({collection:'transactions',where:{key:{equals:commercialTransactionKey({...scope,externalTransactionId:id})}},depth:0,overrideAccess:true})).docs[0]
const count=async(collection:'financial-resolutions'|'financial-resolution-applications'|'transaction-events')=>(await payload.count({collection,overrideAccess:true})).totalDocs
const choice=(externalTransactionId='financial-a'):ReviewChoice=>({...scope,externalTransactionId,action:'reconcile',selections:[]})
const plan=async(c:ReviewChoice)=>previewTransactionReview(payload,actor,c)
const input=(p:Awaited<ReturnType<typeof plan>>)=>({...p.choice,planHash:p.planHash,sourceKind:'provider_report',sourceReference:'synthetic-financial-evidence',reason:p.choice.action==='hold'?'evidence_inconclusive':'incorrect_source_reconciled',evidenceVerified:p.choice.action==='reconcile',confirmed:true})
try{
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=(payload.db as unknown as PostgresAdapter).sessions[id].db;await down({db,payload,req});await up({db,payload,req});throw Error('synthetic migration rollback')}),/synthetic migration rollback/)
 checks.push('Migração 25 desce/sobe vazia atomicamente e restaura esquema no rollback.')
 const a=event('financial-shared','financial-a'),b=event('financial-clean-b','financial-b')
 await receive(a);await run(a);await receive(b);await run(b)
 const previousA=await tx('financial-a'),previousB=await tx('financial-b'),factsBefore=await count('transaction-events')
 const collision={...a,externalTransactionId:'financial-b',grossCents:20000};await receive(collision)
 const inspection=await plan(choice()),shared=inspection.context.receipts.find(r=>r.key===commercialEventKey(a))!
 const selected={...choice(),selections:inspection.context.receipts.map(r=>({inboxId:r.id,envelopeHash:r.id===shared.id?r.variants.find(v=>v.source==='conflict')!.hash:null,reason:r.id===shared.id?'source_confirmed' as const:'source_rejected' as const}))}
 const ready=await plan(selected);assert.equal(ready.processable,true)
 const hooks=payload.collections['financial-resolution-applications'].config.hooks,old=hooks.afterChange
 hooks.afterChange=[...(old||[]),async()=>{throw Error('synthetic application rollback')}]
 try{await assert.rejects(decideFinancialResolution(payload,actor,input(ready),randomUUID()),/synthetic application rollback/)}finally{hooks.afterChange=old}
 assert.equal(await count('financial-resolutions'),0);assert.equal(await count('financial-resolution-applications'),0)
 assert.equal((await tx('financial-b')).grossCents,10000);assert.equal((await tx('financial-a')).state,previousA.state)
 checks.push('Falha após escrever aplicação reverte decisão e todas as mudanças financeiras do componente.')
 const key=randomUUID(),results=await Promise.all([decideFinancialResolution(payload,actor,input(ready),key),decideFinancialResolution(payload,actor,input(ready),key.toUpperCase())])
 assert.equal(results[0].id,results[1].id);assert.equal(results.filter(r=>r.duplicate).length,1);assert.equal(await count('financial-resolutions'),1);assert.equal(await count('financial-resolution-applications'),1)
 await assert.rejects(decideFinancialResolution(payload,actor,{...input(ready),sourceReference:'other-synthetic-proof'},key),/idempotency_conflict/)
 const applied=await tx('financial-b'),rejected=await tx('financial-a')
 assert.equal(applied.grossCents,20000);assert.equal(applied.needsReview,false);assert.equal(applied.producerNetCents,null);assert.equal(applied.ebook,previousB.ebook);assert.equal(applied.externalProductId,previousB.externalProductId)
 assert.equal(rejected.needsReview,true);assert.equal(rejected.state,'unknown');assert.equal(rejected.grossCents,10000);assert.equal(await count('transaction-events'),factsBefore);assert.equal((await row(a)).conflicted,true)
 let statuses=await financialStatuses(payload,[a,b]);assert.equal(statuses.get(commercialTransactionKey(b))?.state,'active');assert.equal(statuses.get(commercialTransactionKey(a))?.state,'review')
 checks.push('Decisão concorrente idempotente aplica somente variante escolhida; originais/fatos preservados, descartado desconhecido em revisão, líquido desconhecido não vira zero.')
 const csv=[...csvFields];csv[2]='financial-b';csv[4]='';csv[8]='20000';csv[10]=''
 const csvPreview=await previewCommercialCSV(payload,canonicalCSV([csv]));assert.equal(csvPreview.lines[0].classification,'matched')
 const matchedBatch=await stageCommercialImport(payload,actor,canonicalCSV([csv]),{sourceKind:'provider_report',sourceReference:'synthetic-financial-csv',reason:'report_reconciliation'},randomUUID());assert.equal(matchedBatch.state,'ready')
 assert.equal((await commitCommercialImport(payload,actor,matchedBatch.id,{confirmed:true,planHash:matchedBatch.planHash})).state,'confirmed')
 await receive(collision);assert.equal((await tx('financial-b')).needsReview,false)
 assert.equal((await retryCommercialInbox(payload,(await row(b)).id,'reviewed_envelope',actor)).state,'unchanged');await assert.rejects(retryCommercialInbox(payload,(await row(a)).id,'reviewed_envelope',actor),/financial_resolution_review_required/)
 checks.push('Consumidor CSV reconhece decisão vigente e repetição de variante já julgada não invalida projeção.')
 const refund=event('financial-refund','financial-b',{kind:'refunded',grossCents:20000,refundedCents:3000,refundBasis:'operation',externalRefundId:'synthetic-refund-1',occurredAt:'2026-10-21T11:01:00.000Z'})
 await receive(refund);assert.equal((await tx('financial-b')).needsReview,true);assert.equal((await financialStatuses(payload,[b])).get(commercialTransactionKey(b))?.state,'review')
 const workerHooks=payload.collections['financial-resolution-applications'].config.hooks,workerOld=workerHooks.afterChange;workerHooks.afterChange=[...(workerOld||[]),async()=>{throw Error('synthetic worker application rollback')}]
 try{await assert.rejects(run(refund),/synthetic worker application rollback/)}finally{workerHooks.afterChange=workerOld}
 assert.equal((await tx('financial-b')).refundedCents,null);assert.equal(await count('financial-resolution-applications'),1);assert.equal((await row(refund)).state,'pending')
 assert.equal((await run(refund)).state,'applied');assert.equal((await tx('financial-b')).refundedCents,3000);assert.equal((await tx('financial-b')).grossCents,20000);assert.equal((await tx('financial-b')).needsReview,false)
 assert.equal(await count('financial-resolutions'),1);assert.equal(await count('financial-resolution-applications'),2);assert.equal(await count('transaction-events'),factsBefore+1)
 const refundFact=(await payload.find({collection:'transaction-events',where:{key:{equals:commercialEventKey(refund)}},limit:1,depth:0,overrideAccess:true})).docs[0]
 await payload.update({collection:'transaction-events',id:refundFact.id,overrideAccess:true,data:{transaction:previousA.id}})
 await assert.rejects(run(refund),/financial_history_integrity/);assert.equal(await count('financial-resolution-applications'),2)
 await payload.update({collection:'transaction-events',id:refundFact.id,overrideAccess:true,data:{transaction:previousB.id}})
 await run(refund);assert.equal(await count('financial-resolution-applications'),2)
 statuses=await financialStatuses(payload,[b]);assert.equal(statuses.get(commercialTransactionKey(b))?.state,'active')
 checks.push('Novo reembolso nativo íntegro suspende validade até aplicação; worker reaplica escolha e novo fato atomicamente, sem duplicar decisão, aplicação ou fato.')
 await receive({...collision,grossCents:25000});assert.equal((await tx('financial-b')).needsReview,true);assert.equal((await financialStatuses(payload,[b])).get(commercialTransactionKey(b))?.state,'review')
 const held=await plan({...choice(),action:'hold'});assert.equal(held.processable,true)
 await decideFinancialResolution(payload,actor,input(held),randomUUID());assert.equal((await tx('financial-b')).grossCents,20000);assert.equal((await tx('financial-b')).needsReview,true)
 const afterHold=event('financial-after-hold','financial-b',{grossCents:20000});await receive(afterHold);assert.equal((await run(afterHold)).state,'needs_review');await assert.rejects(retryCommercialInbox(payload,(await row(afterHold)).id,'reviewed_envelope',actor),/financial_resolution_review_required/)
 await assert.rejects(decideFinancialResolution(payload,actor,input(ready),randomUUID()),/stale_plan/)
 checks.push('Nova variante invalida o componente inteiro; hold mantém valores anteriores em quarentena, impede continuação e prévia antiga não confirma.')
 const restore=await plan({...selected,selections:[...selected.selections,{inboxId:(await row(refund)).id,envelopeHash:(await row(refund)).envelopeHash,reason:'source_confirmed'},{inboxId:(await row(afterHold)).id,envelopeHash:null,reason:'source_rejected'}]})
 assert.equal(restore.processable,true)
 await decideFinancialResolution(payload,actor,input(restore),randomUUID());assert.equal((await tx('financial-b')).needsReview,false)
 const head=(await payload.find({collection:'financial-resolutions',sort:'-revision',limit:1,overrideAccess:true,depth:0})).docs[0];assert.equal(head.revision,3);assert.equal((head.previousIds as string[]).length,1)
 await assert.rejects(payload.update({collection:'financial-resolutions',id:head.id,overrideAccess:true,data:{sourceReference:'tampered-synthetic'}}))
 await assert.rejects(payload.delete({collection:'financial-resolutions',id:head.id,...seed.auth}))
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=(payload.db as unknown as PostgresAdapter).sessions[id].db;await down({db,payload,req})}),/financial/)
 await assert.rejects(payload.create({collection:'financial-resolution-applications',...seed.auth,data:{key:'0'.repeat(64),resolution:head.id,sourceHash:head.sourceHash,coverage:[],outcomes:[],actorType:'worker',occurredAt:new Date().toISOString()}}))
 checks.push('Nova revisão substitui hold com referência à decisão anterior. Trilhas negam alteração, remoção, escrita pública e downgrade com evidência.')
 const correctedOffer=await payload.create({collection:'offers',...seed.auth,data:{name:'Oferta financeira sintética corrigida',provider:'hotmart',accountKey:'synthetic',externalProductId:'financial-correct-product',externalOfferId:'financial-correct-offer',ebook:seed.books[1].id,currency:'BRL',active:false}});extras.push(correctedOffer.id)
 const c=event('financial-c-source','financial-c');await receive(c);await run(c)
 await receive({...c,externalProductId:'financial-correct-product',externalOfferId:'financial-correct-offer',grossCents:30000})
 const inspectC=await plan(choice('financial-c')),selectedC={...choice('financial-c'),selections:inspectC.context.receipts.map(r=>({inboxId:r.id,envelopeHash:r.variants.find(v=>v.source==='conflict')!.hash,reason:'source_confirmed' as const}))}
 const readyC=await plan(selectedC);await decideFinancialResolution(payload,actor,input(readyC),randomUUID())
 const projectedC=await tx('financial-c');assert.equal(projectedC.externalProductId,'synthetic-product');assert.equal(projectedC.ebook,seed.books[0].id);assert.equal(projectedC.effectiveProductId,'financial-correct-product');assert.equal(projectedC.effectiveEbook,seed.books[1].id);assert.equal(projectedC.effectiveOffer,correctedOffer.id)
 const correctedCSV=[...csvFields];correctedCSV[2]='financial-c';correctedCSV[3]='financial-correct-product';correctedCSV[4]='financial-correct-offer';correctedCSV[8]='30000';correctedCSV[10]='';assert.equal((await previewCommercialCSV(payload,canonicalCSV([correctedCSV]))).lines[0].classification,'matched')
 await assert.rejects(payload.update({collection:'offers',id:correctedOffer.id,...seed.auth,data:{ebook:seed.books[0].id}}))
 const link=event('financial-component-link','financial-b',{grossCents:20000});await receive(link);await receive({...link,externalTransactionId:'financial-c'})
 assert.equal((await tx('financial-b')).needsReview,true);assert.equal((await tx('financial-c')).needsReview,true)
 const mergedInspection=await plan(choice()),mergedSelections=[...restore.choice.selections,...selectedC.selections,{inboxId:(await row(link)).id,envelopeHash:(await row(link)).envelopeHash,reason:'source_confirmed' as const}]
 const merged=await plan({...choice(),selections:mergedSelections});assert.equal(merged.context.financialHeads?.length,2);assert.equal(merged.processable,true)
 assert.equal(mergedInspection.context.transactionScopes.length,3)
 const race=await Promise.allSettled([decideFinancialResolution(payload,actor,input(merged),randomUUID()),decideFinancialResolution(payload,actor,input(merged),randomUUID())]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1)
 const mergedHead=(await payload.find({collection:'financial-resolutions',sort:'-revision',limit:1,overrideAccess:true,depth:0})).docs[0];assert.equal((mergedHead.previousIds as string[]).length,2)
 assert.equal((await tx('financial-b')).needsReview,false);assert.equal((await tx('financial-c')).needsReview,false)
 checks.push('Produto/livro/oferta efetivos corrigidos preservam referências originais e guard de identidade. Ponte nova invalida dois componentes; revisão completa referencia ambos, e confirmações concorrentes têm um vencedor.')
}finally{for(const collection of commercialCollections)await payload.delete({collection,where:{id:{exists:true}},overrideAccess:true});await clearFinancialResolutionFixtures(payload);for(const id of extras)await payload.delete({collection:'offers',id,overrideAccess:true});await seed.cleanup()}
await mkdir('artifacts/financial-resolutions',{recursive:true})
await writeFile('artifacts/financial-resolutions/local-results.json',JSON.stringify({date:new Date().toISOString(),checks,schemaMigrations:25,externalCalls:false,limits:'Somente evidência sintética persistida e atestação do operador. Sem homologação nativa, recebimento, lucro, UI ou produção.'},null,2)+'\n')
console.log(`Decisões financeiras: ${checks.length} grupos aprovados; fixtures limpas.`)
process.exit(0)
