import type { Payload } from 'payload'
import { contactFingerprint } from './contact'
import { atomic, serial } from './transaction'
import { LeadFlowError } from './service'
import { normalizeEmail } from './validation'
import { enqueueBrevoRegistration } from './brevo-registration-queue'
import { hasContactSharedMarketingReference } from './privacy-shared-reference'
import { planLocalPrivacyBatches, dissolveLocalPrivacyBatches } from './privacy-local-batches'
import { isLocalRegistrationIntent, isLocalSuppressionIntent } from './privacy-local-intents'

type ContactRow = { id: string; state?: string; kind?: string; attempts?: number; providerId?: number | null; startedAt?: string | null; syncedAt?: string | null; outcome?: string | null; batch?: string | { id: string } | null; recipientIdentities?: unknown }
const linked = async (payload: Payload, collection: string, id: string, req: import('payload').PayloadRequest) => (await payload.find({ collection: collection as never, where: { contact: { equals: id } } as never, pagination: false, depth: 0, overrideAccess: true, req })).docs as unknown as ContactRow[]

/** Updates local contact identity while preserving consent; external/uncertain identities require reconciliation. */
export async function correctContactEmail(payload: Payload, previousInput: string, correctedInput: string, actorId: string, secret: string, now = Date.now()) {
  const previousEmail = normalizeEmail(previousInput), correctedEmail = normalizeEmail(correctedInput)
  if (!previousEmail || !correctedEmail || previousEmail === correctedEmail) throw new LeadFlowError('invalid_input', 422)
  const previousFingerprint = contactFingerprint(previousEmail, secret)
  const correctedFingerprint = contactFingerprint(correctedEmail, secret)
  return atomic(payload, async req => {
    for (const fingerprint of [previousFingerprint, correctedFingerprint].sort()) await serial(req, fingerprint)
    const prior = await payload.find({ collection: 'privacy-request-audit', where: { and: [{ subjectFingerprint: { equals: previousFingerprint } }, { action: { equals: 'correct' } }, { outcome: { equals: 'completed' } }] }, sort: '-occurredAt', limit: 1, depth: 0, overrideAccess: true, req })
    if (prior.docs[0]) return { outcome: 'completed' as const, counts: prior.docs[0].counts as Record<string, number>, blockers: [] as string[] }
    const contactResult = await payload.find({ collection: 'contacts', where: { email: { equals: previousEmail } }, limit: 1, depth: 0, overrideAccess: true, req })
    const contact = contactResult.docs[0]
    const target = await payload.find({ collection: 'contacts', where: { email: { equals: correctedEmail } }, limit: 1, depth: 0, overrideAccess: true, req })
    const existingAudit = (await payload.find({ collection: 'privacy-request-audit', where: { and: [{ subjectFingerprint: { equals: previousFingerprint } }, { action: { equals: 'correct' } }, { outcome: { equals: 'pending' } }] }, sort: '-occurredAt', limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
    const record = async (outcome: 'not_found' | 'pending' | 'completed', counts: Record<string, number>) => {
      const data = { outcome, counts, actor: actorId, occurredAt: new Date(now).toISOString() }
      if (existingAudit) await payload.update({ collection: 'privacy-request-audit', id: existingAudit.id, data, overrideAccess: true, req })
      else await payload.create({ collection: 'privacy-request-audit', data: { ...data, subjectFingerprint: previousFingerprint, action: 'correct' }, overrideAccess: true, req })
    }
    if (!contact) { await record('not_found', {}); return { outcome: 'not_found' as const, counts: {}, blockers: [] as string[] } }
    await serial(req, 'promotion-batches')
    const localPlans = await planLocalPrivacyBatches(req, contact.id)
    const localBatchIds = new Set(localPlans.map(plan => plan.id))
    const blockers: string[] = []
    if (target.docs[0]) blockers.push('corrected_address_already_in_use')
    const deleted = await payload.count({ collection: 'privacy-request-audit', where: { and: [{ subjectFingerprint: { equals: correctedFingerprint } }, { action: { in: ['delete', 'correct'] } }, { outcome: { in: ['pending','completed'] } }] }, overrideAccess: true, req })
    if (deleted.totalDocs) blockers.push('corrected_address_has_privacy_tombstone')
    const requests = await linked(payload, 'magnet-requests', contact.id, req)
    const deliveries = await linked(payload, 'email-deliveries', contact.id, req)
    const promotions = await linked(payload, 'promotion-deliveries', contact.id, req)
    if (deliveries.some(row => row.state === 'sending' || row.state === 'uncertain')) blockers.push('delivery_in_flight_or_uncertain')
    if (promotions.some(row => ['sending', 'accepted', 'observed', 'uncertain'].includes(row.state ?? '') || !!row.batch && !localBatchIds.has(typeof row.batch === 'string' ? row.batch : row.batch.id))) blockers.push('promotion_requires_reconciliation')
    const registrations = await linked(payload, 'brevo-registrations', contact.id, req)
    if (registrations.some(row => !isLocalRegistrationIntent(row))) blockers.push('provider_registration_requires_reconciliation')
    const suppressions = await linked(payload, 'brevo-suppressions', contact.id, req)
    if (suppressions.some(row => !isLocalSuppressionIntent(row))) blockers.push('provider_suppression_requires_reconciliation')
    if ((await linked(payload, 'brevo-webhook-events', contact.id, req)).length) blockers.push('provider_webhook_requires_reconciliation')
    if (await hasContactSharedMarketingReference(req, contact, secret, localBatchIds)) blockers.push('shared_campaign_manifest_requires_reconciliation')
    if (blockers.length) {
      const counts = { contacts: 1 }
      await record('pending', counts)
      return { outcome: 'pending' as const, counts, blockers: [...new Set(blockers)] }
    }
    const localBatchCounts = await dissolveLocalPrivacyBatches(req, localPlans)
    let invalidatedRequests = 0, canceledConfirmations = 0
    for (const row of requests) {
      const current = await payload.findByID({ collection: 'magnet-requests', id: row.id, depth: 0, overrideAccess: true, req })
      if (current.confirmedAt || current.revokedAt) continue
      await payload.update({ collection: 'magnet-requests', id: current.id, data: { revokedAt: new Date(now).toISOString(), confirmationTokenHash: null }, overrideAccess: true, req })
      invalidatedRequests++
    }
    for (const delivery of deliveries) if (delivery.state === 'pending' && delivery.kind === 'confirmation') {
      await payload.update({ collection: 'email-deliveries', id: delivery.id, data: { state: 'canceled', errorCode: 'material_unavailable' }, overrideAccess: true, req })
      canceledConfirmations++
    }
    const tokens = await linked(payload, 'preference-tokens', contact.id, req)
    for (const token of tokens) await payload.delete({ collection: 'preference-tokens', id: token.id, overrideAccess: true, req })
    await payload.update({ collection: 'contacts', id: contact.id, data: { email: correctedEmail }, overrideAccess: true, req })
    const activeSubscriptions = (await payload.find({ collection: 'subscriptions', where: { and: [{ contact: { equals: contact.id } }, { state: { equals: 'subscribed' } }] }, limit: 1, depth: 0, overrideAccess: true, req })).docs.length > 0
    if (activeSubscriptions && !contact.globalSuppressedAt && contact.deliveryState === 'ok') await enqueueBrevoRegistration(req, contact.id, now)
    const limits = await payload.find({ collection: 'request-limits', where: { key: { like: `%:${previousFingerprint}` } }, pagination: false, depth: 0, overrideAccess: true, req })
    for (const row of limits.docs) await payload.delete({ collection: 'request-limits', id: row.id, overrideAccess: true, req })
    const counts = { contacts: 1, requestLimits: limits.docs.length, invalidatedRequests, canceledConfirmations, invalidatedPreferenceTokens: tokens.length, ...localBatchCounts }
    await record('completed', counts)
    return { outcome: 'completed' as const, counts, blockers: [] as string[] }
  })
}
