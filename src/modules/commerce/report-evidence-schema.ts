import {commercialProviders,commercialKinds,opaqueID,parseCommercialEvent,commercialEventDigest,commercialTransactionKey,type NormalizedCommercialEvent,type AccountScope} from './events'
import {catalogHash} from './catalog-mapping'
export class ReportEvidenceError extends Error{constructor(readonly status:number,readonly code:string){super(code)}}
export const REPORT_EVIDENCE_VERSION='owner-financial-evidence-v1'
export const reportAlias=(value:unknown):value is string=>typeof value==='string'&&/^[a-z][a-z0-9_-]{2,95}$/.test(value)
export type ReportEvidenceInput=AccountScope&{externalTransactionId:string;externalProductId:string;externalOfferId:string|null;kind:NormalizedCommercialEvent['kind'];occurredAt:string;approvedAt:string|null;currency:string;grossCents:number|null;refundedCents:number|null;chargebackCents:number|null;feesCents:number|null;producerNetCents:number|null;refundBasis:NormalizedCommercialEvent['refundBasis'];externalRefundId:string|null;replaces:{kind:'native'|'report';id:string}[];sourceKind:'provider_report'|'manual_reconciliation';sourceReference:string;recordReference:string;evidenceVerified:true}
const fields=['provider','accountKey','externalTransactionId','externalProductId','externalOfferId','kind','occurredAt','approvedAt','currency','grossCents','refundedCents','chargebackCents','feesCents','producerNetCents','refundBasis','externalRefundId','sourceKind','sourceReference','recordReference','evidenceVerified','replaces'] as const
/** Own canonical contract; never interprets or authenticates a provider export. Unknown remains null. */
export function prepareReportEvidence(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new ReportEvidenceError(422,'invalid_report_evidence')
 const row=value as Record<string,unknown>
 if(Object.keys(row).length!==fields.length||fields.some(key=>!Object.hasOwn(row,key))||!commercialProviders.includes(row.provider as AccountScope['provider'])||!opaqueID(row.accountKey)||!opaqueID(row.externalTransactionId)||!commercialKinds.includes(row.kind as NormalizedCommercialEvent['kind'])||!['provider_report','manual_reconciliation'].includes(String(row.sourceKind))||!reportAlias(row.sourceReference)||!reportAlias(row.recordReference)||row.evidenceVerified!==true)throw new ReportEvidenceError(422,'invalid_report_evidence')
 if(!Array.isArray(row.replaces)||row.replaces.length>100)throw new ReportEvidenceError(422,'invalid_report_references')
 const replaces:ReportEvidenceInput['replaces']=[],seen=new Set<string>()
 for(const item of row.replaces){if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).length!==2||!['native','report'].includes(item.kind)||typeof item.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(item.id)||seen.has(item.id.toLowerCase()))throw new ReportEvidenceError(422,'invalid_report_references');seen.add(item.id.toLowerCase());replaces.push({kind:item.kind,id:item.id.toLowerCase()})}
 replaces.sort((a,b)=>a.id.localeCompare(b.id))
 const key=catalogHash([row.provider,row.accountKey,row.sourceKind,row.sourceReference,row.recordReference])
 const parsed=parseCommercialEvent({provider:row.provider,accountKey:row.accountKey,eventKey:'report-v1:'+key,externalTransactionId:row.externalTransactionId,externalProductId:row.externalProductId,externalOfferId:row.externalOfferId,kind:row.kind,occurredAt:row.occurredAt,approvedAt:row.approvedAt,currency:row.currency,grossCents:row.grossCents,refundedCents:row.refundedCents,chargebackCents:row.chargebackCents,feesCents:row.feesCents,producerNetCents:row.producerNetCents,refundBasis:row.refundBasis,externalRefundId:row.externalRefundId,externalClickReference:null,sourceEvent:REPORT_EVIDENCE_VERSION},{provider:row.provider as AccountScope['provider'],accountKey:row.accountKey})
 if(!parsed.ok||row.externalOfferId!==null&&!opaqueID(row.externalOfferId)||row.externalRefundId!==null&&!opaqueID(row.externalRefundId))throw new ReportEvidenceError(422,'invalid_report_evidence')
 const event=parsed.event
 const input:ReportEvidenceInput={provider:event.provider,accountKey:event.accountKey,externalTransactionId:event.externalTransactionId,externalProductId:event.externalProductId,externalOfferId:event.externalOfferId,kind:event.kind,occurredAt:event.occurredAt,approvedAt:event.approvedAt!,currency:event.currency,grossCents:event.grossCents,refundedCents:event.refundedCents,chargebackCents:event.chargebackCents,feesCents:event.feesCents,producerNetCents:event.producerNetCents,refundBasis:event.refundBasis,externalRefundId:event.externalRefundId,sourceKind:row.sourceKind as ReportEvidenceInput['sourceKind'],sourceReference:row.sourceReference,recordReference:row.recordReference,evidenceVerified:true,replaces}
 return{input,key,event,envelopeHash:commercialEventDigest(event),transactionKey:commercialTransactionKey(event),requestHash:catalogHash(input)}
}
/** Minimum independent evidence for a paid report snapshot; no approval/refund/chargeback is inferred. */
export function reportEvidenceBlockers(event:NormalizedCommercialEvent){
 const blockers:string[]=[]
 if(event.approvedAt&&event.approvedAt>event.occurredAt)blockers.push('report_approval_after_event')
 if(['pending','refused','canceled'].includes(event.kind)&&event.approvedAt!==null)blockers.push('report_state_evidence_conflict')
 return blockers
}
