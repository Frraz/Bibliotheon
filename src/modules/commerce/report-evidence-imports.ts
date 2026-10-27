import {randomUUID} from 'node:crypto'
import {sql,type PostgresAdapter} from '@payloadcms/db-postgres'
import type {Payload,PayloadRequest} from 'payload'
import type {CommercialImportBatch,CommercialImportRow} from '../../payload-types'
import {atomic,serial} from '../marketing/transaction'
import {lockCommercialAccounts} from './lock'
import {prepareReportEvidence,type ReportEvidenceInput} from './report-evidence-schema'
import {parseReportEvidenceCSV,REPORT_EVIDENCE_CSV_MAX_ROWS,type ReportEvidenceCSVLine} from './report-evidence-csv'
import {hashImport,requireImportOwner,type ImportActor,type ImportMetadata} from './import-plan'
import {relatedReportEvidenceSources,recordReportEvidenceBatchInTransaction,restoreReportEvidence} from './report-evidence'

export class ReportEvidenceImportError extends Error{constructor(readonly status:number,readonly code:string){super(code)}}
export const reportEvidenceImportMetadata=(value:unknown):ImportMetadata|null=>{
 if(!value||typeof value!=='object'||Array.isArray(value))return null
 const row=value as Record<string,unknown>
 if(Object.keys(row).length!==3||!['provider_report','manual_reconciliation'].includes(String(row.sourceKind))||typeof row.sourceReference!=='string'||!/^[a-z][a-z0-9_-]{2,95}$/.test(row.sourceReference)||row.reason!=='report_reconciliation')return null
 return row as ImportMetadata
}
type ParsedReportImport=Omit<ReturnType<typeof parseReportEvidenceCSV>,'lines'>&{lines:Extract<ReportEvidenceCSVLine,{ok:true}>[]}
function parseReportImport(bytes:Uint8Array,source:ImportMetadata):ParsedReportImport{
 if(source.reason!=='report_reconciliation')throw new ReportEvidenceImportError(422,'invalid_import_metadata')
 const parsed=parseReportEvidenceCSV(bytes,source)
 if(parsed.lines.some(line=>!line.ok))throw new ReportEvidenceImportError(422,'invalid_rows')
 const lines=parsed.lines as ParsedReportImport['lines']
 if(new Set(lines.map(line=>JSON.stringify([line.input.provider,line.input.accountKey]))).size!==1)throw new ReportEvidenceImportError(422,'mixed_accounts')
 return{...parsed,lines}
}
const importOwner=(actor:ImportActor)=>requireImportOwner(actor)
const batchManifest=(lines:readonly Extract<ReportEvidenceCSVLine,{ok:true}>[])=>hashImport(lines.map(line=>[line.line,line.key,line.digest]))
type ReportPlanLine={line:number;key:string;digest:string;classification:'new'|'duplicate'|'conflict';reason:'report_evidence_new'|'report_evidence_duplicate'|'report_record_conflict'|'conflict_in_file';duplicateOf?:number}
async function buildReportEvidencePlan(payload:Payload,lines:ParsedReportImport['lines'],req:PayloadRequest){
 const groups=new Map<string,{first:number;digest:string;conflict:boolean}>()
 for(const line of lines){const prior=groups.get(line.key);if(!prior)groups.set(line.key,{first:line.line,digest:line.digest,conflict:false});else if(prior.digest!==line.digest)prior.conflict=true}
 const keys=[...groups.keys()],found=await payload.find({collection:'commercial-report-evidence',where:{key:{in:keys}},limit:REPORT_EVIDENCE_CSV_MAX_ROWS+1,depth:0,overrideAccess:true,req})
 if(found.totalDocs>REPORT_EVIDENCE_CSV_MAX_ROWS)throw new ReportEvidenceImportError(503,'report_history_limit')
 const existing=new Map(found.docs.map(row=>{const prepared=restoreReportEvidence(row);return[row.key,{requestHash:prepared.requestHash}] as const}))
 const planned:ReportPlanLine[]=lines.map(line=>{
  const group=groups.get(line.key)!
  if(group.conflict)return{line:line.line,key:line.key,digest:line.digest,classification:'conflict',reason:'conflict_in_file'}
  if(group.first!==line.line)return{line:line.line,key:line.key,digest:line.digest,classification:'duplicate',reason:'report_evidence_duplicate',duplicateOf:group.first}
  const prior=existing.get(line.key)
  if(prior)return{line:line.line,key:line.key,digest:line.digest,classification:prior.requestHash===line.digest?'duplicate':'conflict',reason:prior.requestHash===line.digest?'report_evidence_duplicate':'report_record_conflict'}
  return{line:line.line,key:line.key,digest:line.digest,classification:'new',reason:'report_evidence_new'}
 })
 const conflict=planned.some(line=>line.classification==='conflict')
 const counts:Record<string,number>={new:0,duplicate:0,conflict:0}
 for(const line of planned)counts[line.classification]++
 const planHash=hashImport([batchManifest(lines),planned,found.docs.map(row=>[row.key,row.requestHash,row.envelopeHash]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))])
 return{planHash,lines:planned,counts,state:conflict?'blocked' as const:'ready' as const}
}
function publicPlan(plan:Awaited<ReturnType<typeof buildReportEvidencePlan>>){return{state:plan.state,planHash:plan.planHash,counts:plan.counts,lines:plan.lines.map(({line,classification,reason,duplicateOf})=>({line,classification,reason,...(duplicateOf?{duplicateOf}:{})}))}}
/** Preview only; no persistent batch, evidence, or projection is created. */
export async function previewReportEvidenceImport(payload:Payload,actor:ImportActor,bytes:Uint8Array,metadata:unknown,now=Date.now()){
 importOwner(actor)
 const source=reportEvidenceImportMetadata(metadata)
 if(!source)throw new ReportEvidenceImportError(422,'invalid_import_metadata')
 const parsed=parseReportImport(bytes,source)
 if(parsed.lines.some(line=>[line.input.occurredAt,line.input.approvedAt].some(date=>date&&Date.parse(date)>now+300000)))throw new ReportEvidenceImportError(422,'future_event_time')
 const result=await atomic(payload,async req=>{
  const id=await req.transactionID,db=id&&(payload.db as unknown as PostgresAdapter).sessions[id]?.db
  if(!db)throw new ReportEvidenceImportError(503,'transaction_unavailable')
  await db.execute(sql`SET LOCAL statement_timeout='5s'`)
  await lockCommercialAccounts(req,[parsed.lines[0].input])
  const prepared=parsed.lines.map(line=>prepareReportEvidence(line.input))
  for(const item of prepared)await relatedReportEvidenceSources(payload,item,req)
  return buildReportEvidencePlan(payload,parsed.lines,req)
 })
 return{fileHash:parsed.fileHash,provisional:true as const,committable:false as const,...publicPlan(result)}
}
/** Stage a bounded canonical report CSV in the private D67 lot/row/audit journal. */
export async function stageReportEvidenceImport(payload:Payload,actor:ImportActor,bytes:Uint8Array,metadata:unknown,idempotencyKey:unknown,now=Date.now()){
 const owner=importOwner(actor),source=reportEvidenceImportMetadata(metadata)
 if(!source||typeof idempotencyKey!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(idempotencyKey))throw new ReportEvidenceImportError(422,'invalid_import_metadata')
 const parsed=parseReportImport(bytes,source),key=hashImport([owner.id,idempotencyKey.toLowerCase()]),requestHash=hashImport([parsed.fileHash,source,owner.id,'report-evidence-csv-v1'])
 if(parsed.lines.some(line=>[line.input.occurredAt,line.input.approvedAt].some(date=>date&&Date.parse(date)>now+300000)))throw new ReportEvidenceImportError(422,'future_event_time')
 return atomic(payload,async req=>{
  const txid=await req.transactionID,db=txid&&(payload.db as unknown as PostgresAdapter).sessions[txid]?.db
  if(!db)throw new ReportEvidenceImportError(503,'transaction_unavailable')
  await db.execute(sql`SET LOCAL statement_timeout='5s'`)
  await serial(req,'commercial-import:'+key)
  const existing=(await payload.find({collection:'commercial-import-batches',where:{key:{equals:key}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
  if(existing){if(existing.requestHash!==requestHash||existing.kind!=='report_evidence')throw new ReportEvidenceImportError(409,'idempotency_conflict');return{state:existing.state,id:existing.id,planHash:existing.planHash,duplicate:true}}
  await lockCommercialAccounts(req,[parsed.lines[0].input])
  const prepared=parsed.lines.map(line=>prepareReportEvidence(line.input))
  for(const item of prepared)await relatedReportEvidenceSources(payload,item,req)
  const plan=await buildReportEvidencePlan(payload,parsed.lines,req),manifestHash=batchManifest(parsed.lines)
  const batch=await payload.create({collection:'commercial-import-batches',data:{key,kind:'report_evidence',requestHash,fileHash:parsed.fileHash,manifestHash,planHash:plan.planHash,...source,actor:owner.id,state:plan.state,rowCount:parsed.lines.length,counts:plan.counts,stagedAt:new Date(now).toISOString()},overrideAccess:true,req})
  const id=typeof batch.id==='string'?batch.id:String(batch.id)
  const rows=parsed.lines.map(line=>{
   const planned=plan.lines[line.line-2],state=planned.classification==='new'?'planned':planned.classification==='duplicate'?'duplicate':'blocked'
   return sql`(${randomUUID()}::uuid,${hashImport([id,line.line])},${id}::uuid,${line.line},${line.digest},${line.transactionKey},${JSON.stringify(line.input)}::jsonb,${planned.classification}::enum_commercial_import_rows_classification,${planned.reason},${planned.duplicateOf??null},${state}::enum_commercial_import_rows_state)`
  })
  await db.execute(sql`INSERT INTO commercial_import_rows (id,key,batch_id,line,row_hash,transaction_key,normalized,classification,reason,duplicate_of,state) VALUES ${sql.join(rows,sql`,`)}`)
  await payload.create({collection:'commercial-import-audit',data:{batch:id,actor:owner.id,action:'staged',occurredAt:new Date(now).toISOString(),reason:'report_evidence_csv'},overrideAccess:true,req})
  return{state:batch.state,id,planHash:batch.planHash,duplicate:false,counts:plan.counts,lines:publicPlan(plan).lines}
 })
}
function confirmation(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==2||!('confirmed'in input)||(input as {confirmed?:unknown}).confirmed!==true||!('planHash'in input)||typeof(input as {planHash?:unknown}).planHash!=='string'||!/^[a-f0-9]{64}$/.test((input as {planHash:string}).planHash))throw new ReportEvidenceImportError(422,'invalid_confirmation')
 return(input as {planHash:string}).planHash
}
/** Confirmation revalidates the staged manifest and report evidence under the account barrier. */
export async function commitReportEvidenceImport(payload:Payload,actor:ImportActor,id:string,input:unknown,now=Date.now()){
 const owner=importOwner(actor),planHashInput=confirmation(input)
 if(!/^[a-f0-9-]{36}$/i.test(id))throw new ReportEvidenceImportError(422,'invalid_import_id')
 id=id.toLowerCase()
 return atomic(payload,async req=>{
  const txid=await req.transactionID,db=txid&&(payload.db as unknown as PostgresAdapter).sessions[txid]?.db
  if(!db)throw new ReportEvidenceImportError(503,'transaction_unavailable')
  await db.execute(sql`SET LOCAL statement_timeout='5s'`)
  await serial(req,'commercial-import-id:'+id)
  const batch=await payload.findByID({collection:'commercial-import-batches',id,depth:0,overrideAccess:true,disableErrors:true,req}) as CommercialImportBatch|null
  if(!batch||batch.kind!=='report_evidence')throw new ReportEvidenceImportError(404,'not_found')
  if(planHashInput!==batch.planHash)throw new ReportEvidenceImportError(409,'plan_conflict')
  if(batch.state==='confirmed'){
   await payload.create({collection:'commercial-import-audit',data:{batch:id,actor:owner.id,action:'duplicate_commit',occurredAt:new Date(now).toISOString(),reason:'already_confirmed'},overrideAccess:true,req})
   return{state:batch.state,id,duplicate:true,recordsCreated:0}
  }
  if(batch.state!=='ready')throw new ReportEvidenceImportError(409,'batch_not_ready')
  const source=reportEvidenceImportMetadata({sourceKind:batch.sourceKind,sourceReference:batch.sourceReference,reason:batch.reason})
  if(!source||hashImport([batch.fileHash,source,typeof batch.actor==='string'?batch.actor:batch.actor.id,'report-evidence-csv-v1'])!==batch.requestHash)throw new ReportEvidenceImportError(409,'integrity_conflict')
  const stored=await payload.find({collection:'commercial-import-rows',where:{batch:{equals:id}},sort:'line',limit:REPORT_EVIDENCE_CSV_MAX_ROWS+1,depth:0,overrideAccess:true,req})
  if(stored.totalDocs!==batch.rowCount||stored.docs.length!==batch.rowCount||stored.docs.length>REPORT_EVIDENCE_CSV_MAX_ROWS)throw new ReportEvidenceImportError(409,'integrity_conflict')
  const lines:Extract<ReportEvidenceCSVLine,{ok:true}>[]=[]
  for(const [index,row] of (stored.docs as CommercialImportRow[]).entries()){
   const inputRow=row.normalized as ReportEvidenceInput,prepared=prepareReportEvidence(inputRow)
   const first=lines[0]?.input
   if(row.line!==index+2||row.rowHash!==prepared.requestHash||row.transactionKey!==prepared.transactionKey||row.key!==hashImport([id,row.line])||inputRow.sourceKind!==batch.sourceKind||inputRow.sourceReference!==batch.sourceReference||first&&(inputRow.provider!==first.provider||inputRow.accountKey!==first.accountKey))throw new ReportEvidenceImportError(409,'integrity_conflict')
   lines.push({line:row.line,ok:true,input:prepared.input,key:prepared.key,digest:prepared.requestHash,transactionKey:prepared.transactionKey})
  }
  if(batchManifest(lines)!==batch.manifestHash)throw new ReportEvidenceImportError(409,'integrity_conflict')
  await lockCommercialAccounts(req,[lines[0].input])
  const prepared=lines.map(line=>prepareReportEvidence(line.input))
  for(const item of prepared)await relatedReportEvidenceSources(payload,item,req)
  const plan=await buildReportEvidencePlan(payload,lines,req)
  if(plan.planHash!==batch.planHash||plan.state!=='ready'){
   await payload.update({collection:'commercial-import-batches',id,data:{state:'stale'},overrideAccess:true,req})
   await payload.create({collection:'commercial-import-audit',data:{batch:id,actor:owner.id,action:'stale',occurredAt:new Date(now).toISOString(),reason:'report_evidence_changed'},overrideAccess:true,req})
   return{state:'stale' as const,id,duplicate:false,recordsCreated:0}
  }
  const toRecord=lines.filter(line=>plan.lines[line.line-2].classification==='new').map(line=>prepareReportEvidence(line.input))
  const results=toRecord.length?await recordReportEvidenceBatchInTransaction(payload,req,{id:owner.id,collection:'admin-users',role:'owner'},toRecord,now):[]
  const recorded=stored.docs.filter(row=>plan.lines[row.line-2].classification==='new').map(row=>sql`(${row.id}::uuid,'recorded'::enum_commercial_import_rows_state)`)
  if(recorded.length)await db.execute(sql`UPDATE commercial_import_rows AS target SET state=source.state FROM (VALUES ${sql.join(recorded,sql`,`)}) AS source(id,state) WHERE target.id=source.id`)
  await payload.update({collection:'commercial-import-batches',id,data:{state:'confirmed',confirmedAt:new Date(now).toISOString(),confirmedBy:owner.id},overrideAccess:true,req})
  await payload.create({collection:'commercial-import-audit',data:{batch:id,actor:owner.id,action:'confirmed',occurredAt:new Date(now).toISOString(),reason:'report_evidence_recorded'},overrideAccess:true,req})
  return{state:'confirmed' as const,id,duplicate:false,recordsCreated:results.filter(result=>!result.duplicate).length}
 })
}
