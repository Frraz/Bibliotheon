import {createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {checkoutClickReference,opaqueID,type CommercialAdapter,type NormalizedCommercialEvent,type CommercialKind,type AccountScope,type IgnoredCommercialEvent} from '../../modules/commerce/events'
import {nativeJSON,nativeInteger,record} from '../../modules/commerce/native-json'
import {kiwifyDate} from './dates'

export type KiwifyWebhookConfig={accountKey:string;token:string;previousToken?:string}
// Minimum length is Bibliotheon's policy, not a restriction claimed by the provider.
const validToken=(value:unknown):value is string=>typeof value==='string'&&value.length>=32&&value.length<=512&&!/[\s\x00-\x1f\x7f]/.test(value)&&!value.startsWith('REPLACE_')
export function kiwifyWebhookConfig(env:Readonly<Record<string,string|undefined>>=process.env):KiwifyWebhookConfig|null {
 const token=env.KIWIFY_WEBHOOK_TOKEN,previous=env.KIWIFY_WEBHOOK_PREVIOUS_TOKEN
 if(env.KIWIFY_WEBHOOK_ENABLED!=='true'||!opaqueID(env.KIWIFY_ACCOUNT_KEY)||!validToken(token)||previous&&!validToken(previous))return null
 const unrelated=[env.PAYLOAD_SECRET,env.LEAD_TOKEN_SECRET,env.BREVO_API_KEY,env.BREVO_WEBHOOK_TOKEN,env.BREVO_WEBHOOK_EVENT_SECRET,env.HOTMART_HOTTOK,env.HOTMART_PREVIOUS_HOTTOK,env.CAKTO_WEBHOOK_SECRET,env.CAKTO_WEBHOOK_PREVIOUS_SECRET].filter(Boolean)
 if(unrelated.includes(token)||previous&&(previous===token||unrelated.includes(previous)))return null
 return{accountKey:env.KIWIFY_ACCOUNT_KEY,token,...(previous?{previousToken:previous}:{})}
}
export function kiwifySignature(url:string):string|null {
 const values=new URL(url).searchParams.getAll('signature')
 return values.length===1&&/^[0-9a-f]{40}$/.test(values[0])?values[0]:null
}
export function authenticatedKiwify(body:Uint8Array,signature:string|null,config:KiwifyWebhookConfig){
 if(!signature||!/^[0-9a-f]{40}$/.test(signature))return false
 const received=Buffer.from(signature,'hex');let accepted=0
 for(const token of [config.token,...(config.previousToken?[config.previousToken]:[])])accepted|=Number(timingSafeEqual(received,createHmac('sha1',token).update(body).digest()))
 return !!accepted
}
const kinds:Record<string,{kind:CommercialKind;status:string}>={
 order_approved:{kind:'approved',status:'paid'},order_rejected:{kind:'refused',status:'refused'},
 order_refunded:{kind:'refunded',status:'refunded'},chargeback:{kind:'chargeback',status:'chargedback'},
 billet_created:{kind:'pending',status:'waiting_payment'},pix_created:{kind:'pending',status:'waiting_payment'},
}
const eventKey=(id:string,type:string)=>createHash('sha256').update(JSON.stringify([id,type])).digest('hex')
function normalize(bytes:Uint8Array,scope:AccountScope):NormalizedCommercialEvent|IgnoredCommercialEvent {
 const root=record(nativeJSON(bytes))
 if(!root)throw new Error('invalid_native_event')
 if(root.status==='abandoned'&&opaqueID(root.id)&&root.webhook_event_type==null)return{...scope,eventKey:eventKey(root.id,'cart_abandoned'),kind:'ignored',eventType:'cart_abandoned',occurredAt:null}
 if(!opaqueID(root.order_id)||typeof root.webhook_event_type!=='string'||!/^[a-z][a-z0-9_]{0,119}$/.test(root.webhook_event_type))throw new Error('invalid_native_identity')
 const key=eventKey(root.order_id,root.webhook_event_type)
 if(!Object.hasOwn(kinds,root.webhook_event_type))return{...scope,eventKey:key,kind:'ignored',eventType:root.webhook_event_type,occurredAt:null}
 const product=record(root.Product),money=record(root.Commissions),createdAt=kiwifyDate(root.created_at)
 const tracking=record(root.TrackingParameters)
 if(!product||!opaqueID(product.product_id)||product.product_offer_id!=null&&!opaqueID(product.product_offer_id)||!money||typeof money.currency!=='string'||!/^[A-Z]{3}$/.test(money.currency)||!createdAt)throw new Error('invalid_native_event')
 const gross=money.charge_amount==null?null:nativeInteger(money.charge_amount)
 if(money.charge_amount!=null&&gross===null)throw new Error('invalid_native_money')
 let fees:number|null=null
 if(money.kiwify_fee!=null&&money.kiwify_fee_currency===money.currency){fees=nativeInteger(money.kiwify_fee,true);if(fees===null)throw new Error('invalid_native_money')}
 const mapping=kinds[root.webhook_event_type],approvedAt=kiwifyDate(root.approved_date)
 // updated_at is an order snapshot modification, not proof of a reversal/decline instant.
 const eventTime=mapping.kind==='approved'?approvedAt:mapping.kind==='refunded'?kiwifyDate(root.refunded_at):mapping.kind==='pending'?createdAt:null
 let reviewReason:NormalizedCommercialEvent['reviewReason']=eventTime&&eventTime>=createdAt&&!(mapping.kind==='refunded'&&approvedAt&&eventTime<approvedAt)?undefined:'unknown_event_time'
 if(root.order_status!==mapping.status)reviewReason='unsupported_native_status'
 if(root.sale_type!=='producer'||root.subscription_id!=null||root.Subscription!=null||root.charges!=null||root.event_tickets!=null||root.event_batch!=null||root.SmartInstallment!=null||root.ScheduledInstallment!=null||root.ShippingOption!=null||!['digital','payment','membership','club'].includes(String(root.product_type)))reviewReason='unsupported_purchase_shape'
 return{...scope,eventKey:key,externalTransactionId:root.order_id,externalProductId:product.product_id,externalOfferId:(product.product_offer_id??null) as string|null,kind:mapping.kind,occurredAt:eventTime??createdAt,sourceCreatedAt:createdAt,sourceEvent:root.webhook_event_type,approvedAt,currency:money.currency,grossCents:gross,feesCents:fees,producerNetCents:null,refundedCents:null,chargebackCents:null,refundBasis:null,externalRefundId:null,externalClickReference:checkoutClickReference(tracking?.sck),...(reviewReason?{reviewReason}:{})}
}
export function createKiwifyAdapter(config:KiwifyWebhookConfig,signature:string|null):CommercialAdapter {
 return{provider:'kiwify',version:'kiwify-orders:1',verify:async(body)=>authenticatedKiwify(body,signature,config),normalize:(body,scope)=>{
  if(scope.provider!=='kiwify'||scope.accountKey!==config.accountKey)return null
  try{return normalize(body,scope)}catch(error){if(error instanceof Error&&error.message==='number_source_unavailable')throw error;return null}
 }}
}
