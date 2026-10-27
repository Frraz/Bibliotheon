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

/** Shared by offer edits and ledger mapping; exact external identities remain stable during processing. */
export async function lockCommercialProducts(req:PayloadRequest,identities:{provider?:unknown;accountKey?:unknown;externalProductId?:unknown}[]){
 const transactionID=await req.transactionID
 const transaction=transactionID&&(req.payload.db as unknown as Pick<PostgresAdapter,'sessions'>).sessions[transactionID]?.db
 if(!transaction)throw new APIError('Operação comercial exige transação.',503)
 const keys=identities.filter(item=>[item.provider,item.accountKey,item.externalProductId].every(value=>typeof value==='string'&&value.length>0)).map(item=>`commercial-product:${JSON.stringify([item.provider,item.accountKey,item.externalProductId])}`)
 for(const key of [...new Set(keys)].sort())await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`)
}

/** Reconciliation and writers serialize only the affected provider account, before other locks. */
export async function lockCommercialAccounts(req:PayloadRequest,identities:{provider?:unknown;accountKey?:unknown}[]){
 const transactionID=await req.transactionID
 const transaction=transactionID&&(req.payload.db as unknown as Pick<PostgresAdapter,'sessions'>).sessions[transactionID]?.db
 if(!transaction)throw new APIError('Operação comercial exige transação.',503)
 const keys=identities.filter(item=>[item.provider,item.accountKey].every(value=>typeof value==='string'&&value.length>0)).map(item=>`commercial-account:${JSON.stringify([item.provider,item.accountKey])}`)
 for(const key of [...new Set(keys)].sort())await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`)
}

/** Called only after account/product locks; SQL keeps NULL and empty optional IDs equivalent. */
export async function assertNewCatalogIdentity(req: PayloadRequest, identity: {provider: string; accountKey: string; externalProductId: string; externalOfferId?: string | null; ebook: string}, excludeId?: string) {
 const transactionID = await req.transactionID
 const transaction = transactionID && (req.payload.db as unknown as Pick<PostgresAdapter,'sessions'>).sessions[transactionID]?.db
 if (!transaction) throw new APIError('Operação comercial exige transação.',503)
 const conflicts = await transaction.execute(sql`SELECT id FROM offers
  WHERE provider = ${identity.provider} AND account_key = ${identity.accountKey}
  AND external_product_id = ${identity.externalProductId}
  AND (${excludeId ?? null}::uuid IS NULL OR id <> ${excludeId ?? null}::uuid)
  AND (ebook_id IS DISTINCT FROM ${identity.ebook}::uuid OR COALESCE(external_offer_id, '') = ${identity.externalOfferId || ''}) LIMIT 1`)
 if (conflicts.rows.length) throw new APIError('Identidade externa já cadastrada ou produto associado a outro livro. Confira provedor, conta, produto e oferta; desativar não remove o histórico.',422)
}
