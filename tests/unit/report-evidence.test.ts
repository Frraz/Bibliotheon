import {restoreReportEvidence} from '../../src/modules/commerce/report-evidence'
import type {CommercialReportEvidence} from '../../src/payload-types'
import {describe,it,expect} from 'vitest'
import {prepareReportEvidence,reportEvidenceBlockers,type ReportEvidenceInput} from '../../src/modules/commerce/report-evidence-schema'
import {assessTransactionReview,type ReviewContext, type ReviewChoice} from '../../src/modules/commerce/transaction-review'
import {commercialTransactionKey,commercialEventDigest} from '../../src/modules/commerce/events'
import {parseReportEvidenceCSV,reportEvidenceCSVHeaders} from '../../src/modules/commerce/report-evidence-csv'
const input:ReportEvidenceInput={provider:'hotmart',accountKey:'synthetic',externalTransactionId:'tx-report',externalProductId:'product',externalOfferId:null,kind:'approved',occurredAt:'2026-10-20T00:00:00.000Z',approvedAt:'2026-10-20T00:00:00.000Z',currency:'BRL',grossCents:10000,refundedCents:null,chargebackCents:null,feesCents:null,producerNetCents:null,refundBasis:null,externalRefundId:null,sourceKind:'provider_report',sourceReference:'synthetic-report',recordReference:'synthetic-row',replaces:[],evidenceVerified:true}
const id='00000000-0000-0000-0000-000000000001'
function plan(value:ReportEvidenceInput){const p=prepareReportEvidence(value),scope={provider:value.provider,accountKey:value.accountKey},context:ReviewContext={scope,transactionScopes:[{key:commercialTransactionKey(p.event),externalTransactionId:p.event.externalTransactionId}],receipts:[{kind:'report',id,key:'report:'+p.key,state:'evidence',conflicted:false,receivedAt:value.occurredAt,startedAt:null,variants:[{id,hash:p.envelopeHash,adapterVersion:'owner-financial-evidence-v1',receivedAt:value.occurredAt,source:'report',event:p.event,report:{sourceKind:value.sourceKind,sourceReference:value.sourceReference,recordReference:value.recordReference,replaces:value.replaces}}]}],transactions:[],catalog:[{id:'offer',...scope,externalProductId:'product',ebook:'book'}],catalogDecisions:[]},choice:ReviewChoice={...scope,externalTransactionId:value.externalTransactionId,action:'reconcile',selections:[{inboxId:id,envelopeHash:p.envelopeHash,reason:'source_confirmed'}]};return assessTransactionReview(context,choice)}
describe('Evidência canônica do operador',()=>{
 it('interpreta apenas o CSV canônico versionado, preserva prova de aprovação/reversão e não ecoa entradas inválidas',()=>{
  const values=['hotmart','synthetic','csv-evidence-tx','product','', 'partially_refunded','2026-10-21T00:00:00Z','2026-10-20T00:00:00Z','BRL','10000','2000','','500','7500','cumulative','','csv-line-one','[]']
  const csv=(row:readonly string[])=>Buffer.from([reportEvidenceCSVHeaders,row].map(items=>items.map(value=>/[",\r\n]/.test(value)?'"'+value.replaceAll('"','""')+'"':value).join(',')).join('\r\n')+'\r\n')
  const parsed=parseReportEvidenceCSV(csv(values),{sourceKind:'provider_report',sourceReference:'synthetic-report'})
  expect(parsed.lines).toHaveLength(1);expect(parsed.lines[0].ok).toBe(true)
  if(parsed.lines[0].ok){expect(parsed.lines[0].input.approvedAt).toBe('2026-10-20T00:00:00.000Z');expect(parsed.lines[0].input.refundBasis).toBe('cumulative');expect(parsed.lines[0].input.refundedCents).toBe(2000);expect(parsed.lines[0].input.evidenceVerified).toBe(true)}
  const malformed=parseReportEvidenceCSV(csv(values.map((value,index)=>index===17?'not-json':value)),{sourceKind:'provider_report',sourceReference:'synthetic-report'})
  expect(malformed.lines[0].ok).toBe(false);if(!malformed.lines[0].ok)expect(malformed.lines[0].code).toBe('invalid_replacements')
  expect(()=>parseReportEvidenceCSV(Buffer.from('provider,account_key,transaction_id\n'),{sourceKind:'provider_report',sourceReference:'synthetic-report'})).toThrow('invalid_header')
  expect(()=>parseReportEvidenceCSV(Buffer.from([reportEvidenceCSVHeaders,...Array.from({length:21},()=>values)].map(row=>row.join(',')).join('\n')),{sourceKind:'provider_report',sourceReference:'synthetic-report'})).toThrow('too_many_rows')
 })
 it('aceita os estados suportados e preserva seus campos de aprovação e reversão sem inferência',()=>{
  const rows=[
   ['pending','','','','',''],['approved','2026-10-20T00:00:00Z','10000','','',''],['refused','','','','',''],['canceled','','10000','','',''],
   ['partially_refunded','2026-10-20T00:00:00Z','10000','2000','','cumulative'],['refunded','2026-10-20T00:00:00Z','10000','10000','','cumulative'],['chargeback','2026-10-20T00:00:00Z','10000','','10000','']
  ].map(([kind,approved,gross,refunded,chargeback,basis],index)=>['hotmart','synthetic',`csv-state-${index}`,'product','',kind,'2026-10-21T00:00:00Z',approved,'BRL',gross,refunded,chargeback,'','',''+basis,'',`csv-state-line-${index}`,'[]'])
  const csv=Buffer.from([reportEvidenceCSVHeaders,...rows].map(items=>items.join(',')).join('\r\n')+'\r\n'),parsed=parseReportEvidenceCSV(csv,{sourceKind:'provider_report',sourceReference:'synthetic-report'})
  expect(parsed.lines).toHaveLength(7);expect(parsed.lines.every(line=>line.ok)).toBe(true)
  expect(parsed.lines.map(line=>line.ok&&line.input.kind)).toEqual(['pending','approved','refused','canceled','partially_refunded','refunded','chargeback'])
  if(parsed.lines[4].ok)expect(parsed.lines[4].input).toMatchObject({approvedAt:'2026-10-20T00:00:00.000Z',grossCents:10000,refundedCents:2000,refundBasis:'cumulative'})
  if(parsed.lines[6].ok)expect(parsed.lines[6].input).toMatchObject({approvedAt:'2026-10-20T00:00:00.000Z',grossCents:10000,chargebackCents:10000})
 })
 it('normaliza ordem e datas, mantém null e não assume autenticação nativa',()=>{const p=prepareReportEvidence(input),q=prepareReportEvidence({...input,occurredAt:'2026-10-20T00:00:00Z'});expect(p).toEqual(q);expect(p.event.externalClickReference).toBeNull();expect(p.event.sourceEvent).toBe('owner-financial-evidence-v1');expect(plan(input).processable).toBe(true)})
 it('nega conteúdo extra, ator, recebimento e dados pessoais na referência',()=>{for(const change of [{actor:id},{settledCents:10000},{buyer:'person'},{sourceReference:'buyer@example.invalid'},{evidenceVerified:false},{grossCents:0.5},{approvedAt:'invalid'}])expect(()=>prepareReportEvidence({...input,...change})).toThrow()})
 it('cada linha do relatório tem identidade independente do valor e hash da intenção',()=>{const a=prepareReportEvidence(input),b=prepareReportEvidence({...input,grossCents:20000});expect(a.key).toBe(b.key);expect(a.requestHash).not.toBe(b.requestHash);expect(a.envelopeHash).not.toBe(b.envelopeHash)})
 it('aprovação desconhecida não é fabricada para snapshots pagos',()=>{expect(plan({...input,approvedAt:null}).blockers).toContain('report_approval_evidence_required');expect(plan({...input,grossCents:null}).processable).toBe(false)})
 it('reembolso exige valor e base explícitos, com identidade de operação',()=>{expect(plan({...input,kind:'refunded'}).blockers).toContain('report_refund_evidence_required');expect(()=>prepareReportEvidence({...input,kind:'refunded',refundBasis:'operation',refundedCents:1000})).toThrow();expect(plan({...input,kind:'partially_refunded',refundBasis:'operation',externalRefundId:'refund-1',refundedCents:1000}).processable).toBe(true)})
 it('chargeback desconhecido não vira perda de zero',()=>{expect(plan({...input,kind:'chargeback'}).blockers).toContain('report_chargeback_evidence_required');expect(plan({...input,kind:'chargeback',chargebackCents:10000}).processable).toBe(true)})
 it('mantém ausência de liquidação e recusa provas contraditórias',()=>{const p=plan({...input,kind:'refunded',refundedCents:10001,refundBasis:'cumulative'});expect(p.processable).toBe(false);const good=plan(input).outcomes[0];if(good.state==='projected')expect(good.projection.settledCents).toBeNull();expect(reportEvidenceBlockers(prepareReportEvidence({...input,approvedAt:'2026-10-21T00:00:00Z'}).event)).toContain('report_approval_after_event')})
 it('não aceita referências repetidas nem namespace de referência arbitrário',()=>{for(const replaces of [[{kind:'native',id},{kind:'report',id}],[{kind:'other',id}],[{kind:'native',id:'not-uuid'}]])expect(()=>prepareReportEvidence({...input,replaces})).toThrow()})
 it('combina aprovação nativa comprovada com reembolso de relatório sem inventar data',()=>{
  const initial=plan({...input,kind:'partially_refunded',occurredAt:'2026-10-21T00:00:00.000Z',approvedAt:null,refundedCents:2000,refundBasis:'cumulative'}),native=prepareReportEvidence(input),nativeId='00000000-0000-0000-0000-000000000002'
  native.event.eventKey='synthetic-native-approved';native.envelopeHash=commercialEventDigest(native.event)
  initial.context.receipts.push({id:nativeId,key:'native-approval',state:'applied',conflicted:false,receivedAt:input.occurredAt,startedAt:null,variants:[{id:nativeId,hash:native.envelopeHash,adapterVersion:'synthetic',receivedAt:input.occurredAt,source:'original',event:native.event}]})
  const result=assessTransactionReview(initial.context,{...initial.choice,selections:[...initial.choice.selections,{inboxId:nativeId,envelopeHash:native.envelopeHash,reason:'source_confirmed'}]})
  expect(result.processable).toBe(true)
 })
 it('status de reembolso do relatório deve concordar com o total comprovado',()=>{
  expect(plan({...input,kind:'refunded',refundedCents:2000,refundBasis:'cumulative'}).blockers).toContain('report_refund_state_conflict')
  expect(plan({...input,kind:'partially_refunded',refundedCents:10000,refundBasis:'cumulative'}).processable).toBe(false)
  expect(plan({...input,kind:'refunded',refundedCents:10000,refundBasis:'cumulative'}).processable).toBe(true)
 })

 it('revalida prova persistida sem depender da ordem de chaves JSONB',()=>{
  const p=prepareReportEvidence(input),row:CommercialReportEvidence={id,key:p.key,requestHash:p.requestHash,provider:input.provider,accountKey:input.accountKey,externalTransactionId:input.externalTransactionId,transactionKey:p.transactionKey,transactionKeys:[p.transactionKey],relatedTransactionIds:[input.externalTransactionId],input:Object.fromEntries(Object.entries(p.input).reverse()),envelope:Object.fromEntries(Object.entries(p.event).reverse()),envelopeHash:p.envelopeHash,version:'owner-financial-evidence-v1',actor:id,recordedAt:input.occurredAt,createdAt:input.occurredAt,updatedAt:input.occurredAt}
  expect(restoreReportEvidence(row)).toEqual(p)
  expect(()=>restoreReportEvidence({...row,envelope:{...p.event,grossCents:1}})).toThrow('report_evidence_integrity')
  expect(()=>restoreReportEvidence({...row,input:{...p.input,grossCents:1}})).toThrow('report_evidence_integrity')
 })
 it('isola a identidade da linha por provedor e conta',()=>{
  const keys=new Set(['hotmart','kiwify','cakto'].flatMap(provider=>['synthetic','other'].map(accountKey=>prepareReportEvidence({...input,provider,accountKey}).key)))
  expect(keys.size).toBe(6)
 })

})
