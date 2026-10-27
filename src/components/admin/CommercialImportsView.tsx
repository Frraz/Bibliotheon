import type {AdminViewServerProps} from 'payload'
import {DefaultTemplate} from '@payloadcms/next/templates'
import {Gutter} from '@payloadcms/ui'
import {redirect} from 'next/navigation'
import Link from 'next/link'
import {commercialCSVHeaders, CSV_MAX_BYTES, CSV_MAX_ROWS} from '../../modules/commerce/csv'
import {reportEvidenceCSVHeaders, REPORT_EVIDENCE_CSV_MAX_BYTES, REPORT_EVIDENCE_CSV_MAX_ROWS} from '../../modules/commerce/report-evidence-csv'
import {importClassificationLabels, importKindLabels, importReasonLabel, importStateLabels, type ImportKind} from '../../modules/commerce/import-presentation'
import {commercialDate} from '../../modules/commerce/presentation'
import {CommercialImportConfirmation, CommercialImportForm} from './CommercialImportActions'

const scalar = (value: unknown) => Array.isArray(value) ? value[0] : value
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const batchURL = (id: string, page = 1) => `/admin/commercial-imports?batch=${id}&page=${page}`
function RowDetails({value}: {value: unknown}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return <p>Identidade indisponível; confira o registro de origem.</p>
  const row = value as Record<string, unknown>
  const statuses: Record<string, string> = {pending: 'Pendente', approved: 'Aprovado', partially_refunded: 'Parcialmente reembolsado', refunded: 'Reembolsado', chargeback: 'Chargeback', refused: 'Recusado', canceled: 'Cancelado', unknown: 'Desconhecido'}
  const text = (field: string) => typeof row[field] === 'string' && row[field] ? String(row[field]) : 'Não informado'
  const replacements = Array.isArray(row.replaces) ? row.replaces.filter((item): item is {kind: string; id: string} => !!item && typeof item === 'object' && typeof item.kind === 'string' && typeof item.id === 'string') : []
  return <><dl className="bibliotheon-commercial-facts">{[['provider', 'Provedor'], ['accountKey', 'Conta'], ['externalTransactionId', 'Transação'], ['externalProductId', 'Produto'], ['externalOfferId', 'Oferta'], ['currency', 'Moeda']].map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{text(field)}</dd></div>)}
    <div><dt>Estado informado</dt><dd>{statuses[String(row.kind || row.status)] || 'Não informado'}</dd></div><div><dt>Ocorrência (UTC)</dt><dd>{text('occurredAt')}</dd></div>{Object.hasOwn(row, 'approvedAt') && <div><dt>Aprovação original (UTC)</dt><dd>{text('approvedAt')}</dd></div>}
    {([['grossCents', 'Bruto'], ['refundedCents', 'Reembolsado'], ['chargebackCents', 'Chargeback'], ['feesCents', 'Taxas'], ['producerNetCents', 'Líquido do provedor'], ['settledCents', 'Liquidado informado no snapshot']] as const).filter(([field]) => Object.hasOwn(row, field)).map(([field, label]) => <div key={field}><dt>{label} (centavos)</dt><dd>{typeof row[field] === 'number' && Number.isSafeInteger(row[field]) ? new Intl.NumberFormat('pt-BR').format(row[field] as number) : 'Não informado'}</dd></div>)}
    {Object.hasOwn(row, 'recordReference') && <><div><dt>Referência da linha</dt><dd>{text('recordReference')}</dd></div><div><dt>Base do reembolso</dt><dd>{row.refundBasis === 'cumulative' ? 'Acumulado' : row.refundBasis === 'operation' ? 'Operação individual' : 'Não informado'}</dd></div><div><dt>Operação de reembolso</dt><dd>{text('externalRefundId')}</dd></div></>}
  </dl>{Object.hasOwn(row, 'replaces') && <><p>Fontes substituídas por esta evidência:</p>{replacements.length ? <ul>{replacements.map(item => <li key={item.id}>{item.kind === 'native' ? 'Evento nativo' : 'Evidência complementar'} · {item.id}</li>)}</ul> : <p>Nenhuma substituição declarada.</p>}</>}<p>Valores vazios permanecem desconhecidos. Líquido do provedor e campo de liquidação do snapshot não comprovam recebimento.</p></>
}

export async function CommercialImportsView({initPageResult, params, searchParams, user}: AdminViewServerProps) {
  const {req} = initPageResult
  if (req.user?.collection !== 'admin-users' || req.user.role !== 'owner') redirect('/admin/login')
  const rawID = scalar(searchParams?.batch), rawPage = scalar(searchParams?.page), page = typeof rawPage === 'string' && /^[1-9]\d{0,2}$/.test(rawPage) ? Number(rawPage) : 1
  const templates = {snapshot: {header: commercialCSVHeaders.join(','), maxBytes: CSV_MAX_BYTES, maxRows: CSV_MAX_ROWS}, report_evidence: {header: reportEvidenceCSVHeaders.join(','), maxBytes: REPORT_EVIDENCE_CSV_MAX_BYTES, maxRows: REPORT_EVIDENCE_CSV_MAX_ROWS}}
  async function content() {
    const recent = await req.payload.find({collection: 'commercial-import-batches', overrideAccess: false, req, depth: 0, limit: 20, sort: '-stagedAt', select: {kind: true, sourceReference: true, state: true, rowCount: true, stagedAt: true}})
    const batch = uuid(rawID) ? await req.payload.findByID({collection: 'commercial-import-batches', id: rawID, overrideAccess: false, req, depth: 0, disableErrors: true}) : null
    const [rows, audit] = batch ? await Promise.all([
      req.payload.find({collection: 'commercial-import-rows', where: {batch: {equals: batch.id}}, overrideAccess: false, req, depth: 0, sort: 'line', limit: 50, page, select: {line: true, classification: true, reason: true, state: true, duplicateOf: true, normalized: true}}),
      req.payload.find({collection: 'commercial-import-audit', where: {batch: {equals: batch.id}}, overrideAccess: false, req, depth: 0, sort: '-occurredAt', limit: 20, select: {action: true, occurredAt: true, reason: true}}),
    ]) : [null, null]
    return <>
      {rawID && !batch && <p role="alert">Lote não encontrado. Abra um lote recente ou confira o identificador do endereço.</p>}
      {batch && rows && <section aria-labelledby="import-batch-heading"><h2 id="import-batch-heading">Lote em conferência</h2><p className="bibliotheon-import-identifier">Identificador: {batch.id}</p>
        <dl className="bibliotheon-commercial-facts"><div><dt>Contrato</dt><dd>{importKindLabels[batch.kind as ImportKind] || 'Contrato desconhecido'}</dd></div><div><dt>Referência</dt><dd>{batch.sourceReference}</dd></div><div><dt>Origem</dt><dd>{batch.sourceKind === 'provider_report' ? 'Relatório do provedor' : 'Conciliação manual'}</dd></div><div><dt>Motivo</dt><dd>{batch.reason === 'missing_webhook' ? 'Evento não recebido' : 'Conferência de relatório'}</dd></div><div><dt>Preparado em (Belém)</dt><dd>{commercialDate(batch.stagedAt)}</dd></div><div><dt>Linhas registradas</dt><dd>{batch.rowCount}</dd></div></dl>
        <p>Estado salvo: <strong>{importStateLabels[batch.state] || 'Exige conferência'}</strong>. {batch.kind === 'report_evidence' ? 'Registrar evidência exige uma decisão posterior para aplicar valores.' : 'Confirmar pode enfileirar fatos que ainda precisarão de processamento e revisão do resultado.'}</p>
        <p><a href={batchURL(batch.id, page)}>Atualizar estado e linhas</a></p>
        {batch.state === 'blocked' && <p role="status">A confirmação está bloqueada. Resolva as causas das linhas e prepare um novo lote; esta trilha será preservada.</p>}
        {batch.state === 'stale' && <p role="status">O histórico mudou depois da preparação. Consulte uma nova prévia e prepare outro lote após conferir as evidências atuais.</p>}
        <h3>Linhas do plano persistido</h3>
        <ol className="bibliotheon-import-lines" start={(page - 1) * 50 + 1}>{rows.docs.map(row => <li key={row.id}><strong>Linha {row.line} · {importClassificationLabels[row.classification] || 'Exige conferência'}</strong><p>{importReasonLabel(row.reason)}{row.duplicateOf ? ` Repetição da linha ${row.duplicateOf}.` : ''} Estado da linha: {importStateLabels[row.state] || 'Exige conferência'}.</p><details><summary>Conferir dados da linha {row.line}</summary><RowDetails value={row.normalized}/></details></li>)}</ol>
        {!rows.docs.length && <p>Nenhuma linha nesta página. Volte à primeira página do lote.</p>}
        <nav aria-label="Páginas das linhas do lote" className="bibliotheon-commercial-pagination">{page > 1 && <Link href={batchURL(batch.id, page - 1)}>Linhas anteriores</Link>}<span>Página {page} de {Math.max(1, rows.totalPages)}</span>{rows.hasNextPage && <Link href={batchURL(batch.id, page + 1)}>Próximas linhas</Link>}{page > rows.totalPages && <Link href={batchURL(batch.id)}>Primeira página</Link>}</nav>
        <CommercialImportConfirmation key={batch.id + ':' + batch.state} id={batch.id} kind={batch.kind as ImportKind} planHash={batch.planHash} state={batch.state}/>
        {audit && <details className="bibliotheon-import-audit"><summary>Últimos registros de auditoria deste lote</summary><ul>{audit.docs.map(item => <li key={item.id}>{commercialDate(item.occurredAt)} (Belém) · {({staged: 'Lote preparado', queued: 'Fatos enfileirados', confirmed: 'Confirmação registrada', stale: 'Plano desatualizado', duplicate_commit: 'Confirmação repetida sem duplicação'} as Record<string, string>)[item.action] || 'Registro de conferência'}</li>)}</ul><p>Autoria e referências completas estão na trilha privada de auditoria do Payload.</p></details>}
      </section>}
      <section aria-labelledby="import-upload-heading"><h2 id="import-upload-heading">Preparar nova conferência</h2><p>Transcreva somente os campos do contrato canônico escolhido. O arquivo exportado pelo provedor precisa ser conferido e adaptado; seus cabeçalhos não são reconhecidos automaticamente.</p><details className="bibliotheon-import-help"><summary>Como preencher os contratos</summary><p>Use vírgula como separador, UTF-8, cabeçalho na ordem do modelo e datas ISO 8601 em UTC, como 2026-10-20T12:00:00.000Z. Valores monetários são inteiros em centavos; campo vazio significa desconhecido, e zero exige evidência.</p><p>O snapshot tem 13 colunas e não comprova liquidação. Reversões e correções exigem evidência complementar com aprovação, base de reembolso e referências de substituição conferidas. Na evidência, replaces usa uma lista JSON de fontes substituídas ou [] quando não há substituição.</p><p>Não inclua nome, e-mail, documento, segredo, conteúdo de mensagens ou outras colunas de compradores. Use identificadores opacos e referências controladas.</p></details><CommercialImportForm templates={templates}/></section>
      <section aria-labelledby="import-recent-heading"><h2 id="import-recent-heading">Lotes recentes</h2><p>A lista mostra os 20 lotes mais recentes e permite retomar uma operação após sair da página. O histórico completo permanece nas coleções privadas.</p>{recent.docs.length ? <ol className="bibliotheon-import-lines">{recent.docs.map(item => <li key={item.id}><Link href={batchURL(item.id)}>{item.sourceReference}</Link><p>{importKindLabels[item.kind as ImportKind] || 'Contrato desconhecido'} · {importStateLabels[item.state] || 'Exige conferência'} · {item.rowCount} linha(s) · {commercialDate(item.stagedAt)} (Belém)</p></li>)}</ol> : <p>Nenhum lote de conciliação registrado.</p>}<p><Link href="/admin/collections/commercial-import-batches">Consultar histórico completo de lotes</Link></p></section>
    </>
  }
  let body
  try { body = await content() } catch { body = <p role="alert">Não foi possível consultar os lotes. Atualize a página antes de preparar ou confirmar outra operação.</p> }
  return <DefaultTemplate i18n={req.i18n} locale={initPageResult.locale} params={params} payload={req.payload} permissions={initPageResult.permissions} visibleEntities={initPageResult.visibleEntities} searchParams={searchParams} user={user}><Gutter className="bibliotheon-dashboard bibliotheon-commercial-imports"><header><p className="bibliotheon-kicker">Conciliação comercial</p><h1>Conferir e importar CSV</h1><p>Consulte a prévia, confira o lote persistido e confirme sua finalidade. Aprovação, processamento, recebimento e lucro são medidas distintas.</p></header>{body}<p><Link href="/admin/commercial-inbox">Acompanhar processamento</Link> · <Link href="/admin/financial-ledger">Consultar prévia financeira</Link> · <Link href="/admin">Voltar ao painel</Link></p></Gutter></DefaultTemplate>
}
