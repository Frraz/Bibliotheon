export const PROVIDER_CHECK_TTL = 5 * 60_000
export type ProviderCheck = { version: 1; batchKey: string; checkedAt: string; recipients: { contact: string; version: string; providerId: number }[] }
export function validProviderCheck(value: unknown, batchKey: string, recipients: { contact: string; version: string }[], now: number): value is ProviderCheck {
  if (!value || typeof value !== 'object') return false
  const check = value as ProviderCheck
  if (typeof check.checkedAt !== 'string' || !Number.isSafeInteger(now) || now < 0) return false
  const checkedAt = Date.parse(check.checkedAt)
  if (check.version !== 1 || check.batchKey !== batchKey || !Number.isFinite(checkedAt) || checkedAt > now || now - checkedAt > PROVIDER_CHECK_TTL || !Array.isArray(check.recipients) || check.recipients.length !== recipients.length || !recipients.length || recipients.length > 200) return false
  const expected = new Map(recipients.map(item => [item.contact, item.version])), seen = new Set<string>(), providerIds = new Set<number>()
  for (const item of check.recipients) {
    if (!item || typeof item.contact !== 'string' || typeof item.version !== 'string' || !expected.has(item.contact) || seen.has(item.contact) || expected.get(item.contact) !== item.version || !Number.isSafeInteger(item.providerId) || item.providerId < 1 || providerIds.has(item.providerId)) return false
    seen.add(item.contact); providerIds.add(item.providerId)
  }
  return seen.size === expected.size
}
