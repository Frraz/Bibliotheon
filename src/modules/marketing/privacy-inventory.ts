import type { Payload } from 'payload'

const groups = {
  marketing: ['contacts', 'subscriptions', 'consent-events', 'magnet-requests', 'email-deliveries', 'preference-tokens', 'marketing-suppression-tombstones', 'request-limits', 'mail-quota', 'sequence-enrollments', 'promotion-deliveries', 'email-campaign-batches', 'brevo-registrations', 'brevo-suppressions', 'brevo-batch-lists', 'brevo-campaign-drafts', 'brevo-campaign-sends', 'brevo-campaign-observations', 'brevo-webhook-events', 'brevo-delivery-receipts', 'privacy-request-audit', 'contact-retirements', 'theme-withdrawals'],
  analytics: ['analytics-grants', 'visits', 'page-views', 'checkout-clicks', 'analytics-limits', 'analytics-daily-aggregates'],
  commerce: ['commercial-inbox', 'commercial-conflicts', 'commercial-audit', 'transactions', 'transaction-events', 'commercial-import-batches', 'commercial-import-rows', 'commercial-import-audit', 'commercial-report-evidence', 'catalog-resolutions', 'financial-resolutions', 'financial-resolution-applications', 'commercial-settlement-evidence', 'financial-cost-entries'],
} as const

/** Counts only. Never reads or returns identifiers, dates, row content, or personal data. */
export async function runPrivacyInventory(payload: Payload, now = Date.now()) {
  if (!Number.isFinite(now)) throw new Error('Instante do inventário inválido.')
  const report = {} as Record<keyof typeof groups, Record<string, number>>
  for (const [group, collections] of Object.entries(groups) as [keyof typeof groups, readonly string[]][]) {
    const rows = await Promise.all(collections.map(async collection => [collection, (await payload.count({ collection: collection as never, overrideAccess: true })).totalDocs] as const))
    report[group] = Object.fromEntries(rows)
  }
  const totalRecords = Object.values(report).flatMap(group => Object.values(group)).reduce((total, count) => total + count, 0)
  return { schema: 'bibliotheon-privacy-inventory:v1', generatedAt: new Date(now).toISOString(), classification: 'aggregate_counts_only', totalRecords, groups: report }
}
