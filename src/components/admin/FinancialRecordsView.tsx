import type {AdminViewServerProps} from 'payload'
import type {CommercialSettlementEvidence, FinancialCostEntry} from '../../payload-types'
import {DefaultTemplate} from '@payloadcms/next/templates'
import {Gutter} from '@payloadcms/ui'
import {redirect} from 'next/navigation'
import Link from 'next/link'
import {ledgerAmountInput, ledgerCategories, ledgerKinds, ledgerMoney, ledgerSources, newLedgerEntry, type LedgerEntryKind, type LedgerEntryValues} from '../../modules/commerce/ledger-entry'
import {commercialDate} from '../../modules/commerce/presentation'
import {FinancialRecordForm} from './FinancialRecordForm'

type Row = CommercialSettlementEvidence | FinancialCostEntry
const scalar = (value: unknown) => Array.isArray(value) ? value[0] : value
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const relation = (value: unknown): string | null => typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String(value.id) : null
const entryURL = (kind: LedgerEntryKind, id: string, replace = false) => `/admin/financial-records?kind=${kind}&${replace ? 'replace' : 'entry'}=${id}`
function rowValues(kind: LedgerEntryKind, row: Row): LedgerEntryValues {
  const values = {...newLedgerEntry(kind), currency: row.currency, amount: ledgerAmountInput(row.amountCents), sourceKind: row.sourceKind, sourceReference: row.sourceReference, recordReference: row.recordReference}
  if ('provider' in row) return {...values, provider: row.provider, accountKey: row.accountKey, externalTransactionId: row.externalTransactionId, direction: row.direction, settlementReference: row.settlementReference, occurredAt: row.settledAt.replace(/Z$/, '')}
  return {...values, category: row.category, classification: row.classification, campaignId: relation(row.campaign) || '', occurredAt: row.incurredAt.replace(/Z$/, '')}
}
function RecordDetails({row, kind, child}: {row: Row; kind: LedgerEntryKind; child: string | null}) {
  const previous = relation(row.supersedes)
  return <><p><strong>{child ? 'Substituído por outra linha' : 'Linha vigente'}</strong> · {ledgerMoney(row.amountCents, row.currency)}</p><dl className="bibliotheon-commercial-facts">
    <div><dt>Registro</dt><dd>{row.id}</dd></div><div><dt>Fonte</dt><dd>{ledgerSources[row.sourceKind]} · {row.sourceReference}</dd></div><div><dt>Linha da fonte</dt><dd>{row.recordReference}</dd></div>
    {'provider' in row ? <><div><dt>Provedor e conta</dt><dd>{row.provider} · {row.accountKey}</dd></div><div><dt>Transação</dt><dd>{row.externalTransactionId}</dd></div><div><dt>Movimento</dt><dd>{row.direction === 'credit' ? 'Crédito recebido' : 'Débito ou estorno de caixa'}</dd></div><div><dt>Liquidação</dt><dd>{row.settlementReference}</dd></div><div><dt>Liquidação (UTC)</dt><dd>{row.settledAt}</dd></div></> : <><div><dt>Categoria</dt><dd>{ledgerCategories[row.category]}</dd></div><div><dt>Classificação</dt><dd>{row.classification === 'confirmed' ? 'Confirmado' : 'Estimado'}</dd></div><div><dt>Campanha (ID)</dt><dd>{relation(row.campaign) || 'Compartilhado, sem campanha'}</dd></div><div><dt>Ocorrência do custo (UTC)</dt><dd>{row.incurredAt}</dd></div></>}
    <div><dt>Registrado em (Belém)</dt><dd>{commercialDate(row.recordedAt)}</dd></div><div><dt>Responsável (ID)</dt><dd>{relation(row.actor) || 'Não informado'}</dd></div>
  </dl><p>{previous && <><Link href={entryURL(kind, previous)}>Consultar linha anterior</Link> · </>}{child ? <Link href={entryURL(kind, child)}>Abrir linha que substituiu este registro</Link> : <Link href={entryURL(kind, row.id, true)}>Preparar correção deste registro</Link>}</p></>
}

export async function FinancialRecordsView({initPageResult, params, searchParams, user}: AdminViewServerProps) {
  const {req} = initPageResult
  if (req.user?.collection !== 'admin-users' || req.user.role !== 'owner') redirect('/admin/login')
  const rawKind = scalar(searchParams?.kind), kind: LedgerEntryKind = rawKind === 'cost' ? 'cost' : 'settlement'
  const entry = scalar(searchParams?.entry), replace = scalar(searchParams?.replace), selectedID = replace || entry, rawCurrency = scalar(searchParams?.currency), currency = typeof rawCurrency === 'string' ? rawCurrency.toUpperCase() : ''
  const rawPage = scalar(searchParams?.page), page = typeof rawPage === 'string' && /^[1-9]\d{0,4}$/.test(rawPage) ? Number(rawPage) : 1
  const invalid = rawKind !== undefined && !['settlement', 'cost'].includes(String(rawKind)) || !!entry && !!replace || !!selectedID && !uuid(selectedID) || !!currency && !/^[A-Z]{3}$/.test(currency)
  const collection = kind === 'settlement' ? 'commercial-settlement-evidence' : 'financial-cost-entries'
  async function content() {
    if (invalid) return <p role="alert">Confira o tipo, a moeda e o identificador do registro. <Link href={'/admin/financial-records?kind=' + kind}>Abrir registros válidos</Link></p>
    const selected = uuid(selectedID) ? await req.payload.findByID({collection, id: selectedID, overrideAccess: false, req, depth: 0, disableErrors: true}) : null
    const history = await req.payload.find({collection, overrideAccess: false, req, depth: 0, sort: ['-recordedAt', '-id'], limit: 20, page, ...(currency ? {where: {currency: {equals: currency}}} : {})})
    const ids = [...new Set([...history.docs.map(row => row.id), ...(selected ? [selected.id] : [])])]
    const successors = ids.length ? await req.payload.find({collection, overrideAccess: false, req, depth: 0, where: {supersedes: {in: ids}}, limit: ids.length + 1, select: {supersedes: true}}) : null
    const children = new Map(successors?.docs.map(row => [relation(row.supersedes), row.id]) || [])
    const campaigns = kind === 'cost' && !entry ? await req.payload.find({collection: 'campaigns', overrideAccess: false, req, depth: 0, limit: 100, sort: '-createdAt', select: {code: true}}) : null
    const selectedChild = selected ? children.get(selected.id) || null : null
    return <>
      {selectedID && !selected && <p role="alert">Registro não encontrado. Nenhuma correção foi preparada. <Link href={'/admin/financial-records?kind=' + kind}>Voltar ao histórico</Link></p>}
      {selected && <section aria-labelledby="ledger-selected-heading"><h2 id="ledger-selected-heading">Registro selecionado</h2><RecordDetails row={selected} kind={kind} child={selectedChild}/>{replace && selectedChild && <p role="status">Este registro já foi substituído. Abra a linha que o substituiu antes de preparar outra correção.</p>}</section>}
      {(!selectedID || replace && selected && !selectedChild) && <section aria-labelledby="ledger-entry-heading"><h2 id="ledger-entry-heading">{replace ? 'Preparar correção' : kind === 'settlement' ? 'Registrar liquidação' : 'Registrar custo'}</h2><p>{kind === 'settlement' ? 'Informe o movimento comprovado e sua alocação a uma transação aprovada. A aprovação e o líquido do provedor não comprovam recebimento.' : 'Informe um custo confirmado ou estimado, com fonte e data próprias. A ausência de registro não significa custo zero.'}</p><FinancialRecordForm key={kind + ':' + (selected?.id || 'new')} kind={kind} correction={replace && selected ? {id: selected.id, values: rowValues(kind, selected)} : null} campaigns={campaigns?.docs || []}/></section>}
      {selectedID && <p><Link href={'/admin/financial-records?kind=' + kind}>Preparar novo registro</Link></p>}
      <section aria-labelledby="ledger-history-heading"><h2 id="ledger-history-heading">Histórico de {kind === 'settlement' ? 'liquidações' : 'custos'}</h2><form method="get" action="/admin/financial-records" className="bibliotheon-operational-form bibliotheon-ledger-filter"><input type="hidden" name="kind" value={kind}/><label htmlFor="ledger-history-currency">Moeda do histórico (opcional)</label><input id="ledger-history-currency" name="currency" type="text" pattern="[A-Za-z]{3}" maxLength={3} defaultValue={currency}/><button type="submit">Filtrar histórico</button></form>
        <p>{history.totalDocs} registro(s) no filtro. Até 20 por página, incluindo linhas substituídas; os cálculos usam a versão vigente de cada trilha.</p>
        {!history.docs.length ? <p>Nenhum registro financeiro nesta consulta.</p> : <ol className="bibliotheon-ledger-history">{history.docs.filter(row => row.id !== selected?.id).map(row => <li key={row.id}><details><summary>{row.recordReference} · {ledgerMoney(row.amountCents, row.currency)} · {children.has(row.id) ? 'Substituído' : 'Vigente'}</summary><RecordDetails row={row} kind={kind} child={children.get(row.id) || null}/></details></li>)}</ol>}
        <nav aria-label="Páginas do histórico financeiro" className="bibliotheon-commercial-pagination">{page > 1 && <Link href={`/admin/financial-records?kind=${kind}&currency=${currency}&page=${page - 1}`}>Registros anteriores</Link>}<span>Página {page} de {Math.max(1, history.totalPages)}</span>{history.hasNextPage && <Link href={`/admin/financial-records?kind=${kind}&currency=${currency}&page=${page + 1}`}>Próximos registros</Link>}{page > history.totalPages && <Link href={'/admin/financial-records?kind=' + kind}>Primeira página</Link>}</nav>
        <p><Link href={'/admin/collections/' + collection}>Consultar coleção privada</Link></p>
      </section>
    </>
  }
  let body
  try { body = await content() } catch { body = <p role="alert">Não foi possível consultar os registros. Atualize a página antes de preparar outra operação.</p> }
  return <DefaultTemplate i18n={req.i18n} locale={initPageResult.locale} params={params} payload={req.payload} permissions={initPageResult.permissions} visibleEntities={initPageResult.visibleEntities} searchParams={searchParams} user={user}><Gutter className="bibliotheon-dashboard bibliotheon-ledger-records"><header><p className="bibliotheon-kicker">Conciliação financeira</p><h1>Registrar liquidações e custos</h1><p>Confira movimentos de caixa e custos com sua fonte, período e moeda. Correções preservam o histórico.</p></header><nav aria-label="Tipo de registro financeiro"><ul className="bibliotheon-admin-links">{Object.entries(ledgerKinds).map(([value, label]) => <li key={value}><Link href={'/admin/financial-records?kind=' + value} aria-current={kind === value ? 'page' : undefined}>{label === 'Liquidação' ? 'Liquidações' : 'Custos'}</Link></li>)}</ul></nav>{body}<p><Link href="/admin/financial-ledger">Consultar prévia financeira</Link> · <Link href="/admin/commercial-imports">Conferir CSV</Link> · <Link href="/admin">Voltar ao painel</Link></p></Gutter></DefaultTemplate>
}
