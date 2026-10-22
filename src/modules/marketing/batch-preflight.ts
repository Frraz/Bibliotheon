import type { Payload } from 'payload'
import { configuredBrevoContacts, type BrevoContacts, type ContactLookup } from '../../integrations/brevo/contacts'
import { atomic } from './transaction'
import { reviewPreparedBatch } from './batch-review'
import { applyObservedProviderBlock } from './suppression'
import { validLinkSecret } from './tokens'
import { validProviderCheck, type ProviderCheck } from './batch-check-copy'

/** Authenticated GET only; no quota, contact creation, list mutation, campaign or send. */
export async function checkPromotionBatch(payload: Payload, id: string, options: { client?: BrevoContacts | null; secret?: string; now?: number; clock?: () => number } = {}) {
  const client = options.client === undefined ? configuredBrevoContacts() : options.client
  const secret = options.secret ?? process.env.LEAD_TOKEN_SECRET
  if (!client || !validLinkSecret(secret)) return { state: 'disabled' as const }
  const clock = options.clock ?? (options.now === undefined ? Date.now : () => options.now!)
  const captured = await atomic(payload, req => reviewPreparedBatch(req, id, clock()))
  if (captured.state !== 'ready') return captured
  const check: ProviderCheck = { version: 1, batchKey: captured.batch.key, checkedAt: new Date(clock()).toISOString(), recipients: [] }
  let failure: 'provider_absent' | 'provider_unavailable' | 'provider_rejected' | null = null
  for (const recipient of captured.recipients) {
    let result: ContactLookup
    try { result = await client.inspect(recipient.email) } catch { result = { state: 'retry' } }
    if (!result || result.state !== 'found' || !Number.isSafeInteger(result.id) || result.id < 1 || typeof result.blocked !== 'boolean') {
      failure = result?.state === 'absent' ? 'provider_absent' : result?.state === 'rejected' ? 'provider_rejected' : 'provider_unavailable'
      break
    }
    if (result.blocked) {
      await applyObservedProviderBlock(payload, { contactId: recipient.contact, email: recipient.email, providerId: result.id, observedAt: clock() }, secret)
      failure = 'provider_unavailable'; break
    }
    check.recipients.push({ contact: recipient.contact, version: recipient.version, providerId: result.id })
  }
  return atomic(payload, async req => {
    const reviewed = await reviewPreparedBatch(req, id, clock())
    if (reviewed.state !== 'ready') return reviewed
    if (reviewed.batch.key !== captured.batch.key || !validProviderCheck(check, reviewed.batch.key, reviewed.recipients, clock())) failure ??= 'provider_unavailable'
    if (failure) {
      await payload.update({ collection: 'email-campaign-batches', id, data: { providerCheck: null, errorCode: failure, nextAttemptAt: new Date(clock() + 900_000).toISOString() }, overrideAccess: true, req })
      return { state: 'provider_check' as const }
    }
    await payload.update({ collection: 'email-campaign-batches', id, data: { providerCheck: check, errorCode: null }, overrideAccess: true, req })
    return { state: 'ready' as const }
  })
}
