import { randomUUID } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'
import { atomic, serial } from './transaction'
import { preparePromotions, reviewPromotion } from './sequence'
import { idOf } from './sequence-copy'
import { batchCopy, batchGroupKey, batchKey, type BatchCopy, type BatchMember } from './batch-copy'
import { reserveMailQuota } from './quota'
import type { QuotaPolicy } from './quota-policy'
import type { BrevoContacts } from '../../integrations/brevo/contacts'
import { reviewPreparedBatch } from './batch-review'
import { checkPromotionBatch } from './batch-preflight'
import { validProviderCheck } from './batch-check-copy'

/** Bounded local assembly. No email addresses, tokens, provider calls or quota consumption. */
export async function preparePromotionBatches(payload: Payload, now = Date.now()) {
  await preparePromotions(payload, now)
  return atomic(payload, async req => {
    await serial(req, 'promotion-batches')
    const due = await payload.find({ collection: 'promotion-deliveries', where: { and: [{ state: { equals: 'ready' } }, { batch: { exists: false } }, { dueAt: { less_than_equal: new Date(now).toISOString() } }] }, sort: 'id', limit: 200, depth: 0, overrideAccess: true, req })
    for (const contact of [...new Set(due.docs.map(doc => idOf(doc.contact)))].sort()) await serial(req, `contact:${contact}`)
    const groups = new Map<string, { copy: BatchCopy; members: BatchMember[] }>()
    for (const candidate of due.docs) {
      const delivery = await payload.findByID({ collection: 'promotion-deliveries', id: candidate.id, depth: 0, overrideAccess: true, req })
      if (delivery.state !== 'ready' || delivery.batch) continue
      const review = await reviewPromotion(req, delivery, now)
      if (review.state !== 'ready') continue
      const copy = batchCopy(idOf(review.enrollment.theme), delivery.stage, delivery.dueAt, review.snapshot), key = batchGroupKey(copy)
      const group = groups.get(key) ?? { copy, members: [] }
      group.members.push({ delivery: delivery.id, contact: idOf(delivery.contact) })
      groups.set(key, group)
    }
    let batches = 0, recipients = 0
    for (const [groupKey, { copy, members }] of groups) {
      const recipientCount = new Set(members.map(member => member.contact)).size
      const batch = await payload.create({ collection: 'email-campaign-batches', data: { key: randomUUID(), groupKey, theme: copy.theme, stage: String(copy.stage) as '2' | '4' | '7' | '10', day: copy.day, copy, members, recipientCount, state: 'prepared', nextAttemptAt: new Date(now).toISOString() }, overrideAccess: true, req })
      // Payload owns the record ID; bind identity after it is returned, in this transaction.
      await payload.update({ collection: 'email-campaign-batches', id: batch.id, data: { key: batchKey(groupKey, members, batch.id) }, overrideAccess: true, req })
      for (const member of members) await payload.update({ collection: 'promotion-deliveries', id: member.delivery, data: { batch: batch.id }, overrideAccess: true, req })
      batches++; recipients += recipientCount
    }
    return { examined: due.docs.length, batches, recipients }
  })
}

/** Provider preflight is mandatory. Internal claim is also shared by the guarded send coordinator. */
export async function claimPromotionBatch(payload: Payload, id: string, options: { now?: number; policy?: QuotaPolicy; client?: BrevoContacts | null; secret?: string; clock?: () => number } = {}) {
  const checked = await checkPromotionBatch(payload, id, options)
  if (checked.state !== 'ready') return checked
  return atomic(payload, async req => {
    const now = options.clock?.() ?? options.now ?? Date.now()
    const review = await reviewPreparedBatch(req, id, now)
    if (review.state !== 'ready') return review
    return reservePreparedPromotionBatch(req, review, now, options.policy)
  })
}


/** Caller holds batch/contact locks and supplied a current prepared review. Commit with send intent. */
export async function reservePreparedPromotionBatch(req: PayloadRequest, review: Extract<Awaited<ReturnType<typeof reviewPreparedBatch>>, { state: 'ready' }>, now: number, policy?: QuotaPolicy) {
  const payload = req.payload, id = review.batch.id
  const { batch, members, recipients } = review
  if (!validProviderCheck(batch.providerCheck, batch.key, recipients, now)) {
    await payload.update({ collection: 'email-campaign-batches', id, data: { providerCheck: null, errorCode: 'provider_unavailable', nextAttemptAt: new Date(now + 60_000).toISOString() }, overrideAccess: true, req })
    return { state: 'provider_check' as const }
  }
  const quota = await reserveMailQuota(req, { kind: 'promotional', count: batch.recipientCount, now, policy })
  if (!quota.granted) {
    await payload.update({ collection: 'email-campaign-batches', id, data: { errorCode: 'quota', nextAttemptAt: quota.nextDayAt }, overrideAccess: true, req })
    return { state: 'quota' as const }
  }
  await payload.update({ collection: 'email-campaign-batches', id, data: { state: 'claimed', claimedAt: new Date(now).toISOString(), errorCode: null }, overrideAccess: true, req })
  for (const member of members) await payload.update({ collection: 'promotion-deliveries', id: member.delivery, data: { state: 'sending' }, overrideAccess: true, req })
  return { state: 'claimed' as const, batchId: id, count: batch.recipientCount }
}
