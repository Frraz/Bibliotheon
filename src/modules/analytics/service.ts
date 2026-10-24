import {resolveCheckout} from '../commerce/resolve'
import {createHash,randomBytes} from 'node:crypto'
import type {Payload,PayloadRequest} from 'payload'
import type {AnalyticsGrant} from '../../payload-types'
import {atomic,serial} from '../marketing/transaction'
import {published} from '../catalog/publication'
import {controlledCode,type PageEvent,type Utms} from './validation'
const IDLE=30*60_000,WINDOW=30*86400_000,GRANT=180*86400_000
export const CONSENT_VERSION='medicao-opcional-v1'
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex')
export const validToken=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value)
export class AnalyticsError extends Error{constructor(public status:number,public code:string){super(code)}}
async function grantLocked(req:PayloadRequest,token:string|undefined,now:number){
 if(!validToken(token))return null
 const hash=tokenHash(token);await serial(req,`analytics-grant:${hash}`)
 const grant=(await req.payload.find({collection:'analytics-grants',where:{tokenHash:{equals:hash}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
 return grant&&!grant.revokedAt&&Date.parse(grant.expiresAt)>now&&grant.consentVersion===CONSENT_VERSION?grant:null
}
export async function consentStatus(payload:Payload,token:string|undefined,now=Date.now()){
 if(!validToken(token))return false
 return atomic(payload,async req=>!!await grantLocked(req,token,now))
}
async function limit(req:PayloadRequest,key:string,max:number,expires:number){
 await serial(req,`analytics-limit:${key}`)
 const row=(await req.payload.find({collection:'analytics-limits',where:{key:{equals:key}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
 if((row?.count??0)>=max)throw new AnalyticsError(429,'rate_limited')
 if(row)await req.payload.update({collection:'analytics-limits',id:row.id,data:{count:row.count+1},overrideAccess:true,req})
 else await req.payload.create({collection:'analytics-limits',data:{key,count:1,expiresAt:new Date(expires).toISOString()},overrideAccess:true,req})
}
export async function chooseConsent(payload:Payload,choice:'accept'|'reject',token:string|undefined,now=Date.now()){
 return atomic(payload,async req=>{
  const grant=await grantLocked(req,token,now)
  if(choice==='reject'){
   if(grant)await payload.update({collection:'analytics-grants',id:grant.id,data:{revokedAt:new Date(now).toISOString(),currentVisit:null},overrideAccess:true,req})
   return{choice:'rejected' as const}
  }
  if(grant)return{choice:'granted' as const,token:token!,expiresAt:grant.expiresAt}
  const minute=Math.floor(now/60_000);await limit(req,`grants:${minute}`,120,(minute+1)*60_000)
  const raw=randomBytes(32).toString('base64url'),expiresAt=new Date(now+GRANT).toISOString()
  await payload.create({collection:'analytics-grants',data:{tokenHash:tokenHash(raw),consentVersion:CONSENT_VERSION,grantedAt:new Date(now).toISOString(),expiresAt},overrideAccess:true,req})
  return{choice:'granted' as const,token:raw,expiresAt}
 })
}
export async function campaignContext(req:PayloadRequest,code:string|undefined,utms:Utms|undefined,now:number){
 if(!code||!controlledCode(code))return null
 const campaign=(await req.payload.find({collection:'campaigns',where:{code:{equals:code}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
 if(!campaign||campaign.state!=='active'||campaign.startsAt&&Date.parse(campaign.startsAt)>now||campaign.endsAt&&Date.parse(campaign.endsAt)<=now)return null
 try{await resolveCheckout(typeof campaign.offer==='string'?campaign.offer:campaign.offer.id,code,{payload:req.payload,req,now})}catch{return null}
 const registered:Utms={campaign:campaign.code}
 const fields={source:'utmSource',medium:'utmMedium',content:'utmContent',term:'utmTerm'} as const
 for(const key of ['source','medium','content','term'] as const){const value=campaign[fields[key]];if(value){if(!controlledCode(value))return null;registered[key]=value}}
 if(utms&&Object.entries(utms).some(([key,value])=>registered[key as keyof Utms]!==value))return null
 return{kind:'campaign' as const,campaign:campaign.id,ebook:typeof campaign.ebook==='string'?campaign.ebook:campaign.ebook.id,utms:registered,occurredAt:new Date(now).toISOString()}
}
async function session(req:PayloadRequest,grant:AnalyticsGrant,touch:Awaited<ReturnType<typeof campaignContext>>,now:number){
 const {payload}=req,at=new Date(now).toISOString(),fresh=!grant.attributionExpiresAt||Date.parse(grant.attributionExpiresAt)<=now
 const first=fresh?touch||{kind:'direct',occurredAt:at}:grant.firstTouch||touch||{kind:'direct',occurredAt:at},last=touch||(fresh?null:grant.lastNonDirectTouch)
 let visit=grant.currentVisit?(await payload.find({collection:'visits',where:{id:{equals:typeof grant.currentVisit==='string'?grant.currentVisit:grant.currentVisit.id}},limit:1,depth:0,overrideAccess:true,req})).docs[0]:undefined
 if(visit&&(typeof visit.grant==='string'?visit.grant:visit.grant.id)!==grant.id)throw new Error('Sessão divergente.')
 if(!visit||Date.parse(visit.expiresAt)<=now)visit=await payload.create({collection:'visits',data:{grant:grant.id,startedAt:at,lastSeenAt:at,expiresAt:new Date(now+IDLE).toISOString(),firstTouch:first,lastNonDirectTouch:last},depth:0,overrideAccess:true,req})
 else visit=await payload.update({collection:'visits',id:visit.id,data:{lastSeenAt:at,expiresAt:new Date(now+IDLE).toISOString(),firstTouch:first,lastNonDirectTouch:last},depth:0,overrideAccess:true,req})
 await payload.update({collection:'analytics-grants',id:grant.id,data:{currentVisit:visit.id,firstTouch:first,lastNonDirectTouch:last,...(fresh?{attributionExpiresAt:new Date(now+WINDOW).toISOString()}:{})},overrideAccess:true,req})
 return{visit,first,last}
}
async function publicPage(req:PayloadRequest,path:string){
 const [,root,slug]=path.split('/');if(!slug)return{ebook:undefined as string|undefined}
 const collection=({ebooks:'ebooks',artigos:'articles',temas:'themes',amostras:'lead-magnets'} as const)[root as 'ebooks'|'artigos'|'temas'|'amostras'];if(!collection)return null
 const row=(await req.payload.find({collection,where:{and:[{slug:{equals:slug}},...(collection==='ebooks'||collection==='articles'||collection==='themes'?[published]:collection==='lead-magnets'?[{active:{equals:true}}]:[])]},limit:1,depth:0,draft:false,overrideAccess:true,req})).docs[0]
 if(!row)return null
 if(collection==='lead-magnets'&&'ebook'in row){const book=typeof row.ebook==='string'?row.ebook:row.ebook?.id;if(!book||!(await req.payload.count({collection:'ebooks',where:{and:[published,{id:{equals:book}}]},overrideAccess:true,req})).totalDocs)return null}
 return{ebook:collection==='ebooks'?row.id:'ebook'in row?typeof row.ebook==='string'?row.ebook:row.ebook?.id:undefined}
}
export async function recordPageView(payload:Payload,input:PageEvent,token:string|undefined,now=Date.now()){
 return atomic(payload,async req=>{
  const grant=await grantLocked(req,token,now);if(!grant)return{state:'unmeasured' as const}
  const key=createHash('sha256').update(`${grant.id}:${input.eventId}`).digest('hex')
  if((await payload.count({collection:'page-views',where:{key:{equals:key}},overrideAccess:true,req})).totalDocs)return{state:'duplicate' as const}
  const page=await publicPage(req,input.pagePath);if(!page)throw new AnalyticsError(400,'invalid_page')
  const minute=Math.floor(now/60_000);await limit(req,`events:${grant.id}:${minute}`,60,(minute+1)*60_000)
  const context=await campaignContext(req,input.campaignCode,input.utms,now),touch=context&&(!page.ebook||page.ebook===context.ebook)?context:null
  const measured=await session(req,grant,touch,now)
  await payload.create({collection:'page-views',data:{key,visit:measured.visit.id,pagePath:input.pagePath,ebook:page.ebook,campaign:touch?.campaign,utms:touch?.utms,occurredAt:new Date(now).toISOString()},overrideAccess:true,req})
  return{state:'recorded' as const}
 })
}
export type CheckoutMeasurement={offerID:string;ebookID:string;provider:'hotmart'|'kiwify'|'cakto';campaignID?:string}
export async function recordCheckoutClick(payload:Payload,target:CheckoutMeasurement,token:string|undefined,now=Date.now()){
 return atomic(payload,async req=>{
  const grant=await grantLocked(req,token,now)
  const campaign=grant&&target.campaignID?(await payload.find({collection:'campaigns',where:{id:{equals:target.campaignID}},depth:0,limit:1,overrideAccess:true,req})).docs[0]:null
  const touch=campaign?await campaignContext(req,campaign.code,undefined,now):null
  const measured=grant?await session(req,grant,touch,now):null
  await payload.create({collection:'checkout-clicks',data:{offer:target.offerID,ebook:target.ebookID,provider:target.provider,campaign:target.campaignID,visit:measured?.visit.id,attributionAllowed:!!grant,firstTouch:measured?.first,lastNonDirectTouch:measured?.last,occurredAt:new Date(now).toISOString()},overrideAccess:true,req})
  return{state:'recorded' as const}
 })
}
