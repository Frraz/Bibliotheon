import { isDeepStrictEqual } from 'node:util'
import type { PayloadRequest } from 'payload'
import { serial } from './transaction'
import { batchGroupKey, batchKey, readBatchCopy, readBatchMembers, type BatchMember } from './batch-copy'

const LIMIT = 10000
const idOf = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id
export type LocalPrivacyBatchPlan = { id: string; members: BatchMember[] }[]

/** Caller holds promotion-batches. Lock batches before contacts, as send/preflight do. No writes. */
export async function planLocalPrivacyBatches(req: PayloadRequest, contactId: string): Promise<LocalPrivacyBatchPlan> {
  const { payload } = req
  const batches = await payload.find({ collection: 'email-campaign-batches', limit: LIMIT + 1, depth: 0, overrideAccess: true, req })
  if (batches.totalDocs > LIMIT) throw new Error('Inventário de lotes excede o limite de privacidade.')
  const candidates = batches.docs.filter(batch => readBatchMembers(batch.members)?.some(member => member.contact === contactId)).sort((a, b) => a.id.localeCompare(b.id))
  for (const batch of candidates) await serial(req, `promotion-batch:${batch.id}`)
  const current: Array<(typeof batches.docs)[number] | null> = []
  for (const batch of candidates) current.push(await payload.findByID({ collection: 'email-campaign-batches', id: batch.id, depth: 0, overrideAccess: true, req, disableErrors: true }))
  const contactIds = new Set([contactId])
  for (const batch of current) if (batch) for (const member of readBatchMembers(batch.members) ?? []) contactIds.add(member.contact)
  if (contactIds.size > LIMIT) throw new Error('Destinatários excedem o limite de privacidade.')
  for (const id of [...contactIds].sort()) await serial(req, `contact:${id}`)
  const plans: LocalPrivacyBatchPlan = []
  for (const batch of current) {
    if (!batch || !['prepared', 'canceled'].includes(batch.state) || batch.claimedAt || batch.providerCheck || batch.preferenceCheck) continue
    const members = readBatchMembers(batch.members), copy = readBatchCopy(batch.copy)
    if (!members || !copy || !members.some(member => member.contact === contactId) || !isDeepStrictEqual(batch.members, members) || !isDeepStrictEqual(batch.copy, copy)) continue
    if (batch.groupKey !== batchGroupKey(copy) || batch.key !== batchKey(batch.groupKey, members, batch.id) || batch.recipientCount !== new Set(members.map(member => member.contact)).size) continue
    if (idOf(batch.theme) !== copy.theme || batch.day !== copy.day || batch.stage !== String(copy.stage)) continue
    let external = false
    for (const collection of ['brevo-batch-lists', 'brevo-campaign-drafts', 'brevo-campaign-sends'] as const) {
      if ((await payload.count({ collection, where: { batch: { equals: batch.id } }, overrideAccess: true, req })).totalDocs) { external = true; break }
    }
    if (external) continue
    const deliveries = await payload.find({ collection: 'promotion-deliveries', where: { batch: { equals: batch.id } }, limit: 201, depth: 0, overrideAccess: true, req })
    if (deliveries.totalDocs !== members.length || members.some(member => !deliveries.docs.some(delivery => delivery.id === member.delivery && idOf(delivery.contact) === member.contact && ['ready', 'canceled'].includes(delivery.state)))) continue
    const deliveryIds = members.map(member => member.delivery)
    if ((await payload.count({ collection: 'brevo-delivery-receipts', where: { delivery: { in: deliveryIds } }, overrideAccess: true, req })).totalDocs) continue
    if ((await payload.count({ collection: 'brevo-webhook-events', where: { delivery: { in: deliveryIds } }, overrideAccess: true, req })).totalDocs) continue
    plans.push({ id: batch.id, members })
  }
  return plans
}

/** Apply only after every privacy blocker is checked, in the same transaction as the owner request. */
export async function dissolveLocalPrivacyBatches(req: PayloadRequest, plans: LocalPrivacyBatchPlan) {
  let detachedPromotions = 0
  for (const plan of plans) {
    for (const member of plan.members) {
      await req.payload.update({ collection: 'promotion-deliveries', id: member.delivery, data: { batch: null }, overrideAccess: true, req })
      detachedPromotions++
    }
    await req.payload.delete({ collection: 'email-campaign-batches', id: plan.id, overrideAccess: true, req })
  }
  return { dissolvedLocalBatches: plans.length, detachedPromotions }
}
