import type {Payload,PayloadRequest} from 'payload'
import {sql,type PostgresAdapter} from '@payloadcms/db-postgres'
/** All evidence requires an explicit decision, including evidence for an ID with no projection yet. */
export async function reportEvidenceKeys(payload:Payload,keys:readonly string[],req?:PayloadRequest){
 const adapter=payload.db as unknown as PostgresAdapter,id=req&&await req.transactionID,db=id?adapter.sessions[id]?.db:adapter.drizzle
 if(!db)throw new Error('report_transaction_unavailable')
 const unique=[...new Set(keys)],result=new Set<string>()
 for(let offset=0;offset<unique.length;offset+=200){
  const rows=await db.execute(sql`SELECT wanted.key FROM (VALUES ${sql.join(unique.slice(offset,offset+200).map(key=>sql`(${key}::text)`),sql`,`)}) AS wanted(key) WHERE EXISTS(SELECT 1 FROM public.commercial_report_evidence WHERE transaction_keys ? wanted.key)`)
  for(const row of rows.rows)result.add(String(row.key))
 }
 return result
}
