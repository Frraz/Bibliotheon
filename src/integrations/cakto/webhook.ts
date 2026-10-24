import {createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {opaqueID,type AccountScope,type CommercialAdapter,type CommercialKind,type IgnoredCommercialEvent,type NormalizedCommercialEvent} from '../../modules/commerce/events'
import {nativeJSON,record} from '../../modules/commerce/native-json'
import {nativeCents,hundredthCurrency} from '../../modules/commerce/money'
import {caktoDate} from './dates'
export type CaktoWebhookConfig={accountKey:string;secret:string;previousSecret?:string}
const validSecret=(value:unknown):value is string=>typeof value==='string'&&value.length>=32&&value.length<=512&&!/[\s\x00-\x1f\x7f]/.test(value)&&!value.startsWith('REPLACE_')
export function caktoWebhookConfig(env:Readonly<Record<string,string|undefined>>=process.env):CaktoWebhookConfig|null {
 const secret=env.CAKTO_WEBHOOK_SECRET,previous=env.CAKTO_WEBHOOK_PREVIOUS_SECRET
 if(env.CAKTO_WEBHOOK_ENABLED!=='true'||!opaqueID(env.CAKTO_ACCOUNT_KEY)||!validSecret(secret)||previous&&!validSecret(previous))return null
 const unrelated=[env.PAYLOAD_SECRET,env.LEAD_TOKEN_SECRET,env.BREVO_API_KEY,env.BREVO_WEBHOOK_TOKEN,env.BREVO_WEBHOOK_EVENT_SECRET,env.HOTMART_HOTTOK,env.HOTMART_PREVIOUS_HOTTOK,env.KIWIFY_WEBHOOK_TOKEN,env.KIWIFY_WEBHOOK_PREVIOUS_TOKEN].filter(Boolean)
 if(unrelated.includes(secret)||previous&&(previous===secret||unrelated.includes(previous)))return null
 return{accountKey:env.CAKTO_ACCOUNT_KEY,secret,...(previous?{previousSecret:previous}:{})}
}
export function caktoSignature(headers:Headers,now=Date.now()):{timestamp:string;digest:string}|null {
 const timestamp=headers.get('x-cakto-timestamp'),header=headers.get('x-cakto-signature')
 if(!timestamp||!/^(?:0|[1-9]\d{0,11})$/.test(timestamp)||!Number.isFinite(now)||Math.abs(now/1000-Number(timestamp))>300||!header||header.length>2048)return null
 const versions=header.split(',').map(value=>value.trim())
 if(versions.length>8||versions.some(value=>!/^v[1-9]\d*=\S+$/.test(value)))return null
 const known=versions.filter(value=>value.startsWith('v1='))
 if(known.length!==1||!/^v1=[a-f0-9]{64}$/.test(known[0]))return null
 return{timestamp,digest:known[0].slice(3)}
}
export function authenticatedCakto(body:Uint8Array,headers:Headers,config:CaktoWebhookConfig,now=Date.now()){
 const signature=caktoSignature(headers,now)
 if(!signature)return false
 const received=Buffer.from(signature.digest,'hex');let accepted=0
 for(const secret of [config.secret,...(config.previousSecret?[config.previousSecret]:[])])accepted|=Number(timingSafeEqual(received,createHmac('sha256',secret).update(signature.timestamp+'.').update(body).digest()))
 return !!accepted
}
const kinds:Record<string,{kind:CommercialKind;status:string;date?:string}>={
 purchase_approved:{kind:'approved',status:'paid',date:'paidAt'},purchase_refused:{kind:'refused',status:'refused'},
 refund:{kind:'refunded',status:'refunded',date:'refundedAt'},chargeback:{kind:'chargeback',status:'chargedback',date:'chargedbackAt'},
 pix_gerado:{kind:'pending',status:'waiting_payment',date:'createdAt'},boleto_gerado:{kind:'pending',status:'waiting_payment',date:'createdAt'},
 picpay_gerado:{kind:'pending',status:'waiting_payment',date:'createdAt'},openfinance_nubank_gerado:{kind:'pending',status:'waiting_payment',date:'createdAt'},
}
const key=(parts:unknown[])=>createHash('sha256').update(JSON.stringify(parts)).digest('hex')
function normalizeOrder(data:unknown,type:string,scope:AccountScope):NormalizedCommercialEvent|IgnoredCommercialEvent {
 const row=record(data)
 if(!row)throw new Error('invalid_native_event')
 if(type==='checkout_abandonment'){
  const offer=record(row.offer),product=record(row.product),createdAt=caktoDate(row.createdAt)
  if(!offer||!opaqueID(offer.id)||!product||!opaqueID(product.id)||!createdAt)throw new Error('invalid_native_cart')
  // Ignored notifications are grouped without buyer identifiers. This is NOT abandonment analytics.
  return{...scope,eventKey:key(['abandonment',product.id,offer.id,row.createdAt]),kind:'ignored',eventType:type,occurredAt:createdAt}
 }
 if(!opaqueID(row.id))throw new Error('invalid_native_identity')
 const eventKey=key([row.id,type])
 if(!Object.hasOwn(kinds,type))return{...scope,eventKey,kind:'ignored',eventType:type,occurredAt:null}
 const mapping=kinds[type],product=record(row.product),offer=row.offer==null?null:record(row.offer),createdAt=caktoDate(row.createdAt)
 if(!product||!opaqueID(product.id)||!createdAt||row.offer!=null&&!offer||offer&&!opaqueID(offer.id)||typeof row.currency!=='string'||!/^[A-Z]{3}$/.test(row.currency))throw new Error('invalid_native_event')
 const currency=row.currency,supported=hundredthCurrency(currency)
 let grossCents:number|null=null,feesCents:number|null=null
 if(supported){
  if(row.amount!=null){grossCents=nativeCents(row.amount);if(grossCents===null)throw new Error('invalid_native_money')}
  if(row.fees!=null){feesCents=nativeCents(row.fees);if(feesCents===null)throw new Error('invalid_native_money')}
 }
 const approvedAt=caktoDate(row.paidAt),eventTime=mapping.date?caktoDate(row[mapping.date]):null
 let reviewReason:NormalizedCommercialEvent['reviewReason']=eventTime&&eventTime>=createdAt&&!(approvedAt&&['refunded','chargeback'].includes(mapping.kind)&&eventTime<approvedAt)?undefined:'unknown_event_time'
 if(!supported)reviewReason='unsupported_currency_precision'
 if(row.status!==mapping.status)reviewReason=type==='chargeback'&&row.status==='MED'?'dispute_not_final':'unsupported_native_status' // MED/pre-chargeback is never silently a final chargeback.
 if(product.type!=='unique'||row.subscription!=null||row.subscription_period!=null||row.shipping!=null||!['main','orderbump','upsell','downsell'].includes(String(row.offer_type)))reviewReason='unsupported_purchase_shape'
 return{...scope,eventKey,externalTransactionId:row.id,externalProductId:product.id,externalOfferId:(offer?.id??null) as string|null,kind:mapping.kind,occurredAt:eventTime??createdAt,sourceCreatedAt:createdAt,sourceEvent:type,approvedAt,currency,grossCents,feesCents,producerNetCents:null,refundedCents:null,chargebackCents:null,refundBasis:null,externalRefundId:null,externalClickReference:null,...(reviewReason?{reviewReason}:{})}
}
export function createCaktoAdapter(config:CaktoWebhookConfig,clock:()=>number=Date.now):CommercialAdapter {
 return{provider:'cakto',version:'cakto-orders-v1-v2:1',batch:true,verify:async(body,headers)=>authenticatedCakto(body,headers,config,clock()),normalize:(body,scope)=>{
  if(scope.provider!=='cakto'||scope.accountKey!==config.accountKey)return null
  try{
   const root=record(nativeJSON(body))
   if(!root||typeof root.secret!=='string'||!root.secret.length||root.secret.length>512||typeof root.event!=='string'||!/^[a-z][a-z0-9_]{0,119}$/.test(root.event))return null
   if(Array.isArray(root.data)){
    if(!root.data.length||root.data.length>25)return null
    return root.data.map(row=>normalizeOrder(row,root.event as string,scope))
   }
   return normalizeOrder(root.data,root.event,scope)
  }catch(error){if(error instanceof Error&&error.message==='number_source_unavailable')throw error;return null}
 }}
}
