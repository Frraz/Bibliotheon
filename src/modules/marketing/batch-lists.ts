import { randomUUID } from 'node:crypto'
import type { Payload } from 'payload'
import { configuredBrevoLists, positiveId, type BrevoLists } from '../../integrations/brevo/lists'
import { configuredBrevoContacts, type BrevoContacts } from '../../integrations/brevo/contacts'
import { atomic, serial } from './transaction'
import { checkPromotionBatch } from './batch-preflight'
import { reviewPreparedBatch } from './batch-review'
import { validProviderCheck, PROVIDER_CHECK_TTL } from './batch-check-copy'
import { listAudienceKey, providerIds, readAttemptedIds, readListSnapshot } from './batch-list-copy'
import { validLinkSecret } from './tokens'

const LEASE = 30 * 60_000
/** No campaign or send. Every remote mutation is preceded by durable intent. */
export async function prepareBrevoBatchList(payload: Payload, batchId: string, options: { lists?: BrevoLists | null; contacts?: BrevoContacts | null; secret?: string; now?: number; clock?: () => number; adoptListId?: number; retryRejected?: boolean } = {}) {
  const lists = options.lists === undefined ? configuredBrevoLists() : options.lists
  const contacts = options.contacts === undefined ? configuredBrevoContacts() : options.contacts, secret = options.secret ?? process.env.LEAD_TOKEN_SECRET
  if (!lists || !contacts || !validLinkSecret(secret)) return { state: 'disabled' as const }
  if (options.adoptListId !== undefined && !positiveId(options.adoptListId)) throw new Error('ID de reconciliação inválido.')
  const clock = options.clock ?? (options.now === undefined ? Date.now : () => options.now!)
  const preflight = await checkPromotionBatch(payload, batchId, { client: contacts, secret, clock })
  if (preflight.state !== 'ready') {
    if (preflight.state === 'canceled') await atomic(payload, async req => {
      await serial(req, `brevo-list:${batchId}`)
      const existing = (await payload.find({ collection: 'brevo-batch-lists', where: { batch: { equals: batchId } }, depth: 0, limit: 1, overrideAccess: true, req })).docs[0]
      if (existing) await payload.update({ collection: 'brevo-batch-lists', id: existing.id, data: { state: 'canceled', leaseToken: null, verification: null, errorCode: 'local_ineligible' }, overrideAccess: true, req })
    })
    return preflight
  }
  const claim = await atomic(payload, async req => {
    await serial(req, `brevo-list:${batchId}`)
    const reviewed = await reviewPreparedBatch(req, batchId, clock())
    if (reviewed.state !== 'ready') return reviewed
    if (!validProviderCheck(reviewed.batch.providerCheck, reviewed.batch.key, reviewed.recipients, clock())) return { state: 'provider_check' as const }
    const proof = reviewed.batch.providerCheck
    let job = (await payload.find({ collection: 'brevo-batch-lists', where: { batch: { equals: batchId } }, depth: 0, limit: 1, overrideAccess: true, req })).docs[0]
    if (job && job.leaseToken && job.startedAt && Date.parse(job.startedAt) > clock() - LEASE) return { state: 'held' as const }
    const token = randomUUID()
    if (job) {
      const snapshot = readListSnapshot(job.snapshot, reviewed.batch.key), attempted = readAttemptedIds(job.attemptedIds)
      if (!snapshot || job.audienceKey !== listAudienceKey(snapshot) || job.audienceKey !== listAudienceKey(proof) || job.name !== `bibliotheon-${batchId}` || !attempted || attempted.some(id => !providerIds(snapshot).includes(id))) throw new Error('Manifesto da lista inconsistente; revisão necessária.')
      const retryAllowed = job.state === 'failed' && job.errorCode === 'creation_rejected' && !job.providerListId
      if (retryAllowed && !options.retryRejected && !options.adoptListId) return { state: 'failed' as const }
      if (options.retryRejected && !retryAllowed) throw new Error('Retentativa exige criação explicitamente recusada, sem ID externo.')
      if (['uncertain', 'failed'].includes(job.state) && Date.parse(job.nextAttemptAt) > clock() && !options.adoptListId && !options.retryRejected) return { state: 'held' as const }
      if (job.folderId !== lists.folderId && !(options.retryRejected && job.state === 'failed' && job.errorCode === 'creation_rejected' && !job.providerListId)) throw new Error('Pasta da lista mudou; operação interrompida.')
      const retry = options.retryRejected && job.state === 'failed' && job.errorCode === 'creation_rejected' && !job.providerListId
      job = await payload.update({ collection: 'brevo-batch-lists', id: job.id, data: { leaseToken: token, startedAt: new Date(clock()).toISOString(), verification: null, ...(retry ? { folderId: lists.folderId, creationIssuedAt: null, state: 'creating' as const } : {}) }, depth: 0, overrideAccess: true, req })
    } else job = await payload.create({ collection: 'brevo-batch-lists', data: { batch: batchId, name: `bibliotheon-${batchId}`, folderId: lists.folderId, audienceKey: listAudienceKey(proof), snapshot: proof, attemptedIds: [], state: 'creating', leaseToken: token, startedAt: new Date(clock()).toISOString(), nextAttemptAt: new Date(clock()).toISOString() }, depth: 0, overrideAccess: true, req })
    return { state: 'processing' as const, job, token, proof }
  })
  if (claim.state !== 'processing') return claim
  const leaseToken = claim.token, proof = claim.proof
  let job = claim.job
  type Problem = 'provider_unavailable' | 'provider_rejected' | 'creation_rejected' | 'creation_uncertain' | 'membership_uncertain' | 'membership_unverified' | 'list_conflict' | 'recipient_suppressed'
  async function finish(state: 'uncertain' | 'failed' | 'canceled', code: Problem | 'local_ineligible') {
    return atomic(payload, async req => {
      await serial(req, `brevo-list:${batchId}`)
      const current = await payload.findByID({ collection: 'brevo-batch-lists', id: job.id, depth: 0, overrideAccess: true, req })
      if (current.leaseToken !== leaseToken) return { state: 'held' as const }
      await payload.update({ collection: 'brevo-batch-lists', id: job.id, data: { state, errorCode: code, leaseToken: null, verification: null, nextAttemptAt: new Date(clock() + 900_000).toISOString() }, overrideAccess: true, req })
      return { state }
    })
  }
  async function recordId(id: number) {
    if (!positiveId(id)) throw new Error('ID externo inválido.')
    return atomic(payload, async req => {
      await serial(req, `brevo-list:${batchId}`)
      const current = await payload.findByID({ collection: 'brevo-batch-lists', id: job.id, depth: 0, overrideAccess: true, req })
      if (current.providerListId && current.providerListId !== id) {
        await payload.update({ collection: 'brevo-batch-lists', id: job.id, data: { state: 'failed', leaseToken: null, verification: null, errorCode: 'list_conflict' }, overrideAccess: true, req }); return false
      }
      // Retain a returned ID even after withdrawal/lease loss; this never authorizes filling.
      if (!current.providerListId) job = await payload.update({ collection: 'brevo-batch-lists', id: job.id, data: { providerListId: id }, depth: 0, overrideAccess: true, req })
      return current.leaseToken === leaseToken
    })
  }
  async function persist(data: { providerListId?: number; state?: 'creating' | 'filling'; creationIssuedAt?: string; attemptedIds?: number[] }) {
    return atomic(payload, async req => {
      await serial(req, `brevo-list:${batchId}`)
      const current = await payload.findByID({ collection: 'brevo-batch-lists', id: job.id, depth: 0, overrideAccess: true, req })
      if (current.leaseToken !== leaseToken) return false
      const reviewed = await reviewPreparedBatch(req, batchId, clock())
      if (reviewed.state !== 'ready') {
        job = await payload.update({ collection: 'brevo-batch-lists', id: job.id, data: { state: 'canceled', errorCode: 'local_ineligible', leaseToken: null, verification: null }, depth: 0, overrideAccess: true, req }); return false
      }
      if (!validProviderCheck(reviewed.batch.providerCheck, reviewed.batch.key, reviewed.recipients, clock()) || listAudienceKey(reviewed.batch.providerCheck) !== job.audienceKey) {
        job = await payload.update({ collection: 'brevo-batch-lists', id: job.id, data: { state: 'uncertain', errorCode: 'provider_unavailable', leaseToken: null, verification: null, nextAttemptAt: new Date(clock() + 900_000).toISOString() }, depth: 0, overrideAccess: true, req }); return false
      }
      job = await payload.update({ collection: 'brevo-batch-lists', id: job.id, data, depth: 0, overrideAccess: true, req })
      return true
    })
  }
  try {
    let listId = job.providerListId ?? options.adoptListId
    if (job.providerListId && options.adoptListId && options.adoptListId !== job.providerListId) return finish('failed', 'list_conflict')
    if (!listId) {
      const found = await lists.find(job.name)
      if (found.state === 'found') {
        if (!job.creationIssuedAt) return finish('failed', 'list_conflict')
        listId = found.id
      } else if (found.state === 'absent' && !job.creationIssuedAt) {
        if (!await persist({ creationIssuedAt: new Date(clock()).toISOString() })) return { state: 'held' as const }
        const created = await lists.create(job.name)
        if (created.state !== 'created') return finish(created.state === 'rejected' ? 'failed' : 'uncertain', created.state === 'rejected' ? 'creation_rejected' : 'creation_uncertain')
        listId = created.id
        if (!await recordId(listId)) return { state: 'held' as const }
      } else return finish(found.state === 'conflict' || found.state === 'rejected' ? 'failed' : 'uncertain', found.state === 'conflict' ? 'list_conflict' : found.state === 'rejected' ? 'provider_rejected' : 'creation_uncertain')
    }
    const metadata = await lists.details(listId)
    if (metadata.state !== 'found') return finish('uncertain', 'provider_unavailable')
    if (metadata.list.id !== listId || metadata.list.name !== job.name || metadata.list.folderId !== job.folderId) return finish('failed', 'list_conflict')
    // Reconciled/adopted IDs require matching metadata; created IDs were already retained.
    if (!await recordId(listId)) return { state: 'held' as const }
    if (!await persist({ state: 'filling' })) return { state: 'held' as const }
    const expected = providerIds(proof), attempted = new Set(readAttemptedIds(job.attemptedIds)!)
    let membershipCheckedAt = clock()
    for (;;) {
      membershipCheckedAt = clock()
      const observed = await lists.members(listId)
      if (observed.state !== 'members') return finish(observed.state === 'conflict' ? 'failed' : 'uncertain', observed.state === 'conflict' ? 'list_conflict' : 'provider_unavailable')
      const actual = new Set(observed.contacts.map(item => item.id))
      if (actual.size !== observed.contacts.length || [...actual].some(id => !expected.includes(id))) return finish('failed', 'list_conflict')
      if (observed.contacts.some(item => item.blocked || item.unsubscribed === true)) return finish('failed', 'recipient_suppressed')
      if (observed.contacts.some(item => item.unsubscribed === null)) return finish('uncertain', 'membership_unverified')
      const missing = expected.filter(id => !actual.has(id))
      if (!missing.length) break
      if (missing.some(id => attempted.has(id))) return finish('uncertain', 'membership_uncertain')
      const chunk = missing.slice(0, 150)
      for (const id of chunk) attempted.add(id)
      if (!await persist({ attemptedIds: [...attempted] })) return { state: 'held' as const }
      await lists.add(listId, chunk)
      // A 201, partial failure or timeout is reconciled by the next GET, never its body.
    }
    const checked = await checkPromotionBatch(payload, batchId, { client: contacts, secret, clock })
    if (checked.state !== 'ready') return finish(checked.state === 'canceled' ? 'canceled' : 'uncertain', checked.state === 'canceled' ? 'local_ineligible' : 'provider_unavailable')
    return atomic(payload, async req => {
      await serial(req, `brevo-list:${batchId}`)
      const current = await payload.findByID({ collection: 'brevo-batch-lists', id: job.id, depth: 0, overrideAccess: true, req })
      if (current.leaseToken !== leaseToken) return { state: 'held' as const }
      if (membershipCheckedAt > clock() || clock() - membershipCheckedAt > PROVIDER_CHECK_TTL) {
        await payload.update({ collection: 'brevo-batch-lists', id: job.id, data: { state: 'uncertain', leaseToken: null, verification: null, errorCode: 'provider_unavailable', nextAttemptAt: new Date(clock() + 900_000).toISOString() }, overrideAccess: true, req }); return { state: 'uncertain' as const }
      }
      const reviewed = await reviewPreparedBatch(req, batchId, clock())
      if (reviewed.state !== 'ready' || !validProviderCheck(reviewed.batch.providerCheck, reviewed.batch.key, reviewed.recipients, clock()) || listAudienceKey(reviewed.batch.providerCheck) !== job.audienceKey) {
        await payload.update({ collection: 'brevo-batch-lists', id: job.id, data: { state: 'canceled', leaseToken: null, verification: null, errorCode: 'local_ineligible' }, overrideAccess: true, req }); return { state: 'canceled' as const }
      }
      await payload.update({ collection: 'brevo-batch-lists', id: job.id, data: { state: 'ready', verification: reviewed.batch.providerCheck, verifiedAt: new Date(membershipCheckedAt).toISOString(), leaseToken: null, errorCode: null }, overrideAccess: true, req })
      return { state: 'ready' as const, listId }
    })
  } catch {
    // A lost response/commit may follow an external mutation. Retain manifest and attempted IDs.
    return finish('uncertain', job.providerListId ? 'membership_uncertain' : 'creation_uncertain')
  }
}
