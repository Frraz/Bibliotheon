import type { PayloadRequest } from 'payload'
import { reviewPreparedBatch } from './batch-review'
import { validProviderCheck, PROVIDER_CHECK_TTL } from './batch-check-copy'
import { listAudienceKey } from './batch-list-copy'
import type { PreferenceCheck } from './batch-preferences'
import { derivePreferenceToken } from './preference-links'
import { hashOpaqueToken } from './tokens'
import { idOf } from './sequence-copy'

/** Caller commits this locked local review before any remote mutation. */
export async function reviewCampaignPrerequisites(req: PayloadRequest, id: string, secret: string, now: number) {
  const reviewed = await reviewPreparedBatch(req,id,now)
  if(reviewed.state!=='ready')return reviewed
  const proof=reviewed.batch.providerCheck
  if(!validProviderCheck(proof,reviewed.batch.key,reviewed.recipients,now))return{state:'prerequisites' as const}
  const list=(await req.payload.find({collection:'brevo-batch-lists',where:{batch:{equals:id}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
  const listAt=Date.parse(list?.verifiedAt||'')
  if(!list||list.state!=='ready'||!list.providerListId||!Number.isFinite(listAt)||listAt>now||now-listAt>PROVIDER_CHECK_TTL||!validProviderCheck(list.verification,reviewed.batch.key,reviewed.recipients,now)||listAudienceKey(list.verification)!==listAudienceKey(proof))return{state:'prerequisites' as const}
  const preference=reviewed.batch.preferenceCheck as PreferenceCheck|null
  const at=Date.parse(preference?.checkedAt||'')
  if(!preference||preference.version!==1||preference.batchKey!==reviewed.batch.key||typeof preference.checkedAt!=='string'||!Number.isFinite(at)||at>now||now-at>PROVIDER_CHECK_TTL||!Array.isArray(preference.recipients)||preference.recipients.length!==proof.recipients.length)return{state:'prerequisites' as const}
  const seen=new Set<string>()
  for(const recipient of preference.recipients){
    if(!recipient||typeof recipient.contact!=='string'||seen.has(recipient.contact)||!proof.recipients.some(person=>person.contact===recipient.contact&&person.version===recipient.version&&person.providerId===recipient.providerId)||typeof recipient.tokenId!=='string'||!Number.isFinite(Date.parse(recipient.expiresAt))||Date.parse(recipient.expiresAt)<=now)return{state:'prerequisites' as const}
    seen.add(recipient.contact)
    const token=await req.payload.findByID({collection:'preference-tokens',id:recipient.tokenId,depth:0,overrideAccess:true,req})
    if(idOf(token.contact)!==recipient.contact||token.expiresAt!==recipient.expiresAt||!token.nonce)return{state:'prerequisites' as const}
    try{if(hashOpaqueToken(derivePreferenceToken(recipient.contact,token.nonce,secret))!==token.tokenHash)return{state:'prerequisites' as const}}catch{return{state:'prerequisites' as const}}
  }
  return {...reviewed,listId:list.providerListId}
}
