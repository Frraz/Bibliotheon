import { campaignIdentityMatches } from './campaign-report'
import { readDraftSpec, type DraftSpec } from '../../modules/marketing/campaign-copy'
export type CampaignFailure = { state: 'absent' | 'retry' | 'rejected' | 'conflict' }
export type BrevoCampaigns = { senderId: number; find(name: string): Promise<{state:'found';id:number}|CampaignFailure>; create(spec: DraftSpec): Promise<{state:'created';id:number}|CampaignFailure>; verify(id:number,spec:DraftSpec):Promise<{state:'verified'}|CampaignFailure> }
const positive = (v:unknown):v is number => typeof v==='number'&&Number.isSafeInteger(v)&&v>0
const object = (v:unknown):v is Record<string,unknown> => !!v&&typeof v==='object'&&!Array.isArray(v)
async function json(response:Response):Promise<unknown>{
  if(!response.body)throw new Error('Resposta inválida.')
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
  try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>131_072)throw new Error('Resposta inválida.');chunks.push(p.value)}return JSON.parse(Buffer.concat(chunks).toString('utf8'))}finally{await reader.cancel().catch(()=>{})}
}
/** Only create draft, list metadata and inspect. No send, update, schedule or delete operation exists here. */
export function createBrevoCampaigns(key:string,senderId:number,request:typeof fetch=fetch):BrevoCampaigns{
  if(!key||key.startsWith('REPLACE_')||/[\x00-\x20\x7f]/.test(key)||!positive(senderId))throw new Error('Configuração de campanhas inválida.')
  const failure=(status:number):CampaignFailure=>({state:status===404?'absent':status===429||status>=500||status<400?'retry':'rejected'})
  async function call(route:string,spec?:DraftSpec){
    try{return await request('https://api.brevo.com/v3'+route,{method:spec?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15_000),headers:{'api-key':key,Accept:'application/json',...(spec?{'Content-Type':'application/json'}:{})},...(spec?{body:JSON.stringify({name:spec.name,sender:{id:spec.senderId},type:'classic',subject:spec.subject,htmlContent:spec.htmlContent,recipients:{listIds:[spec.listId]},abTesting:false,sendAtBestTime:false,mirrorActive:false})}:{})})}catch{return null}
  }
  async function read(route:string){const r=await call(route);if(!r)return{state:'retry' as const};if(r.status!==200){await r.body?.cancel().catch(()=>{});return failure(r.status)}try{return{state:'data' as const,data:await json(r)}}catch{return{state:'retry' as const}}}
  return{senderId,async find(name){
    if(!/^bibliotheon-[a-f0-9-]{36}$/.test(name))return{state:'rejected'}
    const seen=new Set<number>(),matches:number[]=[];let total:number|undefined
    for(let offset=0;offset<1000;offset+=50){
      const response=await read(`/emailCampaigns?limit=50&offset=${offset}&sort=asc&excludeHtmlContent=true`)
      if(response.state!=='data')return response
      const data=response.data
      if(!object(data)||!Number.isSafeInteger(data.count)||Number(data.count)<0||Number(data.count)>1000||total!==undefined&&data.count!==total||!Array.isArray(data.campaigns)||data.campaigns.length>50)return{state:'retry'}
      total=Number(data.count)
      for(const row of data.campaigns){if(!object(row)||!positive(row.id)||typeof row.name!=='string'||seen.has(row.id))return{state:'retry'};seen.add(row.id);if(row.name===name)matches.push(row.id)}
      if(seen.size===total)return matches.length>1?{state:'conflict'}:matches.length===1?{state:'found',id:matches[0]}:{state:'absent'}
      if(data.campaigns.length!==50||seen.size>total)return{state:'retry'}
    }
    return{state:'retry'}
  },async create(spec){
    if(!readDraftSpec(spec)||spec.senderId!==senderId)return{state:'rejected'}
    const r=await call('/emailCampaigns',spec);if(!r)return{state:'retry'}
    if(r.status!==201){await r.body?.cancel().catch(()=>{});return failure(r.status)}
    try{const data=await json(r);return object(data)&&positive(data.id)?{state:'created',id:data.id}:{state:'retry'}}catch{return{state:'retry'}}
  },async verify(id,spec){
    if(!positive(id)||!readDraftSpec(spec)||spec.senderId!==senderId)return{state:'rejected'}
    const response=await read(`/emailCampaigns/${id}?statistics=globalStats`);if(response.state!=='data')return response
    const d=response.data
    return campaignIdentityMatches(d,id,spec)&&d.status==='draft'&&(d.scheduledAt===undefined||d.scheduledAt===null||d.scheduledAt==='')?{state:'verified'}:{state:'conflict'}
  }}
}
export function configuredBrevoCampaigns():BrevoCampaigns|null{
  if(process.env.BREVO_CAMPAIGN_SYNC_ENABLED!=='true'||process.env.BREVO_CONTACT_SYNC_ENABLED!=='true'||process.env.BREVO_LIST_SYNC_ENABLED!=='true'||process.env.BREVO_PREFERENCE_SYNC_ENABLED!=='true')return null
  const id=process.env.BREVO_CAMPAIGN_SENDER_ID||''
  if(!/^[1-9]\d*$/.test(id))return null
  try{return createBrevoCampaigns(process.env.BREVO_API_KEY||'',Number(id))}catch{return null}
}
