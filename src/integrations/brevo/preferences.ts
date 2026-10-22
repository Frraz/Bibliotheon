import { normalizeEmail } from '../../modules/marketing/validation'
import { preferenceOrigin } from '../../modules/marketing/preference-links'

export const PREFERENCE_ATTRIBUTE = 'BIBLIOTHEON_PREFERENCES'
export const PREFERENCE_PLACEHOLDER = '{{ contact.BIBLIOTHEON_PREFERENCES }}'
export type PreferenceResult = { state: 'verified' | 'blocked' | 'absent' | 'retry' | 'rejected' }
export type BrevoPreferences = { ensure(id: number, email: string, url: string): Promise<PreferenceResult> }
async function json(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('Resposta inválida.')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break
      size += part.value.byteLength; if (size > 65_536) throw new Error('Resposta inválida.')
      chunks.push(part.value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally { await reader.cancel().catch(() => {}) }
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const failure = (status: number): PreferenceResult => ({ state: status === 404 ? 'absent' : status === 429 || status >= 500 || status < 400 ? 'retry' : 'rejected' })
/** Writes one predefined text attribute only; never creates, merges, renames or unblocks a contact. */
export function createBrevoPreferences(key: string, origin: string, request: typeof fetch = fetch): BrevoPreferences {
  if (!key || key.startsWith('REPLACE_') || /[\x00-\x20\x7f]/.test(key)) throw new Error('Configuração de preferências inválida.')
  const site = preferenceOrigin(origin)
  async function call(route: string, method = 'GET', body?: unknown) {
    try { return await request(`https://api.brevo.com/v3${route}`, { method, redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { 'api-key': key, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }) }
    catch { return null }
  }
  let schemaAt = 0
  async function schema(): Promise<PreferenceResult> {
    if (schemaAt && Date.now() - schemaAt < 300_000) return { state: 'verified' }
    const response = await call('/contacts/attributes')
    if (!response) return { state: 'retry' }
    if (response.status !== 200) { await response.body?.cancel().catch(() => {}); return failure(response.status) }
    try {
      const value = await json(response)
      if (!object(value) || !Array.isArray(value.attributes)) return { state: 'retry' }
      const matches = value.attributes.filter((item): item is Record<string, unknown> => object(item) && item.name === PREFERENCE_ATTRIBUTE)
      if (matches.length !== 1 || matches[0].category !== 'normal' || matches[0].type !== 'text') return { state: 'rejected' }
      schemaAt = Date.now(); return { state: 'verified' }
    } catch { return { state: 'retry' } }
  }
  return { async ensure(id, email, url) {
    if (!Number.isSafeInteger(id) || id < 1 || normalizeEmail(email) !== email) return { state: 'rejected' }
    try {
      const value = new URL(url)
      if (value.origin !== site || value.pathname !== '/preferencias' || value.username || value.password || value.hash || value.searchParams.size !== 1 || !/^[\w-]{43}$/.test(value.searchParams.get('t') || '')) return { state: 'rejected' }
    } catch { return { state: 'rejected' } }
    const validSchema = await schema(); if (validSchema.state !== 'verified') return validSchema
    const route = `/contacts/${id}?identifierType=contact_id`
    async function inspect(): Promise<PreferenceResult & { matches?: boolean }> {
      const response = await call(route)
      if (!response) return { state: 'retry' }
      if (response.status !== 200) { await response.body?.cancel().catch(() => {}); return failure(response.status) }
      try {
        const data = await json(response)
        if (!object(data) || data.id !== id || typeof data.email !== 'string' || normalizeEmail(data.email) !== email || typeof data.emailBlacklisted !== 'boolean' || !object(data.attributes)) return { state: 'retry' }
        if (data.emailBlacklisted) return { state: 'blocked' }
        return { state: 'verified', matches: data.attributes[PREFERENCE_ATTRIBUTE] === url }
      } catch { return { state: 'retry' } }
    }
    const current = await inspect()
    if (current.state !== 'verified') return { state: current.state }
    if (current.matches) return { state: 'verified' }
    const response = await call(route, 'PUT', { attributes: { [PREFERENCE_ATTRIBUTE]: url } })
    await response?.body?.cancel().catch(() => {})
    // A timeout or ignored value is reconciled by GET; 204 is never treated as proof by itself.
    const confirmed = await inspect()
    if (confirmed.state !== 'verified') return { state: confirmed.state }
    if (confirmed.matches) return { state: 'verified' }
    return response && response.status >= 400 && response.status < 500 && response.status !== 429 ? { state: 'rejected' } : { state: 'retry' }
  } }
}
export function configuredBrevoPreferences(): BrevoPreferences | null {
  if (process.env.BREVO_PREFERENCE_SYNC_ENABLED !== 'true' || process.env.BREVO_CONTACT_SYNC_ENABLED !== 'true') return null
  try { return createBrevoPreferences(process.env.BREVO_API_KEY || '', process.env.PUBLIC_SITE_URL || '') } catch { return null }
}
