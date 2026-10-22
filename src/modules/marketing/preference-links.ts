import { createHmac, randomUUID } from 'node:crypto'
import type { PreferenceToken } from '../../payload-types'
import type { PayloadRequest } from 'payload'
import { hashOpaqueToken, UNSUBSCRIBE_TTL, validLinkSecret } from './tokens'
import { idOf } from './sequence-copy'

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const RENEW_BEFORE = 7 * 86_400_000
export function preferenceOrigin(origin: string) {
  const url = new URL(origin)
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw new Error('Origem privada de links inválida.')
  return url.origin
}
export function derivePreferenceToken(contact: string, nonce: string, secret: string) {
  if (!uuid.test(contact) || !uuid.test(nonce) || !validLinkSecret(secret)) throw new Error('Contexto de preferências inválido.')
  return createHmac('sha256', secret).update(`brevo-preference:v1:${contact}:${nonce}`).digest('base64url')
}
/** Caller holds the contact lock and already checked current consent. Intent commits before HTTP. */
export async function issuePreferenceLink(req: PayloadRequest, contact: string, secret: string, origin: string, now: number) {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Instante de preferências inválido.')
  const sourceKey = `brevo-preference:${contact}`, site = preferenceOrigin(origin)
  let record: PreferenceToken | undefined = (await req.payload.find({ collection: 'preference-tokens', where: { sourceKey: { equals: sourceKey } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
  if (record && idOf(record.contact) !== contact) throw new Error('Titular do link inconsistente.')
  let token = record?.nonce && uuid.test(record.nonce) ? derivePreferenceToken(contact, record.nonce, secret) : null
  if (record && (!Number.isFinite(Date.parse(record.expiresAt)) || !token || record.tokenHash !== hashOpaqueToken(token) || Date.parse(record.expiresAt) <= now + RENEW_BEFORE || Date.parse(record.expiresAt) > now + UNSUBSCRIBE_TTL)) {
    // Preserve previous hash/expiry: an already received link remains usable for its original lifetime.
    await req.payload.update({ collection: 'preference-tokens', id: record.id, data: { sourceKey: null }, overrideAccess: true, req })
    record = undefined
  }
  if (!record) {
    const nonce = randomUUID()
    token = derivePreferenceToken(contact, nonce, secret)
    record = await req.payload.create({ collection: 'preference-tokens', data: { contact, sourceKey, nonce, tokenHash: hashOpaqueToken(token)!, expiresAt: new Date(now + UNSUBSCRIBE_TTL).toISOString() }, overrideAccess: true, req })
  }
  if (!Number.isFinite(Date.parse(record.expiresAt)) || !token || record.tokenHash !== hashOpaqueToken(token)) throw new Error('Link privado inconsistente.')
  return { tokenHash: record.tokenHash, tokenId: record.id, expiresAt: record.expiresAt, url: `${site}/preferencias?t=${token}` }
}
