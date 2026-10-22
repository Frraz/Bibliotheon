import { createHash } from 'node:crypto'

export const sequenceDays = [2, 4, 7, 10] as const
export type SequenceDay = typeof sequenceDays[number]
export type SequenceCopy = { revision: number; offerId: string; messages: { day: SequenceDay; subject: string; text: string }[] }
export type SequenceSnapshot = SequenceCopy & { contentHash: string; ebookId: string; campaignCode?: string }
export const idOf = (value: string | { id: string }) => typeof value === 'string' ? value : value.id
export const enrollmentKey = (contact: string, magnet: string, version: string) => createHash('sha256').update(JSON.stringify([contact, magnet, version])).digest('hex')
export function sequenceCopy(value: unknown): SequenceCopy | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (!Number.isSafeInteger(data.revision) || Number(data.revision) < 1 || Number(data.revision) > 2_147_483_647) return null
  const offerId = typeof data.offer === 'string' ? data.offer : data.offer && typeof data.offer === 'object' && 'id' in data.offer ? data.offer.id : null
  if (typeof offerId !== 'string' || !/^[a-f0-9-]{36}$/i.test(offerId)) return null
  const messages: SequenceCopy['messages'] = []
  for (const day of sequenceDays) {
    const entry = data[`day${day}`]
    if (!entry || typeof entry !== 'object') return null
    const { subject, text } = entry as Record<string, unknown>
    if (typeof subject !== 'string' || typeof text !== 'string') return null
    const title = subject.trim(), body = text.replace(/\r\n?/g, '\n').trim()
    if (!title || title.length > 160 || /[\x00-\x1f\x7f]/.test(title) || !body || body.length > 6000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body)) return null
    messages.push({ day, subject: title, text: body })
  }
  return { revision: Number(data.revision), offerId, messages }
}
export const copyHash = (copy: SequenceCopy) => createHash('sha256').update(JSON.stringify({ offerId: copy.offerId, messages: copy.messages })).digest('hex')
export const dueAt = (confirmedAt: string, day: SequenceDay) => new Date(Date.parse(confirmedAt) + day * 86_400_000).toISOString()

export function readSequenceSnapshot(value: unknown): SequenceSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (!Array.isArray(data.messages) || data.messages.length !== 4 || typeof data.ebookId !== 'string' || !/^[a-f0-9-]{36}$/i.test(data.ebookId)) return null
  const fields: Record<string, unknown> = { revision: data.revision, offer: data.offerId }
  for (let index = 0; index < sequenceDays.length; index++) {
    const message = data.messages[index]
    if (!message || typeof message !== 'object' || message.day !== sequenceDays[index]) return null
    fields[`day${message.day}`] = { subject: message.subject, text: message.text }
  }
  const copy = sequenceCopy(fields)
  if (!copy || data.contentHash !== copyHash(copy) || data.campaignCode !== undefined && (typeof data.campaignCode !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,159}$/.test(data.campaignCode))) return null
  return { ...copy, contentHash: copyHash(copy), ebookId: data.ebookId, ...(typeof data.campaignCode === 'string' ? { campaignCode: data.campaignCode } : {}) }
}
