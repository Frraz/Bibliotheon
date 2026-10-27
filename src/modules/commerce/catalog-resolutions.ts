import type {Payload,PayloadRequest} from 'payload'
import {sql,type PostgresAdapter} from '@payloadcms/db-postgres'
import {atomic,serial} from '../marketing/transaction'
import {lockCommercialAccounts} from './lock'
import {commercialProviders,opaqueID} from './events'
import {catalogScopeKey,catalogHash,catalogBookID,type CatalogScope,type CatalogDecision,type CatalogEntry} from './catalog-mapping'
export class CatalogResolutionError extends Error{constructor(readonly status:number,readonly code:string){super(code)}}
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
export type CatalogChoice=CatalogScope&{action:'associate'|'hold';targetOfferId:string|null;targetEbookId:string|null}
const choiceKeys=['provider','accountKey','externalProductId','externalOfferId','action','targetOfferId','targetEbookId'] as const
export function catalogChoice(input:unknown):CatalogChoice{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new CatalogResolutionError(422,'invalid_choice')
 const value=input as Record<string,unknown>
 if(Object.keys(value).length!==choiceKeys.length||choiceKeys.some(key=>!(key in value))||!commercialProviders.includes(value.provider as CatalogScope['provider'])||!opaqueID(value.accountKey)||!opaqueID(value.externalProductId)||value.externalOfferId!==null&&!opaqueID(value.externalOfferId)||!['associate','hold'].includes(String(value.action))||value.targetOfferId!==null&&!uuid(value.targetOfferId)||value.targetEbookId!==null&&!uuid(value.targetEbookId)||value.action==='associate'&&value.targetOfferId===null&&value.targetEbookId===null||value.action==='hold'&&(value.targetOfferId!==null||value.targetEbookId!==null))throw new CatalogResolutionError(422,'invalid_choice')
 return{provider:value.provider as CatalogScope['provider'],accountKey:value.accountKey as string,externalProductId:value.externalProductId as string,externalOfferId:value.externalOfferId as string|null,action:value.action as CatalogChoice['action'],targetOfferId:typeof value.targetOfferId==='string'?value.targetOfferId.toLowerCase():null,targetEbookId:typeof value.targetEbookId==='string'?value.targetEbookId.toLowerCase():null}
}
export async function readCatalogDecisions(payload:Payload,scopeKeys:readonly string[],req?:PayloadRequest):Promise<CatalogDecision[]>{
 const adapter=payload.db as unknown as PostgresAdapter,tx=req&&await req.transactionID
 const db=tx?adapter.sessions[tx]?.db:adapter.drizzle
 if(!db)throw new CatalogResolutionError(503,'transaction_unavailable')
 const keys=[...new Set(scopeKeys)],decisions:CatalogDecision[]=[]
 for(let offset=0;offset<keys.length;offset+=200){
  const result=await db.execute(sql`SELECT DISTINCT ON (scope_key) id, scope_key AS "scopeKey", revision, action, target_offer_id AS "targetOffer", target_ebook_id AS "targetEbook" FROM public.catalog_resolutions WHERE scope_key IN (${sql.join(keys.slice(offset,offset+200).map(key=>sql`${key}`),sql`,`)}) ORDER BY scope_key,revision DESC`)
  for(const row of result.rows){
   const revision=Number(row.revision)
   if(!Number.isSafeInteger(revision)||revision<1)throw new CatalogResolutionError(503,'resolution_integrity')
   decisions.push({...row,revision} as CatalogDecision)
  }
 }
 return decisions
}
const owner=(actor:{id:string;collection:string;role:string}|null)=>{
 if(actor?.collection!=='admin-users'||actor.role!=='owner'||!uuid(actor.id))throw new CatalogResolutionError(403,'forbidden')
 return{...actor,id:actor.id.toLowerCase()}
}
/** No writes. Commit recomputes under the shared account barrier. */
export async function catalogResolutionPlan(payload:Payload,choice:CatalogChoice,req?:PayloadRequest){
 const scopeKey=catalogScopeKey(choice)
 const offers=await payload.find({collection:'offers',where:{and:[{provider:{equals:choice.provider}},{accountKey:{equals:choice.accountKey}},{externalProductId:{equals:choice.externalProductId}}]},limit:1001,depth:0,overrideAccess:true,req,select:{provider:true,accountKey:true,externalProductId:true,externalOfferId:true,ebook:true}})
 const history=await payload.find({collection:'transactions',where:{and:[{provider:{equals:choice.provider}},{accountKey:{equals:choice.accountKey}},{externalProductId:{equals:choice.externalProductId}}]},limit:10001,depth:0,overrideAccess:true,req,select:{ebook:true,offer:true,externalOfferId:true,state:true,needsReview:true,updatedAt:true}})
 if(offers.totalDocs>1000||history.totalDocs>10000)throw new CatalogResolutionError(503,'catalog_resolution_limit')
 const candidates=offers.docs as CatalogEntry[],selected=candidates.find(offer=>offer.id===choice.targetOfferId)
 if(choice.targetOfferId&&(!selected||choice.externalOfferId&&selected.externalOfferId!==choice.externalOfferId||!selected.ebook||choice.targetEbookId&&catalogBookID(selected.ebook)!==choice.targetEbookId))throw new CatalogResolutionError(422,'target_scope_mismatch')
 if(choice.targetEbookId&&!await payload.findByID({collection:'ebooks',id:choice.targetEbookId,depth:0,overrideAccess:true,disableErrors:true,req}))throw new CatalogResolutionError(422,'target_scope_mismatch')
 const current=(await readCatalogDecisions(payload,[scopeKey],req))[0]??null
 const snapshot={candidates:[...candidates].sort((a,b)=>a.id.localeCompare(b.id)),transactions:[...history.docs].sort((a,b)=>a.id.localeCompare(b.id)),current}
 const targetEbookId=choice.action==='associate'?choice.targetEbookId??catalogBookID(selected!.ebook):null
 return{scopeKey,choice,targetEbookId,currentRevision:current?.revision??0,currentResolutionId:current?.id??null,planHash:catalogHash([choice,snapshot,targetEbookId]),snapshot,provisional:true as const}
}
export async function previewCatalogResolution(payload:Payload,actor:Parameters<typeof owner>[0],input:unknown){
 owner(actor);return catalogResolutionPlan(payload,catalogChoice(input))
}
export async function decideCatalogResolution(payload:Payload,actor:Parameters<typeof owner>[0],input:unknown,idempotencyKey:unknown,now=Date.now()){
 const auth=owner(actor)
 if(!input||typeof input!=='object'||Array.isArray(input)||!uuid(idempotencyKey))throw new CatalogResolutionError(422,'invalid_decision')
 const value=input as Record<string,unknown>,keys=[...choiceKeys,'planHash','sourceKind','sourceReference','reason','evidenceVerified','confirmed']
 if(Object.keys(value).length!==keys.length||keys.some(key=>!(key in value))||value.confirmed!==true||typeof value.planHash!=='string'||!/^[a-f0-9]{64}$/.test(value.planHash)||!['provider_report','manual_reconciliation'].includes(String(value.sourceKind))||typeof value.sourceReference!=='string'||!/^[a-z][a-z0-9_-]{2,95}$/.test(value.sourceReference))throw new CatalogResolutionError(422,'invalid_decision')
 const choice=catalogChoice(Object.fromEntries(choiceKeys.map(key=>[key,value[key]])))
 if(choice.action==='associate'&&(value.evidenceVerified!==true||!['catalog_mapping_verified','historical_mapping_correction'].includes(String(value.reason)))||choice.action==='hold'&&(value.evidenceVerified!==false||value.reason!=='evidence_inconclusive'))throw new CatalogResolutionError(422,'evidence_required')
 const source={sourceKind:value.sourceKind as 'provider_report'|'manual_reconciliation',sourceReference:value.sourceReference,reason:value.reason as 'catalog_mapping_verified'|'historical_mapping_correction'|'evidence_inconclusive',evidenceVerified:value.evidenceVerified as boolean}
 const key=catalogHash([auth.id,idempotencyKey.toLowerCase()]),requestHash=catalogHash([choice,value.planHash,source,auth.id]),scopeKey=catalogScopeKey(choice)
 return atomic(payload,async req=>{
  await lockCommercialAccounts(req,[choice]);await serial(req,'catalog-resolution:'+key)
  const existing=(await payload.find({collection:'catalog-resolutions',where:{key:{equals:key}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
  if(existing){
   if(existing.requestHash!==requestHash)throw new CatalogResolutionError(409,'idempotency_conflict')
   const current=(await readCatalogDecisions(payload,[scopeKey],req))[0]
   return{id:existing.id,revision:existing.revision,current:current?.id===existing.id,duplicate:true}
  }
  const plan=await catalogResolutionPlan(payload,choice,req)
  if(plan.planHash!==value.planHash)throw new CatalogResolutionError(409,'stale_plan')
  const resolution=await payload.create({collection:'catalog-resolutions',data:{key,requestHash,scopeKey,provider:choice.provider,accountKey:choice.accountKey,externalProductId:choice.externalProductId,externalOfferId:choice.externalOfferId,action:choice.action,targetOffer:choice.targetOfferId,targetEbook:plan.targetEbookId,revision:plan.currentRevision+1,previous:plan.currentResolutionId,actor:auth.id,occurredAt:new Date(now).toISOString(),...source,planHash:plan.planHash,snapshot:plan.snapshot},overrideAccess:true,req})
  return{id:resolution.id,revision:resolution.revision,current:true,duplicate:false}
 })
}
