import type {seedCommerce} from './commerce'
export const hotmartProduct='00000000-0000-4000-8000-000000000111'
export const hotmartOffer='synthetic-hotmart-offer'
export const hotmartEnv={HOTMART_WEBHOOK_ENABLED:'true',HOTMART_ACCOUNT_KEY:'synthetic',HOTMART_HOTTOK:'synthetic-hotmart-private-token',HOTMART_PREVIOUS_HOTTOK:'synthetic-hotmart-previous-token'}
export function hotmartFixture({id='synthetic-native-event',event='PURCHASE_APPROVED',transaction='synthetic-native-transaction',now=Date.parse('2026-10-24T12:00:00Z')}={}){
 const status=({PURCHASE_APPROVED:'APPROVED',PURCHASE_COMPLETE:'COMPLETE',PURCHASE_REFUNDED:'REFUNDED',PURCHASE_CHARGEBACK:'CHARGEBACK',PURCHASE_CANCELED:'CANCELLED',PURCHASE_EXPIRED:'EXPIRED',PURCHASE_BILLET_PRINTED:'PRINTED_BILLET',PURCHASE_DELAYED:'OVERDUE',PURCHASE_PROTEST:'DISPUTE'} as Record<string,string>)[event]||'APPROVED'
 return{id,version:'2.0.0',event,creation_date:now,accountKey:'untrusted-body-account',data:{
  product:{id:12345,ucode:hotmartProduct,name:'Produto sintético',is_physical_product:false},
  buyer:{email:'never-store@example.invalid',name:'Pessoa fictícia',document:'SYNTHETIC-DOCUMENT',checkout_phone:'SYNTHETIC-PHONE'},
  commissions:[{source:'MARKETPLACE',currency_value:'BRL',value:0.65},{source:'PRODUCER',currency_value:'USD',value:3.1}],
  purchase:{transaction,status,approved_date:now-60000,full_price:{currency_value:'BRL',value:99.9},price:{currency_value:'BRL',value:88.8},offer:{code:hotmartOffer},payment:{type:'PIX',pix_code:'synthetic-private-pix'},origin:{src:'untrusted-personal-source',sck:'untrusted-personal-reference'}},
 }}
}
export async function seedHotmartCatalog(seed:Awaited<ReturnType<typeof seedCommerce>>){
 return seed.payload.update({collection:'offers',id:seed.offers[0].id,...seed.auth,data:{externalProductId:hotmartProduct,externalOfferId:hotmartOffer}})
}
