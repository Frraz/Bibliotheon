export type ListFailure = { state: 'retry' | 'rejected' | 'absent' | 'conflict' }
export type ListMetadata = { id: number; name: string; folderId: number }
export type ListMembers = { id: number; blocked: boolean; unsubscribed: boolean | null }[]
export type BrevoLists = {
  folderId: number
  find(name: string): Promise<{ state: 'found'; id: number } | ListFailure>
  create(name: string): Promise<{ state: 'created'; id: number } | ListFailure>
  details(id: number): Promise<{ state: 'found'; list: ListMetadata } | ListFailure>
  members(id: number): Promise<{ state: 'members'; contacts: ListMembers } | ListFailure>
  add(id: number, ids: number[]): Promise<{ state: 'acknowledged' } | ListFailure>
}
export const positiveId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
type Envelope = { id?: unknown; name?: unknown; folderId?: unknown; count?: unknown; lists?: unknown; contacts?: unknown }
async function json(response: Response): Promise<Envelope> { // Provider envelope is validated before projection.
  if (!response.body) throw new Error('Resposta inválida.')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0
  try {
    for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 65_536) throw new Error('Resposta inválida.'); chunks.push(part.value) }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Resposta inválida.')
    return value as Envelope
  } finally { await reader.cancel().catch(() => {}) }
}
export function createBrevoLists(apiKey: string, folderId: number, request: typeof fetch = fetch): BrevoLists {
  if (!apiKey || apiKey.startsWith('REPLACE_') || /[\x00-\x20\x7f]/.test(apiKey) || !positiveId(folderId)) throw new Error('Configuração de listas inválida.')
  const failure = (status: number): ListFailure => ({ state: status === 404 ? 'absent' : status === 429 || status >= 500 || status < 400 ? 'retry' : 'rejected' })
  const nameOK = (name: string) => /^bibliotheon-[a-f0-9-]{36}$/.test(name)
  async function call(route: string, method = 'GET', body?: unknown) {
    try { return await request(`https://api.brevo.com/v3${route}`, { method, redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { 'api-key': apiKey, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }) }
    catch { return null }
  }
  async function read(route: string) {
    const response = await call(route)
    if (!response) return { state: 'retry' as const }
    if (response.status !== 200) { await response.body?.cancel().catch(() => {}); return failure(response.status) }
    try { return { state: 'data' as const, data: await json(response) } } catch { return { state: 'retry' as const } }
  }
  return { folderId, async find(name) {
    if (!nameOK(name)) return { state: 'rejected' }
    const matches: number[] = [], seen = new Set<number>(); let total: number | undefined
    for (let offset = 0; offset < 1000; offset += 50) {
      const result = await read(`/contacts/folders/${folderId}/lists?limit=50&offset=${offset}&sort=asc`)
      if (result.state !== 'data') return result
      const data = result.data
      if (!data || typeof data.count !== 'number' || !Number.isSafeInteger(data.count) || data.count < 0 || data.count > 1000 || total !== undefined && data.count !== total || !Array.isArray(data.lists) || data.lists.length > 50) return { state: 'retry' }
      total = data.count
      for (const item of data.lists) {
        if (!item || !positiveId(item.id) || typeof item.name !== 'string' || seen.has(item.id)) return { state: 'retry' }
        seen.add(item.id); if (item.name === name) matches.push(item.id)
      }
      if (seen.size === total) return matches.length > 1 ? { state: 'conflict' } : matches.length === 1 ? { state: 'found', id: matches[0] } : { state: 'absent' }
      if (data.lists.length !== 50 || seen.size > total) return { state: 'retry' }
    }
    return { state: 'retry' }
  }, async create(name) {
    if (!nameOK(name)) return { state: 'rejected' }
    const response = await call('/contacts/lists', 'POST', { name, folderId })
    if (!response) return { state: 'retry' }
    if (response.status !== 201) { await response.body?.cancel().catch(() => {}); return failure(response.status) }
    try { const data = await json(response); return positiveId(data?.id) ? { state: 'created', id: data.id } : { state: 'retry' } } catch { return { state: 'retry' } }
  }, async details(id) {
    if (!positiveId(id)) return { state: 'rejected' }
    const result = await read(`/contacts/lists/${id}`)
    if (result.state !== 'data') return result
    const value = result.data
    return value?.id === id && typeof value.name === 'string' && positiveId(value.folderId) ? { state: 'found', list: { id, name: value.name, folderId: value.folderId } } : { state: 'retry' }
  }, async members(id) {
    if (!positiveId(id)) return { state: 'rejected' }
    const contacts: ListMembers = [], seen = new Set<number>(); let total: number | undefined
    for (let offset = 0; offset < 250; offset += 50) {
      const result = await read(`/contacts/lists/${id}/contacts?limit=50&offset=${offset}&sort=asc`)
      if (result.state !== 'data') return result
      const data = result.data
      if (!data || typeof data.count !== 'number' || !Number.isSafeInteger(data.count) || data.count < 0 || !Array.isArray(data.contacts) || data.contacts.length > 50 || total !== undefined && total !== data.count) return { state: 'retry' }
      if (data.count > 200) return { state: 'conflict' }
      total = data.count
      for (const item of data.contacts) {
        if (!item || !positiveId(item.id) || seen.has(item.id) || typeof item.emailBlacklisted !== 'boolean' || item.listUnsubscribed !== undefined && (!Array.isArray(item.listUnsubscribed) || !item.listUnsubscribed.every(positiveId))) return { state: 'retry' }
        seen.add(item.id); contacts.push({ id: item.id, blocked: item.emailBlacklisted, unsubscribed: Array.isArray(item.listUnsubscribed) ? item.listUnsubscribed.includes(id) : null })
      }
      if (seen.size === total) return { state: 'members', contacts }
      if (data.contacts.length !== 50 || seen.size > total) return { state: 'retry' }
    }
    return { state: 'retry' }
  }, async add(id, ids) {
    if (!positiveId(id) || !ids.length || ids.length > 150 || !ids.every(positiveId) || new Set(ids).size !== ids.length) return { state: 'rejected' }
    const response = await call(`/contacts/lists/${id}/contacts/add`, 'POST', { ids })
    if (!response) return { state: 'retry' }
    await response.body?.cancel().catch(() => {})
    return response.status === 201 ? { state: 'acknowledged' } : failure(response.status)
  } }
}
export function configuredBrevoLists(): BrevoLists | null {
  if (process.env.BREVO_LIST_SYNC_ENABLED !== 'true' || process.env.BREVO_CONTACT_SYNC_ENABLED !== 'true') return null
  const key = process.env.BREVO_API_KEY, folder = process.env.BREVO_LIST_FOLDER_ID
  if (!key || !folder || !/^[1-9]\d*$/.test(folder)) return null
  try { return createBrevoLists(key, Number(folder)) } catch { return null }
}
