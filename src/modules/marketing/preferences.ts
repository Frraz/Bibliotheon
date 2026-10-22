import type { Payload, PayloadRequest } from 'payload'
import { hashOpaqueToken } from './tokens'
import { LeadFlowError } from './service'
import { atomic, serial } from './transaction'
import { idOf } from './sequence-copy'
import { cancelPromotions } from './sequence-state'
import { cancelBrevoRegistration } from './brevo-registration-queue'
import { enqueueBrevoSuppression } from './brevo-suppression-queue'

async function authorize(req: PayloadRequest, token: unknown, now: number) {
  const hash = hashOpaqueToken(token)
  if (!hash) throw new LeadFlowError('expired', 410)
  const preference = (await req.payload.find({ collection: 'preference-tokens', where: { tokenHash: { equals: hash } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
  if (!preference || !Number.isFinite(Date.parse(preference.expiresAt)) || Date.parse(preference.expiresAt) <= now) throw new LeadFlowError('expired', 410)
  const contact = idOf(preference.contact)
  await serial(req, `contact:${contact}`)
  return { contact, preference }
}

/** Explicit POST only; returns this contact's subscribed themes, never address or other contacts. */
export async function readPreferences(payload: Payload, token: unknown, now = Date.now()) {
  return atomic(payload, async req => {
    const { contact } = await authorize(req, token, now)
    const person = await payload.findByID({ collection: 'contacts', id: contact, depth: 0, overrideAccess: true, req })
    const suppressed = !!person.globalSuppressedAt || person.deliveryState !== 'ok'
    if (suppressed) return { suppressed: true, themes: [] }
    const subscriptions = await payload.find({ collection: 'subscriptions', where: { and: [{ contact: { equals: contact } }, { state: { equals: 'subscribed' } }] }, pagination: false, depth: 0, overrideAccess: true, req })
    const themes = []
    for (const subscription of subscriptions.docs) {
      const theme = await payload.findByID({ collection: 'themes', id: idOf(subscription.theme), depth: 0, overrideAccess: true, req })
      themes.push({ id: theme.id, title: theme.name })
    }
    return { suppressed: false, themes: themes.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')) }
  })
}

/** Withdrawal only. Re-subscription always goes through a new explicit request and confirmation. */
export async function unsubscribeTheme(payload: Payload, token: unknown, theme: unknown, now = Date.now()) {
  if (typeof theme !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(theme)) throw new LeadFlowError('invalid_input', 422)
  return atomic(payload, async req => {
    const { contact } = await authorize(req, token, now)
    const subscription = (await payload.find({ collection: 'subscriptions', where: { and: [{ contact: { equals: contact } }, { theme: { equals: theme } }] }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
    if (!subscription) throw new LeadFlowError('invalid_input', 422)
    if (subscription.state === 'unsubscribed') return
    const at = new Date(now).toISOString()
    await payload.update({ collection: 'subscriptions', id: subscription.id, data: { state: 'unsubscribed', unsubscribedAt: at }, overrideAccess: true, req })
    await cancelPromotions(req, { and: [{ contact: { equals: contact } }, { theme: { equals: theme } }] }, now)
    await payload.create({ collection: 'consent-events', data: { contact, theme, purpose: 'marketing', action: 'unsubscribed', occurredAt: at, key: `theme-unsubscribe:${subscription.id}:${at}` }, overrideAccess: true, req })
    const remaining = await payload.count({ collection: 'subscriptions', where: { and: [{ contact: { equals: contact } }, { state: { equals: 'subscribed' } }] }, overrideAccess: true, req })
    if (!remaining.totalDocs) {
      await cancelBrevoRegistration(req, contact, now)
      await enqueueBrevoSuppression(req, contact, now)
    }
  })
}
