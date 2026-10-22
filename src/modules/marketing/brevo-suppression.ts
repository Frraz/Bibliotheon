import type { Payload } from 'payload'
import { configuredBrevoContacts, type BrevoContacts, type ContactBlockResult } from '../../integrations/brevo/contacts'
import { atomic, serial } from './transaction'
import { idOf } from './sequence-copy'
import { enqueueBrevoSuppression } from './brevo-suppression-queue'

const LEASE = 30 * 60_000
const delay = (attempt: number) => Math.min(6 * 3_600_000, 60_000 * 2 ** Math.min(attempt - 1, 9))
/** Blocking is idempotent. Lost/ambiguous attempts may safely reconfirm, never unblock. */
export async function processBrevoSuppression(payload: Payload, id: string, options: { client?: BrevoContacts | null; now?: number } = {}) {
  const client = options.client === undefined ? configuredBrevoContacts() : options.client, now = options.now ?? Date.now()
  if (!client) return { state: 'disabled' as const }
  const claim = await atomic(payload, async req => {
    await serial(req, `brevo-suppression:${id}`)
    const job = await payload.findByID({ collection: 'brevo-suppressions', id, depth: 0, overrideAccess: true, req })
    if (!(job.state === 'pending' && Date.parse(job.nextAttemptAt) <= now || job.state === 'processing' && job.startedAt && Date.parse(job.startedAt) <= now - LEASE)) return null
    await serial(req, `contact:${idOf(job.contact)}`)
    const contact = await payload.findByID({ collection: 'contacts', id: idOf(job.contact), depth: 0, overrideAccess: true, req })
    await payload.update({ collection: 'brevo-suppressions', id, data: { state: 'processing', startedAt: new Date(now).toISOString(), attempts: job.attempts + 1, errorCode: null }, overrideAccess: true, req })
    return { email: contact.email, revision: job.revision, attempt: job.attempts + 1, startedAt: new Date(now).toISOString() }
  })
  if (!claim) return { state: 'held' as const }
  let result: ContactBlockResult
  try { result = await client.block(claim.email) } catch { result = { state: 'retry' } }
  // Treat unexpected adapter output as retry; never persist raw provider data.
  if (!result || !['blocked', 'absent', 'retry', 'rejected'].includes(result.state)) result = { state: 'retry' }
  return atomic(payload, async req => {
    await serial(req, `brevo-suppression:${id}`)
    const job = await payload.findByID({ collection: 'brevo-suppressions', id, depth: 0, overrideAccess: true, req })
    if (job.state !== 'processing' || job.attempts !== claim.attempt || job.startedAt !== claim.startedAt) return { state: 'held' as const }
    if (job.revision !== claim.revision) {
      await payload.update({ collection: 'brevo-suppressions', id, data: { state: 'pending', attempts: 0, nextAttemptAt: new Date(now).toISOString(), errorCode: null }, overrideAccess: true, req })
      return { state: 'pending' as const }
    }
    const synchronized = result.state === 'blocked' || result.state === 'absent'
    await payload.update({ collection: 'brevo-suppressions', id, data: synchronized ? { state: 'synced', outcome: result.state as 'blocked' | 'absent', syncedAt: new Date(now).toISOString(), errorCode: null } : result.state === 'rejected' ? { state: 'failed', errorCode: 'provider_rejected' } : { state: 'pending', errorCode: 'provider_unavailable', nextAttemptAt: new Date(now + delay(claim.attempt)).toISOString() }, overrideAccess: true, req })
    return { state: synchronized ? 'synced' as const : result.state === 'rejected' ? 'failed' as const : 'pending' as const }
  })
}

export async function syncBrevoSuppressions(payload: Payload, options: { client?: BrevoContacts | null; now?: number; limit?: number } = {}) {
  const client = options.client === undefined ? configuredBrevoContacts() : options.client, now = options.now ?? Date.now()
  if (!client) return { enabled: false, examined: 0, synced: 0, pending: 0, failed: 0 }
  const limit = options.limit ?? 25
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('Limite de sincronização inválido.')
  const jobs = await payload.find({ collection: 'brevo-suppressions', where: { or: [{ and: [{ state: { equals: 'pending' } }, { nextAttemptAt: { less_than_equal: new Date(now).toISOString() } }] }, { and: [{ state: { equals: 'processing' } }, { startedAt: { less_than_equal: new Date(now - LEASE).toISOString() } }] }] }, sort: 'nextAttemptAt', limit, depth: 0, overrideAccess: true })
  const counts = { enabled: true, examined: jobs.docs.length, synced: 0, pending: 0, failed: 0 }
  for (const job of jobs.docs) {
    const result = await processBrevoSuppression(payload, job.id, { client, now })
    if (result.state === 'synced' || result.state === 'pending' || result.state === 'failed') counts[result.state]++
  }
  return counts
}

/** Explicit operator retry after fixing credentials/configuration; no consent changes. */
export async function retryFailedBrevoSuppressions(payload: Payload, now = Date.now()) {
  const jobs = await payload.find({ collection: 'brevo-suppressions', where: { state: { equals: 'failed' } }, limit: 100, depth: 0, overrideAccess: true })
  let queued = 0
  for (const candidate of jobs.docs) await atomic(payload, async req => {
    await serial(req, `contact:${idOf(candidate.contact)}`)
    const current = await payload.findByID({ collection: 'brevo-suppressions', id: candidate.id, depth: 0, overrideAccess: true, req })
    if (current.state !== 'failed') return
    await enqueueBrevoSuppression(req, idOf(current.contact), now); queued++
  })
  return { queued }
}
