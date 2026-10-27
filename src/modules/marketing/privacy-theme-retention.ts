import { legacyThemeWithdrawalProof } from './legacy-theme-withdrawal'
import { marketingRetentionCutoff } from './retention-policy'
import { webhookRecipient } from '../../integrations/brevo/webhook'
import { sendRecipientFingerprint } from './send-recipients'
import { suppressionFingerprint } from './suppression-tombstone'
import type { Payload, Where } from 'payload'
import { contactFingerprint } from './contact'
import { hasSharedMarketingReference } from './privacy-marketing-retention'
import { hasNewerThemeConsent, withdrawalKey, storeThemeWithdrawal } from './theme-withdrawal'
import { atomic, serial } from './transaction'
import { validLinkSecret } from './tokens'

const PAGE = 100, LIMIT = 10000
const idOf = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id
const aged = (value: string | null | undefined, cutoff: string) => !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.parse(cutoff)
export type ThemeRetentionReport = { cutoff: string; guardAvailable: boolean; candidates: number; eligible: number; processed: number; removedSubscriptions: number; removedEnrollments: number; removedPromotions: number; preservedForReconciliation: number; expiredMarkers: number; backfilledMarkers: number; expiredProofClosures: number }

/** Only closed local thematic state; preserve the contact, sample, consent proof and withdrawal fact. */
export async function expireWithdrawnThemes(payload: Payload, now: number, apply: boolean, secret: string | undefined): Promise<ThemeRetentionReport> {
  if (!Number.isFinite(now)) throw new Error('Data de retenção inválida.')
  const cutoff = marketingRetentionCutoff(now), currentTime = new Date(now).toISOString()
  const whereFor = (id?: string): Where => ({ and: [{ state: { equals: 'unsubscribed' } }, { unsubscribedAt: { less_than_equal: cutoff } }, { updatedAt: { less_than_equal: cutoff } }, ...(id ? [{ id: { greater_than: id } }] : [])] })
  const report: ThemeRetentionReport = { cutoff, guardAvailable: validLinkSecret(secret), candidates: (await payload.count({ collection: 'subscriptions', where: whereFor(), overrideAccess: true })).totalDocs, eligible: 0, processed: 0, removedSubscriptions: 0, removedEnrollments: 0, removedPromotions: 0, preservedForReconciliation: 0, expiredMarkers: 0, backfilledMarkers: 0, expiredProofClosures: 0 }
  if (apply) {
    let cursor: string | undefined
    while (true) {
      const rows = await payload.find({ collection: 'theme-withdrawals', where: { and: [{ expiresAt: { less_than_equal: currentTime } }, ...(cursor ? [{ id: { greater_than: cursor } }] : [])] }, sort: 'id', limit: PAGE, depth: 0, overrideAccess: true })
      for (const row of rows.docs) {
        cursor = row.id
        const removed = await atomic(payload, async req => {
          await serial(req, `theme-withdrawal:${row.key}`)
          const fresh = await payload.findByID({ collection: 'theme-withdrawals', id: row.id, depth: 0, overrideAccess: true, req, disableErrors: true })
          if (!fresh || fresh.expiresAt > currentTime) return false
          await payload.delete({ collection: 'theme-withdrawals', id: row.id, overrideAccess: true, req }); return true
        })
        if (removed) report.expiredMarkers++
      }
      if (rows.docs.length < PAGE) break
    }
  }
  if (!report.guardAvailable || !secret) { report.preservedForReconciliation = report.candidates; return report }
  let cursor: string | undefined
  while (true) {
    const rows = await payload.find({ collection: 'subscriptions', where: whereFor(cursor), sort: 'id', limit: PAGE, depth: 0, overrideAccess: true })
    for (const row of rows.docs) {
      cursor = row.id
      const outcome = await atomic(payload, async req => {
        await serial(req, 'promotion-batches')
        const contactId = idOf(row.contact), theme = idOf(row.theme)
        if (!contactId || !theme) return null
        await serial(req, `contact:${contactId}`)
        const sub = await payload.findByID({ collection: 'subscriptions', id: row.id, depth: 0, overrideAccess: true, req, disableErrors: true })
        const contact = await payload.findByID({ collection: 'contacts', id: contactId, depth: 0, overrideAccess: true, req, disableErrors: true })
        if (!sub || !contact || idOf(sub.contact) !== contactId || idOf(sub.theme) !== theme || sub.state !== 'unsubscribed' || !aged(sub.unsubscribedAt, cutoff) || !aged(sub.updatedAt, cutoff)) return null
        const fingerprint = contactFingerprint(contact.email, secret), key = withdrawalKey(fingerprint, theme)
        await serial(req, `theme-withdrawal:${key}`)
        let marker: { withdrawnAt:string; expiresAt:string } | undefined = (await payload.find({ collection: 'theme-withdrawals', where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
        let legacy = false, expiredProof = false
        if (!marker || !sub.unsubscribedAt || marker.withdrawnAt < sub.unsubscribedAt) {
          const proof = await legacyThemeWithdrawalProof(req, sub, now)
          if (proof.state === 'unverified') return null
          marker = proof
          legacy = proof.state === 'verified'
          expiredProof = proof.state === 'expired'
        }
        if (!marker || (!expiredProof && marker.expiresAt <= currentTime) || !aged(marker.withdrawnAt, cutoff) || marker.withdrawnAt < sub.unsubscribedAt! || await hasNewerThemeConsent(req, contactId, theme, marker.withdrawnAt)) return null
        if ((await payload.count({ collection: 'privacy-request-audit', where: { and: [{ subjectFingerprint: { equals: fingerprint } }, { action: { in: ['delete', 'correct'] } }, { outcome: { in: ['pending', 'completed'] } }] }, overrideAccess: true, req })).totalDocs) return null
        for (const collection of ['brevo-registrations', 'brevo-suppressions', 'brevo-webhook-events'] as const) if ((await payload.count({ collection, where: { contact: { equals: contactId } }, overrideAccess: true, req })).totalDocs) return null
        if ((await payload.count({ collection: 'email-deliveries', where: { and: [{ contact: { equals: contactId } }, { state: { in: ['sending', 'uncertain'] } }] }, overrideAccess: true, req })).totalDocs) return null
        if ((await payload.count({ collection: 'subscriptions', where: { and: [{ contact: { equals: contactId } }, { theme: { equals: theme } }, { state: { not_equals: 'unsubscribed' } }] }, overrideAccess: true, req })).totalDocs) return null
        const orphanEvents = (await payload.count({ collection: 'brevo-webhook-events', where: { contact: { exists: false } }, overrideAccess: true, req })).totalDocs
        if (orphanEvents) {
          const eventKey = process.env.BREVO_WEBHOOK_EVENT_SECRET
          if (!validLinkSecret(eventKey) || (await payload.count({ collection: 'brevo-webhook-events', where: { and: [{ contact: { exists: false } }, { recipientFingerprint: { equals: webhookRecipient(contact.email, eventKey!) } }] }, overrideAccess: true, req })).totalDocs) return null
        }
        const enrollments = await payload.find({ collection: 'sequence-enrollments', where: { and: [{ contact: { equals: contactId } }, { theme: { equals: theme } }] }, limit: LIMIT + 1, depth: 0, overrideAccess: true, req })
        if (enrollments.totalDocs > LIMIT) throw new Error('Calendários excedem o limite de retenção temática.')
        if (enrollments.docs.some(item => item.state !== 'canceled' || !aged(item.canceledAt, cutoff) || !aged(item.updatedAt, cutoff))) return null
        const ids = enrollments.docs.map(item => item.id)
        const promotions = ids.length ? await payload.find({ collection: 'promotion-deliveries', where: { enrollment: { in: ids } }, limit: LIMIT + 1, depth: 0, overrideAccess: true, req }) : { totalDocs: 0, docs: [] }
        if (promotions.totalDocs > LIMIT) throw new Error('Etapas excedem o limite de retenção temática.')
        if (promotions.docs.some(item => idOf(item.contact) !== contactId || item.state !== 'canceled' || !!idOf(item.batch) || !aged(item.updatedAt, cutoff))) return null
        if (promotions.docs.length) for (const collection of ['brevo-delivery-receipts', 'brevo-webhook-events'] as const) if ((await payload.count({ collection, where: { delivery: { in: promotions.docs.map(item => item.id) } }, overrideAccess: true, req })).totalDocs) return null
        if (await hasSharedMarketingReference(payload, new Set([contactId, fingerprint, sendRecipientFingerprint(contact.email, secret), suppressionFingerprint(contact.email, secret), sub.id, ...ids, ...promotions.docs.map(item => item.id)]), req, [contact.email])) return null
        if (apply) {
          if (legacy) await storeThemeWithdrawal(req, fingerprint, theme, marker.withdrawnAt)
          for (const item of promotions.docs) await payload.delete({ collection: 'promotion-deliveries', id: item.id, overrideAccess: true, req })
          for (const item of enrollments.docs) await payload.delete({ collection: 'sequence-enrollments', id: item.id, overrideAccess: true, req })
          await payload.delete({ collection: 'subscriptions', id: sub.id, overrideAccess: true, req })
        }
        return { enrollments: ids.length, promotions: promotions.docs.length, legacy, expiredProof }
      })
      if (!outcome) report.preservedForReconciliation++
      else { report.eligible++; if (apply) { report.processed++; report.removedSubscriptions++; if (outcome.legacy) report.backfilledMarkers++; if (outcome.expiredProof) report.expiredProofClosures++; report.removedEnrollments += outcome.enrollments; report.removedPromotions += outcome.promotions } }
    }
    if (rows.docs.length < PAGE) break
  }
  return report
}
