import type {Payload,PayloadRequest} from 'payload'
import {sql,type PostgresAdapter} from '@payloadcms/db-postgres'
import {commercialTransactionKey,type AccountScope} from './events'
export type CommercialTransactionScope=AccountScope&{externalTransactionId:string}
/** Both the original receipt and every persisted collision variant quarantine their transaction.
 * JSON paths refer to the internal normalized envelope, never a guessed native provider field. */
export async function commercialCollisionKeys(payload:Payload,scopes:readonly CommercialTransactionScope[],req?:PayloadRequest){
 const adapter=payload.db as unknown as PostgresAdapter,transactionID=req&&await req.transactionID
 const db=transactionID?adapter.sessions[transactionID]?.db:adapter.drizzle
 if(!db)throw new Error('commercial_transaction_unavailable')
 const unique=[...new Map(scopes.map(scope=>[commercialTransactionKey(scope),scope])).entries()],keys=new Set<string>()
 for(let offset=0;offset<unique.length;offset+=200){
  const rows=unique.slice(offset,offset+200).map(([key,scope])=>sql`(${key}::text,${scope.provider}::text,${scope.accountKey}::text,${scope.externalTransactionId}::text)`)
  const result=await db.execute(sql`SELECT wanted.key FROM (VALUES ${sql.join(rows,sql`,`)}) AS wanted(key,provider,account_key,external_transaction_id)
   WHERE EXISTS (SELECT 1 FROM public.commercial_inbox i WHERE i.transaction_key=wanted.key AND (i.conflicted OR EXISTS(SELECT 1 FROM public.commercial_conflicts c WHERE c.inbox_id=i.id)))
    OR EXISTS (SELECT 1 FROM public.commercial_conflicts c WHERE c.envelope->>'provider'=wanted.provider AND c.envelope->>'accountKey'=wanted.account_key AND c.envelope->>'externalTransactionId'=wanted.external_transaction_id)`)
  for(const row of result.rows)keys.add(String(row.key))
 }
 return keys
}
