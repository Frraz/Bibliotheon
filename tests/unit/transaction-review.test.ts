import {replayFinancialChoice,financialCoverage} from '../../src/modules/commerce/financial-resolutions'
import type {FinancialHead} from '../../src/modules/commerce/financial-store'
import {describe,it,expect} from 'vitest'
import {assessTransactionReview,reviewChoice,type ReviewContext,type ReviewChoice,type ReviewVariant} from '../../src/modules/commerce/transaction-review'
import {commercialEventDigest,commercialEventKey,commercialTransactionKey,type NormalizedCommercialEvent} from '../../src/modules/commerce/events'
const event=(more:Partial<NormalizedCommercialEvent>={}):NormalizedCommercialEvent=>({provider:'hotmart',accountKey:'synthetic',eventKey:'event-a',externalTransactionId:'tx-a',externalProductId:'product',externalOfferId:null,kind:'approved',occurredAt:'2026-10-20T00:00:00.000Z',approvedAt:'2026-10-20T00:00:00.000Z',currency:'BRL',grossCents:10000,refundedCents:null,feesCents:null,producerNetCents:null,chargebackCents:null,externalClickReference:null,refundBasis:null,externalRefundId:null,...more})
const first=event(),second=event({externalTransactionId:'tx-b',grossCents:20000}),ids=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002']
const variant=(e:NormalizedCommercialEvent,id:string):ReviewVariant=>({id,source:'original',hash:commercialEventDigest(e),adapterVersion:'synthetic:1',receivedAt:e.occurredAt,event:e})
const context=(other=second):ReviewContext=>({scope:{provider:first.provider,accountKey:first.accountKey},transactionScopes:[...new Map([first,other].map(e=>[commercialTransactionKey(e),{key:commercialTransactionKey(e),externalTransactionId:e.externalTransactionId}])).values()],receipts:[{id:ids[0],key:commercialEventKey(first),state:'applied',conflicted:true,receivedAt:first.occurredAt,startedAt:null,variants:[variant(first,ids[0]),variant(other,ids[1])]}],transactions:[],catalog:[{id:'offer',...first,ebook:'book'}],catalogDecisions:[]})
const choice=(hash:string|null=commercialEventDigest(second)):ReviewChoice=>({provider:first.provider,accountKey:first.accountKey,externalTransactionId:first.externalTransactionId,action:'reconcile',selections:[{inboxId:ids[0],envelopeHash:hash,reason:hash?'source_confirmed':'source_rejected'}]})
describe('Plano de revisão por componente de colisão',()=>{
 it('escolhe só uma variante da chave compartilhada e conserva desconhecidos',()=>{
  const plan=assessTransactionReview(context(),choice())
  expect(plan.processable).toBe(true);expect(plan.committable).toBe(false)
  const projected=plan.outcomes.filter(row=>row.state==='projected');expect(projected).toHaveLength(1)
  if(projected[0].state==='projected'){expect(projected[0].projection.externalTransactionId).toBe('tx-b');expect(projected[0].projection.grossCents).toBe(20000);expect(projected[0].projection.producerNetCents).toBeNull();expect(projected[0].projection.settledCents).toBeNull()}
  expect(plan.outcomes.find(row=>row.externalTransactionId==='tx-a')).toMatchObject({state:'needs_review',reason:'no_verified_facts'})
 })
 it('não permite selecionar dois lados nem fingir cobertura',()=>{
  expect(()=>reviewChoice({...choice(),selections:[...choice().selections,...choice().selections]})).toThrow()
  const plan=assessTransactionReview(context(),{...choice(),selections:[]});expect(plan.blockers).toContain('selection_coverage_required');expect(plan.processable).toBe(false)
  expect(()=>assessTransactionReview(context(),choice('a'.repeat(64)))).toThrow('unknown_review_selection')
 })
 it('hold mantém incerteza sem transformar exclusão de tudo em zero',()=>{
  const held=assessTransactionReview(context(),{...choice(),action:'hold',selections:[]});expect(held.processable).toBe(true);expect(held.outcomes.every(row=>row.state==='needs_review')).toBe(true)
  expect(assessTransactionReview(context(),choice(null)).blockers).toContain('no_verified_projection')
 })
 it('escolha não inventa prova financeira nem oculta reversão sem suporte',()=>{
  const unsupported=event({reviewReason:'unknown_event_time'}),plan=assessTransactionReview(context(unsupported),choice(commercialEventDigest(unsupported)))
  expect(plan.processable).toBe(false);expect(plan.blockers).toContain('projection_requires_review')
  const reversed=event({kind:'refunded',refundedCents:1000,refundBasis:null})
  expect(assessTransactionReview(context(reversed),choice(commercialEventDigest(reversed))).processable).toBe(false)
 })
 it('recibo ignorado não pode ser escolhido como fato financeiro',()=>{
  const ctx=context(),hash='a'.repeat(64)
  ctx.receipts[0].variants.push({id:'ignored',hash,adapterVersion:'synthetic:1',receivedAt:first.occurredAt,source:'conflict',event:{provider:'hotmart',accountKey:'synthetic',eventKey:'event-a',kind:'ignored',eventType:'fixture.ignored',occurredAt:null}})
  const plan=assessTransactionReview(ctx,choice(hash));expect(plan.processable).toBe(false);expect(plan.blockers).toContain('ignored_is_not_financial')
 })
 it('seleção explícita cobre diferenças de produto, moeda, datas, estados e valores',()=>{
  for(const more of [{grossCents:9000},{currency:'USD'},{kind:'canceled' as const,approvedAt:null},{occurredAt:'2026-10-21T00:00:00.000Z'},{externalProductId:'correct-product'}]){
   const corrected=event(more),ctx=context(corrected);ctx.catalog.push({...ctx.catalog[0],externalProductId:corrected.externalProductId})
   const plan=assessTransactionReview(ctx,choice(commercialEventDigest(corrected)));expect(plan.processable).toBe(true)
   expect(ctx.receipts[0].variants[0].event).toEqual(first)
  }
 })
 it('não usa livro desconhecido, lease ativo ou instante futuro como aceite',()=>{
  const ctx=context();ctx.catalog=[];expect(assessTransactionReview(ctx,choice()).blockers).toContain('catalog_requires_review')
  const active=context();active.receipts[0].state='processing';active.receipts[0].startedAt=new Date().toISOString();expect(assessTransactionReview(active,choice()).blockers).toContain('processing_active')
  const future=event({occurredAt:'2099-01-01T00:00:00.000Z'});expect(assessTransactionReview(context(future),choice(commercialEventDigest(future))).blockers).toContain('future_event_time')
 })
 it('não aceita ator, dinheiro ou razão livre no corpo de revisão',()=>{
  const input={provider:'hotmart',accountKey:'synthetic',externalTransactionId:'tx-a',action:'hold',selections:[]}
  expect(reviewChoice(input)).toEqual(input)
  for(const extra of [{actor:'forged'},{grossCents:0},{buyer:'private'}])expect(()=>reviewChoice({...input,...extra})).toThrow()
  expect(()=>assessTransactionReview(context(),{...choice(),accountKey:'other'})).toThrow('review_scope_mismatch')
 })
})

describe('Continuidade de decisão financeira',()=>{
 const head=(ctx=context()):FinancialHead=>({id:'financial-head',...ctx.scope,revision:1,action:'reconcile',transactionKeys:ctx.transactionScopes.map(row=>row.key),choice:choice(),coverage:financialCoverage(ctx,choice())})
 it('reaplica somente as escolhas cobertas e adiciona fonte nativa limpa',()=>{
  const ctx=context(),baseline=head(ctx),next=event({eventKey:'refund-new',externalTransactionId:'tx-b',kind:'refunded',refundedCents:1000,refundBasis:'operation',externalRefundId:'refund'})
  ctx.financialHeads=[{id:baseline.id,revision:1,transactionKeys:baseline.transactionKeys}]
  ctx.receipts.push({id:ids[1],key:commercialEventKey(next),state:'pending',conflicted:false,startedAt:null,receivedAt:next.occurredAt,variants:[variant(next,ids[1])]})
  expect(replayFinancialChoice(baseline,ctx).selections).toHaveLength(2)
 })
 it('não reaproveita decisão para variante nova ou componente ampliado',()=>{
  const ctx=context(),baseline=head(ctx);ctx.receipts[0].variants.push(variant(event({grossCents:9000}),ids[1]))
  expect(()=>replayFinancialChoice(baseline,ctx)).toThrow('financial_evidence_changed')
  const other=context();other.transactionScopes.push({key:'new',externalTransactionId:'new'})
  expect(()=>replayFinancialChoice(baseline,other)).toThrow('financial_component_changed')
 })
 it('não usa escolha de decisão substituída ou hold como aplicação automática',()=>{
  const ctx=context(),baseline=head(ctx);ctx.financialHeads=[{id:'other',revision:2,transactionKeys:baseline.transactionKeys}]
  expect(()=>replayFinancialChoice(baseline,ctx)).toThrow('financial_component_changed')
  expect(()=>replayFinancialChoice({...baseline,action:'hold',choice:{...choice(),action:'hold',selections:[]}},context())).toThrow('financial_resolution_hold')
 })
 it('nova fonte conflitante exige confirmação integral posterior',()=>{
  const ctx=context(),baseline=head(ctx),extra=event({eventKey:'new-event'})
  ctx.receipts.push({id:ids[1],key:commercialEventKey(extra),state:'pending',conflicted:true,startedAt:null,receivedAt:extra.occurredAt,variants:[variant(extra,ids[1])]})
  expect(()=>replayFinancialChoice(baseline,ctx)).toThrow('financial_evidence_changed')
 })
 it('lease incompleta bloqueia reconcile e hold',()=>{
  const ctx=context();ctx.receipts[0].state='processing';ctx.receipts[0].startedAt=null
  for(const input of [choice(),{...choice(),action:'hold' as const,selections:[]}])expect(assessTransactionReview(ctx,input).blockers).toContain('processing_active')
 })
})
