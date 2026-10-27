import type { Payload, PayloadRequest } from 'payload'
import { contactFingerprint } from './contact'
import { atomic, serial } from './transaction'
import { LeadFlowError } from './service'

const relationId = (value: string | { id: string }) => typeof value === 'string' ? value : value.id
type Row = { id: string; state?: string; batch?: string | { id: string } | null }
const linked = async (payload: Payload, collection: string, field: string, id: string, req: PayloadRequest) => {
  const result = await payload.find({ collection: collection as never, where: { [field]: { equals: id } } as never, pagination: false, depth: 0, overrideAccess: true, req })
  return result.docs as unknown as Row[]
}
const sendIncludesContact = (value: unknown, id: string) => {
  if (!value || typeof value !== 'object' || !('recipients' in value) || !Array.isArray(value.recipients)) return false
  return value.recipients.some(item => !!item && typeof item === 'object' && 'contact' in item && item.contact === id)
}

/** Owner request. Shared provider manifests and uncertain sends are retained for reconciliation. */
export async function deleteContactData(payload: Payload, emailInput: string, actorId: string, secret: string, now = Date.now()) {
  const email = emailInput.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new LeadFlowError('invalid_input', 422)
  const fingerprint = contactFingerprint(email, secret)
  return atomic(payload, async req => {
    await serial(req, fingerprint)
    const prior = await payload.find({ collection: 'privacy-request-audit', where: { and: [{ subjectFingerprint: { equals: fingerprint } }, { action: { equals: 'delete' } }, { outcome: { equals: 'completed' } }] }, sort: '-occurredAt', limit: 1, depth: 0, overrideAccess: true, req })
    if (prior.docs[0] && !(await payload.count({ collection: 'contacts', where: { email: { equals: email } }, overrideAccess: true, req })).totalDocs) return { outcome: 'completed' as const, counts: (prior.docs[0].counts ?? {}) as Record<string, number>, blockers: [] as string[] }
    const pendingAudit = (await payload.find({ collection: 'privacy-request-audit', where: { and: [{ subjectFingerprint: { equals: fingerprint } }, { action: { equals: 'delete' } }, { outcome: { equals: 'pending' } }] }, sort: '-occurredAt', limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
    const record = async (outcome: 'not_found' | 'pending' | 'completed', counts: Record<string, number>) => {
      const data = { outcome, counts, actor: actorId, occurredAt: new Date(now).toISOString() }
      if (pendingAudit) await payload.update({ collection: 'privacy-request-audit', id: pendingAudit.id, data, overrideAccess: true, req })
      else await payload.create({ collection: 'privacy-request-audit', overrideAccess: true, req, data: { ...data, subjectFingerprint: fingerprint, action: 'delete' } })
    }
    const found = await payload.find({ collection: 'contacts', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true, req })
    const contact = found.docs[0]
    const counts: Record<string, number> = {}
    if (!contact) {
      await record('not_found', counts)
      return { outcome: 'not_found' as const, counts, blockers: [] as string[] }
    }
    await serial(req, `contact:${contact.id}`)
    const requests = await linked(payload, 'magnet-requests', 'contact', contact.id, req)
    const deliveries = await linked(payload, 'email-deliveries', 'contact', contact.id, req)
    const enrollments = await linked(payload, 'sequence-enrollments', 'contact', contact.id, req)
    const promotions = await linked(payload, 'promotion-deliveries', 'contact', contact.id, req)
    const blockers: string[] = []
    if (deliveries.some(row => row.state && ['sending', 'uncertain'].includes(row.state))) blockers.push('delivery_in_flight_or_uncertain')
    if (promotions.some(row => row.state && ['sending', 'uncertain', 'accepted'].includes(row.state))) blockers.push('promotion_requires_reconciliation')
    if ((await linked(payload, 'brevo-registrations', 'contact', contact.id, req)).length) blockers.push('provider_registration_requires_reconciliation')
    if ((await linked(payload, 'brevo-suppressions', 'contact', contact.id, req)).length) blockers.push('provider_suppression_requires_reconciliation')
    if ((await linked(payload, 'brevo-webhook-events', 'contact', contact.id, req)).some(row => row.state === 'pending' || row.state === 'processing')) blockers.push('provider_webhook_pending')
    const batchIds = [...new Set(promotions.map(row => row.batch && relationId(row.batch)).filter(Boolean))]
    if (batchIds.length) blockers.push('shared_campaign_manifest_requires_reconciliation')
    const sends = await payload.find({ collection: 'brevo-campaign-sends', pagination: false, depth: 0, overrideAccess: true, req })
    if (sends.docs.some(send => sendIncludesContact(send.recipientIdentities, contact.id))) blockers.push('provider_send_manifest_requires_reconciliation')
    if (blockers.length) {
      counts.contacts = 1
      await record('pending', counts)
      return { outcome: 'pending' as const, counts, blockers }
    }
    const subscriptions = await linked(payload, 'subscriptions', 'contact', contact.id, req)
    const consentEvents = await linked(payload, 'consent-events', 'contact', contact.id, req)
    const tokens = await linked(payload, 'preference-tokens', 'contact', contact.id, req)
    const registrations = await linked(payload, 'brevo-registrations', 'contact', contact.id, req)
    const suppressions = await linked(payload, 'brevo-suppressions', 'contact', contact.id, req)
    const webhooks = await linked(payload, 'brevo-webhook-events', 'contact', contact.id, req)
    const receipts = promotions.length ? await payload.find({ collection: 'brevo-delivery-receipts', where: { delivery: { in: promotions.map(row => row.id) } }, pagination: false, depth: 0, overrideAccess: true, req }) : { docs: [] }
    const remove = async (collection: string, rows: Array<{id:string}>) => { counts[collection] = rows.length; for (const row of rows) await payload.delete({ collection: collection as never, id: row.id, overrideAccess: true, req }) }
    await remove('brevo-delivery-receipts', receipts.docs)
    await remove('promotion-deliveries', promotions)
    await remove('sequence-enrollments', enrollments)
    await remove('email-deliveries', deliveries)
    await remove('magnet-requests', requests)
    await remove('subscriptions', subscriptions)
    await remove('consent-events', consentEvents)
    await remove('preference-tokens', tokens)
    await remove('brevo-webhook-events', webhooks)
    await remove('brevo-registrations', registrations)
    await remove('brevo-suppressions', suppressions)
    const requestLimits = await payload.find({ collection: 'request-limits', where: { key: { like: `%:${fingerprint}` } }, pagination: false, depth: 0, overrideAccess: true, req })
    await remove('request-limits', requestLimits.docs)
    await payload.delete({ collection: 'contacts', id: contact.id, overrideAccess: true, req })
    counts.contacts = 1
    await record('completed', counts)
    return { outcome: 'completed' as const, counts, blockers: [] as string[] }
  })
}
