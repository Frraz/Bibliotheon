import { normalizeEmail } from '../../modules/marketing/validation'

export type ContactLookup = { state: 'found'; id: number; blocked: boolean } | { state: 'absent' | 'retry' | 'rejected' }
export type ContactBlockResult = { state: 'blocked' | 'absent' | 'retry' | 'rejected' }
export type BrevoContactDirectory = BrevoContacts & { ensure(email: string): Promise<ContactLookup> }
export type BrevoContacts = { inspect(email: string): Promise<ContactLookup>; block(email: string): Promise<ContactBlockResult> }
const MAX_RESPONSE = 65_536
async function minimalJSON(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('Resposta inválida.')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > MAX_RESPONSE) throw new Error('Resposta inválida.')
      chunks.push(chunk.value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally { await reader.cancel().catch(() => {}) }
}
/** Fixed origin and bounded responses. Never modifies existing identity or unblocks consent. */
export function createBrevoContacts(apiKey: string, request: typeof fetch = fetch): BrevoContactDirectory {
  if (!apiKey || apiKey.startsWith('REPLACE_') || /[\x00-\x20\x7f]/.test(apiKey)) throw new Error('Configuração de sincronização inválida.')
  async function call(email: string, method: 'GET' | 'PUT' | 'POST') {
    if (normalizeEmail(email) !== email) return null
    try {
      return await request(method === 'POST' ? 'https://api.brevo.com/v3/contacts' : `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(15_000),
        headers: { 'api-key': apiKey, Accept: 'application/json', ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}) },
        ...(method === 'PUT' ? { body: JSON.stringify({ emailBlacklisted: true }) } : method === 'POST' ? { body: JSON.stringify({ email, updateEnabled: false, forceMerge: false }) } : {}),
      })
    } catch { return null }
  }
  const status = (code: number): 'absent' | 'retry' | 'rejected' => code === 404 ? 'absent' : code === 429 || code >= 500 || code < 400 ? 'retry' : 'rejected'
  async function inspect(email: string): Promise<ContactLookup> {
    const response = await call(email, 'GET')
    if (!response) return { state: 'retry' }
    if (response.status !== 200) { await response.body?.cancel().catch(() => {}); return { state: status(response.status) } }
    try {
      const value = await minimalJSON(response)
      if (!value || typeof value !== 'object' || !('id' in value) || !Number.isSafeInteger(value.id) || Number(value.id) < 1 || !('emailBlacklisted' in value) || typeof value.emailBlacklisted !== 'boolean' || 'email' in value && (typeof value.email !== 'string' || normalizeEmail(value.email) !== email)) return { state: 'retry' }
      return { state: 'found', id: Number(value.id), blocked: value.emailBlacklisted }
    } catch { return { state: 'retry' } }
  }
  return { inspect, async ensure(email) {
    const current = await inspect(email)
    if (current.state !== 'absent') return current
    const response = await call(email, 'POST')
    await response?.body?.cancel().catch(() => {})
    // Reconcile by identity even after a conflict, timeout or ambiguous success.
    const observed = await inspect(email)
    if (observed.state !== 'absent') return observed
    if (!response || response.status === 201 || [425, 429].includes(response.status) || response.status >= 500) return { state: 'retry' }
    return { state: 'rejected' }
  }, async block(email) {
    const current = await inspect(email)
    if (current.state !== 'found') return { state: current.state }
    if (current.blocked) return { state: 'blocked' }
    const response = await call(email, 'PUT')
    if (!response) return { state: 'retry' }
    await response.body?.cancel().catch(() => {})
    if (response.status !== 204) return { state: status(response.status) }
    // A success acknowledgement alone is insufficient: observe the intended state.
    const confirmed = await inspect(email)
    return confirmed.state === 'found' ? { state: confirmed.blocked ? 'blocked' : 'retry' } : { state: confirmed.state }
  } }
}
export function configuredBrevoContacts(): BrevoContacts | null {
  const key = process.env.BREVO_API_KEY
  if (process.env.BREVO_CONTACT_SYNC_ENABLED !== 'true' || !key) return null
  try { return createBrevoContacts(key) } catch { return null }
}

export function configuredBrevoRegistration(): BrevoContactDirectory | null {
  if (process.env.BREVO_CONTACT_REGISTRATION_ENABLED !== 'true' || process.env.BREVO_CONTACT_SYNC_ENABLED !== 'true') return null
  const key = process.env.BREVO_API_KEY
  if (!key) return null
  try { return createBrevoContacts(key) } catch { return null }
}
