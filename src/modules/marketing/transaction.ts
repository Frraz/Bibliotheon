import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'

export async function atomic<T>(payload: Payload, fn: (req: PayloadRequest) => Promise<T>): Promise<T> {
  const transactionID = await payload.db.beginTransaction()
  if (!transactionID) throw new Error('Transação operacional indisponível.')
  const req = await createLocalReq({ req: { user: null, transactionID } }, payload)
  try {
    const result = await fn(req)
    await payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}
export async function serial(req: PayloadRequest, scope: string) {
  const id = await req.transactionID
  const session = id && (req.payload.db as unknown as Pick<PostgresAdapter, 'sessions'>).sessions[id]?.db
  if (!session) throw new Error('Transação operacional indisponível.')
  await session.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`marketing:${scope}`}, 0))`)
}
