import type { Payload, PayloadRequest } from 'payload'
import type { Subscription } from '../../payload-types'
import { contactFingerprint } from './contact'
import { calendarMonths } from './privacy-recovery-manifest'
import { storeThemeWithdrawal, withdrawalKey } from './theme-withdrawal'
import { atomic, serial } from './transaction'
import { validLinkSecret } from './tokens'

const PAGE = 100
const idOf = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id
export type LegacyWithdrawalProof = { state: 'verified'|'expired'; withdrawnAt: string; expiresAt: string } | { state: 'unverified' }

/** Infer no date: require the exact native unsubscribe event and its canonical subscription key. */
export async function legacyThemeWithdrawalProof(req: PayloadRequest, sub: Subscription, now: number): Promise<LegacyWithdrawalProof> {
  const contact = idOf(sub.contact), theme = idOf(sub.theme), at = sub.unsubscribedAt
  if (sub.state !== 'unsubscribed' || !contact || !theme || sub.key !== `${contact}:${theme}` || !at || !Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at || Date.parse(at) > now) return {state:'unverified'}
  const proof = await req.payload.count({ collection:'consent-events', where:{and:[{contact:{equals:contact}},{theme:{equals:theme}},{purpose:{equals:'marketing'}},{action:{equals:'unsubscribed'}},{occurredAt:{equals:at}},{key:{equals:`theme-unsubscribe:${sub.id}:${at}`}}]},overrideAccess:true,req })
  if (proof.totalDocs !== 1) return {state:'unverified'}
  const conflicts = await req.payload.count({collection:'consent-events',where:{and:[{contact:{equals:contact}},{theme:{equals:theme}},{purpose:{equals:'marketing'}},{or:[{and:[{action:{equals:'subscribed'}},{occurredAt:{greater_than_equal:at}}]},{and:[{action:{equals:'unsubscribed'}},{occurredAt:{greater_than:at}}]}]}]},overrideAccess:true,req})
  if (conflicts.totalDocs || (await req.payload.count({collection:'subscriptions',where:{and:[{contact:{equals:contact}},{theme:{equals:theme}},{state:{not_equals:'unsubscribed'}}]},overrideAccess:true,req})).totalDocs) return {state:'unverified'}
  const expiresAt = calendarMonths(at,24)
  return {state:Date.parse(expiresAt)>now?'verified':'expired',withdrawnAt:at,expiresAt}
}

export type LegacyWithdrawalReport = { guardAvailable:boolean; candidates:number; verified:number; persisted:number; existing:number; expired:number; unverified:number }
export async function backfillThemeWithdrawals(payload:Payload, now:number, apply:boolean, secret:string|undefined):Promise<LegacyWithdrawalReport> {
  if(!Number.isFinite(now))throw new Error('Data de retenção inválida.')
  const where={state:{equals:'unsubscribed' as const}}
  const report:LegacyWithdrawalReport={guardAvailable:validLinkSecret(secret),candidates:(await payload.count({collection:'subscriptions',where,overrideAccess:true})).totalDocs,verified:0,persisted:0,existing:0,expired:0,unverified:0}
  if(!report.guardAvailable||!secret){report.unverified=report.candidates;return report}
  let cursor:string|undefined
  while(true){
    const rows=await payload.find({collection:'subscriptions',where:{and:[where,...(cursor?[{id:{greater_than:cursor}}]:[])]},sort:'id',limit:PAGE,depth:0,overrideAccess:true})
    for(const candidate of rows.docs){
      cursor=candidate.id
      const outcome=await atomic(payload,async req=>{
        const contactId=idOf(candidate.contact)
        if(!contactId)return 'unverified' as const
        await serial(req,`contact:${contactId}`)
        const sub=await payload.findByID({collection:'subscriptions',id:candidate.id,depth:0,overrideAccess:true,req,disableErrors:true})
        const contact=await payload.findByID({collection:'contacts',id:contactId,depth:0,overrideAccess:true,req,disableErrors:true})
        if(!sub||!contact||idOf(sub.contact)!==contactId||sub.state!=='unsubscribed')return 'unverified' as const
        const theme=idOf(sub.theme)
        if(!theme)return 'unverified' as const
        const fingerprint=contactFingerprint(contact.email,secret), key=withdrawalKey(fingerprint,theme)
        await serial(req,`theme-withdrawal:${key}`)
        const existing=(await payload.find({collection:'theme-withdrawals',where:{key:{equals:key}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
        if(existing&&sub.unsubscribedAt&&existing.withdrawnAt>=sub.unsubscribedAt)return 'existing' as const
        const proof=await legacyThemeWithdrawalProof(req,sub,now)
        if(proof.state!=='verified')return proof.state
        if(apply)await storeThemeWithdrawal(req,fingerprint,theme,proof.withdrawnAt)
        return 'verified' as const
      })
      report[outcome]++
      if(outcome==='verified'&&apply)report.persisted++
    }
    if(rows.docs.length<PAGE)break
  }
  return report
}
