'use client'

import {useRef, useState, type FormEvent} from 'react'
import Link from 'next/link'
import {ledgerCategories, ledgerFailure, ledgerMoney, ledgerSources, ledgerUTC, newLedgerEntry, prepareLedgerEntry, type LedgerEntryKind, type LedgerEntrySeed, type LedgerEntryValues} from '../../modules/commerce/ledger-entry'

export function FinancialRecordForm({kind, correction, campaigns}: {kind: LedgerEntryKind; correction: LedgerEntrySeed | null; campaigns: {id: string; code: string}[]}) {
  const [values, setValues] = useState<LedgerEntryValues>(() => correction ? {...correction.values, recordReference: ''} : newLedgerEntry(kind))
  const [review, setReview] = useState(false), [verified, setVerified] = useState(false), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [savedID, setSavedID] = useState<string | null>(null)
  const lock = useRef(false), feedback = useRef<HTMLParagraphElement>(null), summary = useRef<HTMLHeadingElement>(null)
  function change(field: keyof LedgerEntryValues, value: string) { setValues(previous => ({...previous, [field]: value})); setReview(false); setVerified(false); setError(''); setMessage('') }
  const immutable = !!correction, endpoint = kind === 'settlement' ? '/api/v1/admin/settlement-evidence' : '/api/v1/admin/financial-costs'
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || savedID) return
    setError(''); setMessage('')
    let prepared
    try { prepared = prepareLedgerEntry(kind, values, correction?.id || null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Confira os campos do registro.'); feedback.current?.focus(); return }
    if (!review) { setReview(true); setVerified(false); setTimeout(() => summary.current?.focus(), 0); return }
    if (!verified) return
    lock.current = true; setBusy(true)
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch(endpoint, {method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(prepared)})
      const result = await response.json()
      if (!response.ok) { setError(ledgerFailure(String(result.code))); return }
      setSavedID(String(result.id)); setVerified(false)
      setMessage(result.duplicate ? 'Esta fonte e referência de linha já estavam registradas. Confira o histórico para identificar a versão vigente.' : kind === 'settlement' ? 'Movimento de liquidação registrado. A evidência não cria outra venda nem homologa a fonte externa.' : 'Custo registrado. Valores confirmados e estimados continuam separados na prévia financeira.')
    } catch { setError('A resposta não chegou. O registro pode ter sido gravado. Confira o histórico ou repita com a mesma fonte e referência de linha.') }
    finally { clearTimeout(timer); lock.current = false; setBusy(false); feedback.current?.focus() }
  }
  const field = (name: keyof LedgerEntryValues, label: string, options: {locked?: boolean; required?: boolean; pattern?: string; maxLength?: number; type?: string; help?: string} = {}) => <div><label htmlFor={'ledger-' + name}>{label}</label><input id={'ledger-' + name} type={options.type || 'text'} required={options.required !== false} autoComplete="off" maxLength={options.maxLength || 128} pattern={options.pattern} disabled={options.locked} value={values[name]} onChange={event => change(name, event.target.value)} aria-describedby={options.help} /></div>
  const alias = '[a-z](?:[a-z0-9_]|-){2,95}', uuid = '[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}'
  return <form className="bibliotheon-operational-form bibliotheon-ledger-form" action={endpoint} method="post" onSubmit={submit} aria-busy={busy}>
    {correction && <p className="bibliotheon-financial-note">Correção do registro {correction.id}. O original permanece na trilha. Identidade, moeda e fonte são preservadas; informe uma nova referência de linha.</p>}
    {!savedID && <fieldset disabled={busy}><legend>{correction ? 'Corrigir por substituição' : kind === 'settlement' ? 'Nova evidência de liquidação' : 'Novo custo'}</legend>
      {!review ? <>
        <div className="bibliotheon-ledger-fields">
          {kind === 'settlement' ? <><div><label htmlFor="ledger-provider">Provedor</label><select id="ledger-provider" disabled={immutable} value={values.provider} onChange={event => change('provider', event.target.value)}><option value="hotmart">Hotmart</option><option value="kiwify">Kiwify</option><option value="cakto">Cakto</option></select></div>{field('accountKey', 'Identificador da conta', {locked: immutable, maxLength: 200})}{field('externalTransactionId', 'Identificador da transação', {locked: immutable, maxLength: 200})}<div><label htmlFor="ledger-direction">Movimento</label><select id="ledger-direction" value={values.direction} onChange={event => change('direction', event.target.value)}><option value="credit">Crédito recebido</option><option value="debit">Débito ou estorno de caixa</option></select></div>{field('settlementReference', 'Referência da liquidação', {locked: immutable, pattern: alias, maxLength: 96, help: 'ledger-reference-help'})}</> : <><div><label htmlFor="ledger-category">Categoria do custo</label><select id="ledger-category" disabled={immutable} value={values.category} onChange={event => change('category', event.target.value)}>{Object.entries(ledgerCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><label htmlFor="ledger-classification">Classificação do custo</label><select id="ledger-classification" value={values.classification} onChange={event => change('classification', event.target.value)}><option value="confirmed">Confirmado</option><option value="estimated">Estimado</option></select></div><div><label htmlFor="ledger-campaignId">Campanha (opcional)</label><input id="ledger-campaignId" type="text" autoComplete="off" list="ledger-campaign-options" disabled={immutable} pattern={uuid} value={values.campaignId} onChange={event => change('campaignId', event.target.value)} aria-describedby="ledger-campaign-help" /><datalist id="ledger-campaign-options">{campaigns.map(campaign => <option key={campaign.id} value={campaign.id} label={campaign.code}/>)}</datalist><p id="ledger-campaign-help">Use o ID de uma campanha cadastrada; as 100 mais recentes aparecem nas sugestões. Deixe vazio para custo compartilhado. <Link href="/admin/collections/campaigns">Consultar campanhas</Link></p></div></>}
          {field('currency', 'Moeda', {locked: immutable, pattern: '[A-Z]{3}', maxLength: 3, help: 'ledger-money-help'})}
          <div><label htmlFor="ledger-amount">Valor do movimento</label><input id="ledger-amount" type="text" inputMode="decimal" autoComplete="off" required maxLength={18} value={values.amount} onChange={event => change('amount', event.target.value)} aria-describedby="ledger-money-help" /></div>
          <div><label htmlFor="ledger-occurredAt">{kind === 'settlement' ? 'Data e hora da liquidação (UTC)' : 'Data e hora do custo (UTC)'}</label><input id="ledger-occurredAt" type="datetime-local" step="0.001" required value={values.occurredAt} onChange={event => change('occurredAt', event.target.value)} aria-describedby="ledger-time-help" /></div>
        </div>
        <p id="ledger-money-help">Moeda em três letras, como BRL. Informe o valor sem separador de milhar, como 1234,56. O sinal é definido pelo movimento; zero só quando conferido na fonte. Nenhuma moeda é convertida.</p>
        <p id="ledger-time-help">Use o instante UTC da fonte. O horário de Belém está três horas atrás de UTC. Aprovação da compra e liquidação são datas distintas.</p>
        <div className="bibliotheon-ledger-fields"><div><label htmlFor="ledger-sourceKind">Fonte da conferência</label><select id="ledger-sourceKind" disabled={immutable} value={values.sourceKind} onChange={event => change('sourceKind', event.target.value)}>{Object.entries(ledgerSources).filter(([value]) => kind === 'cost' || value !== 'invoice').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{field('sourceReference', 'Referência da fonte', {locked: immutable, pattern: alias, maxLength: 96, help: 'ledger-reference-help'})}{field('recordReference', 'Referência da linha', {pattern: alias, maxLength: 96, help: 'ledger-reference-help'})}</div>
        <p id="ledger-reference-help">Use códigos conferidos como fechamento-outubro ou linha-001: 3–96 letras minúsculas, números, hífen ou sublinhado, começando com letra. Preserve a mesma fonte/linha ao repetir; uma correção usa nova linha. Não inclua comprador, documento ou segredo.</p>
        <button type="submit" disabled={busy || !values.recordReference || !values.amount || !values.occurredAt}>Conferir registro</button>
      </> : <>
        <h3 ref={summary} tabIndex={-1}>Conferência antes do registro</h3>
        <dl className="bibliotheon-commercial-facts"><div><dt>Valor</dt><dd>{ledgerMoney(prepareLedgerEntry(kind, values, correction?.id || null).amountCents, values.currency.toUpperCase())}</dd></div><div><dt>Instante (UTC)</dt><dd>{ledgerUTC(values.occurredAt)}</dd></div>{kind === 'settlement' ? <><div><dt>Provedor e conta</dt><dd>{values.provider} · {values.accountKey}</dd></div><div><dt>Transação</dt><dd>{values.externalTransactionId}</dd></div><div><dt>Movimento</dt><dd>{values.direction === 'credit' ? 'Crédito recebido' : 'Débito ou estorno de caixa'}</dd></div><div><dt>Liquidação</dt><dd>{values.settlementReference}</dd></div></> : <><div><dt>Categoria</dt><dd>{ledgerCategories[values.category as keyof typeof ledgerCategories]}</dd></div><div><dt>Classificação</dt><dd>{values.classification === 'confirmed' ? 'Confirmado' : 'Estimado'}</dd></div><div><dt>Campanha</dt><dd>{values.campaignId || 'Compartilhado, sem campanha'}</dd></div></>}<div><dt>Fonte</dt><dd>{ledgerSources[values.sourceKind as keyof typeof ledgerSources]} · {values.sourceReference}</dd></div><div><dt>Linha</dt><dd>{values.recordReference}</dd></div>{correction && <div><dt>Substitui</dt><dd>{correction.id}</dd></div>}</dl>
        <p>{kind === 'settlement' ? 'O servidor exige aprovação comprovada da transação, moeda igual e ausência de revisão. Registrar esta evidência não altera o estado da compra.' : 'O custo será incluído no período da ocorrência e na classificação conferida. Uma estimativa não se torna custo confirmado automaticamente.'} {correction && 'A nova linha substitui a anterior no cálculo, preservando as duas no histórico.'}</p>
        <label className="bibliotheon-review"><input type="checkbox" required checked={verified} onChange={event => setVerified(event.target.checked)} />Conferi os valores, o instante, os vínculos e a fonte deste registro.</label>
        <div className="bibliotheon-import-buttons"><button type="button" disabled={busy} onClick={() => { setReview(false); setVerified(false); setError('') }}>Voltar aos campos</button><button type="submit" disabled={!verified || busy}>{busy ? 'Registrando…' : 'Registrar dados conferidos'}</button></div>
      </>}
    </fieldset>}
    <p ref={feedback} tabIndex={-1} role={error ? 'alert' : 'status'}>{error || message}</p>
    {savedID && <p><Link href={`/admin/financial-records?kind=${kind}&entry=${savedID}`}>Conferir registro no histórico</Link> · <Link href={'/admin/financial-records?kind=' + kind}>Preparar novo registro</Link></p>}
    <noscript>Ative JavaScript para conferir e registrar. O histórico financeiro permanece disponível para leitura.</noscript>
  </form>
}
