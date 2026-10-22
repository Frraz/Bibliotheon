import type { Payload } from 'payload'
import { atomic, serial } from './transaction'

/** Outbox is authoritative: queue insertion failure leaves recoverable pending deliveries. */
export async function dispatchEmail(payload: Payload, now = Date.now()) {
  await atomic(payload, async req => {
    await serial(req, 'dispatcher')
    // A worker lost after claiming might already have sent: hold for reconciliation.
    await payload.update({ collection: 'email-deliveries', where: { and: [{ state: { equals: 'sending' } }, { startedAt: { less_than: new Date(now - 30 * 60_000).toISOString() } }] }, data: { state: 'uncertain', errorCode: 'uncertain_delivery' }, overrideAccess: true, req })
    const pending = await payload.find({ collection: 'email-deliveries', where: { and: [{ state: { equals: 'pending' } }, { nextAttemptAt: { less_than_equal: new Date(now).toISOString() } }] }, sort: 'nextAttemptAt', limit: 25, depth: 0, overrideAccess: true, req })
    for (const delivery of pending.docs) {
      // A process may die after marking a job processing, before it claims the outbox.
      // Such a job must not strand a still-pending delivery; the delivery lock deduplicates execution.
      const queued = await payload.find({ collection: 'payload-jobs', where: { and: [{ taskSlug: { equals: 'deliver-email' } }, { 'input.deliveryId': { equals: delivery.id } }, { completedAt: { exists: false } }, { processing: { not_equals: true } }, { hasError: { not_equals: true } }] }, limit: 1, depth: 0, overrideAccess: true, req })
      if (!queued.docs[0]) await payload.jobs.queue({ task: 'deliver-email', input: { deliveryId: delivery.id }, queue: 'email', req })
    }
  })
}
