import {createHash} from 'node:crypto'
import type {CollectionSlug,Payload} from 'payload'
import {atomic,serial} from '../marketing/transaction'

const DAY=86_400_000
const RETENTION_DAYS=90
const BATCH=100
type Relation={id?:string}|string|null|undefined
type ExpiringRecord={id:string;[key:string]:unknown}
type EventRecord=ExpiringRecord&{
 occurredAt:string
 ebook?:Relation
 campaign?:Relation
 provider?:'hotmart'|'kiwify'|'cakto'|null
 pagePath?:string|null
 visit?:Relation
}
export type AnalyticsRetentionReport={
 mode:'preview'|'applied'
 cutoff:string
 candidates:{pageViews:number;checkoutClicks:number;visits:number;attributionContexts:number;grants:number;limits:number}
 processed:{pageViews:number;checkoutClicks:number;visits:number;attributionContexts:number;grants:number;limits:number}
 aggregatesUpdated:number
}
const relationId=(value:Relation):string|undefined=>typeof value==='string'?value:value?.id
const safePageGroup=(path:string|undefined|null)=>{
 if(!path||path==='/')return path??null
 const root=path.split('/')[1]
 return ['ebooks','artigos','temas','amostras'].includes(root??'')?`/${root}`:'/outro'
}
const count=async(payload:Payload,collection:CollectionSlug,field:string,before:string)=>
 (await payload.count({collection,where:{[field]:{less_than:before}},overrideAccess:true})).totalDocs
const listExpired=async<T extends ExpiringRecord>(payload:Payload,collection:CollectionSlug,field:string,before:string)=>
 (await payload.find({collection,where:{[field]:{less_than:before}},sort:field,limit:BATCH,page:1,depth:0,overrideAccess:true})).docs as unknown as T[]
const eventKey=(kind:'page_view'|'checkout_click',row:EventRecord)=>{
 const dimensions={day:new Date(row.occurredAt).toISOString().slice(0,10),kind,ebook:relationId(row.ebook)??null,campaign:relationId(row.campaign)??null,provider:row.provider??null,pagePath:kind==='page_view'?safePageGroup(row.pagePath):null}
 const canonical=JSON.stringify(dimensions)
 return{key:createHash('sha256').update(canonical).digest('hex'),dimensions}
}
async function aggregateAndDelete(payload:Payload,collection:'page-views'|'checkout-clicks',kind:'page_view'|'checkout_click',row:EventRecord){
 await atomic(payload,async req=>{
  const {key,dimensions}=eventKey(kind,row)
  await serial(req,`analytics-retention:${key}`)
  const aggregate=(await req.payload.find({collection:'analytics-daily-aggregates',where:{key:{equals:key}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
  if(aggregate)await req.payload.update({collection:'analytics-daily-aggregates',id:aggregate.id,data:{count:aggregate.count+1},overrideAccess:true,req})
  else await req.payload.create({collection:'analytics-daily-aggregates',data:{key,day:`${dimensions.day}T00:00:00.000Z`,kind,...(dimensions.ebook?{ebook:dimensions.ebook}:{}),...(dimensions.campaign?{campaign:dimensions.campaign}:{}),...(dimensions.provider?{provider:dimensions.provider}:{}),...(dimensions.pagePath?{pagePath:dimensions.pagePath}:{}),count:1},overrideAccess:true,req})
  await req.payload.delete({collection,id:row.id,overrideAccess:true,req})
 })
}
async function expireVisits(payload:Payload,cutoff:string,apply:boolean){
 const eligible=await count(payload,'visits','expiresAt',cutoff)
 let processed=0
 if(!apply)return{eligible,processed}
 while(true){
  const rows=await listExpired<ExpiringRecord&{grant:Relation}>(payload,'visits','expiresAt',cutoff)
  if(!rows.length)break
  let progressed=false
  for(const visit of rows){
   const grantId=relationId(visit.grant)
   if(!grantId)continue
   const parent=await payload.findByID({collection:'analytics-grants',id:grantId,depth:0,overrideAccess:true}).catch(()=>null)
   if(!parent)continue
   const deleted=await atomic(payload,async req=>{
    await serial(req,`analytics-grant:${parent.tokenHash}`)
    const currentVisit=await req.payload.findByID({collection:'visits',id:visit.id,depth:0,overrideAccess:true,req}).catch(()=>null)
    if(!currentVisit||Date.parse(currentVisit.expiresAt)>=Date.parse(cutoff))return false
    const grant=await req.payload.findByID({collection:'analytics-grants',id:grantId,depth:0,overrideAccess:true,req}).catch(()=>null)
    if(!grant)return false
    const pageViews=await req.payload.count({collection:'page-views',where:{visit:{equals:visit.id}},overrideAccess:true,req})
    const clicks=await req.payload.count({collection:'checkout-clicks',where:{visit:{equals:visit.id}},overrideAccess:true,req})
    if(pageViews.totalDocs||clicks.totalDocs)return false
    if(relationId(grant.currentVisit)===visit.id)await req.payload.update({collection:'analytics-grants',id:grant.id,data:{currentVisit:null},overrideAccess:true,req})
    await req.payload.delete({collection:'visits',id:visit.id,overrideAccess:true,req})
    return true
   })
   if(deleted){processed++;progressed=true}
  }
  if(!progressed)break
 }
 return{eligible,processed}
}
async function expireGrants(payload:Payload,now:string,apply:boolean){
 const eligible=await count(payload,'analytics-grants','expiresAt',now)
 if(!apply)return{eligible,processed:0}
 let processed=0
 while(true){
  const rows=await listExpired<ExpiringRecord&{tokenHash:string}> (payload,'analytics-grants','expiresAt',now)
  if(!rows.length)break
  let progressed=false
  for(const grant of rows){
   const deleted=await atomic(payload,async req=>{
    await serial(req,`analytics-grant:${grant.tokenHash}`)
    const current=await req.payload.findByID({collection:'analytics-grants',id:grant.id,depth:0,overrideAccess:true,req}).catch(()=>null)
    if(!current||Date.parse(current.expiresAt)>=Date.parse(now))return false
    const visits=await req.payload.count({collection:'visits',where:{grant:{equals:grant.id}},overrideAccess:true,req})
    if(visits.totalDocs)return false
    await req.payload.delete({collection:'analytics-grants',id:grant.id,overrideAccess:true,req})
    return true
   })
   if(deleted){processed++;progressed=true}
  }
  if(!progressed)break
 }
 return{eligible,processed}
}
async function clearExpiredAttributionContexts(payload:Payload,now:string,apply:boolean){
 const candidates=await count(payload,'analytics-grants','attributionExpiresAt',now)
 if(!apply)return{candidates,processed:0}
 let processed=0,page=1
 while(true){
  const rows=(await payload.find({collection:'analytics-grants',where:{attributionExpiresAt:{less_than:now}},sort:'attributionExpiresAt',limit:BATCH,page,depth:0,overrideAccess:true})).docs
  if(!rows.length)break
  for(const grant of rows){
   if(grant.firstTouch||grant.lastNonDirectTouch){
    const cleared=await atomic(payload,async req=>{
     await serial(req,`analytics-grant:${grant.tokenHash}`)
     const current=await req.payload.findByID({collection:'analytics-grants',id:grant.id,depth:0,overrideAccess:true,req}).catch(()=>null)
     if(!current||Date.parse(current.attributionExpiresAt??'9999-12-31T00:00:00.000Z')>=Date.parse(now)||(!current.firstTouch&&!current.lastNonDirectTouch))return false
     await req.payload.update({collection:'analytics-grants',id:current.id,data:{firstTouch:null,lastNonDirectTouch:null},overrideAccess:true,req})
     return true
    })
    if(cleared)processed++
   }
  }
  if(rows.length<BATCH)break
  page++
 }
 return{candidates,processed}
}
async function expireLimits(payload:Payload,now:string,apply:boolean){
 const collections=['analytics-limits','request-limits'] as const
 let eligible=0,processed=0
 for(const collection of collections){
  eligible+=await count(payload,collection,'expiresAt',now)
  if(!apply)continue
  while(true){
   const rows=await listExpired<ExpiringRecord>(payload,collection,'expiresAt',now)
   if(!rows.length)break
   for(const row of rows){await payload.delete({collection,id:row.id,overrideAccess:true});processed++}
  }
 }
 return{eligible,processed}
}
/** Aggregate and expire only consented analytics older than the documented 90-day window. */
export async function runAnalyticsRetention(payload:Payload,options:{now?:number;apply?:boolean}={}){
 const now=options.now??Date.now(),apply=options.apply===true
 const cutoff=new Date(now-RETENTION_DAYS*DAY).toISOString(),nowISO=new Date(now).toISOString()
 const pageViews=await count(payload,'page-views','occurredAt',cutoff)
 const checkoutClicks=await count(payload,'checkout-clicks','occurredAt',cutoff)
 const limits=await count(payload,'analytics-limits','expiresAt',nowISO)+await count(payload,'request-limits','expiresAt',nowISO)
 let processedPageViews=0,processedClicks=0,aggregatesUpdated=0
 if(apply){
  for(const [collection,kind] of [['page-views','page_view'],['checkout-clicks','checkout_click']] as const){
   while(true){
    const rows=await listExpired<EventRecord>(payload,collection,'occurredAt',cutoff)
    if(!rows.length)break
    for(const row of rows){await aggregateAndDelete(payload,collection,kind,row);aggregatesUpdated++;if(kind==='page_view')processedPageViews++;else processedClicks++}
   }
  }
 }
 const contexts=await clearExpiredAttributionContexts(payload,nowISO,apply)
 const visits=await expireVisits(payload,cutoff,apply)
 const expiredGrants=await expireGrants(payload,nowISO,apply)
 const expiredLimits=await expireLimits(payload,nowISO,apply)
 return{
  mode:apply?'applied' as const:'preview' as const,cutoff,
  candidates:{pageViews,checkoutClicks,visits:visits.eligible,attributionContexts:contexts.candidates,grants:expiredGrants.eligible,limits},
  processed:{pageViews:processedPageViews,checkoutClicks:processedClicks,visits:visits.processed,attributionContexts:contexts.processed,grants:expiredGrants.processed,limits:expiredLimits.processed},
  aggregatesUpdated,
 } satisfies AnalyticsRetentionReport
}
