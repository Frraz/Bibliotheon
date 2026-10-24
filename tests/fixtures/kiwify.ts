import {createHmac} from 'node:crypto'
import type {seedCommerce} from './commerce'
export const kiwifyEnv={KIWIFY_WEBHOOK_ENABLED:'true',KIWIFY_ACCOUNT_KEY:'synthetic',KIWIFY_WEBHOOK_TOKEN:'synthetic-kiwify-current-token-32-characters',KIWIFY_WEBHOOK_PREVIOUS_TOKEN:'synthetic-kiwify-previous-token-32-characters'}
export const kiwifyProduct='synthetic-kiwify-product',kiwifyOffer='synthetic-kiwify-offer'
export function kiwifyFixture(extra:{id?:string;event?:string;status?:string}={}){
 return{order_id:extra.id??'synthetic-order',order_ref:'synthetic-ref',webhook_event_type:extra.event??'order_approved',order_status:extra.status??'paid',sale_type:'producer',product_type:'digital',payment_method:'pix',
 created_at:'2026-10-20 08:00',updated_at:'2026-10-20 08:05',approved_date:'2026-10-20 08:01',refunded_at:null as string|null,
 Product:{product_id:kiwifyProduct,product_offer_id:kiwifyOffer,product_name:'Livro sintético'},
 Commissions:{charge_amount:9990,currency:'BRL',kiwify_fee:990,kiwify_fee_currency:'BRL',my_commission:9000,funds_status:'never-infer-settlement',deposit_date:'never-infer-cash',commissioned_stores:[{email:'never-store@example.invalid'}]},
 Customer:{email:'never-store@example.invalid',full_name:'Pessoa sintética',CPF:'SYNTHETIC-DOCUMENT'},TrackingParameters:{src:'never-store-personal-source'},checkout_link:'never-use-as-offer',access_url:'https://example.invalid/never-store-access',store_id:'never-trust-body-account'}
}
export const kiwifyBytes=(value:unknown)=>Buffer.from(typeof value==='string'?value:JSON.stringify(value))
export const signKiwify=(body:Uint8Array,token=kiwifyEnv.KIWIFY_WEBHOOK_TOKEN)=>createHmac('sha1',token).update(body).digest('hex')
export function kiwifyRequest(value:unknown,token=kiwifyEnv.KIWIFY_WEBHOOK_TOKEN){
 const body=kiwifyBytes(value)
 return new Request(`http://127.0.0.1/api/v1/webhooks/kiwify?signature=${signKiwify(body,token)}`,{method:'POST',headers:{'Content-Type':'application/json'},body})
}
export async function seedKiwifyCatalog(seed:Awaited<ReturnType<typeof seedCommerce>>){
 return seed.payload.update({collection:'offers',id:seed.offers[1].id,...seed.auth,data:{externalProductId:kiwifyProduct,externalOfferId:kiwifyOffer}})
}
