import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {type PostgresAdapter} from '@payloadcms/db-postgres'
import {seedCommerce} from '../fixtures/commerce'
import {atomic} from '../../src/modules/marketing/transaction'
import {recordReportEvidence,recordReportEvidenceBatch} from '../../src/modules/commerce/report-evidence'
import {previewReportEvidenceImport,stageReportEvidenceImport,commitReportEvidenceImport} from '../../src/modules/commerce/report-evidence-imports'
import {type ReportEvidenceInput} from '../../src/modules/commerce/report-evidence-schema'
import {previewTransactionReview,type ReviewChoice} from '../../src/modules/commerce/transaction-review'
import {decideFinancialResolution,financialStatuses} from '../../src/modules/commerce/financial-resolutions'
import {commercialEventKey,commercialTransactionKey,commercialEventDigest,type NormalizedCommercialEvent,type CommercialAdapter} from '../../src/modules/commerce/events'
import {receiveCommercialWebhook,processCommercialInbox,retryCommercialInbox} from '../../src/modules/commerce/inbox'
import {previewCommercialCSV} from '../../src/modules/commerce/import-preview'
import {stageCommercialImport,commitCommercialImport} from '../../src/modules/commerce/import-service'
import {canonicalCSV,canonicalReportEvidenceCSV,csvFields,reportEvidenceFields} from '../fixtures/commercial-csv'
import {down,up} from '../../migrations/20261025_041432_financial_report_evidence'
import {down as downReportImports,up as upReportImports} from '../../migrations/20261025_051744_report_evidence_csv'
assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true')
const seed=await seedCommerce(),{payload}=seed,actor={...seed.owner,collection:'admin-users'},checks:string[]=[],scope={provider:'hotmart' as const,accountKey:'synthetic'}
const count=async(collection:'commercial-report-evidence'|'financial-resolutions'|'financial-resolution-applications'|'transaction-events')=>(await payload.count({collection,overrideAccess:true})).totalDocs
const tx=async(externalTransactionId:string)=>(await payload.find({collection:'transactions',where:{key:{equals:commercialTransactionKey({...scope,externalTransactionId})}},depth:0,overrideAccess:true})).docs[0]
const native:NormalizedCommercialEvent={...scope,eventKey:'report-native-source',externalTransactionId:'report-wrong-a',externalProductId:'synthetic-product',externalOfferId:null,kind:'approved',occurredAt:'2026-10-20T00:00:00.000Z',approvedAt:null,currency:'BRL',grossCents:10000,refundedCents:null,chargebackCents:null,feesCents:null,producerNetCents:null,refundBasis:null,externalRefundId:null,externalClickReference:null,reviewReason:'unknown_event_time'}
const adapter:CommercialAdapter={provider:'hotmart',version:'synthetic-report-native:1',verify:async()=>true,normalize:bytes=>JSON.parse(Buffer.from(bytes).toString())}
const receive=async(e:NormalizedCommercialEvent)=>receiveCommercialWebhook(payload,adapter,e,Buffer.from(JSON.stringify(e)),new Headers())
const row=async(e:NormalizedCommercialEvent)=>(await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey(e)}},depth:0,overrideAccess:true})).docs[0]
const root:ReviewChoice={...scope,externalTransactionId:'report-correct-b',action:'reconcile',selections:[]}
const inspect=async()=>previewTransactionReview(payload,actor,root)
const select=async(ids:string[])=>{const p=await inspect();return previewTransactionReview(payload,actor,{...root,selections:p.context.receipts.map(r=>({inboxId:r.id,envelopeHash:ids.includes(r.id)?r.variants[0].hash:null,reason:ids.includes(r.id)?'source_confirmed':'source_rejected'}))})}
const decide=async(p:Awaited<ReturnType<typeof select>>)=>decideFinancialResolution(payload,actor,{...p.choice,planHash:p.planHash,sourceKind:'provider_report',sourceReference:'synthetic-report-proof',reason:'incorrect_source_reconciled',evidenceVerified:true,confirmed:true},randomUUID())
try{
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=(payload.db as unknown as PostgresAdapter).sessions[id].db;await down({db,payload,req});await up({db,payload,req});throw Error('synthetic evidence migration rollback')}),/synthetic evidence migration rollback/)
 await receive(native);assert.equal((await processCommercialInbox(payload,(await row(native)).id)).state,'needs_review')
 const source=(await row(native)).id,base:ReportEvidenceInput={...scope,externalTransactionId:'report-correct-b',externalProductId:'synthetic-product',externalOfferId:null,kind:'approved',occurredAt:'2026-10-20T11:01:00.000Z',approvedAt:null,currency:'BRL',grossCents:12000,refundedCents:null,chargebackCents:null,feesCents:null,producerNetCents:null,refundBasis:null,externalRefundId:null,sourceKind:'provider_report',sourceReference:'synthetic-report',recordReference:'synthetic-line-one',replaces:[{kind:'native',id:source}],evidenceVerified:true}
 const preCSV=[...csvFields];preCSV[2]=root.externalTransactionId;preCSV[4]='';preCSV[8]='12000';preCSV[10]='';const beforeReport=await stageCommercialImport(payload,actor,canonicalCSV([preCSV]),{sourceKind:'provider_report',sourceReference:'synthetic-pre-evidence',reason:'missing_webhook'},randomUUID());assert.equal(beforeReport.state,'ready')
 await assert.rejects(recordReportEvidence(payload,null,base),/forbidden/)
 const batchHooks=payload.collections['commercial-report-evidence'].config.hooks,oldBatchHooks=batchHooks.afterChange
 batchHooks.afterChange=[...(oldBatchHooks||[]),async({doc})=>{if(doc.input.recordReference==='synthetic-batch-fail')throw Error('synthetic batch rollback')}]
 try{await assert.rejects(recordReportEvidenceBatch(payload,actor,[{...base,recordReference:'synthetic-batch-first',replaces:[]},{...base,recordReference:'synthetic-batch-fail',replaces:[]}]),/synthetic batch rollback/)}finally{batchHooks.afterChange=oldBatchHooks}
 assert.equal(await count('commercial-report-evidence'),0)
 checks.push('Lote canônico reverte integralmente a primeira linha se a gravação seguinte falhar; não deixa evidência nem revisão parcial.')
 const duplicate=await Promise.all([recordReportEvidence(payload,actor,base),recordReportEvidence(payload,actor,base)])
 assert.equal(duplicate[0].id,duplicate[1].id);assert.equal(duplicate.filter(r=>r.duplicate).length,1);assert.equal(duplicate[0].applied,false);assert.equal(await count('commercial-report-evidence'),1);assert.equal(await tx('report-correct-b'),undefined)
 await assert.rejects(recordReportEvidence(payload,actor,{...base,grossCents:13000}),/report_record_conflict/)
 assert.equal((await commitCommercialImport(payload,actor,beforeReport.id,{confirmed:true,planHash:beforeReport.planHash})).state,'stale')
 assert.equal((await previewCommercialCSV(payload,canonicalCSV([preCSV]))).lines[0].classification,'needs_review')
 const cleanB={...native,eventKey:'report-clean-b',externalTransactionId:root.externalTransactionId,reviewReason:undefined,grossCents:12000,occurredAt:'2026-10-20T11:01:00.000Z',approvedAt:'2026-10-20T11:01:00.000Z'};await receive(cleanB);assert.equal((await processCommercialInbox(payload,(await row(cleanB)).id)).state,'needs_review');assert.equal(await tx(root.externalTransactionId),undefined);await assert.rejects(retryCommercialInbox(payload,(await row(cleanB)).id,'reviewed_envelope',actor),/report_evidence_requires_review/)
 const partial=await select([duplicate[0].id]);assert.equal(partial.context.transactionScopes.length,2);assert.equal(partial.processable,false);assert.ok(partial.blockers.includes('report_approval_evidence_required'))
 await assert.rejects(decide(partial),/financial_projection_requires_review/)
 checks.push('Cadastro canônico concorrente deduplica por provedor/conta/fonte/linha e não aplica valores. Correção do ID conecta a fonte antiga; aprovação ausente mantém bloqueio e não gera venda.')
 const complete={...base,recordReference:'synthetic-line-two',approvedAt:'2026-10-20T11:01:00.000Z',replaces:[{kind:'native' as const,id:source},{kind:'report' as const,id:duplicate[0].id}]}
 const hooks=payload.collections['commercial-report-evidence'].config.hooks,old=hooks.afterChange;hooks.afterChange=[...(old||[]),async()=>{throw Error('synthetic evidence rollback')}]
 try{await assert.rejects(recordReportEvidence(payload,actor,complete),/synthetic evidence rollback/)}finally{hooks.afterChange=old}
 assert.equal(await count('commercial-report-evidence'),1)
 const good=await recordReportEvidence(payload,actor,complete),badSelection=await select([good.id,duplicate[0].id]);assert.ok(badSelection.blockers.includes('report_replaced_source_selected'));assert.ok(badSelection.blockers.includes('report_replacement_overlap'))
 const ready=await select([good.id]);assert.equal(ready.processable,true);const result=await decide(ready)
 assert.equal((await tx('report-correct-b')).grossCents,12000);assert.equal((await tx('report-correct-b')).needsReview,false);assert.equal((await tx('report-wrong-a')).needsReview,true);assert.equal((await tx('report-wrong-a')).state,'unknown');assert.equal(await count('transaction-events'),1)
 assert.equal((await financialStatuses(payload,[{...scope,externalTransactionId:'report-correct-b'}])).get(commercialTransactionKey(root))?.state,'active')
 checks.push('Rollback de evidência não deixa prova parcial. Escolher substituto exige excluir fonte antiga; sobreposição bloqueia. Decisão aplica ID corrigido sem reescrever recibo/fato nativo nem criar webhook de relatório.')
 const refund=await recordReportEvidence(payload,actor,{...base,recordReference:'synthetic-refund-line',kind:'partially_refunded',occurredAt:'2026-10-21T11:01:00.000Z',approvedAt:complete.approvedAt,refundedCents:2000,refundBasis:'cumulative',replaces:[]})
 assert.equal((await tx('report-correct-b')).needsReview,true);assert.equal((await processCommercialInbox(payload,source)).state,'needs_review');assert.equal((await tx('report-correct-b')).refundedCents,null)
 const refundPlan=await select([good.id,refund.id]);assert.equal(refundPlan.processable,true);await decide(refundPlan)
 assert.equal((await tx('report-correct-b')).refundedCents,2000);assert.equal((await tx('report-correct-b')).producerNetCents,null);assert.equal(await count('transaction-events'),1)
 const csv=[...csvFields];csv[2]='report-correct-b';csv[4]='';csv[5]='partially_refunded';csv[6]='2026-10-21T11:01:00.000Z';csv[8]='12000';csv[9]='2000';csv[10]='';assert.equal((await previewCommercialCSV(payload,canonicalCSV([csv]))).lines[0].classification,'matched')
 checks.push('Novo relatório suspende cobertura anterior e não é aplicado automaticamente. Reembolso com total/base/aprovação explícitos requer nova decisão, preserva líquido desconhecido e é reconhecido pelo CSV.')
 const nativeRefund={...native,eventKey:'report-native-refund',externalTransactionId:'report-correct-b',reviewReason:undefined,kind:'refunded' as const,grossCents:12000,refundedCents:12000,refundBasis:'cumulative' as const,approvedAt:complete.approvedAt,occurredAt:'2026-10-22T11:01:00.000Z'}
 await receive(nativeRefund);assert.equal((await processCommercialInbox(payload,(await row(nativeRefund)).id)).state,'applied');assert.equal((await tx('report-correct-b')).refundedCents,12000);assert.equal(await count('transaction-events'),2)
 assert.equal(await count('financial-resolutions'),2);assert.equal(await count('financial-resolution-applications'),3)
 const nativeOriginal=await row(native);assert.equal((nativeOriginal.envelope as {reviewReason:string}).reviewReason,'unknown_event_time');assert.equal(nativeOriginal.envelopeHash,commercialEventDigest(native))
 checks.push('Continuidade por novo evento nativo íntegro reaplica a escolha que usa relatório e acrescenta somente fato nativo, sem duplicar decisões/vendas ou apagar revisão original.')
 const correction=await recordReportEvidence(payload,actor,{...base,recordReference:'synthetic-status-correction',kind:'canceled',currency:'USD',grossCents:9000,occurredAt:'2026-10-23T11:01:00.000Z',approvedAt:null,replaces:[{kind:'report',id:good.id},{kind:'report',id:refund.id},{kind:'native',id:(await row(nativeRefund)).id}]})
 const corrected=await select([correction.id]);assert.equal(corrected.processable,true);await decide(corrected)
 const correctedTx=await tx('report-correct-b');assert.equal(correctedTx.currency,'USD');assert.equal(correctedTx.state,'canceled');assert.equal(correctedTx.grossCents,9000);assert.equal(correctedTx.approvedAt,null);assert.equal(correctedTx.lastEventAt,'2026-10-23T11:01:00.000Z');assert.equal(correctedTx.needsReview,false);assert.equal(await count('transaction-events'),2)
 checks.push('Prova independente corrige moeda, valor, data e estado sob nova decisão completa, excluindo as fontes substituídas. Fatos históricos permanecem íntegros e aplicações não são novas vendas.')
 await assert.rejects(recordReportEvidence(payload,actor,{...base,recordReference:'synthetic-other-account',accountKey:'other'}),/invalid_report_reference/)
 await assert.rejects(payload.update({collection:'commercial-report-evidence',id:good.id,overrideAccess:true,data:{externalTransactionId:'tampered'}}))
 await assert.rejects(payload.delete({collection:'commercial-report-evidence',id:good.id,...seed.auth}))
 await assert.rejects(payload.create({collection:'commercial-report-evidence',...seed.auth,data:{}} as never))
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);await down({db:(payload.db as unknown as PostgresAdapter).sessions[id].db,payload,req})}),/report_evidence/)
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);const db=(payload.db as unknown as PostgresAdapter).sessions[id].db;await downReportImports({db,payload,req});await upReportImports({db,payload,req});throw Error('synthetic report CSV migration rollback')}),/synthetic report CSV migration rollback/)
 const importMetadata={sourceKind:'provider_report' as const,sourceReference:'synthetic-csv-source',reason:'report_reconciliation' as const},csvLine=[...reportEvidenceFields],duplicateLine=[...reportEvidenceFields]
 csvLine[2]='report-csv-created';csvLine[16]='synthetic-csv-created-line';duplicateLine[2]='report-csv-created';duplicateLine[16]='synthetic-csv-created-line'
 const canonicalBytes=canonicalReportEvidenceCSV([csvLine,duplicateLine]),batchesBeforePreview=(await payload.count({collection:'commercial-import-batches',overrideAccess:true})).totalDocs,preview=await previewReportEvidenceImport(payload,actor,canonicalBytes,importMetadata)
 assert.equal(preview.committable,false);assert.deepEqual(preview.counts,{new:1,duplicate:1,conflict:0});assert.equal((await payload.count({collection:'commercial-import-batches',overrideAccess:true})).totalDocs,batchesBeforePreview)
 const importKey=randomUUID(),staged=await stageReportEvidenceImport(payload,actor,canonicalBytes,importMetadata,importKey),stagedAgain=await stageReportEvidenceImport(payload,actor,canonicalBytes,importMetadata,importKey)
 assert.equal(staged.state,'ready');assert.equal(staged.duplicate,false);assert.equal(stagedAgain.duplicate,true);assert.equal(staged.id,stagedAgain.id)
 const createdBefore=await count('commercial-report-evidence'),confirmed=await commitReportEvidenceImport(payload,actor,staged.id,{confirmed:true,planHash:staged.planHash})
 assert.equal(confirmed.state,'confirmed');assert.equal(confirmed.recordsCreated,1);assert.equal(await count('commercial-report-evidence'),createdBefore+1)
 assert.deepEqual((await payload.find({collection:'commercial-import-rows',where:{batch:{equals:staged.id}},sort:'line',depth:0,overrideAccess:true})).docs.map(row=>row.state),['recorded','duplicate'])
 assert.equal((await commitReportEvidenceImport(payload,actor,staged.id,{confirmed:true,planHash:staged.planHash})).duplicate,true)
 checks.push('CSV canônico D77 gera prévia sem gravação, estágio idempotente e commit owner de evidência com duplicata interna; confirma evidência, não webhook/transação/venda.')
 const staleRow=[...reportEvidenceFields];staleRow[2]='report-csv-stale';staleRow[16]='synthetic-csv-stale-line';const staleBytes=canonicalReportEvidenceCSV([staleRow]),staleStage=await stageReportEvidenceImport(payload,actor,staleBytes,importMetadata,randomUUID())
 await recordReportEvidence(payload,actor,{...base,externalTransactionId:staleRow[2],recordReference:staleRow[16],sourceReference:importMetadata.sourceReference,replaces:[]})
 const staleResult=await commitReportEvidenceImport(payload,actor,staleStage.id,{confirmed:true,planHash:staleStage.planHash});assert.equal(staleResult.state,'stale')
 checks.push('Evidência criada depois do estágio altera planHash efetivo; commit CSV marca lote stale sem duplicar nem sobrescrever prova.')
 const rollbackRow=[...reportEvidenceFields];rollbackRow[2]='report-csv-rollback';rollbackRow[16]='synthetic-csv-rollback-line';const rollbackStage=await stageReportEvidenceImport(payload,actor,canonicalReportEvidenceCSV([rollbackRow]),importMetadata,randomUUID()),rollbackBefore=await count('commercial-report-evidence')
 const importHooks=payload.collections['commercial-report-evidence'].config.hooks,oldImportHooks=importHooks.afterChange;importHooks.afterChange=[...(oldImportHooks||[]),async({doc})=>{if(doc.input.recordReference==='synthetic-csv-rollback-line')throw Error('synthetic report CSV commit rollback')}]
 try{await assert.rejects(commitReportEvidenceImport(payload,actor,rollbackStage.id,{confirmed:true,planHash:rollbackStage.planHash}),/synthetic report CSV commit rollback/)}finally{importHooks.afterChange=oldImportHooks}
 assert.equal(await count('commercial-report-evidence'),rollbackBefore);assert.equal((await payload.findByID({collection:'commercial-import-batches',id:rollbackStage.id,depth:0,overrideAccess:true})).state,'ready')
 const rollbackConfirmed=await commitReportEvidenceImport(payload,actor,rollbackStage.id,{confirmed:true,planHash:rollbackStage.planHash});assert.equal(rollbackConfirmed.state,'confirmed');assert.equal(rollbackConfirmed.recordsCreated,1)
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);await downReportImports({db:(payload.db as unknown as PostgresAdapter).sessions[id].db,payload,req})}),/report_evidence_import_downgrade_forbidden/)
 checks.push('Falha durante gravação reverte evidência, estado de linha, confirmação e auditoria; retry explícito confirma atomicamente. Migration 27 protege lotes persistidos no downgrade.')
 assert.equal(result.revision,1)
 checks.push('Referências de outra conta são recusadas; CRUD nativo e alteração SQL por override são negados. Downgrade recusa evidência; down/up vazio foi ensaiado atomicamente.')
}finally{await seed.cleanup()}
await mkdir('artifacts/report-evidence',{recursive:true});await writeFile('artifacts/report-evidence/local-results.json',JSON.stringify({date:new Date().toISOString(),checks,schemaMigrations:27,externalCalls:false,limits:'Contrato canônico conferido pelo operador; sem parser/exportação nativa homologada, liquidação, recebimento, custos, UI ou produção.'},null,2)+'\n');console.log(`Evidência de relatório: ${checks.length} grupos aprovados; fixtures limpas.`);process.exit(0)
