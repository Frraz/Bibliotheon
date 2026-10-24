import {createHash} from 'node:crypto'
import {describe,it,expect,vi} from 'vitest'
import type {Payload} from 'payload'
import {hotmartFixture,hotmartEnv,hotmartProduct,hotmartOffer} from '../fixtures/hotmart'
import {hotmartWebhookConfig,authenticatedHotmart,createHotmartAdapter} from '../../src/integrations/hotmart/webhook'
import {nativeJSON,nativeCents,nativeEpoch,record,hundredthCurrency} from '../../src/integrations/hotmart/numbers'
import {handleHotmartWebhook} from '../../src/integrations/hotmart/webhook-http'
import {prepareCommercialReceipt,commercialEventDigest,parseCommercialEvent,type NormalizedCommercialEvent} from '../../src/modules/commerce/events'
import {projectCommercialEvents} from '../../src/modules/commerce/projection'
const bytes=(value:unknown)=>Buffer.from(typeof value==='string'?value:JSON.stringify(value))
const headers=()=>new Headers({'x-hotmart-hottok':hotmartEnv.HOTMART_HOTTOK,'content-type':'application/json'})
const config=hotmartWebhookConfig(hotmartEnv)!,scope={provider:'hotmart' as const,accountKey:'synthetic'}
const prepare=(value:unknown)=>prepareCommercialReceipt(createHotmartAdapter(config),scope,bytes(value),headers())
async function event(value:unknown):Promise<NormalizedCommercialEvent>{const result=await prepare(value);expect(result.state).toBe('prepared');if(result.state!=='prepared')throw new Error('unexpected fixture');return result.event}
const noDatabase=()=>vi.fn<()=>Promise<Payload>>(async()=>{throw new Error('synthetic database unavailable')})
const request=(body:unknown,extra:HeadersInit={})=>new Request('http://127.0.0.1/api/v1/webhooks/hotmart',{method:'POST',headers:new Headers({...Object.fromEntries(headers()),...Object.fromEntries(new Headers(extra))}),body:bytes(body)})
describe('Hotmart v2: contrato nativo verificado',()=>{
 it('configura conta local/token do provedor sem segredo compartilhado ou placeholder',()=>{
  expect(hotmartWebhookConfig({...hotmartEnv,HOTMART_WEBHOOK_ENABLED:'false'})).toBeNull()
  for(const extra of [{HOTMART_ACCOUNT_KEY:'buyer@example.invalid'},{HOTMART_ACCOUNT_KEY:''},{HOTMART_HOTTOK:'REPLACE_TOKEN'},{HOTMART_HOTTOK:' bad token '},{PAYLOAD_SECRET:hotmartEnv.HOTMART_HOTTOK},{HOTMART_PREVIOUS_HOTTOK:hotmartEnv.HOTMART_HOTTOK}])expect(hotmartWebhookConfig({...hotmartEnv,...extra})).toBeNull()
  expect(authenticatedHotmart(headers(),config)).toBe(true)
  expect(authenticatedHotmart(new Headers({'X-HOTMART-HOTTOK':hotmartEnv.HOTMART_PREVIOUS_HOTTOK}),config)).toBe(true)
  expect(authenticatedHotmart(new Headers({'x-hotmart-hottok':hotmartEnv.HOTMART_HOTTOK+', other'}),config)).toBe(false)
 })
 it('usa ucode/código da oferta, data original e total pago; descarta PII/comissão/origem e não usa conta do corpo',async()=>{
  const native=hotmartFixture(),normalized=await event(native)
  expect(normalized).toMatchObject({provider:'hotmart',accountKey:'synthetic',eventKey:native.id,externalProductId:hotmartProduct,externalOfferId:hotmartOffer,kind:'approved',grossCents:9990,feesCents:null,producerNetCents:null,refundedCents:null,chargebackCents:null,externalClickReference:null,approvedAt:new Date(native.data.purchase.approved_date).toISOString()})
  expect(normalized.occurredAt).toBe(normalized.approvedAt)
  for(const fragment of ['never-store','SYNTHETIC-DOCUMENT','private-pix','untrusted-personal','untrusted-body','commissions'])expect(JSON.stringify(normalized)).not.toContain(fragment)
  const mismatch=await prepareCommercialReceipt(createHotmartAdapter(config),{...scope,accountKey:'another-account'},bytes(native),headers());expect(mismatch.state).toBe('invalid_event')
 })
 it('converte números a partir do texto original sem arredondamento binário, coerção ou perda de precisão',()=>{
  const amount=(raw:string)=>nativeCents(record(nativeJSON(bytes(`{"value":${raw}}`)))!.value)
  for(const [raw,expected] of [['0.29',29],['1.10',110],['1.100',110],['1e-2',1],['1e2',10000],['90071992547409.91',Number.MAX_SAFE_INTEGER]] as const)expect(amount(raw)).toBe(expected)
  for(const raw of ['1.005','1.0000000000000001','90071992547409.92','-1','1e1000000','"99.9"','{"source":"99.9"}'])expect(amount(raw)).toBeNull()
  expect(nativeEpoch(record(nativeJSON(bytes('{"t":1792843200000}')))!.t)).toBe('2026-10-24T12:00:00.000Z')
 })
 it.each([['PURCHASE_CANCELED','canceled'],['PURCHASE_EXPIRED','canceled'],['PURCHASE_BILLET_PRINTED','pending'],['PURCHASE_DELAYED','pending'],['PURCHASE_REFUNDED','refunded'],['PURCHASE_CHARGEBACK','chargeback']])('mapeia %s para %s sem inferir devolução ou recebimento',async(native,kind)=>{
  const normalized=await event(hotmartFixture({event:native}));expect(normalized.kind).toBe(kind);expect(normalized.refundedCents).toBeNull();expect(normalized.chargebackCents).toBeNull();expect(projectCommercialEvents([normalized],scope).state).toBe('projected')
 })
 it('preserva reembolso parcial desconhecido e COMPLETE como prova da aprovação original, sem regressão após reversão',async()=>{
  const native=hotmartFixture({event:'PURCHASE_REFUNDED',id:'refund',now:Date.parse('2026-10-24T13:00:00Z')});native.data.purchase.status='PARTIALLY_REFUNDED';native.data.purchase.approved_date=Date.parse('2026-10-24T11:00:00Z')
  const refund=await event(native),complete=hotmartFixture({event:'PURCHASE_COMPLETE',id:'complete',now:Date.parse('2026-10-24T14:00:00Z')});complete.data.purchase.approved_date=native.data.purchase.approved_date
  const projection=projectCommercialEvents([refund,await event(complete)],scope);expect(projection.state).toBe('projected');if(projection.state==='projected'){expect(projection.projection.state).toBe('partially_refunded');expect(projection.projection.refundedCents).toBeNull();expect(projection.projection.approvedAt).toBe('2026-10-24T11:00:00.000Z');expect(projection.projection.settledCents).toBeNull()}
 })
 it('não inventa reembolso total quando o estado não esclarece se a devolução é parcial',async()=>{
  const native=hotmartFixture({event:'PURCHASE_REFUNDED'});native.data.purchase.status='APPROVED'
  expect(projectCommercialEvents([await event(native)],scope)).toEqual({state:'needs_review',reason:'unsupported_native_status'})
 })
 it('data de aprovação ausente fica desconhecida e aprovação sem data ainda impede cancelamento regressivo',async()=>{
  const value=hotmartFixture();delete (value.data.purchase as Partial<typeof value.data.purchase>).approved_date
  const first=await event(value),later={...first,eventKey:'late-cancel',kind:'canceled' as const,occurredAt:'2026-10-24T13:00:00.000Z'}
  const projection=projectCommercialEvents([first],scope);expect(projection.state).toBe('projected');if(projection.state==='projected')expect(projection.projection.approvedAt).toBeNull()
  expect(projectCommercialEvents([first,later],scope)).toEqual({state:'needs_review',reason:'paid_state_regressed'})
 })
 it('quarentena explícita para precisão de moeda, assinatura/físico e protesto, sem fabricar aprovação/valor',async()=>{
  expect(hundredthCurrency('BRL')).toBe(true);expect(hundredthCurrency('JPY')).toBe(false)
  const currency=hotmartFixture();currency.data.purchase.full_price.currency_value='JPY';const c=await event(currency);expect(c.grossCents).toBeNull();expect(projectCommercialEvents([c],scope)).toEqual({state:'needs_review',reason:'unsupported_currency_precision'})
  const subscription=hotmartFixture();Object.assign(subscription.data,{subscription:{status:'ACTIVE'}})
  const physical=hotmartFixture();physical.data.product.is_physical_product=true
  for(const item of [subscription,physical])expect((await event(item)).reviewReason).toBe('unsupported_purchase_shape')
  expect((await event(hotmartFixture({event:'PURCHASE_PROTEST'}))).reviewReason).toBe('unsupported_native_status')
 })
 it('ignora evento não financeiro com envelope mínimo e recusa versão/identidade/dinheiro malformados',async()=>{
  const ignored=await prepare(hotmartFixture({event:'SUBSCRIPTION_CANCELLATION'}));expect(ignored.state).toBe('prepared_ignored');if(ignored.state==='prepared_ignored')expect(Object.keys(ignored.event).sort()).toEqual(['accountKey','eventKey','eventType','kind','occurredAt','provider'])
  const invalid=[{...hotmartFixture(),version:'1.0.0'},JSON.stringify(hotmartFixture()).replace('99.9','1.0000000000000001'),JSON.stringify(hotmartFixture()).replace(`"ucode":"${hotmartProduct}"`,'"ucode":null')]
  for(const item of invalid)expect((await prepare(item)).state).toBe('invalid_event')
 })
 it('evidência nova não altera hashes legados e é validada, sem aceitar motivo livre/PII',async()=>{
  const native=await event(hotmartFixture()),legacy={...native};delete legacy.approvedAt;delete legacy.sourceCreatedAt;delete legacy.sourceEvent
  const oldValues=[legacy.provider,legacy.accountKey,legacy.eventKey,legacy.externalTransactionId,legacy.externalProductId,legacy.externalOfferId,legacy.kind,legacy.occurredAt,legacy.currency,legacy.grossCents,legacy.refundedCents,legacy.feesCents,legacy.producerNetCents,legacy.externalClickReference,legacy.refundBasis,legacy.externalRefundId,legacy.chargebackCents]
  expect(commercialEventDigest(legacy)).toBe(createHash('sha256').update(JSON.stringify(oldValues)).digest('hex'));expect(commercialEventDigest(native)).not.toBe(commercialEventDigest(legacy));expect(commercialEventDigest({...legacy,approvedAt:null})).not.toBe(commercialEventDigest(legacy))
  expect(parseCommercialEvent({...legacy,reviewReason:'buyer@example.invalid'},scope).ok).toBe(false)
 })
})
describe('Hotmart HTTP antes de persistência',()=>{
 it('não lê corpo nem abre banco sem configuração/autenticação; não aceita token em query/cookie/corpo',async()=>{
  const db=noDatabase(),read=vi.fn(),stream=new ReadableStream({pull:read},{highWaterMark:0})
  const req=new Request('http://127.0.0.1/api/v1/webhooks/hotmart?hottok=synthetic',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'hottok=synthetic'},body:stream,duplex:'half'} as RequestInit&{duplex:'half'})
  expect((await handleHotmartWebhook(req,db,hotmartEnv)).status).toBe(401);expect(read).not.toHaveBeenCalled();expect(db).not.toHaveBeenCalled()
  expect((await handleHotmartWebhook(request(hotmartFixture()),db,{})).status).toBe(503);expect(db).not.toHaveBeenCalled()
 })
 it('limita MIME, encoding, tamanho e schema antes de abrir banco; nunca confirma falha de persistência',async()=>{
  const db=noDatabase()
  for(const [req,status] of [[request('{}',{'Content-Type':'text/plain'}),415],[request('{}',{'Content-Encoding':'gzip'}),415],[request('{}',{'Content-Length':'262145'}),413],[request(' '.repeat(262145)),413],[request('{'),422],[request({...hotmartFixture(),version:'9.0.0'}),422]] as const)expect((await handleHotmartWebhook(req,db,hotmartEnv)).status).toBe(status)
  expect(db).not.toHaveBeenCalled()
  const result=await handleHotmartWebhook(request(hotmartFixture()),db,hotmartEnv);expect(result.status).toBe(503);expect(result.headers.get('retry-after')).toBe('60');expect(await result.text()).not.toContain('never-store');expect(db).toHaveBeenCalledTimes(1)
 })
 it('interrompe corpo lento em cinco segundos e não consulta banco',async()=>{
  vi.useFakeTimers()
  try{
   const db=noDatabase(),stream=new ReadableStream({start(){}},{highWaterMark:0}),req=new Request('http://127.0.0.1/api/v1/webhooks/hotmart',{method:'POST',headers:headers(),body:stream,duplex:'half'} as RequestInit&{duplex:'half'})
   const pending=handleHotmartWebhook(req,db,hotmartEnv);await vi.advanceTimersByTimeAsync(5001);expect((await pending).status).toBe(503);expect(db).not.toHaveBeenCalled()
  }finally{vi.useRealTimers()}
 })
})
