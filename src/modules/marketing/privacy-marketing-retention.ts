import { marketingRetentionCutoff } from './retention-policy'
import type { CollectionSlug, Payload, PayloadRequest, Where } from 'payload'
import { atomic, serial } from './transaction'
import { contactFingerprint } from './contact'
import { validLinkSecret } from './tokens'

const BATCH = 100, LIMIT = 10000
const idOf = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id
const aged = (value: string | null | undefined, cutoff: string) => !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.parse(cutoff)
export type SuppressedMarketingRetentionReport = {
  cutoff: string; guardAvailable: boolean; candidates: number; eligible: number; processed: number
  removedSubscriptions: number; removedEnrollments: number; removedPromotions: number
  preservedForReconciliation: number; withoutExpiredMarketing: number
}

/** Scan JSON references too: missing relational links do not make a shared manifest disposable. */
export async function hasSharedMarketingReference(payload: Payload, ids: Set<string>, req: PayloadRequest, identities: readonly string[] = []) {
  const collections: Array<[CollectionSlug, string[]]> = [
    ['email-campaign-batches',['members','providerCheck','preferenceCheck','copy']],
    ['brevo-campaign-sends',['recipientIdentities','history']],
    ['brevo-batch-lists',['snapshot','attemptedIds','verification']],
    ['brevo-campaign-drafts',['content','observedIds']],
  ]
  let nodes = 0
  const touches = (value: unknown, depth = 0): boolean => {
    if (++nodes > 1000000 || depth > 64) throw new Error('Manifesto excede o orçamento de retenção; conciliação necessária.')
    if (typeof value === 'string') return identities.some(identity=>value.toLowerCase().includes(identity.toLowerCase())) || (value.match(/[a-f0-9]{64}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi) ?? []).some(id => ids.has(id.toLowerCase()))
    if (Array.isArray(value)) return value.some(item => touches(item,depth+1))
    return !!value && typeof value === 'object' && Object.entries(value).some(([key,item]) => touches(key,depth+1) || touches(item,depth+1))
  }
  for (const [collection, fields] of collections) {
    let afterId: string | undefined, scanned = 0
    while (true) {
      const rows = await payload.find({ collection, where: afterId ? { id: { greater_than: afterId } } : {}, sort: 'id', limit: BATCH, depth: 0, overrideAccess: true, req, select: Object.fromEntries(fields.map(field => [field,true])) as never })
      scanned += rows.docs.length
      if (scanned > LIMIT) throw new Error('Inventário de manifestos excede o limite de retenção.')
      for (const row of rows.docs as unknown as Array<{ id: string } & Record<string, unknown>>) {
        if (touches(row)) return true
        afterId = row.id
      }
      if (rows.docs.length < BATCH) break
    }
  }
  return false
}

/** Prunes local promotional state only; identity, sample deliveries and evidence retain their own policies. */
export async function expireSuppressedMarketing(payload: Payload, now: number, apply: boolean, secret: string | undefined): Promise<SuppressedMarketingRetentionReport> {
  if (!Number.isFinite(now)) throw new Error('Data de retenção inválida.')
  const cutoff = marketingRetentionCutoff(now)
  const whereFor = (afterId?: string): Where => ({ and: [{ globalSuppressedAt: { less_than_equal: cutoff } }, ...(afterId ? [{ id: { greater_than: afterId } }] : [])] })
  const report: SuppressedMarketingRetentionReport = { cutoff, guardAvailable: validLinkSecret(secret), candidates: (await payload.count({ collection: 'contacts', where: whereFor(), overrideAccess: true })).totalDocs, eligible: 0, processed: 0, removedSubscriptions: 0, removedEnrollments: 0, removedPromotions: 0, preservedForReconciliation: 0, withoutExpiredMarketing: 0 }
  if (!report.guardAvailable || !secret) { report.preservedForReconciliation = report.candidates; return report }
  let afterId: string | undefined
  while (true) {
    const rows = await payload.find({ collection: 'contacts', where: whereFor(afterId), sort: 'id', limit: BATCH, depth: 0, overrideAccess: true })
    if (!rows.docs.length) break
    for (const row of rows.docs) {
      afterId = row.id
      const result = await atomic(payload, async req => {
        // Same order as batch construction: no new member can appear during pruning.
        await serial(req,'promotion-batches')
        await serial(req,`contact:${row.id}`)
        const current = await payload.findByID({ collection: 'contacts', id: row.id, depth: 0, overrideAccess: true, req, disableErrors: true })
        if (!current || !aged(current.globalSuppressedAt,cutoff)) return { state: 'held' as const }
        const related = async <C extends CollectionSlug>(collection: C) => {
          const found = await payload.find({ collection, where: { contact: { equals: row.id } } as Where, limit: LIMIT+1, depth: 0, overrideAccess: true, req })
          if (found.totalDocs > LIMIT) throw new Error('Relações excedem o limite de retenção.')
          return found.docs
        }
        const subscriptions = await related('subscriptions'), enrollments = await related('sequence-enrollments'), promotions = await related('promotion-deliveries')
        if (subscriptions.some(item => item.state !== 'unsubscribed') || enrollments.some(item => item.state === 'active') || promotions.some(item => item.state !== 'canceled' || !!idOf(item.batch))) return { state: 'held' as const }
        const allEnrollmentIds = new Set(enrollments.map(item => item.id))
        if (promotions.some(item => !allEnrollmentIds.has(idOf(item.enrollment)!))) return { state: 'held' as const }
        if (enrollments.length && (await payload.count({ collection: 'promotion-deliveries', where: { enrollment: { in: [...allEnrollmentIds] } }, overrideAccess: true, req })).totalDocs !== promotions.length) return { state: 'held' as const }
        const oldSubscriptions = subscriptions.filter(item => aged(item.unsubscribedAt,cutoff) && aged(item.updatedAt,cutoff))
        const oldEnrollments = enrollments.filter(item => item.state === 'canceled' && aged(item.canceledAt,cutoff) && aged(item.updatedAt,cutoff) && promotions.filter(delivery => idOf(delivery.enrollment) === item.id).every(delivery => aged(delivery.updatedAt,cutoff)))
        const enrollmentIds = new Set(oldEnrollments.map(item => item.id)), oldPromotions = promotions.filter(item => enrollmentIds.has(idOf(item.enrollment)!))
        if (!oldSubscriptions.length && !oldEnrollments.length) return { state: 'empty' as const }
        const privacy = await payload.count({ collection: 'privacy-request-audit', where: { and: [{ subjectFingerprint: { equals: contactFingerprint(current.email,secret) } }, { action: { in: ['delete','correct'] } }, { outcome: { in: ['pending','completed'] } }] }, overrideAccess: true, req })
        if (privacy.totalDocs) return { state: 'held' as const }
        for (const collection of ['brevo-registrations','brevo-suppressions','brevo-webhook-events'] as const) if ((await payload.count({ collection, where: { contact: { equals: row.id } }, overrideAccess: true, req })).totalDocs) return { state: 'held' as const }
        if ((await payload.count({ collection: 'email-deliveries', where: { and: [{ contact: { equals: row.id } }, { state: { in: ['sending','uncertain'] } }] }, overrideAccess: true, req })).totalDocs) return { state: 'held' as const }
        if (promotions.length) for (const collection of ['brevo-delivery-receipts','brevo-webhook-events'] as const) if ((await payload.count({ collection, where: { delivery: { in: promotions.map(item => item.id) } }, overrideAccess: true, req })).totalDocs) return { state: 'held' as const }
        const references = new Set([row.id,...enrollments.map(item => item.id),...promotions.map(item => item.id),...subscriptions.map(item => item.id)])
        if (await hasSharedMarketingReference(payload,references,req)) return { state: 'held' as const }
        if (apply) {
          for (const item of oldPromotions) await payload.delete({ collection: 'promotion-deliveries', id: item.id, overrideAccess: true, req })
          for (const item of oldEnrollments) await payload.delete({ collection: 'sequence-enrollments', id: item.id, overrideAccess: true, req })
          for (const item of oldSubscriptions) await payload.delete({ collection: 'subscriptions', id: item.id, overrideAccess: true, req })
        }
        return { state: 'eligible' as const, subscriptions: oldSubscriptions.length, enrollments: oldEnrollments.length, promotions: oldPromotions.length }
      })
      if (result.state === 'held') report.preservedForReconciliation++
      else if (result.state === 'empty') report.withoutExpiredMarketing++
      else {
        report.eligible++
        if (apply) { report.processed++; report.removedSubscriptions += result.subscriptions; report.removedEnrollments += result.enrollments; report.removedPromotions += result.promotions }
      }
    }
    if (rows.docs.length < BATCH) break
  }
  return report
}
