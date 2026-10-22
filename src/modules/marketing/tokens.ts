import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const opaquePattern = /^[A-Za-z0-9_-]{43}$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY = 86_400_000
export const CONFIRMATION_TTL = DAY
export const UNSUBSCRIBE_TTL = 180 * DAY
export const DOWNLOAD_TTL = DAY

/** Raw confirmation/unsubscribe tokens exist only in memory and in the recipient's link. */
export function createOpaqueToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashOpaqueToken(token)! }
}
export function hashOpaqueToken(token: unknown): string | null {
  return typeof token === 'string' && opaquePattern.test(token)
    ? createHash('sha256').update(token, 'ascii').digest('hex') : null
}
function key(secret: string) {
  if (!validLinkSecret(secret)) throw new Error('Configure uma chave privada de links com pelo menos 32 bytes.')
  return secret
}
export function validLinkSecret(value: unknown): value is string {
  return typeof value === 'string' && Buffer.byteLength(value) >= 32 && !value.startsWith('REPLACE_')
}
/** Purpose/version prefix prevents accepting other token kinds as a download link. */
export function signDownload(requestId: string, secret: string, now = Date.now()) {
  if (!uuidPattern.test(requestId) || !Number.isSafeInteger(now) || now < 0) throw new Error('Contexto de download inválido.')
  const body = Buffer.from(JSON.stringify({ v: 1, id: requestId, exp: now + DOWNLOAD_TTL })).toString('base64url')
  const signature = createHmac('sha256', key(secret)).update(`download:v1:${body}`).digest('base64url')
  return `${body}.${signature}`
}
export function verifyDownload(token: unknown, secret: string, now = Date.now()): string | null {
  key(secret)
  if (typeof token !== 'string' || token.length > 256 || !Number.isSafeInteger(now) || now < 0) return null
  const parts = token.split('.')
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !opaquePattern.test(parts[1])) return null
  const [body, signature] = parts
  const expected = createHmac('sha256', secret).update(`download:v1:${body}`).digest()
  const provided = Buffer.from(signature, 'base64url')
  if (provided.length !== expected.length || !timingSafeEqual(expected, provided)) return null
  try {
    const value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (value?.v !== 1 || typeof value.id !== 'string' || !uuidPattern.test(value.id) || !Number.isSafeInteger(value.exp)) return null
    // Reject future issuance and overlong validity even if signed by this key.
    if (value.exp <= now || value.exp > now + DOWNLOAD_TTL) return null
    return value.id as string
  } catch { return null }
}
