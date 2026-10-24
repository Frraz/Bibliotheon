import type {PayloadRequest} from 'payload'
import {resolveCheckout} from '../commerce/resolve'
import {controlledCode} from './validation'
export async function campaignLink(req:PayloadRequest,id:string,now=Date.now()){
 if(req.user?.collection!=='admin-users'||req.user.role!=='owner')throw new Error('forbidden')
 const campaign=await req.payload.findByID({collection:'campaigns',id,depth:0,overrideAccess:false,req})
 if(!controlledCode(campaign.code))throw new Error('code')
 await resolveCheckout(typeof campaign.offer==='string'?campaign.offer:campaign.offer.id,campaign.code,{payload:req.payload,req,now})
 const book=await req.payload.findByID({collection:'ebooks',id:typeof campaign.ebook==='string'?campaign.ebook:campaign.ebook.id,depth:0,draft:false,overrideAccess:false,req})
 const url=new URL(`/ebooks/${book.slug}`,process.env.PUBLIC_SITE_URL||'http://localhost:3000');url.searchParams.set('c',campaign.code);url.searchParams.set('utm_campaign',campaign.code)
 for(const[key,field]of Object.entries({source:'utmSource',medium:'utmMedium',content:'utmContent',term:'utmTerm'} as const)){const value=campaign[field];if(value){if(!controlledCode(value))throw new Error('code');url.searchParams.set(`utm_${key}`,value)}}
 return url.toString()
}
export async function measurementSummary(req:PayloadRequest,now=Date.now()){
 const since=new Date(now-7*86400000).toISOString()
 const [visits,views,operationalClicks,consentedClicks]=await Promise.all([
 req.payload.count({collection:'visits',overrideAccess:false,req,where:{startedAt:{greater_than_equal:since}}}),
 req.payload.count({collection:'page-views',overrideAccess:false,req,where:{occurredAt:{greater_than_equal:since}}}),
 req.payload.count({collection:'checkout-clicks',overrideAccess:false,req,where:{occurredAt:{greater_than_equal:since}}}),
 req.payload.count({collection:'checkout-clicks',overrideAccess:false,req,where:{and:[{attributionAllowed:{equals:true}},{occurredAt:{greater_than_equal:since}}]}}),
 ])
 return{visits,views,operationalClicks,consentedClicks}
}
