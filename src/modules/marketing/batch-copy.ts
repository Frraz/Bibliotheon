import { createHash } from 'node:crypto'
import { readSequenceSnapshot, type SequenceSnapshot, type SequenceDay } from './sequence-copy'

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export type BatchCopy = { theme: string; stage: SequenceDay; day: string; snapshot: SequenceSnapshot }
export type BatchMember = { delivery: string; contact: string }
export const batchGroupKey = (copy: BatchCopy) => hash(copy)
export const batchKey = (groupKey: string, members: BatchMember[], id: string) => hash([groupKey, members.map(member => [member.delivery, member.contact]), id])
export function batchCopy(theme: string, stage: string, dueAt: string, snapshot: SequenceSnapshot): BatchCopy {
  if (!['2', '4', '7', '10'].includes(stage) || !Number.isFinite(Date.parse(dueAt))) throw new Error('Agrupamento promocional inválido.')
  return { theme, stage: Number(stage) as SequenceDay, day: new Date(dueAt).toISOString().slice(0, 10), snapshot }
}
export function readBatchCopy(value: unknown): BatchCopy | null {
  if (!value || typeof value !== 'object') return null
  const data = value as BatchCopy, snapshot = readSequenceSnapshot(data.snapshot)
  if (!snapshot || typeof data.theme !== 'string' || !/^[a-f0-9-]{36}$/i.test(data.theme) || ![2, 4, 7, 10].includes(data.stage) || typeof data.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.day)) return null
  return { theme: data.theme, stage: data.stage, day: data.day, snapshot }
}
export function readBatchMembers(value: unknown): BatchMember[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 200) return null
  const members: BatchMember[] = [], ids = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof item.delivery !== 'string' || typeof item.contact !== 'string' || !/^[a-f0-9-]{36}$/i.test(item.delivery) || !/^[a-f0-9-]{36}$/i.test(item.contact) || ids.has(item.delivery)) return null
    ids.add(item.delivery); members.push({ delivery: item.delivery, contact: item.contact })
  }
  return members
}
