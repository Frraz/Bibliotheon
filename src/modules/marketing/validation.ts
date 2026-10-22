export const CONSENT_VERSION = 'marketing-tematico-v1'
export const CONSENT_TEXT = 'Quero receber conteúdos e ofertas deste tema por e-mail. Posso cancelar a qualquer momento.'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type LeadInput = { email: string; magnetId: string; marketingOptIn: boolean; consentVersion?: typeof CONSENT_VERSION; campaignCode?: string }
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && /^[^\s<>@\x00-\x1f\x7f]+@[^\s<>@\x00-\x1f\x7f]+\.[^\s<>@\x00-\x1f\x7f]+$/.test(email) ? email : null
}
/** Deliberately preserves dots/aliases; rejects extra fields and ambiguous consent types. */
export function parseLeadInput(value: unknown): LeadInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  if (Object.keys(data).some(k => !['email', 'magnetId', 'marketingOptIn', 'consentVersion', 'campaignCode'].includes(k))) return null
  if (typeof data.email !== 'string' || typeof data.magnetId !== 'string' || !uuid.test(data.magnetId) || typeof data.marketingOptIn !== 'boolean') return null
  const email = normalizeEmail(data.email)
  if (!email) return null
  if (data.marketingOptIn && data.consentVersion !== CONSENT_VERSION) return null
  if (data.consentVersion !== undefined && data.consentVersion !== CONSENT_VERSION) return null
  if (data.campaignCode !== undefined && (typeof data.campaignCode !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(data.campaignCode))) return null
  return { email, magnetId: data.magnetId, marketingOptIn: data.marketingOptIn, ...(data.marketingOptIn ? { consentVersion: CONSENT_VERSION } : {}), ...(typeof data.campaignCode === 'string' ? { campaignCode: data.campaignCode } : {}) }
}
