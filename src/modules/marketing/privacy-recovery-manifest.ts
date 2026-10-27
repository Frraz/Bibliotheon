import { createHmac, timingSafeEqual } from 'node:crypto'
import { validLinkSecret } from './tokens'

export const PRIVACY_MANIFEST_LIMIT = 2 * 1024 * 1024
export const PRIVACY_MANIFEST_ENTRIES = 10000
export type PrivacyRecoveryEntry = { kind: 'suppression'|'delete'|'correct'|'retention'|'theme-unsubscribe'; theme?: string; fingerprint: string; occurredAt: string|null; expiresAt: string|null; deliveryState: 'ok'|'bounced'|'complaint'|'unknown'|null; outcome: 'completed'|'pending' }
export type PrivacyRecoveryManifest = { version: 1|2|3|4; generatedAt: string; entries: PrivacyRecoveryEntry[]; signature: string }
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
export function calendarMonths(iso: string, months: number) {
  const date = new Date(iso), day = date.getUTCDate()
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months)
  date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth()+1, 0)).getUTCDate()))
  return date.toISOString()
}
function canonical(value: unknown) {
  if (!exact(value, ['version','generatedAt','entries']) || ![1,2,3,4].includes(value.version as number) || !timestamp(value.generatedAt) || !Array.isArray(value.entries) || value.entries.length > PRIVACY_MANIFEST_ENTRIES) throw new Error('Manifesto de privacidade inválido.')
  const seen = new Set<string>()
  const entries = value.entries.map((entry): PrivacyRecoveryEntry => {
    const thematic = !!entry && typeof entry === 'object' && (entry as Record<string, unknown>).kind === 'theme-unsubscribe'
    const keys = ['kind','fingerprint','occurredAt','expiresAt','deliveryState',...(value.version !== 1 ? ['outcome'] : []),...(thematic ? ['theme'] : [])]
    if (!exact(entry, keys) || typeof entry.kind !== 'string' || !['suppression','delete','correct','retention','theme-unsubscribe'].includes(entry.kind) || entry.kind === 'retention' && ![3,4].includes(value.version as number) || thematic && (value.version !== 4 || typeof entry.theme !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(entry.theme)) || typeof entry.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(entry.fingerprint)) throw new Error('Entrada de privacidade inválida.')
    const outcome = value.version === 1 ? 'completed' : entry.outcome
    if (outcome !== 'pending' && outcome !== 'completed') throw new Error('Estado de decisão inválido.')
    if (entry.kind === 'suppression' ? typeof entry.deliveryState !== 'string' || !['ok','bounced','complaint','unknown'].includes(entry.deliveryState) : entry.deliveryState !== null) throw new Error('Estado de entrega inválido.')
    if (outcome === 'pending') {
      if (['suppression','retention','theme-unsubscribe'].includes(entry.kind) || entry.expiresAt !== null || !timestamp(entry.occurredAt) || entry.occurredAt > (value.generatedAt as string)) throw new Error('Pendência de privacidade inválida.')
    } else {
      if (!timestamp(entry.expiresAt) || (entry.kind === 'suppression' ? entry.occurredAt !== null : !timestamp(entry.occurredAt) || entry.occurredAt > (value.generatedAt as string) || calendarMonths(entry.occurredAt,24) !== entry.expiresAt)) throw new Error('Prazo de privacidade inválido.')
      if (entry.expiresAt > calendarMonths(value.generatedAt as string, entry.kind === 'suppression' ? 12 : 24)) throw new Error('Prazo de privacidade inválido.')
    }
    const key = `${entry.kind}:${entry.fingerprint}:${thematic ? entry.theme : ''}`
    if (seen.has(key)) throw new Error('Entrada de privacidade duplicada.')
    seen.add(key)
    return { kind: entry.kind as PrivacyRecoveryEntry['kind'], fingerprint: entry.fingerprint, occurredAt: entry.occurredAt as string|null, expiresAt: entry.expiresAt as string|null, deliveryState: entry.deliveryState as PrivacyRecoveryEntry['deliveryState'], outcome, ...(thematic ? { theme: entry.theme as string } : {}) }
  }).sort((a,b) => `${a.kind}:${a.fingerprint}:${a.theme ?? ''}`.localeCompare(`${b.kind}:${b.fingerprint}:${b.theme ?? ''}`))
  return { version: value.version as 1|2|3|4, generatedAt: value.generatedAt, entries }
}
const signaturePayload = (value: Omit<PrivacyRecoveryManifest,'signature'>) => value.version === 1 ? { ...value, entries: value.entries.map(entry => ({ kind: entry.kind, fingerprint: entry.fingerprint, occurredAt: entry.occurredAt, expiresAt: entry.expiresAt, deliveryState: entry.deliveryState })) } : value
const sign = (value: object, secret: string) => createHmac('sha256', secret).update('bibliotheon:privacy-recovery:v1\n').update(JSON.stringify(value)).digest('hex')
export function signPrivacyRecoveryManifest(entries: PrivacyRecoveryEntry[], secret: string, now = Date.now()): PrivacyRecoveryManifest {
  if (!validLinkSecret(secret)) throw new Error('Chave de privacidade indisponível.')
  const payload = canonical({ version: entries.some(entry => entry.kind === 'theme-unsubscribe') ? 4 : entries.some(entry => entry.kind === 'retention') ? 3 : 2, generatedAt: new Date(now).toISOString(), entries })
  const result = { ...payload, signature: sign(payload, secret) }
  if (Buffer.byteLength(JSON.stringify(result)) > PRIVACY_MANIFEST_LIMIT) throw new Error('Manifesto excede o limite.')
  return result
}
export function verifyPrivacyRecoveryManifest(input: string, secret: string, snapshotAt: string, now = Date.now()): PrivacyRecoveryManifest {
  if (!validLinkSecret(secret) || Buffer.byteLength(input) > PRIVACY_MANIFEST_LIMIT) throw new Error('Manifesto ou chave indisponível.')
  const raw: unknown = JSON.parse(input)
  if (!exact(raw, ['version','generatedAt','entries','signature']) || typeof raw.signature !== 'string' || !/^[a-f0-9]{64}$/.test(raw.signature)) throw new Error('Assinatura de privacidade inválida.')
  const value = canonical({ version: raw.version, generatedAt: raw.generatedAt, entries: raw.entries })
  if (!timingSafeEqual(Buffer.from(raw.signature,'hex'), Buffer.from(sign(signaturePayload(value),secret),'hex'))) throw new Error('Assinatura de privacidade inválida.')
  const nowISO = new Date(now).toISOString()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(snapshotAt) || !Number.isFinite(Date.parse(snapshotAt)) || new Date(snapshotAt).toISOString().slice(0,19) !== snapshotAt.slice(0,19)) throw new Error('Data de snapshot inválida.')
  const capturedAt = new Date(snapshotAt).toISOString()
  if (capturedAt > value.generatedAt || Date.parse(value.generatedAt) > now + 300000 || capturedAt < calendarMonths(nowISO,-3)) throw new Error('Snapshot ou manifesto fora da janela de recuperação.')
  return { ...value, signature: raw.signature }
}
