import type {PayloadRequest,Where} from 'payload'
import {commercialProviders} from './events'
import {CommercialError} from './inbox'
import {COMMERCIAL_LEASE_MS} from './policy'
export const inboxFilters=['all','attention','pending','processing','needs_review','failed','applied','ignored'] as const
export type InboxFilters={provider:'all'|typeof commercialProviders[number];state:typeof inboxFilters[number];page:number;event?:string}
export function parseInboxFilters(input:Record<string,unknown>):InboxFilters{
 const provider=input.provider??'all',state=input.state??'attention',page=input.page??'1'
 if(input.event!==undefined&&(typeof input.event!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.event)))throw new CommercialError(422,'invalid_filters')
 if(typeof provider!=='string'||!['all',...commercialProviders].includes(provider)||typeof state!=='string'||!inboxFilters.includes(state as InboxFilters['state'])||typeof page!=='string'||!/^[1-9]\d{0,5}$/.test(page))throw new CommercialError(422,'invalid_filters')
 return{provider:provider as InboxFilters['provider'],state:state as InboxFilters['state'],page:Number(page),...(input.event?{event:input.event as string}:{})}
}
function requireOwner(req:PayloadRequest){if(req.user?.collection!=='admin-users'||req.user.role!=='owner')throw new CommercialError(403,'forbidden')}
const attentionWhere=(now:number):Where=>({or:[{state:{in:['needs_review','failed']}},{conflicted:{equals:true}},{and:[{state:{equals:'processing'}},{startedAt:{less_than_equal:new Date(now-COMMERCIAL_LEASE_MS).toISOString()}}]}]})
const outstandingWhere:Where={or:[{state:{in:['pending','processing','needs_review','failed']}},{conflicted:{equals:true}}]}
export async function commercialSummary(req:PayloadRequest,now=Date.now()){
 requireOwner(req)
 const providers=await Promise.all(commercialProviders.map(async provider=>{
  const count=async(where:Where)=>(await req.payload.count({collection:'commercial-inbox',where:{and:[{provider:{equals:provider}},where]},overrideAccess:false,req})).totalDocs
  const latest=async(field:'receivedAt'|'lastSuccessAt',where:Where={})=>{
   const row=(await req.payload.find({collection:'commercial-inbox',where:{and:[{provider:{equals:provider}},{[field]:{exists:true}},where]},sort:`-${field}`,limit:1,depth:0,select:{[field]:true},overrideAccess:false,req})).docs[0]
   return row?.[field]||null
  }
  const [pending,processing,attention,oldest,lastReceivedAt,lastSuccessAt]=await Promise.all([
   count({state:{equals:'pending'}}),count({state:{equals:'processing'}}),count(attentionWhere(now)),
   req.payload.find({collection:'commercial-inbox',where:{and:[{provider:{equals:provider}},outstandingWhere]},sort:['receivedAt','id'],limit:1,depth:0,select:{receivedAt:true},overrideAccess:false,req}),
   latest('receivedAt'),latest('lastSuccessAt'),
  ])
  return{provider,pending,processing,attention,oldestOutstandingAt:oldest.docs[0]?.receivedAt||null,lastReceivedAt,lastSuccessAt}
 }))
 return{observedAt:new Date(now).toISOString(),providers,totals:providers.reduce((a,p)=>({pending:a.pending+p.pending,processing:a.processing+p.processing,attention:a.attention+p.attention}),{pending:0,processing:0,attention:0})}
}
export async function commercialInboxPage(req:PayloadRequest,filters:InboxFilters,now=Date.now()){
 requireOwner(req)
 const and:Where[]=[]
 if(filters.event)and.push({id:{equals:filters.event}})
 if(filters.provider!=='all')and.push({provider:{equals:filters.provider}})
 if(filters.state==='attention')and.push(attentionWhere(now))
 else if(filters.state!=='all')and.push({state:{equals:filters.state}})
 const page=await req.payload.find({collection:'commercial-inbox',where:and.length?{and}:{},sort:['-receivedAt','-id'],page:filters.page,limit:20,depth:0,overrideAccess:false,req,
  select:{provider:true,accountKey:true,eventKey:true,state:true,receivedAt:true,startedAt:true,nextAttemptAt:true,lastSuccessAt:true,attempts:true,errorCode:true,conflicted:true},
 })
 if(filters.page>1&&filters.page>page.totalPages)throw new CommercialError(404,'invalid_page')
 return page
}
export function inboxPageLink(filters:InboxFilters,page=1){
 const query=new URLSearchParams({provider:filters.provider,state:filters.state,page:String(page)})
 if(filters.event)query.set('event',filters.event)
 return `/admin/commercial-inbox?${query}`
}
