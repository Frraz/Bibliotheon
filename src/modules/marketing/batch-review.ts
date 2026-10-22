import type { PayloadRequest } from 'payload'
import { serial } from './transaction'
import { idOf } from './sequence-copy'
import { reviewPromotion } from './sequence'
import { batchCopy, batchGroupKey, batchKey, readBatchCopy, readBatchMembers, type BatchMember } from './batch-copy'

export async function cancelBatch(req: PayloadRequest, id: string, members: BatchMember[], now: number) {
  await req.payload.update({ collection: 'email-campaign-batches', id, data: { state: 'canceled', canceledAt: new Date(now).toISOString(), errorCode: 'eligibility_changed', providerCheck: null, preferenceCheck: null }, overrideAccess: true, req })
  for (const member of members) {
    const delivery = await req.payload.findByID({ collection: 'promotion-deliveries', id: member.delivery, depth: 0, overrideAccess: true, req })
    if (delivery.batch && idOf(delivery.batch) === id) await req.payload.update({ collection: 'promotion-deliveries', id: member.delivery, data: { batch: null }, overrideAccess: true, req })
  }
}

/** Locks stay in the transaction; HTTP must only run after this transaction ends. */
export async function reviewPreparedBatch(req: PayloadRequest, id: string, now: number) {
  const { payload } = req
  await serial(req, `promotion-batch:${id}`)
  const batch = await payload.findByID({ collection: 'email-campaign-batches', id, depth: 0, overrideAccess: true, req })
  if (batch.state !== 'prepared' || Date.parse(batch.nextAttemptAt) > now) return { state: 'held' as const }
  const copy = readBatchCopy(batch.copy), members = readBatchMembers(batch.members)
  if (!copy || !members) throw new Error('Estrutura do lote promocional inválida.')
  const contacts = [...new Set(members.map(member => member.contact))].sort()
  if (contacts.length !== batch.recipientCount) throw new Error('Contagem do lote promocional inconsistente.')
  if (idOf(batch.theme) !== copy.theme || batch.stage !== String(copy.stage) || batch.day !== copy.day) throw new Error('Agrupamento do lote promocional inconsistente.')
  if (batch.groupKey !== batchGroupKey(copy)) throw new Error('Conteúdo do lote promocional inconsistente.')
  if (batch.key !== batchKey(batch.groupKey, members, id)) throw new Error('Identidade do lote promocional inconsistente.')
  for (const contact of contacts) await serial(req, `contact:${contact}`)
  let valid = true
  for (const member of members) {
    const delivery = await payload.findByID({ collection: 'promotion-deliveries', id: member.delivery, depth: 0, overrideAccess: true, req })
    if (delivery.state !== 'ready' || !delivery.batch || idOf(delivery.batch) !== id || idOf(delivery.contact) !== member.contact || Date.parse(delivery.dueAt) > now) { valid = false; continue }
    const review = await reviewPromotion(req, delivery, now)
    if (review.state !== 'ready' || batchGroupKey(batchCopy(idOf(review.enrollment.theme), delivery.stage, delivery.dueAt, review.snapshot)) !== batch.groupKey) valid = false
  }
  if (!valid) { await cancelBatch(req, id, members, now); return { state: 'canceled' as const } }
  const recipients = []
  for (const contact of contacts) {
    const person = await payload.findByID({ collection: 'contacts', id: contact, depth: 0, overrideAccess: true, req })
    recipients.push({ contact: person.id, email: person.email, version: person.updatedAt })
  }
  return { state: 'ready' as const, batch, members, recipients }
}
