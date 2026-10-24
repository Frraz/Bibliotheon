import {createHmac} from 'node:crypto'
import type {seedCommerce} from './commerce'
export const caktoEnv={CAKTO_WEBHOOK_ENABLED:'true',CAKTO_ACCOUNT_KEY:'synthetic',CAKTO_WEBHOOK_SECRET:'synthetic-cakto-current-secret-32-characters',CAKTO_WEBHOOK_PREVIOUS_SECRET:'synthetic-cakto-previous-secret-32-characters'}
export const caktoProduct='synthetic-cakto-product',caktoOffer='synthetic-cakto-offer'
export function caktoOrder(id='synthetic-cakto-order'){
 return{id,refId:'never-use-reference',status:'paid',offer_type:'main',parent_order:'',currency:'BRL',amount:99.9 as number|null,baseAmount:110,fees:9.9 as number|null,discount:'10.10',charged_fees:'0.00',interest:null,additionalInstallmentInterest:'0.00',installments:1,
 createdAt:'2026-10-20T08:00:00.935243-03:00',paidAt:'2026-10-20T08:01:00.741948-03:00' as string|null,refundedAt:null as string|null,chargedbackAt:null as string|null,canceledAt:null,
 product:{id:caktoProduct,short_id:'never-use-short-id',name:'Livro sintético',type:'unique',supportEmail:'never-store@example.invalid'},offer:{id:caktoOffer,name:'Oferta sintética',price:88.8,currency:'BRL'},
 customer:{name:'Pessoa sintética',email:'never-store@example.invalid',docNumber:'SYNTHETIC-DOCUMENT'},affiliate:'never-store-affiliate@example.invalid',commissions:[{type:'producer',user:'never-store@example.invalid',totalAmount:90}],subscription:null,subscription_period:null,shipping:null,
 paymentMethod:'pix',pix:{qrCode:'never-store-private-pix'},callback:'never-infer-personal-reference',utm_source:'never-store-origin',checkoutUrl:'https://example.invalid/never-store-access'}
}
export function caktoFixture(extra:{id?:string;event?:string;data?:unknown}={}){return{secret:caktoEnv.CAKTO_WEBHOOK_SECRET,event:extra.event??'purchase_approved',data:extra.data??caktoOrder(extra.id)}}
export const caktoBytes=(value:unknown)=>Buffer.from(typeof value==='string'?value:JSON.stringify(value))
export const caktoHeaders=(body:Uint8Array,secret=caktoEnv.CAKTO_WEBHOOK_SECRET,timestamp=String(Math.floor(Date.now()/1000)))=>new Headers({'Content-Type':'application/json','X-Cakto-Timestamp':timestamp,'X-Cakto-Signature':'v1='+createHmac('sha256',secret).update(timestamp+'.').update(body).digest('hex')})
export function caktoRequest(value:unknown,secret=caktoEnv.CAKTO_WEBHOOK_SECRET){const body=caktoBytes(value);return new Request('http://127.0.0.1/api/v1/webhooks/cakto',{method:'POST',headers:caktoHeaders(body,secret),body})}
export async function seedCaktoCatalog(seed:Awaited<ReturnType<typeof seedCommerce>>){return seed.payload.update({collection:'offers',id:seed.offers[2].id,...seed.auth,data:{externalProductId:caktoProduct,externalOfferId:caktoOffer}})}
