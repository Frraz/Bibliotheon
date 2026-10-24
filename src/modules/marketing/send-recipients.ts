import { createHmac } from 'node:crypto'
import { readBatchMembers } from './batch-copy'
export const sendRecipientFingerprint = (email: string, secret: string) => createHmac('sha256', secret).update(`brevo-send-recipient-v1:${email}`).digest('hex')
export type SendRecipients = { version: 1; recipients: { contact: string; delivery: string; fingerprint: string }[] }
export function readSendRecipients(value: unknown): SendRecipients | null {
  if (!value || typeof value !== 'object') return null
  const row = value as SendRecipients
  if (row.version !== 1 || !Array.isArray(row.recipients) || !readBatchMembers(row.recipients)) return null
  const seen = new Set<string>()
  for (const item of row.recipients) {
    if (seen.has(item.contact) || typeof item.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(item.fingerprint)) return null
    seen.add(item.contact)
  }
  return { version: 1, recipients: row.recipients.map(({ contact, delivery, fingerprint }) => ({ contact, delivery, fingerprint })).sort((a, b) => a.contact.localeCompare(b.contact)) }
}
export function captureSendRecipients(members: unknown, contacts: { contact: string; email: string }[], secret: string): SendRecipients {
  const parsed = readBatchMembers(members)
  if (!parsed || contacts.length !== parsed.length) throw new Error('Destinatários divergentes.')
  const result = readSendRecipients({ version: 1, recipients: parsed.map(member => {
    const person = contacts.find(item => item.contact === member.contact)
    if (!person) throw new Error('Destinatário divergente.')
    return { ...member, fingerprint: sendRecipientFingerprint(person.email, secret) }
  }) })
  if (!result) throw new Error('Destinatários divergentes.')
  return result
}
