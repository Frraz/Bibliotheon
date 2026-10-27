import type {Payload} from 'payload'
import {readCommercialBody} from './import-http'
import {CommercialCSVError} from './csv'
import {CommercialImportError,requireImportOwner} from './import-plan'
import {ReportEvidenceCSVError,REPORT_EVIDENCE_CSV_MAX_BYTES} from './report-evidence-csv'
import {ReportEvidenceError} from './report-evidence-schema'
import {commitReportEvidenceImport,previewReportEvidenceImport,ReportEvidenceImportError,reportEvidenceImportMetadata,stageReportEvidenceImport} from './report-evidence-imports'
const response=(status:number,value:unknown)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}})
async function authorize(request:Request,payload:Payload,env:Readonly<Record<string,string|undefined>>){
 const {user}=await payload.auth({headers:request.headers})
 if(user?.collection!=='admin-users'||user.role!=='owner'||request.headers.get('origin')!==new URL(env.PUBLIC_SITE_URL||'http://127.0.0.1:3000').origin)throw new CommercialImportError(403,'forbidden')
 return requireImportOwner(user)
}
function metadata(request:Request){
 const value=reportEvidenceImportMetadata({sourceKind:request.headers.get('x-import-source'),sourceReference:request.headers.get('x-import-reference'),reason:request.headers.get('x-import-reason')})
 if(!value)throw new ReportEvidenceImportError(422,'invalid_import_metadata')
 return value
}
function failure(error:unknown){
 if(error instanceof ReportEvidenceCSVError||error instanceof CommercialCSVError)return response(error.code==='too_large'?413:error.code==='field_too_long'||error.code==='too_many_rows'?413:422,{code:error.code,...(error.line?{line:error.line}:{})})
 if(error instanceof ReportEvidenceImportError||error instanceof ReportEvidenceError||error instanceof CommercialImportError)return response(error.status,{code:error.code})
 return response(503,{code:'unavailable'})
}
export async function previewReportEvidenceImportRequest(request:Request,payload:Payload,env:Readonly<Record<string,string|undefined>>=process.env){
 try{const actor=await authorize(request,payload,env),source=metadata(request),bytes=await readCommercialBody(request,REPORT_EVIDENCE_CSV_MAX_BYTES,'text/csv');return response(200,await previewReportEvidenceImport(payload,actor,bytes,source))}catch(error){return failure(error)}
}
export async function stageReportEvidenceImportRequest(request:Request,payload:Payload,env:Readonly<Record<string,string|undefined>>=process.env){
 try{const actor=await authorize(request,payload,env),source=metadata(request),bytes=await readCommercialBody(request,REPORT_EVIDENCE_CSV_MAX_BYTES,'text/csv'),result=await stageReportEvidenceImport(payload,actor,bytes,source,request.headers.get('idempotency-key'));return response(result.duplicate?200:201,result)}catch(error){return failure(error)}
}
export async function commitReportEvidenceImportRequest(request:Request,id:string,payload:Payload,env:Readonly<Record<string,string|undefined>>=process.env){
 try{
  const actor=await authorize(request,payload,env),bytes=await readCommercialBody(request,4096,'application/json');let input:unknown
  try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new ReportEvidenceImportError(422,'invalid_confirmation')}
  const result=await commitReportEvidenceImport(payload,actor,id,input)
  return response(result.state==='stale'?409:result.duplicate?200:201,result)
 }catch(error){return failure(error)}
}
