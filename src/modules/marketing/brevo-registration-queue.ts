import type { PayloadRequest } from 'payload'

/** Thematic consent was granted; caller holds contact lock. Works with external sync disabled. */
export async function enqueueBrevoRegistration(req: PayloadRequest, contact: string, now: number) {
  const existing = (await req.payload.find({ collection: 'brevo-registrations', where: { contact: { equals: contact } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
  if (!existing) {
    await req.payload.create({ collection: 'brevo-registrations', data: { contact, revision: 1, state: 'pending', attempts: 0, nextAttemptAt: new Date(now).toISOString() }, overrideAccess: true, req }); return
  }
  if (!Number.isSafeInteger(existing.revision) || existing.revision >= 2_147_483_647) throw new Error('Revisão de cadastro inválida.')
  await req.payload.update({ collection: 'brevo-registrations', id: existing.id, data: { revision: existing.revision + 1, ...(existing.state === 'processing' ? {} : { state: 'pending' as const, attempts: existing.attempts, nextAttemptAt: new Date(now).toISOString(), errorCode: null }) }, overrideAccess: true, req })
}

/** Keep in-flight intent recoverable: a late POST might follow an earlier absent lookup. */
export async function cancelBrevoRegistration(req: PayloadRequest, contact: string, now: number) {
  const job = (await req.payload.find({ collection: 'brevo-registrations', where: { contact: { equals: contact } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
  if (!job || job.state === 'canceled') return
  if (!Number.isSafeInteger(job.revision) || job.revision >= 2_147_483_647) throw new Error('Revisão de cadastro inválida.')
  const state = job.state === 'processing' ? 'processing' : (job.state === 'pending' && job.attempts > 0 || job.state === 'canceling') ? 'canceling' : 'canceled'
  await req.payload.update({ collection: 'brevo-registrations', id: job.id, data: { revision: job.revision + 1, state, errorCode: 'local_ineligible', ...(state === 'canceling' ? { nextAttemptAt: new Date(now).toISOString() } : {}) }, overrideAccess: true, req })
}
