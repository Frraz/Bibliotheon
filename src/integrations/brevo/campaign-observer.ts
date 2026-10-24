import { readDraftSpec, type DraftSpec } from '../../modules/marketing/campaign-copy'
import { campaignIdentityMatches } from './campaign-report'
// GET response enum, confirmed against the official SDK; query filters use a different spelling.
export const campaignStatuses=['draft','sent','archive','queued','suspended','in_process','in_review','cancelling','cancelled'] as const
export type CampaignStatus=typeof campaignStatuses[number]
export const activityStatus=(status:CampaignStatus):status is 'sent'|'queued'|'in_process'|'in_review'=>['sent','queued','in_process','in_review'].includes(status)
export const terminalStatus=(status:CampaignStatus)=>['sent','archive','cancelled'].includes(status)
export type CampaignObservationResult={state:'report';status:CampaignStatus;sentAt?:string}|{state:'absent'|'retry'|'rejected'|'conflict'|'unsupported'}
export type BrevoCampaignObserver={inspect(id:number,spec:DraftSpec):Promise<CampaignObservationResult>}
async function json(response:Response):Promise<unknown>{
  if(!response.body)throw new Error('Resposta inválida.')
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
  try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>131_072)throw new Error('Resposta inválida.');chunks.push(p.value)}return JSON.parse(Buffer.concat(chunks).toString('utf8'))}finally{await reader.cancel().catch(()=>{})}
}
/** GET only. No delivery statistics, identifiers, links or raw response leave this boundary. */
export function createBrevoCampaignObserver(key:string,request:typeof fetch=fetch):BrevoCampaignObserver{
  if(!key||key.startsWith('REPLACE_')||/[\x00-\x20\x7f]/.test(key))throw new Error('Configuração de observação inválida.')
  return{async inspect(id,spec){
    if(!Number.isSafeInteger(id)||id<1||!readDraftSpec(spec))return{state:'rejected'}
    try{
      const response=await request(`https://api.brevo.com/v3/emailCampaigns/${id}?statistics=globalStats`,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15_000),headers:{'api-key':key,Accept:'application/json'}})
      if(response.status!==200){await response.body?.cancel().catch(()=>{});return{state:response.status===404?'absent':response.status===429||response.status>=500||response.status<400?'retry':'rejected'}}
      const value=await json(response)
      if(!campaignIdentityMatches(value,id,spec))return{state:'conflict'}
      if(typeof value.status!=='string'||!campaignStatuses.includes(value.status as CampaignStatus))return{state:'unsupported'}
      let sentAt:string|undefined
      if(value.sentDate!==undefined&&value.sentDate!==null&&value.sentDate!==''){
        if(typeof value.sentDate!=='string'||!Number.isFinite(Date.parse(value.sentDate)))return{state:'retry'}
        sentAt=new Date(value.sentDate).toISOString()
      }
      return{state:'report',status:value.status as CampaignStatus,...(sentAt?{sentAt}:{})}
    }catch{return{state:'retry'}}
  }}
}
export function configuredBrevoCampaignObserver():BrevoCampaignObserver|null{
  if(process.env.BREVO_CAMPAIGN_OBSERVE_ENABLED!=='true')return null
  try{return createBrevoCampaignObserver(process.env.BREVO_API_KEY||'')}catch{return null}
}
