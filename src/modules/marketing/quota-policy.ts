export type QuotaPolicy = { limit: number; transactionalReserve: number }
export type MailKind = 'transactional' | 'promotional'

export function validateQuotaPolicy(policy: QuotaPolicy): QuotaPolicy {
  if (!Number.isInteger(policy.limit) || policy.limit < 1 || policy.limit > 250) throw new Error('Quota diária inválida; configure um inteiro entre 1 e 250.')
  if (!Number.isInteger(policy.transactionalReserve) || policy.transactionalReserve < 1 || policy.transactionalReserve > policy.limit) throw new Error('Reserva transacional inválida; configure um inteiro entre 1 e a quota diária.')
  return policy
}

export function configuredQuotaPolicy(): QuotaPolicy {
  const limit = Number(process.env.BREVO_DAILY_QUOTA ?? '250')
  return validateQuotaPolicy({ limit, transactionalReserve: Number(process.env.BREVO_TRANSACTIONAL_RESERVE ?? Math.min(50, limit)) })
}

/** Local UTC budget, subject to provider/account verification before activation. */
export function quotaWindow(now: number) {
  if (!Number.isFinite(now)) throw new Error('Data de quota inválida.')
  const day = new Date(now).toISOString().slice(0, 10)
  return { day, nextDayAt: new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString() }
}

export function canReserve(policy: QuotaPolicy, used: number, count: number, kind: MailKind) {
  validateQuotaPolicy(policy)
  if (!Number.isSafeInteger(used) || used < 0 || !Number.isSafeInteger(count) || count < 1) throw new Error('Contagem de quota inválida.')
  if (kind !== 'transactional' && kind !== 'promotional') throw new Error('Finalidade de quota inválida.')
  // Conservative: promotional claims leave the full reserve free, even after transactional use.
  const ceiling = policy.limit - (kind === 'promotional' ? policy.transactionalReserve : 0)
  return used <= ceiling && count <= ceiling - used
}
