export type SendOutcome = 'issuing' | 'submitted' | 'rejected' | 'uncertain'
export type SendAttempt = { number: number; token: string; issuedAt: string; quotaDay: string; count: number; state: SendOutcome; code?: 204 | 400 | 402 | 404; settledAt?: string }
export function readSendHistory(value: unknown): SendAttempt[] | null {
  if (!Array.isArray(value)) return null
  const tokens = new Set<string>(), result: SendAttempt[] = []
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== 'object' || item.number !== index + 1 || typeof item.token !== 'string' || !/^[a-f0-9-]{36}$/.test(item.token) || tokens.has(item.token) || typeof item.issuedAt !== 'string' || !Number.isFinite(Date.parse(item.issuedAt)) || item.quotaDay !== new Date(item.issuedAt).toISOString().slice(0,10) || !Number.isInteger(item.count) || item.count < 1 || item.count > 200 || !['issuing','submitted','rejected','uncertain'].includes(item.state)) return null
    if (index < value.length - 1 && item.state !== 'rejected' || item.state !== 'issuing' && item.settledAt === undefined || item.state === 'issuing' && item.settledAt !== undefined) return null
    if (item.state === 'submitted' && item.code !== 204 || item.state === 'rejected' && ![400,402,404].includes(item.code) || ['issuing','uncertain'].includes(item.state) && item.code !== undefined || item.settledAt !== undefined && (typeof item.settledAt !== 'string' || !Number.isFinite(Date.parse(item.settledAt)) || Date.parse(item.settledAt) < Date.parse(item.issuedAt))) return null
    tokens.add(item.token); result.push({ number:item.number, token:item.token, issuedAt:item.issuedAt, quotaDay:item.quotaDay, count:item.count, state:item.state, ...(item.code === undefined ? {} : {code:item.code}), ...(item.settledAt === undefined ? {} : {settledAt:item.settledAt}) })
  }
  return result
}
