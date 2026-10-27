import {restoreReportEvidence} from './report-evidence'
import {reportEvidenceBlockers,type ReportEvidenceInput} from './report-evidence-schema'
import {financialHeads} from './financial-store'
import type {Payload,PayloadRequest} from 'payload'
import {sql,type PostgresAdapter} from '@payloadcms/db-postgres'
import {atomic} from '../marketing/transaction'
import {commercialProviders,opaqueID,commercialTransactionKey,restoreStoredCommercialReceipt,type AccountScope,type NormalizedCommercialEvent,type IgnoredCommercialEvent} from './events'
import {projectCommercialEvents} from './projection'
import {catalogHash,catalogScopeKey,mapCatalogIdentity,type CatalogEntry,type CatalogDecision} from './catalog-mapping'
import {readCatalogDecisions} from './catalog-resolutions'
import {COMMERCIAL_LEASE_MS} from './policy'
import {storedCommercialEnvelope} from './stored-envelope'
export const REVIEW_LIMIT=10000
export class TransactionReviewError extends Error{constructor(readonly status:number,readonly code:string){super(code)}}
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
export type ReviewSelection={inboxId:string;envelopeHash:string|null;reason:'source_confirmed'|'source_rejected'}
export type ReviewChoice=AccountScope&{externalTransactionId:string;action:'reconcile'|'hold';selections:ReviewSelection[]}
export type ReviewVariant={id:string;hash:string;adapterVersion:string;receivedAt:string;source:'original'|'conflict'|'report';report?:Pick<ReportEvidenceInput,'sourceKind'|'sourceReference'|'recordReference'|'replaces'>;event:NormalizedCommercialEvent|IgnoredCommercialEvent}
export type ReviewReceipt={kind?:'native'|'report';id:string;key:string;state:string;conflicted:boolean;receivedAt:string;startedAt:string|null;variants:ReviewVariant[]}
export type ReviewContext={scope:AccountScope;transactionScopes:{key:string;externalTransactionId:string}[];receipts:ReviewReceipt[];transactions:unknown[];catalog:CatalogEntry[];catalogDecisions:CatalogDecision[];financialHeads?:{id:string;revision:number;transactionKeys:string[]}[]}
export function reviewChoice(input:unknown):ReviewChoice{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TransactionReviewError(422,'invalid_review_choice')
 const row=input as Record<string,unknown>,keys=['provider','accountKey','externalTransactionId','action','selections']
 if(Object.keys(row).length!==keys.length||keys.some(key=>!(key in row))||!commercialProviders.includes(row.provider as AccountScope['provider'])||!opaqueID(row.accountKey)||!opaqueID(row.externalTransactionId)||!['hold','reconcile'].includes(String(row.action))||!Array.isArray(row.selections)||row.selections.length>REVIEW_LIMIT||row.action==='hold'&&row.selections.length)throw new TransactionReviewError(422,'invalid_review_choice')
 const selections:ReviewSelection[]=[],seen=new Set<string>()
 for(const item of row.selections){
  if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).length!==3||!uuid(item.inboxId)||!(item.envelopeHash===null||typeof item.envelopeHash==='string'&&/^[a-f0-9]{64}$/.test(item.envelopeHash))||item.reason!==(item.envelopeHash===null?'source_rejected':'source_confirmed')||seen.has(item.inboxId.toLowerCase()))throw new TransactionReviewError(422,'invalid_review_selection')
  seen.add(item.inboxId.toLowerCase());selections.push({inboxId:item.inboxId.toLowerCase(),envelopeHash:item.envelopeHash,reason:item.reason})
 }
 selections.sort((a,b)=>a.inboxId.localeCompare(b.inboxId))
 return{provider:row.provider as AccountScope['provider'],accountKey:row.accountKey as string,externalTransactionId:row.externalTransactionId as string,action:row.action as ReviewChoice['action'],selections}
}
/** One selection per receipt, including variants that name another transaction.
 * A collision can connect several orders; never assess only one side of it. */
export function assessTransactionReview(context:ReviewContext,choice:ReviewChoice,now=Date.now()){
 if(context.scope.provider!==choice.provider||context.scope.accountKey!==choice.accountKey||!context.transactionScopes.some(scope=>scope.key===commercialTransactionKey(choice)))throw new TransactionReviewError(422,'review_scope_mismatch')
 const byId=new Map(context.receipts.map(receipt=>[receipt.id,receipt])),selections=new Map(choice.selections.map(selection=>[selection.inboxId,selection])),selected=new Map<string,NormalizedCommercialEvent[]>(),paidReports=new Set<string>(),refundReports=new Set<string>(),chargebackReports=new Set<string>(),replaced=new Set<string>(),blockers=new Set<string>()
 for(const selection of choice.selections){const receipt=byId.get(selection.inboxId);if(!receipt||selection.envelopeHash!==null&&!receipt.variants.some(variant=>variant.hash===selection.envelopeHash))throw new TransactionReviewError(422,'unknown_review_selection')}
 for(const receipt of context.receipts)if(receipt.state==='processing'&&(!receipt.startedAt||!Number.isFinite(Date.parse(receipt.startedAt))||Date.parse(receipt.startedAt)>now-COMMERCIAL_LEASE_MS))blockers.add('processing_active')
 if(choice.action==='reconcile'){
  if(selections.size!==context.receipts.length)blockers.add('selection_coverage_required')
  for(const receipt of context.receipts){
   const selection=selections.get(receipt.id)
   if(!selection?.envelopeHash)continue
   const variant=receipt.variants.find(variant=>variant.hash===selection.envelopeHash)!,event=variant.event
   if(event.kind==='ignored'){blockers.add('ignored_is_not_financial');continue}
   if([event.occurredAt,event.approvedAt,event.sourceCreatedAt].some(time=>time&&Date.parse(time)>now+300000))blockers.add('future_event_time')
   const key=commercialTransactionKey(event)
   if(variant.source==='report'){
    for(const blocker of reportEvidenceBlockers(event))blockers.add(blocker)
    if(['approved','partially_refunded','refunded','chargeback'].includes(event.kind))paidReports.add(key)
    if(['partially_refunded','refunded'].includes(event.kind))refundReports.add(key)
    if(event.kind==='chargeback')chargebackReports.add(key)
    for(const reference of variant.report!.replaces){
     const target=byId.get(reference.id)
     if(!target||(target.kind??'native')!==reference.kind)throw new TransactionReviewError(503,'report_reference_integrity')
     if(replaced.has(reference.id))blockers.add('report_replacement_overlap');replaced.add(reference.id)
     if(selections.get(reference.id)?.envelopeHash!==null)blockers.add('report_replaced_source_selected')
    }
   }
   const events=selected.get(key)??[];events.push(event);selected.set(key,events)
  }
 }
 const decisions=new Map(context.catalogDecisions.map(decision=>[decision.scopeKey,decision]))
 const outcomes=context.transactionScopes.map(scope=>{
  const events=selected.get(scope.key)??[]
  if(choice.action==='hold')return{...scope,state:'needs_review' as const,reason:'evidence_inconclusive'}
  if(!events.length)return{...scope,state:'needs_review' as const,reason:'no_verified_facts'}
  const result=projectCommercialEvents(events,context.scope)
  if(result.state==='needs_review'){blockers.add('projection_requires_review');return{...scope,...result}}
  if(paidReports.has(scope.key)&&(!result.projection.approvedAt||result.projection.grossCents===null)){blockers.add('report_approval_evidence_required');return{...scope,state:'needs_review' as const,reason:'report_approval_evidence_required'}}
  if(refundReports.has(scope.key)&&result.projection.refundedCents===null){blockers.add('report_refund_evidence_required');return{...scope,state:'needs_review' as const,reason:'report_refund_evidence_required'}}
  if(chargebackReports.has(scope.key)&&result.projection.chargebackCents===null){blockers.add('report_chargeback_evidence_required');return{...scope,state:'needs_review' as const,reason:'report_chargeback_evidence_required'}}
  const p=result.projection
  if(refundReports.has(scope.key)&&p.grossCents!==null&&p.refundedCents!==null&&(p.state==='refunded'&&p.refundedCents!==p.grossCents||p.state==='partially_refunded'&&(p.refundedCents<=0||p.refundedCents>=p.grossCents))){blockers.add('report_refund_state_conflict');return{...scope,state:'needs_review' as const,reason:'report_refund_state_conflict'}}
  const mapping=mapCatalogIdentity(result.projection,context.catalog,decisions.get(catalogScopeKey(result.projection)))
  if(mapping.state==='review'){blockers.add('catalog_requires_review');return{...scope,state:'needs_review' as const,reason:mapping.reason}}
  return{...scope,...result,catalog:{ebook:mapping.ebook,offer:mapping.offer,catalogResolutionId:mapping.resolutionId??null}}
 })
 if(choice.action==='reconcile'&&!outcomes.some(outcome=>outcome.state==='projected'))blockers.add('no_verified_projection')
 const sourceHash=catalogHash(context.receipts.map(receipt=>({id:receipt.id,key:receipt.key,variants:receipt.variants})))
 return{choice,sourceHash,planHash:catalogHash([choice,context,outcomes,[...blockers].sort()]),provisional:true as const,committable:false as const,processable:blockers.size===0,blockers:[...blockers].sort(),outcomes,context}
}
/** Bounded graph expansion over persisted internal envelopes. No native report fields are guessed. */
export async function transactionReviewContext(payload:Payload,choice:ReviewChoice,req:PayloadRequest):Promise<ReviewContext>{
 const transactionID=await req.transactionID,db=transactionID&&(payload.db as unknown as PostgresAdapter).sessions[transactionID]?.db
 if(!db)throw new TransactionReviewError(503,'transaction_unavailable')
 const scope={provider:choice.provider,accountKey:choice.accountKey},known=new Map([[commercialTransactionKey(choice),choice.externalTransactionId]]),queried=new Set<string>(),receipts=new Map<string,ReviewReceipt>()
 const deadline=Date.now()+5000;let variantCount=0
 const add=(event:ReviewVariant['event'])=>{if(event.kind!=='ignored'){known.set(commercialTransactionKey(event),event.externalTransactionId);if(known.size>REVIEW_LIMIT)throw new TransactionReviewError(503,'review_component_limit')}}
 const restore=(id:string,hash:string,adapterVersion:string,receivedAt:string,source:ReviewVariant['source'],envelope:unknown,key:string):ReviewVariant=>{
  const result=restoreStoredCommercialReceipt(envelope,scope,adapterVersion)
  if(result.state==='invalid_event'||result.key!==key||result.digest!==hash)throw new TransactionReviewError(503,'review_source_integrity')
  add(result.event);return{id,hash,adapterVersion,receivedAt,source,event:result.event}
 }
 while(queried.size<known.size){
  if(Date.now()>deadline)throw new TransactionReviewError(503,'review_component_limit')
  const frontier=[...known.entries()].filter(([key])=>!queried.has(key)).slice(0,200);for(const [key]of frontier)queried.add(key)
  const reportIds=await db.execute(sql`SELECT id FROM public.commercial_report_evidence WHERE transaction_keys ?| ARRAY[${sql.join(frontier.map(([key])=>sql`${key}`),sql`,`)}]::text[] ORDER BY id LIMIT 10001`)
  if(reportIds.rows.length>REVIEW_LIMIT)throw new TransactionReviewError(503,'review_component_limit')
  const freshReports=reportIds.rows.map(row=>String(row.id)).filter(id=>!receipts.has(id))
  for(let offset=0;offset<freshReports.length;offset+=200){
   if(Date.now()>deadline)throw new TransactionReviewError(503,'review_component_limit')
   const reports=await payload.find({collection:'commercial-report-evidence',where:{id:{in:freshReports.slice(offset,offset+200)}},limit:201,depth:0,overrideAccess:true,req})
   if(reports.docs.length!==freshReports.slice(offset,offset+200).length)throw new TransactionReviewError(503,'report_evidence_integrity')
   for(const row of reports.docs){
    let prepared:ReturnType<typeof restoreReportEvidence>
    try{prepared=restoreReportEvidence(row)}catch{throw new TransactionReviewError(503,'report_evidence_integrity')}
    if(row.provider!==scope.provider||row.accountKey!==scope.accountKey)throw new TransactionReviewError(503,'report_evidence_integrity')
    for(const id of row.relatedTransactionIds as string[])known.set(commercialTransactionKey({...scope,externalTransactionId:id}),id)
    if(known.size>REVIEW_LIMIT)throw new TransactionReviewError(503,'review_component_limit')
    const input=prepared.input,variant:ReviewVariant={id:row.id,hash:row.envelopeHash,adapterVersion:row.version,receivedAt:row.recordedAt,source:'report',event:prepared.event,report:{sourceKind:input.sourceKind,sourceReference:input.sourceReference,recordReference:input.recordReference,replaces:input.replaces}}
    receipts.set(row.id,{kind:'report',id:row.id,key:'report:'+row.key,state:'evidence',conflicted:false,receivedAt:row.recordedAt,startedAt:null,variants:[variant]});variantCount++
    if(receipts.size>REVIEW_LIMIT||variantCount>REVIEW_LIMIT)throw new TransactionReviewError(503,'review_component_limit')
   }
  }
  const ids=await db.execute(sql`SELECT DISTINCT id FROM (
   SELECT i.id FROM public.commercial_inbox i WHERE i.transaction_key IN (${sql.join(frontier.map(([key])=>sql`${key}`),sql`,`)}) AND i.provider=${scope.provider}::enum_commercial_inbox_provider AND i.account_key=${scope.accountKey}
   UNION ALL SELECT c.inbox_id AS id FROM public.commercial_conflicts c WHERE c.envelope->>'provider'=${scope.provider} AND c.envelope->>'accountKey'=${scope.accountKey} AND c.envelope->>'externalTransactionId' IN (${sql.join(frontier.map(([,id])=>sql`${id}`),sql`,`)})
  ) AS component ORDER BY id LIMIT 10001`)
  if(ids.rows.length>REVIEW_LIMIT)throw new TransactionReviewError(503,'review_component_limit')
  const fresh=ids.rows.map(row=>String(row.id)).filter(id=>!receipts.has(id))
  if(receipts.size+fresh.length>REVIEW_LIMIT)throw new TransactionReviewError(503,'review_component_limit')
  for(let offset=0;offset<fresh.length;offset+=200){
   const batch=fresh.slice(offset,offset+200)
   const originals=await payload.find({collection:'commercial-inbox',where:{id:{in:batch}},limit:201,depth:0,overrideAccess:true,req,select:{key:true,provider:true,accountKey:true,transactionKey:true,kind:true,state:true,conflicted:true,receivedAt:true,startedAt:true,envelope:true,envelopeHash:true,adapterVersion:true}})
   if(originals.docs.length!==batch.length)throw new TransactionReviewError(503,'review_source_integrity')
   for(const row of originals.docs){
    if(row.provider!==scope.provider||row.accountKey!==scope.accountKey)throw new TransactionReviewError(503,'review_source_integrity')
    const originalEnvelope=await storedCommercialEnvelope(payload,row as never,req)
    if(!originalEnvelope)throw new TransactionReviewError(503,'review_source_integrity')
    const variant=restore(row.id,row.envelopeHash,row.adapterVersion,row.receivedAt,'original',originalEnvelope,row.key)
    if((variant.event.kind==='ignored'?null:commercialTransactionKey(variant.event))!==(row.transactionKey??null)||row.kind!==(variant.event.kind==='ignored'?'ignored':'event'))throw new TransactionReviewError(503,'review_source_integrity')
    receipts.set(row.id,{id:row.id,key:row.key,state:row.state,conflicted:!!row.conflicted,receivedAt:row.receivedAt,startedAt:row.startedAt??null,variants:[variant]});variantCount++
   }
   const conflicts=await payload.find({collection:'commercial-conflicts',where:{inbox:{in:batch}},limit:10001,depth:0,overrideAccess:true,req,select:{inbox:true,envelopeHash:true,adapterVersion:true,envelope:true,receivedAt:true}})
   if(conflicts.totalDocs>REVIEW_LIMIT||variantCount+conflicts.docs.length>REVIEW_LIMIT)throw new TransactionReviewError(503,'review_component_limit')
   for(const row of conflicts.docs){
    const id=typeof row.inbox==='string'?row.inbox:row.inbox.id,receipt=receipts.get(id)!
    if(receipt.variants.some(variant=>variant.hash===row.envelopeHash))throw new TransactionReviewError(503,'review_source_integrity')
    receipt.variants.push(restore(row.id,row.envelopeHash,row.adapterVersion,row.receivedAt,'conflict',row.envelope,receipt.key));variantCount++
   }
   if(variantCount>REVIEW_LIMIT)throw new TransactionReviewError(503,'review_component_limit')
  }
 }
 if(!receipts.size)throw new TransactionReviewError(404,'review_source_not_found')
 const transactions:unknown[]=[],catalog:CatalogEntry[]=[],productIds=new Set<string>(),catalogKeys=new Set<string>()
 for(const receipt of receipts.values())for(const variant of receipt.variants)if(variant.event.kind!=='ignored'){productIds.add(variant.event.externalProductId);catalogKeys.add(catalogScopeKey(variant.event))}
 const keys=[...known.keys()]
 for(let offset=0;offset<keys.length;offset+=200){
  if(Date.now()>deadline)throw new TransactionReviewError(503,'review_component_limit')
  const result=await payload.find({collection:'transactions',where:{key:{in:keys.slice(offset,offset+200)}},limit:201,depth:0,overrideAccess:true,req,select:{key:true,financialResolution:true,effectiveEbook:true,effectiveOffer:true,effectiveProductId:true,ebook:true,offer:true,externalProductId:true,externalOfferId:true,currency:true,state:true,grossCents:true,refundedCents:true,chargebackCents:true,feesCents:true,producerNetCents:true,approvedAt:true,lastEventAt:true,needsReview:true,reviewReason:true,updatedAt:true}})
  if(result.totalDocs>200)throw new TransactionReviewError(503,'review_component_limit');transactions.push(...result.docs)
 }
 const products=[...productIds]
 for(let offset=0;offset<products.length;offset+=100){
  if(Date.now()>deadline)throw new TransactionReviewError(503,'review_component_limit')
  const result=await payload.find({collection:'offers',where:{and:[{provider:{equals:scope.provider}},{accountKey:{equals:scope.accountKey}},{externalProductId:{in:products.slice(offset,offset+100)}}]},limit:1001,depth:0,overrideAccess:true,req,select:{provider:true,accountKey:true,externalProductId:true,externalOfferId:true,ebook:true}})
  if(result.totalDocs>1000||catalog.length+result.docs.length>REVIEW_LIMIT)throw new TransactionReviewError(503,'review_component_limit');catalog.push(...result.docs)
 }
 // Projection can know an explicit offer from any selected fact while others omit it.
 const catalogDecisions:CatalogDecision[]=[],decisionKeys=[...catalogKeys]
 for(let offset=0;offset<decisionKeys.length;offset+=200){
  if(Date.now()>deadline)throw new TransactionReviewError(503,'review_component_limit')
  catalogDecisions.push(...await readCatalogDecisions(payload,decisionKeys.slice(offset,offset+200),req))
 }
 const sorted=[...receipts.values()].sort((a,b)=>a.id.localeCompare(b.id));for(const receipt of sorted)receipt.variants.sort((a,b)=>a.hash.localeCompare(b.hash))
 const heads=await financialHeads(payload,keys,req)
 const headList=[...new Map([...heads.values()].map(head=>[head.id,{id:head.id,revision:head.revision,transactionKeys:head.transactionKeys}])).values()].sort((a,b)=>a.id.localeCompare(b.id))
 return{scope,financialHeads:headList,transactionScopes:[...known].sort(([a],[b])=>a.localeCompare(b)).map(([key,externalTransactionId])=>({key,externalTransactionId})),receipts:sorted,transactions:transactions.sort((a,b)=>(a as {id:string}).id.localeCompare((b as {id:string}).id)),catalog:catalog.sort((a,b)=>a.id.localeCompare(b.id)),catalogDecisions:catalogDecisions.sort((a,b)=>a.scopeKey.localeCompare(b.scopeKey))}
}
export async function previewTransactionReview(payload:Payload,actor:{id:string;collection:string;role:string}|null,input:unknown,now=Date.now()){
 if(actor?.collection!=='admin-users'||actor.role!=='owner'||!uuid(actor.id))throw new TransactionReviewError(403,'forbidden')
 const choice=reviewChoice(input)
 return atomic(payload,async req=>{
  const id=await req.transactionID;const db=id&&(payload.db as unknown as PostgresAdapter).sessions[id]?.db
  if(!db)throw new TransactionReviewError(503,'transaction_unavailable')
  await db.execute(sql`SET TRANSACTION READ ONLY; SET LOCAL statement_timeout='5s';`)
  return assessTransactionReview(await transactionReviewContext(payload,choice,req),choice,now)
 })
}
