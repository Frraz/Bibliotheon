import {describe,it,expect,vi} from 'vitest'
import type {Payload} from 'payload'
import {kiwifyEnv,kiwifyFixture,kiwifyBytes,signKiwify,kiwifyRequest,kiwifyProduct,kiwifyOffer} from '../fixtures/kiwify'
import {kiwifyWebhookConfig,kiwifySignature,authenticatedKiwify,createKiwifyAdapter} from '../../src/integrations/kiwify/webhook'
import {handleKiwifyWebhook} from '../../src/integrations/kiwify/webhook-http'
import {kiwifyDate} from '../../src/integrations/kiwify/dates'
import {nativeJSON,nativeInteger,record} from '../../src/modules/commerce/native-json'
import {prepareCommercialReceipt,commercialEventDigest,type NormalizedCommercialEvent} from '../../src/modules/commerce/events'
import {projectCommercialEvents} from '../../src/modules/commerce/projection'
const config=kiwifyWebhookConfig(kiwifyEnv)!,scope={provider:'kiwify' as const,accountKey:'synthetic'}
const prepare=(value:unknown)=>{const bytes=kiwifyBytes(value);return prepareCommercialReceipt(createKiwifyAdapter(config,signKiwify(bytes)),scope,bytes,new Headers())}
async function event(value:unknown):Promise<NormalizedCommercialEvent>{const result=await prepare(value);expect(result.state).toBe('prepared');if(result.state!=='prepared')throw new Error('invalid fixture');return result.event}
const noDatabase=()=>vi.fn<()=>Promise<Payload>>(async()=>{throw new Error('synthetic database unavailable')})
describe('Kiwify: contrato nativo assinado',()=>{
 it('reproduz vetor HMAC-SHA1 oficial e verifica os bytes, não o JSON reserializado',()=>{
  const bytes=kiwifyBytes('{"order_id":"9b1c2d3e-0000-4000-8000-000000000001","order_status":"paid","webhook_event_type":"order_approved"}')
  expect(signKiwify(bytes,'kiwify-token-de-teste')).toBe('bf18f352a4f981b91dfa3f6d8742a81080ab8c86')
  const signature=signKiwify(bytes)
  expect(authenticatedKiwify(bytes,signature,config)).toBe(true)
  expect(authenticatedKiwify(Buffer.concat([bytes,Buffer.from(' ')]),signature,config)).toBe(false)
  expect(authenticatedKiwify(bytes,signKiwify(bytes,kiwifyEnv.KIWIFY_WEBHOOK_PREVIOUS_TOKEN),config)).toBe(true)
  expect(authenticatedKiwify(bytes,signKiwify(bytes,'unrelated-token'),config)).toBe(false)
 })
 it('ativa somente configuração própria, conta opaca e segredo forte independente',()=>{
  expect(kiwifyWebhookConfig(kiwifyEnv)).toEqual(config)
  for(const extra of [{KIWIFY_WEBHOOK_ENABLED:'false'},{KIWIFY_ACCOUNT_KEY:'buyer@example.invalid'},{KIWIFY_WEBHOOK_TOKEN:'short'},{KIWIFY_WEBHOOK_TOKEN:'REPLACE_TOKEN_WITH_RANDOM_32_CHARACTERS'},{KIWIFY_WEBHOOK_PREVIOUS_TOKEN:kiwifyEnv.KIWIFY_WEBHOOK_TOKEN},{PAYLOAD_SECRET:kiwifyEnv.KIWIFY_WEBHOOK_TOKEN},{HOTMART_HOTTOK:kiwifyEnv.KIWIFY_WEBHOOK_TOKEN}])expect(kiwifyWebhookConfig({...kiwifyEnv,...extra})).toBeNull()
 })
 it('exige uma assinatura hex na query sem aceitar header ou token como assinatura',()=>{
  const signature=signKiwify(kiwifyBytes('{}'))
  expect(kiwifySignature(`https://example.invalid?signature=${signature}`)).toBe(signature)
  for(const query of ['',`?signature=${signature}&signature=${signature}`,`?signature=${signature.toUpperCase()}`,'?signature=bad','?token=secret'])expect(kiwifySignature('https://example.invalid'+query)).toBeNull()
 })
 it('mapeia produto/oferta exatos e centavos, sem PII, checkout como oferta, comissão ou recebimento',async()=>{
  const normalized=await event(kiwifyFixture())
  expect(normalized).toMatchObject({...scope,externalProductId:kiwifyProduct,externalOfferId:kiwifyOffer,externalTransactionId:'synthetic-order',kind:'approved',grossCents:9990,feesCents:990,producerNetCents:null,refundedCents:null,chargebackCents:null,externalClickReference:null,approvedAt:'2026-10-20T11:01:00.000Z',occurredAt:'2026-10-20T11:01:00.000Z',sourceCreatedAt:'2026-10-20T11:00:00.000Z',sourceEvent:'order_approved'})
  for(const marker of ['never-store','SYNTHETIC-DOCUMENT','never-use','never-trust','never-infer'])expect(JSON.stringify(normalized)).not.toContain(marker)
  const fixture=kiwifyFixture();delete (fixture.Product as Partial<typeof fixture.Product>).product_offer_id
  expect((await event(fixture)).externalOfferId).toBeNull()
 })
 it('aceita TrackingParameters.sck somente como UUID do registro interno de saída',async()=>{
  const fixture=kiwifyFixture(),reference='a7196251-3e51-45b3-8d24-18a263d74191';(fixture.TrackingParameters as typeof fixture.TrackingParameters&{sck?:string}).sck=reference
  expect((await event(fixture)).externalClickReference).toBe(reference);
  (fixture.TrackingParameters as typeof fixture.TrackingParameters&{sck?:string}).sck='buyer@example.invalid';expect((await event(fixture)).externalClickReference).toBeNull()
 })
 it('lê centavos inteiros sem multiplicar por 100, arredondar ou converter strings',()=>{
  const integer=(source:string,signed=false)=>nativeInteger(record(nativeJSON(kiwifyBytes(`{"v":${source}}`)))!.v,signed)
  for(const [source,result] of [['11094',11094],['1e2',100],['11094.000',11094],['0',0],['9007199254740991',Number.MAX_SAFE_INTEGER]] as const)expect(integer(source)).toBe(result)
  for(const source of ['110.94','1.0000000000000001','9007199254740992','"11094"','-1','1e1000000'])expect(integer(source)).toBeNull()
  expect(integer('-990',true)).toBe(-990)
 })
 it('não converte taxa em outra moeda nem comissão em líquido/recebimento',async()=>{
  const fixture=kiwifyFixture();fixture.Commissions.kiwify_fee_currency='USD'
  expect((await event(fixture)).feesCents).toBeNull()
  expect((await event(fixture)).producerNetCents).toBeNull()
 })
 it('interpreta datas de Brasília com DST histórico, rejeitando datas impossíveis e ambíguas',()=>{
  expect(kiwifyDate('2026-10-20 08:01')).toBe('2026-10-20T11:01:00.000Z')
  expect(kiwifyDate('2018-01-10 08:01')).toBe('2018-01-10T10:01:00.000Z')
  for(const value of ['2018-11-04 00:30','2018-02-17 23:30','2026-02-30 08:00','2026-10-20 24:01','2026-10-20T08:01:00Z',''])expect(kiwifyDate(value)).toBeNull()
 })
 it.each([['billet_created','waiting_payment'],['pix_created','waiting_payment']])('%s é pendência, não aprovação',async(type,status)=>{
  const fixture=kiwifyFixture({event:type,status});fixture.approved_date=''
  const normalized=await event(fixture);expect(normalized.kind).toBe('pending');expect(normalized.approvedAt).toBeNull();expect(normalized.reviewReason).toBeUndefined()
 })
 it('usa refunded_at para reembolso, sem inferir quantia; aprovação tardia não apaga reversão',async()=>{
  const approved=await event(kiwifyFixture()),fixture=kiwifyFixture({event:'order_refunded',status:'refunded'});fixture.refunded_at='2026-10-20 09:00'
  const refund=await event(fixture);expect(refund.occurredAt).toBe('2026-10-20T12:00:00.000Z');expect(refund.refundedCents).toBeNull()
  const projection=projectCommercialEvents([refund,approved],scope);expect(projection.state).toBe('projected');if(projection.state==='projected'){expect(projection.projection.state).toBe('refunded');expect(projection.projection.refundedCents).toBeNull();expect(projection.projection.settledCents).toBeNull()}
 })
 it.each([['chargeback','chargedback'],['order_rejected','refused'],['order_refunded','refunded']])('%s sem instante confirmado é revisão, sem usar updated_at',async(type,status)=>{
  const normalized=await event(kiwifyFixture({event:type,status}));expect(normalized.reviewReason).toBe('unknown_event_time');expect(projectCommercialEvents([normalized],scope)).toEqual({state:'needs_review',reason:'unknown_event_time'})
 })
 it('aprovação sem data e estados divergentes ficam em revisão',async()=>{
  const fixture=kiwifyFixture();fixture.approved_date=''
  expect((await event(fixture)).reviewReason).toBe('unknown_event_time')
  expect((await event(kiwifyFixture({status:'refused'}))).reviewReason).toBe('unsupported_native_status')
 })
 it('separa recorrência, afiliado, parcelamentos especiais e produto físico da venda avulsa',async()=>{
  for(const extra of [{subscription_id:'synthetic-subscription'},{Subscription:{status:'active'}},{SmartInstallment:{}},{ScheduledInstallment:{}},{product_type:'physical'},{sale_type:'affiliate',Customer:null},{sale_type:'coproducer'}])expect((await event({...kiwifyFixture(),...extra})).reviewReason).toBe('unsupported_purchase_shape')
 })
 it.each(['membership','club'])('área %s sem evidência de recorrência não vira assinatura por inferência',async(type)=>{
  const fixture=kiwifyFixture();fixture.product_type=type;expect((await event(fixture)).reviewReason).toBeUndefined()
 })
 it('datas que contradizem a cronologia do pedido exigem revisão',async()=>{
  const fixture=kiwifyFixture();fixture.approved_date='2026-10-20 07:59';expect((await event(fixture)).reviewReason).toBe('unknown_event_time')
  const refund=kiwifyFixture({event:'order_refunded',status:'refunded'});refund.refunded_at='2026-10-20 08:00';expect((await event(refund)).reviewReason).toBe('unknown_event_time')
 })
 it('deduplica ordem/tipo, ignora dados mutáveis sem efeito e detecta mudança financeira',async()=>{
  const fixture=kiwifyFixture(),first=await event(fixture);fixture.updated_at='2026-10-21 09:00';fixture.Customer.email='another@example.invalid'
  expect(commercialEventDigest(await event(fixture))).toBe(commercialEventDigest(first))
  fixture.Commissions.charge_amount=10000;expect((await event(fixture)).eventKey).toBe(first.eventKey);expect(commercialEventDigest(await event(fixture))).not.toBe(commercialEventDigest(first))
  expect((await event(kiwifyFixture({event:'pix_created',status:'waiting_payment'}))).eventKey).not.toBe(first.eventKey)
 })
 it('ignora cancelamento de assinatura/carrinho/novos tipos sem PII nem transação',async()=>{
  for(const fixture of [kiwifyFixture({event:'subscription_canceled'}),kiwifyFixture({event:'future_event'}),{id:'synthetic-cart',status:'abandoned',email:'never-store@example.invalid'}]){
   const prepared=await prepare(fixture);expect(prepared.state).toBe('prepared_ignored');if(prepared.state==='prepared_ignored')expect(Object.keys(prepared.event).sort()).toEqual(['accountKey','eventKey','eventType','kind','occurredAt','provider'])
  }
 })
 it('recusa dinheiro/identidade/data malformados e não permite que corpo escolha conta',async()=>{
  const original=kiwifyFixture()
  for(const fixture of [{...original,Product:{product_id:123}},{...original,created_at:'2026-02-30 12:00'},JSON.stringify(original).replace('9990','1.0000000000000001'),JSON.stringify(original).replace('9990','"9990"')])expect((await prepare(fixture)).state).toBe('invalid_event')
  const body=kiwifyBytes(original);expect((await prepareCommercialReceipt(createKiwifyAdapter(config,signKiwify(body)),{...scope,accountKey:'other'},body,new Headers())).state).toBe('invalid_event')
 })
})
describe('Kiwify HTTP antes da persistência',()=>{
 it('mantém configuração desligada e rejeita query inválida antes de ler corpo/abrir banco',async()=>{
  const db=noDatabase(),read=vi.fn(),stream=new ReadableStream({pull:read},{highWaterMark:0})
  const req=new Request('http://127.0.0.1/api/v1/webhooks/kiwify',{method:'POST',headers:{'Content-Type':'application/json','X-Kiwify-Token':kiwifyEnv.KIWIFY_WEBHOOK_TOKEN},body:stream,duplex:'half'} as RequestInit&{duplex:'half'})
  expect((await handleKiwifyWebhook(req,db,kiwifyEnv)).status).toBe(401);expect(read).not.toHaveBeenCalled();expect(db).not.toHaveBeenCalled()
  expect((await handleKiwifyWebhook(kiwifyRequest('{}'),db,{})).status).toBe(503)
 })
 it('verifica HMAC bruto antes do schema e limita conteúdo/tamanho antes do banco',async()=>{
  const db=noDatabase(),wrong=kiwifyRequest(kiwifyFixture(),'wrong-secret')
  expect((await handleKiwifyWebhook(wrong,db,kiwifyEnv)).status).toBe(401)
  for(const [extra,status] of [[{'Content-Type':'text/plain'},415],[{'Content-Encoding':'gzip'},415],[{'Content-Length':'262145'},413]] as const){const request=kiwifyRequest('{}');for(const [key,value]of Object.entries(extra))request.headers.set(key,value);expect((await handleKiwifyWebhook(request,db,kiwifyEnv)).status).toBe(status)}
  expect((await handleKiwifyWebhook(kiwifyRequest(' '.repeat(262145)),db,kiwifyEnv)).status).toBe(413)
  expect((await handleKiwifyWebhook(kiwifyRequest('{'),db,kiwifyEnv)).status).toBe(422);expect(db).not.toHaveBeenCalled()
  const result=await handleKiwifyWebhook(kiwifyRequest(kiwifyFixture()),db,kiwifyEnv);expect(result.status).toBe(503);expect(result.headers.get('retry-after')).toBe('60');expect(db).toHaveBeenCalledTimes(1)
 })
 it('encerra corpo lento sem autenticação parcial ou acesso ao banco',async()=>{
  vi.useFakeTimers()
  try{
   const db=noDatabase(),stream=new ReadableStream({start(){}},{highWaterMark:0}),req=new Request('http://127.0.0.1?signature='+'0'.repeat(40),{method:'POST',headers:{'Content-Type':'application/json'},body:stream,duplex:'half'} as RequestInit&{duplex:'half'})
   const pending=handleKiwifyWebhook(req,db,kiwifyEnv);await vi.advanceTimersByTimeAsync(5001);expect((await pending).status).toBe(503);expect(db).not.toHaveBeenCalled()
  }finally{vi.useRealTimers()}
 })
})
