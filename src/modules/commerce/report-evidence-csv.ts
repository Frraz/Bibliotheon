import {createHash} from 'node:crypto'
import {commercialKinds,commercialProviders,opaqueID,type CommercialKind,type CommercialProvider} from './events'
import {parseCSVRecords,CommercialCSVError} from './csv'
import {prepareReportEvidence,type ReportEvidenceInput} from './report-evidence-schema'

export const REPORT_EVIDENCE_CSV_MAX_BYTES=512*1024
export const REPORT_EVIDENCE_CSV_MAX_ROWS=20
export const reportEvidenceCSVHeaders=['provider','account_key','transaction_id','product_id','offer_id','kind','occurred_at','approved_at','currency','gross_cents','refunded_cents','chargeback_cents','fees_cents','producer_net_cents','refund_basis','external_refund_id','record_reference','replaces'] as const
export type ReportEvidenceCSVLine={line:number;ok:true;input:ReportEvidenceInput;key:string;digest:string;transactionKey:string}|{line:number;ok:false;code:'column_count'|'invalid_provider'|'invalid_identity'|'invalid_kind'|'invalid_time'|'invalid_currency'|'invalid_money'|'invalid_refund'|'invalid_replacements'|'invalid_evidence'}
export class ReportEvidenceCSVError extends Error{constructor(readonly code:'too_large'|'invalid_utf8'|'invalid_header'|'invalid_quotes'|'field_too_long'|'too_many_rows'|'empty_file',readonly line?:number){super(code)}}
const timestamp=(value:string):string|null=>{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))return null
 const parsed=new Date(value)
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,19)===value.slice(0,19)?parsed.toISOString():null
}
const cents=(value:string,signed=false):number|null|undefined=>{
 if(value==='')return null
 if(value.length>18||!(signed?/^-?\d+$/:/^\d+$/).test(value))return undefined
 const amount=Number(value);return Number.isSafeInteger(amount)?amount:undefined
}
export function parseReportEvidenceCSV(bytes:Uint8Array,source:{sourceKind:'provider_report'|'manual_reconciliation';sourceReference:string}){
 if(bytes.byteLength>REPORT_EVIDENCE_CSV_MAX_BYTES)throw new ReportEvidenceCSVError('too_large')
 let text:string
 try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes).replace(/^\uFEFF/,'')}catch{throw new ReportEvidenceCSVError('invalid_utf8')}
 let rows:string[][]
 try{rows=parseCSVRecords(text,reportEvidenceCSVHeaders.length)}catch(error){if(error instanceof CommercialCSVError)throw new ReportEvidenceCSVError(error.code,error.line);throw error}
 const header=rows.shift()
 if(!header||header.length!==reportEvidenceCSVHeaders.length||header.some((value,index)=>value!==reportEvidenceCSVHeaders[index]))throw new ReportEvidenceCSVError('invalid_header')
 if(!rows.length)throw new ReportEvidenceCSVError('empty_file')
 if(rows.length>REPORT_EVIDENCE_CSV_MAX_ROWS)throw new ReportEvidenceCSVError('too_many_rows')
 const lines=rows.map((values,index):ReportEvidenceCSVLine=>{
  const line=index+2,invalid=(code:Extract<ReportEvidenceCSVLine,{ok:false}>['code']):ReportEvidenceCSVLine=>({line,ok:false,code})
  if(values.length!==reportEvidenceCSVHeaders.length)return invalid('column_count')
  const [provider,accountKey,externalTransactionId,externalProductId,offer,kind,occurred,approved,currency,gross,refunded,chargeback,fees,producerNet,basis,refundId,recordReference,replacesRaw]=values
  if(!commercialProviders.includes(provider as CommercialProvider))return invalid('invalid_provider')
  if(![accountKey,externalTransactionId,externalProductId].every(opaqueID)||offer!==''&&!opaqueID(offer))return invalid('invalid_identity')
  if(!commercialKinds.includes(kind as CommercialKind))return invalid('invalid_kind')
  const occurredAt=timestamp(occurred),approvedAt=approved===''?null:timestamp(approved)
  if(!occurredAt||approved!==''&&!approvedAt)return invalid('invalid_time')
  if(!/^[A-Z]{3}$/.test(currency))return invalid('invalid_currency')
  const grossCents=cents(gross),refundedCents=cents(refunded),chargebackCents=cents(chargeback),feesCents=cents(fees,true),producerNetCents=cents(producerNet,true)
  if([grossCents,refundedCents,chargebackCents,feesCents,producerNetCents].some(value=>value===undefined))return invalid('invalid_money')
  if(basis!==''&&!['cumulative','operation'].includes(basis)||basis==='operation'&&!refundId||refundId!==''&&!opaqueID(refundId))return invalid('invalid_refund')
  let replaces:ReportEvidenceInput['replaces']
  try{replaces=JSON.parse(replacesRaw) as ReportEvidenceInput['replaces'];if(!Array.isArray(replaces))return invalid('invalid_replacements')}catch{return invalid('invalid_replacements')}
  const input:ReportEvidenceInput={provider:provider as CommercialProvider,accountKey,externalTransactionId,externalProductId,externalOfferId:offer||null,kind:kind as CommercialKind,occurredAt,approvedAt,currency,grossCents:grossCents!,refundedCents:refundedCents!,chargebackCents:chargebackCents!,feesCents:feesCents!,producerNetCents:producerNetCents!,refundBasis:basis?basis as ReportEvidenceInput['refundBasis']:null,externalRefundId:refundId||null,replaces,sourceKind:source.sourceKind,sourceReference:source.sourceReference,recordReference,evidenceVerified:true}
  try{const prepared=prepareReportEvidence(input);return{line,ok:true as const,input:prepared.input,key:prepared.key,digest:prepared.requestHash,transactionKey:prepared.transactionKey}}
  catch{return invalid('invalid_evidence')}
 })
 return{fileHash:createHash('sha256').update(bytes).digest('hex'),lines}
}
