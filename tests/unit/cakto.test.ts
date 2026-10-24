import {createHmac} from 'node:crypto'
import {describe,it,expect,vi} from 'vitest'
import type {Payload} from 'payload'
import {caktoEnv,caktoFixture,caktoOrder,caktoBytes,caktoHeaders,caktoRequest,caktoProduct,caktoOffer} from '../fixtures/cakto'
import {caktoWebhookConfig,caktoSignature,authenticatedCakto,createCaktoAdapter} from '../../src/integrations/cakto/webhook'
import {caktoDate} from '../../src/integrations/cakto/dates'
import {handleCaktoWebhook} from '../../src/integrations/cakto/webhook-http'
import {prepareCommercialBatch,prepareCommercialReceipt,commercialEventDigest,type NormalizedCommercialEvent} from '../../src/modules/commerce/events'
import {projectCommercialEvents} from '../../src/modules/commerce/projection'
const config=caktoWebhookConfig(caktoEnv)!,scope={provider:'cakto' as const,accountKey:'synthetic'}
const prepare=(value:unknown)=>{const body=caktoBytes(value);return prepareCommercialBatch(createCaktoAdapter(config),scope,body,caktoHeaders(body))}
async function events(value:unknown){const result=await prepare(value);expect(result.state).toBe('prepared_batch');if(result.state!=='prepared_batch')throw new Error('invalid fixture');return result.receipts}
async function event(value:unknown):Promise<NormalizedCommercialEvent>{const [prepared]=await events(value);if(prepared.state!=='prepared')throw new Error('unexpected ignored');return prepared.event}
const noDatabase=()=>vi.fn<()=>Promise<Payload>>(async()=>{throw new Error('synthetic database unavailable')})
describe('Cakto: contrato nativo assinado V1/V2',()=>{
 it('exige configuração independente; segredo anterior é explícito e distinto',()=>{
  expect(caktoWebhookConfig(caktoEnv)).toEqual(config)
  for(const extra of [{CAKTO_WEBHOOK_ENABLED:'false'},{CAKTO_ACCOUNT_KEY:'buyer@example.invalid'},{CAKTO_WEBHOOK_SECRET:'short'},{CAKTO_WEBHOOK_SECRET:'REPLACE_SECRET_WITH_AT_LEAST_32_CHARACTERS'},{PAYLOAD_SECRET:caktoEnv.CAKTO_WEBHOOK_SECRET},{KIWIFY_WEBHOOK_TOKEN:caktoEnv.CAKTO_WEBHOOK_SECRET},{CAKTO_WEBHOOK_PREVIOUS_SECRET:caktoEnv.CAKTO_WEBHOOK_SECRET}])expect(caktoWebhookConfig({...caktoEnv,...extra})).toBeNull()
 })
 it('reproduz HMAC-SHA256 padrão e vincula timestamp mais ponto aos bytes exatos',()=>{
  expect(createHmac('sha256','key').update('The quick brown fox jumps over the lazy dog').digest('hex')).toBe('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8')
  const body=caktoBytes(caktoFixture()),headers=caktoHeaders(body)
  expect(authenticatedCakto(body,headers,config)).toBe(true)
  expect(authenticatedCakto(Buffer.concat([body,Buffer.from(' ')]),headers,config)).toBe(false)
  headers.set('x-cakto-timestamp',String(Number(headers.get('x-cakto-timestamp'))-1));expect(authenticatedCakto(body,headers,config)).toBe(false)
  expect(authenticatedCakto(body,caktoHeaders(body,caktoEnv.CAKTO_WEBHOOK_PREVIOUS_SECRET),config)).toBe(true)
 })
 it('limita janela de cinco minutos nos dois sentidos, rejeita NaN/duplicata e permite outra versão junto de v1',()=>{
  const body=caktoBytes('{}'),now=1792843200000
  for(const delta of [-300,300])expect(caktoSignature(caktoHeaders(body,config.secret,String(now/1000+delta)),now)).not.toBeNull()
  for(const timestamp of [String(now/1000-301),String(now/1000+301),'NaN','1e9','1792843200.1','1792843200,1792843200'])expect(caktoSignature(caktoHeaders(body,config.secret,timestamp),now)).toBeNull()
  const headers=caktoHeaders(body,config.secret,String(now/1000)),v1=headers.get('x-cakto-signature')!
  headers.set('x-cakto-signature',v1+', v2=future');expect(authenticatedCakto(body,headers,config,now)).toBe(true)
  for(const value of [v1+','+v1,'v2=future','v1=bad',v1.toUpperCase()]){headers.set('x-cakto-signature',value);expect(caktoSignature(headers,now)).toBeNull()}
 })
 it('preserva ids exatos, aprovação e decimal sem usar preço da oferta/comissões como total ou líquido',async()=>{
  const normalized=await event(caktoFixture())
  expect(normalized).toMatchObject({...scope,externalProductId:caktoProduct,externalOfferId:caktoOffer,externalTransactionId:'synthetic-cakto-order',kind:'approved',grossCents:9990,feesCents:990,approvedAt:'2026-10-20T11:01:00.741Z',occurredAt:'2026-10-20T11:01:00.741Z',sourceCreatedAt:'2026-10-20T11:00:00.935Z',producerNetCents:null,refundedCents:null,chargebackCents:null,externalClickReference:null})
  for(const marker of ['never-store','never-use','never-infer','SYNTHETIC-DOCUMENT',config.secret])expect(JSON.stringify(normalized)).not.toContain(marker)
  expect(normalized.reviewReason).toBeUndefined()
 })
 it('converte centavos exatamente, sem aceitar strings, perda de precisão ou arredondamento',async()=>{
  const original=JSON.stringify(caktoFixture())
  for(const [source,result] of [['0.29',29],['1e-2',1],['90071992547409.91',Number.MAX_SAFE_INTEGER]] as const)expect((await event(original.replace('99.9',source))).grossCents).toBe(result)
  for(const source of ['"99.90"','1.005','1.0000000000000001','90071992547409.92','-1'])expect((await prepare(original.replace('99.9',source))).state).toBe('invalid_event')
 })
 it('não substitui amount ausente nem interpreta decimal textual de juros como pagamento',async()=>{
  const row=caktoOrder();row.amount=null;row.fees=null;row.additionalInstallmentInterest='never-infer';const normalized=await event(caktoFixture({data:row}));expect(normalized.grossCents).toBeNull();expect(normalized.feesCents).toBeNull()
  row.currency='JPY';row.amount=100;expect((await event(caktoFixture({data:row}))).reviewReason).toBe('unsupported_currency_precision');expect((await event(caktoFixture({data:row}))).grossCents).toBeNull()
 })
 it('valida ISO com offset, calendário e microssegundos, normalizando sem arredondamento para milissegundos',()=>{
  expect(caktoDate('2026-10-20T08:01:00.741948-03:00')).toBe('2026-10-20T11:01:00.741Z')
  expect(caktoDate('2026-10-20T11:01:00Z')).toBe('2026-10-20T11:01:00.000Z')
  for(const value of ['2026-02-30T08:00:00Z','2026-10-20T24:00:00Z','2026-10-20 08:00','2026-10-20T08:00:00','2026-10-20T08:00:00+25:00'])expect(caktoDate(value)).toBeNull()
 })
 it.each(['pix_gerado','boleto_gerado','picpay_gerado','openfinance_nubank_gerado'])('%s permanece pendente mesmo com bloco de pagamento',async(type)=>{
  const row=caktoOrder();row.status='waiting_payment';row.paidAt=null
  const normalized=await event(caktoFixture({event:type,data:row}));expect(normalized.kind).toBe('pending');expect(normalized.approvedAt).toBeNull();expect(normalized.reviewReason).toBeUndefined()
 })
 it('reembolso/chargeback usam suas datas, sem deduzir quantias; ordem invertida não reverte estado',async()=>{
  const approved=await event(caktoFixture()),row=caktoOrder();row.status='refunded';row.refundedAt='2026-10-20T09:00:00-03:00'
  const refund=await event(caktoFixture({event:'refund',data:row})),projection=projectCommercialEvents([refund,approved],scope)
  expect(refund.refundedCents).toBeNull();expect(projection.state).toBe('projected');if(projection.state==='projected')expect(projection.projection.state).toBe('refunded')
  row.status='chargedback';row.chargedbackAt='2026-10-20T10:00:00-03:00';const chargeback=await event(caktoFixture({event:'chargeback',data:row}));expect(chargeback.chargebackCents).toBeNull();expect(chargeback.reviewReason).toBeUndefined();expect(chargeback.occurredAt).toBe('2026-10-20T13:00:00.000Z')
  row.status='MED';expect((await event(caktoFixture({event:'chargeback',data:row}))).reviewReason).toBe('dispute_not_final')
 })
 it('instante ausente/contraditório e recusa sem data ficam para conciliação',async()=>{
  const row=caktoOrder();row.paidAt=null;expect((await event(caktoFixture({data:row}))).reviewReason).toBe('unknown_event_time')
  row.paidAt='2026-10-20T07:00:00-03:00';expect((await event(caktoFixture({data:row}))).reviewReason).toBe('unknown_event_time')
  row.status='refused';expect((await event(caktoFixture({event:'purchase_refused',data:row}))).reviewReason).toBe('unknown_event_time')
 })
 it('produto físico/assinatura e divergência de status ficam em revisão',async()=>{
  for(const extra of [{subscription:{}},{subscription_period:1},{shipping:{}},{product:{...caktoOrder().product,type:'subscription'}}])expect((await event(caktoFixture({data:{...caktoOrder(),...extra}}))).reviewReason).toBe('unsupported_purchase_shape')
  const row=caktoOrder();row.status='refused';expect((await event(caktoFixture({data:row}))).reviewReason).toBe('unsupported_native_status')
 })
 it('V2 normaliza cada pedido sem usar índice ou timestamp de envio como identidade',async()=>{
  const first=caktoOrder('main'),bump={...caktoOrder('bump'),offer_type:'orderbump',parent_order:'synthetic-parent'}
  const normal=await events(caktoFixture({data:[first,bump]})),reversed=await events(caktoFixture({data:[bump,first]}))
  expect(normal).toHaveLength(2);expect(normal[0].key).toBe(reversed[1].key);expect(normal[1].key).toBe(reversed[0].key)
  expect((await prepare(caktoFixture({data:[first,{...bump,product:null}]}))).state).toBe('invalid_event')
  for(const data of [[],Array.from({length:26},()=>first),[first,[bump]]])expect((await prepare(caktoFixture({data}))).state).toBe('invalid_event')
 })
 it('ignora assinatura/cancelamento/pedido de reembolso/email falho sem fingir reversão; abandono sem PII',async()=>{
  for(const type of ['subscription_canceled','refund_requested','purchase_email_failed','dispute_defense_requested','future_event'])expect((await events(caktoFixture({event:type})))[0].state).toBe('prepared_ignored')
  const data={offer:{id:caktoOffer},product:{id:caktoProduct},createdAt:'2026-10-20T08:00:00-03:00',customerEmail:'never-store@example.invalid'},[cart]=await events(caktoFixture({event:'checkout_abandonment',data:[data]}))
  expect(cart.state).toBe('prepared_ignored');expect(Object.keys(cart.event).sort()).toEqual(['accountKey','eventKey','eventType','kind','occurredAt','provider']);expect(JSON.stringify(cart.event)).not.toContain('never-store')
 })
 it('mudança apenas em campos descartados/secret não altera digest; alteração financeira preserva chave e muda hash',async()=>{
  const fixture=caktoFixture(),first=await event(fixture);fixture.secret='other-authenticated-body-value';const row=caktoOrder();row.customer.email='other@example.invalid';row.paidAt='2026-10-20T08:01:00.741948-03:00'
  expect(commercialEventDigest(await event({...fixture,data:row}))).toBe(commercialEventDigest(first))
  row.amount=100;const changed=await event(caktoFixture({data:row}));expect(changed.eventKey).toBe(first.eventKey);expect(commercialEventDigest(changed)).not.toBe(commercialEventDigest(first))
  const body=caktoBytes(caktoFixture());expect((await prepareCommercialReceipt(createCaktoAdapter(config),{...scope,accountKey:'other'},body,caktoHeaders(body))).state).toBe('invalid_event')
 })
})
describe('Cakto HTTP: antes da fábrica Payload',()=>{
 it('sem header assinado fresco não lê corpo nem aceita secret em corpo/query/cookie',async()=>{
  const db=noDatabase(),read=vi.fn(),stream=new ReadableStream({pull:read},{highWaterMark:0}),request=new Request('http://127.0.0.1/api/v1/webhooks/cakto?secret=synthetic',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'secret=synthetic'},body:stream,duplex:'half'} as RequestInit&{duplex:'half'})
  expect((await handleCaktoWebhook(request,db,caktoEnv)).status).toBe(401);expect(read).not.toHaveBeenCalled();expect(db).not.toHaveBeenCalled()
  expect((await handleCaktoWebhook(caktoRequest(caktoFixture()),db,{})).status).toBe(503)
 })
 it('valida limites, assinatura e todos os itens antes de abrir banco; falha de commit nunca recebe ACK',async()=>{
  const db=noDatabase()
  expect((await handleCaktoWebhook(caktoRequest(caktoFixture(),'wrong'),db,caktoEnv)).status).toBe(401)
  for(const [extra,status] of [[{'Content-Type':'text/plain'},415],[{'Content-Encoding':'gzip'},415],[{'Content-Length':'262145'},413]] as const){const request=caktoRequest('{}');for(const [key,value]of Object.entries(extra))request.headers.set(key,value);expect((await handleCaktoWebhook(request,db,caktoEnv)).status).toBe(status)}
  for(const value of ['{',caktoFixture({data:[caktoOrder(),{id:'invalid'}]})])expect((await handleCaktoWebhook(caktoRequest(value),db,caktoEnv)).status).toBe(422)
  expect((await handleCaktoWebhook(caktoRequest(' '.repeat(262145)),db,caktoEnv)).status).toBe(413);expect(db).not.toHaveBeenCalled()
  const result=await handleCaktoWebhook(caktoRequest(caktoFixture()),db,caktoEnv);expect(result.status).toBe(503);expect(result.headers.get('retry-after')).toBe('60');expect(db).toHaveBeenCalledTimes(1)
 })
 it('cancela corpo lento em cinco segundos sem abrir banco',async()=>{
  vi.useFakeTimers()
  try{
   const db=noDatabase(),stream=new ReadableStream({start(){}},{highWaterMark:0}),request=new Request('http://127.0.0.1/api/v1/webhooks/cakto',{method:'POST',headers:caktoHeaders(caktoBytes('{}')),body:stream,duplex:'half'} as RequestInit&{duplex:'half'})
   const pending=handleCaktoWebhook(request,db,caktoEnv);await vi.advanceTimersByTimeAsync(5001);expect((await pending).status).toBe(503);expect(db).not.toHaveBeenCalled()
  }finally{vi.useRealTimers()}
 })
})
