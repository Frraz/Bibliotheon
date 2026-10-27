import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {type PostgresAdapter} from '@payloadcms/db-postgres'
import {seedCommerce,commercialCollections} from '../fixtures/commerce'
import {commercialEventKey,type NormalizedCommercialEvent,type CommercialAdapter} from '../../src/modules/commerce/events'
import {receiveCommercialWebhook,processCommercialInbox,retryCommercialInbox} from '../../src/modules/commerce/inbox'
import {commercialCollisionKeys} from '../../src/modules/commerce/collisions'
import {previewTransactionReview,type ReviewChoice,type ReviewSelection} from '../../src/modules/commerce/transaction-review'
import {transactionReviewRequest} from '../../src/modules/commerce/transaction-review-http'
import {previewCommercialCSV} from '../../src/modules/commerce/import-preview'
import {stageCommercialImport,commitCommercialImport} from '../../src/modules/commerce/import-service'
import {canonicalCSV,csvFields} from '../fixtures/commercial-csv'
import {atomic} from '../../src/modules/marketing/transaction'
import {up,down} from '../../migrations/20261025_014000_commercial_review_lookup'
assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true','Somente fixtures exclusivas.')
const seed=await seedCommerce(),{payload}=seed,actor={...seed.owner,collection:'admin-users'},checks:string[]=[],extras:string[]=[]
const scope={provider:'hotmart' as const,accountKey:'synthetic'}
const event=(key:string,transaction:string,more:Partial<NormalizedCommercialEvent>={}):NormalizedCommercialEvent=>({...scope,eventKey:key,externalTransactionId:transaction,externalProductId:'synthetic-product',externalOfferId:null,kind:'approved',occurredAt:'2026-10-20T11:01:00.000Z',approvedAt:'2026-10-20T11:01:00.000Z',currency:'BRL',grossCents:10000,feesCents:null,producerNetCents:null,refundedCents:null,chargebackCents:null,refundBasis:null,externalRefundId:null,externalClickReference:null,...more})
const receive=async(e:NormalizedCommercialEvent)=>{
 const adapter:CommercialAdapter={provider:e.provider,version:'synthetic-review:1',verify:async()=>true,normalize:bytes=>JSON.parse(Buffer.from(bytes).toString())}
 return receiveCommercialWebhook(payload,adapter,e,Buffer.from(JSON.stringify(e)),new Headers())
}
const row=async(e:NormalizedCommercialEvent)=>(await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey(e)}},depth:0,overrideAccess:true})).docs[0]
const run=async(e:NormalizedCommercialEvent)=>processCommercialInbox(payload,(await row(e)).id)
const transaction=async(id:string)=>(await payload.find({collection:'transactions',where:{and:[{provider:{equals:'hotmart'}},{accountKey:{equals:'synthetic'}},{externalTransactionId:{equals:id}}]},depth:0,overrideAccess:true})).docs[0]
const choice=(transactionId='review-a',selections:ReviewSelection[]=[]):ReviewChoice=>({...scope,externalTransactionId:transactionId,action:'reconcile',selections})
const preview=(input:ReviewChoice=choice())=>previewTransactionReview(payload,actor,input)
const snapshot=async()=>{const result:Record<string,unknown>={};for(const collection of commercialCollections)result[collection]=(await payload.find({collection,limit:10001,sort:'id',depth:0,overrideAccess:true})).docs;return result}
try{
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=(payload.db as unknown as PostgresAdapter).sessions[id].db;await down({db,payload,req});await up({db,payload,req});throw new Error('synthetic review migration rollback')}),/synthetic review migration rollback/)
 await assert.rejects(previewTransactionReview(payload,null,choice()),/forbidden/)
 const a=event('review-shared-a','review-a'),b=event('review-clean-b','review-b')
 await receive(a);assert.equal((await run(a)).state,'applied');await receive(b);assert.equal((await run(b)).state,'applied')
 const previousA=await transaction('review-a'),previousB=await transaction('review-b')
 const collision={...a,externalTransactionId:'review-b',grossCents:20000}
 assert.equal((await receive(collision)).state,'conflict')
 for(const [id,original]of [['review-a',previousA],['review-b',previousB]] as const){const current=await transaction(id);assert.equal(current.needsReview,true);assert.equal(current.state,original.state);assert.equal(current.grossCents,original.grossCents);assert.equal(current.ebook,original.ebook)}
 await payload.update({collection:'transactions',id:previousB.id,data:{needsReview:false,reviewReason:null},overrideAccess:true})
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=(payload.db as unknown as PostgresAdapter).sessions[id].db;await down({db,payload,req});await up({db,payload,req});const checked=await payload.findByID({collection:'transactions',id:previousB.id,overrideAccess:true,req});assert.equal(checked.needsReview,true);assert.equal(checked.grossCents,10000);throw new Error('synthetic legacy quarantine rollback')}),/synthetic legacy quarantine rollback/)
 const bLater=event('review-clean-b-later','review-b');await receive(bLater);assert.equal((await run(bLater)).state,'needs_review');assert.equal((await transaction('review-b')).grossCents,10000)
 assert.equal((await row(bLater)).errorCode,'transaction_conflicted');await assert.rejects(retryCommercialInbox(payload,(await row(bLater)).id,'reviewed_envelope',actor),/transaction_conflicted/)
 checks.push('Colisão cujo segundo envelope nomeia outra transação sinaliza ambos os lados sem editar valores/fatos. Migração repara flags legadas; mesmo flag ausente não permite nova aplicação/retry da segunda transação.')

 const c=event('review-clean-c','review-c');await receive(c);assert.equal((await run(c)).state,'applied')
 const link=event('review-shared-b','review-b');await receive(link);await receive({...link,externalTransactionId:'review-c'})
 const before=await snapshot(),inspect=await preview()
 assert.equal(inspect.context.transactionScopes.length,3);assert.equal(inspect.context.receipts.length,5);assert.equal(inspect.context.receipts.reduce((sum,receipt)=>sum+receipt.variants.length,0),7)
 assert.equal(inspect.committable,false);assert.equal(inspect.processable,false);assert.ok(inspect.blockers.includes('selection_coverage_required'))
 const otherRoot=await preview(choice('review-c'));assert.equal(otherRoot.sourceHash,inspect.sourceHash)
 const selections:ReviewSelection[]=inspect.context.receipts.map(receipt=>({inboxId:receipt.id,envelopeHash:receipt.variants.find(variant=>variant.source==='original')!.hash,reason:'source_confirmed'}))
 const selected=await preview(choice('review-a',selections));assert.equal(selected.processable,true);assert.equal(selected.outcomes.filter(outcome=>outcome.state==='projected').length,3);assert.equal(selected.committable,false)
 assert.deepEqual(await snapshot(),before)
 const shared=inspect.context.receipts.find(receipt=>receipt.key===commercialEventKey(a))!
 const alternative=selections.map(selection=>selection.inboxId===shared.id?{...selection,envelopeHash:shared.variants.find(variant=>variant.source==='conflict')!.hash}:selection)
 const conflicting=await preview(choice('review-a',alternative));assert.equal(conflicting.processable,false);assert.ok(conflicting.blockers.includes('projection_requires_review'))
 const held=await preview({...choice(),action:'hold'});assert.equal(held.processable,true);assert.ok(held.outcomes.every(outcome=>outcome.state==='needs_review'));assert.deepEqual(await snapshot(),before)
 checks.push('Expansão A–B–C cobre cinco recibos/sete variantes e é simétrica por raiz. Cobertura completa permite apenas simular projeções; conflito financeiro e seleção parcial bloqueiam. Hold conserva desconhecidos, e todas as prévias deixam ledger/auditoria intactos.')

 const csv=[...csvFields];csv[2]='review-b';csv[4]='';const bytes=canonicalCSV([csv])
 assert.equal((await previewCommercialCSV(payload,bytes)).lines[0].reason,'transaction_conflicted')
 const batch=await stageCommercialImport(payload,actor,bytes,{sourceKind:'provider_report',sourceReference:'collision-review-synthetic',reason:'report_reconciliation'},'00000000-0000-0000-0000-000000000073')
 assert.equal(batch.state,'blocked');await assert.rejects(commitCommercialImport(payload,actor,batch.id,{confirmed:true,planHash:batch.planHash}),/batch_not_ready/)
 const d={...a,externalTransactionId:'review-d'};await receive(d)
 const dFresh=event('review-clean-d','review-d');await receive(dFresh);assert.equal((await run(dFresh)).state,'needs_review');assert.equal(await transaction('review-d'),undefined)
 assert.equal((await preview(choice('review-d'))).context.transactionScopes.length,4)
 checks.push('CSV e confirmação também bloqueiam transação presente só em variante de colisão. Novo ID ainda sem projeção permanece em quarentena quando outro recibo limpo chega; nenhum registro de venda é criado.')

 for(const provider of ['kiwify','cakto'] as const){const e=event('review-shared-a','review-a',{provider});await receive(e);assert.equal((await run(e)).state,'applied');assert.equal((await commercialCollisionKeys(payload,[e])).size,0)}
 const offer=await payload.create({collection:'offers',...seed.auth,data:{name:'Conta distinta sintética',provider:'hotmart',accountKey:'review-other-account',externalProductId:'synthetic-product',ebook:seed.books[0].id,currency:'BRL',active:false}});extras.push(offer.id)
 const isolated=event('review-shared-a','review-a',{accountKey:'review-other-account'});await receive(isolated);assert.equal((await run(isolated)).state,'applied')
 assert.equal((await preview({...choice(),accountKey:'review-other-account'})).context.transactionScopes.length,1)
 checks.push('Hotmart/Kiwify/Cakto e aliases de conta isolam as chaves; colisão de uma conta não bloqueia a aplicação de eventos independentes.')

 const conflict=(await payload.find({collection:'commercial-conflicts',limit:1,overrideAccess:true})).docs[0],originalEnvelope=conflict.envelope
 await payload.update({collection:'commercial-conflicts',id:conflict.id,data:{envelope:{...(originalEnvelope as object),grossCents:1}},overrideAccess:true})
 await assert.rejects(preview(),/review_source_integrity/)
 await payload.update({collection:'commercial-conflicts',id:conflict.id,data:{envelope:originalEnvelope},overrideAccess:true})
 const stateBefore=await snapshot(),hooks=payload.collections['commercial-audit'].config.hooks,old=hooks.afterChange
 hooks.afterChange=[...(old||[]),async({doc})=>{if(doc.action==='conflict')throw new Error('synthetic review receipt rollback')}]
 try{await assert.rejects(receive({...a,externalTransactionId:'review-never-committed'}),/synthetic review receipt rollback/)}finally{hooks.afterChange=old}
 assert.deepEqual(await snapshot(),stateBefore)
 checks.push('Hash divergente recusa prévia sem aceitar envelope adulterado. Falha de auditoria na recepção reverte nova variante e flags; nenhum ACK falso ou mudança parcial de projeção.')

 const raceA=event('review-race-collision','review-race-a'),raceB=event('review-race-clean','review-race-b')
 await receive(raceA);assert.equal((await run(raceA)).state,'applied');await receive(raceB)
 const race=await Promise.all([receive({...raceA,externalTransactionId:raceB.externalTransactionId}),run(raceB)])
 assert.equal(race[0].state,'conflict');assert.ok(['applied','needs_review'].includes(race[1].state))
 assert.equal((await transaction('review-race-a')).needsReview,true)
 const racedB=await transaction('review-race-b');if(racedB)assert.equal(racedB.needsReview,true)
 assert.equal((await commercialCollisionKeys(payload,[raceA,raceB])).size,2)
 checks.push('Recepção de colisão e worker da segunda transação executados concorrentemente convergem para quarentena dos dois IDs; não sobra projeção considerada válida sem revisão.')

 const login=await payload.login({collection:'admin-users',data:{email:seed.owner.email,password:seed.password}}),origin=new URL(process.env.PUBLIC_SITE_URL||'http://127.0.0.1:3000').origin
 const request=(input:unknown,authenticated=true,site=origin)=>new Request(origin+'/api/v1/admin/transaction-resolutions/preview',{method:'POST',headers:{Origin:site,'Content-Type':'application/json',...(authenticated?{Authorization:`JWT ${login.token}`}:{})},body:JSON.stringify(input)})
 assert.equal((await transactionReviewRequest(request(choice(),false),payload)).status,403);assert.equal((await transactionReviewRequest(request(choice(),true,'https://other.invalid'),payload)).status,403)
 assert.equal((await transactionReviewRequest(request({...choice(),actor:'forged'}),payload)).status,422)
 const baseline=await snapshot(),response=await transactionReviewRequest(request(choice()),payload);assert.equal(response.status,200);assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal((await response.json()).committable,false);assert.deepEqual(await snapshot(),baseline)
 await assert.rejects(preview(choice('unseen-transaction')),/review_source_not_found/)
 checks.push('Handler usa autenticação Payload real e origem exata, recusa ator forjado e retorna apenas prévia privada/provisória. Sem fonte não inventa transação; nenhum endpoint de confirmação ou escrita financeira foi adicionado.')
}finally{
 for(const collection of commercialCollections)await payload.delete({collection,where:{id:{exists:true}},overrideAccess:true})
 for(const id of extras)await payload.delete({collection:'offers',id,overrideAccess:true})
 await seed.cleanup()
}
await mkdir('artifacts/transaction-review',{recursive:true})
await writeFile('artifacts/transaction-review/local-results.json',JSON.stringify({date:new Date().toISOString(),checks,externalCalls:false,migrationUnderTest:24,limits:'Prévia de componente e quarentena; P02 permanece parcial sem decisão financeira durável/aplicação. Sem provedores reais, relatório nativo, liquidação/custos, UI ou homologação externa.'},null,2)+'\n')
console.log(`Revisão de transações: ${checks.length} grupos aprovados; fixtures limpas.`)
process.exit(0)
