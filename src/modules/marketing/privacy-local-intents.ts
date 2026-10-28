type Intent = { state?: string | null; attempts?: number | null; providerId?: number | null; startedAt?: string | null; syncedAt?: string | null; outcome?: string | null }

/** Zero attempts alone is insufficient if legacy provider evidence remains. */
export const isLocalRegistrationIntent = (row: Intent) => row.attempts === 0 && ['pending', 'canceled'].includes(row.state ?? '') && !row.providerId && !row.startedAt && !row.syncedAt
export const isLocalSuppressionIntent = (row: Intent) => row.attempts === 0 && row.state === 'pending' && !row.startedAt && !row.syncedAt && !row.outcome
