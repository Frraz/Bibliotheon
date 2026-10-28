import { backfillThemeWithdrawals, type LegacyWithdrawalReport } from './legacy-theme-withdrawal'
import { MARKETING_RETENTION_DEADLINE_MS, activeMarketingReviewCutoff } from './retention-policy'
import { expireWithdrawnThemes, type ThemeRetentionReport } from './privacy-theme-retention'
import { expireClosedIdentities, type ClosedIdentityRetentionReport } from './privacy-identity-retention'
import { expireSuppressedMarketing, type SuppressedMarketingRetentionReport } from './privacy-marketing-retention'
import type { Payload, PayloadRequest, Where } from 'payload'
import { atomic, serial } from './transaction'
import { lockCommercialAccounts } from '../commerce/lock'
import { storedCommercialEnvelope } from '../commerce/stored-envelope'
import { restoreStoredCommercialReceipt } from '../commerce/events'
import { expireConfirmedSamples, type ConfirmedSampleRetentionReport } from './privacy-sample-retention'

const BATCH = 100
const DAY = 86_400_000
const UNCONFIRMED_REQUEST_RETENTION_DAYS = 7
const PROCESSED_INBOX_RETENTION_DAYS = 90
export type PrivacyRetentionReport = {
  mode: 'preview' | 'applied'
  cutoff: string
  candidates: number
  processed: number
  unconfirmedRequests: { candidates: number; processed: number; removedDeliveries: number; canceledPendingDeliveries: number; removedContacts: number; skippedInFlight: number }
  expiredSuppressionTombstones: { candidates: number; processed: number }
  expiredPreferenceTokens: { candidates: number; processed: number }
  commercialInboxEnvelopes: { candidates: number; eligible: number; processed: number; preservedForReconciliation: number }
  commercialAudit: { candidates: number; eligible: number; processed: number; preservedForReconciliation: number }
  confirmedSamples: ConfirmedSampleRetentionReport
  suppressedMarketing: SuppressedMarketingRetentionReport
  closedIdentities: ClosedIdentityRetentionReport
  withdrawnThemes: ThemeRetentionReport
  legacyThemeWithdrawals: LegacyWithdrawalReport
  marketingDeadline: { cutoff: string; overdueSubscriptions: number; reviewRequired: boolean }
  activeMarketingReview: { cutoff: string; staleSubscriptions: number; undatedSubscriptions: number; futureDatedSubscriptions: number; reviewRequired: boolean }
}

type Relation = string | { id: string } | null | undefined
type RequestRow = { id: string; contact: Relation; confirmedAt?: string | null; createdAt: string }
type CommercialAuditRow = { id: string; inbox: Relation; transaction?: Relation; occurredAt: string }
const relationId = (value: Relation) => typeof value === 'string' ? value : value?.id

async function countContactReferences(payload: Payload, contact: string, req: PayloadRequest) {
  const collections = [
    'subscriptions', 'consent-events', 'magnet-requests', 'email-deliveries', 'preference-tokens',
    'sequence-enrollments', 'promotion-deliveries', 'brevo-registrations', 'brevo-suppressions', 'brevo-webhook-events',
  ] as const
  let total = 0
  for (const collection of collections) total += (await payload.count({ collection, where: { contact: { equals: contact } }, overrideAccess: true, req })).totalDocs
  return total
}

async function expireUnconfirmedRequests(payload: Payload, now: Date, apply: boolean) {
  const cutoff = new Date(now.getTime() - UNCONFIRMED_REQUEST_RETENTION_DAYS * DAY).toISOString()
  const whereFor = (afterId?: string): Where => ({ and: [{ createdAt: { less_than_equal: cutoff } }, { confirmedAt: { exists: false } }, ...(afterId ? [{ id: { greater_than: afterId } }] : [])] })
  const candidates = (await payload.count({ collection: 'magnet-requests', where: whereFor(), overrideAccess: true })).totalDocs
  let processed = 0, removedDeliveries = 0, canceledPendingDeliveries = 0, removedContacts = 0
  const skippedInFlight = new Set<string>()
  if (!apply) return { candidates, processed, removedDeliveries, canceledPendingDeliveries, removedContacts, skippedInFlight: skippedInFlight.size }

  let afterId: string | undefined
  while (true) {
    const rows = (await payload.find({ collection: 'magnet-requests', where: whereFor(afterId), sort: 'id', limit: BATCH, depth: 0, overrideAccess: true })).docs as unknown as RequestRow[]
    if (!rows.length) break
    for (const row of rows) {
      afterId = row.id
      const contactId = relationId(row.contact)
      if (!contactId) continue
      const result = await atomic(payload, async req => {
        await serial(req, `contact:${contactId}`)
        const current = await req.payload.findByID({ collection: 'magnet-requests', id: row.id, depth: 0, overrideAccess: true, req }).catch(() => null)
        if (!current || current.confirmedAt || Date.parse(current.createdAt) > Date.parse(cutoff) || relationId(current.contact) !== contactId) return { deleted: false, inFlight: false, deliveries: 0, canceledPendingDeliveries: 0, contact: false }
        const deliveries = (await req.payload.find({ collection: 'email-deliveries', where: { request: { equals: current.id } }, pagination: false, depth: 0, overrideAccess: true, req })).docs
        if (deliveries.some(delivery => delivery.state === 'sending' || delivery.state === 'uncertain')) return { deleted: false, inFlight: true, deliveries: 0, canceledPendingDeliveries: 0, contact: false }
        let canceledPendingDeliveries = 0
        for (const delivery of deliveries) {
          // Removing the outbox row in this transaction prevents a retry before the parent request disappears.
          if (delivery.state === 'pending') canceledPendingDeliveries++
          await req.payload.delete({ collection: 'email-deliveries', id: delivery.id, overrideAccess: true, req })
        }
        const requestEvent = (await req.payload.find({ collection: 'consent-events', where: { and: [{ contact: { equals: contactId } }, { key: { equals: `requested:${current.id}` } }] }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
        if (requestEvent) await req.payload.delete({ collection: 'consent-events', id: requestEvent.id, overrideAccess: true, req })
        await req.payload.delete({ collection: 'magnet-requests', id: current.id, overrideAccess: true, req })
        const remaining = await countContactReferences(req.payload, contactId, req)
        const contact = await req.payload.findByID({ collection: 'contacts', id: contactId, depth: 0, overrideAccess: true, req }).catch(() => null)
        // Keep any contact still referenced or carrying suppression state; this pass
        // only removes an unconfirmed, otherwise unused identity.
        const removeContact = !!contact && remaining === 0 && !contact.globalSuppressedAt && contact.deliveryState === 'ok'
        if (removeContact) await req.payload.delete({ collection: 'contacts', id: contactId, overrideAccess: true, req })
        return { deleted: true, inFlight: false, deliveries: deliveries.length, canceledPendingDeliveries, contact: removeContact }
      })
      if (result.inFlight) skippedInFlight.add(row.id)
      if (result.deleted) { processed++; removedDeliveries += result.deliveries; canceledPendingDeliveries += result.canceledPendingDeliveries; if (result.contact) removedContacts++ }
    }
    if (rows.length < BATCH) break
  }
  return { candidates, processed, removedDeliveries, canceledPendingDeliveries, removedContacts, skippedInFlight: skippedInFlight.size }
}

/** Expires pseudonymous request audit after the documented 24-month default. */
export async function runPrivacyRequestAuditRetention(payload: Payload, options: { now?: number; apply?: boolean; secret?: string } = {}): Promise<PrivacyRetentionReport> {
  const now = new Date(options.now ?? Date.now())
  if (!Number.isFinite(now.getTime())) throw new Error('Data de retenção inválida.')
  const cutoffDate = new Date(now)
  cutoffDate.setUTCFullYear(cutoffDate.getUTCFullYear() - 2)
  const cutoff = cutoffDate.toISOString()
  const apply = options.apply === true
  const auditWhere: Where = { and: [{ occurredAt: { less_than: cutoff } }, { outcome: { not_equals: 'pending' } }] }
  const candidates = (await payload.count({ collection: 'privacy-request-audit', where: auditWhere, overrideAccess: true })).totalDocs
  const expiredSuppressionTombstones = await expireSuppressionTombstones(payload, now, apply)
  const expiredPreferenceTokens = await expirePreferenceTokens(payload, now, apply)
  const commercialInboxEnvelopes = await expireCommercialInboxEnvelopes(payload, now, apply)
  const commercialAudit = await expireCommercialAudit(payload, cutoff, apply)
  const unconfirmed = await expireUnconfirmedRequests(payload, now, options.apply === true)
  const legacyThemeWithdrawals = await backfillThemeWithdrawals(payload, now.getTime(), apply, options.secret ?? process.env.LEAD_TOKEN_SECRET)
  const suppressedMarketing = await expireSuppressedMarketing(payload, now.getTime(), apply, options.secret ?? process.env.LEAD_TOKEN_SECRET)
  const withdrawnThemes = await expireWithdrawnThemes(payload, now.getTime(), apply, options.secret ?? process.env.LEAD_TOKEN_SECRET)
  const confirmedSamples = await expireConfirmedSamples(payload, cutoff, now.getTime(), apply)
  const closedIdentities = await expireClosedIdentities(payload, now.getTime(), apply, options.secret ?? process.env.LEAD_TOKEN_SECRET)
  let processed = 0
  if (apply) {
    while (true) {
      const rows = (await payload.find({ collection: 'privacy-request-audit', where: auditWhere, sort: 'occurredAt', limit: BATCH, depth: 0, overrideAccess: true })).docs
      if (!rows.length) break
      let progressed = false
      for (const row of rows) {
        const deleted = await atomic(payload, async req => {
          await serial(req,row.subjectFingerprint)
          await serial(req, `privacy-audit:${row.id}`)
          const current = await req.payload.findByID({ collection: 'privacy-request-audit', id: row.id, depth: 0, overrideAccess: true, req }).catch(() => null)
          if (!current || current.outcome === 'pending' || Date.parse(current.occurredAt) >= Date.parse(cutoff)) return false
          await req.payload.delete({ collection: 'privacy-request-audit', id: row.id, overrideAccess: true, req })
          return true
        })
        if (deleted) { processed++; progressed = true }
      }
      if (!progressed) break
    }
  }
  const deadlineCutoff = new Date((options.now ?? Date.now()) - MARKETING_RETENTION_DEADLINE_MS).toISOString()
  const overdueSubscriptions = (await payload.count({ collection: 'subscriptions', where: { and: [{ state: { equals: 'unsubscribed' } }, { unsubscribedAt: { less_than_equal: deadlineCutoff } }] }, overrideAccess: true })).totalDocs
  const marketingDeadline = { cutoff: deadlineCutoff, overdueSubscriptions, reviewRequired: overdueSubscriptions > 0 }
  const activeReviewCutoff = activeMarketingReviewCutoff(options.now ?? Date.now())
  const activeReviewNow = new Date(options.now ?? Date.now()).toISOString()
  const activeMarketingReview = {
    cutoff: activeReviewCutoff,
    staleSubscriptions: (await payload.count({ collection: 'subscriptions', where: { and: [{ state: { equals: 'subscribed' } }, { subscribedAt: { less_than_equal: activeReviewCutoff } }] }, overrideAccess: true })).totalDocs,
    undatedSubscriptions: (await payload.count({ collection: 'subscriptions', where: { and: [{ state: { equals: 'subscribed' } }, { subscribedAt: { exists: false } }] }, overrideAccess: true })).totalDocs,
    futureDatedSubscriptions: (await payload.count({ collection: 'subscriptions', where: { and: [{ state: { equals: 'subscribed' } }, { subscribedAt: { greater_than: activeReviewNow } }] }, overrideAccess: true })).totalDocs,
    reviewRequired: false,
  }
  activeMarketingReview.reviewRequired = activeMarketingReview.staleSubscriptions + activeMarketingReview.undatedSubscriptions + activeMarketingReview.futureDatedSubscriptions > 0
  return { mode: apply ? 'applied' : 'preview', cutoff, candidates, processed, unconfirmedRequests: unconfirmed, expiredSuppressionTombstones, expiredPreferenceTokens, commercialInboxEnvelopes, commercialAudit, confirmedSamples, suppressedMarketing, closedIdentities, withdrawnThemes, marketingDeadline, activeMarketingReview, legacyThemeWithdrawals }
}

async function expireSuppressionTombstones(payload: Payload, now: Date, apply: boolean) {
  const cutoff = now.toISOString()
  const where: Where = { expiresAt: { less_than_equal: cutoff } }
  const candidates = (await payload.count({ collection: 'marketing-suppression-tombstones', where, overrideAccess: true })).totalDocs
  let processed = 0
  if (apply) {
    while (true) {
      const rows = await payload.find({ collection: 'marketing-suppression-tombstones', where, sort: 'expiresAt', limit: BATCH, depth: 0, overrideAccess: true })
      if (!rows.docs.length) break
      let progressed = false
      for (const row of rows.docs) {
        const removed = await atomic(payload, async req => {
          await serial(req, `marketing-suppression:${row.fingerprint}`)
          const current = await req.payload.findByID({ collection: 'marketing-suppression-tombstones', id: row.id, depth: 0, overrideAccess: true, req }).catch(() => null)
          if (!current || Date.parse(current.expiresAt) > now.getTime()) return false
          await req.payload.delete({ collection: 'marketing-suppression-tombstones', id: row.id, overrideAccess: true, req })
          return true
        })
        if (removed) { processed++; progressed = true }
      }
      if (!progressed) break
    }
  }
  return { candidates, processed }
}

async function expirePreferenceTokens(payload: Payload, now: Date, apply: boolean) {
  const cutoff = now.toISOString()
  const where: Where = { expiresAt: { less_than_equal: cutoff } }
  const candidates = (await payload.count({ collection: 'preference-tokens', where, overrideAccess: true })).totalDocs
  let processed = 0
  if (apply) {
    while (true) {
      const rows = await payload.find({ collection: 'preference-tokens', where, sort: 'expiresAt', limit: BATCH, depth: 0, overrideAccess: true })
      if (!rows.docs.length) break
      let progressed = false
      for (const row of rows.docs) {
        const contactId = relationId(row.contact)
        if (!contactId) continue
        const removed = await atomic(payload, async req => {
          await serial(req, `contact:${contactId}`)
          const current = await req.payload.findByID({ collection: 'preference-tokens', id: row.id, depth: 0, overrideAccess: true, req }).catch(() => null)
          if (!current || relationId(current.contact) !== contactId || Date.parse(current.expiresAt) > now.getTime()) return false
          await req.payload.delete({ collection: 'preference-tokens', id: current.id, overrideAccess: true, req })
          return true
        })
        if (removed) { processed++; progressed = true }
      }
      if (!progressed) break
    }
  }
  return { candidates, processed }
}

async function commercialInboxEnvelopeCanExpire(payload: Payload, row: { id: string; key: string; provider: 'hotmart'|'kiwify'|'cakto'; accountKey: string; adapterVersion: string; envelopeHash: string; envelope?: unknown|null; state: string; conflicted: boolean; processedAt?: string|null; transaction?: Relation; transactionKey?: string|null }, cutoff: string, req?: PayloadRequest) {
  if (!row.envelope || row.conflicted || !['applied', 'ignored'].includes(row.state) || !row.processedAt || Date.parse(row.processedAt) >= Date.parse(cutoff)) return false
  const scope = { provider: row.provider, accountKey: row.accountKey }
  const inboxReceipt = restoreStoredCommercialReceipt(row.envelope, scope, row.adapterVersion)
  if (inboxReceipt.state === 'invalid_event' || inboxReceipt.key !== row.key || inboxReceipt.digest !== row.envelopeHash) return false
  if ((await payload.count({ collection: 'commercial-conflicts', where: { inbox: { equals: row.id } }, overrideAccess: true, ...(req ? { req } : {}) })).totalDocs) return false
  const facts = await payload.find({ collection: 'transaction-events', where: { inbox: { equals: row.id } }, limit: 2, depth: 0, overrideAccess: true, ...(req ? { req } : {}), select: { key: true, envelope: true } })
  if (row.state === 'ignored') return inboxReceipt.state === 'prepared_ignored' && !row.transactionKey && !relationId(row.transaction) && facts.docs.length === 0
  const transactionId = relationId(row.transaction)
  if (!transactionId || facts.docs.length !== 1 || inboxReceipt.state !== 'prepared') return false
  const [fact] = facts.docs
  const ledgerReceipt = restoreStoredCommercialReceipt(fact.envelope, scope, row.adapterVersion)
  if (fact.key !== row.key || ledgerReceipt.state !== 'prepared' || ledgerReceipt.key !== row.key || ledgerReceipt.digest !== row.envelopeHash) return false
  const transaction = await payload.findByID({ collection: 'transactions', id: transactionId, depth: 0, overrideAccess: true, ...(req ? { req } : {}) }).catch(() => null)
  if (!transaction || transaction.needsReview !== false) return false
  return !!await storedCommercialEnvelope(payload, { ...row, envelope: null }, req)
}

/** Drops the aged inbox copy only when the retained ledger can reconstruct it. */
async function expireCommercialInboxEnvelopes(payload: Payload, now: Date, apply: boolean) {
  const cutoff = new Date(now.getTime() - PROCESSED_INBOX_RETENTION_DAYS * DAY).toISOString()
  const whereFor = (afterId?: string): Where => ({ and: [
    { processedAt: { less_than: cutoff } },
    { envelope: { exists: true } },
    ...(afterId ? [{ id: { greater_than: afterId } }] : []),
  ] })
  const candidates = (await payload.count({ collection: 'commercial-inbox', where: whereFor(), overrideAccess: true })).totalDocs
  let eligible = 0, processed = 0, preservedForReconciliation = 0, afterId: string | undefined
  while (true) {
    const rows = (await payload.find({ collection: 'commercial-inbox', where: whereFor(afterId), sort: 'id', limit: BATCH, depth: 0, overrideAccess: true, select: { id: true, key: true, provider: true, accountKey: true, adapterVersion: true, envelopeHash: true, envelope: true, state: true, conflicted: true, processedAt: true, transaction: true, transactionKey: true } })).docs as unknown as Array<{ id: string; key: string; provider: 'hotmart'|'kiwify'|'cakto'; accountKey: string; adapterVersion: string; envelopeHash: string; envelope?: unknown|null; state: string; conflicted: boolean; processedAt?: string|null; transaction?: Relation; transactionKey?: string|null }>
    if (!rows.length) break
    for (const row of rows) {
      afterId = row.id
      if (!apply) {
        if (await commercialInboxEnvelopeCanExpire(payload, row, cutoff)) eligible++
        else preservedForReconciliation++
        continue
      }
      const removed = await atomic(payload, async req => {
        const current = await req.payload.findByID({ collection: 'commercial-inbox', id: row.id, depth: 0, overrideAccess: true, req }).catch(() => null)
        if (!current || !current.envelope || Date.parse(current.processedAt ?? '') >= Date.parse(cutoff)) return false
        await lockCommercialAccounts(req, [current])
        await serial(req, `commercial-inbox:${current.key}`)
        const fresh = await req.payload.findByID({ collection: 'commercial-inbox', id: row.id, depth: 0, overrideAccess: true, req }).catch(() => null)
        if (!fresh || !await commercialInboxEnvelopeCanExpire(req.payload, fresh as never, cutoff, req)) return false
        await req.payload.update({ collection: 'commercial-inbox', id: fresh.id, data: { envelope: null }, overrideAccess: true, req })
        return true
      })
      if (removed) { eligible++; processed++ }
      else preservedForReconciliation++
    }
    if (rows.length < BATCH) break
  }
  return { candidates, eligible, processed, preservedForReconciliation }
}

async function commercialAuditCanExpire(payload: Payload, row: CommercialAuditRow, req?: PayloadRequest) {
  const inboxId = relationId(row.inbox)
  if (!inboxId) return false
  const inbox = await payload.findByID({ collection: 'commercial-inbox', id: inboxId, depth: 0, overrideAccess: true, ...(req ? { req } : {}) }).catch(() => null)
  if (!inbox || inbox.conflicted || !['applied', 'ignored'].includes(inbox.state)) return false
  const transactionId = relationId(row.transaction) ?? relationId(inbox.transaction as Relation)
  if (!transactionId) return true
  const transaction = await payload.findByID({ collection: 'transactions', id: transactionId, depth: 0, overrideAccess: true, ...(req ? { req } : {}) }).catch(() => null)
  return !!transaction && transaction.needsReview === false
}

/** Expires only settled commercial audit; unresolved inbox/transaction history remains for reconciliation. */
async function expireCommercialAudit(payload: Payload, cutoff: string, apply: boolean) {
  const whereFor = (afterId?: string): Where => ({ and: [
    { occurredAt: { less_than: cutoff } },
    ...(afterId ? [{ id: { greater_than: afterId } }] : []),
  ] })
  const candidates = (await payload.count({ collection: 'commercial-audit', where: whereFor(), overrideAccess: true })).totalDocs
  let eligible = 0, processed = 0, preservedForReconciliation = 0, afterId: string | undefined
  while (true) {
    const rows = (await payload.find({ collection: 'commercial-audit', where: whereFor(afterId), sort: 'id', limit: BATCH, depth: 0, overrideAccess: true, select: { id: true, inbox: true, transaction: true, occurredAt: true } })).docs as unknown as CommercialAuditRow[]
    if (!rows.length) break
    for (const row of rows) {
      afterId = row.id
      if (!apply) {
        if (await commercialAuditCanExpire(payload, row)) eligible++
        else preservedForReconciliation++
        continue
      }
      const removed = await atomic(payload, async req => {
        const currentAudit = await req.payload.findByID({ collection: 'commercial-audit', id: row.id, depth: 0, overrideAccess: true, req }).catch(() => null)
        if (!currentAudit || Date.parse(currentAudit.occurredAt) >= Date.parse(cutoff)) return false
        const inboxId = relationId(currentAudit.inbox as Relation)
        if (!inboxId) return false
        const initialInbox = await req.payload.findByID({ collection: 'commercial-inbox', id: inboxId, depth: 0, overrideAccess: true, req }).catch(() => null)
        if (!initialInbox) return false
        await lockCommercialAccounts(req, [initialInbox])
        await serial(req, `commercial-inbox:${initialInbox.key}`)
        const freshAudit = await req.payload.findByID({ collection: 'commercial-audit', id: row.id, depth: 0, overrideAccess: true, req }).catch(() => null)
        if (!freshAudit || Date.parse(freshAudit.occurredAt) >= Date.parse(cutoff)) return false
        if (!await commercialAuditCanExpire(req.payload, freshAudit as unknown as CommercialAuditRow, req)) return false
        await req.payload.delete({ collection: 'commercial-audit', id: freshAudit.id, overrideAccess: true, req })
        return true
      })
      if (removed) { eligible++; processed++ }
      else preservedForReconciliation++
    }
    if (rows.length < BATCH) break
  }
  return { candidates, eligible, processed, preservedForReconciliation }
}
