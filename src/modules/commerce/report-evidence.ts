import type {Payload,PayloadRequest} from 'payload'
import {sql,type PostgresAdapter} from '@payloadcms/db-postgres'
import {atomic,serial} from '../marketing/transaction'
import {lockCommercialAccounts} from './lock'
import {markFinancialEvidencePending} from './financial-store'
import {opaqueID,commercialTransactionKey,commercialEventDigest,restoreStoredCommercialReceipt} from './events'
import {prepareReportEvidence,ReportEvidenceError,REPORT_EVIDENCE_VERSION} from './report-evidence-schema'
import {storedCommercialEnvelope} from './stored-envelope'
import type {CommercialReportEvidence} from '../../payload-types'
/** Rebuild from the canonical input; JSONB ordering cannot change the hash contract. */
export function restoreReportEvidence(row:CommercialReportEvidence){
 try{
  const prepared=prepareReportEvidence(row.input)
  const restored=restoreStoredCommercialReceipt(row.envelope,prepared.input,REPORT_EVIDENCE_VERSION)
  if(row.version!==REPORT_EVIDENCE_VERSION||row.key!==prepared.key||row.requestHash!==prepared.requestHash||row.provider!==prepared.input.provider||row.accountKey!==prepared.input.accountKey||row.externalTransactionId!==prepared.input.externalTransactionId||row.transactionKey!==prepared.transactionKey||row.envelopeHash!==prepared.envelopeHash||restored.state!=='prepared'||commercialEventDigest(restored.event)!==prepared.envelopeHash||!Array.isArray(row.relatedTransactionIds)||!row.relatedTransactionIds.every(opaqueID)||!row.relatedTransactionIds.includes(prepared.input.externalTransactionId)||JSON.stringify(row.transactionKeys)!==JSON.stringify(row.relatedTransactionIds.map(id=>commercialTransactionKey({...prepared.input,externalTransactionId:String(id)}))))throw new Error('integrity')
  return prepared
 }catch{throw new ReportEvidenceError(503,'report_evidence_integrity')}
}
export async function relatedReportEvidenceSources(payload:Payload,prepared:ReturnType<typeof prepareReportEvidence>,req:PayloadRequest){
 const ids=new Set([prepared.input.externalTransactionId]),deadline=Date.now()+5000;let examined=0
 for(const reference of prepared.input.replaces){
  if(Date.now()>deadline||examined>10000)throw new ReportEvidenceError(503,'report_reference_limit')
  if(reference.kind==='report'){
   const source=await payload.findByID({collection:'commercial-report-evidence',id:reference.id,overrideAccess:true,disableErrors:true,depth:0,req})
   if(!source||source.provider!==prepared.input.provider||source.accountKey!==prepared.input.accountKey)throw new ReportEvidenceError(422,'invalid_report_reference')
   restoreReportEvidence(source);examined+=(source.relatedTransactionIds as string[]).length;for(const id of source.relatedTransactionIds as string[])ids.add(id)
  }else{
   const source=await payload.findByID({collection:'commercial-inbox',id:reference.id,overrideAccess:true,disableErrors:true,depth:0,req})
   if(!source||source.provider!==prepared.input.provider||source.accountKey!==prepared.input.accountKey)throw new ReportEvidenceError(422,'invalid_report_reference')
   const conflicts=await payload.find({collection:'commercial-conflicts',where:{inbox:{equals:source.id}},limit:10001,overrideAccess:true,depth:0,req})
   if(conflicts.totalDocs>10000)throw new ReportEvidenceError(503,'report_reference_limit')
   examined+=1+conflicts.docs.length
   if(examined>10000)throw new ReportEvidenceError(503,'report_reference_limit')
   let financial=false
   const sourceEnvelope=await storedCommercialEnvelope(payload,source as never,req)
   if(!sourceEnvelope)throw new ReportEvidenceError(422,'invalid_report_reference')
   for(const variant of [{envelope:sourceEnvelope,envelopeHash:source.envelopeHash,adapterVersion:source.adapterVersion},...conflicts.docs]){
    const restored=restoreStoredCommercialReceipt(variant.envelope,prepared.input,variant.adapterVersion)
    if(restored.state==='invalid_event'||restored.key!==source.key||restored.digest!==variant.envelopeHash)throw new ReportEvidenceError(503,'report_reference_integrity')
    if(restored.state==='prepared'){ids.add(restored.event.externalTransactionId);financial=true}
   }
   if(!financial)throw new ReportEvidenceError(422,'invalid_report_reference')
  }
  if(ids.size>10000||examined>10000||Date.now()>deadline)throw new ReportEvidenceError(503,'report_reference_limit')
 }
 return [...ids].sort()
}
export function prepareReportEvidenceBatch(actor:{id:string;collection:string;role:string}|null,inputs:unknown,now=Date.now()){
 if(actor?.collection!=='admin-users'||actor.role!=='owner')throw new ReportEvidenceError(403,'forbidden')
 if(!Array.isArray(inputs)||inputs.length<1||inputs.length>20)throw new ReportEvidenceError(422,'invalid_report_batch')
 const prepared=inputs.map(prepareReportEvidence),keys=new Set<string>()
 for(const item of prepared){
  if([item.event.occurredAt,item.event.approvedAt].some(date=>date&&Date.parse(date)>now+300000))throw new ReportEvidenceError(422,'future_event_time')
  if(keys.has(item.key))throw new ReportEvidenceError(422,'duplicate_report_batch_line')
  keys.add(item.key)
 }
 return prepared
}
/** Caller keeps evidence, import row states and audit in the same transaction. */
export async function recordReportEvidenceBatchInTransaction(payload:Payload,req:PayloadRequest,actor:{id:string;collection:string;role:string},prepared:ReturnType<typeof prepareReportEvidenceBatch>,now=Date.now()){
 const transactionID=await req.transactionID,db=transactionID&&(payload.db as unknown as PostgresAdapter).sessions[transactionID]?.db
 if(!db)throw new ReportEvidenceError(503,'transaction_unavailable')
 await db.execute(sql`SET LOCAL statement_timeout='5s'`)
 await lockCommercialAccounts(req,prepared.map(item=>item.input))
 for(const item of [...prepared].sort((a,b)=>a.key.localeCompare(b.key)))await serial(req,'commercial-report:'+item.key)
 const results=[]
 for(const item of prepared){
  const previous=(await payload.find({collection:'commercial-report-evidence',where:{key:{equals:item.key}},limit:1,overrideAccess:true,depth:0,req})).docs[0]
  if(previous){restoreReportEvidence(previous);if(previous.requestHash!==item.requestHash)throw new ReportEvidenceError(409,'report_record_conflict');results.push({id:previous.id,key:previous.key,envelopeHash:previous.envelopeHash,duplicate:true,applied:false as const});continue}
  const relatedTransactionIds=await relatedReportEvidenceSources(payload,item,req),transactionKeys=relatedTransactionIds.map(externalTransactionId=>commercialTransactionKey({...item.input,externalTransactionId}))
  const row=await payload.create({collection:'commercial-report-evidence',overrideAccess:true,depth:0,req,data:{key:item.key,requestHash:item.requestHash,provider:item.input.provider,accountKey:item.input.accountKey,externalTransactionId:item.input.externalTransactionId,transactionKey:item.transactionKey,transactionKeys,relatedTransactionIds,input:item.input,envelope:item.event,envelopeHash:item.envelopeHash,version:REPORT_EVIDENCE_VERSION,actor:actor.id,recordedAt:new Date(now).toISOString()}})
  await markFinancialEvidencePending(req,transactionKeys,'report_evidence_pending',true)
  results.push({id:row.id,key:row.key,envelopeHash:row.envelopeHash,duplicate:false,applied:false as const})
 }
 return results
}
/** Persists a bounded evidence lot atomically; owner must select it in a separately revalidated component decision. */
export async function recordReportEvidenceBatch(payload:Payload,actor:{id:string;collection:string;role:string}|null,inputs:unknown,now=Date.now()){
 const prepared=prepareReportEvidenceBatch(actor,inputs,now)
 return atomic(payload,req=>recordReportEvidenceBatchInTransaction(payload,req,{id:actor!.id,collection:actor!.collection,role:actor!.role},prepared,now))
}
/** Single-record compatibility wrapper. */
export async function recordReportEvidence(payload:Payload,actor:{id:string;collection:string;role:string}|null,input:unknown,now=Date.now()){
 const [result]=await recordReportEvidenceBatch(payload,actor,[input],now);return result
}
