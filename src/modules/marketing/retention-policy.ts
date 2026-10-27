const DAY = 86400000
// Start early enough for a daily cycle and its execution margin before the 30-day target.
export const MARKETING_RETENTION_ELIGIBILITY_MS = 28 * DAY
export const MARKETING_RETENTION_DEADLINE_MS = 30 * DAY
export const RETENTION_SUCCESS_MAX_AGE_MS = 25 * 3600000
export const WORKER_HEARTBEAT_MAX_AGE_MS = 90000

export function marketingRetentionCutoff(now: number) {
  if (!Number.isFinite(now)) throw new Error('Data de retenção inválida.')
  return new Date(now - MARKETING_RETENTION_ELIGIBILITY_MS).toISOString()
}

/** A live process alone is insufficient when its enabled retention task is stale or needs review. */
export function workerHealth(heartbeat: string, retention: string | undefined, retentionEnabled: boolean, now = Date.now()) {
  const fresh = (timestamp: unknown, maximumAge: number) => typeof timestamp === 'number' && Number.isSafeInteger(timestamp) && now >= timestamp && now - timestamp <= maximumAge
  if (!Number.isSafeInteger(now) || !heartbeat.trim() || !fresh(Number(heartbeat), WORKER_HEARTBEAT_MAX_AGE_MS)) return false
  if (!retentionEnabled) return true
  try {
    const record: unknown = JSON.parse(retention ?? '')
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false
    const value = record as Record<string, unknown>
    return Object.keys(value).length === 3 && value.version === 1 && fresh(value.completedAt, RETENTION_SUCCESS_MAX_AGE_MS) && value.overdueSubscriptions === 0
  } catch { return false }
}
