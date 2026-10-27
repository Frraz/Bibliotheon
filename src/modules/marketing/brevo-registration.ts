import type { Payload, PayloadRequest } from 'payload'
import type { Contact } from '../../payload-types'
import { configuredBrevoRegistration, configuredBrevoContacts, type BrevoContacts, type BrevoContactDirectory, type ContactLookup, type ContactBlockResult } from '../../integrations/brevo/contacts'
import { atomic, serial } from './transaction'
import { idOf } from './sequence-copy'
import { applyObservedProviderBlock } from './suppression'
import { enqueueBrevoSuppression } from './brevo-suppression-queue'
import { enqueueBrevoRegistration } from './brevo-registration-queue'
import { validLinkSecret } from './tokens'
import { privacySubjectBlocked } from './privacy-block'

const LEASE = 30 * 60_000
const retryDelay = (attempt: number) => Math.min(6 * 3_600_000, 60_000 * 2 ** Math.min(attempt - 1, 9))
async function eligible(req: PayloadRequest, contact: Contact, secret: string) {
  if (!contact.confirmedAt || contact.globalSuppressedAt || contact.deliveryState !== 'ok' || await privacySubjectBlocked(req.payload,contact.email,secret,req)) return false
  return (await req.payload.count({ collection: 'subscriptions', where: { and: [{ contact: { equals: contact.id } }, { state: { equals: 'subscribed' } }] }, overrideAccess: true, req })).totalDocs > 0
}
/** Durable intent precedes HTTP. Registration alone never authorizes a campaign/send. */
export async function processBrevoRegistration(payload: Payload, id: string, options: { client?: BrevoContactDirectory | null; secret?: string; now?: number; clock?: () => number; allowCreate?: boolean } = {}) {
  const client = options.client === undefined ? configuredBrevoRegistration() : options.client, secret = options.secret ?? process.env.LEAD_TOKEN_SECRET
  const clock = options.clock ?? (options.now === undefined ? Date.now : () => options.now!), now = clock()
  if (!client || !validLinkSecret(secret)) return { state: 'disabled' as const }
  const claim = await atomic(payload, async req => {
    await serial(req, `brevo-registration:${id}`)
    const job = await payload.findByID({ collection: 'brevo-registrations', id, depth: 0, overrideAccess: true, req })
    if (!(['pending', 'canceling'].includes(job.state) && Date.parse(job.nextAttemptAt) <= now || job.state === 'processing' && job.startedAt && Date.parse(job.startedAt) <= now - LEASE)) return { state: 'held' as const }
    await serial(req, `contact:${idOf(job.contact)}`)
    const contact = await payload.findByID({ collection: 'contacts', id: idOf(job.contact), depth: 0, overrideAccess: true, req })
    const consent = await eligible(req, contact,secret)
    if (!consent && job.attempts === 0 && !job.providerId) {
      await payload.update({ collection: 'brevo-registrations', id, data: { state: 'canceled', errorCode: 'local_ineligible' }, overrideAccess: true, req })
      return { state: 'canceled' as const }
    }
    const mode = !consent ? 'cleanup' as const : options.allowCreate === false || job.state === 'canceling' ? 'inspect' as const : 'register' as const
    if (!consent) await enqueueBrevoSuppression(req, contact.id, now)
    await payload.update({ collection: 'brevo-registrations', id, data: { state: 'processing', attempts: job.attempts + 1, startedAt: new Date(now).toISOString(), contactVersion: contact.updatedAt, errorCode: null }, overrideAccess: true, req })
    return { state: 'processing' as const, mode, contact: contact.id, email: contact.email, version: contact.updatedAt, revision: job.revision, attempt: job.attempts + 1, startedAt: new Date(now).toISOString() }
  })
  if (claim.state !== 'processing') return claim
  let result: ContactLookup | ContactBlockResult
  try { result = claim.mode === 'cleanup' ? await client.block(claim.email) : claim.mode === 'inspect' ? await client.inspect(claim.email) : await client.ensure(claim.email) } catch { result = { state: 'retry' } }
  if (!result || !['found', 'blocked', 'absent', 'retry', 'rejected'].includes(result.state) || result.state === 'found' && (!Number.isSafeInteger(result.id) || result.id < 1 || typeof result.blocked !== 'boolean')) result = { state: 'retry' }
  const completedAt = clock()
  if (result.state === 'found' && result.blocked) await applyObservedProviderBlock(payload, { contactId: claim.contact, email: claim.email, providerId: result.id, observedAt: completedAt }, secret)
  return atomic(payload, async req => {
    await serial(req, `brevo-registration:${id}`)
    const job = await payload.findByID({ collection: 'brevo-registrations', id, depth: 0, overrideAccess: true, req })
    await serial(req, `contact:${claim.contact}`)
    const contact = await payload.findByID({ collection: 'contacts', id: claim.contact, depth: 0, overrideAccess: true, req })
    const currentLease = job.state === 'processing' && job.attempts === claim.attempt && job.startedAt === claim.startedAt
    if (contact.email !== claim.email) {
      // Address changes are not an available operation; never guess a replacement identity.
      if (currentLease) await payload.update({ collection: 'brevo-registrations', id, data: { state: 'failed', errorCode: 'identity_changed' }, overrideAccess: true, req })
      return { state: 'failed' as const }
    }
    if (!await eligible(req, contact,secret)) {
      // Never forget a possible late POST merely because another lookup saw 404.
      await enqueueBrevoSuppression(req, contact.id, completedAt)
      const resolved = result.state === 'found' || result.state === 'blocked'
      const rejected = result.state === 'rejected'
      if (currentLease) await payload.update({ collection: 'brevo-registrations', id, data: { state: resolved ? 'canceled' : rejected ? 'failed' : 'canceling', errorCode: rejected ? 'provider_rejected' : resolved ? 'local_ineligible' : 'provider_unavailable', nextAttemptAt: new Date(completedAt + retryDelay(claim.attempt)).toISOString(), ...(result.state === 'found' ? { providerId: result.id } : {}) }, overrideAccess: true, req })
      return { state: resolved ? 'canceled' as const : rejected ? 'failed' as const : 'canceling' as const }
    }
    if (!currentLease) return { state: 'held' as const }
    if (job.revision !== claim.revision || contact.updatedAt !== claim.version) {
      await payload.update({ collection: 'brevo-registrations', id, data: { state: 'pending', nextAttemptAt: new Date(completedAt).toISOString(), errorCode: null }, overrideAccess: true, req })
      return { state: 'pending' as const }
    }
    if (result.state === 'found') {
      await payload.update({ collection: 'brevo-registrations', id, data: { state: 'synced', providerId: result.id, syncedAt: new Date(completedAt).toISOString(), errorCode: null }, overrideAccess: true, req })
      return { state: 'synced' as const }
    }
    const rejected = result.state === 'rejected'
    await payload.update({ collection: 'brevo-registrations', id, data: { state: rejected ? 'failed' : 'pending', errorCode: rejected ? 'provider_rejected' : 'provider_unavailable', nextAttemptAt: new Date(completedAt + retryDelay(claim.attempt)).toISOString() }, overrideAccess: true, req })
    return { state: rejected ? 'failed' as const : 'pending' as const }
  })
}

export async function syncBrevoRegistrations(payload: Payload, options: { client?: BrevoContactDirectory | null; secret?: string; now?: number; limit?: number } = {}) {
  const client = options.client === undefined ? configuredBrevoRegistration() : options.client, secret = options.secret ?? process.env.LEAD_TOKEN_SECRET, now = options.now ?? Date.now()
  const counts = { enabled: !!client && validLinkSecret(secret), examined: 0, synced: 0, pending: 0, failed: 0, canceled: 0, canceling: 0 }
  if (!counts.enabled) return counts
  const limit = options.limit ?? 25
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('Limite de cadastro inválido.')
  const jobs = await payload.find({ collection: 'brevo-registrations', where: { or: [{ and: [{ state: { in: ['pending', 'canceling'] } }, { nextAttemptAt: { less_than_equal: new Date(now).toISOString() } }] }, { and: [{ state: { equals: 'processing' } }, { startedAt: { less_than_equal: new Date(now - LEASE).toISOString() } }] }] }, sort: 'nextAttemptAt', limit, depth: 0, overrideAccess: true })
  counts.examined = jobs.docs.length
  for (const job of jobs.docs) {
    const result = await processBrevoRegistration(payload, job.id, { client, secret, ...(options.now === undefined ? {} : { now }) })
    if (result.state === 'synced' || result.state === 'pending' || result.state === 'failed' || result.state === 'canceled' || result.state === 'canceling') counts[result.state]++
  }
  return counts
}
export async function retryFailedBrevoRegistrations(payload: Payload, now = Date.now()) {
  const jobs = await payload.find({ collection: 'brevo-registrations', where: { state: { equals: 'failed' } }, limit: 100, depth: 0, overrideAccess: true })
  let queued = 0
  for (const candidate of jobs.docs) await atomic(payload, async req => {
    await serial(req, `contact:${idOf(candidate.contact)}`)
    const current = await payload.findByID({ collection: 'brevo-registrations', id: candidate.id, depth: 0, overrideAccess: true, req })
    if (current.state !== 'failed' || current.errorCode === 'identity_changed') return
    await enqueueBrevoRegistration(req, idOf(current.contact), now); queued++
  })
  return { queued }
}

/** Drain compensations with blocking enabled even if new contact creation is disabled. */
export async function syncBrevoRegistrationCleanup(payload: Payload, options: { client?: BrevoContacts | null; secret?: string; now?: number; limit?: number } = {}) {
  const client = options.client === undefined ? configuredBrevoContacts() : options.client, now = options.now ?? Date.now(), secret = options.secret ?? process.env.LEAD_TOKEN_SECRET
  if (!client || !validLinkSecret(secret)) return { examined: 0 }
  const limit = options.limit ?? 1
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('Limite de compensação inválido.')
  const jobs = await payload.find({ collection: 'brevo-registrations', where: { or: [{ and: [{ state: { equals: 'canceling' } }, { nextAttemptAt: { less_than_equal: new Date(now).toISOString() } }] }, { and: [{ state: { equals: 'processing' } }, { startedAt: { less_than_equal: new Date(now - LEASE).toISOString() } }] }] }, sort: 'nextAttemptAt', limit, depth: 0, overrideAccess: true })
  for (const job of jobs.docs) await processBrevoRegistration(payload, job.id, { client: { ...client, ensure: email => client.inspect(email) }, secret, ...(options.now === undefined ? {} : { now }), allowCreate: false })
  return { examined: jobs.docs.length }
}
