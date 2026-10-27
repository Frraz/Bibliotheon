import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import type {PostgresAdapter} from '@payloadcms/db-postgres'
import {deleteLegacyOffer,seedLegacyOffer,seedCommerce} from '../fixtures/commerce'
import {canonicalCSV,csvFields} from '../fixtures/commercial-csv'
import {stageCommercialImport,commitCommercialImport} from '../../src/modules/commerce/import-service'
import {processCommercialInbox,processCommercialQueue,receiveCommercialWebhook} from '../../src/modules/commerce/inbox'
import {commercialEventKey,type CommercialAdapter,type NormalizedCommercialEvent} from '../../src/modules/commerce/events'
import {atomic} from '../../src/modules/marketing/transaction'
import {up,down} from '../../migrations/20261024_190859_commercial_imports'
const seed=await seedCommerce(),{payload}=seed,actor={...seed.owner,collection:'admin-users'},checks:string[]=[],extraOffers:string[]=[]
const metadata={sourceKind:'provider_report',sourceReference:'report-20261024-synthetic',reason:'missing_webhook'}
const fields=(id:string)=>{const row=[...csvFields];row[2]=id;row[4]='';return row}
const stage=(rows:string[][],key:string=randomUUID())=>stageCommercialImport(payload,actor,canonicalCSV(rows),metadata,key)
const confirm=(batch:Awaited<ReturnType<typeof stage>>,id=batch.id)=>commitCommercialImport(payload,actor,id,{confirmed:true,planHash:batch.planHash})
const count=async(collection:'commercial-import-batches'|'commercial-import-rows'|'commercial-import-audit'|'commercial-inbox'|'commercial-audit'|'transactions'|'transaction-events')=>(await payload.count({collection,overrideAccess:true})).totalDocs
const storedRows=async(batch:string)=>(await payload.find({collection:'commercial-import-rows',where:{batch:{equals:batch}},limit:10001,sort:'line',depth:0,overrideAccess:true})).docs
const native=async(id:string)=>{
 const event:NormalizedCommercialEvent={provider:'hotmart',accountKey:'synthetic',eventKey:'native-'+id,externalTransactionId:id,externalProductId:'synthetic-product',externalOfferId:null,kind:'approved',occurredAt:'2026-10-20T11:01:00.000Z',approvedAt:'2026-10-20T11:01:00.000Z',currency:'BRL',grossCents:9990,refundedCents:null,feesCents:990,producerNetCents:null,chargebackCents:null,refundBasis:null,externalRefundId:null,externalClickReference:null}
 const adapter:CommercialAdapter={provider:'hotmart',version:'synthetic-import-race:1',verify:async()=>true,normalize:bytes=>JSON.parse(Buffer.from(bytes).toString())}
 await receiveCommercialWebhook(payload,adapter,event,Buffer.from(JSON.stringify(event)),new Headers())
 return(await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey(event)}},overrideAccess:true})).docs[0]
}
try{
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=(payload.db as unknown as PostgresAdapter).sessions[id].db;await down({db,payload,req});await up({db,payload,req});throw new Error('synthetic import migration rollback')}),/synthetic import migration rollback/)
 for(const collection of ['commercial-import-batches','commercial-import-rows','commercial-import-audit'] as const){
  await assert.rejects(payload.find({collection,user:null,overrideAccess:false}))
  assert.equal((await payload.find({collection,...seed.auth})).totalDocs,0)
  await assert.rejects(payload.create({collection,...seed.auth,data:{} as never}))
 }
 await assert.rejects(stageCommercialImport(payload,null,canonicalCSV([fields('denied')]),metadata,randomUUID()),/forbidden/)
 const invalid=fields('invalid');invalid[1]='never-store@example.invalid';await assert.rejects(stage([invalid]),/invalid_rows/);assert.equal(await count('commercial-import-batches'),0)
 checks.push('Migração 21 round-trip em transação revertida; coleções privadas negam leitura anônima/criação owner. Fonte inválida/linha com PII não cria lote; autorização é exigida no serviço.')

 const first=fields('import-first'),second=fields('import-second');second[8]='29';second[10]='3'
 const idem=randomUUID(),stages=await Promise.all([stage([first,first,second],idem),stage([first,first,second],idem.toUpperCase())]),batch=stages[0]
 assert.equal(stages[0].id,stages[1].id);assert.equal(stages.filter(value=>value.duplicate).length,1);assert.equal(batch.state,'ready');assert.equal((await storedRows(batch.id)).length,3);assert.equal(await count('commercial-import-audit'),1);assert.equal(await count('commercial-inbox'),0)
 const changed=[...first];changed[8]='10000';await assert.rejects(stage([changed],idem),/idempotency_conflict/)
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);await down({db:(payload.db as unknown as PostgresAdapter).sessions[id].db,payload,req})}),/downgrade recusado/)
 checks.push('Estágio concorrente com UUID em caixas diferentes é idempotente e guarda três linhas/uma auditoria. Mesmo idempotency key com conteúdo diferente é recusado; downgrade com evidência não apaga registros.')

 await assert.rejects(commitCommercialImport(payload,actor,batch.id,{confirmed:false,planHash:batch.planHash}),/invalid_confirmation/)
 await assert.rejects(commitCommercialImport(payload,actor,batch.id,{confirmed:true,planHash:'0'.repeat(64)}),/plan_conflict/)
 const commits=await Promise.all([confirm(batch),confirm(batch,batch.id.toUpperCase())]);assert.equal(commits.filter(value=>value.duplicate).length,1);assert.ok(commits.every(value=>value.state==='queued'));assert.equal(await count('commercial-inbox'),2);assert.equal(await count('transactions'),0)
 const planned=await storedRows(batch.id);assert.equal(planned.filter(row=>row.state==='queued').length,2);assert.equal(planned.filter(row=>row.state==='duplicate').length,1);assert.equal((await processCommercialQueue(payload,{enabled:false})).state,'disabled')
 checks.push('Confirmação exige conferência/plano exatos; concorrência inclusive UUID upper/lower enfileira uma vez. Duas evidências e seus vínculos/auditorias são atômicos; confirmação não aplica venda nem ignora flag do worker.')

 const pending=await stage([first]);assert.equal(pending.state,'blocked');assert.equal((await storedRows(pending.id))[0].reason,'pending_evidence');await assert.rejects(confirm(pending),/batch_not_ready/)
 for(const row of planned)if(row.inbox)assert.equal((await processCommercialInbox(payload,typeof row.inbox==='string'?row.inbox:row.inbox.id)).state,'applied')
 const sales=(await payload.find({collection:'transactions',sort:'externalTransactionId',overrideAccess:true})).docs;assert.equal(sales.length,2);assert.equal(sales.find(value=>value.externalTransactionId==='import-second')!.grossCents,29);assert.equal(sales[0].producerNetCents,null)
 const matched=await stage([first,second]);assert.equal(matched.state,'ready');assert.equal((await confirm(matched)).state,'confirmed');assert.equal(await count('commercial-inbox'),2);assert.equal(await count('transaction-events'),2)
 checks.push('Evidência pendente bloqueia novo lote da mesma transação. Aplicação explícita usa centavos/data/fonte CSV sem líquido/recebimento inferidos; relatório já compatível confirma sem novos fatos ou transações.')

 const stale=await stage([fields('stale-native'),fields('stale-companion')]);assert.equal(stale.state,'ready');const receipt=await native('stale-native'),beforeStale=await count('commercial-inbox')
 assert.equal((await confirm(stale)).state,'stale');assert.equal(await count('commercial-inbox'),beforeStale);assert.ok((await storedRows(stale.id)).every(row=>!row.inbox));assert.equal((await payload.findByID({collection:'commercial-inbox',id:receipt.id,overrideAccess:true})).state,'pending')
 const catalog=await stage([fields('stale-catalog')]);const offer=await seedLegacyOffer(seed,{name:'Ambiguidade sintética de importação',provider:'hotmart',accountKey:'synthetic',externalProductId:'synthetic-product',ebook:seed.books[1].id,active:false,currency:'BRL'});extraOffers.push(offer.id)
 assert.equal((await confirm(catalog)).state,'stale');await deleteLegacyOffer(seed,offer.id);extraOffers.splice(extraOffers.indexOf(offer.id),1)
 checks.push('Webhook recebido e catálogo alterado depois do estágio invalidam o plano inteiro, registram stale e preservam inbox/projeções. Linha companheira não é importada parcialmente.')

 const unsupported=fields('reversal-unsupported');unsupported[5]='refunded';const blocked=await stage([unsupported]);assert.equal(blocked.state,'blocked');assert.equal((await storedRows(blocked.id))[0].reason,'snapshot_not_supported')
 const settled=fields('settlement-unsupported');settled[12]='9000';assert.equal((await stage([settled])).state,'blocked')
 const tampered=await stage([fields('tampered-row')]),[saved]=await storedRows(tampered.id)
 await payload.update({collection:'commercial-import-rows',id:saved.id,data:{normalized:{...(saved.normalized as object),grossCents:1}},overrideAccess:true})
 await assert.rejects(confirm(tampered),/integrity_conflict/)
 checks.push('Reversão/recebimento sem contrato suficiente ficam bloqueados. Linha persistida adulterada não passa por whitelist/hash/manifesto nem gera fato financeiro.')

 const hooks=payload.collections['commercial-import-audit'].config.hooks,old=hooks.afterChange,stageCount=await count('commercial-import-batches'),rowCount=await count('commercial-import-rows')
 hooks.afterChange=[...(old||[]),async()=>{throw new Error('synthetic stage audit rollback')}]
 try{await assert.rejects(stage([fields('rollback-stage')]),/synthetic stage audit rollback/)}finally{hooks.afterChange=old}
 assert.equal(await count('commercial-import-batches'),stageCount);assert.equal(await count('commercial-import-rows'),rowCount)
 const many=Array.from({length:201},(_,index)=>fields('bulk-import-'+index)),bulk=await stage(many),beforeQueue=await count('commercial-inbox'),beforeAudit=await count('commercial-audit')
 hooks.afterChange=[...(old||[]),async({doc})=>{if(doc.action==='queued')throw new Error('synthetic final queue audit rollback')}]
 try{await assert.rejects(confirm(bulk),/synthetic final queue audit rollback/)}finally{hooks.afterChange=old}
 assert.equal(await count('commercial-inbox'),beforeQueue);assert.equal(await count('commercial-audit'),beforeAudit);assert.ok((await storedRows(bulk.id)).every(row=>row.state==='planned'&&!row.inbox));assert.equal((await payload.findByID({collection:'commercial-import-batches',id:bulk.id,overrideAccess:true})).state,'ready')
 assert.equal((await confirm(bulk)).state,'queued');assert.equal(await count('commercial-inbox'),beforeQueue+201);assert.equal((await storedRows(bulk.id)).filter(row=>row.state==='queued').length,201)
 checks.push('Falha na auditoria do estágio reverte lote/linhas. Falha final após enfileirar 201 itens em dois blocos reverte tudo; retry confirma todos juntos, sem efeitos parciais.')

 const race=await stage([fields('account-barrier-race')]),batchHooks=payload.collections['commercial-import-batches'].config.hooks,oldBatch=batchHooks.afterChange
 let entered!:()=>void,release!:()=>void,finished=false
 const inside=new Promise<void>(resolve=>{entered=resolve}),gate=new Promise<void>(resolve=>{release=resolve})
 batchHooks.afterChange=[...(oldBatch||[]),async({doc})=>{if(doc.id===race.id&&doc.state==='queued'){entered();await gate}}]
 const committing=confirm(race)
 try{await inside;const concurrent=native('account-barrier-race').then(value=>{finished=true;return value});await new Promise(resolve=>setTimeout(resolve,75));assert.equal(finished,false);release();assert.equal((await committing).state,'queued');const other=await concurrent;assert.equal(other.state,'pending')}finally{release();batchHooks.afterChange=oldBatch}
 checks.push('Barreira por conta protege confirmação contra recepção concorrente: webhook aguarda commit e permanece durável depois, sem ser perdido ou considerado já importado.')

 for(const provider of ['kiwify','cakto'] as const){
  const row=fields('csv-provider-'+provider);row[0]=provider;const independent=await stage([row]);assert.equal(independent.state,'ready');assert.equal((await confirm(independent)).state,'queued');const [link]=await storedRows(independent.id);assert.ok(link.inbox);assert.equal((await processCommercialInbox(payload,typeof link.inbox==='string'?link.inbox:link.inbox.id)).state,'applied')
 }
 checks.push('Kiwify e Cakto também recebem/aplicam snapshots CSV independentes com a mesma política; nenhum provedor foi removido ou tratado como formato nativo de outro.')

 for(const collection of ['commercial-import-batches','commercial-import-rows','commercial-import-audit'] as const){
  const doc=(await payload.find({collection,...seed.auth,limit:1})).docs[0];assert.ok(doc)
  await assert.rejects(payload.update({collection,id:doc.id,data:{},...seed.auth}));await assert.rejects(payload.delete({collection,id:doc.id,...seed.auth}))
 }
 for(const collection of ['commercial-import-batches','commercial-import-rows','commercial-import-audit'] as const)for(const item of (await payload.find({collection,limit:1000,depth:0,overrideAccess:true})).docs)assert.equal(JSON.stringify(item).includes('never-store'),false)
 checks.push('Owner consulta coleções nativas, mas não edita/apaga plano/linhas/auditoria por API; dados inválidos não são preservados. Nenhum comprador, segredo ou arquivo bruto no manifesto.')
}finally{
 for(const id of extraOffers)await payload.delete({collection:'offers',id,overrideAccess:true})
 await seed.cleanup()
}
await mkdir('artifacts/commercial-imports',{recursive:true})
await writeFile('artifacts/commercial-imports/local-results.json',JSON.stringify({date:new Date().toISOString(),checks,externalCalls:false,realSales:0,limits:'Confirmação somente de novos estados sem reversão/recebimento e snapshots já compatíveis. Commit significa fila durável, aplicação depende do worker. Fonte/owner/CSV sintéticos, sem relatório nativo/conta real, resolução de conflitos, financeiro ou UI customizada.'},null,2)+'\n')
console.log(`Importações comerciais: ${checks.length} grupos locais aprovados; fixtures limpas.`)
process.exit(0)
