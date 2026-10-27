import { cancelBrevoRegistration } from './brevo-registration-queue'
import { enqueueBrevoSuppression } from './brevo-suppression-queue'
import { createHmac } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'
import type { Contact } from '../../payload-types'
import { contactFingerprint } from './contact'
import { LeadFlowError } from './service'
import { validLinkSecret } from './tokens'
import { atomic, serial } from './transaction'
import { normalizeEmail } from './validation'
import { cancelPromotions } from './sequence-state'
import { retainSuppressionTombstone } from './suppression-tombstone'
import { privacySubjectBlocked } from './privacy-block'

type Reason = 'unsubscribed' | 'bounced' | 'complaint'
export type SuppressionInput = { email: string; reason: Reason; source: 'manual' | 'brevo-review'; reference: string }
export function parseSuppressionInput(value: unknown): SuppressionInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  if (Object.keys(data).some(key => !['email', 'reason', 'source', 'reference'].includes(key))) return null
  const email = normalizeEmail(data.email)
  if (!email || typeof data.reason !== 'string' || !['unsubscribed', 'bounced', 'complaint'].includes(data.reason) || typeof data.source !== 'string' || !['manual', 'brevo-review'].includes(data.source)) return null
  if (typeof data.reference !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(data.reference)) return null
  return { email, reason: data.reason as Reason, source: data.source as SuppressionInput['source'], reference: data.reference }
}

/** Reviewed operator input, never an unauthenticated provider webhook or a consent import. */
export async function applySuppression(payload: Payload, input: SuppressionInput, secret: string, now = Date.now()) {
  if (!validLinkSecret(secret)) throw new LeadFlowError('unavailable', 503)
  const parsed = parseSuppressionInput(input)
  if (!parsed) throw new LeadFlowError('invalid_input', 422)
  const { email, reason, source, reference } = parsed
  // Retain neither the provider payload nor the submitted reference in the audit key.
  const key = `suppression:${source}:${createHmac('sha256', secret).update(reference).digest('hex')}`
  return atomic(payload, async req => {
    await serial(req, key)
    const previous = (await payload.find({ collection: 'consent-events', where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
    if (previous) {
      const id = typeof previous.contact === 'string' ? previous.contact : previous.contact.id
      const contact = await payload.findByID({ collection: 'contacts', id, depth: 0, overrideAccess: true, req })
      if (contact.email !== email || previous.action !== reason) throw new LeadFlowError('invalid_input', 422)
      return { applied: false, canceledPending: 0, inFlight: 0 }
    }
    await serial(req, contactFingerprint(email, secret))
    const erased = await payload.count({ collection: 'privacy-request-audit', where: { and: [{ subjectFingerprint: { equals: contactFingerprint(email, secret) } }, { action: { in: ['delete', 'correct'] } }, { outcome: { equals: 'completed' } }] }, overrideAccess: true, req })
    if (erased.totalDocs) throw new LeadFlowError('unavailable', 503)
    let contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
    if (!contact && await privacySubjectBlocked(payload,email,secret,req)) throw new LeadFlowError('unavailable',503)
    if (!contact) contact = await payload.create({ collection: 'contacts', data: { email, deliveryState: 'ok' }, overrideAccess: true, req })
    await serial(req, `contact:${contact.id}`)
    contact = await payload.findByID({ collection: 'contacts', id: contact.id, depth: 0, overrideAccess: true, req })
    return suppressLockedContact(req, contact, reason, key, now, secret)
  })
}

/** Caller holds the contact lock; identity and audit key were already checked. */
export async function suppressLockedContact(req: PayloadRequest, contact: Contact, reason: Reason | 'provider_blocked', key: string, now: number, secret: string) {
  const { payload } = req
  const at = new Date(now).toISOString()
  await retainSuppressionTombstone(payload, contact.email, secret, now, req)
  // Suppression can only become stricter here; it never clears bounce, complaint or consent.
  const deliveryState = contact.deliveryState === 'complaint' || reason === 'complaint' ? 'complaint' : contact.deliveryState === 'bounced' || reason === 'bounced' ? 'bounced' : 'ok'
  await payload.update({ collection: 'contacts', id: contact.id, data: { globalSuppressedAt: contact.globalSuppressedAt || at, deliveryState }, overrideAccess: true, req })
  const subscriptions = await payload.update({ collection: 'subscriptions', where: { and: [{ contact: { equals: contact.id } }, { state: { not_equals: 'unsubscribed' } }] }, data: { state: 'unsubscribed', unsubscribedAt: at }, overrideAccess: true, req })
  if (subscriptions.errors.length) throw new LeadFlowError('unavailable', 503)
  await cancelPromotions(req, { contact: { equals: contact.id } }, now)
  await enqueueBrevoSuppression(req, contact.id, now)
  await cancelBrevoRegistration(req, contact.id, now)
  let canceledPending = 0, inFlight = 0
  if (deliveryState !== 'ok') {
    const canceled = await payload.update({ collection: 'email-deliveries', where: { and: [{ contact: { equals: contact.id } }, { state: { equals: 'pending' } }] }, data: { state: 'canceled', errorCode: 'recipient_suppressed' }, overrideAccess: true, req })
    canceledPending = canceled.docs.length
    if (canceled.errors.length) throw new LeadFlowError('unavailable', 503)
    inFlight = (await payload.count({ collection: 'email-deliveries', where: { and: [{ contact: { equals: contact.id } }, { state: { equals: 'sending' } }] }, overrideAccess: true, req })).totalDocs
  }
  await payload.create({ collection: 'consent-events', data: { contact: contact.id, purpose: 'marketing', action: reason, occurredAt: at, key }, overrideAccess: true, req })
  return { applied: true, canceledPending, inFlight }
}

/** Authenticated lookup observation, never a public webhook or an inferred bounce/complaint. */
export async function applyObservedProviderBlock(payload: Payload, input: { contactId: string; email: string; providerId: number; observedAt: number }, secret: string) {
  if (!validLinkSecret(secret) || normalizeEmail(input.email) !== input.email || !Number.isSafeInteger(input.providerId) || input.providerId < 1 || !Number.isSafeInteger(input.observedAt) || input.observedAt < 0) throw new LeadFlowError('invalid_input', 422)
  const key = `brevo-contact-check:${createHmac('sha256', secret).update(JSON.stringify([input.contactId, input.providerId, input.observedAt])).digest('hex')}`
  return atomic(payload, async req => {
    await serial(req, `contact:${input.contactId}`)
    const contact = (await payload.find({ collection: 'contacts', where: { id: { equals: input.contactId } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
    if (!contact || contact.email !== input.email) return { applied: false }
    if ((await payload.count({ collection: 'consent-events', where: { key: { equals: key } }, overrideAccess: true, req })).totalDocs) return { applied: false }
    return suppressLockedContact(req, contact, 'provider_blocked', key, input.observedAt, secret)
  })
}
