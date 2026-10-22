import { randomUUID } from 'node:crypto'
import type { Payload } from 'payload'
import { configuredBrevoCampaigns, type BrevoCampaigns } from '../../integrations/brevo/campaigns'
import { configuredBrevoLists, type BrevoLists } from '../../integrations/brevo/lists'
import { configuredBrevoContacts, type BrevoContacts } from '../../integrations/brevo/contacts'
import { configuredBrevoPreferences, type BrevoPreferences } from '../../integrations/brevo/preferences'
import { prepareBrevoBatchList } from './batch-lists'
import { prepareBrevoBatchPreferences } from './batch-preferences'
import { reviewCampaignPrerequisites } from './campaign-prerequisites'
import { campaignCopy, draftHash, readDraftSpec } from './campaign-copy'
import { atomic, serial } from './transaction'
import { validLinkSecret } from './tokens'
import { PROVIDER_CHECK_TTL } from './batch-check-copy'

const LEASE=30*60_000, positive=(id:number)=>Number.isSafeInteger(id)&&id>0
/** Creates or reconciles a draft only; does not claim quota, schedule or send. */
export async function prepareBrevoBatchCampaign(payload:Payload,batchId:string,options:{campaigns?:BrevoCampaigns|null;lists?:BrevoLists|null;contacts?:BrevoContacts|null;preferences?:BrevoPreferences|null;secret?:string;origin?:string;now?:number;clock?:()=>number;adoptCampaignId?:number;retryRejected?:boolean}={}){
  const campaigns=options.campaigns===undefined?configuredBrevoCampaigns():options.campaigns
  const lists=options.lists===undefined?configuredBrevoLists():options.lists,contacts=options.contacts===undefined?configuredBrevoContacts():options.contacts,preferences=options.preferences===undefined?configuredBrevoPreferences():options.preferences
  const secret=options.secret??process.env.LEAD_TOKEN_SECRET,origin=options.origin??process.env.PUBLIC_SITE_URL
  if(!campaigns||!lists||!contacts||!preferences||!validLinkSecret(secret)||!origin)return{state:'disabled' as const}
  if(options.adoptCampaignId!==undefined&&!positive(options.adoptCampaignId))throw new Error('Identificador de campanha inválido.')
  const clock=options.clock??(options.now===undefined?Date.now:()=>options.now!)
  async function cancelExisting(){
    await atomic(payload,async req=>{
      await serial(req,`brevo-campaign:${batchId}`)
      const existing=(await payload.find({collection:'brevo-campaign-drafts',where:{batch:{equals:batchId}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
      if(existing)await payload.update({collection:'brevo-campaign-drafts',id:existing.id,data:{state:'canceled',leaseToken:null,verifiedAt:null,errorCode:'local_ineligible'},overrideAccess:true,req})
    })
  }
  const list=await prepareBrevoBatchList(payload,batchId,{lists,contacts,secret,clock})
  if(list.state!=='ready'){if(list.state==='canceled')await cancelExisting();return list}
  const links=await prepareBrevoBatchPreferences(payload,batchId,{contacts,preferences,secret,origin,clock})
  if(links.state!=='ready'){if(links.state==='canceled')await cancelExisting();return links}
  const claim=await atomic(payload,async req=>{
    await serial(req,`brevo-campaign:${batchId}`)
    const reviewed=await reviewCampaignPrerequisites(req,batchId,secret,clock())
    if(reviewed.state!=='ready')return reviewed
    const spec=campaignCopy(batchId,reviewed.batch.copy,origin,campaigns.senderId,reviewed.listId),hash=draftHash(spec)
    let job=(await payload.find({collection:'brevo-campaign-drafts',where:{batch:{equals:batchId}},depth:0,limit:1,overrideAccess:true,req})).docs[0]
    const token=randomUUID()
    if(job){
      if(job.leaseToken&&job.startedAt&&Date.parse(job.startedAt)>clock()-LEASE)return{state:'held' as const}
      if(!Array.isArray(job.observedIds)||job.observedIds.some(id=>typeof id!=='number'||!positive(id)))throw new Error('Inventário de campanhas inconsistente.')
      if(job.observedIds.length>1)return{state:'failed' as const}
      const existing=readDraftSpec(job.content)
      if(!existing||draftHash(existing)!==job.contentHash||job.name!==spec.name)throw new Error('Manifesto de campanha inconsistente.')
      const retryAllowed=job.state==='failed'&&job.errorCode==='creation_rejected'&&!job.providerCampaignId
      if(options.retryRejected&&!retryAllowed)throw new Error('Retentativa exige criação explicitamente recusada sem ID.')
      if(retryAllowed&&!options.retryRejected&&!options.adoptCampaignId)return{state:'failed' as const}
      if(job.contentHash!==hash&&!options.retryRejected)throw new Error('Configuração da campanha mudou; revisão necessária.')
      if(['failed','uncertain'].includes(job.state)&&Date.parse(job.nextAttemptAt)>clock()&&!options.adoptCampaignId&&!options.retryRejected)return{state:'held' as const}
      job=await payload.update({collection:'brevo-campaign-drafts',id:job.id,data:{leaseToken:token,startedAt:new Date(clock()).toISOString(),verifiedAt:null,...(options.retryRejected?{content:spec,contentHash:hash,creationIssuedAt:null,state:'creating' as const}:{})},depth:0,overrideAccess:true,req})
    }else {
      if(options.retryRejected)throw new Error('Retentativa exige manifesto de criação recusada.')
      job=await payload.create({collection:'brevo-campaign-drafts',data:{batch:batchId,name:spec.name,content:spec,contentHash:hash,state:'creating',leaseToken:token,observedIds:[],startedAt:new Date(clock()).toISOString(),nextAttemptAt:new Date(clock()).toISOString()},depth:0,overrideAccess:true,req})
    }
    return{state:'processing' as const,job,spec,token}
  })
  if(claim.state!=='processing')return claim
  const leaseToken=claim.token
  let job=claim.job
  type Problem='provider_unavailable'|'provider_rejected'|'creation_rejected'|'creation_uncertain'|'campaign_conflict'|'local_ineligible'
  async function finish(state:'uncertain'|'failed'|'canceled',errorCode:Problem){
    return atomic(payload,async req=>{
      await serial(req,`brevo-campaign:${batchId}`)
      const current=await payload.findByID({collection:'brevo-campaign-drafts',id:job.id,depth:0,overrideAccess:true,req})
      if(current.leaseToken!==leaseToken)return{state:'held' as const}
      const reviewed=await reviewCampaignPrerequisites(req,batchId,secret!,clock())
      if(reviewed.state==='canceled'){state='canceled';errorCode='local_ineligible'}
      await payload.update({collection:'brevo-campaign-drafts',id:job.id,data:{state,errorCode,leaseToken:null,verifiedAt:null,nextAttemptAt:new Date(clock()+900_000).toISOString()},overrideAccess:true,req})
      return{state}
    })
  }
  async function recordId(id:number){
    if(!positive(id))throw new Error('ID de campanha inválido.')
    return atomic(payload,async req=>{
      await serial(req,`brevo-campaign:${batchId}`)
      const current=await payload.findByID({collection:'brevo-campaign-drafts',id:job.id,depth:0,overrideAccess:true,req})
      const values=current.observedIds
      if(!Array.isArray(values)||values.some(v=>typeof v!=='number'||!positive(v)))throw new Error('Inventário de IDs inconsistente.')
      const ids=[...new Set([...values,id])]
      const other=await payload.count({collection:'brevo-campaign-drafts',where:{and:[{providerCampaignId:{equals:id}},{id:{not_equals:current.id}}]},overrideAccess:true,req})
      const conflict=!!other.totalDocs||!!current.providerCampaignId&&current.providerCampaignId!==id
      job=await payload.update({collection:'brevo-campaign-drafts',id:job.id,data:{observedIds:ids,...(!current.providerCampaignId&&!other.totalDocs?{providerCampaignId:id}:{}),...(conflict?{state:'failed' as const,errorCode:'campaign_conflict' as const,leaseToken:null,verifiedAt:null}:{})},depth:0,overrideAccess:true,req})
      return { retained: !conflict&&current.leaseToken===leaseToken, conflict }
    })
  }
  try{
    let id=job.providerCampaignId??options.adoptCampaignId
    if(job.providerCampaignId&&options.adoptCampaignId&&job.providerCampaignId!==options.adoptCampaignId)return finish('failed','campaign_conflict')
    if(!id){
      const found=await campaigns.find(job.name)
      if(found.state==='found'){
        if(!job.creationIssuedAt)return finish('failed','campaign_conflict')
        id=found.id
      }else if(found.state==='absent'&&!job.creationIssuedAt){
        const permitted=await atomic(payload,async req=>{
          await serial(req,`brevo-campaign:${batchId}`)
          const current=await payload.findByID({collection:'brevo-campaign-drafts',id:job.id,depth:0,overrideAccess:true,req})
          if(current.leaseToken!==leaseToken)return false
          const reviewed=await reviewCampaignPrerequisites(req,batchId,secret!,clock())
          if(reviewed.state!=='ready')return false
          job=await payload.update({collection:'brevo-campaign-drafts',id:job.id,data:{creationIssuedAt:new Date(clock()).toISOString()},depth:0,overrideAccess:true,req});return true
        })
        if(!permitted)return finish('uncertain','provider_unavailable')
        const created=await campaigns.create(claim.spec)
        if(created.state!=='created')return finish(created.state==='rejected'?'failed':'uncertain',created.state==='rejected'?'creation_rejected':'creation_uncertain')
        id=created.id
        const stored=await recordId(id)
        if(!stored.retained)return{state:stored.conflict?'failed' as const:'held' as const}
      }else return finish(found.state==='conflict'||found.state==='rejected'?'failed':'uncertain',found.state==='conflict'?'campaign_conflict':found.state==='rejected'?'provider_rejected':'creation_uncertain')
    }
    const observedAt=clock(),result=await campaigns.verify(id,claim.spec)
    if(result.state!=='verified')return finish(result.state==='conflict'||result.state==='rejected'?'failed':'uncertain',result.state==='conflict'?'campaign_conflict':'provider_unavailable')
    const stored=await recordId(id)
    if(!stored.retained)return{state:stored.conflict?'failed' as const:'held' as const}
    return atomic(payload,async req=>{
      await serial(req,`brevo-campaign:${batchId}`)
      const current=await payload.findByID({collection:'brevo-campaign-drafts',id:job.id,depth:0,overrideAccess:true,req})
      if(current.leaseToken!==leaseToken)return{state:'held' as const}
      const reviewed=await reviewCampaignPrerequisites(req,batchId,secret!,clock())
      const state=reviewed.state==='canceled'?'canceled':reviewed.state==='ready'&&observedAt<=clock()&&clock()-observedAt<=PROVIDER_CHECK_TTL?'ready':'uncertain'
      await payload.update({collection:'brevo-campaign-drafts',id:job.id,data:{state,leaseToken:null,errorCode:state==='ready'?null:state==='canceled'?'local_ineligible':'provider_unavailable',verifiedAt:state==='ready'?new Date(observedAt).toISOString():null,nextAttemptAt:new Date(clock()+900_000).toISOString()},overrideAccess:true,req})
      return{state,...(state==='ready'?{campaignId:id}:{})}
    })
  }catch{return finish('uncertain',job.providerCampaignId?'provider_unavailable':'creation_uncertain')}
}
