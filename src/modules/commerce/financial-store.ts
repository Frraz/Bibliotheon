import type {Payload,PayloadRequest} from 'payload'
import {sql,type PostgresAdapter} from '@payloadcms/db-postgres'
import {commercialTransactionKey,type AccountScope} from './events'
export type FinancialCoverage={id:string;key:string;fingerprint:string;hashes:string[];envelopeHash:string|null;reason:'source_confirmed'|'source_rejected'}
export type FinancialHead={id:string;provider:AccountScope['provider'];accountKey:string;revision:number;action:'reconcile'|'hold';transactionKeys:string[];choice:unknown;coverage:FinancialCoverage[]}
export async function financialHeads(payload:Payload,keys:readonly string[],req?:PayloadRequest):Promise<Map<string,FinancialHead>>{
 const adapter=payload.db as unknown as PostgresAdapter,id=req&&await req.transactionID,db=id?adapter.sessions[id]?.db:adapter.drizzle
 if(!db)throw new Error('financial_transaction_unavailable')
 const unique=[...new Set(keys)],ids=new Map<string,string>()
 for(let offset=0;offset<unique.length;offset+=200){
  const result=await db.execute(sql`SELECT wanted.key,head.id FROM (VALUES ${sql.join(unique.slice(offset,offset+200).map(key=>sql`(${key}::text)`),sql`,`)}) AS wanted(key)
   CROSS JOIN LATERAL (SELECT id FROM public.financial_resolutions WHERE transaction_keys ? wanted.key ORDER BY revision DESC LIMIT 1) AS head`)
  for(const row of result.rows)ids.set(String(row.key),String(row.id))
 }
 const heads=new Map<string,FinancialHead>(),allIds=[...new Set(ids.values())]
 for(let offset=0;offset<allIds.length;offset+=200){
  const result=await payload.find({collection:'financial-resolutions',where:{id:{in:allIds.slice(offset,offset+200)}},limit:201,depth:0,overrideAccess:true,req,select:{provider:true,accountKey:true,revision:true,action:true,transactionKeys:true,choice:true,coverage:true}})
  for(const row of result.docs)heads.set(row.id,{...row,transactionKeys:row.transactionKeys as string[],coverage:row.coverage as FinancialCoverage[]})
 }
 return new Map([...ids].map(([key,id])=>{const head=heads.get(id);if(!head)throw new Error('financial_head_integrity');return[key,head]}))
}
/** Reception preserves last known values, but marks the whole prior component pending. */
export async function markFinancialEvidencePending(req:PayloadRequest,keys:readonly string[],reason:string,includeOriginal=false){
 const heads=await financialHeads(req.payload,keys,req),affected=new Set(includeOriginal?keys:[])
 for(const head of heads.values())for(const key of head.transactionKeys)affected.add(key)
 if(!affected.size)return
 const rows=await req.payload.find({collection:'transactions',where:{key:{in:[...affected]}},limit:10001,depth:0,overrideAccess:true,req,select:{key:true}})
 if(rows.totalDocs>10000)throw new Error('financial_component_limit')
 for(const row of rows.docs)await req.payload.update({collection:'transactions',id:row.id,data:{needsReview:true,reviewReason:reason},overrideAccess:true,req})
}
export async function receiptAlreadyAdjudicated(req:PayloadRequest,keys:readonly string[],inboxId:string){
 const heads=await financialHeads(req.payload,keys,req)
 return [...heads.values()].some(head=>head.action==='reconcile'&&head.coverage.some(item=>item.id===inboxId))
}
export const financialScopeKey=(scope:AccountScope&{externalTransactionId:string})=>commercialTransactionKey(scope)
