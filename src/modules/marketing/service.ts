import type { Payload, PayloadRequest } from 'payload'
import type { LeadInput } from './validation'
import { atomic, serial } from './transaction'
import { CONFIRMATION_TTL, hashOpaqueToken, signDownload, validLinkSecret } from './tokens'
import { contactFingerprint } from './contact'
import { enrollSequence } from './sequence'
import { cancelPromotions } from './sequence-state'

const relationId = (v: string | { id: string }) => typeof v === 'string' ? v : v.id
export class LeadFlowError extends Error {
  constructor(public code: 'invalid_input' | 'rate_limited' | 'expired' | 'unavailable', public status: 422 | 429 | 410 | 503) { super(code) }
}
export async function availableMagnet(payload: Payload, id: string, req?: PayloadRequest) {
  const magnets = await payload.find({ collection: 'lead-magnets', where: { and: [{ id: { equals: id } }, { active: { equals: true } }] }, limit: 1, depth: 0, overrideAccess: true, req })
  const magnet = magnets.docs[0]
  if (!magnet) return null
  const books = await payload.find({ collection: 'ebooks', where: { and: [{ id: { equals: relationId(magnet.ebook) } }, { _status: { equals: 'published' } }, { archived: { not_equals: true } }] }, draft: false, limit: 1, depth: 0, overrideAccess: true, req })
  const book = books.docs[0]
  if (!book?.theme) return null
  const themes = await payload.find({ collection: 'themes', where: { and: [{ id: { equals: relationId(book.theme) } }, { _status: { equals: 'published' } }, { archived: { not_equals: true } }] }, draft: false, limit: 1, depth: 0, overrideAccess: true, req })
  if (!themes.docs[0]) return null
  const media = await payload.find({ collection: 'media', where: { and: [{ id: { equals: relationId(magnet.media) } }, { visibility: { equals: 'private' } }, { presentationRole: { equals: 'sample' } }, { mimeType: { equals: 'application/pdf' } }] }, limit: 1, depth: 0, overrideAccess: true, req })
  return media.docs[0] ? { magnet, book, theme: themes.docs[0], media: media.docs[0] } : null
}
/** A pending request and its outbox entry commit together. No raw link token is persisted. */
export async function requestMagnet(payload: Payload, input: LeadInput, secret: string, now = Date.now()) {
  if (!validLinkSecret(secret)) throw new LeadFlowError('unavailable', 503)
  const perAddressLimit = Number(process.env.LEAD_REQUESTS_PER_ADDRESS_DAY || '5')
  if (!Number.isInteger(perAddressLimit) || perAddressLimit < 1 || perAddressLimit > 20) throw new LeadFlowError('unavailable', 503)
  return atomic(payload, async req => {
    const material = await availableMagnet(payload, input.magnetId, req)
    if (!material) throw new LeadFlowError('invalid_input', 422)
    const fingerprint = contactFingerprint(input.email, secret)
    await serial(req, fingerprint)
    const recent = await payload.find({ collection: 'contacts', where: { email: { equals: input.email } }, limit: 1, depth: 0, overrideAccess: true, req })
    let contact = recent.docs[0]
    if (contact) {
      await serial(req, `contact:${contact.id}`)
      contact = await payload.findByID({ collection: 'contacts', id: contact.id, depth: 0, overrideAccess: true, req })
      const duplicate = await payload.find({ collection: 'magnet-requests', where: { and: [{ contact: { equals: contact.id } }, { magnet: { equals: material.magnet.id } }, { createdAt: { greater_than: new Date(now - 15 * 60_000).toISOString() } }] }, limit: 1, depth: 0, overrideAccess: true, req })
      const pending = duplicate.docs[0]
      if (pending) {
        // A repeat may withdraw a still-unconfirmed opt-in, never silently upgrade it.
        // Confirmed subscriptions are managed by their own unsubscribe flow.
        if (!pending.confirmedAt && pending.marketingOptIn && !input.marketingOptIn) await payload.update({ collection: 'magnet-requests', id: pending.id, data: { marketingOptIn: false, consentVersion: null }, overrideAccess: true, req })
        return
      }
    }
    const day = new Date(now).toISOString().slice(0, 10)
    // Bound a spray of distinct addresses without trusting client-supplied IP headers.
    await serial(req, 'request-budget')
    for (const [key, maximum, expiresAt] of [
      [`global-hour:${new Date(now).toISOString().slice(0, 13)}`, 250, new Date(Math.floor(now / 3_600_000) * 3_600_000 + 3_600_000).toISOString()],
      [`global-day:${day}`, 1000, new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString()],
    ] as const) {
      const buckets = await payload.find({ collection: 'request-limits', where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true, req })
      const bucket = buckets.docs[0]
      if (bucket && bucket.count >= maximum) throw new LeadFlowError('rate_limited', 429)
      if (bucket) await payload.update({ collection: 'request-limits', id: bucket.id, data: { count: bucket.count + 1 }, overrideAccess: true, req })
      else await payload.create({ collection: 'request-limits', data: { key, count: 1, expiresAt }, overrideAccess: true, req })
    }
    const limitKey = `${day}:${fingerprint}`
    const limits = await payload.find({ collection: 'request-limits', where: { key: { equals: limitKey } }, limit: 1, depth: 0, overrideAccess: true, req })
    const counter = limits.docs[0]
    if (counter && counter.count >= perAddressLimit) throw new LeadFlowError('rate_limited', 429)
    if (counter) await payload.update({ collection: 'request-limits', id: counter.id, data: { count: counter.count + 1 }, overrideAccess: true, req })
    else await payload.create({ collection: 'request-limits', data: { key: limitKey, count: 1, expiresAt: new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString() }, overrideAccess: true, req })
    if (!contact) contact = await payload.create({ collection: 'contacts', data: { email: input.email, deliveryState: 'ok' }, overrideAccess: true, req })
    // Bounce/complaint prevent delivery; generic response never reveals the contact's status.
    if (contact.deliveryState !== 'ok') return
    const request = await payload.create({ collection: 'magnet-requests', data: { contact: contact.id, magnet: material.magnet.id, theme: material.theme.id, magnetVersion: material.magnet.version, marketingOptIn: input.marketingOptIn, consentVersion: input.consentVersion, campaignCode: input.campaignCode, expiresAt: new Date(now + CONFIRMATION_TTL).toISOString() }, overrideAccess: true, req })
    await payload.create({ collection: 'consent-events', data: { contact: contact.id, theme: material.theme.id, purpose: 'sample', action: 'requested', version: material.magnet.version, occurredAt: new Date(now).toISOString(), key: `requested:${request.id}` }, overrideAccess: true, req })
    await payload.create({ collection: 'email-deliveries', data: { key: `confirmation:${request.id}`, contact: contact.id, request: request.id, kind: 'confirmation', state: 'pending', attempts: 0, nextAttemptAt: new Date(now).toISOString() }, overrideAccess: true, req })
  })
}
export async function confirmMagnet(payload: Payload, token: unknown, secret: string, now = Date.now()) {
  const hash = hashOpaqueToken(token)
  if (!hash) throw new LeadFlowError('expired', 410)
  return atomic(payload, async req => {
    await serial(req, `confirmation:${hash}`)
    const found = await payload.find({ collection: 'magnet-requests', where: { confirmationTokenHash: { equals: hash } }, limit: 1, depth: 0, overrideAccess: true, req })
    let request = found.docs[0]
    if (!request) throw new LeadFlowError('expired', 410)
    const contactId = relationId(request.contact)
    await serial(req, `contact:${contactId}`)
    // Re-read after the shared lock: a pending opt-in may have been withdrawn,
    // or a retry may have rotated this confirmation token while we waited.
    request = await payload.findByID({ collection: 'magnet-requests', id: request.id, depth: 0, overrideAccess: true, req })
    if (request.confirmationTokenHash !== hash || request.revokedAt || Date.parse(request.expiresAt) <= now) throw new LeadFlowError('expired', 410)
    const material = await availableMagnet(payload, relationId(request.magnet), req)
    if (!material || material.magnet.version !== request.magnetVersion || material.theme.id !== relationId(request.theme)) throw new LeadFlowError('expired', 410)
    const contact = await payload.findByID({ collection: 'contacts', id: contactId, depth: 0, overrideAccess: true, req })
    if (contact.deliveryState !== 'ok') throw new LeadFlowError('expired', 410)
    const at = new Date(now).toISOString()
    if (!request.confirmedAt) {
      await payload.update({ collection: 'magnet-requests', id: request.id, data: { confirmedAt: at }, overrideAccess: true, req })
      if (!contact.confirmedAt) await payload.update({ collection: 'contacts', id: contactId, data: { confirmedAt: at }, overrideAccess: true, req })
      await payload.create({ collection: 'consent-events', data: { contact: contactId, theme: material.theme.id, purpose: 'sample', action: 'confirmed', version: request.magnetVersion, occurredAt: at, key: `confirmed:${request.id}` }, overrideAccess: true, req })
      // A confirmation of an old request cannot undo a later unsubscribe.
      if (request.marketingOptIn && (!contact.globalSuppressedAt || Date.parse(contact.globalSuppressedAt) < Date.parse(request.createdAt))) {
        const subKey = `${contactId}:${material.theme.id}`
        const subscriptions = await payload.find({ collection: 'subscriptions', where: { key: { equals: subKey } }, limit: 1, depth: 0, overrideAccess: true, req })
        const subscription = subscriptions.docs[0]
        if (!subscription?.unsubscribedAt || Date.parse(subscription.unsubscribedAt) < Date.parse(request.createdAt)) {
          const data = { state: 'subscribed' as const, consentVersion: request.consentVersion, subscribedAt: at, unsubscribedAt: null }
          if (subscription) await payload.update({ collection: 'subscriptions', id: subscription.id, data, overrideAccess: true, req })
          else await payload.create({ collection: 'subscriptions', data: { ...data, contact: contactId, theme: material.theme.id, key: subKey }, overrideAccess: true, req })
          if (contact.globalSuppressedAt) await payload.update({ collection: 'contacts', id: contactId, data: { globalSuppressedAt: null }, overrideAccess: true, req })
          await payload.create({ collection: 'consent-events', data: { contact: contactId, theme: material.theme.id, purpose: 'marketing', action: 'subscribed', version: request.consentVersion, occurredAt: at, key: `subscribed:${request.id}` }, overrideAccess: true, req })
          await enrollSequence(req, request, material.book.id, at)
        }
      }
      await payload.create({ collection: 'email-deliveries', data: { key: `delivery:${request.id}`, contact: contactId, request: request.id, kind: 'delivery', state: 'pending', attempts: 0, nextAttemptAt: at }, overrideAccess: true, req })
    }
    return { title: material.magnet.title, downloadUrl: `/api/v1/downloads/${signDownload(request.id, secret, now)}` }
  })
}

export async function unsubscribe(payload: Payload, token: unknown, now = Date.now()) {
  const hash = hashOpaqueToken(token)
  if (!hash) throw new LeadFlowError('expired', 410)
  return atomic(payload, async req => {
    const tokens = await payload.find({ collection: 'preference-tokens', where: { tokenHash: { equals: hash } }, limit: 1, depth: 0, overrideAccess: true, req })
    const preference = tokens.docs[0]
    if (!preference || Date.parse(preference.expiresAt) <= now) throw new LeadFlowError('expired', 410)
    const contactId = relationId(preference.contact)
    await serial(req, `contact:${contactId}`)
    const contact = await payload.findByID({ collection: 'contacts', id: contactId, depth: 0, overrideAccess: true, req })
    if (contact.globalSuppressedAt) return
    const at = new Date(now).toISOString()
    await payload.update({ collection: 'contacts', id: contactId, data: { globalSuppressedAt: at }, overrideAccess: true, req })
    await payload.update({ collection: 'subscriptions', where: { and: [{ contact: { equals: contactId } }, { state: { not_equals: 'unsubscribed' } }] }, data: { state: 'unsubscribed', unsubscribedAt: at }, overrideAccess: true, req })
    await cancelPromotions(req, { contact: { equals: contactId } }, now)
    await payload.create({ collection: 'consent-events', data: { contact: contactId, purpose: 'marketing', action: 'unsubscribed', occurredAt: at, key: `unsubscribe:${preference.id}:${at}` }, overrideAccess: true, req })
    // Transactional confirmations and the explicitly requested sample remain independent.
  })
}
