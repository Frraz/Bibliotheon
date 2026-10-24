import assert from 'node:assert/strict'
import {getPayload} from 'payload'
import config from '../../src/payload.config'
import {seedSite} from './site'
export async function seedAnalytics(){
 const payload=await getPayload({config})
 for(const collection of ['analytics-grants','visits','page-views','checkout-clicks','analytics-limits'] as const)assert.equal((await payload.count({collection,overrideAccess:true})).totalDocs,0,'Use banco analítico vazio para fixtures.')
 const seed=await seedSite()
 return{...seed,async cleanup(){
  await payload.update({collection:'analytics-grants',where:{id:{exists:true}},data:{currentVisit:null},overrideAccess:true})
  for(const collection of ['page-views','checkout-clicks','visits','analytics-grants','analytics-limits'] as const)await payload.delete({collection,where:{id:{exists:true}},overrideAccess:true})
  await seed.cleanup()
 }}
}
