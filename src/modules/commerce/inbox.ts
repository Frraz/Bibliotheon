import {reportEvidenceKeys} from './report-evidence-store'
import {financialHeads,markFinancialEvidencePending,receiptAlreadyAdjudicated} from './financial-store'
import {processFinancialComponent,financialStatuses} from './financial-resolutions'
import {commercialCollisionKeys} from './collisions'
import {mapCatalogIdentity,catalogScopeKey,type CatalogScope} from './catalog-mapping'
import {readCatalogDecisions} from './catalog-resolutions'
import {createHash,randomUUID} from 'node:crypto'
import type {Payload,PayloadRequest} from 'payload'
import {atomic,serial} from '../marketing/transaction'
import {commercialEventDigest,commercialEventKey,commercialTransactionKey,parseCommercialEvent,prepareCommercialReceipt,prepareCommercialBatch,type PreparedCommercialReceipt,type AccountScope,type CommercialAdapter,type NormalizedCommercialEvent} from './events'
import {projectCommercialEvents} from './projection'
import {lockCommercialProducts,lockCommercialAccounts} from './lock'
import {COMMERCIAL_LEASE_MS} from './policy'
import {storedCommercialEnvelope} from './stored-envelope'
const LEASE=COMMERCIAL_LEASE_MS,MAX_ATTEMPTS=5
const idOf=(value:string|{id:string})=>typeof value==='string'?value:value.id
export class CommercialError extends Error{constructor(public status:number,public code:string){super(code)}}
export const retryReasons=['catalog_updated','service_restored','reviewed_envelope'] as const
export type RetryReason=typeof retryReasons[number]
type Options={now?:number;clock?:()=>number}
const clockFor=(options:Options)=>options.clock??(options.now===undefined?Date.now:()=>options.now!)
async function audit(req:PayloadRequest,inbox:string,action:'received'|'ignored'|'conflict'|'applied'|'review'|'failed'|'retry',actorType:'receiver'|'worker'|'owner',now:number,reason?:string,transaction?:string,actor?:string){
 await req.payload.create({collection:'commercial-audit',data:{inbox,action,actorType,occurredAt:new Date(now).toISOString(),reason,transaction,actor},overrideAccess:true,req})
}
/** Each receipt stores only validated minimal evidence, inside the caller's transaction. */
async function persistCommercialReceipt(req:PayloadRequest,prepared:PreparedCommercialReceipt,now:number){
 const payload=req.payload,scope=prepared.event
 await serial(req,`commercial-inbox:${prepared.key}`)
 const previous=(await payload.find({collection:'commercial-inbox',where:{key:{equals:prepared.key}},depth:0,limit:1,overrideAccess:true,req})).docs[0]
 if(previous){
  if(previous.envelopeHash===prepared.digest)return{state:'duplicate' as const}
  const key=createHash('sha256').update(JSON.stringify([prepared.key,prepared.digest])).digest('hex')
  const newVariant=!(await payload.count({collection:'commercial-conflicts',where:{key:{equals:key}},overrideAccess:true,req})).totalDocs
  if(newVariant){
   await payload.create({collection:'commercial-conflicts',data:{key,inbox:previous.id,envelopeHash:prepared.digest,envelope:prepared.event,adapterVersion:prepared.adapterVersion,receivedAt:new Date(now).toISOString()},overrideAccess:true,req})
   await audit(req,previous.id,'conflict','receiver',now,'event_key_conflict',previous.transaction?idOf(previous.transaction):undefined)
  }
  await payload.update({collection:'commercial-inbox',id:previous.id,data:{conflicted:true,errorCode:'event_key_conflict',...(previous.state==='applied'||previous.state==='ignored'?{}:{state:'needs_review',leaseToken:null})},overrideAccess:true,req})
  const affected=[...new Set([previous.transactionKey,...(prepared.state==='prepared'?[prepared.transactionKey]:[])].filter((key):key is string=>!!key))].sort()
  if(newVariant||!await receiptAlreadyAdjudicated(req,affected,previous.id))await markFinancialEvidencePending(req,affected,'event_key_conflict',true)
  return{state:'conflict' as const}
 }
 const ignored=prepared.state==='prepared_ignored'
 const row=await payload.create({collection:'commercial-inbox',data:{key:prepared.key,provider:scope.provider,accountKey:scope.accountKey,eventKey:prepared.event.eventKey,adapterVersion:prepared.adapterVersion,envelopeHash:prepared.digest,envelope:prepared.event,transactionKey:prepared.state==='prepared'?prepared.transactionKey:undefined,kind:ignored?'ignored':'event',state:ignored?'ignored':'pending',receivedAt:new Date(now).toISOString(),nextAttemptAt:new Date(now).toISOString(),attempts:0,attemptBase:0,conflicted:false,...(ignored?{processedAt:new Date(now).toISOString()}:{})},overrideAccess:true,req})
 if(prepared.state==='prepared')await markFinancialEvidencePending(req,[prepared.transactionKey],'financial_evidence_pending')
 await audit(req,row.id,ignored?'ignored':'received','receiver',now)
 return{state:'received' as const}
}
/** Native batches commit all items together. Partial ACK is never returned. */
export async function receiveCommercialWebhook(source:Payload|(()=>Promise<Payload>),adapter:CommercialAdapter,scope:AccountScope,body:Uint8Array,headers:Headers,options:Options={}){
 if(adapter.batch){
  const batch=await prepareCommercialBatch(adapter,scope,body,headers)
  if(batch.state!=='prepared_batch')return batch
  const payload=typeof source==='function'?await source():source,now=clockFor(options)()
  return atomic(payload,async req=>{
   await lockCommercialAccounts(req,[scope])
   const receipts=[...batch.receipts].sort((a,b)=>a.key.localeCompare(b.key))
   // All inbox locks precede all affected transaction locks, in deterministic order.
   for(const key of [...new Set(receipts.map(receipt=>receipt.key))])await serial(req,`commercial-inbox:${key}`)
   const transactions=new Set<string>()
   for(const key of [...new Set(receipts.map(receipt=>receipt.key))]){
    const previous=(await payload.find({collection:'commercial-inbox',where:{key:{equals:key}},depth:0,limit:1,overrideAccess:true,req})).docs[0]
    if(previous?.transactionKey&&previous.transaction)transactions.add(previous.transactionKey)
   }
   for(const key of [...transactions].sort())await serial(req,`commercial-transaction:${key}`)
   const states=[]
   for(const receipt of receipts)states.push((await persistCommercialReceipt(req,receipt,now)).state)
   return{state:states.includes('conflict')?'conflict' as const:states.includes('received')?'received' as const:'duplicate' as const}
  })
 }
 const prepared=await prepareCommercialReceipt(adapter,scope,body,headers)
 if(prepared.state!=='prepared'&&prepared.state!=='prepared_ignored')return prepared
 const payload=typeof source==='function'?await source():source,now=clockFor(options)()
 return atomic(payload,async req=>{
  await lockCommercialAccounts(req,[scope])
  return persistCommercialReceipt(req,prepared,now)
 })
}

async function mapCatalog(req:PayloadRequest,event:NormalizedCommercialEvent,transaction?:{externalOfferId?:string|null}){
 const scope:CatalogScope={...event,externalOfferId:event.externalOfferId||transaction?.externalOfferId||null}
 await lockCommercialProducts(req,[event])
 const candidates=await req.payload.find({collection:'offers',where:{and:[{provider:{equals:event.provider}},{accountKey:{equals:event.accountKey}},{externalProductId:{equals:event.externalProductId}},...(scope.externalOfferId?[{externalOfferId:{equals:scope.externalOfferId}}]:[])]},limit:1001,depth:0,overrideAccess:true,req})
 if(candidates.totalDocs>1000)return{state:'review' as const,reason:'catalog_limit'}
 const decision=(await readCatalogDecisions(req.payload,[catalogScopeKey(scope)],req))[0]
 return mapCatalogIdentity(scope,candidates.docs,decision)
}
export async function processCommercialInbox(payload:Payload,id:string,options:Options={}){
 const clock=clockFor(options),leaseToken=randomUUID()
 const claim=await atomic(payload,async req=>{
  const initial=await payload.findByID({collection:'commercial-inbox',id,depth:0,overrideAccess:true,req})
  await lockCommercialAccounts(req,[initial])
  await serial(req,`commercial-inbox:${initial.key}`)
  const row=await payload.findByID({collection:'commercial-inbox',id,depth:0,overrideAccess:true,req})
  const stored=parseCommercialEvent(await storedCommercialEnvelope(payload,row,req),{provider:row.provider,accountKey:row.accountKey})
  if(stored.ok&&(await financialHeads(payload,[commercialTransactionKey(stored.event)],req)).size)return{state:'financial' as const,scope:stored.event}
  if(row.state==='applied'||row.state==='ignored')return{state:row.state}
  if(row.conflicted||row.state==='needs_review')return{state:'held' as const}
  if(row.state==='processing'&&row.startedAt&&Date.parse(row.startedAt)>clock()-LEASE||row.state!=='processing'&&Date.parse(row.nextAttemptAt)>clock())return{state:'held' as const}
  if(row.attempts-row.attemptBase>=MAX_ATTEMPTS){await payload.update({collection:'commercial-inbox',id,data:{state:'needs_review',errorCode:'attempts_exhausted',leaseToken:null},overrideAccess:true,req});await audit(req,id,'review','worker',clock(),'attempts_exhausted');return{state:'held' as const}}
  await payload.update({collection:'commercial-inbox',id,data:{state:'processing',leaseToken,startedAt:new Date(clock()).toISOString(),attempts:row.attempts+1,errorCode:null},overrideAccess:true,req})
  return{state:'claimed' as const,key:row.key}
 })
 if(claim.state==='financial')return processFinancialComponent(payload,claim.scope,id,clock())
 if(claim.state!=='claimed')return claim
 try{return await atomic(payload,async req=>{
  const claimed=await payload.findByID({collection:'commercial-inbox',id,depth:0,overrideAccess:true,req})
  await lockCommercialAccounts(req,[claimed])
  await serial(req,`commercial-inbox:${claim.key}`)
  const row=await payload.findByID({collection:'commercial-inbox',id,depth:0,overrideAccess:true,req}),now=clock()
  if(row.state!=='processing'||row.leaseToken!==leaseToken||row.conflicted)return{state:'held' as const}
  const parsed=parseCommercialEvent(await storedCommercialEnvelope(payload,row,req),{provider:row.provider,accountKey:row.accountKey})
  if(!parsed.ok)return finishReview('invalid_envelope')
  const event=parsed.event
  if(row.kind!=='event'||commercialEventKey(event)!==row.key||commercialEventDigest(event)!==row.envelopeHash||commercialTransactionKey(event)!==row.transactionKey)return finishReview('envelope_integrity')
  if(Date.parse(event.occurredAt)>now+300000||event.approvedAt&&Date.parse(event.approvedAt)>now+300000||event.sourceCreatedAt&&Date.parse(event.sourceCreatedAt)>now+300000)return finishReview('future_event_time')
  await serial(req,`commercial-transaction:${row.transactionKey}`)
  let transaction=(await payload.find({collection:'transactions',where:{key:{equals:row.transactionKey}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
  if((await commercialCollisionKeys(payload,[event],req)).has(row.transactionKey!))return finishReview('transaction_conflicted',transaction?.id)
  if((await reportEvidenceKeys(payload,[row.transactionKey!],req)).size)return finishReview('report_evidence_requires_review',transaction?.id)
  const mapped=await mapCatalog(req,event,transaction)
  if(mapped.state==='review')return finishReview(mapped.reason,transaction?.id)
  if(transaction&&(idOf(transaction.ebook)!==mapped.ebook&&!mapped.resolutionId||transaction.externalProductId!==event.externalProductId))return finishReview('catalog_identity_changed',transaction.id)
  const existing=(await payload.find({collection:'transaction-events',where:{key:{equals:row.key}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
  if(existing&&(!transaction||idOf(existing.transaction)!==transaction.id||idOf(existing.inbox)!==id))return finishReview('history_integrity',transaction?.id)
  if(existing){const old=parseCommercialEvent(existing.envelope,{provider:row.provider,accountKey:row.accountKey});if(!old.ok||commercialEventDigest(old.event)!==row.envelopeHash)return finishReview('history_integrity',transaction?.id)}
  const history=transaction?await payload.find({collection:'transaction-events',where:{transaction:{equals:transaction.id}},limit:10001,depth:0,overrideAccess:true,req}):{docs:[],totalDocs:0}
  if(history.totalDocs>9999&&!existing)return finishReview('history_limit',transaction?.id)
  const facts=existing?history.docs.map(fact=>fact.envelope):[...history.docs.map(fact=>fact.envelope),event]
  const projection=projectCommercialEvents(facts,{provider:row.provider,accountKey:row.accountKey})
  if(!transaction)transaction=await payload.create({collection:'transactions',data:{key:row.transactionKey!,provider:event.provider,accountKey:event.accountKey,externalTransactionId:event.externalTransactionId,externalProductId:event.externalProductId,externalOfferId:event.externalOfferId,ebook:mapped.ebook,offer:mapped.offer,state:'unknown',currency:event.currency,needsReview:false},depth:0,overrideAccess:true,req})
  if(!existing)await payload.create({collection:'transaction-events',data:{key:row.key,transaction:transaction.id,inbox:id,catalogResolution:mapped.resolutionId??null,envelope:event,occurredAt:event.occurredAt,outcome:projection.state==='projected'?'applied':'needs_review',errorCode:projection.state==='needs_review'?projection.reason:null},overrideAccess:true,req})
  if(projection.state==='needs_review')return finishReview(projection.reason,transaction.id)
  const p=projection.projection
  await payload.update({collection:'transactions',id:transaction.id,data:{state:p.state,currency:p.currency,externalOfferId:p.externalOfferId,offer:transaction.offer||(!mapped.resolutionId?mapped.offer:null),approvedAt:p.approvedAt,lastEventAt:p.lastEventAt,grossCents:p.grossCents,refundedCents:p.refundedCents,chargebackCents:p.chargebackCents,feesCents:p.feesCents,producerNetCents:p.producerNetCents,projection:p,lastSuccessAt:new Date(now).toISOString(),needsReview:false,reviewReason:null},overrideAccess:true,req})
  await payload.update({collection:'commercial-inbox',id,data:{state:'applied',transaction:transaction.id,leaseToken:null,errorCode:null,processedAt:new Date(now).toISOString(),lastSuccessAt:new Date(now).toISOString()},overrideAccess:true,req})
  await audit(req,id,'applied','worker',now,undefined,transaction.id)
  return{state:'applied' as const}
  async function finishReview(reason:string,transactionId?:string){
   if(transactionId)await payload.update({collection:'transactions',id:transactionId,data:{needsReview:true,reviewReason:reason},overrideAccess:true,req})
   await payload.update({collection:'commercial-inbox',id,data:{state:'needs_review',errorCode:reason,leaseToken:null,processedAt:new Date(now).toISOString(),transaction:transactionId},overrideAccess:true,req})
   await audit(req,id,'review','worker',now,reason,transactionId)
   return{state:'needs_review' as const}
  }
 })}catch{
  return atomic(payload,async req=>{
   const claimed=await payload.findByID({collection:'commercial-inbox',id,depth:0,overrideAccess:true,req})
   await lockCommercialAccounts(req,[claimed])
   await serial(req,`commercial-inbox:${claim.key}`)
   const row=await payload.findByID({collection:'commercial-inbox',id,depth:0,overrideAccess:true,req})
   if(row.state!=='processing'||row.leaseToken!==leaseToken)return{state:'held' as const}
   const now=clock()
   await payload.update({collection:'commercial-inbox',id,data:{state:'failed',leaseToken:null,errorCode:'processing_unavailable',nextAttemptAt:new Date(now+Math.min(3600000,30000*2**(row.attempts-1))).toISOString()},overrideAccess:true,req})
   await audit(req,id,'failed','worker',now,'processing_unavailable')
   return{state:'failed' as const}
  })
 }
}
export async function processCommercialQueue(payload:Payload,options:Options&{limit?:number;enabled?:boolean}={}){
 if(!(options.enabled??process.env.COMMERCIAL_EVENTS_ENABLED==='true'))return{state:'disabled' as const}
 const limit=options.limit??1,now=clockFor(options)();if(!Number.isInteger(limit)||limit<1||limit>25)throw new CommercialError(400,'invalid_limit')
 const rows=await payload.find({collection:'commercial-inbox',where:{and:[{conflicted:{equals:false}},{or:[{and:[{state:{in:['pending','failed']}},{nextAttemptAt:{less_than_equal:new Date(now).toISOString()}}]},{and:[{state:{equals:'processing'}},{startedAt:{less_than_equal:new Date(now-LEASE).toISOString()}}]}]}]},sort:'nextAttemptAt',depth:0,limit,overrideAccess:true})
 let examined=0;for(const row of rows.docs){await processCommercialInbox(payload,row.id,options);examined++}
 return{state:'processed' as const,examined}
}
export async function retryCommercialInbox(payload:Payload,id:string,reason:RetryReason,actor:{id:string;collection:string;role:string}|null,options:Options={}){
 if(actor?.collection!=='admin-users'||actor.role!=='owner')throw new CommercialError(403,'forbidden')
 if(!retryReasons.includes(reason))throw new CommercialError(400,'invalid_reason')
 const now=clockFor(options)()
 return atomic(payload,async req=>{
  const initial=await payload.findByID({collection:'commercial-inbox',id,depth:0,overrideAccess:true,req});await lockCommercialAccounts(req,[initial]);await serial(req,`commercial-inbox:${initial.key}`)
  const row=await payload.findByID({collection:'commercial-inbox',id,depth:0,overrideAccess:true,req})
  const stored=parseCommercialEvent(await storedCommercialEnvelope(payload,row,req),{provider:row.provider,accountKey:row.accountKey})
  if(stored.ok&&(await financialHeads(payload,[commercialTransactionKey(stored.event)],req)).size){
   const status=(await financialStatuses(payload,[stored.event],req)).get(commercialTransactionKey(stored.event))
   if(status?.state==='active'){await audit(req,id,'retry','owner',now,reason,row.transaction?idOf(row.transaction):undefined,actor.id);return{state:'unchanged' as const}}
   throw new CommercialError(409,'financial_resolution_review_required')
  }
  if(stored.ok&&(await reportEvidenceKeys(payload,[commercialTransactionKey(stored.event)],req)).size)throw new CommercialError(409,'report_evidence_requires_review')
  if(row.conflicted)throw new CommercialError(409,'event_key_conflict')
  if(stored.ok&&(await commercialCollisionKeys(payload,[stored.event],req)).has(commercialTransactionKey(stored.event)))throw new CommercialError(409,'transaction_conflicted')
  if(row.state==='applied'||row.state==='ignored'){await audit(req,id,'retry','owner',now,reason,row.transaction?idOf(row.transaction):undefined,actor.id);return{state:'unchanged' as const}}
  if(row.state==='processing'&&row.startedAt&&Date.parse(row.startedAt)>now-LEASE)throw new CommercialError(409,'processing_active')
  await payload.update({collection:'commercial-inbox',id,data:{state:'pending',leaseToken:null,nextAttemptAt:new Date(now).toISOString(),attemptBase:row.attempts,errorCode:null},overrideAccess:true,req})
  await audit(req,id,'retry','owner',now,reason,row.transaction?idOf(row.transaction):undefined,actor.id)
  return{state:'queued' as const}
 })
}
