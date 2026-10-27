import type { Payload } from 'payload'
import { contactFingerprint } from './contact'
import { LeadFlowError } from './service'

const collections = ['subscriptions', 'consent-events', 'magnet-requests', 'email-deliveries', 'sequence-enrollments', 'promotion-deliveries', 'brevo-registrations', 'brevo-suppressions', 'brevo-webhook-events'] as const
const fields: Record<string, string[]> = {
  subscriptions: ['theme', 'state', 'consentVersion', 'subscribedAt', 'unsubscribedAt'],
  'consent-events': ['theme', 'purpose', 'action', 'version', 'occurredAt'],
  'magnet-requests': ['magnet', 'theme', 'magnetVersion', 'marketingOptIn', 'consentVersion', 'campaignCode', 'expiresAt', 'confirmedAt', 'deliveredAt', 'revokedAt'],
  'email-deliveries': ['kind', 'state', 'attempts', 'nextAttemptAt', 'startedAt', 'sentAt', 'errorCode'],
  'sequence-enrollments': ['magnet', 'theme', 'magnetVersion', 'confirmedAt', 'state', 'canceledAt'],
  'promotion-deliveries': ['stage', 'dueAt', 'nextCheckAt', 'state', 'errorCode'],
  'brevo-registrations': ['state', 'revision', 'createdAt', 'updatedAt'],
  'brevo-suppressions': ['state', 'revision', 'attempts', 'nextAttemptAt', 'syncedAt', 'outcome', 'errorCode'],
  'brevo-webhook-events': ['event', 'occurredAt', 'sentAt', 'receivedAt', 'processedAt', 'state', 'reason', 'suppressionApplied'],
}
const pick = (doc: Record<string, unknown>, names: string[]) => Object.fromEntries(names.filter(name => doc[name] !== undefined && doc[name] !== null).map(name => [name, doc[name]]))
async function readPages(payload: Payload, collection: string, where: Record<string, unknown>) {
  const docs: Record<string, unknown>[] = []
  let page = 1, hasNextPage = true
  while (hasNextPage) {
    const result = await payload.find({ collection: collection as never, where: where as never, limit: 500, page, depth: 0, overrideAccess: true })
    docs.push(...result.docs as unknown as Record<string, unknown>[])
    hasNextPage = result.hasNextPage
    page++
  }
  return docs
}

export async function exportContactData(payload: Payload, emailInput: string, actorId: string, secret: string) {
  const email = emailInput.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new LeadFlowError('invalid_input', 422)
  const fingerprint = contactFingerprint(email, secret)
  const contact = (await payload.find({ collection: 'contacts', where: { email: { equals: email } }, limit: 1, overrideAccess: true })).docs[0]
  const counts: Record<string, number> = {}
  let data: Record<string, unknown> | null = null
  if (contact) {
    data = { email: contact.email, confirmedAt: contact.confirmedAt, globalSuppressedAt: contact.globalSuppressedAt, deliveryState: contact.deliveryState, analytics: 'Eventos analíticos não são vinculados a endereços de email.' }
    for (const collection of collections) {
      const docs = await readPages(payload, collection, { contact: { equals: contact.id } })
      counts[collection] = docs.length
      data[collection] = docs.map(doc => pick(doc, fields[collection]))
      if (collection === 'promotion-deliveries' && docs.length) {
        const receipts = await readPages(payload, 'brevo-delivery-receipts', { delivery: { in: docs.map(doc => doc.id) } })
        counts['brevo-delivery-receipts'] = receipts.length
        data['brevo-delivery-receipts'] = receipts.map(doc => pick(doc, ['firstObservedAt', 'deliveredAt', 'hardBouncedAt', 'softBouncedAt', 'spamAt', 'unsubscribedAt']))
      }
    }
  }
  const retirements = await readPages(payload,'contact-retirements',{subjectFingerprint:{equals:fingerprint}})
  if(retirements.length) {
    data ??= {}
    data['contact-retirements']=retirements.map(row=>pick(row,['retiredAt','expiresAt']))
    counts['contact-retirements']=retirements.length
  }
  const withdrawals = await readPages(payload, 'theme-withdrawals', { subjectFingerprint: { equals: fingerprint } })
  if (withdrawals.length) {
    data ??= {}
    data['theme-withdrawals'] = withdrawals.map(row => pick(row, ['themeId', 'withdrawnAt', 'expiresAt']))
    counts['theme-withdrawals'] = withdrawals.length
  }
  await payload.create({ collection: 'privacy-request-audit', overrideAccess: true, data: { subjectFingerprint: fingerprint, action: 'export', outcome: data ? 'completed' : 'not_found', counts, actor: actorId, occurredAt: new Date().toISOString() } })
  return { data, counts }
}
