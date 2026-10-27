import type { Payload, PayloadRequest, Where } from 'payload'
import type { MagnetRequest } from '../../payload-types'
import { atomic, serial } from './transaction'

const relationId = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id
const BATCH = 100
export type ConfirmedSampleRetentionReport = {
  candidates: number
  eligible: number
  processed: number
  removedDeliveries: number
  removedConsentEvents: number
  preservedForReconciliation: number
}

async function eligibleRelations(payload: Payload, row: MagnetRequest, cutoff: string, now: number, req: PayloadRequest) {
  const contactId = relationId(row.contact), themeId = relationId(row.theme)
  if (!contactId || !themeId || !row.confirmedAt || !Number.isFinite(Date.parse(row.confirmedAt)) || Date.parse(row.confirmedAt) >= Date.parse(cutoff) || !Number.isFinite(Date.parse(row.updatedAt)) || Date.parse(row.updatedAt) >= Date.parse(cutoff) || !Number.isFinite(Date.parse(row.expiresAt)) || Date.parse(row.expiresAt) > now) return null
  const contact = await payload.findByID({ collection: 'contacts', id: contactId, depth: 0, overrideAccess: true, req, disableErrors: true })
  if (!contact) return null
  if ((await payload.count({ collection: 'sequence-enrollments', where: { request: { equals: row.id } }, overrideAccess: true, req })).totalDocs) return null
  if (row.marketingOptIn) {
    const subscriptions = await payload.find({ collection: 'subscriptions', where: { and: [{ contact: { equals: contactId } }, { theme: { equals: themeId } }] }, limit: 2, depth: 0, overrideAccess: true, req })
    // Keep the request proving a current opt-in. A later subscription can outlive an obsolete request.
    if (subscriptions.totalDocs > 1 || subscriptions.docs.some(subscription => subscription.state === 'pending' || subscription.state === 'subscribed' && (!subscription.subscribedAt || !Number.isFinite(Date.parse(subscription.subscribedAt)) || Date.parse(subscription.subscribedAt) <= Date.parse(row.confirmedAt!)))) return null
    for (const subscription of subscriptions.docs) if (subscription.state === 'subscribed') {
      if (!subscription.consentVersion) return null
      const proof = await payload.count({ collection: 'consent-events', where: { and: [{ contact: { equals: contactId } }, { theme: { equals: themeId } }, { purpose: { equals: 'marketing' } }, { action: { equals: 'subscribed' } }, { occurredAt: { equals: subscription.subscribedAt } }, { version: { equals: subscription.consentVersion } }] }, overrideAccess: true, req })
      if (!proof.totalDocs) return null
    }
  }
  const deliveries = await payload.find({ collection: 'email-deliveries', where: { request: { equals: row.id } }, pagination: false, depth: 0, overrideAccess: true, req })
  if (!deliveries.docs.some(delivery => delivery.kind === 'delivery') || deliveries.docs.some(delivery => relationId(delivery.contact) !== contactId || !['sent', 'failed', 'canceled'].includes(delivery.state) || !Number.isFinite(Date.parse(delivery.updatedAt)) || Date.parse(delivery.updatedAt) >= Date.parse(cutoff) || delivery.state === 'sent' && (!delivery.sentAt || !Number.isFinite(Date.parse(delivery.sentAt)) || Date.parse(delivery.sentAt) >= Date.parse(cutoff)))) return null
  const events = await payload.find({ collection: 'consent-events', where: { key: { in: [`requested:${row.id}`, `confirmed:${row.id}`, `subscribed:${row.id}`] } }, pagination: false, depth: 0, overrideAccess: true, req })
  if (!events.docs.some(event => event.key === `confirmed:${row.id}` && event.purpose === 'sample' && event.action === 'confirmed')) return null
  if (events.docs.some(event => relationId(event.contact) !== contactId || !Number.isFinite(Date.parse(event.occurredAt)) || Date.parse(event.occurredAt) >= Date.parse(cutoff))) return null
  return { deliveries: deliveries.docs, events: events.docs }
}

/** Retains active opt-in evidence and uncertain work; never calls an external provider. */
export async function expireConfirmedSamples(payload: Payload, cutoff: string, now: number, apply: boolean): Promise<ConfirmedSampleRetentionReport> {
  const whereFor = (afterId?: string): Where => ({ and: [{ confirmedAt: { less_than: cutoff } }, ...(afterId ? [{ id: { greater_than: afterId } }] : [])] })
  const report: ConfirmedSampleRetentionReport = { candidates: (await payload.count({ collection: 'magnet-requests', where: whereFor(), overrideAccess: true })).totalDocs, eligible: 0, processed: 0, removedDeliveries: 0, removedConsentEvents: 0, preservedForReconciliation: 0 }
  let afterId: string | undefined
  while (true) {
    const rows = await payload.find({ collection: 'magnet-requests', where: whereFor(afterId), sort: 'id', limit: BATCH, depth: 0, overrideAccess: true })
    if (!rows.docs.length) break
    for (const row of rows.docs) {
      afterId = row.id
      const result = await atomic(payload, async req => {
        const contactId = relationId(row.contact)
        if (!contactId) return null
        await serial(req, `contact:${contactId}`)
        const current = await payload.findByID({ collection: 'magnet-requests', id: row.id, depth: 0, overrideAccess: true, req, disableErrors: true })
        if (!current || relationId(current.contact) !== contactId) return null
        const relations = await eligibleRelations(payload, current, cutoff, now, req)
        if (!relations) return null
        if (!apply) return { deliveries: 0, events: 0 }
        for (const delivery of relations.deliveries) await payload.delete({ collection: 'email-deliveries', id: delivery.id, overrideAccess: true, req })
        for (const event of relations.events) await payload.delete({ collection: 'consent-events', id: event.id, overrideAccess: true, req })
        await payload.delete({ collection: 'magnet-requests', id: current.id, overrideAccess: true, req })
        return { deliveries: relations.deliveries.length, events: relations.events.length }
      })
      if (!result) { report.preservedForReconciliation++; continue }
      report.eligible++
      if (apply) {
        report.processed++
        report.removedDeliveries += result.deliveries
        report.removedConsentEvents += result.events
      }
    }
    if (rows.docs.length < BATCH) break
  }
  return report
}
