import type { PayloadRequest } from 'payload'
import { serial } from './transaction'
import { canReserve, configuredQuotaPolicy, quotaWindow, type MailKind, type QuotaPolicy } from './quota-policy'

/** Reserve inside the same transaction as the durable send claim. Never refund an uncertain attempt. */
export async function reserveMailQuota(req: PayloadRequest, options: { kind: MailKind; count: number; now: number; policy?: QuotaPolicy }) {
  const policy = options.policy ?? configuredQuotaPolicy(), window = quotaWindow(options.now)
  // Validate input before locking, including when the budget is already exhausted.
  canReserve(policy, 0, options.count, options.kind)
  await serial(req, `quota:${window.day}`)
  const { payload } = req
  const quota = (await payload.find({ collection: 'mail-quota', where: { day: { equals: window.day } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0]
  const used = quota?.reserved ?? 0
  if (!canReserve(policy, used, options.count, options.kind)) return { ...window, granted: false }
  if (quota) await payload.update({ collection: 'mail-quota', id: quota.id, data: { reserved: used + options.count }, overrideAccess: true, req })
  else await payload.create({ collection: 'mail-quota', data: { day: window.day, reserved: options.count }, overrideAccess: true, req })
  return { ...window, granted: true }
}
