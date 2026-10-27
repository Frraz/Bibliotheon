import {reportEvidenceKeys} from './report-evidence-store'
import {financialStatuses} from './financial-resolutions'
import {commercialCollisionKeys} from './collisions'
import type {Payload,PayloadRequest,Where} from 'payload'
import type {Transaction} from '../../payload-types'
import {parseCommercialCSV,type CommercialCSVRow,type CSVLine} from './csv'
import {mapCatalogIdentity,catalogScopeKey,type CatalogScope,type CatalogDecision,type CatalogEntry} from './catalog-mapping'
import {readCatalogDecisions} from './catalog-resolutions'
export type {CatalogEntry} from './catalog-mapping'
export type PreviewTransaction=Pick<Transaction,'id'|'key'|'provider'|'accountKey'|'externalTransactionId'|'externalProductId'|'externalOfferId'|'ebook'|'state'|'currency'|'grossCents'|'refundedCents'|'feesCents'|'producerNetCents'|'approvedAt'|'lastEventAt'|'needsReview'>
export const previewClassifications=['new','matched','duplicate','conflict','unknown_catalog','ambiguous_catalog','needs_review','invalid'] as const
export type PreviewClassification=typeof previewClassifications[number]
export type PreviewReason='new_transaction'|'same_snapshot'|'duplicate_row'|'conflict_in_file'|'unknown_product'|'unknown_offer'|'ambiguous_product'|'ambiguous_offer'|'catalog_history_conflict'|'catalog_resolution_invalid'|'catalog_resolution_held'|'transaction_conflicted'|'financial_resolution_review_required'|'ledger_conflict'|'existing_review'|'additional_evidence'|'incomplete_snapshot'|'settlement_evidence_required'|'future_event_time'|Extract<CSVLine,{ok:false}>['code']
export type PreviewLine={line:number;classification:PreviewClassification;reason:PreviewReason;row?:CommercialCSVRow;duplicateOf?:number;existingTransactionId?:string;differences?:string[];catalogResolutionId?:string;effectiveEbookId?:string}
const bookID=(value:string|{id:string})=>typeof value==='string'?value:value.id
export const catalogIdentity=(row:{provider:string;accountKey:string;externalProductId:string})=>JSON.stringify([row.provider,row.accountKey,row.externalProductId])
function classify(line:Extract<CSVLine,{ok:true}>,catalog:readonly CatalogEntry[],transaction:PreviewTransaction|undefined,now:number,decisions:ReadonlyMap<string,CatalogDecision>):PreviewLine{
 const {row}=line
 const result=(classification:PreviewClassification,reason:PreviewReason,extra:Partial<PreviewLine>={}):PreviewLine=>({line:line.line,classification,reason,row,...(transaction?{existingTransactionId:transaction.id}:{}),...extra})
 if(Date.parse(row.occurredAt)>now+300000)return result('needs_review','future_event_time')
 const scope:CatalogScope={...row,externalOfferId:row.externalOfferId||transaction?.externalOfferId||null}
 const mapped=mapCatalogIdentity(scope,catalog,decisions.get(catalogScopeKey(scope)))
 if(mapped.state==='review')return result(mapped.reason==='catalog_resolution_invalid'||mapped.reason==='catalog_resolution_held'?'needs_review':mapped.reason==='ambiguous_product'||mapped.reason==='ambiguous_offer'?'ambiguous_catalog':'unknown_catalog',mapped.reason)
 if(transaction&&bookID(transaction.ebook)!==mapped.ebook&&!mapped.resolutionId)return result('conflict','catalog_history_conflict')
 // Original transaction references stay intact; expose the audited effective association separately.
 const base=result
 const effective=(classification:PreviewClassification,reason:PreviewReason,extra:Partial<PreviewLine>={})=>base(classification,reason,{...extra,...(mapped.resolutionId?{catalogResolutionId:mapped.resolutionId,effectiveEbookId:mapped.ebook}:{})})

 if(transaction?.needsReview||transaction?.state==='unknown')return effective('needs_review','existing_review')
 if(transaction){
  const differences:string[]=[]
  for(const [column,current,incoming] of [
   ['product_id',transaction.externalProductId,row.externalProductId],['offer_id',transaction.externalOfferId??null,row.externalOfferId],['currency',transaction.currency,row.currency],['status',transaction.state,row.status],['occurred_at',transaction.lastEventAt??null,row.occurredAt],
   ['gross_cents',transaction.grossCents??null,row.grossCents],['refunded_cents',transaction.refundedCents??null,row.refundedCents],['fees_cents',transaction.feesCents??null,row.feesCents],['producer_net_cents',transaction.producerNetCents??null,row.producerNetCents],
  ] as const)if(current!==null&&incoming!==null&&current!==incoming)differences.push(column)
  if(differences.length)return effective('conflict','ledger_conflict',{differences})
 }
 // Liquidation cannot be inferred from a state/amount or written into the event projection.
 if(row.settledCents!==null)return effective('needs_review','settlement_evidence_required')
 if(!transaction)return effective('new','new_transaction')
 const comparisons=[
  [transaction.externalOfferId??null,row.externalOfferId],[transaction.lastEventAt??null,row.occurredAt],
  [transaction.grossCents??null,row.grossCents],[transaction.refundedCents??null,row.refundedCents],
  [transaction.feesCents??null,row.feesCents],[transaction.producerNetCents??null,row.producerNetCents],
 ]
 if(comparisons.some(([current,incoming])=>current===null&&incoming!==null))return effective('needs_review','additional_evidence')
 if(comparisons.some(([current,incoming])=>current!==null&&incoming===null))return effective('needs_review','incomplete_snapshot')
 return effective('matched','same_snapshot')
}
/** Read-only assessment. File rows are current snapshots, not new webhook events or cash movements. */
export function assessCommercialCSV(parsed:ReturnType<typeof parseCommercialCSV>,catalog:readonly CatalogEntry[],transactions:readonly PreviewTransaction[],now=Date.now(),decisions:readonly CatalogDecision[]=[],collisions:ReadonlySet<string>=new Set()){
 const resolutionMap=new Map(decisions.map(value=>[value.scopeKey,value]))
 const groups=new Map<string,{first:Extract<CSVLine,{ok:true}>;conflicted:boolean}>(),offers=new Map<string,CatalogEntry[]>(),ledger=new Map(transactions.map(row=>[row.key,row]))
 for(const line of parsed.lines)if(line.ok){const group=groups.get(line.key);if(group){if(group.first.digest!==line.digest)group.conflicted=true}else groups.set(line.key,{first:line,conflicted:false})}
 for(const offer of catalog){const identity=catalogIdentity(offer),group=offers.get(identity)??[];group.push(offer);offers.set(identity,group)}
 const lines:PreviewLine[]=parsed.lines.map(line=>{
  if(!line.ok)return{line:line.line,classification:'invalid',reason:line.code}
  const group=groups.get(line.key)!
  if(group.conflicted)return{line:line.line,classification:'conflict',reason:'conflict_in_file',row:line.row}
  if(group.first.line!==line.line)return{line:line.line,classification:'duplicate',reason:'duplicate_row',duplicateOf:group.first.line,row:line.row}
  if(collisions.has(line.key))return{line:line.line,classification:'needs_review',reason:'transaction_conflicted',row:line.row}
  return classify(line,offers.get(catalogIdentity(line.row))??[],ledger.get(line.key),now,resolutionMap)
 })
 const counts=Object.fromEntries(previewClassifications.map(value=>[value,0])) as Record<PreviewClassification,number>
 for(const line of lines)counts[line.classification]++
 return{fileHash:parsed.fileHash,provisional:true as const,committable:false as const,observedAt:new Date(now).toISOString(),counts,lines}
}
/** Bounded bulk reads: never fetch buyers, raw envelopes, checkout URLs or authentication material. */
export async function commercialCSVContext(payload:Payload,parsed:ReturnType<typeof parseCommercialCSV>,now=Date.now(),req?:PayloadRequest){
 const valid=parsed.lines.filter((line):line is Extract<CSVLine,{ok:true}>=>line.ok)
 const keys=[...new Set(valid.map(line=>line.key))],identities=[...new Map(valid.map(line=>[catalogIdentity(line.row),line.row])).values()]
 const transactions:PreviewTransaction[]=[],catalog:CatalogEntry[]=[]
 for(let offset=0;offset<keys.length;offset+=200){
  const result=await payload.find({collection:'transactions',where:{key:{in:keys.slice(offset,offset+200)}},limit:201,depth:0,overrideAccess:true,req,select:{key:true,provider:true,accountKey:true,externalTransactionId:true,externalProductId:true,externalOfferId:true,ebook:true,effectiveEbook:true,effectiveProductId:true,state:true,currency:true,grossCents:true,refundedCents:true,feesCents:true,producerNetCents:true,approvedAt:true,lastEventAt:true,needsReview:true}})
  if(result.totalDocs>200)throw new Error('preview_limit')
  transactions.push(...result.docs)
 }
 for(let offset=0;offset<identities.length;offset+=100){
  const result=await payload.find({collection:'offers',where:{or:identities.slice(offset,offset+100).map((row):Where=>({and:[{provider:{equals:row.provider}},{accountKey:{equals:row.accountKey}},{externalProductId:{equals:row.externalProductId}}]}))},limit:1001,depth:0,overrideAccess:true,req,select:{provider:true,accountKey:true,externalProductId:true,externalOfferId:true,ebook:true}})
  if(result.totalDocs>1000||catalog.length+result.docs.length>10000)throw new Error('preview_limit')
  catalog.push(...result.docs)
 }
 const ledger=new Map(transactions.map(transaction=>[transaction.key,transaction]))
 const resolutionKeys=valid.map(line=>catalogScopeKey({...line.row,externalOfferId:line.row.externalOfferId||ledger.get(line.key)?.externalOfferId||null}))
 const resolutions=await readCatalogDecisions(payload,resolutionKeys,req)
 const collisions=await commercialCollisionKeys(payload,valid.map(line=>line.row),req)
 for(const key of await reportEvidenceKeys(payload,keys,req))collisions.add(key)
 const financial=await financialStatuses(payload,valid.map(line=>line.row),req)
 for(const [key,status]of financial)if(status.state==='active')collisions.delete(key);else collisions.add(key)
 const effective=transactions.map(transaction=>{const status=financial.get(transaction.key);if(status?.state!=='active')return transaction
  const row=transaction as typeof transaction&{effectiveEbook?:string|{id:string}|null;effectiveProductId?:string|null}
  return{...transaction,ebook:row.effectiveEbook?bookID(row.effectiveEbook):row.ebook,externalProductId:row.effectiveProductId??row.externalProductId}
 })
 return{catalog,transactions,resolutions,collisions,financial,assessment:assessCommercialCSV(parsed,catalog,effective,now,resolutions,collisions)}
}
export async function previewCommercialCSV(payload:Payload,bytes:Uint8Array,now=Date.now()){
 return(await commercialCSVContext(payload,parseCommercialCSV(bytes),now)).assessment
}
