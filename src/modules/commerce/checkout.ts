export const providers = ['hotmart', 'kiwify', 'cakto'] as const
export type Provider = typeof providers[number]
export function validCheckout(value: unknown, allowedHosts: readonly string[]): boolean {
  if (typeof value !== 'string' || value.length > 4096) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && allowedHosts.includes(url.hostname) && !url.hash
  } catch { return false }
}
export const allowedCheckoutHosts = (provider?: Provider) => {
  const value = provider ? process.env[`CHECKOUT_ALLOWED_HOSTS_${provider.toUpperCase()}`] : process.env.CHECKOUT_ALLOWED_HOSTS
  return (value || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}
export function validCents(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }
