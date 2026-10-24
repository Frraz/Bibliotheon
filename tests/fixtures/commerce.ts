import assert from 'node:assert/strict'
import {getPayload} from 'payload'
import config from '../../src/payload.config'
import {seedSite} from './site'

export const commercialLedgerCollections=['commercial-audit','commercial-conflicts','transaction-events','commercial-inbox','transactions'] as const
export const commercialCollections=['commercial-import-audit','commercial-import-rows','commercial-import-batches',...commercialLedgerCollections] as const
export async function seedCommerce(){
 const database=new URL(process.env.DATABASE_URL||'')
 assert.ok(['localhost','127.0.0.1'].includes(database.hostname),'Fixtures somente em banco loopback.')
 const payload=await getPayload({config})
 for(const collection of ['admin-users',...commercialCollections] as const)assert.equal((await payload.count({collection,overrideAccess:true})).totalDocs,0,`Fixture exige ${collection} vazio.`)
 const seed=await seedSite()
 return{...seed,async cleanup(){
  for(const collection of commercialCollections)await payload.delete({collection,where:{id:{exists:true}},overrideAccess:true})
  await seed.cleanup()
 }}
}
