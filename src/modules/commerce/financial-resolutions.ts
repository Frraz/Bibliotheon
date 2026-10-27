import type {Payload,PayloadRequest} from 'payload'
import {sql,type PostgresAdapter} from '@payloadcms/db-postgres'
import {atomic,serial} from '../marketing/transaction'
import {lockCommercialAccounts} from './lock'
import {catalogHash} from './catalog-mapping'
import {commercialTransactionKey,commercialEventDigest,type AccountScope} from './events'
import {assessTransactionReview,transactionReviewContext,reviewChoice,TransactionReviewError,type ReviewContext,type ReviewChoice} from './transaction-review'
import {financialHeads,type FinancialHead,type FinancialCoverage} from './financial-store'
const idOf=(value:unknown)=>typeof value==='string'?value:value&&typeof value==='object'&&'id'in value?String(value.id):null
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
export const financialCoverage=(context:ReviewContext,choice:ReviewChoice):FinancialCoverage[]=>context.receipts.map(receipt=>{
 const selection=choice.selections.find(row=>row.inboxId===receipt.id)
 return{id:receipt.id,key:receipt.key,fingerprint:catalogHash(receipt.variants),hashes:receipt.variants.map(variant=>variant.hash),envelopeHash:selection?.envelopeHash??null,reason:selection?.reason??'source_rejected'}
})
/** A baseline never authorizes a new collision or a merge of components. Clean native additions are replayed. */
export function replayFinancialChoice(head:FinancialHead,context:ReviewContext):ReviewChoice{
 const original=reviewChoice(head.choice)
 if(head.action==='hold')throw new TransactionReviewError(409,'financial_resolution_hold')
 const keys=context.transactionScopes.map(row=>row.key).sort()
 if(JSON.stringify(keys)!==JSON.stringify([...head.transactionKeys].sort())||(context.financialHeads??[]).some(row=>row.id!==head.id))throw new TransactionReviewError(409,'financial_component_changed')
 const receipts=new Map(context.receipts.map(row=>[row.id,row])),selections=[...original.selections]
 for(const item of head.coverage){const receipt=receipts.get(item.id);if(!receipt||receipt.key!==item.key||catalogHash(receipt.variants)!==item.fingerprint)throw new TransactionReviewError(409,'financial_evidence_changed');receipts.delete(item.id)}
 for(const receipt of receipts.values()){
  if(receipt.kind==='report'||receipt.conflicted||receipt.variants.length!==1||receipt.variants[0].event.kind==='ignored')throw new TransactionReviewError(409,'financial_evidence_changed')
  selections.push({inboxId:receipt.id,envelopeHash:receipt.variants[0].hash,reason:'source_confirmed'})
 }
 return reviewChoice({...original,selections})
}
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])):value
const moneyHash=(outcomes:unknown[])=>catalogHash(canonical(outcomes.map(value=>{
 const row=value as {key:string;state:string;projection?:unknown;reason?:string}
 return{key:row.key,state:row.state,...(row.state==='projected'?{projection:row.projection}:{reason:row.reason})}
})))
async function activePlan(payload:Payload,head:FinancialHead,context:ReviewContext,req:PayloadRequest,now:number){
 const choice=replayFinancialChoice(head,context),plan=assessTransactionReview(context,choice,now)
 if(!plan.processable)throw new TransactionReviewError(409,'financial_projection_requires_review')
 const last=(await payload.find({collection:'financial-resolution-applications',where:{and:[{resolution:{equals:head.id}},{sourceHash:{equals:plan.sourceHash}}]},sort:'-createdAt',limit:1,depth:0,overrideAccess:true,req,select:{outcomes:true}})).docs[0]
 return{plan,current:!!last&&moneyHash(last.outcomes as unknown[])===moneyHash(plan.outcomes)}
}
/** Read-only effective coverage for CSV/report consumers. A new receipt is pending until applied. */
export type FinancialStatus={id:string;revision:number;state:'active'|'review';sourceHash?:string}
export async function financialStatuses(payload:Payload,scopes:readonly (AccountScope&{externalTransactionId:string})[],req?:PayloadRequest):Promise<Map<string,FinancialStatus>>{
 if(!req)return atomic(payload,async local=>financialStatuses(payload,scopes,local))
 const heads=await financialHeads(payload,scopes.map(commercialTransactionKey),req),result=new Map<string,{id:string;revision:number;state:'active'|'review';sourceHash?:string}>(),checked=new Set<string>()
 for(const head of heads.values()){
  if(checked.has(head.id))continue;checked.add(head.id)
  let state:'active'|'review'='review',sourceHash:string|undefined,projected=new Set<string>()
  try{
   const choice=reviewChoice(head.choice),context=await transactionReviewContext(payload,choice,req),active=await activePlan(payload,head,context,req,Date.now())
   if(active.current){state='active';projected=new Set(active.plan.outcomes.filter(row=>row.state==='projected').map(row=>row.key))}sourceHash=active.plan.sourceHash
  }catch(error){if(!(error instanceof TransactionReviewError)||error.status>=500)throw error}
  for(const key of head.transactionKeys)result.set(key,{id:head.id,revision:head.revision,state:state==='active'&&projected.has(key)?'active':'review',...(sourceHash?{sourceHash}:{})})
 }
 return result
}
async function applyFinancialPlan(req:PayloadRequest,head:FinancialHead,plan:ReturnType<typeof assessTransactionReview>,actorType:'owner'|'worker',actor:string|null,now:number){
 const payload=req.payload,key=catalogHash([head.id,plan.sourceHash,plan.outcomes]),old=(await payload.find({collection:'financial-resolution-applications',where:{key:{equals:key}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
 const transactions=new Map<string,string>()
 for(const outcome of plan.outcomes){
  let transaction=(await payload.find({collection:'transactions',where:{key:{equals:outcome.key}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
  if(outcome.state!=='projected'){
   if(transaction)await payload.update({collection:'transactions',id:transaction.id,overrideAccess:true,req,data:{financialResolution:head.id,needsReview:true,reviewReason:head.action==='hold'?'financial_resolution_hold':'financial_no_verified_facts',...(head.action==='hold'?{}:{state:'unknown' as const})}})
   continue
  }
  const p=outcome.projection,mapping=outcome.catalog
  if(!transaction)transaction=await payload.create({collection:'transactions',overrideAccess:true,req,depth:0,data:{key:outcome.key,provider:p.provider,accountKey:p.accountKey,externalTransactionId:p.externalTransactionId,externalProductId:p.externalProductId,externalOfferId:p.externalOfferId,ebook:mapping.ebook,offer:mapping.offer,state:'unknown',currency:p.currency,needsReview:false}})
  transactions.set(outcome.key,transaction.id)
  if(transaction.needsReview||idOf(transaction.financialResolution)!==head.id||catalogHash(canonical(transaction.projection))!==catalogHash(canonical(p))||idOf(transaction.effectiveEbook)!==mapping.ebook||idOf(transaction.effectiveOffer)!==mapping.offer){
   await payload.update({collection:'transactions',id:transaction.id,overrideAccess:true,req,data:{financialResolution:head.id,effectiveProductId:p.externalProductId,effectiveEbook:mapping.ebook,effectiveOffer:mapping.offer,state:p.state,currency:p.currency,externalOfferId:p.externalOfferId,approvedAt:p.approvedAt,lastEventAt:p.lastEventAt,grossCents:p.grossCents,refundedCents:p.refundedCents,chargebackCents:p.chargebackCents,feesCents:p.feesCents,producerNetCents:p.producerNetCents,projection:p,needsReview:false,reviewReason:null,lastSuccessAt:new Date(now).toISOString()}})
  }
 }
 if(head.action==='reconcile')for(const receipt of plan.context.receipts){
  // Collided sources retain their reception state; the immutable application records adjudication.
  if(receipt.kind==='report'||receipt.conflicted)continue
  const selection=plan.choice.selections.find(row=>row.inboxId===receipt.id),variant=receipt.variants.find(row=>row.hash===selection?.envelopeHash)
  if(!variant||variant.event.kind==='ignored'){
   if(receipt.state!=='ignored')await payload.update({collection:'commercial-inbox',id:receipt.id,overrideAccess:true,req,data:{state:'needs_review',errorCode:'financial_source_rejected',leaseToken:null}})
   continue
  }
  const tx=transactions.get(commercialTransactionKey(variant.event));if(!tx)continue
  const fact=(await payload.find({collection:'transaction-events',where:{key:{equals:receipt.key}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
  if(fact){if(idOf(fact.inbox)!==receipt.id||idOf(fact.transaction)!==tx||commercialEventDigest(fact.envelope as typeof variant.event)!==variant.hash)throw new TransactionReviewError(409,'financial_history_integrity')}
  else await payload.create({collection:'transaction-events',overrideAccess:true,req,data:{key:receipt.key,transaction:tx,inbox:receipt.id,financialResolution:head.id,envelope:variant.event,occurredAt:variant.event.occurredAt,outcome:'applied'}})
  if(receipt.state!=='applied')await payload.update({collection:'commercial-inbox',id:receipt.id,overrideAccess:true,req,data:{state:'applied',transaction:tx,errorCode:null,leaseToken:null,processedAt:new Date(now).toISOString(),lastSuccessAt:new Date(now).toISOString()}})
 }
 const application=old??await payload.create({collection:'financial-resolution-applications',overrideAccess:true,req,data:{key,resolution:head.id,sourceHash:plan.sourceHash,coverage:financialCoverage(plan.context,plan.choice),outcomes:plan.outcomes,actorType,actor,occurredAt:new Date(now).toISOString()}})
 return{id:head.id,applicationId:application.id,duplicate:!!old}
}
export async function decideFinancialResolution(payload:Payload,actor:{id:string;collection:string;role:string}|null,input:unknown,idempotencyKey:unknown,now=Date.now()){
 if(actor?.collection!=='admin-users'||actor.role!=='owner'||!uuid(actor.id))throw new TransactionReviewError(403,'forbidden')
 if(!input||typeof input!=='object'||Array.isArray(input)||!uuid(idempotencyKey))throw new TransactionReviewError(422,'invalid_financial_decision')
 const row=input as Record<string,unknown>,choiceKeys=['provider','accountKey','externalTransactionId','action','selections'],keys=[...choiceKeys,'planHash','sourceKind','sourceReference','reason','evidenceVerified','confirmed']
 if(Object.keys(row).length!==keys.length||keys.some(key=>!(key in row))||row.confirmed!==true||typeof row.planHash!=='string'||!/^[a-f0-9]{64}$/.test(row.planHash)||!['provider_report','manual_reconciliation'].includes(String(row.sourceKind))||typeof row.sourceReference!=='string'||!/^[a-z][a-z0-9_-]{2,95}$/.test(row.sourceReference))throw new TransactionReviewError(422,'invalid_financial_decision')
 const choice=reviewChoice(Object.fromEntries(choiceKeys.map(key=>[key,row[key]])))
 if(choice.action==='reconcile'&&(row.evidenceVerified!==true||!['provider_records_verified','incorrect_source_reconciled'].includes(String(row.reason)))||choice.action==='hold'&&(row.evidenceVerified!==false||row.reason!=='evidence_inconclusive'))throw new TransactionReviewError(422,'financial_evidence_required')
 const source={sourceKind:row.sourceKind as 'provider_report'|'manual_reconciliation',sourceReference:row.sourceReference,reason:row.reason as 'provider_records_verified'|'incorrect_source_reconciled'|'evidence_inconclusive',evidenceVerified:row.evidenceVerified as boolean}
 const key=catalogHash([actor.id.toLowerCase(),idempotencyKey.toLowerCase()]),requestHash=catalogHash([choice,row.planHash,source,actor.id.toLowerCase()])
 return atomic(payload,async req=>{
  await lockCommercialAccounts(req,[choice]);await serial(req,'financial-resolution:'+key)
  const existing=(await payload.find({collection:'financial-resolutions',where:{key:{equals:key}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
  if(existing){if(existing.requestHash!==requestHash)throw new TransactionReviewError(409,'idempotency_conflict');const heads=await financialHeads(payload,existing.transactionKeys as string[],req);const application=(await payload.find({collection:'financial-resolution-applications',where:{and:[{resolution:{equals:existing.id}},{actorType:{equals:'owner'}}]},limit:1,sort:'createdAt',depth:0,overrideAccess:true,req})).docs[0];return{id:existing.id,applicationId:application?.id,revision:existing.revision,duplicate:true,current:[...heads.values()].every(head=>head.id===existing.id)}}
  const context=await transactionReviewContext(payload,choice,req),plan=assessTransactionReview(context,choice,now)
  if(plan.planHash!==row.planHash)throw new TransactionReviewError(409,'stale_plan')
  if(!plan.processable)throw new TransactionReviewError(409,'financial_projection_requires_review')
  const id=await req.transactionID;const db=id&&(payload.db as unknown as PostgresAdapter).sessions[id]?.db;if(!db)throw new TransactionReviewError(503,'transaction_unavailable')
  const revision=await db.execute(sql`SELECT COALESCE(max(revision),0)+1 AS next FROM public.financial_resolutions WHERE provider=${choice.provider}::enum_financial_resolutions_provider AND account_key=${choice.accountKey}`)
  const resolution=await payload.create({collection:'financial-resolutions',overrideAccess:true,req,data:{key,requestHash,provider:choice.provider,accountKey:choice.accountKey,revision:Number(revision.rows[0].next),transactionKeys:context.transactionScopes.map(scope=>scope.key),previousIds:(context.financialHeads??[]).map(head=>head.id),action:choice.action,choice,coverage:financialCoverage(context,choice),snapshot:context,outcomes:plan.outcomes,sourceHash:plan.sourceHash,planHash:plan.planHash,actor:actor.id,occurredAt:new Date(now).toISOString(),...source}})
  const head:FinancialHead={...resolution,transactionKeys:resolution.transactionKeys as string[],coverage:resolution.coverage as FinancialCoverage[]}
  const application=await applyFinancialPlan(req,head,plan,'owner',actor.id,now)
  return{...application,revision:resolution.revision,duplicate:false,current:true}
 })
}
/** Caller either owns the native account barrier, or this function acquires it. */
export async function processFinancialComponent(payload:Payload,scope:AccountScope&{externalTransactionId:string},inboxId:string,now=Date.now()){
 return atomic(payload,async req=>{
  await lockCommercialAccounts(req,[scope]);const head=(await financialHeads(payload,[commercialTransactionKey(scope)],req)).get(commercialTransactionKey(scope))
  if(!head)return{state:'unmanaged' as const}
  const context=await transactionReviewContext(payload,reviewChoice(head.choice),req)
  let plan:ReturnType<typeof assessTransactionReview>
  try{
   const choice=replayFinancialChoice(head,context);plan=assessTransactionReview(context,choice,now)
   if(!plan.processable)throw new TransactionReviewError(409,'financial_projection_requires_review')
  }catch(error){
   if(!(error instanceof TransactionReviewError)||error.status>=500)throw error
   for(const transaction of context.transactions as {id:string}[])await payload.update({collection:'transactions',id:transaction.id,overrideAccess:true,req,data:{needsReview:true,reviewReason:error.code}})
   const receipt=context.receipts.find(row=>row.id===inboxId)
   if(receipt&&!['applied','ignored'].includes(receipt.state))await payload.update({collection:'commercial-inbox',id:inboxId,overrideAccess:true,req,data:{state:'needs_review',errorCode:error.code,leaseToken:null}})
   return{state:'needs_review' as const}
  }
  // Any application failure propagates out of atomic: never commit partial monetary updates.
  await applyFinancialPlan(req,head,plan,'worker',null,now)
  const receipt=context.receipts.find(row=>row.id===inboxId),selection=plan.choice.selections.find(row=>row.inboxId===inboxId)
  return{state:receipt&&selection?.envelopeHash?'applied' as const:'held' as const}
 })
}
