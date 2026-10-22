import type { PayloadRequest } from 'payload'

/** Caller holds the contact lock. Intent commits with local consent/suppression, even offline. */
export async function enqueueBrevoSuppression(req: PayloadRequest, contact: string, now: number) {
  const existing = (await req.payload.find({ collection: 'brevo-suppressions', where: { contact: { equals: contact } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
  if (existing) {
    if (!Number.isSafeInteger(existing.revision) || existing.revision >= 2_147_483_647) throw new Error('Revisão da sincronização inválida.')
    await req.payload.update({ collection: 'brevo-suppressions', id: existing.id, data: { revision: existing.revision + 1, ...(existing.state === 'processing' ? {} : { state: 'pending' as const, attempts: 0, nextAttemptAt: new Date(now).toISOString(), errorCode: null }) }, overrideAccess: true, req })
  } else await req.payload.create({ collection: 'brevo-suppressions', data: { contact, revision: 1, state: 'pending', attempts: 0, nextAttemptAt: new Date(now).toISOString() }, overrideAccess: true, req })
}
