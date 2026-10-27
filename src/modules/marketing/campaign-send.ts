import {captureSendRecipients,readSendRecipients} from './send-recipients'
import { enqueueCampaignObservation } from './campaign-observation-queue'
import { randomUUID } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'
import type { BrevoCampaignSend } from '../../payload-types'
import { configuredBrevoCampaignDispatch, type BrevoCampaignDispatch, type CampaignDispatchResult } from '../../integrations/brevo/campaign-dispatch'
import { configuredBrevoCampaigns } from '../../integrations/brevo/campaigns'
import { prepareBrevoBatchCampaign } from './batch-campaigns'
import { reviewCampaignPrerequisites } from './campaign-prerequisites'
import { campaignCopy, draftHash, readDraftSpec } from './campaign-copy'
import { reservePreparedPromotionBatch } from './batches'
import { readBatchMembers } from './batch-copy'
import { reviewPromotion } from './sequence'
import { idOf } from './sequence-copy'
import { atomic, serial } from './transaction'
import { validLinkSecret } from './tokens'
import { PROVIDER_CHECK_TTL } from './batch-check-copy'
import { configuredQuotaPolicy, quotaWindow, validateQuotaPolicy, type QuotaPolicy } from './quota-policy'
import { readSendHistory, type SendAttempt } from './send-history'

type DraftOptions = NonNullable<Parameters<typeof prepareBrevoBatchCampaign>[2]>
export type CampaignSendOptions = Omit<DraftOptions,'adoptCampaignId'|'retryRejected'> & { dispatch?: BrevoCampaignDispatch | null; retryRejected?: boolean; policy?: QuotaPolicy }
const LEASE = 30 * 60_000
class RetryHeld extends Error { constructor(public state: 'held' | 'canceled') { super(state) } }
function historyFor(job: BrevoCampaignSend) {
  const history = readSendHistory(job.history)
  if (!history || history.length !== job.attempts || history.length === 0 && !!job.attemptToken || history.length > 0 && history.at(-1)!.token !== job.attemptToken) throw new Error('Histórico de disparos inconsistente.')
  return history
}
/** Caller holds the send lock. Outcome and stage bookkeeping commit together. */
async function settleLocked(req: PayloadRequest, job: BrevoCampaignSend, token: string, result: CampaignDispatchResult, now: number) {
  if (job.attemptToken !== token) return { state:'held' as const }
  const history = historyFor(job), last = history.at(-1)
  if (!last) throw new Error('Tentativa de disparo ausente.')
  if (last.state === 'submitted' || last.state === 'rejected') return { state:last.state }
  await serial(req,`promotion-batch:${idOf(job.batch)}`)
  const batch = await req.payload.findByID({collection:'email-campaign-batches',id:idOf(job.batch),depth:0,overrideAccess:true,req})
  const members = readBatchMembers(batch.members)
  if (!members || batch.key !== job.batchKey || batch.recipientCount !== job.recipientCount) throw new Error('Referências do disparo inconsistentes.')
  for (const contact of [...new Set(members.map(member=>member.contact))].sort()) await serial(req,`contact:${contact}`)
  const settledAt = new Date(Math.max(now,Date.parse(last.issuedAt),Date.parse(last.settledAt||last.issuedAt))).toISOString()
  const outcome: SendAttempt = {...last,state:result.state,settledAt,...('code' in result?{code:result.code}:{})}
  history[history.length-1]=outcome
  const effectiveState=job.state==='observed'?'observed' as const:result.state
  await req.payload.update({collection:'brevo-campaign-sends',id:job.id,data:{state:effectiveState,history,settledAt,responseCode:'code' in result?result.code:null,errorCode:effectiveState==='observed'||result.state==='submitted'?null:result.state==='rejected'?'provider_rejected':'uncertain_delivery'},overrideAccess:true,req})
  await req.payload.update({collection:'email-campaign-batches',id:batch.id,data:{state:effectiveState==='observed'||result.state==='submitted'?'claimed':result.state,errorCode:effectiveState==='observed'||result.state==='submitted'?null:result.state==='rejected'?'provider_rejected':'uncertain_delivery'},overrideAccess:true,req})
  for (const member of members) {
    const stage = await req.payload.findByID({collection:'promotion-deliveries',id:member.delivery,depth:0,overrideAccess:true,req})
    if (!stage.batch || idOf(stage.batch)!==batch.id || idOf(stage.contact)!==member.contact) throw new Error('Etapa do disparo inconsistente.')
    if (stage.state==='sending'||stage.state==='uncertain') await req.payload.update({collection:'promotion-deliveries',id:stage.id,data:{state:effectiveState==='observed'?'observed':result.state==='submitted'?'accepted':result.state,errorCode:effectiveState==='observed'||result.state==='submitted'?null:result.state==='rejected'?'provider_rejected':'uncertain_delivery'},overrideAccess:true,req})
  }
  return {state:effectiveState}
}
/** Each POST is preceded by one committed quota reservation and immutable attempt token. */
export async function dispatchBrevoBatchCampaign(payload: Payload,batchId:string,options:CampaignSendOptions={}) {
  const dispatch=options.dispatch===undefined?configuredBrevoCampaignDispatch():options.dispatch
  const campaigns=options.campaigns===undefined?configuredBrevoCampaigns():options.campaigns
  const secret=options.secret??process.env.LEAD_TOKEN_SECRET,origin=options.origin??process.env.PUBLIC_SITE_URL
  if (!dispatch||!campaigns||!validLinkSecret(secret)||!origin) return {state:'disabled' as const}
  const policy=validateQuotaPolicy(options.policy??configuredQuotaPolicy()),clock=options.clock??(options.now===undefined?Date.now:()=>options.now!)
  const leaseToken=randomUUID()
  let preparation
  try { preparation=await atomic(payload,async req=>{
    await serial(req,`brevo-send:${batchId}`)
    let job=(await payload.find({collection:'brevo-campaign-sends',where:{batch:{equals:batchId}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
    if (job) {
      const history=historyFor(job)
      if (job.state==='issuing') {
        if (job.issuedAt&&Date.parse(job.issuedAt)<=clock()-LEASE) return settleLocked(req,job,job.attemptToken!,{state:'uncertain'},clock())
        return {state:'held' as const}
      }
      if (job.state==='rejected'&&options.retryRejected) {
        const observation=(await payload.find({collection:'brevo-campaign-observations',where:{send:{equals:job.id}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
        if(observation?.activityObservedAt||observation?.leaseToken&&observation.startedAt&&Date.parse(observation.startedAt)>clock()-LEASE)return{state:'held' as const}
        if (history.at(-1)?.state!=='rejected') throw new Error('Retentativa exige recusa confirmada.')
        await serial(req,`promotion-batch:${batchId}`)
        const batch=await payload.findByID({collection:'email-campaign-batches',id:batchId,depth:0,overrideAccess:true,req}),members=readBatchMembers(batch.members)
        if (batch.state!=='rejected'||batch.key!==job.batchKey||!members) throw new Error('Retentativa não corresponde ao lote recusado.')
        for (const contact of [...new Set(members.map(member=>member.contact))].sort()) await serial(req,`contact:${contact}`)
        for (const member of members) {
          const stage=await payload.findByID({collection:'promotion-deliveries',id:member.delivery,depth:0,overrideAccess:true,req})
          if (stage.state!=='rejected'||!stage.batch||idOf(stage.batch)!==batchId||idOf(stage.contact)!==member.contact) throw new RetryHeld('canceled')
          const review=await reviewPromotion(req,stage,clock(),secret)
          if (review.state!=='ready') throw new RetryHeld(review.state==='canceled'?'canceled':'held')
        }
        await payload.update({collection:'email-campaign-batches',id:batchId,data:{state:'prepared',providerCheck:null,preferenceCheck:null,errorCode:null,nextAttemptAt:new Date(clock()).toISOString()},overrideAccess:true,req})
        job=await payload.update({collection:'brevo-campaign-sends',id:job.id,data:{state:'preparing',retryRequestedAt:new Date(clock()).toISOString(),nextAttemptAt:new Date(clock()).toISOString()},depth:0,overrideAccess:true,req})
      } else if (job.state!=='preparing') return {state:job.state}
      if (Date.parse(job.nextAttemptAt)>clock()||job.leaseToken&&job.prepareStartedAt&&Date.parse(job.prepareStartedAt)>clock()-LEASE) return {state:'held' as const}
      job=await payload.update({collection:'brevo-campaign-sends',id:job.id,data:{leaseToken,prepareStartedAt:new Date(clock()).toISOString(),errorCode:null},depth:0,overrideAccess:true,req})
    } else {
      if (options.retryRejected) throw new Error('Retentativa exige solicitação recusada existente.')
      await serial(req,`promotion-batch:${batchId}`)
      const batch=await payload.findByID({collection:'email-campaign-batches',id:batchId,depth:0,overrideAccess:true,req})
      if (batch.state!=='prepared'||Date.parse(batch.nextAttemptAt)>clock()) return {state:'held' as const}
      job=await payload.create({collection:'brevo-campaign-sends',data:{batch:batchId,batchKey:batch.key,recipientCount:batch.recipientCount,attempts:0,history:[],state:'preparing',leaseToken,prepareStartedAt:new Date(clock()).toISOString(),nextAttemptAt:new Date(clock()).toISOString()},depth:0,overrideAccess:true,req})
    }
    return {state:'prepare' as const,job}
  }) } catch(error) { if(error instanceof RetryHeld)return {state:error.state};throw error }
  if (preparation.state!=='prepare') return preparation
  const prepared=preparation.job
  async function hold(state:string) {
    return atomic(payload,async req=>{
      await serial(req,`brevo-send:${batchId}`)
      const job=await payload.findByID({collection:'brevo-campaign-sends',id:prepared.id,depth:0,overrideAccess:true,req})
      if (job.leaseToken!==leaseToken) return {state:'held' as const}
      await payload.update({collection:'brevo-campaign-sends',id:job.id,data:{state:state==='canceled'?'canceled':'preparing',leaseToken:null,errorCode:state==='canceled'?'local_ineligible':'prerequisites',nextAttemptAt:new Date(clock()+60_000).toISOString()},overrideAccess:true,req})
      return {state:state==='canceled'?'canceled' as const:'held' as const}
    })
  }
  let draft:Awaited<ReturnType<typeof prepareBrevoBatchCampaign>>
  try {draft=await prepareBrevoBatchCampaign(payload,batchId,{...options,campaigns,secret,origin,clock,retryRejected:undefined})} catch {return hold('held')}
  if (draft.state!=='ready') return hold(draft.state)
  const claim=await atomic(payload,async req=>{
    await serial(req,`brevo-send:${batchId}`)
    const job=await payload.findByID({collection:'brevo-campaign-sends',id:prepared.id,depth:0,overrideAccess:true,req})
    if (job.state!=='preparing'||job.leaseToken!==leaseToken) return {state:'held' as const}
    await serial(req,`brevo-campaign:${batchId}`)
    const review=await reviewCampaignPrerequisites(req,batchId,secret,clock())
    if (review.state!=='ready') {
      await payload.update({collection:'brevo-campaign-sends',id:job.id,data:{state:review.state==='canceled'?'canceled':'preparing',leaseToken:null,errorCode:review.state==='canceled'?'local_ineligible':'prerequisites',nextAttemptAt:new Date(clock()+60_000).toISOString()},overrideAccess:true,req})
      return {state:review.state==='canceled'?'canceled' as const:'held' as const}
    }
    const manifest=(await payload.find({collection:'brevo-campaign-drafts',where:{batch:{equals:batchId}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
    const spec=manifest&&readDraftSpec(manifest.content),at=Date.parse(manifest?.verifiedAt||'')
    const expected=campaignCopy(batchId,review.batch.copy,origin,campaigns.senderId,review.listId)
    if (!manifest||!spec||manifest.state!=='ready'||!manifest.providerCampaignId||manifest.contentHash!==draftHash(spec)||manifest.contentHash!==draftHash(expected)||!Number.isFinite(at)||at>clock()||clock()-at>PROVIDER_CHECK_TTL||job.batchKey!==review.batch.key||job.recipientCount!==review.batch.recipientCount||job.attempts>0&&(job.providerCampaignId!==manifest.providerCampaignId||job.contentHash!==manifest.contentHash)) throw new Error('Rascunho diverge da solicitação de disparo.')
    const recipientIdentities=captureSendRecipients(review.batch.members,review.recipients,secret)
    if(job.attempts>0&&JSON.stringify(readSendRecipients(job.recipientIdentities))!==JSON.stringify(recipientIdentities)) throw new Error('Identidade do disparo anterior não pode ser alterada.')
    const reserved=await reservePreparedPromotionBatch(req,review,clock(),policy)
    if (reserved.state!=='claimed') {
      await payload.update({collection:'brevo-campaign-sends',id:job.id,data:{leaseToken:null,errorCode:reserved.state==='quota'?'quota':'prerequisites',nextAttemptAt:reserved.state==='quota'?quotaWindow(clock()).nextDayAt:new Date(clock()+60_000).toISOString()},overrideAccess:true,req})
      return reserved
    }
    const token=randomUUID(),issuedAt=new Date(clock()).toISOString(),history=historyFor(job)
    if (history.length&&!['rejected'].includes(history.at(-1)!.state)) throw new Error('Tentativa anterior não permite novo disparo.')
    const attempt:SendAttempt={number:history.length+1,token,issuedAt,quotaDay:quotaWindow(clock()).day,count:review.batch.recipientCount,state:'issuing'}
    history.push(attempt)
    await payload.update({collection:'brevo-campaign-sends',id:job.id,data:{recipientIdentities,draft:manifest.id,contentHash:manifest.contentHash,providerCampaignId:manifest.providerCampaignId,attempts:history.length,attemptToken:token,history,state:'issuing',issuedAt,settledAt:null,responseCode:null,errorCode:null,leaseToken:null},overrideAccess:true,req})
    await enqueueCampaignObservation(req,job.id,token,clock())
    return {state:'issue' as const,token,campaignId:manifest.providerCampaignId}
  }).catch(()=>hold('held'))
  if (claim.state!=='issue') return claim
  let result:CampaignDispatchResult
  try {result=await dispatch.sendNow(claim.campaignId)} catch {result={state:'uncertain'}}
  if (!(result?.state==='submitted'&&result.code===204||result?.state==='rejected'&&[400,402,404].includes(result.code))) result={state:'uncertain'}
  return atomic(payload,async req=>{
    await serial(req,`brevo-send:${batchId}`)
    const job=await payload.findByID({collection:'brevo-campaign-sends',id:prepared.id,depth:0,overrideAccess:true,req})
    return settleLocked(req,job,claim.token,result,clock())
  })
}

/** One new campaign per cycle; abandoned issued intents become uncertain, never another POST. */
export async function dispatchPromotionCampaigns(payload:Payload,options:CampaignSendOptions={}) {
  const dispatch=options.dispatch===undefined?configuredBrevoCampaignDispatch():options.dispatch
  if (!dispatch) return {state:'disabled' as const}
  const now=options.clock?.()??options.now??Date.now()
  const stale=await payload.find({collection:'brevo-campaign-sends',where:{and:[{state:{equals:'issuing'}},{issuedAt:{less_than_equal:new Date(now-LEASE).toISOString()}}]},limit:10,depth:0,overrideAccess:true})
  for (const item of stale.docs) await dispatchBrevoBatchCampaign(payload,idOf(item.batch),{...options,dispatch,retryRejected:false})
  const batches=await payload.find({collection:'email-campaign-batches',where:{and:[{state:{equals:'prepared'}},{nextAttemptAt:{less_than_equal:new Date(now).toISOString()}}]},sort:'nextAttemptAt',limit:20,depth:0,overrideAccess:true})
  for (const batch of batches.docs) {
    const result=await dispatchBrevoBatchCampaign(payload,batch.id,{...options,dispatch,retryRejected:false})
    if (result.state!=='held') return result
  }
  return {state:'empty' as const}
}
