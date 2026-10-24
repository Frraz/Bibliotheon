import { randomUUID } from 'node:crypto'
import type { Payload } from 'payload'
import { configuredBrevoCampaignObserver, activityStatus, terminalStatus, type BrevoCampaignObserver, type CampaignObservationResult } from '../../integrations/brevo/campaign-observer'
import { readDraftSpec, draftHash } from './campaign-copy'
import { readSendHistory } from './send-history'
import { readBatchMembers } from './batch-copy'
import { idOf } from './sequence-copy'
import { atomic, serial } from './transaction'
const LEASE=30*60_000,INTERVAL=15*60_000
export type ObservationOptions={client?:BrevoCampaignObserver|null;now?:number;clock?:()=>number;refresh?:boolean}
/** Read-only provider reconciliation. Never changes HTTP history, consent or quota. */
export async function observeBrevoCampaign(payload:Payload,batchId:string,options:ObservationOptions={}){
  const client=options.client===undefined?configuredBrevoCampaignObserver():options.client
  if(!client)return{state:'disabled' as const}
  const clock=options.clock??(options.now===undefined?Date.now:()=>options.now!),leaseToken=randomUUID()
  const captured=await atomic(payload,async req=>{
    await serial(req,`brevo-observation:${batchId}`);await serial(req,`brevo-send:${batchId}`)
    const send=(await payload.find({collection:'brevo-campaign-sends',where:{batch:{equals:batchId}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
    if(!send)return{state:'absent' as const}
    if(!['issuing','submitted','uncertain','rejected','observed'].includes(send.state)||!send.attemptToken||!send.providerCampaignId||!send.draft)return{state:'held' as const}
    const history=readSendHistory(send.history)
    if(!history?.length||history.length!==send.attempts||history.at(-1)!.token!==send.attemptToken)throw new Error('Histórico de disparo inconsistente.')
    const draft=await payload.findByID({collection:'brevo-campaign-drafts',id:idOf(send.draft),depth:0,overrideAccess:true,req}),spec=readDraftSpec(draft.content)
    if(!spec||draftHash(spec)!==send.contentHash||draft.contentHash!==send.contentHash||draft.providerCampaignId!==send.providerCampaignId||idOf(draft.batch)!==batchId||spec.name!==`bibliotheon-${batchId}`)throw new Error('Identidade da campanha inconsistente.')
    let job=(await payload.find({collection:'brevo-campaign-observations',where:{send:{equals:send.id}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
    if(job){
      if(job.attemptToken!==send.attemptToken)throw new Error('Observação não corresponde à tentativa atual.')
      if(job.leaseToken&&job.startedAt&&Date.parse(job.startedAt)>clock()-LEASE)return{state:'held' as const}
      if(!options.refresh&&(!job.nextCheckAt||Date.parse(job.nextCheckAt)>clock()))return{state:'held' as const}
      job=await payload.update({collection:'brevo-campaign-observations',id:job.id,data:{state:'processing',leaseToken,startedAt:new Date(clock()).toISOString()},depth:0,overrideAccess:true,req})
    }else job=await payload.create({collection:'brevo-campaign-observations',data:{send:send.id,attemptToken:send.attemptToken,state:'processing',leaseToken,startedAt:new Date(clock()).toISOString(),nextCheckAt:new Date(clock()).toISOString()},depth:0,overrideAccess:true,req})
    return{state:'inspect' as const,sendId:send.id,jobId:job.id,token:send.attemptToken,campaignId:send.providerCampaignId,hash:send.contentHash,batchKey:send.batchKey,spec}
  })
  if(captured.state!=='inspect')return captured
  let result:CampaignObservationResult
  try{result=await client.inspect(captured.campaignId,captured.spec)}catch{result={state:'retry'}}
  return atomic(payload,async req=>{
    await serial(req,`brevo-observation:${batchId}`);await serial(req,`brevo-send:${batchId}`)
    const job=await payload.findByID({collection:'brevo-campaign-observations',id:captured.jobId,depth:0,overrideAccess:true,req})
    if(job.leaseToken!==leaseToken)return{state:'held' as const}
    const send=await payload.findByID({collection:'brevo-campaign-sends',id:captured.sendId,depth:0,overrideAccess:true,req})
    if(send.attemptToken!==captured.token||send.providerCampaignId!==captured.campaignId||send.contentHash!==captured.hash||send.batchKey!==captured.batchKey||['preparing','canceled'].includes(send.state)){
      await payload.update({collection:'brevo-campaign-observations',id:job.id,data:{state:'pending',leaseToken:null,nextCheckAt:new Date(clock()).toISOString()},overrideAccess:true,req});return{state:'held' as const}
    }
    const now=Math.max(clock(),Date.parse(job.checkedAt||job.startedAt||new Date(clock()).toISOString())),checkedAt=new Date(now).toISOString()
    if(!result||result.state!=='report'){
      const code=result?.state==='conflict'?'campaign_conflict':result?.state==='unsupported'?'unsupported_status':result?.state==='absent'?'provider_absent':result?.state==='rejected'?'provider_rejected':'provider_unavailable'
      await payload.update({collection:'brevo-campaign-observations',id:job.id,data:{state:code==='campaign_conflict'?'conflict':'failed',errorCode:code,leaseToken:null,checkedAt,nextCheckAt:new Date(now+INTERVAL).toISOString()},overrideAccess:true,req})
      return{state:'unresolved' as const}
    }
    if(activityStatus(result.status)){
      await serial(req,`promotion-batch:${batchId}`)
      const batch=await payload.findByID({collection:'email-campaign-batches',id:batchId,depth:0,overrideAccess:true,req}),members=readBatchMembers(batch.members)
      if(!members||batch.key!==send.batchKey||batch.recipientCount!==send.recipientCount)throw new Error('Referências da campanha divergentes.')
      for(const contact of [...new Set(members.map(member=>member.contact))].sort())await serial(req,`contact:${contact}`)
      await payload.update({collection:'brevo-campaign-sends',id:send.id,data:{state:'observed',errorCode:null},overrideAccess:true,req})
      await payload.update({collection:'email-campaign-batches',id:batchId,data:{state:'claimed',errorCode:null},overrideAccess:true,req})
      for(const member of members){
        const stage=await payload.findByID({collection:'promotion-deliveries',id:member.delivery,depth:0,overrideAccess:true,req})
        if(!stage.batch||idOf(stage.batch)!==batchId||idOf(stage.contact)!==member.contact)throw new Error('Etapa observada divergente.')
        if(['sending','uncertain','accepted','rejected'].includes(stage.state))await payload.update({collection:'promotion-deliveries',id:stage.id,data:{state:'observed',errorCode:null},overrideAccess:true,req})
      }
    }
    await payload.update({collection:'brevo-campaign-observations',id:job.id,data:{state:'matched',lastStatus:result.status,errorCode:null,leaseToken:null,checkedAt,nextCheckAt:terminalStatus(result.status)?null:new Date(now+INTERVAL).toISOString(),...(activityStatus(result.status)?{activityObservedAt:job.activityObservedAt||checkedAt,activityStatus:job.activityStatus==='sent'?'sent':result.status}:{}),...(result.status==='sent'?{sentObservedAt:job.sentObservedAt||checkedAt,...(result.sentAt?{providerSentAt:result.sentAt}:{})}:{})},overrideAccess:true,req})
    return{state:activityStatus(result.status)?'observed' as const:'unresolved' as const,status:result.status}
  })
}
export async function observePromotionCampaigns(payload:Payload,options:ObservationOptions&{limit?:number}={}){
  const client=options.client===undefined?configuredBrevoCampaignObserver():options.client
  if(!client)return{state:'disabled' as const}
  const limit=options.limit??10,now=options.clock?.()??options.now??Date.now()
  if(!Number.isInteger(limit)||limit<1||limit>25)throw new Error('Limite de observação inválido.')
  const due=await payload.find({collection:'brevo-campaign-observations',where:{and:[{nextCheckAt:{less_than_equal:new Date(now).toISOString()}},{or:[{state:{not_equals:'processing'}},{startedAt:{less_than_equal:new Date(now-LEASE).toISOString()}}]}]},sort:'nextCheckAt',limit,depth:1,overrideAccess:true})
  let examined=0
  for(const job of due.docs){const send=typeof job.send==='string'?await payload.findByID({collection:'brevo-campaign-sends',id:job.send,depth:0,overrideAccess:true}):job.send;await observeBrevoCampaign(payload,idOf(send.batch),{...options,client});examined++}
  return{state:'checked' as const,examined}
}
