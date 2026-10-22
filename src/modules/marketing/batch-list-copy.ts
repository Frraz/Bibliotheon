import { createHash } from 'node:crypto'
import { validProviderCheck, type ProviderCheck } from './batch-check-copy'
export function providerIds(check: ProviderCheck): number[] { return check.recipients.map(item => item.providerId).sort((a, b) => a - b) }
export const listAudienceKey = (check: ProviderCheck) => createHash('sha256').update(JSON.stringify([check.batchKey, check.recipients.map(item => [item.contact, item.providerId]).sort((a, b) => String(a[0]) < String(b[0]) ? -1 : String(a[0]) > String(b[0]) ? 1 : 0)] )).digest('hex')
export function readAttemptedIds(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length > 200 || value.some(item => !Number.isSafeInteger(item) || item < 1) || new Set(value).size !== value.length) return null
  return value
}

export function readListSnapshot(value: unknown, key: string): ProviderCheck | null {
  if (!value || typeof value !== 'object') return null
  const data = value as ProviderCheck
  if (typeof data.checkedAt !== 'string' || !Array.isArray(data.recipients) || data.recipients.some(item => !item || typeof item.contact !== 'string' || typeof item.version !== 'string')) return null
  return validProviderCheck(data, key, data.recipients, Date.parse(data.checkedAt)) ? data : null
}
