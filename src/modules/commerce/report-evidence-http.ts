import type {Payload} from 'payload'
import {readCommercialBody} from './import-http'
import {CommercialImportError} from './import-plan'
import {recordReportEvidence,recordReportEvidenceBatch} from './report-evidence'
import {ReportEvidenceError} from './report-evidence-schema'
import {transactionReviewResponse} from './transaction-review-http'
export async function reportEvidenceRequest(request:Request,payload:Payload){
 try{
  const {user}=await payload.auth({headers:request.headers})
  if(user?.collection!=='admin-users'||user.role!=='owner'||request.headers.get('origin')!==new URL(process.env.PUBLIC_SITE_URL||'http://127.0.0.1:3000').origin)throw new ReportEvidenceError(403,'forbidden')
  const bytes=await readCommercialBody(request,64*1024,'application/json');let input:unknown
  try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new ReportEvidenceError(422,'invalid_report_evidence')}
  const result=await recordReportEvidence(payload,user,input)
  return transactionReviewResponse(result,result.duplicate?200:201)
 }catch(error){return transactionReviewResponse({code:error instanceof ReportEvidenceError||error instanceof CommercialImportError?error.code:'unavailable'},error instanceof ReportEvidenceError||error instanceof CommercialImportError?error.status:503)}
}
/** Canonical JSON lot only; this endpoint does not parse provider CSV exports. */
export async function reportEvidenceBatchRequest(request:Request,payload:Payload){
 try{
  const {user}=await payload.auth({headers:request.headers})
  if(user?.collection!=='admin-users'||user.role!=='owner'||request.headers.get('origin')!==new URL(process.env.PUBLIC_SITE_URL||'http://127.0.0.1:3000').origin)throw new ReportEvidenceError(403,'forbidden')
  const bytes=await readCommercialBody(request,512*1024,'application/json');let body:unknown
  try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new ReportEvidenceError(422,'invalid_report_batch')}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||!Object.hasOwn(body,'records'))throw new ReportEvidenceError(422,'invalid_report_batch')
  const records=(body as {records:unknown}).records
  const results=await recordReportEvidenceBatch(payload,user,records)
  const duplicate=results.every(result=>result.duplicate)
  return transactionReviewResponse({records:results,duplicate,applied:false},duplicate?200:201)
 }catch(error){return transactionReviewResponse({code:error instanceof ReportEvidenceError||error instanceof CommercialImportError?error.code:'unavailable'},error instanceof ReportEvidenceError||error instanceof CommercialImportError?error.status:503)}
}
