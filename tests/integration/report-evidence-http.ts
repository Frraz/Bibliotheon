import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {testOrigin as base} from '../fixtures/origin'
import {seedCommerce} from '../fixtures/commerce'
import {type ReportEvidenceInput} from '../../src/modules/commerce/report-evidence-schema'
import {canonicalReportEvidenceCSV,reportEvidenceFields} from '../fixtures/commercial-csv'
assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true')
const seed=await seedCommerce(),{payload}=seed,checks:string[]=[],path='/api/v1/admin/report-evidence',batchPath='/api/v1/admin/report-evidence/batch'
const evidence:ReportEvidenceInput={provider:'hotmart',accountKey:'synthetic',externalTransactionId:'report-http-transaction',externalProductId:'synthetic-product',externalOfferId:null,kind:'approved',occurredAt:'2026-10-20T11:01:00.000Z',approvedAt:null,currency:'BRL',grossCents:12000,refundedCents:null,chargebackCents:null,feesCents:null,producerNetCents:null,refundBasis:null,externalRefundId:null,sourceKind:'provider_report',sourceReference:'synthetic-http-report',recordReference:'synthetic-line-unknown',evidenceVerified:true,replaces:[]}
try{
 const post=(target:string,input:unknown,headers:Record<string,string>={})=>fetch(base+target,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(input)})
 assert.equal((await post(path,evidence)).status,403)
 const login=await post('/api/admin-users/login',{email:seed.owner.email,password:seed.password});assert.equal(login.status,200);const {token}=await login.json(),auth={Authorization:`JWT ${token}`}
 const batchRecords=[{...evidence,externalTransactionId:'report-http-batch-one',recordReference:'synthetic-batch-line-one'},{...evidence,externalTransactionId:'report-http-batch-two',recordReference:'synthetic-batch-line-two'}]
 assert.equal((await post(batchPath,{records:batchRecords})).status,403)
 const batch=await post(batchPath,{records:batchRecords},auth);assert.equal(batch.status,201);assert.equal(batch.headers.get('cache-control'),'private, no-store');const batchBody=await batch.json();assert.equal(batchBody.records.length,2);assert.equal(batchBody.duplicate,false);assert.equal(batchBody.applied,false)
 assert.equal((await post(batchPath,{records:batchRecords},auth)).status,200)
 const batchCount=(await payload.count({collection:'commercial-report-evidence',overrideAccess:true})).totalDocs
 assert.equal((await post(batchPath,{records:[batchRecords[0],{...batchRecords[1],grossCents:14000}]},auth)).status,409)
 assert.equal((await payload.count({collection:'commercial-report-evidence',overrideAccess:true})).totalDocs,batchCount)
 assert.equal((await post(batchPath,{records:Array.from({length:21},(_,index)=>({...evidence,recordReference:`synthetic-batch-${index}`}))},auth)).status,422)
 checks.push('Lote exige owner/origem, persiste atomicamente, deduplica repetição integral, rejeita conflito sem adicionar linhas e limita o lote a vinte registros.')
 assert.equal((await post(path,evidence,{...auth,Origin:'https://other.invalid'})).status,403)
 assert.equal((await fetch(base+path,{method:'POST',headers:{...auth,Origin:base,'Content-Type':'text/csv'},body:'fixture'})).status,415)
 for(const extra of [{actor:seed.owner.id},{settledCents:12000},{sourceReference:'buyer@example.invalid'},{evidenceVerified:false}])assert.equal((await post(path,{...evidence,...extra},auth)).status,422)
 assert.equal((await post(path,{...evidence,occurredAt:'2099-01-01T00:00:00Z'},auth)).status,422)
 const recorded=await post(path,evidence,auth);assert.equal(recorded.status,201);assert.equal(recorded.headers.get('cache-control'),'private, no-store');assert.equal(recorded.headers.get('referrer-policy'),'no-referrer');const partial=await recorded.json();assert.equal(partial.applied,false)
 assert.equal((await post(path,evidence,auth)).status,200);assert.equal((await post(path,{...evidence,grossCents:13000},auth)).status,409)
 const choice={provider:evidence.provider,accountKey:evidence.accountKey,externalTransactionId:evidence.externalTransactionId,action:'reconcile',selections:[]}
 const preview=async(ids:string[])=>{const inspection=await post('/api/v1/admin/transaction-resolutions/preview',choice,auth);assert.equal(inspection.status,200);const inspect=await inspection.json();const response=await post('/api/v1/admin/transaction-resolutions/preview',{...choice,selections:inspect.context.receipts.map((r:{id:string;variants:{hash:string}[]})=>({inboxId:r.id,envelopeHash:ids.includes(r.id)?r.variants[0].hash:null,reason:ids.includes(r.id)?'source_confirmed':'source_rejected'}))},auth);assert.equal(response.status,200);return response.json()}
 const decide=async(plan:{choice:unknown;planHash:string})=>post('/api/v1/admin/transaction-resolutions',{...(plan.choice as object),planHash:plan.planHash,sourceKind:'provider_report',sourceReference:'synthetic-http-decision',reason:'provider_records_verified',evidenceVerified:true,confirmed:true},{...auth,'Idempotency-Key':randomUUID()})
 const blocked=await preview([partial.id]);assert.equal(blocked.processable,false);assert.equal((await decide(blocked)).status,409);assert.equal((await payload.count({collection:'transactions',overrideAccess:true})).totalDocs,0)
 checks.push('Rota real exige owner/origem/MIME e contrato exato; retorna registro privado e idempotente, sem aplicação. Snapshot pago sem prova de aprovação não confirma nem cria transação.')
 const complete={...evidence,recordReference:'synthetic-line-complete',approvedAt:evidence.occurredAt,replaces:[{kind:'report',id:partial.id}]}
 const goodResponse=await post(path,complete,auth);assert.equal(goodResponse.status,201);const good=await goodResponse.json()
 const selected=await preview([good.id]);assert.equal(selected.processable,true);assert.equal((await decide(selected)).status,201)
 const duplicate=await post(path,complete,auth);assert.equal(duplicate.status,200)
 let transaction=(await payload.find({collection:'transactions',limit:1,overrideAccess:true,depth:0})).docs[0];assert.equal(transaction.grossCents,12000);assert.equal(transaction.needsReview,false)
 assert.equal((await payload.count({collection:'transaction-events',overrideAccess:true})).totalDocs,0)
 checks.push('Relatório completo é selecionado na revisão inteira com exclusão da fonte substituída. Confirmação aplica projeção sem criar recibo/fato nativo; repetição do registro não invalida decisão vigente.')
 const unknownRefund={...evidence,recordReference:'synthetic-refund-unknown',kind:'partially_refunded',approvedAt:evidence.occurredAt,occurredAt:'2026-10-21T11:01:00.000Z',refundedCents:2000,replaces:[]}
 const incompleteResponse=await post(path,unknownRefund,auth);assert.equal(incompleteResponse.status,201);const incomplete=await incompleteResponse.json()
 transaction=await payload.findByID({collection:'transactions',id:transaction.id,overrideAccess:true,depth:0});assert.equal(transaction.needsReview,true)
 const noBasis=await preview([good.id,incomplete.id]);assert.equal(noBasis.processable,false);assert.equal((await decide(noBasis)).status,409)
 const correctedResponse=await post(path,{...unknownRefund,recordReference:'synthetic-refund-complete',refundBasis:'cumulative',replaces:[{kind:'report',id:incomplete.id}]},auth);assert.equal(correctedResponse.status,201);const corrected=await correctedResponse.json()
 const reversal=await preview([good.id,corrected.id]);assert.equal(reversal.processable,true);assert.equal((await decide(reversal)).status,201)
 transaction=await payload.findByID({collection:'transactions',id:transaction.id,overrideAccess:true,depth:0});assert.equal(transaction.refundedCents,2000);assert.equal(transaction.needsReview,false);assert.equal(transaction.producerNetCents,null)
 assert.equal((await payload.count({collection:'transaction-events',overrideAccess:true})).totalDocs,0)
 assert.equal((await fetch(base+'/api/commercial-report-evidence')).status,403);assert.equal((await post('/api/commercial-report-evidence',{},auth)).status,403)
 assert.equal((await fetch(base+'/api/commercial-report-evidence/'+good.id,{method:'DELETE',headers:auth})).status,403)
 checks.push('Evidência nova põe cobertura em revisão; base de reembolso ausente bloqueia até nova prova/decisão explícita. CRUD nativo segue negado e líquido desconhecido permanece null.')
 const csvPath='/api/v1/admin/report-evidence/imports',csvMeta={'Content-Type':'text/csv','x-import-source':'provider_report','x-import-reference':'synthetic-http-csv','x-import-reason':'report_reconciliation'},csvRow=[...reportEvidenceFields];csvRow[2]='report-http-csv';csvRow[16]='synthetic-http-csv-line'
 const csvPost=(target:string,body:Buffer,headers:Record<string,string>={})=>fetch(base+target,{method:'POST',headers:{Origin:base,...headers},body:new Uint8Array(body)})
 assert.equal((await csvPost(csvPath+'/preview',canonicalReportEvidenceCSV([csvRow]),csvMeta)).status,403)
 assert.equal((await csvPost(csvPath+'/preview',canonicalReportEvidenceCSV([csvRow]),{...csvMeta,...auth})).status,200)
 const csvPreview=await csvPost(csvPath+'/preview',canonicalReportEvidenceCSV([csvRow]),{...csvMeta,...auth}),csvPreviewBody=await csvPreview.json();assert.equal(csvPreviewBody.provisional,true);assert.equal(csvPreviewBody.committable,false);assert.equal(csvPreviewBody.counts.new,1)
 const key=randomUUID(),csvHeaders={...csvMeta,...auth,'Idempotency-Key':key},csvBody=canonicalReportEvidenceCSV([csvRow]),csvStage=await csvPost(csvPath,csvBody,csvHeaders);assert.equal(csvStage.status,201);assert.equal(csvStage.headers.get('cache-control'),'private, no-store');const csvStageBody=await csvStage.json()
 const csvStageAgain=await csvPost(csvPath,csvBody,csvHeaders);assert.equal(csvStageAgain.status,200);assert.equal((await csvStageAgain.json()).id,csvStageBody.id)
 const csvCommitPath=csvPath+'/'+csvStageBody.id+'/commit',csvCommit=await post(csvCommitPath,{confirmed:true,planHash:csvStageBody.planHash},auth);assert.equal(csvCommit.status,201);assert.equal((await csvCommit.json()).recordsCreated,1)
 assert.equal((await post(csvCommitPath,{confirmed:true,planHash:csvStageBody.planHash},auth)).status,200)
 assert.equal((await payload.count({collection:'transaction-events',overrideAccess:true})).totalDocs,0)
 checks.push('CSV canônico é preview sem persistência, estágio owner idempotente e commit explicitamente confirmado. Resposta mantém cache privado; commit registra evidência sem recibo/webhook/evento nativo.')
}finally{await seed.cleanup()}
await mkdir('artifacts/report-evidence',{recursive:true});await writeFile('artifacts/report-evidence/http-results.json',JSON.stringify({date:new Date().toISOString(),checks,schemaMigrations:27,externalCalls:false,limits:'HTTP local sintético do contrato canônico; sem relatório nativo homologado, liquidação, UI ou produção.'},null,2)+'\n');console.log(`Evidência de relatório HTTP: ${checks.length} grupos aprovados; fixtures limpas.`);process.exit(0)
