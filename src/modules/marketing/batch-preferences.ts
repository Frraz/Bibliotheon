import type { Payload } from 'payload'
import { configuredBrevoPreferences, type BrevoPreferences } from '../../integrations/brevo/preferences'
import { configuredBrevoContacts, type BrevoContacts } from '../../integrations/brevo/contacts'
import { atomic } from './transaction'
import { checkPromotionBatch } from './batch-preflight'
import { reviewPreparedBatch } from './batch-review'
import { validProviderCheck, PROVIDER_CHECK_TTL } from './batch-check-copy'
import { issuePreferenceLink, preferenceOrigin } from './preference-links'
import { applyObservedProviderBlock } from './suppression'
import { validLinkSecret } from './tokens'

export type PreferenceCheck = { version: 1; batchKey: string; checkedAt: string; recipients: { contact: string; version: string; providerId: number; tokenId: string; expiresAt: string }[] }
/** Prepare individualized withdrawal links only. No campaign, reservation or send. */
export async function prepareBrevoBatchPreferences(payload: Payload, id: string, options: { preferences?: BrevoPreferences | null; contacts?: BrevoContacts | null; secret?: string; origin?: string; now?: number; clock?: () => number } = {}) {
  const preferences = options.preferences === undefined ? configuredBrevoPreferences() : options.preferences
  const contacts = options.contacts === undefined ? configuredBrevoContacts() : options.contacts
  const secret = options.secret ?? process.env.LEAD_TOKEN_SECRET, origin = options.origin ?? process.env.PUBLIC_SITE_URL
  if (!preferences || !contacts || !validLinkSecret(secret) || !origin) return { state: 'disabled' as const }
  const site = preferenceOrigin(origin), clock = options.clock ?? (options.now === undefined ? Date.now : () => options.now!)
  const preflight = await checkPromotionBatch(payload, id, { client: contacts, secret, clock })
  if (preflight.state !== 'ready') return preflight
  const captured = await atomic(payload, async req => {
    const reviewed = await reviewPreparedBatch(req, id, clock())
    if (reviewed.state !== 'ready') return reviewed
    if (!validProviderCheck(reviewed.batch.providerCheck, reviewed.batch.key, reviewed.recipients, clock())) return { state: 'provider_check' as const }
    await payload.update({ collection: 'email-campaign-batches', id, data: { preferenceCheck: null }, overrideAccess: true, req })
    const recipients = []
    for (const recipient of reviewed.recipients) {
      const identity = reviewed.batch.providerCheck.recipients.find(item => item.contact === recipient.contact)!
      const link = await issuePreferenceLink(req, recipient.contact, secret, site, clock())
      recipients.push({ ...recipient, providerId: identity.providerId, ...link })
    }
    return { state: 'ready' as const, key: reviewed.batch.key, recipients }
  })
  if (captured.state !== 'ready') return captured
  const check: PreferenceCheck = { version: 1, batchKey: captured.key, checkedAt: new Date(clock()).toISOString(), recipients: [] }
  let failed = false
  for (const recipient of captured.recipients) {
    let result
    try { result = await preferences.ensure(recipient.providerId, recipient.email, recipient.url) } catch { result = { state: 'retry' } }
    if (result?.state === 'blocked') await applyObservedProviderBlock(payload, { contactId: recipient.contact, email: recipient.email, providerId: recipient.providerId, observedAt: clock() }, secret)
    if (result?.state !== 'verified') { failed = true; break }
    check.recipients.push({ contact: recipient.contact, version: recipient.version, providerId: recipient.providerId, tokenId: recipient.tokenId, expiresAt: recipient.expiresAt })
  }
  return atomic(payload, async req => {
    const reviewed = await reviewPreparedBatch(req, id, clock())
    if (reviewed.state !== 'ready') return reviewed
    const checkedAt = Date.parse(check.checkedAt)
    if (check.batchKey !== reviewed.batch.key || check.recipients.length !== reviewed.recipients.length || clock() < checkedAt || clock() - checkedAt > PROVIDER_CHECK_TTL) failed = true
    const currentProof = reviewed.batch.providerCheck
    const proofValid = validProviderCheck(currentProof, reviewed.batch.key, reviewed.recipients, clock())
    const currentIds = proofValid ? new Map(currentProof.recipients.map(person => [person.contact, person.providerId])) : new Map<string, number>()
    if (!proofValid) failed = true
    for (const recipient of check.recipients) {
      if (!reviewed.recipients.some(person => person.contact === recipient.contact && person.version === recipient.version) || currentIds.get(recipient.contact) !== recipient.providerId) { failed = true; continue }
      const token = await payload.findByID({ collection: 'preference-tokens', id: recipient.tokenId, depth: 0, overrideAccess: true, req })
      const currentId = typeof token.contact === 'string' ? token.contact : token.contact.id
      if (currentId !== recipient.contact || Date.parse(token.expiresAt) <= clock() || token.expiresAt !== recipient.expiresAt || token.tokenHash !== captured.recipients.find(person => person.contact === recipient.contact)?.tokenHash) failed = true
    }
    await payload.update({ collection: 'email-campaign-batches', id, data: { preferenceCheck: failed ? null : check, ...(failed ? { nextAttemptAt: new Date(clock() + 900_000).toISOString() } : {}) }, overrideAccess: true, req })
    return { state: failed ? 'preference_check' as const : 'ready' as const }
  })
}
