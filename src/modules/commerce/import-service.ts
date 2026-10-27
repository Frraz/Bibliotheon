import type {Payload} from 'payload'
import {atomic,serial} from '../marketing/transaction'
import {lockCommercialAccounts} from './lock'
import {buildImportPlan,CommercialImportError,hashImport,importManifestHash,importMetadata,prepareImportReceipt,requireImportOwner,restoreImport,validatedImport,type ImportActor} from './import-plan'
import {storeImportRows,queueImportRows} from './import-store'
const idOf=(value:string|{id:string})=>typeof value==='string'?value:value.id
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
export async function stageCommercialImport(payload:Payload,actor:ImportActor,bytes:Uint8Array,metadata:unknown,idempotencyKey:unknown,now=Date.now()){
 const owner=requireImportOwner(actor),source=importMetadata(metadata)
 if(!source||!uuid(idempotencyKey))throw new CommercialImportError(422,'invalid_import_metadata')
 const parsed=validatedImport(bytes),key=hashImport([owner.id,idempotencyKey.toLowerCase()]),requestHash=hashImport([parsed.fileHash,source,owner.id])
 return atomic(payload,async req=>{
  await serial(req,'commercial-import:'+key)
  const existing=(await payload.find({collection:'commercial-import-batches',where:{key:{equals:key}},limit:1,depth:0,overrideAccess:true,req})).docs[0]
  if(existing){if(existing.requestHash!==requestHash)throw new CommercialImportError(409,'idempotency_conflict');return{state:existing.state,id:existing.id,planHash:existing.planHash,duplicate:true}}
  await lockCommercialAccounts(req,[parsed.lines[0].row])
  const plan=await buildImportPlan(payload,parsed,req,now)
  const batch=await payload.create({collection:'commercial-import-batches',data:{key,kind:'snapshot',requestHash,fileHash:parsed.fileHash,manifestHash:importManifestHash(parsed),planHash:plan.planHash,...source,actor:owner.id,state:plan.state,rowCount:parsed.lines.length,counts:plan.counts,stagedAt:new Date(now).toISOString()},overrideAccess:true,req})
  await storeImportRows(req,batch.id,parsed,plan)
  await payload.create({collection:'commercial-import-audit',data:{batch:batch.id,actor:owner.id,action:'staged',occurredAt:new Date(now).toISOString(),reason:source.reason},overrideAccess:true,req})
  return{state:batch.state,id:batch.id,planHash:batch.planHash,duplicate:false}
 })
}
export async function commitCommercialImport(payload:Payload,actor:ImportActor,id:string,input:unknown,now=Date.now()){
 const owner=requireImportOwner(actor)
 if(!uuid(id)||!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==2||!('confirmed'in input)||input.confirmed!==true||!('planHash'in input)||typeof input.planHash!=='string'||!/^[a-f0-9]{64}$/.test(input.planHash))throw new CommercialImportError(422,'invalid_confirmation')
 id=id.toLowerCase()
 return atomic(payload,async req=>{
  await serial(req,'commercial-import-id:'+id)
  const batch=await payload.findByID({collection:'commercial-import-batches',id,depth:0,overrideAccess:true,disableErrors:true,req})
  if(!batch)throw new CommercialImportError(404,'not_found')
  if(input.planHash!==batch.planHash)throw new CommercialImportError(409,'plan_conflict')
  if(batch.state==='queued'||batch.state==='confirmed'){
   await payload.create({collection:'commercial-import-audit',data:{batch:id,actor:owner.id,action:'duplicate_commit',occurredAt:new Date(now).toISOString(),reason:'already_confirmed'},overrideAccess:true,req})
   return{state:batch.state,id,duplicate:true}
  }
  if(batch.state!=='ready')throw new CommercialImportError(409,'batch_not_ready')
  const source=importMetadata({sourceKind:batch.sourceKind,sourceReference:batch.sourceReference,reason:batch.reason})
  if(!source||hashImport([batch.fileHash,source,idOf(batch.actor)])!==batch.requestHash)throw new CommercialImportError(409,'integrity_conflict')
  const stored=await payload.find({collection:'commercial-import-rows',where:{batch:{equals:id}},sort:'line',limit:10001,depth:0,overrideAccess:true,req})
  if(stored.totalDocs!==batch.rowCount||stored.docs.length!==batch.rowCount)throw new CommercialImportError(409,'integrity_conflict')
  const parsed=restoreImport(stored.docs,batch.fileHash,batch.manifestHash)
  await lockCommercialAccounts(req,[parsed.lines[0].row])
  const plan=await buildImportPlan(payload,parsed,req,now)
  if(plan.planHash!==batch.planHash||plan.state!=='ready'){
   await payload.update({collection:'commercial-import-batches',id,data:{state:'stale'},overrideAccess:true,req})
   await payload.create({collection:'commercial-import-audit',data:{batch:id,actor:owner.id,action:'stale',occurredAt:new Date(now).toISOString(),reason:'evidence_changed'},overrideAccess:true,req})
   return{state:'stale' as const,id,duplicate:false}
  }
  const prepared=new Map(parsed.lines.filter(line=>plan.lines[line.line-2].classification==='new').map(line=>[line.line,prepareImportReceipt(line)]))
  await queueImportRows(req,stored.docs,prepared,now)
  const state=prepared.size?'queued' as const:'confirmed' as const
  await payload.update({collection:'commercial-import-batches',id,data:{state,confirmedAt:new Date(now).toISOString(),confirmedBy:owner.id},overrideAccess:true,req})
  await payload.create({collection:'commercial-import-audit',data:{batch:id,actor:owner.id,action:state,occurredAt:new Date(now).toISOString(),reason:source.reason},overrideAccess:true,req})
  return{state,id,duplicate:false}
 })
}
