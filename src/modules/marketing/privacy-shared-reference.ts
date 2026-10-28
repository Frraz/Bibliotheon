import type { PayloadRequest } from 'payload'
import { contactFingerprint } from './contact'
import { suppressionFingerprint } from './suppression-tombstone'
import { sendRecipientFingerprint } from './send-recipients'
import { hasSharedMarketingReference } from './privacy-marketing-retention'

/** Caller holds promotion-batches and contact locks. JSON may outlive its relational links. */
export async function hasContactSharedMarketingReference(req: PayloadRequest, contact: { id: string; email: string }, secret: string, localBatchPlan: ReadonlySet<string> = new Set()) {
  const ids = new Set([contact.id, contactFingerprint(contact.email, secret), suppressionFingerprint(contact.email, secret), sendRecipientFingerprint(contact.email, secret)])
  for (const collection of ['subscriptions', 'sequence-enrollments', 'promotion-deliveries', 'magnet-requests', 'email-deliveries'] as const) {
    const rows = await req.payload.find({ collection, where: { contact: { equals: contact.id } }, limit: 10001, depth: 0, select: { contact: true }, overrideAccess: true, req })
    if (rows.totalDocs > 10000) throw new Error('Relações excedem o limite de privacidade; conciliação necessária.')
    for (const row of rows.docs) ids.add(row.id)
  }
  return hasSharedMarketingReference(req.payload, ids, req, [contact.email], localBatchPlan)
}
