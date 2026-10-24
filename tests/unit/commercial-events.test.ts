import {describe,it,expect,vi} from 'vitest'
import {commercialEventDigest,commercialEventKey,commercialTransactionKey,parseCommercialEvent,prepareCommercialReceipt,type AccountScope,type NormalizedCommercialEvent} from '../../src/modules/commerce/events'
import {projectCommercialEvents} from '../../src/modules/commerce/projection'
const scope:AccountScope={provider:'hotmart',accountKey:'synthetic-account'}
const base={...scope,eventKey:'synthetic-event',externalTransactionId:'synthetic-sale',externalProductId:'synthetic-product',kind:'approved',occurredAt:'2026-10-24T00:00:00Z',currency:'BRL',grossCents:10000,refundedCents:null,feesCents:null,producerNetCents:null}
function event(extra:Record<string,unknown>={}):NormalizedCommercialEvent{const parsed=parseCommercialEvent({...base,...extra},scope);if(!parsed.ok)throw new Error(parsed.reason);return parsed.event}
const project=(events:unknown[])=>projectCommercialEvents(events,scope)
function projection(events:unknown[]){const result=project(events);if(result.state!=='projected')throw new Error(result.reason);return result.projection}
describe('envelope comercial mínimo',()=>{
 it('normaliza datas UTC/ausências sem coagir dinheiro e sem aceitar PII extra',()=>{
  const normalized=event();expect(normalized.occurredAt).toBe('2026-10-24T00:00:00.000Z');expect(normalized.feesCents).toBeNull();expect(normalized.chargebackCents).toBeNull()
  for(const extra of [{grossCents:'10000'},{grossCents:1.1},{grossCents:-1},{feesCents:undefined},{currency:'brl'},{occurredAt:'2026-02-30T00:00:00Z'},{occurredAt:'2026-10-24 00:00:00'},{buyer:{email:'synthetic@example.invalid'}},{externalTransactionId:'synthetic@example.invalid'},{refundBasis:['cumulative']}])expect(parseCommercialEvent({...base,...extra},scope).ok).toBe(false)
  expect(parseCommercialEvent({...base,accountKey:'other-account'},scope)).toEqual({ok:false,reason:'unexpected_scope'})
 })
 it('separa chaves por plataforma/conta e não confunde evento com transação',()=>{
  const first=event(),second=event({eventKey:'refund-event',kind:'refunded'})
  expect(commercialTransactionKey(first)).toBe(commercialTransactionKey(second));expect(commercialEventKey(first)).not.toBe(commercialEventKey(second))
  for(const provider of ['kiwify','cakto'] as const)expect(commercialTransactionKey({...first,provider})).not.toBe(commercialTransactionKey(first))
  expect(commercialEventKey({...first,accountKey:'other-account'})).not.toBe(commercialEventKey(first));expect(commercialEventDigest(first)).not.toBe(commercialEventDigest({...first,grossCents:null}))
 })
 it('verifica bytes originais antes de normalizar e não dá ACK/persistência por preparar recibo',async()=>{
  const bytes=new TextEncoder().encode('{"synthetic":true}'),normalize=vi.fn<(body:Uint8Array,scope:AccountScope)=>unknown>(()=>base),verify=vi.fn<(body:Uint8Array,headers:Headers)=>Promise<boolean>>(async()=>false),adapter={provider:'hotmart' as const,version:'synthetic-v1',verify,normalize}
  expect(await prepareCommercialReceipt(adapter,scope,bytes,new Headers())).toEqual({state:'unauthorized'});expect(normalize).not.toHaveBeenCalled()
  verify.mockImplementation(async body=>{expect(new TextDecoder().decode(body)).toBe('{"synthetic":true}');body.fill(0);return true})
  normalize.mockImplementation(body=>{expect(new TextDecoder().decode(body)).toBe('{"synthetic":true}');return base})
  const receipt=await prepareCommercialReceipt(adapter,scope,bytes,new Headers());expect(receipt.state).toBe('prepared');expect(new TextDecoder().decode(bytes)).toBe('{"synthetic":true}')
  expect(await prepareCommercialReceipt(adapter,scope,new Uint8Array(262145),new Headers())).toEqual({state:'too_large'})
 })
})
describe('projeção determinística de fatos comerciais',()=>{
 it('replay/ordem de chegada não duplicam aprovação nem reabrem reembolso',()=>{
  const approved=event(),refunded=event({eventKey:'refund',kind:'refunded',occurredAt:'2026-10-24T01:00:00Z',refundedCents:10000,refundBasis:'cumulative'})
  const first=projection([refunded,approved,approved]),second=projection([approved,refunded]);expect(first).toEqual(second);expect(first.state).toBe('refunded');expect(first.approvedAt).toBe(approved.occurredAt);expect(first.refundedCents).toBe(10000);expect(first.settledCents).toBeNull()
 })
 it('ordena fatos antigos e preserva desconhecidos sem somar taxas novamente',()=>{
  const pending=event({eventKey:'pending',kind:'pending',occurredAt:'2026-10-23T00:00:00Z',grossCents:null}),paid=event({feesCents:1200,producerNetCents:8800})
  const p=projection([paid,pending]);expect(p.state).toBe('approved');expect(p.producerNetCents).toBe(8800);expect(p.feesCents).toBe(1200);expect(p.refundedCents).toBeNull();expect(p.settledCents).toBeNull()
 })
 it('recusa colisão de evento, identidade/valor divergentes e empate conflitante',()=>{
  const approved=event()
  for(const [other,reason]of [[{grossCents:9000},'event_key_conflict'],[{eventKey:'second',kind:'refused'},'same_time_state_conflict'],[{eventKey:'second',externalProductId:'other'},'identity_or_currency_conflict'],[{eventKey:'second',currency:'USD'},'identity_or_currency_conflict'],[{eventKey:'second',externalTransactionId:'other'},'mixed_transaction_scope']] as const)expect(project([approved,event(other)])).toEqual({state:'needs_review',reason})
 })
 it('conta operações únicas e aceita checkpoint acumulado sem duplicá-las',()=>{
  const approved=event(),one=event({eventKey:'r1',kind:'partially_refunded',occurredAt:'2026-10-24T01:00:00Z',refundedCents:2000,refundBasis:'operation',externalRefundId:'operation-1'}),duplicate=event({...one,eventKey:'r1-repeat',occurredAt:'2026-10-24T02:00:00Z'}),checkpoint=event({eventKey:'checkpoint',kind:'partially_refunded',occurredAt:'2026-10-24T03:00:00Z',refundedCents:5000,refundBasis:'cumulative'}),two=event({eventKey:'r2',kind:'partially_refunded',occurredAt:'2026-10-24T04:00:00Z',refundedCents:1000,refundBasis:'operation',externalRefundId:'operation-2'})
  expect(projection([two,checkpoint,duplicate,one,approved]).refundedCents).toBe(6000)
  expect(project([approved,one,event({...one,eventKey:'r1-conflict',occurredAt:'2026-10-24T02:00:00Z',refundedCents:3000})])).toEqual({state:'needs_review',reason:'refund_operation_conflict'})
 })
 it('não adivinha base de reembolso, valor ausente ou sobreposição em empate',()=>{
  const approved=event(),refund=event({eventKey:'refund',kind:'partially_refunded',occurredAt:'2026-10-24T01:00:00Z',refundedCents:2000})
  expect(project([approved,refund])).toEqual({state:'needs_review',reason:'refund_basis_unknown'})
  expect(projection([approved,event({...refund,refundedCents:null})]).refundedCents).toBeNull()
  const total=event({...refund,refundBasis:'cumulative'}),operation=event({...refund,eventKey:'operation',refundBasis:'operation',externalRefundId:'op'})
  expect(project([approved,total,operation])).toEqual({state:'needs_review',reason:'same_time_refund_overlap'})
 })
 it('não transforma chargeback em segundo reembolso nem infere recebimento',()=>{
  const refund=event({eventKey:'refund',kind:'refunded',occurredAt:'2026-10-24T01:00:00Z',refundedCents:10000,refundBasis:'cumulative'}),chargeback=event({eventKey:'cb',kind:'chargeback',occurredAt:'2026-10-24T02:00:00Z',chargebackCents:10000})
  const p=projection([event(),refund,chargeback]);expect(p.state).toBe('chargeback');expect(p.refundedCents).toBe(10000);expect(p.chargebackCents).toBe(10000);expect(p.refundAndChargebackOverlap).toBe(true);expect(p.settledCents).toBeNull()
 })
 it('não regride estados pagos/revertidos ou quantias acumuladas',()=>{
  const refund=event({eventKey:'refund',kind:'partially_refunded',occurredAt:'2026-10-24T01:00:00Z',refundedCents:2000,refundBasis:'cumulative'})
  expect(project([event(),event({eventKey:'later',kind:'pending',occurredAt:'2026-10-24T01:00:00Z'})])).toEqual({state:'needs_review',reason:'paid_state_regressed'})
  expect(project([refund,event({eventKey:'later',kind:'pending',occurredAt:'2026-10-24T02:00:00Z'})])).toEqual({state:'needs_review',reason:'reversal_state_regressed'})
  expect(project([refund,event({...refund,eventKey:'less',occurredAt:'2026-10-24T02:00:00Z',refundedCents:1000})])).toEqual({state:'needs_review',reason:'refund_total_regressed'})
 })
 it('não aceita excesso/overflow de devolução ou muta histórico fornecido',()=>{
  const history=[event(),event({eventKey:'refund',kind:'refunded',occurredAt:'2026-10-24T01:00:00Z',refundedCents:10001,refundBasis:'cumulative'})],before=JSON.stringify(history)
  expect(project(history)).toEqual({state:'needs_review',reason:'refund_exceeds_gross'});expect(JSON.stringify(history)).toBe(before)
  const big=event({grossCents:null}),op=event({grossCents:null,eventKey:'r1',kind:'partially_refunded',occurredAt:'2026-10-24T01:00:00Z',refundedCents:Number.MAX_SAFE_INTEGER,refundBasis:'operation',externalRefundId:'one'}),op2=event({...op,eventKey:'r2',externalRefundId:'two',occurredAt:'2026-10-24T02:00:00Z',refundedCents:1})
  expect(project([big,op,op2])).toEqual({state:'needs_review',reason:'money_overflow'})
 })
})

describe('reconciliação de operações com informação tardia',()=>{
 const missing=()=>event({eventKey:'missing',kind:'partially_refunded',occurredAt:'2026-10-24T01:00:00Z',refundedCents:null,refundBasis:'operation',externalRefundId:'operation'})
 const known=()=>event({...missing(),eventKey:'known',occurredAt:'2026-10-24T03:00:00Z',refundedCents:1000})
 const checkpoint=(amount:number)=>event({eventKey:'checkpoint',kind:'partially_refunded',occurredAt:'2026-10-24T02:00:00Z',refundedCents:amount,refundBasis:'cumulative'})
 it('preenche quantia desconhecida da mesma operação uma vez',()=>{
  expect(projection([event(),missing(),known(),event({...known(),eventKey:'repeat',occurredAt:'2026-10-24T04:00:00Z'})]).refundedCents).toBe(1000)
 })
 it('não soma operação que já estava coberta pelo total acumulado',()=>{
  expect(projection([event(),missing(),checkpoint(5000),known()]).refundedCents).toBe(5000)
 })
 it('detecta operação tardia incompatível com o checkpoint',()=>{
  expect(project([event(),missing(),checkpoint(500),known()])).toEqual({state:'needs_review',reason:'refund_checkpoint_conflict'})
 })
 it('notificação incompleta posterior não apaga valor conhecido da operação',()=>{
  expect(projection([event(),known(),event({...missing(),eventKey:'later-empty',occurredAt:'2026-10-24T04:00:00Z'})]).refundedCents).toBe(1000)
 })
})

describe('eventos autenticados fora do catálogo financeiro',()=>{
 it('prepara envelope ignorado sem inventar transação ou guardar comprador',async()=>{
  const value={...scope,eventKey:'unknown-event',kind:'ignored',eventType:'SUBSCRIPTION_CANCELLATION',occurredAt:null}
  const adapter={provider:'hotmart' as const,version:'synthetic-v1',verify:async()=>true,normalize:()=>value}
  const receipt=await prepareCommercialReceipt(adapter,scope,new Uint8Array(),new Headers())
  expect(receipt.state).toBe('prepared_ignored');if(receipt.state!=='prepared_ignored')throw new Error('invalid ignored fixture');expect(receipt).not.toHaveProperty('transactionKey');expect(receipt.event).not.toHaveProperty('externalTransactionId')
  expect((await prepareCommercialReceipt({...adapter,normalize:()=>({...value,buyer:{email:'synthetic@example.invalid'}})},scope,new Uint8Array(),new Headers())).state).toBe('invalid_event')
 })
 it('erro do normalizador é temporário, sem expor mensagem/segredo',async()=>{
  const result=await prepareCommercialReceipt({provider:'hotmart',version:'synthetic-v1',verify:async()=>true,normalize:()=>{throw new Error('synthetic-private')}},scope,new Uint8Array(),new Headers())
  expect(result).toEqual({state:'unavailable'});expect(JSON.stringify(result)).not.toContain('private')
 })
})


describe('valores explicitamente negativos',()=>{
 it('preserva crédito de taxa e líquido negativo sem inferir lucro ou caixa',()=>{
  const p=projection([event({feesCents:-100,producerNetCents:-50})])
  expect(p.feesCents).toBe(-100);expect(p.producerNetCents).toBe(-50);expect(p.settledCents).toBeNull()
  expect(parseCommercialEvent({...base,producerNetCents:Number.MIN_SAFE_INTEGER-1},scope).ok).toBe(false)
 })
})
