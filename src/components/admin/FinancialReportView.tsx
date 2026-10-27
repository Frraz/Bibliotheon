import type {AdminViewServerProps} from 'payload'
import {DefaultTemplate} from '@payloadcms/next/templates'
import {Gutter} from '@payloadcms/ui'
import {redirect} from 'next/navigation'
import Link from 'next/link'
import {FinancialDimensions} from './FinancialDimensions'
import {FinancialLedgerError,previewFinancialReport,type FinancialReportRequest} from '../../modules/commerce/financial-ledger'
import {commercialDate} from '../../modules/commerce/presentation'

type Report=Awaited<ReturnType<typeof previewFinancialReport>>
const scalar=(value:unknown)=>Array.isArray(value)?value[0]:value
const isDay=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
function amount(value:number|null,code:string){
 if(value===null)return 'Não informado'
 const cents=BigInt(value),negative=cents<0n,absolute=negative?-cents:cents,units=absolute/100n,minor=String(absolute%100n).padStart(2,'0')
 return `${negative?'−':''}${new Intl.NumberFormat('pt-BR').format(Number(units))},${minor} ${code}`
}
function reasonLabel(reason:string){return({reversal_amount_unknown:'Valor de reembolso ou chargeback desconhecido',refund_chargeback_overlap:'Possível sobreposição entre reembolso e chargeback',refund_chargeback_overlap_unknown:'Sobreposição entre reembolso e chargeback não conferida',gross_amount_unknown:'Bruto incompleto',fees_unknown:'Taxas incompletas',confirmed_cost_coverage_unknown:'Custos confirmados não informados',estimated_costs_present:'Há custos estimados',transactions_in_review:'Há transações em revisão',amount_overflow:'Um total excede o limite monetário seguro',taxes_not_recorded:'Tributos não registrados'} as Record<string,string>)[reason]||'Componente financeiro incompleto'}
function FinancialSummary({report,pages,currency,expanded}:{report:Report;pages:{provider:number;book:number;campaign:number};currency?:string;expanded?:'provider'|'book'|'campaign'}){
 return <>
  <p className="bibliotheon-financial-note">Prévia calculada em UTC e consultada em {commercialDate(report.observedAt)} (horário de Belém). Aprovações usam a data de aprovação; caixa e custos usam seus próprios períodos. A prévia não altera transações nem comprova homologação da fonte.</p>
  <p>{report.transactionApprovalDateCoverage.includedInWindow} transação(ões) pagas ou em revisão com data de aprovação dentro da janela; {report.transactionApprovalDateCoverage.inReviewIncluded} em revisão ficam fora dos valores confirmados. {report.transactionApprovalDateCoverage.missingDateExcluded} sem data de aprovação ficam fora das coortes, incluindo {report.transactionApprovalDateCoverage.inReviewMissingDateExcluded} em revisão. A falta de data impede atribuir essas transações a um período.</p>
  {!report.currencies.length?<p>Não há transações ou movimentos financeiros registrados para esta consulta.</p>:report.currencies.map(row=><section key={row.currency} aria-labelledby={`financial-${row.currency}`} className="bibliotheon-financial-currency">
   <h2 id={`financial-${row.currency}`}>{row.currency}</h2>
   <dl className="bibliotheon-financial-values">
    <div><dt>Aprovações na janela</dt><dd>{row.approvedTransactions}</dd></div>
    <div><dt>Transações em revisão</dt><dd>{row.transactionsInReview}</dd></div>
    <div><dt>Bruto aprovado</dt><dd>{amount(row.grossCents,row.currency)}<small>Valores conhecidos: {row.grossCoverage.known} de {row.grossCoverage.total}</small></dd></div>
    <div><dt>Reembolsos</dt><dd>{amount(row.refundedCents,row.currency)}<small>Valores conhecidos: {row.refundCoverage.known} de {row.refundCoverage.total}</small></dd></div>
    <div><dt>Chargebacks</dt><dd>{amount(row.chargebackCents,row.currency)}<small>Valores conhecidos: {row.chargebackCoverage.known} de {row.chargebackCoverage.total}</small></dd></div>
    <div><dt>Após reversões comprovadas</dt><dd>{amount(row.afterKnownReversalsCents,row.currency)}<small>Sobreposição conhecida: {row.refundChargebackOverlapTransactions}; não conferida: {row.refundChargebackOverlapUnknownTransactions}</small></dd></div>
    <div><dt>Taxas informadas</dt><dd>{amount(row.feesCents,row.currency)}<small>Valores conhecidos: {row.feeCoverage.known} de {row.feeCoverage.total}</small></dd></div>
    <div><dt>Líquido informado pelo provedor</dt><dd>{amount(row.producerNetReportedCents,row.currency)}<small>Valores conhecidos: {row.producerNetCoverage.known} de {row.producerNetCoverage.total}; não comprova recebimento</small></dd></div>
    <div><dt>Créditos menos débitos no período de liquidação</dt><dd>{amount(row.receivedCents,row.currency)}<small>{row.receivedCoverage.transactionsWithCashInPeriod} transação(ões) com movimento; {row.receivedCoverage.transactionsWithEvidence} da coorte de aprovação desta moeda, incluindo {row.receivedCoverage.transactionsInReviewWithEvidence} em revisão. Caixa usa a data do movimento.</small></dd></div>
    <div><dt>Custos confirmados no período de ocorrência</dt><dd>{amount(row.confirmedCostsCents,row.currency)}</dd></div>
    <div><dt>Custos estimados no período de ocorrência</dt><dd>{amount(row.estimatedCostsCents,row.currency)}</dd></div>
    <div><dt>Contribuição pré-tributos estimada</dt><dd>{amount(row.estimatedPreTaxContributionCents,row.currency)}</dd></div>
   </dl>
   <p>Custos: {row.costCoverage.confirmed} confirmados, {row.costCoverage.estimated} estimados e {row.costCoverage.shared} sem campanha. Margem completa: não. Esta prévia não declara lucro.</p>
   <p>{row.arithmeticOverflowFields.length?'Há totais que excedem o limite monetário seguro e aparecem como Não informado, mesmo com valores de origem conhecidos.':'Totais calculados dentro do limite monetário seguro.'}</p>
   <details className="bibliotheon-financial-details"><summary>Por que a margem está incompleta</summary><ul>{row.marginIncompleteReasons.map(reason=><li key={reason}>{reasonLabel(reason)}</li>)}</ul></details>
  </section>)}
  {report.cohorts.length>0&&<section aria-labelledby="financial-cohorts"><h2 id="financial-cohorts">Coortes por mês de aprovação</h2><p>Subtotais incluem somente valores conhecidos das transações sem revisão. A taxa só aparece quando o estado de reversão de toda a coorte é conhecido e nenhuma transação está em revisão. Uma compra com reembolso e chargeback conta uma vez na taxa.</p><p>A idade mostra dias observados desde as aprovações, na consulta UTC {report.observedAt}. Não certifica encerramento: a janela de reversão do provedor ainda não foi homologada. O mês representa apenas a parte incluída no período consultado.</p><div className="bibliotheon-financial-table-wrap" role="region" aria-label="Tabela de coortes financeiras" tabIndex={0}><table className="bibliotheon-financial-table"><caption>Transações por mês de aprovação e moeda, com cobertura e idade observada</caption><thead><tr><th scope="col">Moeda</th><th scope="col">Mês UTC</th><th scope="col">Transações</th><th scope="col">Sem revisão</th><th scope="col">Em revisão</th><th scope="col">Bruto conhecido</th><th scope="col">Cobertura bruto</th><th scope="col">Reembolsos conhecidos</th><th scope="col">Chargebacks conhecidos</th><th scope="col">Reversões sem valor</th><th scope="col">Compras com reversão</th><th scope="col">Cobertura estado</th><th scope="col">Taxa de reversão</th><th scope="col">Idade mínima (dias)</th><th scope="col">Totais fora do limite</th></tr></thead><tbody>{report.cohorts.map((cohort,index)=><tr key={`${cohort.currency}-${cohort.approvedMonth}-${index}`}><th scope="row">{cohort.currency}</th><td>{cohort.approvedMonth}</td><td>{cohort.transactions}</td><td>{cohort.verifiedTransactions}</td><td>{cohort.transactionsInReview}</td><td>{amount(cohort.grossKnownCents,cohort.currency)}</td><td>{cohort.grossCoverage.known}/{cohort.grossCoverage.total}</td><td>{amount(cohort.refundKnownCents,cohort.currency)}</td><td>{amount(cohort.chargebackKnownCents,cohort.currency)}</td><td>{cohort.unknownReversalTransactions}</td><td>{cohort.reversedTransactions}</td><td>{cohort.reversalCoverage.known}/{cohort.reversalCoverage.total}</td><td>{cohort.reversalRate===null?'Não informado':new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:2}).format(cohort.reversalRate)}</td><td>{cohort.maturity.youngestApprovalAgeDays??'Não informado'}</td><td>{cohort.arithmeticOverflowFields.length?'Sim; valores não informados':'Nenhum'}</td></tr>)}</tbody></table></div></section>}
  <FinancialDimensions report={report} pages={pages} currency={currency} expanded={expanded}/>
 </>
}

export async function FinancialReportView({initPageResult,params,searchParams,user}:AdminViewServerProps){
 const {req}=initPageResult
 if(req.user?.collection!=='admin-users'||req.user.role!=='owner')redirect('/admin/login')
 const query=searchParams||{},today=new Date().toISOString().slice(0,10),defaultFrom=`${today.slice(0,7)}-01`,rawFrom=scalar(query.from),rawThrough=scalar(query.through),rawCurrency=scalar(query.currency)
 const dimensionPage=(value:unknown)=>typeof value==='string'&&/^[1-9]\d{0,4}$/.test(value)?Number(value):1
 const detail=scalar(query.detail),expanded=detail==='provider'||detail==='book'||detail==='campaign'?detail:undefined
 const pages={provider:dimensionPage(scalar(query.providerPage)),book:dimensionPage(scalar(query.bookPage)),campaign:dimensionPage(scalar(query.campaignPage))}
 const request:FinancialReportRequest={from:isDay(rawFrom)?rawFrom:defaultFrom,through:isDay(rawThrough)?rawThrough:today,...(typeof rawCurrency==='string'&&rawCurrency?{currency:rawCurrency.toUpperCase()}:{})}
 let report:Report|null=null,error:string|null=null
 try{report=await previewFinancialReport(req.payload,req.user,request)}catch(cause){error=cause instanceof FinancialLedgerError&&cause.status===422?'Confira o período e a moeda. A prévia aceita até 366 dias e não aceita datas futuras.':'Não foi possível carregar a prévia. Nenhum dado foi alterado.'}
 return <DefaultTemplate i18n={req.i18n} locale={initPageResult.locale} params={params} payload={req.payload} permissions={initPageResult.permissions} visibleEntities={initPageResult.visibleEntities} searchParams={searchParams} user={user}><Gutter className="bibliotheon-dashboard bibliotheon-financial-report"><header><p className="bibliotheon-kicker">Conciliação e resultados</p><h1>Prévia financeira</h1><p>Confira aprovação, reversões, recebimentos e custos sem tratar dados ausentes como zero.</p></header>
  <section aria-labelledby="financial-period"><h2 id="financial-period">Período da consulta</h2><p>Use a mesma janela UTC para três dimensões distintas: aprovação, liquidação e ocorrência de custo.</p><form className="bibliotheon-operational-form bibliotheon-financial-filters" action="/admin/financial-ledger" method="get"><fieldset><legend>Filtros da prévia</legend><div className="bibliotheon-financial-filter-grid"><label htmlFor="financial-from">De (UTC)<input id="financial-from" name="from" type="date" defaultValue={request.from} required/></label><label htmlFor="financial-through">Até (UTC)<input id="financial-through" name="through" type="date" defaultValue={request.through} required/></label><label htmlFor="financial-currency">Moeda (opcional)<input id="financial-currency" name="currency" type="text" inputMode="text" autoCapitalize="characters" pattern="[A-Za-z]{3}" maxLength={3} defaultValue={request.currency||''} aria-describedby="financial-currency-help"/></label></div><p id="financial-currency-help">Informe o código de três letras, como BRL. Moedas nunca são convertidas.</p><button type="submit">Atualizar prévia</button></fieldset></form></section>
  <section aria-labelledby="financial-preview"><h2 id="financial-preview">Resultados provisórios</h2>{error?<p role="alert">{error}</p>:report?<FinancialSummary report={report} pages={pages} currency={request.currency} expanded={expanded}/>:<p role="status">A prévia não está disponível.</p>}</section>
  <p><Link href="/admin/financial-records">Registrar liquidações e custos</Link> · <Link href="/admin/commercial-inbox">Acompanhar eventos comerciais</Link> · <Link href="/admin">Voltar ao painel</Link></p>
 </Gutter></DefaultTemplate>
}
