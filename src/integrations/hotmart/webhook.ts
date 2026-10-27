import {createHash,timingSafeEqual} from 'node:crypto'
import {checkoutClickReference,opaqueID,type CommercialAdapter,type NormalizedCommercialEvent,type CommercialKind,type AccountScope,type IgnoredCommercialEvent} from '../../modules/commerce/events'
import {NativeNumber,nativeJSON,nativeEpoch,nativeCents,hundredthCurrency,record} from './numbers'

export type HotmartWebhookConfig={accountKey:string;hottok:string;previousHottok?:string}
export const validHottok=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=512&&!/[\s\x00-\x1f\x7f]/.test(value)&&!value.startsWith('REPLACE_')
export function hotmartWebhookConfig(env:Readonly<Record<string,string|undefined>>=process.env):HotmartWebhookConfig|null {
 const hottok=env.HOTMART_HOTTOK,previous=env.HOTMART_PREVIOUS_HOTTOK
 if(env.HOTMART_WEBHOOK_ENABLED!=='true'||!opaqueID(env.HOTMART_ACCOUNT_KEY)||!validHottok(hottok)||previous&&!validHottok(previous))return null
 const unrelated=[env.PAYLOAD_SECRET,env.LEAD_TOKEN_SECRET,env.BREVO_API_KEY,env.BREVO_WEBHOOK_TOKEN,env.BREVO_WEBHOOK_EVENT_SECRET,env.KIWIFY_WEBHOOK_TOKEN,env.KIWIFY_WEBHOOK_PREVIOUS_TOKEN,env.CAKTO_WEBHOOK_SECRET,env.CAKTO_WEBHOOK_PREVIOUS_SECRET].filter(Boolean)
 if(unrelated.includes(hottok)||previous&&(previous===hottok||unrelated.includes(previous)))return null
 return{accountKey:env.HOTMART_ACCOUNT_KEY,hottok,...(previous?{previousHottok:previous}:{})}
}
export function authenticatedHotmart(headers:Headers,config:HotmartWebhookConfig){
 const received=headers.get('x-hotmart-hottok')
 if(!received||received.length>1024)return false
 const digest=(value:string)=>createHash('sha256').update(value).digest()
 const candidate=digest(received)
 let accepted=0
 for(const secret of [config.hottok,...(config.previousHottok?[config.previousHottok]:[])])accepted|=Number(timingSafeEqual(candidate,digest(secret)))
 return !!accepted
}
const kinds:Record<string,CommercialKind>={PURCHASE_APPROVED:'approved',PURCHASE_COMPLETE:'approved',PURCHASE_BILLET_PRINTED:'pending',PURCHASE_DELAYED:'pending',PURCHASE_CANCELED:'canceled',PURCHASE_EXPIRED:'canceled',PURCHASE_REFUNDED:'refunded',PURCHASE_CHARGEBACK:'chargeback',PURCHASE_PROTEST:'pending'}
function normalize(bytes:Uint8Array,scope:AccountScope):NormalizedCommercialEvent|IgnoredCommercialEvent {
 const root=record(nativeJSON(bytes))
 if(!root||root.version!=='2.0.0'||!opaqueID(root.id)||typeof root.event!=='string'||!/^[A-Z][A-Z0-9_]{0,119}$/.test(root.event))throw new Error('invalid_native_event')
 const createdAt=nativeEpoch(root.creation_date)
 if(!createdAt)throw new Error('invalid_native_time')
 if(!Object.hasOwn(kinds,root.event))return{...scope,eventKey:root.id,kind:'ignored',eventType:root.event,occurredAt:createdAt}
 const data=record(root.data),product=record(data?.product),purchase=record(data?.purchase)
 if(!product||!purchase||!opaqueID(product.ucode)||!opaqueID(purchase.transaction))throw new Error('invalid_native_identity')
 const offer=purchase.offer==null?null:record(purchase.offer)
 const origin=record(purchase.origin)
 if(purchase.offer!=null&&!offer||offer?.code!=null&&!opaqueID(offer.code))throw new Error('invalid_native_offer')
 const full=purchase.full_price==null?null:record(purchase.full_price),price=purchase.price==null?null:record(purchase.price)
 if(purchase.full_price!=null&&!full||purchase.price!=null&&!price)throw new Error('invalid_native_money')
 // A price may establish currency when total is absent; it never substitutes for full_price.value.
 const currency=full?.currency_value??(full?.value==null?price?.currency_value:undefined)
 if(typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency))throw new Error('invalid_native_currency')
 let reviewReason:NormalizedCommercialEvent['reviewReason']=hundredthCurrency(currency)?undefined:'unsupported_currency_precision'
 let grossCents:number|null=null
 if(full?.value!=null){
  if(!(full.value instanceof NativeNumber))throw new Error('invalid_native_money')
  if(!reviewReason){grossCents=nativeCents(full.value);if(grossCents===null)throw new Error('invalid_native_money')}
 }
 const kind=root.event==='PURCHASE_REFUNDED'&&purchase.status==='PARTIALLY_REFUNDED'?'partially_refunded':kinds[root.event]
 let approvedAt:string|null=null
 if(['approved','refunded','partially_refunded','chargeback'].includes(kind)&&purchase.approved_date!=null){approvedAt=nativeEpoch(purchase.approved_date);if(!approvedAt)throw new Error('invalid_native_approval_date')}
 const subscription=record(data?.subscription),content=record(product.content)
 if(product.is_physical_product===true||content?.has_physical_products===true||data?.subscription!=null&&(!subscription||Object.keys(subscription).length>0)||purchase.flexPayPlan!=null||purchase.subscription_anticipation_purchase===true||purchase.recurrence_number instanceof NativeNumber&&Number(purchase.recurrence_number.source)>1)reviewReason='unsupported_purchase_shape'
 if(root.event==='PURCHASE_PROTEST'||root.event==='PURCHASE_COMPLETE'&&!approvedAt||root.event==='PURCHASE_REFUNDED'&&!['REFUNDED','PARTIALLY_REFUNDED'].includes(String(purchase.status)))reviewReason='unsupported_native_status'
 return{...scope,eventKey:root.id,externalTransactionId:purchase.transaction,externalProductId:product.ucode,externalOfferId:(offer?.code??null) as string|null,kind,occurredAt:kind==='approved'&&approvedAt?approvedAt:createdAt,sourceCreatedAt:createdAt,sourceEvent:root.event,approvedAt,currency,grossCents,refundedCents:null,feesCents:null,producerNetCents:null,externalClickReference:checkoutClickReference(origin?.sck),refundBasis:null,externalRefundId:null,chargebackCents:null,...(reviewReason?{reviewReason}:{})}
}
export function createHotmartAdapter(config:HotmartWebhookConfig):CommercialAdapter {
 return{provider:'hotmart',version:'hotmart-purchase-v2:1',verify:async(_body,headers)=>authenticatedHotmart(headers,config),normalize:(bytes,scope)=>{
  if(scope.provider!=='hotmart'||scope.accountKey!==config.accountKey)return null
  try{return normalize(bytes,scope)}catch(error){if(error instanceof Error&&error.message==='number_source_unavailable')throw error;return null}
 }}
}
