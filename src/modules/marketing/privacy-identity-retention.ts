import { webhookRecipient } from '../../integrations/brevo/webhook'
import { sendRecipientFingerprint } from './send-recipients'
import type { Payload, PayloadRequest, Where } from 'payload'
import { atomic, serial } from './transaction'
import { contactFingerprint } from './contact'
import { suppressionFingerprint } from './suppression-tombstone'
import { validLinkSecret } from './tokens'
import { calendarMonths } from './privacy-recovery-manifest'
import { hasSharedMarketingReference } from './privacy-marketing-retention'

const BATCH = 100, LIMIT = 10000
const linkedCollections = ['subscriptions','magnet-requests','email-deliveries','preference-tokens','sequence-enrollments','promotion-deliveries','brevo-registrations','brevo-suppressions','brevo-webhook-events'] as const
const aged = (value: string, cutoff: string) => Number.isFinite(Date.parse(value)) && value <= cutoff

/** A machine retention fact, never a request attributed to an owner. Caller holds fingerprint lock. */
export async function storeContactRetirement(req: PayloadRequest, fingerprint: string, retiredAt: string) {
  if (!/^[a-f0-9]{64}$/.test(fingerprint) || new Date(retiredAt).toISOString() !== retiredAt) throw new Error('Registro de expurgo inválido.')
  const existing = (await req.payload.find({collection:'contact-retirements',where:{subjectFingerprint:{equals:fingerprint}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
  if (existing && existing.retiredAt >= retiredAt) return
  const data = {subjectFingerprint:fingerprint,retiredAt,expiresAt:calendarMonths(retiredAt,24)}
  if (existing) await req.payload.update({collection:'contact-retirements',id:existing.id,data,overrideAccess:true,req})
  else await req.payload.create({collection:'contact-retirements',data,overrideAccess:true,req})
}

async function linkedPurpose(req: PayloadRequest, contact: string, email: string, secret: string, extraIds: string[] = []) {
  for (const collection of linkedCollections) if ((await req.payload.count({collection,where:{contact:{equals:contact}},overrideAccess:true,req})).totalDocs) return true
  const orphanEvents=(await req.payload.count({collection:'brevo-webhook-events',where:{contact:{exists:false}},overrideAccess:true,req})).totalDocs
  if(orphanEvents) {
    const key=process.env.BREVO_WEBHOOK_EVENT_SECRET
    if(!validLinkSecret(key))return true
    if((await req.payload.count({collection:'brevo-webhook-events',where:{and:[{contact:{exists:false}},{recipientFingerprint:{equals:webhookRecipient(email,key!)}}]},overrideAccess:true,req})).totalDocs)return true
  }
  return hasSharedMarketingReference(req.payload,new Set([contact,contactFingerprint(email,secret),suppressionFingerprint(email,secret),sendRecipientFingerprint(email,secret),...extraIds]),req,[email])
}

/** New independent purpose takes precedence over an earlier automatic retention fact. */
export async function hasPurposeAfterRetirement(req: PayloadRequest, contact: {id:string;createdAt:string}, retiredAt: string) {
  if (!Number.isFinite(Date.parse(contact.createdAt)) || contact.createdAt > retiredAt) return true
  if ((await req.payload.count({collection:'magnet-requests',where:{and:[{contact:{equals:contact.id}},{createdAt:{greater_than:retiredAt}}]},overrideAccess:true,req})).totalDocs) return true
  return !!(await req.payload.count({collection:'consent-events',where:{and:[{contact:{equals:contact.id}},{action:{in:['requested','confirmed','subscribed']}},{occurredAt:{greater_than:retiredAt}}]},overrideAccess:true,req})).totalDocs
}

/** Replay cannot invent completion of an old sample/provider operation; retain any related data. */
export async function replayContactRetirement(payload: Payload, contactId: string, fingerprint: string, retiredAt: string, secret: string) {
  return atomic(payload,async req=>{
    await serial(req,fingerprint)
    await serial(req,'promotion-batches')
    await serial(req,`contact:${contactId}`)
    const contact = await payload.findByID({collection:'contacts',id:contactId,depth:0,overrideAccess:true,req,disableErrors:true})
    if (!contact) return 'absent' as const
    if (contactFingerprint(contact.email,secret)!==fingerprint || await hasPurposeAfterRetirement(req,contact,retiredAt)) return 'newer' as const
    if ((await payload.count({collection:'consent-events',where:{contact:{equals:contactId}},overrideAccess:true,req})).totalDocs || await linkedPurpose(req,contactId,contact.email,secret)) return 'held' as const
    await payload.delete({collection:'contacts',id:contactId,overrideAccess:true,req})
    await storeContactRetirement(req,fingerprint,retiredAt)
    return 'removed' as const
  })
}

export type ClosedIdentityRetentionReport = {
  cutoff: string; suppressionCutoff: string; guardAvailable: boolean; candidates: number
  eligible: number; processed: number; removedConsentEvents: number; removedContacts: number
  preservedForPurpose: number; preservedForReconciliation: number; expiredMarkers: number
}

/** Expires closed evidence only after independent purposes and external dependencies end. */
export async function expireClosedIdentities(payload: Payload, now: number, apply: boolean, secret: string | undefined): Promise<ClosedIdentityRetentionReport> {
  if (!Number.isFinite(now)) throw new Error('Data de retenção inválida.')
  const currentTime = new Date(now).toISOString(), cutoff = calendarMonths(currentTime,-24), suppressionCutoff = new Date(now-30*86400000).toISOString()
  const whereFor = (afterId?: string): Where => ({and:[{globalSuppressedAt:{less_than_equal:suppressionCutoff}},...(afterId?[{id:{greater_than:afterId}}]:[])]})
  const report: ClosedIdentityRetentionReport = {cutoff,suppressionCutoff,guardAvailable:validLinkSecret(secret),candidates:(await payload.count({collection:'contacts',where:whereFor(),overrideAccess:true})).totalDocs,eligible:0,processed:0,removedConsentEvents:0,removedContacts:0,preservedForPurpose:0,preservedForReconciliation:0,expiredMarkers:0}
  if (apply) {
    let afterId: string|undefined
    while(true) {
      const rows=await payload.find({collection:'contact-retirements',where:{and:[{expiresAt:{less_than_equal:currentTime}},...(afterId?[{id:{greater_than:afterId}}]:[])]},sort:'id',limit:BATCH,depth:0,overrideAccess:true})
      for(const row of rows.docs) {
        afterId=row.id
        const removed=await atomic(payload,async req=>{
          await serial(req,row.subjectFingerprint)
          const fresh=await payload.findByID({collection:'contact-retirements',id:row.id,depth:0,overrideAccess:true,req,disableErrors:true})
          if(!fresh || fresh.expiresAt>currentTime)return false
          await payload.delete({collection:'contact-retirements',id:row.id,overrideAccess:true,req});return true
        })
        if(removed)report.expiredMarkers++
      }
      if(rows.docs.length<BATCH)break
    }
  }
  if (!report.guardAvailable || !secret) { report.preservedForReconciliation=report.candidates; return report }
  let afterId: string|undefined
  while(true) {
    const rows=await payload.find({collection:'contacts',where:whereFor(afterId),sort:'id',limit:BATCH,depth:0,overrideAccess:true})
    for(const candidate of rows.docs) {
      afterId=candidate.id
      const fingerprint=contactFingerprint(candidate.email,secret)
      const result=await atomic(payload,async req=>{
        await serial(req,fingerprint)
        await serial(req,'promotion-batches')
        await serial(req,`contact:${candidate.id}`)
        const contact=await payload.findByID({collection:'contacts',id:candidate.id,depth:0,overrideAccess:true,req,disableErrors:true})
        if(!contact || contactFingerprint(contact.email,secret)!==fingerprint || !contact.globalSuppressedAt || !aged(contact.globalSuppressedAt,suppressionCutoff) || contact.createdAt>currentTime)return {state:'held' as const}
        if((await payload.count({collection:'privacy-request-audit',where:{and:[{subjectFingerprint:{equals:fingerprint}},{action:{in:['delete','correct']}},{outcome:{in:['pending','completed']}}]},overrideAccess:true,req})).totalDocs)return {state:'held' as const}
        const events=await payload.find({collection:'consent-events',where:{contact:{equals:contact.id}},limit:LIMIT+1,depth:0,overrideAccess:true,req})
        if(events.totalDocs>LIMIT)throw new Error('Provas excedem o limite de retenção.')
        if(await linkedPurpose(req,contact.id,contact.email,secret,events.docs.map(item=>item.id)))return {state:'held' as const}
        const old=events.docs.filter(event=>aged(event.occurredAt,cutoff)&&aged(event.updatedAt,cutoff))
        const removeIdentity=old.length===events.docs.length
        if(!old.length&&!removeIdentity)return {state:'purpose' as const}
        let retiredAt=currentTime
        if(removeIdentity) {
          const suppression=suppressionFingerprint(contact.email,secret)
          await serial(req,`marketing-suppression:${suppression}`)
          const tombstone=(await payload.count({collection:'marketing-suppression-tombstones',where:{fingerprint:{equals:suppression}},overrideAccess:true,req})).totalDocs
          const previous=(await payload.find({collection:'contact-retirements',where:{subjectFingerprint:{equals:fingerprint}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
          const restoredCopy=previous && !await hasPurposeAfterRetirement(req,contact,previous.retiredAt)
          // A restore quarantine timestamp is not evidence of a new suppression period.
          // Never create/renew a suppression deadline from globalSuppressedAt alone.
          if(!tombstone && calendarMonths(contact.globalSuppressedAt,12)>currentTime && !restoredCopy)return {state:'held' as const}
          if(restoredCopy)retiredAt=previous.retiredAt
        }
        if(apply) {
          for(const event of old)await payload.delete({collection:'consent-events',id:event.id,overrideAccess:true,req})
          if(removeIdentity) {
            await payload.delete({collection:'contacts',id:contact.id,overrideAccess:true,req})
            await storeContactRetirement(req,fingerprint,retiredAt)
          }
        }
        return {state:'eligible' as const,events:old.length,contact:removeIdentity?1:0}
      })
      if(result.state==='held')report.preservedForReconciliation++
      else if(result.state==='purpose')report.preservedForPurpose++
      else {report.eligible++;if(apply){report.processed++;report.removedConsentEvents+=result.events;report.removedContacts+=result.contact}}
    }
    if(rows.docs.length<BATCH)break
  }
  return report
}
