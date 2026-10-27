import {createHash} from 'node:crypto'
import type {Payload,PayloadRequest} from 'payload'
import type {CommercialImportRow} from '../../payload-types'
import {parseCommercialCSV,restoreCommercialCSVLine,type CSVLine} from './csv'
import {commercialCSVContext,type PreviewLine} from './import-preview'
import {commercialEventDigest,commercialEventKey,commercialTransactionKey,parseCommercialEvent,type NormalizedCommercialEvent,type PreparedCommercialReceipt} from './events'
export const hashImport=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export class CommercialImportError extends Error{constructor(readonly status:number,readonly code:string){super(code)}}
export type ImportActor={id:string;collection:string;role:string}|null
export const requireImportOwner=(actor:ImportActor)=>{if(actor?.collection!=='admin-users'||actor.role!=='owner')throw new CommercialImportError(403,'forbidden');return{...actor,id:actor.id.toLowerCase()}}
export type ImportMetadata={sourceKind:'provider_report'|'manual_reconciliation';sourceReference:string;reason:'missing_webhook'|'report_reconciliation'}
export function importMetadata(value:unknown):ImportMetadata|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null
 const row=value as Record<string,unknown>
 if(Object.keys(row).length!==3||!['provider_report','manual_reconciliation'].includes(String(row.sourceKind))||typeof row.sourceReference!=='string'||!/^[a-z][a-z0-9_-]{2,95}$/.test(row.sourceReference)||!['missing_webhook','report_reconciliation'].includes(String(row.reason)))return null
 return row as ImportMetadata
}
export type ParsedImport=Omit<ReturnType<typeof parseCommercialCSV>,'lines'>&{lines:Extract<CSVLine,{ok:true}>[]}
export function validatedImport(bytes:Uint8Array):ParsedImport{
 const parsed=parseCommercialCSV(bytes)
 if(parsed.lines.some(line=>!line.ok))throw new CommercialImportError(422,'invalid_rows')
 const lines=parsed.lines as ParsedImport['lines']
 if(new Set(lines.map(line=>JSON.stringify([line.row.provider,line.row.accountKey]))).size!==1)throw new CommercialImportError(422,'mixed_accounts')
 return{...parsed,lines}
}
export const importManifestHash=(parsed:ParsedImport)=>hashImport(parsed.lines.map(line=>[line.line,line.key,line.digest]))
export function restoreImport(rows:CommercialImportRow[],fileHash:string,manifestHash:string):ParsedImport{
 const lines:ParsedImport['lines']=[]
 for(const [index,row] of rows.entries()){
  const restored=restoreCommercialCSVLine(row.normalized,row.line)
  if(!restored||row.line!==index+2||restored.key!==row.transactionKey||restored.digest!==row.rowHash)throw new CommercialImportError(409,'integrity_conflict')
  lines.push(restored)
 }
 const parsed={fileHash,lines}
 if(!lines.length||lines.length>10000||new Set(lines.map(line=>JSON.stringify([line.row.provider,line.row.accountKey]))).size!==1||importManifestHash(parsed)!==manifestHash)throw new CommercialImportError(409,'integrity_conflict')
 return parsed
}
export const csvInboxKey=(line:ParsedImport['lines'][number])=>commercialEventKey({...line.row,eventKey:'csv-v1:'+line.digest})
export function prepareImportReceipt(line:ParsedImport['lines'][number]):PreparedCommercialReceipt{
 const row=line.row
 // Reversal amounts lack a verified basis/original approval in this first confirmation contract.
 if(!['approved','pending','refused','canceled'].includes(row.status)||row.refundedCents!==null||row.settledCents!==null)throw new CommercialImportError(409,'snapshot_not_supported')
 const event:NormalizedCommercialEvent={provider:row.provider,accountKey:row.accountKey,eventKey:'csv-v1:'+line.digest,externalTransactionId:row.externalTransactionId,externalProductId:row.externalProductId,externalOfferId:row.externalOfferId,kind:row.status,occurredAt:row.occurredAt,approvedAt:row.status==='approved'?row.occurredAt:null,sourceEvent:'csv_snapshot_'+row.status,currency:row.currency,grossCents:row.grossCents,feesCents:row.feesCents,producerNetCents:row.producerNetCents,refundedCents:null,chargebackCents:null,refundBasis:null,externalRefundId:null,externalClickReference:null}
 if(!parseCommercialEvent(event,{provider:row.provider,accountKey:row.accountKey}).ok)throw new CommercialImportError(409,'invalid_snapshot')
 return{state:'prepared',event,key:commercialEventKey(event),digest:commercialEventDigest(event),transactionKey:commercialTransactionKey(event),adapterVersion:'csv-owner-snapshot-v1'}
}
/** Caller holds the provider-account barrier. Includes unprocessed native evidence in the plan. */
export async function buildImportPlan(payload:Payload,parsed:ParsedImport,req:PayloadRequest,now:number){
 const context=await commercialCSVContext(payload,parsed,now,req),keys=[...new Set(parsed.lines.map(line=>line.key))],receipts=new Map<string,{key:string;transactionKey?:string|null;envelopeHash:string;state:string;conflicted?:boolean|null}>()
 for(let offset=0;offset<keys.length;offset+=200){
  const result=await payload.find({collection:'commercial-inbox',where:{transactionKey:{in:keys.slice(offset,offset+200)}},limit:10001,depth:0,overrideAccess:true,req,select:{key:true,transactionKey:true,envelopeHash:true,state:true,conflicted:true}})
  if(result.totalDocs>10000||receipts.size+result.docs.length>10000)throw new CommercialImportError(503,'history_limit')
  for(const row of result.docs)receipts.set(row.key,row)
 }
 const pending=new Set([...receipts.values()].filter(row=>(row.state!=='applied'||row.conflicted)&&context.financial.get(row.transactionKey??'')?.state!=='active').map(row=>row.transactionKey))
 const lines=context.assessment.lines.map((line):Omit<PreviewLine,'reason'>&{reason:string}=>{
  if(!line.row||!['new','matched'].includes(line.classification))return line
  const source=parsed.lines[line.line-2]
  if(pending.has(source.key))return{...line,classification:'needs_review',reason:'pending_evidence'}
  if(line.classification==='matched')return line
  try{prepareImportReceipt(source)}catch{return{...line,classification:'needs_review',reason:'snapshot_not_supported'}}
  return line
 })
 const blocked=lines.some(line=>!['new','matched','duplicate'].includes(line.classification))
 const stable=(values:readonly unknown[])=>[...values].map(value=>JSON.stringify(value)).sort()
 const planHash=hashImport([importManifestHash(parsed),lines,stable(context.catalog),stable(context.transactions),stable(context.resolutions),stable([...context.collisions]),stable([...context.financial]),stable([...receipts.values()])])
 const counts:Record<string,number>={};for(const line of lines)counts[line.classification]=(counts[line.classification]??0)+1
 return{planHash,lines,counts,state:blocked?'blocked' as const:'ready' as const}
}
