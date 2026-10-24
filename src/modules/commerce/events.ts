import {createHash} from 'node:crypto'
export const commercialProviders=['hotmart','kiwify','cakto'] as const
export const commercialKinds=['pending','approved','refused','canceled','partially_refunded','refunded','chargeback'] as const
export type CommercialProvider=typeof commercialProviders[number]
export type CommercialKind=typeof commercialKinds[number]
export type AccountScope={provider:CommercialProvider;accountKey:string}
export const commercialReviewReasons=['unsupported_currency_precision','unsupported_purchase_shape','unsupported_native_status','unknown_event_time','dispute_not_final'] as const
export type NormalizedCommercialEvent=AccountScope&{
 sourceEvent?:string;sourceCreatedAt?:string;approvedAt?:string|null;reviewReason?:typeof commercialReviewReasons[number];
 eventKey:string;externalTransactionId:string;externalProductId:string;externalOfferId:string|null;kind:CommercialKind;occurredAt:string;currency:string;
 grossCents:number|null;refundedCents:number|null;feesCents:number|null;producerNetCents:number|null;externalClickReference:string|null;
 /** Explicit internal evidence; adapters must never guess whether a value is a total or a movement. */
 refundBasis:'cumulative'|'operation'|null;externalRefundId:string|null;chargebackCents:number|null;
}
export const opaqueID=(value:unknown):value is string=>typeof value==='string'&&value.length>=1&&value.length<=200&&value.trim()===value&&!/[\s\x00-\x1f\x7f@]/.test(value)&&!/^https?:/i.test(value)
export const signedCents=(value:unknown):value is number|null=>value===null||typeof value==='number'&&Number.isSafeInteger(value)
export const cents=(value:unknown):value is number|null=>signedCents(value)&&(value===null||value>=0)
function utc(value:unknown):string|null{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))return null
 const date=new Date(value);if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,19)!==value.slice(0,19))return null
 return date.toISOString()
}
export type IgnoredCommercialEvent=AccountScope&{eventKey:string;kind:'ignored';eventType:string;occurredAt:string|null}
export type EventValidation={ok:true;event:NormalizedCommercialEvent}|{ok:false;reason:'invalid_envelope'|'unexpected_scope'|'invalid_identity'|'invalid_time'|'invalid_money'|'invalid_kind'}
export function parseCommercialEvent(value:unknown,scope:AccountScope):EventValidation{
 if(!value||typeof value!=='object'||Array.isArray(value))return{ok:false,reason:'invalid_envelope'}
 const row=value as Record<string,unknown>,keys=['provider','accountKey','eventKey','externalTransactionId','externalProductId','externalOfferId','kind','occurredAt','currency','grossCents','refundedCents','feesCents','producerNetCents','externalClickReference','refundBasis','externalRefundId','chargebackCents','approvedAt','reviewReason','sourceCreatedAt','sourceEvent']
 if(Object.keys(row).some(k=>!keys.includes(k)))return{ok:false,reason:'invalid_envelope'}
 if(!commercialProviders.includes(scope.provider)||!opaqueID(scope.accountKey)||row.provider!==scope.provider||row.accountKey!==scope.accountKey)return{ok:false,reason:'unexpected_scope'}
 for(const key of ['eventKey','externalTransactionId','externalProductId'])if(!opaqueID(row[key]))return{ok:false,reason:'invalid_identity'}
 for(const key of ['externalOfferId','externalClickReference','externalRefundId'])if(row[key]!==undefined&&row[key]!==null&&!opaqueID(row[key]))return{ok:false,reason:'invalid_identity'}
 if(typeof row.kind!=='string'||!commercialKinds.includes(row.kind as CommercialKind))return{ok:false,reason:'invalid_kind'}
 if(row.reviewReason!==undefined&&!commercialReviewReasons.includes(row.reviewReason as typeof commercialReviewReasons[number]))return{ok:false,reason:'invalid_envelope'}
 if(row.sourceEvent!==undefined&&(typeof row.sourceEvent!=='string'||!/^[A-Za-z][A-Za-z0-9_.:-]{0,119}$/.test(row.sourceEvent)))return{ok:false,reason:'invalid_envelope'}
 const sourceKnown=Object.hasOwn(row,'sourceCreatedAt'),sourceCreatedAt=utc(row.sourceCreatedAt)
 if(sourceKnown&&!sourceCreatedAt)return{ok:false,reason:'invalid_time'}
 const approvalKnown=Object.hasOwn(row,'approvedAt'),approvedAt=row.approvedAt===null?null:utc(row.approvedAt)
 if(approvalKnown&&row.approvedAt!==null&&!approvedAt)return{ok:false,reason:'invalid_time'}
 const occurredAt=utc(row.occurredAt);if(!occurredAt)return{ok:false,reason:'invalid_time'}
 if(typeof row.currency!=='string'||!(/^[A-Z]{3}$/).test(row.currency)||!['grossCents','refundedCents'].every(k=>cents(row[k]))||!['feesCents','producerNetCents'].every(k=>signedCents(row[k]))||!cents(row.chargebackCents??null))return{ok:false,reason:'invalid_money'}
 if(row.refundBasis!==undefined&&row.refundBasis!==null&&(typeof row.refundBasis!=='string'||!['cumulative','operation'].includes(row.refundBasis)))return{ok:false,reason:'invalid_money'}
 if(row.refundBasis==='operation'&&!opaqueID(row.externalRefundId))return{ok:false,reason:'invalid_identity'}
 return{ok:true,event:{provider:scope.provider,accountKey:scope.accountKey,eventKey:row.eventKey as string,externalTransactionId:row.externalTransactionId as string,externalProductId:row.externalProductId as string,externalOfferId:(row.externalOfferId??null) as string|null,kind:row.kind as CommercialKind,occurredAt,currency:row.currency,grossCents:row.grossCents as number|null,refundedCents:row.refundedCents as number|null,feesCents:row.feesCents as number|null,producerNetCents:row.producerNetCents as number|null,externalClickReference:(row.externalClickReference??null) as string|null,refundBasis:(row.refundBasis??null) as NormalizedCommercialEvent['refundBasis'],externalRefundId:(row.externalRefundId??null) as string|null,chargebackCents:(row.chargebackCents??null) as number|null,...(row.sourceEvent?{sourceEvent:row.sourceEvent as string}:{}),...(approvalKnown?{approvedAt}:{}),...(sourceKnown?{sourceCreatedAt:sourceCreatedAt!}:{}),...(row.reviewReason?{reviewReason:row.reviewReason as typeof commercialReviewReasons[number]}:{})}}
}
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const commercialEventKey=(event:Pick<NormalizedCommercialEvent,'provider'|'accountKey'|'eventKey'>)=>digest([event.provider,event.accountKey,event.eventKey])
export const commercialTransactionKey=(event:Pick<NormalizedCommercialEvent,'provider'|'accountKey'|'externalTransactionId'>)=>digest([event.provider,event.accountKey,event.externalTransactionId])
export const commercialEventDigest=(event:NormalizedCommercialEvent)=>{
 const values:unknown[]=[event.provider,event.accountKey,event.eventKey,event.externalTransactionId,event.externalProductId,event.externalOfferId,event.kind,event.occurredAt,event.currency,event.grossCents,event.refundedCents,event.feesCents,event.producerNetCents,event.externalClickReference,event.refundBasis,event.externalRefundId,event.chargebackCents]
 // Legacy envelopes retain their exact digest; explicit null approval means unknown, not event time.
 if(Object.hasOwn(event,'approvedAt')||event.reviewReason||Object.hasOwn(event,'sourceCreatedAt')||event.sourceEvent)values.push(['evidence-v1',Object.hasOwn(event,'approvedAt')?event.approvedAt:'legacy',event.reviewReason??null,...(Object.hasOwn(event,'sourceCreatedAt')?[['createdAt',event.sourceCreatedAt]]:[]),...(event.sourceEvent?[['sourceEvent',event.sourceEvent]]:[])])
 return digest(values)
}
/** Verification and native normalization are supplied by each independently validated adapter. */
export type CommercialAdapter={provider:CommercialProvider;version:string;batch?:boolean;verify(body:Uint8Array,headers:Headers):Promise<boolean>;normalize(body:Uint8Array,scope:AccountScope):unknown|Promise<unknown>}
async function normalizeCommercialBody(adapter:CommercialAdapter,scope:AccountScope,body:Uint8Array,headers:Headers){
 if(adapter.provider!==scope.provider||!opaqueID(scope.accountKey)||!opaqueID(adapter.version))return{state:'invalid_config' as const}
 if(body.byteLength>262144)return{state:'too_large' as const}
 const bytes=Uint8Array.from(body)
 let verified=false
 try{verified=await adapter.verify(Uint8Array.from(bytes),headers)}catch{return{state:'unavailable' as const}}
 if(verified!==true)return{state:'unauthorized' as const}
 let value:unknown
 try{value=await adapter.normalize(Uint8Array.from(bytes),scope)}catch{return{state:'unavailable' as const}}
 return{state:'normalized' as const,value}
}
function validateCommercialReceipt(adapter:CommercialAdapter,scope:AccountScope,value:unknown){
 if(value&&typeof value==='object'&&!Array.isArray(value)&&'kind'in value&&value.kind==='ignored'){
  const row=value as Record<string,unknown>,occurredAt=row.occurredAt===null?null:utc(row.occurredAt)
  if(Object.keys(row).some(key=>!['provider','accountKey','eventKey','kind','eventType','occurredAt'].includes(key))||row.provider!==scope.provider||row.accountKey!==scope.accountKey||!opaqueID(row.eventKey)||typeof row.eventType!=='string'||!/^[A-Za-z][A-Za-z0-9_.:-]{0,119}$/.test(row.eventType)||row.occurredAt!==null&&!occurredAt)return{state:'invalid_event' as const}
  const event:IgnoredCommercialEvent={...scope,eventKey:row.eventKey,kind:'ignored',eventType:row.eventType,occurredAt}
  return{state:'prepared_ignored' as const,key:commercialEventKey(event),digest:digest([event.provider,event.accountKey,event.eventKey,event.kind,event.eventType,event.occurredAt]),adapterVersion:adapter.version,event}
 }
 const parsed=parseCommercialEvent(value,scope)
 if(!parsed.ok)return{state:'invalid_event' as const,reason:parsed.reason}
 return{state:'prepared' as const,key:commercialEventKey(parsed.event),digest:commercialEventDigest(parsed.event),transactionKey:commercialTransactionKey(parsed.event),adapterVersion:adapter.version,event:parsed.event}
}

export async function prepareCommercialReceipt(adapter:CommercialAdapter,scope:AccountScope,body:Uint8Array,headers:Headers){
 const normalized=await normalizeCommercialBody(adapter,scope,body,headers)
 return normalized.state==='normalized'?validateCommercialReceipt(adapter,scope,normalized.value):normalized
}
/** A native batch is authenticated once. Every item is validated before opening the database. */
export async function prepareCommercialBatch(adapter:CommercialAdapter,scope:AccountScope,body:Uint8Array,headers:Headers){
 const normalized=await normalizeCommercialBody(adapter,scope,body,headers)
 if(normalized.state!=='normalized')return normalized
 const values=Array.isArray(normalized.value)?normalized.value:[normalized.value]
 if(!values.length||values.length>25)return{state:'invalid_event' as const}
 const receipts:PreparedCommercialReceipt[]=[]
 for(const value of values){
  const result=validateCommercialReceipt(adapter,scope,value)
  if(result.state!=='prepared'&&result.state!=='prepared_ignored')return result
  receipts.push(result)
 }
 return{state:'prepared_batch' as const,receipts}
}
export type PreparedCommercialReceipt=Extract<ReturnType<typeof validateCommercialReceipt>,{state:'prepared'|'prepared_ignored'}>
