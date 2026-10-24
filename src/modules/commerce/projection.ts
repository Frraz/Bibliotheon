import {commercialEventDigest,commercialEventKey,commercialTransactionKey,parseCommercialEvent,type AccountScope,type CommercialKind,type NormalizedCommercialEvent} from './events'
export type CommercialProjection=AccountScope&{
 externalTransactionId:string;externalProductId:string;externalOfferId:string|null;currency:string;state:CommercialKind;lastEventAt:string;approvedAt:string|null;
 grossCents:number|null;refundedCents:number|null;chargebackCents:number|null;feesCents:number|null;producerNetCents:number|null;settledCents:null;
 refundAndChargebackOverlap:boolean;externalClickReference:string|null;
}
export type ProjectionResult={state:'projected';projection:CommercialProjection;events:number}|{state:'needs_review';reason:string}
const review=(reason:string):ProjectionResult=>({state:'needs_review',reason})
/** Rebuild from authenticated, mapped facts. Caller must retain the previous projection on needs_review. */
export function projectCommercialEvents(values:readonly unknown[],scope:AccountScope):ProjectionResult{
 if(!values.length||values.length>10000)return review('invalid_history')
 const identities=new Map<string,string>(),events:NormalizedCommercialEvent[]=[]
 for(const value of values){
  const parsed=parseCommercialEvent(value,scope);if(!parsed.ok)return review(parsed.reason)
  if(parsed.event.reviewReason)return review(parsed.event.reviewReason)
  const key=commercialEventKey(parsed.event),hash=commercialEventDigest(parsed.event),old=identities.get(key)
  if(old&&old!==hash)return review('event_key_conflict')
  if(!old){identities.set(key,hash);events.push(parsed.event)}
 }
 const first=events[0],transaction=commercialTransactionKey(first)
 if(events.some(e=>commercialTransactionKey(e)!==transaction))return review('mixed_transaction_scope')
 if(events.some(e=>e.externalProductId!==first.externalProductId||e.currency!==first.currency))return review('identity_or_currency_conflict')
 const offers=new Set(events.flatMap(e=>e.externalOfferId?[e.externalOfferId]:[]));if(offers.size>1)return review('offer_conflict')
 events.sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)||commercialEventKey(a).localeCompare(commercialEventKey(b)))
 for(let i=0;i<events.length;){
  let end=i+1;while(end<events.length&&events[end].occurredAt===events[i].occurredAt)end++
  const tied=events.slice(i,end)
  if(new Set(tied.map(e=>e.kind)).size>1)return review('same_time_state_conflict')
  for(const key of ['grossCents','feesCents','producerNetCents','chargebackCents'] as const)if(new Set(tied.map(e=>e[key]).filter(v=>v!==null)).size>1)return review('same_time_value_conflict')
  const refunds=tied.filter(e=>e.refundedCents!==null)
  if(refunds.some(e=>e.refundBasis==='cumulative')&&refunds.some(e=>e.refundBasis==='operation'))return review('same_time_refund_overlap')
  if(new Set(refunds.filter(e=>e.refundBasis==='cumulative').map(e=>e.refundedCents)).size>1)return review('same_time_refund_conflict')
  i=end
 }
 const p:CommercialProjection={...scope,externalTransactionId:first.externalTransactionId,externalProductId:first.externalProductId,externalOfferId:[...offers][0]??null,currency:first.currency,state:events[0].kind,lastEventAt:events[0].occurredAt,approvedAt:null,grossCents:null,refundedCents:null,chargebackCents:null,feesCents:null,producerNetCents:null,settledCents:null,refundAndChargebackOverlap:false,externalClickReference:null}
 let hasRefund=false,hasApproval=false,unscopedUnknown=false,refundTotal=BigInt(0),checkpointTotal:bigint|null=null
 const operations=new Map<string,{amount:number|null;covered:boolean}>()
 for(const e of events){
  if(e.grossCents!==null){if(p.grossCents!==null&&p.grossCents!==e.grossCents)return review('gross_conflict');p.grossCents=e.grossCents}
  if(e.feesCents!==null)p.feesCents=e.feesCents
  if(e.producerNetCents!==null)p.producerNetCents=e.producerNetCents
  if(e.externalClickReference){if(p.externalClickReference&&p.externalClickReference!==e.externalClickReference)return review('click_reference_conflict');p.externalClickReference=e.externalClickReference}
  if(e.approvedAt){if(p.approvedAt&&p.approvedAt!==e.approvedAt)return review('approval_time_conflict');p.approvedAt=e.approvedAt;hasApproval=true}
  if(e.kind==='approved'){
   hasApproval=true
   if(!Object.hasOwn(e,'approvedAt'))p.approvedAt||=e.occurredAt
   if(hasRefund||p.state==='chargeback')return review('approval_after_reversal')
  }
  if(e.kind==='partially_refunded'||e.kind==='refunded'){
   hasRefund=true
   if(e.refundedCents===null){
    if(e.refundBasis==='operation'&&e.externalRefundId){if(!operations.has(e.externalRefundId))operations.set(e.externalRefundId,{amount:null,covered:false})}
    else unscopedUnknown=true
   }else{
    if(!e.refundBasis)return review('refund_basis_unknown')
    if(e.refundBasis==='cumulative'){
     if(BigInt(e.refundedCents)<refundTotal)return review('refund_total_regressed')
     refundTotal=BigInt(e.refundedCents);checkpointTotal=refundTotal;unscopedUnknown=false
     for(const operation of operations.values())operation.covered=true
    }else{
     const key=e.externalRefundId!,prior=operations.get(key)
     if(prior?.amount!==undefined&&prior.amount!==null&&prior.amount!==e.refundedCents)return review('refund_operation_conflict')
     if(!prior||prior.amount===null){
      if(!prior?.covered)refundTotal+=BigInt(e.refundedCents)
      operations.set(key,{amount:e.refundedCents,covered:prior?.covered??false})
     }
    }
   }
   const coveredTotal=[...operations.values()].reduce((sum,operation)=>sum+(operation.covered&&operation.amount!==null?BigInt(operation.amount):BigInt(0)),BigInt(0))
   if(checkpointTotal!==null&&coveredTotal>checkpointTotal)return review('refund_checkpoint_conflict')
   if(refundTotal>BigInt(Number.MAX_SAFE_INTEGER))return review('money_overflow')
   if(p.grossCents!==null&&refundTotal>BigInt(p.grossCents))return review('refund_exceeds_gross')
   p.refundedCents=unscopedUnknown||[...operations.values()].some(operation=>operation.amount===null&&!operation.covered)?null:Number(refundTotal)
  }else if(e.refundedCents!==null||e.refundBasis||e.externalRefundId)return review('refund_evidence_wrong_kind')
  if(e.kind==='chargeback'){
   if(e.chargebackCents!==null){if(p.chargebackCents!==null&&e.chargebackCents<p.chargebackCents)return review('chargeback_regressed');p.chargebackCents=e.chargebackCents}
   if(p.grossCents!==null&&p.chargebackCents!==null&&p.chargebackCents>p.grossCents)return review('chargeback_exceeds_gross')
  }else if(e.chargebackCents!==null)return review('chargeback_evidence_wrong_kind')
  if(hasRefund&&!['partially_refunded','refunded','chargeback'].includes(e.kind))return review('reversal_state_regressed')
  if(p.grossCents!==null&&refundTotal>BigInt(p.grossCents))return review('refund_exceeds_gross')
  if(p.grossCents!==null&&p.chargebackCents!==null&&p.chargebackCents>p.grossCents)return review('chargeback_exceeds_gross')
  if(hasApproval&&['pending','refused','canceled'].includes(e.kind))return review('paid_state_regressed')
  if(p.state==='refunded'&&e.kind==='partially_refunded')return review('refund_state_regressed')
  if(p.state==='chargeback'&&e.kind!=='chargeback'){
   // Later refund evidence may complete amounts while the chargeback remains visible.
   if(!['refunded','partially_refunded'].includes(e.kind))return review('chargeback_state_regressed')
  }else p.state=e.kind
  p.lastEventAt=e.occurredAt
 }
 p.refundAndChargebackOverlap=hasRefund&&events.some(e=>e.kind==='chargeback')
 return{state:'projected',projection:p,events:events.length}
}
