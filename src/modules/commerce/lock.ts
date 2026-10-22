import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { APIError, type PayloadRequest } from 'payload'

/** Serialize commercial edits to the same ebook within Payload's active transaction. */
export async function lockEbooks(req: PayloadRequest, ids: string[]) {
  const transactionID = await req.transactionID
  if (!transactionID) throw new APIError('Operação comercial exige transação.', 503)
  const transaction = (req.payload.db as unknown as Pick<PostgresAdapter, 'sessions'>).sessions[transactionID]?.db
  if (!transaction) throw new APIError('Transação indisponível.', 503)
  for (const id of [...new Set(ids)].sort()) await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`)
}
