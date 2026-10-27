import { createHmac } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'
import { serial } from './transaction'
import { validLinkSecret } from './tokens'

const RETENTION_MONTHS = 12

function expiry(now: number) {
  const result = new Date(now)
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + RETENTION_MONTHS)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result.toISOString()
}

export function suppressionFingerprint(email: string, secret: string) {
  if (!validLinkSecret(secret)) throw new Error('Chave de privacidade indisponível.')
  return createHmac('sha256', secret).update(`marketing-suppression:${email.trim().toLowerCase()}`).digest('hex')
}

/** Stores only a keyed fingerprint; the row has no contact relation or email. */
export async function retainSuppressionTombstone(payload: Payload, email: string, secret: string, now: number, req?: PayloadRequest) {
  const fingerprint = suppressionFingerprint(email, secret)
  if (req) await serial(req, `marketing-suppression:${fingerprint}`)
  const existing = (await payload.find({ collection: 'marketing-suppression-tombstones', where: { fingerprint: { equals: fingerprint } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
  const expiresAt = expiry(now)
  if (existing) {
    if (Date.parse(existing.expiresAt) < Date.parse(expiresAt)) await payload.update({ collection: 'marketing-suppression-tombstones', id: existing.id, data: { expiresAt }, overrideAccess: true, req })
    return fingerprint
  }
  await payload.create({ collection: 'marketing-suppression-tombstones', data: { fingerprint, expiresAt }, overrideAccess: true, req })
  return fingerprint
}

/** Removes the tombstone only after an explicit opt-in has been confirmed. */
export async function clearSuppressionTombstone(payload: Payload, email: string, secret: string, req: PayloadRequest) {
  const fingerprint = suppressionFingerprint(email, secret)
  await serial(req, `marketing-suppression:${fingerprint}`)
  const rows = await payload.find({ collection: 'marketing-suppression-tombstones', where: { fingerprint: { equals: fingerprint } }, pagination: false, depth: 0, overrideAccess: true, req })
  for (const row of rows.docs) await payload.delete({ collection: 'marketing-suppression-tombstones', id: row.id, overrideAccess: true, req })
  return rows.docs.length
}
