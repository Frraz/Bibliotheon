import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {getPayload} from 'payload'
import {sql,type PostgresAdapter} from '@payloadcms/db-postgres'
import config from '../../src/payload.config'
import {seedCommerce,seedLegacyOffer,clearCatalogResolutionFixtures,commercialCollections} from '../fixtures/commerce'
import {catalogScopeKey,type CatalogScope} from '../../src/modules/commerce/catalog-mapping'
import {previewCatalogResolution,decideCatalogResolution,readCatalogDecisions} from '../../src/modules/commerce/catalog-resolutions'
import {catalogResolutionRequest} from '../../src/modules/commerce/catalog-resolution-http'
import {receiveCommercialWebhook,processCommercialInbox,retryCommercialInbox} from '../../src/modules/commerce/inbox'
import {commercialEventKey,type NormalizedCommercialEvent,type CommercialAdapter} from '../../src/modules/commerce/events'
import {previewCommercialCSV} from '../../src/modules/commerce/import-preview'
import {stageCommercialImport,commitCommercialImport} from '../../src/modules/commerce/import-service'
import {canonicalCSV,csvFields} from '../fixtures/commercial-csv'
import {atomic} from '../../src/modules/marketing/transaction'
import {up,down} from '../../migrations/20261025_003403_catalog_resolutions'
assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true','Exige fixtures exclusivas.')
assert.ok(['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL||'').hostname))
const payload=await getPayload({config}),adapter=payload.db as unknown as PostgresAdapter
for(const collection of ['admin-users','catalog-resolutions','transaction-events'] as const)assert.equal((await payload.count({collection,overrideAccess:true})).totalDocs,0)
await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=adapter.sessions[id].db;await down({db,payload,req});await up({db,payload,req});throw new Error('synthetic migration rollback')}),/synthetic migration rollback/)
const sqlError=(message:string)=>(error:unknown)=>{
 let current=error as {message?:string;cause?:unknown}|undefined
 for(let i=0;current&&i<5;i++,current=current.cause as typeof current)if(current.message?.includes(message))return true
 return false
}
const seed=await seedCommerce(),actor={...seed.owner,collection:'admin-users' as const},checks:string[]=[],extraOffers:string[]=[]
const scope:CatalogScope={provider:'hotmart',accountKey:'synthetic',externalProductId:'synthetic-product',externalOfferId:null}
const choice=(id:string|null,more:Partial<CatalogScope>={})=>({...scope,...more,action:id?'associate' as const:'hold' as const,targetOfferId:id,targetEbookId:null})
const source={sourceKind:'provider_report',sourceReference:'verified-synthetic-report',reason:'historical_mapping_correction',evidenceVerified:true,confirmed:true}
const preview=(target:string|null,more:Partial<CatalogScope>={})=>previewCatalogResolution(payload,actor,choice(target,more))
const confirm=(plan:Awaited<ReturnType<typeof preview>>,key:string=randomUUID())=>decideCatalogResolution(payload,actor,{...plan.choice,planHash:plan.planHash,...source,...(plan.choice.action==='hold'?{reason:'evidence_inconclusive',evidenceVerified:false}:{})},key)
const count=async()=>(await payload.count({collection:'catalog-resolutions',overrideAccess:true})).totalDocs
const event=(key:string,more:Partial<NormalizedCommercialEvent>={}):NormalizedCommercialEvent=>({...scope,eventKey:key,externalTransactionId:'resolution-history',kind:'approved',occurredAt:'2026-10-20T11:01:00.000Z',approvedAt:'2026-10-20T11:01:00.000Z',currency:'BRL',grossCents:9990,feesCents:990,refundedCents:null,producerNetCents:null,chargebackCents:null,externalClickReference:null,refundBasis:null,externalRefundId:null,...more})
const receive=async(value:NormalizedCommercialEvent)=>{
 const adapter:CommercialAdapter={provider:value.provider,version:'synthetic-catalog-resolution:1',verify:async()=>true,normalize:bytes=>JSON.parse(Buffer.from(bytes).toString())}
 await receiveCommercialWebhook(payload,adapter,value,Buffer.from(JSON.stringify(value)),new Headers())
 return(await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey(value)}},depth:0,overrideAccess:true})).docs[0]
}
const fields=(transaction='resolution-history')=>{const values=[...csvFields];values[2]=transaction;values[4]='';return values}
try{
 await assert.rejects(payload.find({collection:'catalog-resolutions',user:null,overrideAccess:false}))
 await assert.rejects(payload.create({collection:'catalog-resolutions',...seed.auth,data:{} as never}))
 await assert.rejects(previewCatalogResolution(payload,null,choice(seed.offers[0].id)),/forbidden/)
 const initial=await receive(event('before-correction'));assert.equal((await processCommercialInbox(payload,initial.id)).state,'applied')
 const originalTransaction=(await payload.find({collection:'transactions',depth:0,overrideAccess:true})).docs[0]
 const originalFacts=(await payload.find({collection:'transaction-events',depth:0,overrideAccess:true})).docs
 const originalInbox=await payload.findByID({collection:'commercial-inbox',id:initial.id,depth:0,overrideAccess:true})
 const legacy=await seedLegacyOffer(seed,{name:'Outro cadastro histórico sintético',...scope,ebook:seed.books[1].id,currency:'BRL',active:false});extraOffers.push(legacy.id)
 assert.equal((await previewCommercialCSV(payload,canonicalCSV([fields()]))).lines[0].reason,'ambiguous_product')
 const plan=await preview(legacy.id);assert.equal(plan.currentRevision,0);assert.equal(plan.snapshot.transactions.length,1);assert.equal(await count(),0)
 await assert.rejects(preview(legacy.id,{provider:'kiwify'}),/target_scope_mismatch/)
 await assert.rejects(preview(legacy.id,{externalOfferId:'unknown-offer'}),/target_scope_mismatch/)
 await assert.rejects(decideCatalogResolution(payload,actor,{...plan.choice,planHash:plan.planHash,...source,evidenceVerified:false},randomUUID()),/evidence_required/)
 const key=randomUUID(),decisions=await Promise.all([confirm(plan,key),confirm(plan,key.toUpperCase())]),first=decisions[0]
 assert.equal(first.id,decisions[1].id);assert.equal(decisions.filter(row=>row.duplicate).length,1);assert.equal(await count(),1)
 assert.equal((await payload.find({collection:'catalog-resolutions',...seed.auth,depth:0})).totalDocs,1)
 await assert.rejects(decideCatalogResolution(payload,actor,{...plan.choice,planHash:plan.planHash,...source,sourceReference:'different-proof'},key),/idempotency_conflict/)
 assert.deepEqual((await payload.find({collection:'transactions',depth:0,overrideAccess:true})).docs[0],originalTransaction)
 assert.deepEqual((await payload.find({collection:'transaction-events',depth:0,overrideAccess:true})).docs,originalFacts)
 assert.deepEqual(await payload.findByID({collection:'commercial-inbox',id:initial.id,depth:0,overrideAccess:true}),originalInbox)
 checks.push('Migração vazia/down-up revertida; coleção nega leitura anônima/escritas owner. Prévia não escreve; prova/alvo/escopo inválidos são recusados. Confirmação concorrente upper/lower UUID é idempotente e conserva transação, fatos e inbox originais.')

 const matched=await previewCommercialCSV(payload,canonicalCSV([fields()]));assert.equal(matched.lines[0].classification,'matched');assert.equal(matched.lines[0].effectiveEbookId,seed.books[1].id);assert.equal(matched.lines[0].catalogResolutionId,first.id)
 assert.equal((await readCatalogDecisions(payload,[catalogScopeKey({...scope,provider:'cakto'}),catalogScopeKey({...scope,accountKey:'other'})])).length,0)
 const next=await receive(event('after-correction',{occurredAt:'2026-10-20T11:02:00.000Z'}));assert.equal((await processCommercialInbox(payload,next.id)).state,'applied')
 const transaction=await payload.findByID({collection:'transactions',id:originalTransaction.id,depth:0,overrideAccess:true})
 assert.equal(transaction.ebook,originalTransaction.ebook);assert.equal(transaction.offer,originalTransaction.offer);assert.equal(transaction.grossCents,9990)
 const newFact=(await payload.find({collection:'transaction-events',where:{inbox:{equals:next.id}},depth:0,overrideAccess:true})).docs[0]
 assert.equal(newFact.catalogResolution,first.id)
 assert.deepEqual(await payload.findByID({collection:'transaction-events',id:originalFacts[0].id,depth:0,overrideAccess:true}),originalFacts[0])
 checks.push('CSV expõe associação efetiva e decisão sem reescrever livro/oferta originais. Novo evento aplica ao mesmo histórico, sem segunda transação, e referencia a decisão usada; fatos antigos intactos. Outros provedores/contas não herdam a decisão.')

 const wrongOffer=await payload.create({collection:'offers',...seed.auth,data:{name:'Único cadastro errado sintético',provider:'hotmart',accountKey:'synthetic',externalProductId:'single-wrong-book',ebook:seed.books[0].id,currency:'BRL',active:false}});extraOffers.push(wrongOffer.id)
 const firstWrong=await receive(event('single-before',{externalProductId:'single-wrong-book',externalTransactionId:'single-wrong-transaction'}));assert.equal((await processCommercialInbox(payload,firstWrong.id)).state,'applied')
 const wrongTransaction=(await payload.find({collection:'transactions',where:{externalTransactionId:{equals:'single-wrong-transaction'}},depth:0,overrideAccess:true})).docs[0]
 const bookOnly=await previewCatalogResolution(payload,actor,{...scope,externalProductId:'single-wrong-book',action:'associate',targetOfferId:null,targetEbookId:seed.books[1].id})
 const correctedBook=await confirm(bookOnly)
 assert.equal((await payload.findByID({collection:'transactions',id:wrongTransaction.id,depth:0,overrideAccess:true})).ebook,seed.books[0].id)
 const bookFields=fields('single-wrong-transaction');bookFields[3]='single-wrong-book'
 const effectiveBook=await previewCommercialCSV(payload,canonicalCSV([bookFields]));assert.equal(effectiveBook.lines[0].classification,'matched');assert.equal(effectiveBook.lines[0].effectiveEbookId,seed.books[1].id)
 const singleAfter=await receive(event('single-after',{externalProductId:'single-wrong-book',externalTransactionId:'single-wrong-transaction'}));assert.equal((await processCommercialInbox(payload,singleAfter.id)).state,'applied')
 assert.equal((await payload.findByID({collection:'transactions',id:wrongTransaction.id,depth:0,overrideAccess:true})).ebook,seed.books[0].id)
 assert.equal((await payload.find({collection:'transaction-events',where:{inbox:{equals:singleAfter.id}},overrideAccess:true,depth:0})).docs[0].catalogResolution,correctedBook.id)
 assert.equal((await payload.count({collection:'offers',where:{externalProductId:{equals:'single-wrong-book'}},overrideAccess:true})).totalDocs,1)
 checks.push('Cadastro único associado ao livro errado é corrigido por livro verificado, sem criar oferta duplicada. CSV e novos fatos usam a decisão; transação/cadastro originais permanecem preservados e nenhuma oferta externa é inferida.')

 const explicitOffer=await payload.create({collection:'offers',...seed.auth,data:{name:'Oferta conhecida sintética',provider:'hotmart',accountKey:'synthetic',externalProductId:'known-historical-offer',externalOfferId:'known-offer',ebook:seed.books[0].id,currency:'BRL',active:false}});extraOffers.push(explicitOffer.id)
 const knownScope={externalProductId:'known-historical-offer',externalOfferId:'known-offer',externalTransactionId:'known-offer-transaction'}
 const knownBefore=await receive(event('known-before',knownScope));assert.equal((await processCommercialInbox(payload,knownBefore.id)).state,'applied')
 const knownPlan=await previewCatalogResolution(payload,actor,{...scope,externalProductId:knownScope.externalProductId,externalOfferId:knownScope.externalOfferId,action:'associate',targetOfferId:null,targetEbookId:seed.books[1].id})
 const knownDecision=await confirm(knownPlan)
 const missingOffer=await receive(event('known-after',{...knownScope,externalOfferId:null}));assert.equal((await processCommercialInbox(payload,missingOffer.id)).state,'applied')
 const knownFact=(await payload.find({collection:'transaction-events',where:{inbox:{equals:missingOffer.id}},depth:0,overrideAccess:true})).docs[0]
 assert.equal(knownFact.catalogResolution,knownDecision.id);assert.equal((knownFact.envelope as {externalOfferId:unknown}).externalOfferId,null)
 checks.push('Evento sem oferta conserva o envelope null; a associação da transação usa a oferta já conhecida em fatos anteriores e a decisão desse escopo exato, sem inferir primária ou reescrever a fonte.')

 const unprocessed=await receive(event('retry-after-hold',{externalTransactionId:'resolution-held'}))
 const holdPlan=await preview(null),samePreview=await preview(seed.offers[0].id)
 const races=await Promise.allSettled([confirm(holdPlan),confirm(samePreview)]);assert.equal(races.filter(row=>row.status==='fulfilled').length,1);assert.equal(races.filter(row=>row.status==='rejected').length,1)
 // Whichever decision wins, append an explicit hold for the following scenarios.
 const held=await confirm(await preview(null));assert.ok(held.revision>=3)
 assert.equal((await confirm(plan,key)).current,false)
 assert.equal((await processCommercialInbox(payload,unprocessed.id)).state,'needs_review')
 assert.equal((await payload.findByID({collection:'commercial-inbox',id:unprocessed.id,overrideAccess:true})).errorCode,'catalog_resolution_held')
 assert.equal((await previewCommercialCSV(payload,canonicalCSV([fields('new-during-hold')]))).lines[0].reason,'catalog_resolution_held')
 const beforeRollback=await count(),rollbackPlan=await preview(legacy.id),hooks=payload.collections['catalog-resolutions'].config.hooks,oldHooks=hooks.afterChange
 hooks.afterChange=[...(oldHooks||[]),async()=>{throw new Error('synthetic decision rollback')}]
 try{await assert.rejects(confirm(rollbackPlan),/synthetic decision rollback/)}finally{hooks.afterChange=oldHooks}
 assert.equal(await count(),beforeRollback)
 const restored=await confirm(rollbackPlan);assert.equal(restored.revision,held.revision+1)
 await retryCommercialInbox(payload,unprocessed.id,'catalog_updated',actor);assert.equal((await processCommercialInbox(payload,unprocessed.id)).state,'applied')
 checks.push('Decisões concorrentes sobre a mesma prévia têm um vencedor e uma stale, sem fork. Hold suspende inbox e CSV; nova revisão associada exige retry explícito e aplica depois. Repetição de revisão supersedida informa current=false. Falha tardia reverte auditoria/revisão integralmente.')

 const staged=await stageCommercialImport(payload,actor,canonicalCSV([fields('stale-by-resolution')]),{sourceKind:'provider_report',sourceReference:'staged-proof',reason:'report_reconciliation'},randomUUID())
 assert.equal(staged.state,'ready')
 await confirm(await preview(seed.offers[0].id))
 const inboxBeforeStale=(await payload.count({collection:'commercial-inbox',overrideAccess:true})).totalDocs
 assert.equal((await commitCommercialImport(payload,actor,staged.id,{confirmed:true,planHash:staged.planHash})).state,'stale')
 assert.equal((await payload.count({collection:'commercial-inbox',overrideAccess:true})).totalDocs,inboxBeforeStale)
 assert.ok((await payload.find({collection:'commercial-import-rows',where:{batch:{equals:staged.id}},overrideAccess:true})).docs.every(row=>!row.inbox))
 const currentPlan=await preview(legacy.id)
 const another=await receive(event('change-after-preview',{externalTransactionId:'new-observed-transaction'}));await processCommercialInbox(payload,another.id)
 await assert.rejects(confirm(currentPlan),/stale_plan/)
 checks.push('Alteração de decisão invalida plano CSV pronto sem importar linhas; nova transação observada invalida prévia da decisão. Hash do cliente não autoriza aplicar plano desatualizado.')

 await assert.rejects(payload.update({collection:'catalog-resolutions',id:first.id,...seed.auth,data:{sourceReference:'edited'}}))
 await assert.rejects(payload.delete({collection:'catalog-resolutions',id:first.id,...seed.auth}))
 await assert.rejects(adapter.drizzle.execute(sql`UPDATE catalog_resolutions SET source_reference='edited' WHERE id=${first.id}::uuid`),sqlError('catalog_resolution_immutable'))
 await assert.rejects(adapter.drizzle.execute(sql`DELETE FROM catalog_resolutions WHERE id=${first.id}::uuid`),sqlError('catalog_resolution_immutable'))
 const beforeBadChain=await count()
 await assert.rejects(adapter.drizzle.execute(sql`INSERT INTO catalog_resolutions (key,request_hash,scope_key,provider,account_key,external_product_id,external_offer_id,revision,previous_id,action,target_offer_id,target_ebook_id,actor_id,occurred_at,source_kind,source_reference,reason,evidence_verified,plan_hash,snapshot)
  SELECT ${'f'.repeat(64)},request_hash,scope_key,provider,account_key,external_product_id,external_offer_id,999999,id,action,target_offer_id,target_ebook_id,actor_id,occurred_at,source_kind,source_reference,reason,evidence_verified,plan_hash,snapshot FROM catalog_resolutions WHERE id=${first.id}::uuid`),sqlError('catalog_resolution_chain_conflict'))
 assert.equal(await count(),beforeBadChain)
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);await down({db:adapter.sessions[id].db,payload,req})}),/downgrade recusado/)
 const isolated=await payload.create({collection:'offers',...seed.auth,data:{name:'Alvo sem transação',provider:'cakto',accountKey:'synthetic',externalProductId:'only-decision',ebook:seed.books[0].id,currency:'BRL',active:false}});extraOffers.push(isolated.id)
 await confirm(await preview(isolated.id,{provider:'cakto',externalProductId:'only-decision'}))
 await assert.rejects(payload.update({collection:'offers',id:isolated.id,...seed.auth,data:{externalProductId:'replace'}}),/Preserve a identidade/)
 await assert.rejects(adapter.drizzle.execute(sql`UPDATE offers SET external_product_id='replace' WHERE id=${isolated.id}::uuid`),sqlError('offer_identity_referenced_by_resolution'))
 checks.push('Trilha nega update/delete por API e SQL, assim como salto de revisão por INSERT direto; downgrade com prova recusa perda de evidência. Oferta referenciada somente por decisão também conserva identidade, via API e trigger.')

 const insufficient=event('insufficient-financial-proof',{externalTransactionId:'unsupported-shape',reviewReason:'unsupported_native_status'})
 const heldProof=await receive(insufficient)
 assert.equal((await processCommercialInbox(payload,heldProof.id)).state,'needs_review')
 const unsupported=(await payload.find({collection:'transactions',where:{externalTransactionId:{equals:'unsupported-shape'}},overrideAccess:true})).docs[0]
 assert.equal(unsupported.state,'unknown');assert.equal(unsupported.grossCents,null)
 await receive({...insufficient,grossCents:10000})
 assert.equal((await processCommercialInbox(payload,heldProof.id)).state,'held')
 await assert.rejects(retryCommercialInbox(payload,heldProof.id,'catalog_updated',actor))
 checks.push('Associação auditada não contorna revisão nativa por evidência financeira insuficiente nem colisão: valores não são projetados e retry permanece recusado.')

 const login=await payload.login({collection:'admin-users',data:{email:seed.owner.email,password:seed.password}}),origin=new URL(process.env.PUBLIC_SITE_URL||'http://127.0.0.1:3000').origin
 const request=(body:unknown,auth=true)=>new Request(origin+'/api/v1/admin/catalog-resolutions',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(auth?{Authorization:`JWT ${login.token}`}:{})},body:JSON.stringify(body)})
 assert.equal((await catalogResolutionRequest(request(choice(null),false),payload,true)).status,403)
 const wrongOrigin=new Request(origin+'/api/v1/admin/catalog-resolutions',{method:'POST',headers:{Origin:'https://invalid.example',Authorization:`JWT ${login.token}`,'Content-Type':'application/json'},body:'{}'})
 assert.equal((await catalogResolutionRequest(wrongOrigin,payload,true)).status,403)
 const response=await catalogResolutionRequest(request(choice(legacy.id)),payload,true);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer')
 assert.equal((await catalogResolutionRequest(request({...choice(legacy.id),actor:'forged'}),payload,true)).status,422)
 assert.equal((await catalogResolutionRequest(request({large:'x'.repeat(5000)}),payload,true)).status,413)
 checks.push('Handlers com autenticação Payload real exigem owner/origem exata antes do corpo. Prévia privada/no-store, campo de ator forjado e corpo excedido recusados; sem nova credencial/token ou chamadas externas.')
}finally{
 for(const collection of commercialCollections)await payload.delete({collection,where:{id:{exists:true}},overrideAccess:true})
 await clearCatalogResolutionFixtures(payload)
 for(const id of extraOffers)await payload.delete({collection:'offers',id,overrideAccess:true})
 await seed.cleanup()
}
await mkdir('artifacts/catalog-resolutions',{recursive:true})
await writeFile('artifacts/catalog-resolutions/local-results.json',JSON.stringify({date:new Date().toISOString(),checks,externalCalls:false,migrations:23,limits:'Resolução de associação local; não resolve colisões/valores/moeda/estados, não altera fonte original nem aplica financeiro ao decidir. UI e homologação externa pendentes.'},null,2)+'\n')
console.log(`Decisões de catálogo: ${checks.length} grupos aprovados; fixtures limpas.`)
process.exit(0)
