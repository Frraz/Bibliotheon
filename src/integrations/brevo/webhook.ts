import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { normalizeEmail } from '../../modules/marketing/validation'
import { validLinkSecret } from '../../modules/marketing/tokens'
export const webhookEvents = ['delivered', 'hard_bounce', 'soft_bounce', 'spam', 'unsubscribe'] as const
export type WebhookEventKind = typeof webhookEvents[number]
export type MarketingWebhookEvent = { event: WebhookEventKind; email: string; campaignId: number; webhookId: number; occurredAt: string; sentAt: string }
export type WebhookConfig = { token: string; previousToken?: string; eventSecret: string; linkSecret: string }
const validToken = (value: string) => /^[A-Za-z0-9_-]{32,128}$/.test(value) && !value.startsWith('REPLACE_')
export function webhookConfig(env: Readonly<Record<string, string | undefined>> = process.env): WebhookConfig | null {
  const token = env.BREVO_WEBHOOK_TOKEN || '', previousToken = env.BREVO_WEBHOOK_PREVIOUS_TOKEN || '', eventSecret = env.BREVO_WEBHOOK_EVENT_SECRET || '', linkSecret = env.LEAD_TOKEN_SECRET || ''
  if (env.BREVO_WEBHOOK_ENABLED !== 'true' || !validToken(token) || previousToken && !validToken(previousToken) || !validLinkSecret(eventSecret) || !validLinkSecret(linkSecret) || /[\x00-\x20\x7f]/.test(eventSecret) || [token, previousToken, linkSecret, env.PAYLOAD_SECRET].filter(Boolean).includes(eventSecret) || [linkSecret, env.PAYLOAD_SECRET].includes(token) || previousToken && [token, linkSecret, env.PAYLOAD_SECRET].includes(previousToken)) return null
  return { token, ...(previousToken ? { previousToken } : {}), eventSecret, linkSecret }
}
export function authenticatedWebhook(header: string | null, config: WebhookConfig): boolean {
  if (!header || !/^Bearer [A-Za-z0-9_-]{32,128}$/.test(header)) return false
  const value = createHash('sha256').update(header.slice(7)).digest()
  const current = timingSafeEqual(value, createHash('sha256').update(config.token).digest())
  const previous = timingSafeEqual(value, createHash('sha256').update(config.previousToken || config.token).digest())
  return current || !!config.previousToken && previous
}
const positiveID = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0
export function parseMarketingWebhook(value: unknown, now = Date.now()): MarketingWebhookEvent | 'ignored' | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (typeof row.event !== 'string' || !/^[a-z_]{1,64}$/.test(row.event)) return null
  if (!webhookEvents.includes(row.event as WebhookEventKind)) return 'ignored'
  if (row.type !== undefined && row.type !== 'marketing' || row.channel !== undefined && row.channel !== 'email' || row.to !== undefined) return null
  const email = normalizeEmail(row.email)
  if (!email || !positiveID(row.camp_id) || !positiveID(row.id) || !Number.isSafeInteger(row.ts_event) || !Number.isSafeInteger(row.ts_sent)) return null
  const occurred = Number(row.ts_event) * 1000, sent = Number(row.ts_sent) * 1000
  if (sent < 0 || occurred < sent || occurred > now + 300_000 || !Number.isFinite(new Date(occurred).getTime())) return null
  return { event: row.event as WebhookEventKind, email, campaignId: row.camp_id, webhookId: row.id, occurredAt: new Date(occurred).toISOString(), sentAt: new Date(sent).toISOString() }
}
export const webhookRecipient = (email: string, secret: string) => createHmac('sha256', secret).update(`brevo-recipient-v1:${email}`).digest('hex')
/** Semantic identity excludes unrelated fields and the non-unique webhook ID. */
export const webhookEventKey = (event: MarketingWebhookEvent, secret: string) => createHmac('sha256', secret).update(JSON.stringify(['brevo-marketing-email-v1', event.event, event.campaignId, event.sentAt, event.occurredAt, webhookRecipient(event.email, secret)])).digest('hex')
