import type { Payload, PayloadRequest } from 'payload'
import { contactFingerprint } from './contact'
import { calendarMonths } from './privacy-recovery-manifest'
import { validLinkSecret } from './tokens'
import { atomic, serial } from './transaction'
import { cancelPromotions } from './sequence-state'

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
export const withdrawalKey = (fingerprint: string, theme: string) => `${fingerprint}:${theme}`

/** Independent withdrawal fact: no contact FK, email, provider action or invented owner request. */
export async function storeThemeWithdrawal(req: PayloadRequest, fingerprint: string, theme: string, withdrawnAt: string) {
  if (!/^[a-f0-9]{64}$/.test(fingerprint) || !uuid.test(theme) || new Date(withdrawnAt).toISOString() !== withdrawnAt) throw new Error('Descadastro temático inválido.')
  const key = withdrawalKey(fingerprint, theme)
  await serial(req, `theme-withdrawal:${key}`)
  const previous = (await req.payload.find({ collection: 'theme-withdrawals', where: { key: { equals: key } }, depth: 0, limit: 1, overrideAccess: true, req })).docs[0]
  if (previous && previous.withdrawnAt >= withdrawnAt) return false
  const data = { key, subjectFingerprint: fingerprint, themeId: theme, withdrawnAt, expiresAt: calendarMonths(withdrawnAt, 24) }
  if (previous) await req.payload.update({ collection: 'theme-withdrawals', id: previous.id, data, overrideAccess: true, req })
  else await req.payload.create({ collection: 'theme-withdrawals', data, overrideAccess: true, req })
  return true
}

export async function hasNewerThemeConsent(req: PayloadRequest, contact: string, theme: string, withdrawnAt: string) {
  return (await req.payload.count({ collection: 'consent-events', where: { and: [{ contact: { equals: contact } }, { theme: { equals: theme } }, { purpose: { equals: 'marketing' } }, { action: { equals: 'subscribed' } }, { occurredAt: { greater_than: withdrawnAt } }] }, overrideAccess: true, req })).totalDocs > 0
}

/** Reapply only the named theme. Samples, global state, other themes and uncertain sends survive. */
export async function replayThemeWithdrawal(payload: Payload, contactId: string, fingerprint: string, theme: string, withdrawnAt: string, secret: string) {
  if (!validLinkSecret(secret)) throw new Error('Chave de privacidade indisponível.')
  return atomic(payload, async req => {
    await serial(req, 'promotion-batches')
    await serial(req, `contact:${contactId}`)
    const contact = await payload.findByID({ collection: 'contacts', id: contactId, overrideAccess: true, depth: 0, req, disableErrors: true })
    if (!contact || contactFingerprint(contact.email, secret) !== fingerprint) return 'absent' as const
    await storeThemeWithdrawal(req, fingerprint, theme, withdrawnAt)
    const marker = (await payload.find({ collection: 'theme-withdrawals', where: { key: { equals: withdrawalKey(fingerprint, theme) } }, depth: 0, limit: 1, overrideAccess: true, req })).docs[0]
    withdrawnAt = marker.withdrawnAt
    if (await hasNewerThemeConsent(req, contactId, theme, withdrawnAt)) return 'newer' as const
    const subscriptions = await payload.update({ collection: 'subscriptions', where: { and: [{ contact: { equals: contactId } }, { theme: { equals: theme } }, { or: [{ state: { not_equals: 'unsubscribed' } }, { unsubscribedAt: { exists: false } }, { unsubscribedAt: { not_equals: withdrawnAt } }] }] }, data: { state: 'unsubscribed', unsubscribedAt: withdrawnAt }, overrideAccess: true, req })
    if (subscriptions.errors.length) throw new Error('Não foi possível reaplicar descadastro temático.')
    await cancelPromotions(req, { and: [{ contact: { equals: contactId } }, { theme: { equals: theme } }] }, Date.parse(withdrawnAt))
    await storeThemeWithdrawal(req, fingerprint, theme, withdrawnAt)
    const external = await payload.count({ collection: 'brevo-registrations', where: { contact: { equals: contactId } }, overrideAccess: true, req })
    const inFlight = await payload.count({ collection: 'promotion-deliveries', where: { and: [{ contact: { equals: contactId } }, { state: { in: ['sending', 'accepted', 'uncertain', 'observed'] } }] }, overrideAccess: true, req })
    return external.totalDocs || inFlight.totalDocs ? 'pending' as const : 'withdrawn' as const
  })
}
