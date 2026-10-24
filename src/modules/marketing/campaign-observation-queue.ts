import type { PayloadRequest } from 'payload'
/** Called under the send lock, in the same transaction as the issued intent and quota. */
export async function enqueueCampaignObservation(req:PayloadRequest,send:string,token:string,now:number){
  const job=(await req.payload.find({collection:'brevo-campaign-observations',where:{send:{equals:send}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
  if(job?.activityObservedAt)throw new Error('Atividade já observada impede nova tentativa.')
  if(job?.leaseToken&&job.startedAt&&Date.parse(job.startedAt)>now-30*60_000)throw new Error('Consulta da tentativa anterior em andamento.')
  const data={attemptToken:token,state:'pending' as const,nextCheckAt:new Date(now).toISOString(),leaseToken:null,startedAt:null,checkedAt:null,lastStatus:null,errorCode:null}
  if(job)await req.payload.update({collection:'brevo-campaign-observations',id:job.id,data,overrideAccess:true,req})
  else await req.payload.create({collection:'brevo-campaign-observations',data:{send,...data},overrideAccess:true,req})
}
