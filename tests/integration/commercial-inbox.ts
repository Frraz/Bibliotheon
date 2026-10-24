import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import type {PostgresAdapter} from '@payloadcms/db-postgres'
import {seedCommerce,commercialCollections,commercialLedgerCollections} from '../fixtures/commerce'
import {up as importsUp,down as importsDown} from '../../migrations/20261024_190859_commercial_imports'
import {commercialEventKey,type NormalizedCommercialEvent,type CommercialAdapter} from '../../src/modules/commerce/events'
import {processCommercialInbox,processCommercialQueue,receiveCommercialWebhook,retryCommercialInbox} from '../../src/modules/commerce/inbox'
import {retryCommercialRequest} from '../../src/modules/commerce/http'
import {atomic} from '../../src/modules/marketing/transaction'
import {up,down} from '../../migrations/20261024_115633_commercial_inbox'

const seed=await seedCommerce(),{payload}=seed,now=Date.now()-120000,checks:string[]=[]
const actor={...seed.owner,collection:'admin-users' as const},headers=new Headers({'x-synthetic-signature':'fixture'})
let sequence=0
const event=(more:Partial<NormalizedCommercialEvent>={}):NormalizedCommercialEvent=>({provider:'hotmart',accountKey:'synthetic',eventKey:`fixture-${++sequence}`,externalTransactionId:`tx-${sequence}`,externalProductId:'synthetic-product',externalOfferId:null,kind:'approved',occurredAt:new Date(now-3600000).toISOString(),currency:'BRL',grossCents:9900,refundedCents:null,feesCents:null,producerNetCents:null,externalClickReference:null,refundBasis:null,externalRefundId:null,chargebackCents:null,...more})
// Deliberately internal fixture adapters: no claim about native provider authentication/fields.
const adapter=(provider:NormalizedCommercialEvent['provider']):CommercialAdapter=>({provider,version:'synthetic-v1',verify:async(_bytes,h)=>h.get('x-synthetic-signature')==='fixture',normalize:bytes=>JSON.parse(Buffer.from(bytes).toString()).event})
const receive=(e:NormalizedCommercialEvent,h=headers)=>receiveCommercialWebhook(payload,adapter(e.provider),{provider:e.provider,accountKey:e.accountKey},Buffer.from(JSON.stringify({event:e,ignoredPII:'never-store@example.invalid',secret:'synthetic-raw-secret'})),h,{now})
const rowFor=async(e:Pick<NormalizedCommercialEvent,'provider'|'accountKey'|'eventKey'>)=>(await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey(e)}},depth:0,limit:1,overrideAccess:true})).docs[0]
const txFor=async(id:string)=>(await payload.find({collection:'transactions',where:{externalTransactionId:{equals:id}},depth:0,overrideAccess:true})).docs[0]
const run=async(e:NormalizedCommercialEvent,time=now)=>processCommercialInbox(payload,(await rowFor(e)).id,{now:time})
const count=async(collection:typeof commercialCollections[number])=>(await payload.count({collection,overrideAccess:true})).totalDocs
let token=''
const request=(body:unknown,more:Record<string,string>={})=>new Request('http://127.0.0.1:3001/api/v1/admin/inbox/fixture/retry',{method:'POST',headers:{origin:new URL(process.env.PUBLIC_SITE_URL||'http://127.0.0.1:3000').origin,'content-type':'application/json',authorization:`JWT ${token}`,...more},body:JSON.stringify(body)})
try{
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=(payload.db as unknown as PostgresAdapter).sessions[id].db;await importsDown({db,payload,req});await down({db,payload,req});await up({db,payload,req});await importsUp({db,payload,req});throw new Error('synthetic migration rollback')}),/synthetic migration rollback/)
 const first=event()
 assert.equal((await receive(first,new Headers())).state,'unauthorized');assert.equal(await count('commercial-inbox'),0)
 const receiptHooks=payload.collections['commercial-audit'].config.hooks,oldAudit=receiptHooks.afterChange
 receiptHooks.afterChange=[...(oldAudit||[]),async()=>{throw new Error('synthetic receipt rollback')}]
 try{await assert.rejects(receive(first),/synthetic receipt rollback/)}finally{receiptHooks.afterChange=oldAudit}
 assert.equal(await count('commercial-inbox'),0)
 const duplicate=await Promise.all([receive(first),receive(first)])
 assert.deepEqual(duplicate.map(x=>x.state).sort(),['duplicate','received']);assert.equal(await count('commercial-inbox'),1);assert.equal(await count('commercial-audit'),1)
 const persisted=JSON.stringify(await rowFor(first));assert.equal(persisted.includes('never-store'),false);assert.equal(persisted.includes('synthetic-raw-secret'),false)
 checks.push('Migração vazia down/up revertida; autenticação antes do banco; ACK após commit/auditoria; rollback e concorrência deduplicam sem guardar corpo original/PII.')

 const concurrent=await Promise.all([run(first),run(first)])
 assert.equal(concurrent.filter(x=>x.state==='applied').length>=1,true)
 assert.equal(await count('transactions'),1);assert.equal(await count('transaction-events'),1)
 let tx=await txFor(first.externalTransactionId);assert.equal(tx.state,'approved');assert.equal(tx.offer,null);assert.equal(tx.feesCents,null);assert.equal(tx.producerNetCents,null);assert.equal((tx.projection as {settledCents:null}).settledCents,null)
 for(const provider of ['kiwify','cakto'] as const){const e=event({provider});await receive(e);assert.equal((await run(e)).state,'applied')}
 assert.equal(await count('transactions'),3)
 checks.push('Mesmo processador com fixtures internas dos três provedores; concorrência/replay mantêm uma transação/fato. Oferta ausente, taxa, líquido e liquidação continuam desconhecidos.')

 const refund=event({externalTransactionId:first.externalTransactionId,kind:'partially_refunded',occurredAt:new Date(now-10000).toISOString(),refundedCents:1200,refundBasis:'operation',externalRefundId:'refund-1'})
 await receive(refund);assert.equal((await run(refund)).state,'applied')
 const late=event({externalTransactionId:first.externalTransactionId,kind:'pending',occurredAt:new Date(now-7200000).toISOString()})
 await receive(late);assert.equal((await run(late)).state,'applied');tx=await txFor(first.externalTransactionId);assert.equal(tx.state,'partially_refunded');assert.equal(tx.refundedCents,1200)
 const previousProjection=tx.projection,badCurrency=event({externalTransactionId:first.externalTransactionId,currency:'USD'})
 await receive(badCurrency);assert.equal((await run(badCurrency)).state,'needs_review');tx=await txFor(first.externalTransactionId);assert.deepEqual(tx.projection,previousProjection);assert.equal(tx.needsReview,true)
 checks.push('Reversão e evento atrasado reconstroem pelo tempo original; divergência monetária conserva a última projeção válida e o fato que precisa de revisão.')

 assert.equal((await receive({...first,grossCents:9800})).state,'conflict');assert.equal((await receive({...first,grossCents:9800})).state,'conflict');assert.equal(await count('commercial-conflicts'),1)
 assert.equal((await txFor(first.externalTransactionId)).needsReview,true)
 const afterConflict=event({externalTransactionId:first.externalTransactionId});await receive(afterConflict);assert.equal((await run(afterConflict)).state,'needs_review');assert.equal((await rowFor(afterConflict)).errorCode,'transaction_conflicted');assert.deepEqual((await txFor(first.externalTransactionId)).projection,previousProjection)
 await assert.rejects(retryCommercialInbox(payload,(await rowFor(first)).id,'reviewed_envelope',actor),/event_key_conflict/)
 checks.push('Colisão de chave fica durável uma vez; conserva projeção e impede outro evento/retry de apagar a divergência da mesma transação.')

 const unknown=event({externalProductId:'not-mapped'});await receive(unknown);assert.equal((await run(unknown)).state,'needs_review');assert.equal(await txFor(unknown.externalTransactionId),undefined)
 await payload.create({collection:'offers',...seed.auth,data:{name:'Mapeamento sintético para retry',provider:'hotmart',accountKey:'synthetic',externalProductId:'not-mapped',ebook:seed.books[0].id,active:false,currency:'BRL'}})
 const login=await payload.login({collection:'admin-users',data:{email:seed.owner.email,password:seed.password}});assert.ok(login.token);token=login.token
 const unknownId=(await rowFor(unknown)).id
 assert.equal((await retryCommercialRequest(request({reason:'catalog_updated'},{authorization:''}),unknownId,payload)).status,403)
 assert.equal((await retryCommercialRequest(request({reason:'catalog_updated'},{origin:'https://other.example.invalid'}),unknownId,payload)).status,403)
 assert.equal((await retryCommercialRequest(request({reason:'catalog_updated',actor:'forged'}),unknownId,payload)).status,422)
 assert.equal((await retryCommercialRequest(request({reason:'free-text@example.invalid'}),unknownId,payload)).status,422)
 const response=await retryCommercialRequest(request({reason:'catalog_updated'}),unknownId,payload);assert.equal(response.status,202);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal((await response.json()).state,'queued')
 assert.equal((await processCommercialInbox(payload,unknownId,{now:Date.now()+1000})).state,'applied')
 const ownerAudit=(await payload.find({collection:'commercial-audit',where:{and:[{inbox:{equals:unknownId}},{actorType:{equals:'owner'}}]},depth:0,overrideAccess:true})).docs;assert.equal(ownerAudit.length,1);assert.equal(ownerAudit[0].actor,seed.owner.id);assert.equal(ownerAudit[0].reason,'catalog_updated')
 checks.push('Produto desconhecido não vira venda; correção de catálogo permite retry autenticado, com origem exata, motivo fechado e ator derivado da sessão. Campos extras/forjados são recusados.')

 const ambiguous=event({externalProductId:'ambiguous'});for(const book of seed.books.slice(0,2))await payload.create({collection:'offers',...seed.auth,data:{name:'Ambiguidade sintética',provider:'hotmart',accountKey:'synthetic',externalProductId:'ambiguous',ebook:book.id,active:false,currency:'BRL'}})
 await receive(ambiguous);assert.equal((await run(ambiguous)).state,'needs_review');assert.equal((await rowFor(ambiguous)).errorCode,'ambiguous_product');assert.equal(await txFor(ambiguous.externalTransactionId),undefined)
 const explicitOffer=await payload.create({collection:'offers',...seed.auth,data:{name:'Oferta explícita sintética',provider:'cakto',accountKey:'synthetic',externalProductId:'synthetic-product',externalOfferId:'explicit-offer',ebook:seed.books[0].id,active:false,currency:'BRL'}})
 const explicit=event({provider:'cakto',externalOfferId:'explicit-offer'});await receive(explicit);assert.equal((await run(explicit)).state,'applied');assert.equal((await txFor(explicit.externalTransactionId)).offer,explicitOffer.id)
 await assert.rejects(payload.update({collection:'offers',id:explicitOffer.id,...seed.auth,data:{externalProductId:'replacement'}}),/Preserve a identidade/)
 await payload.update({collection:'offers',id:explicitOffer.id,...seed.auth,data:{name:'Metadado sintético atualizado'}})
 checks.push('Mapeamento exige identidade exata; produto ligado a dois livros fica em revisão. Oferta explícita é vinculada; identidade com histórico é congelada e metadados continuam editáveis.')

 const stale=event();await receive(stale);const staleId=(await rowFor(stale)).id
 await payload.update({collection:'commercial-inbox',id:staleId,data:{state:'processing',startedAt:new Date(now).toISOString(),leaseToken:'synthetic-lease',attempts:1},overrideAccess:true})
 assert.equal((await processCommercialInbox(payload,staleId,{now:now+1000})).state,'held')
 await assert.rejects(retryCommercialInbox(payload,staleId,'service_restored',actor,{now:now+1000}),/processing_active/)
 assert.equal((await processCommercialInbox(payload,staleId,{now:now+6*60000})).state,'applied');assert.equal((await rowFor(stale)).attempts,2)
 const tampered=event();await receive(tampered);await payload.update({collection:'commercial-inbox',id:(await rowFor(tampered)).id,data:{envelope:{...tampered,grossCents:1}},overrideAccess:true});assert.equal((await run(tampered)).state,'needs_review');assert.equal((await rowFor(tampered)).errorCode,'envelope_integrity');assert.equal(await txFor(tampered.externalTransactionId),undefined)
 const future=event({occurredAt:new Date(now+3600000).toISOString()});await receive(future);assert.equal((await run(future)).state,'needs_review');assert.equal((await rowFor(future)).errorCode,'future_event_time')
 checks.push('Lease ativo impede concorrência/retry; lease abandonado é recuperado com tentativa acumulada. Hash alterado e timestamp futuro não modificam transações.')

 const rollback=event();await receive(rollback);const hooks=payload.collections['transaction-events'].config.hooks,old=hooks.afterChange
 hooks.afterChange=[...(old||[]),async()=>{throw new Error('synthetic projection rollback')}]
 try{for(let attempt=0;attempt<5;attempt++)assert.equal((await run(rollback,now+attempt*4000000)).state,'failed')}finally{hooks.afterChange=old}
 assert.equal(await txFor(rollback.externalTransactionId),undefined);assert.equal((await rowFor(rollback)).attempts,5)
 assert.equal((await run(rollback,now+5*4000000)).state,'held');assert.equal((await rowFor(rollback)).errorCode,'attempts_exhausted')
 assert.equal((await retryCommercialInbox(payload,(await rowFor(rollback)).id,'service_restored',actor,{now:now+6*4000000})).state,'queued');assert.equal((await run(rollback,now+6*4000000)).state,'applied');assert.equal((await rowFor(rollback)).attempts,6);assert.equal((await rowFor(rollback)).attemptBase,5)
 const beforeNoop=await count('commercial-audit');assert.equal((await retryCommercialInbox(payload,(await rowFor(rollback)).id,'reviewed_envelope',actor)).state,'unchanged');assert.equal(await count('commercial-audit'),beforeNoop+1)
 checks.push('Falha de persistência reverte fato/projeção juntos e aplica backoff; cinco tentativas suspendem automação. Retry auditado reabre orçamento sem zerar histórico, incluindo ação sem alteração.')

 const committed=event();await receive(committed);assert.equal((await run(committed)).state,'applied')
 const committedBefore=(await txFor(committed.externalTransactionId)).projection
 const reversed=event({externalTransactionId:committed.externalTransactionId,kind:'partially_refunded',occurredAt:new Date(now-1000).toISOString(),refundedCents:700,refundBasis:'operation',externalRefundId:'atomic-refund'})
 await receive(reversed)
 receiptHooks.afterChange=[...(oldAudit||[]),async({doc})=>{if(doc.action==='applied')throw new Error('synthetic final commit rollback')}]
 try{assert.equal((await run(reversed)).state,'failed')}finally{receiptHooks.afterChange=oldAudit}
 assert.deepEqual((await txFor(committed.externalTransactionId)).projection,committedBefore)
 assert.equal((await payload.count({collection:'transaction-events',where:{transaction:{equals:(await txFor(committed.externalTransactionId)).id}},overrideAccess:true})).totalDocs,1)
 assert.equal((await rowFor(reversed)).state,'failed')
 await retryCommercialInbox(payload,(await rowFor(reversed)).id,'service_restored',actor,{now});assert.equal((await run(reversed)).state,'applied');assert.equal((await txFor(committed.externalTransactionId)).refundedCents,700)
 checks.push('Falha na auditoria final após escrever a projeção reverte projeção/fato/inbox juntos; retry aplica a reversão exatamente uma vez.')

 const ignored={provider:'hotmart' as const,accountKey:'synthetic',eventKey:'ignored-fixture',kind:'ignored',eventType:'test.unhandled',occurredAt:null}
 const totalTx=await count('transactions');assert.equal((await receiveCommercialWebhook(payload,adapter('hotmart'),{provider:'hotmart',accountKey:'synthetic'},Buffer.from(JSON.stringify({event:ignored})),headers,{now})).state,'received');assert.equal((await rowFor(ignored)).state,'ignored');assert.equal(await count('transactions'),totalTx)
 for(const collection of commercialLedgerCollections){await assert.rejects(payload.find({collection,user:null,overrideAccess:false}));const doc=(await payload.find({collection,limit:1,overrideAccess:true})).docs[0];assert.ok(doc);await assert.rejects(payload.delete({collection,id:doc.id,user:actor,overrideAccess:false}));await assert.rejects(payload.update({collection,id:doc.id,data:{},user:actor,overrideAccess:false}))}
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);await down({db:(payload.db as unknown as PostgresAdapter).sessions[id].db,payload,req})}),/Downgrade recusado/)
 assert.equal((await processCommercialQueue(payload,{enabled:false})).state,'disabled')
 checks.push('Evento autenticado ignorado fica auditado sem transação; anônimo não lê e owner não reescreve/exclui histórico por API. Downgrade com dados é recusado; fila desligada não consulta banco.')

 const cli=event();await receive(cli)
 const temporary=await mkdtemp(path.join(tmpdir(),'bibliotheon-commerce-cli-'))
 try{
  const bootstrap=path.join(temporary,'no-network.mjs');await writeFile(bootstrap,"import assert from 'node:assert/strict';let calls=0;process.on('exit',()=>assert.equal(calls,0));globalThis.fetch=async()=>{calls++;throw new Error('Unexpected network')};")
  const env={...process.env,COMMERCIAL_EVENTS_ENABLED:'true'}
  const output=execFileSync(process.execPath,['--env-file-if-exists=.env.local','--import',bootstrap,'.release/process-commercial.js','25'],{env,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});assert.equal(JSON.parse(output.trim().split('\n').at(-1)!).state,'processed');assert.equal((await rowFor(cli)).state,'applied')
  const disabled=execFileSync(process.execPath,['--import',bootstrap,'.release/process-commercial.js'],{env:{...env,COMMERCIAL_EVENTS_ENABLED:'false',DATABASE_URL:'invalid'},encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});assert.deepEqual(JSON.parse(disabled),{state:'disabled'})
 }finally{await rm(temporary,{recursive:true,force:true})}
 checks.push('CLI empacotado processa envelope sintético com fetch bloqueado; desligado retorna antes de abrir banco inválido.')
}finally{
 // Remove financial fixtures before their catalog mappings.
 for(const collection of commercialCollections)await payload.delete({collection,where:{id:{exists:true}},overrideAccess:true})
 await payload.delete({collection:'offers',where:{and:[{accountKey:{equals:'synthetic'}},{id:{not_in:seed.offers.map(x=>x.id)}}]},overrideAccess:true})
 await seed.cleanup()
}
const temporary=await mkdtemp(path.join(tmpdir(),'bibliotheon-commerce-worker-'))
try{
 const bootstrap=path.join(temporary,'no-network.mjs');await writeFile(bootstrap,"import assert from 'node:assert/strict';let calls=0;process.on('exit',()=>assert.equal(calls,0));globalThis.fetch=async()=>{calls++;throw new Error('Unexpected network')};")
 const env={...process.env,COMMERCIAL_EVENTS_ENABLED:'true',EMAIL_TRANSPORT_ENABLED:'false',BREVO_CONTACT_SYNC_ENABLED:'false',BREVO_CONTACT_REGISTRATION_ENABLED:'false',BREVO_CAMPAIGN_SEND_ENABLED:'false',BREVO_CAMPAIGN_OBSERVE_ENABLED:'false',BREVO_CAMPAIGN_SYNC_ENABLED:'false',BREVO_API_KEY:'',LEAD_TOKEN_SECRET:''}
 const output=execFileSync(process.execPath,['--env-file-if-exists=.env.local','--import',bootstrap,'.release/worker.js','--once'],{env,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});assert.equal(output.includes('Ciclo operacional falhou'),false)
}finally{await rm(temporary,{recursive:true,force:true})}
checks.push('Worker somente comercial executa ciclo com fila vazia sem SMTP, chave de links, API Brevo ou rede; fixtures limpas.')
await mkdir('artifacts/commercial-inbox',{recursive:true})
await writeFile('artifacts/commercial-inbox/local-results.json',JSON.stringify({date:new Date().toISOString(),environment:'PostgreSQL loopback; adaptadores internos sintéticos; CLI/worker empacotados',checks,nativeAdapters:false,realSales:0,externalCalls:false,limits:'Sem autenticação/eventos nativos de Hotmart/Kiwify/Cakto homologados; sem atribuição de compra, liquidação, conta real ou VPS.'},null,2)+'\n')
console.log(`Inbox comercial: ${checks.length} grupos aprovados; sem chamadas externas ou vendas reais.`)
process.exit(0)
