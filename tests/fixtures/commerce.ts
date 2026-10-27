import {sql, type PostgresAdapter} from '@payloadcms/db-postgres'
import {randomUUID} from 'node:crypto'
import type {Offer} from '../../src/payload-types'
import assert from 'node:assert/strict'
import {getPayload} from 'payload'
import config from '../../src/payload.config'
import {seedSite} from './site'
import {atomic} from '../../src/modules/marketing/transaction'

export const commercialLedgerCollections=['commercial-audit','commercial-conflicts','transaction-events','commercial-inbox','transactions'] as const
export const commercialCollections=['commercial-import-audit','commercial-import-rows','commercial-import-batches',...commercialLedgerCollections] as const
export async function seedCommerce(){
 const database=new URL(process.env.DATABASE_URL||'')
 assert.ok(['localhost','127.0.0.1'].includes(database.hostname),'Fixtures somente em banco loopback.')
 const payload=await getPayload({config})
 for(const collection of ['admin-users','catalog-resolutions','financial-resolutions','financial-resolution-applications','commercial-report-evidence','commercial-settlement-evidence','financial-cost-entries',...commercialCollections] as const)assert.equal((await payload.count({collection,overrideAccess:true})).totalDocs,0,`Fixture exige ${collection} vazio.`)
 const seed=await seedSite()
 return{...seed,async cleanup(){
  for(const collection of commercialCollections){
   const result=await payload.delete({collection,where:{id:{exists:true}},overrideAccess:true})
   assert.equal(result.errors.length,0,`Cleanup falhou: ${collection}`)
  }
  await clearFinancialResolutionFixtures(payload)
  await clearReportEvidenceFixtures(payload)
  await clearFinancialLedgerFixtures(payload)
  await clearCatalogResolutionFixtures(payload)
  await seed.cleanup()
 }}
}

/** Test-only cleanup of immutable financial ledger records in the exclusive synthetic database. */
export async function clearFinancialLedgerFixtures(payload:Awaited<ReturnType<typeof getPayload>>){
 const settlements=(await payload.count({collection:'commercial-settlement-evidence',overrideAccess:true})).totalDocs,costs=(await payload.count({collection:'financial-cost-entries',overrideAccess:true})).totalDocs
 if(!settlements&&!costs)return
 assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true','Limpeza financeira exige fixtures exclusivas.')
 await atomic(payload,async req=>{
  const id=await req.transactionID;assert.ok(id)
  const db=(payload.db as unknown as PostgresAdapter).sessions[id].db
  await db.execute(sql`ALTER TABLE public.commercial_settlement_evidence DISABLE TRIGGER commercial_settlement_evidence_immutable`)
  await db.execute(sql`ALTER TABLE public.financial_cost_entries DISABLE TRIGGER financial_cost_entries_immutable`)
  await db.execute(sql`DELETE FROM public.commercial_settlement_evidence`)
  await db.execute(sql`DELETE FROM public.financial_cost_entries`)
  await db.execute(sql`ALTER TABLE public.commercial_settlement_evidence ENABLE TRIGGER commercial_settlement_evidence_immutable`)
  await db.execute(sql`ALTER TABLE public.financial_cost_entries ENABLE TRIGGER financial_cost_entries_immutable`)
 })
}

/** Test-only SQL corruption reproduces ambiguous records from before the write guard.
 * Never expose a bypass in application hooks or accept it from request context. */
export async function seedLegacyOffer(seed: Awaited<ReturnType<typeof seedCommerce>>, data: Omit<Offer, 'id' | 'createdAt' | 'updatedAt'>) {
 assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true', 'Legado sintético exige ambiente exclusivo confirmado.')
 return atomic(seed.payload, async req => {
  const transactionID = await req.transactionID
  assert.ok(transactionID)
  const db = (seed.payload.db as unknown as PostgresAdapter).sessions[transactionID].db
  // Transactional DDL holds a table lock; failure restores the trigger as well as rows.
  // Requires migration-owner privileges; runtime role must not own tables/disable triggers.
  await db.execute(sql`ALTER TABLE public.offers DISABLE TRIGGER offers_identity_guard`)
  const offer = await seed.payload.create({collection:'offers', ...seed.auth, req, data:{...data, externalProductId:randomUUID()}})
  await db.execute(sql`UPDATE public.offers SET external_product_id=${data.externalProductId} WHERE id=${offer.id}::uuid`)
  await db.execute(sql`ALTER TABLE public.offers ENABLE TRIGGER offers_identity_guard`)
  return {...offer, externalProductId:data.externalProductId}
 })
}

/** Test-only removal of the legacy fixture while its product has synthetic history. */
export async function deleteLegacyOffer(seed: Awaited<ReturnType<typeof seedCommerce>>, id: string) {
 assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS, 'true', 'Remoção de fixture legada exige ambiente exclusivo.')
 await atomic(seed.payload, async req => {
  const transactionID = await req.transactionID
  assert.ok(transactionID)
  const db = (seed.payload.db as unknown as PostgresAdapter).sessions[transactionID].db
  await db.execute(sql`ALTER TABLE public.offers DISABLE TRIGGER offers_identity_guard`)
  await seed.payload.delete({collection:'offers', id, overrideAccess:true, req})
  await db.execute(sql`ALTER TABLE public.offers ENABLE TRIGGER offers_identity_guard`)
 })
}

/** Fixture-only cleanup of immutable decisions, after removing transaction-event references. */
export async function clearCatalogResolutionFixtures(payload: Awaited<ReturnType<typeof getPayload>>) {
 if(!(await payload.count({collection:'catalog-resolutions',overrideAccess:true})).totalDocs)return
 assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true','Limpeza da trilha exige fixtures exclusivas.')
 await atomic(payload,async req=>{
  const id=await req.transactionID;assert.ok(id)
  const db=(payload.db as unknown as PostgresAdapter).sessions[id].db
  await db.execute(sql`ALTER TABLE public.catalog_resolutions DISABLE TRIGGER catalog_resolutions_immutable`)
  await db.execute(sql`DELETE FROM public.catalog_resolutions`)
  await db.execute(sql`ALTER TABLE public.catalog_resolutions ENABLE TRIGGER catalog_resolutions_immutable`)
 })
}

/** Exclusive synthetic database only; proof removal is never exposed by the application. */
export async function clearFinancialResolutionFixtures(payload: Awaited<ReturnType<typeof getPayload>>) {
 if(!(await payload.count({collection:'financial-resolutions',overrideAccess:true})).totalDocs)return
 assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true','Limpeza exige fixtures exclusivas.')
 await atomic(payload,async req=>{
  const id=await req.transactionID;assert.ok(id)
  const db=(payload.db as unknown as PostgresAdapter).sessions[id].db
  await db.execute(sql`ALTER TABLE public.financial_resolution_applications DISABLE TRIGGER financial_applications_immutable`)
  await db.execute(sql`ALTER TABLE public.financial_resolutions DISABLE TRIGGER financial_resolutions_immutable`)
  await db.execute(sql`DELETE FROM public.financial_resolution_applications`)
  await db.execute(sql`DELETE FROM public.financial_resolutions`)
  await db.execute(sql`ALTER TABLE public.financial_resolution_applications ENABLE TRIGGER financial_applications_immutable`)
  await db.execute(sql`ALTER TABLE public.financial_resolutions ENABLE TRIGGER financial_resolutions_immutable`)
 })
}

export async function clearReportEvidenceFixtures(payload: Awaited<ReturnType<typeof getPayload>>) {
 if(!(await payload.count({collection:'commercial-report-evidence',overrideAccess:true})).totalDocs)return
 assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true','Limpeza exige fixtures exclusivas.')
 await atomic(payload,async req=>{
  const id=await req.transactionID;assert.ok(id)
  const db=(payload.db as unknown as PostgresAdapter).sessions[id].db
  await db.execute(sql`ALTER TABLE public.commercial_report_evidence DISABLE TRIGGER commercial_report_evidence_immutable`)
  await db.execute(sql`DELETE FROM public.commercial_report_evidence`)
  await db.execute(sql`ALTER TABLE public.commercial_report_evidence ENABLE TRIGGER commercial_report_evidence_immutable`)
 })
}
