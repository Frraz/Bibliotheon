import {randomUUID} from 'node:crypto'
import {sql,type PostgresAdapter} from '@payloadcms/db-postgres'
import type {PayloadRequest} from 'payload'
import type {CommercialImportRow} from '../../payload-types'
import type {PreparedCommercialReceipt} from './events'
import type {ParsedImport,buildImportPlan} from './import-plan'
import {hashImport} from './import-plan'
async function session(req:PayloadRequest){
 const id=await req.transactionID,db=id&&(req.payload.db as unknown as Pick<PostgresAdapter,'sessions'>).sessions[id]?.db
 if(!db)throw new Error('import_transaction_unavailable')
 return db
}
/** Bulk persistence is internal: only validated normalized rows, inside the owner's transaction. */
export async function storeImportRows(req:PayloadRequest,batch:string,parsed:ParsedImport,plan:Awaited<ReturnType<typeof buildImportPlan>>){
 const db=await session(req)
 for(let offset=0;offset<parsed.lines.length;offset+=200){
  const values=parsed.lines.slice(offset,offset+200).map(source=>{
   const line=plan.lines[source.line-2],state=line.classification==='new'?'planned':line.classification==='matched'?'matched':line.classification==='duplicate'?'duplicate':'blocked'
   return sql`(${randomUUID()}::uuid,${hashImport([batch,source.line])},${batch}::uuid,${source.line},${source.digest},${source.key},${JSON.stringify(source.row)}::jsonb,${line.classification}::enum_commercial_import_rows_classification,${line.reason},${line.duplicateOf??null},${state}::enum_commercial_import_rows_state,${line.existingTransactionId??null}::uuid)`
  })
  await db.execute(sql`INSERT INTO commercial_import_rows (id,key,batch_id,line,row_hash,transaction_key,normalized,classification,reason,duplicate_of,state,transaction_id) VALUES ${sql.join(values,sql`,`)}`)
 }
}
/** Account barrier prevents concurrent receipt/mapping changes; queue and import audit commit together. */
export async function queueImportRows(req:PayloadRequest,rows:CommercialImportRow[],prepared:Map<number,PreparedCommercialReceipt>,now:number){
 const db=await session(req),timestamp=new Date(now).toISOString()
 for(let offset=0;offset<rows.length;offset+=200){
  const items=rows.slice(offset,offset+200).flatMap(row=>{const receipt=prepared.get(row.line);return receipt?.state==='prepared'?[{row,receipt,id:randomUUID()}]:[]})
  if(!items.length)continue
  const values=items.map(({receipt,id})=>sql`(${id}::uuid,${receipt.key},${receipt.event.provider}::enum_commercial_inbox_provider,${receipt.event.accountKey},${receipt.event.eventKey},${receipt.adapterVersion},${receipt.digest},${JSON.stringify(receipt.event)}::jsonb,${receipt.transactionKey},'event','pending',${timestamp}::timestamptz,${timestamp}::timestamptz,0,0,false)`)
  await db.execute(sql`INSERT INTO commercial_inbox (id,key,provider,account_key,event_key,adapter_version,envelope_hash,envelope,transaction_key,kind,state,received_at,next_attempt_at,attempts,attempt_base,conflicted) VALUES ${sql.join(values,sql`,`)}`)
  const audits=items.map(({id})=>sql`(${randomUUID()}::uuid,${id}::uuid,'receiver','received',${timestamp}::timestamptz,'csv_owner_snapshot')`)
  await db.execute(sql`INSERT INTO commercial_audit (id,inbox_id,actor_type,action,occurred_at,reason) VALUES ${sql.join(audits,sql`,`)}`)
  const links=items.map(({row,id})=>sql`(${row.id}::uuid,${id}::uuid)`)
  await db.execute(sql`UPDATE commercial_import_rows AS target SET state='queued',inbox_id=source.inbox,updated_at=${timestamp}::timestamptz FROM (VALUES ${sql.join(links,sql`,`)}) AS source(id,inbox) WHERE target.id=source.id`)
 }
}
