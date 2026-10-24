import type {NormalizedCommercialEvent,IgnoredCommercialEvent,CommercialAdapter} from '../../src/modules/commerce/events'
import {commercialEventKey} from '../../src/modules/commerce/events'
import {receiveCommercialWebhook,processCommercialInbox} from '../../src/modules/commerce/inbox'
import type {seedCommerce} from './commerce'

/** Synthetic operational states; never native webhook formats or real account data. */
export async function seedCommercialOperations(seed:Awaited<ReturnType<typeof seedCommerce>>,now=Date.now()){
 const {payload}=seed,headers=new Headers({'x-fixture-signature':'synthetic'})
 const event=(key:string,more:Partial<NormalizedCommercialEvent>={}):NormalizedCommercialEvent=>({provider:'hotmart',accountKey:'synthetic',eventKey:`ops-${key}`,externalTransactionId:`ops-tx-${key}`,externalProductId:'synthetic-product',externalOfferId:null,kind:'approved',occurredAt:new Date(now-3600000).toISOString(),currency:'BRL',grossCents:9900,refundedCents:null,feesCents:null,producerNetCents:null,externalClickReference:null,refundBasis:null,externalRefundId:null,chargebackCents:null,...more})
 const receive=async(e:NormalizedCommercialEvent|IgnoredCommercialEvent,time=now)=>{
  const adapter:CommercialAdapter={provider:e.provider,version:'synthetic-operations-v1',verify:async(_b,h)=>h.get('x-fixture-signature')==='synthetic',normalize:b=>JSON.parse(Buffer.from(b).toString())}
  await receiveCommercialWebhook(payload,adapter,{provider:e.provider,accountKey:e.accountKey},Buffer.from(JSON.stringify(e)),headers,{now:time})
  return (await payload.find({collection:'commercial-inbox',where:{key:{equals:commercialEventKey(e)}},depth:0,overrideAccess:true})).docs[0]
 }
 const appliedEvent=event('applied'),applied=await receive(appliedEvent,now-10000)
 await processCommercialInbox(payload,applied.id,{now:now-5000});await receive({...appliedEvent,grossCents:9800})
 const failed=await receive(event('failed',{eventKey:`ops-long-${'x'.repeat(170)}`}),now-2*86400000)
 await payload.update({collection:'commercial-inbox',id:failed.id,overrideAccess:true,data:{state:'failed',attempts:2,errorCode:'processing_unavailable',nextAttemptAt:new Date(now+300000).toISOString()}})
 const review=await receive(event('review',{externalProductId:'unmapped-synthetic'}));await processCommercialInbox(payload,review.id,{now})
 const active=await receive(event('active')),expired=await receive(event('expired'))
 for(const [row,start] of [[active,now],[expired,now-360000]] as const)await payload.update({collection:'commercial-inbox',id:row.id,overrideAccess:true,data:{state:'processing',attempts:1,startedAt:new Date(start).toISOString(),leaseToken:`synthetic-${row.id}`}})
 const ignored=await receive({provider:'cakto',accountKey:'synthetic',eventKey:'ops-ignored',kind:'ignored',eventType:'fixture.unhandled',occurredAt:null})
 const pending=await receive(event('kiwify',{provider:'kiwify'}))
 for(let i=0;i<21;i++)await receive(event(`pending-${i}`),now-20000-i*1000)
 return{applied,failed,review,active,expired,ignored,pending,now}
}
