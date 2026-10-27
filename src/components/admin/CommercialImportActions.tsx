'use client'

import {useRef, useState, type FormEvent} from 'react'
import Link from 'next/link'
import {importClassificationLabels, importFailureLabel, importReasonLabel, importStateLabels, type ImportKind, type ImportPreview} from '../../modules/commerce/import-presentation'

const endpoint = (kind: ImportKind) => kind === 'snapshot' ? '/api/v1/admin/imports' : '/api/v1/admin/report-evidence/imports'
const uncertain = 'A resposta não chegou. A operação pode ter sido registrada. Confira os lotes recentes ou repita esta mesma tentativa sem alterar os dados.'
async function send(url: string, init: RequestInit) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000)
  try { const response = await fetch(url, {...init, signal: controller.signal, credentials: 'same-origin', cache: 'no-store'}); return {ok: response.ok, result: await response.json()} }
  finally { clearTimeout(timer) }
}

export function CommercialImportForm({templates}: {templates: Record<ImportKind, {header: string; maxBytes: number; maxRows: number}>}) {
  const [kind, setKind] = useState<ImportKind>('snapshot'), [file, setFile] = useState<File | null>(null)
  const [source, setSource] = useState('provider_report'), [reference, setReference] = useState(''), [reason, setReason] = useState('report_reconciliation')
  const [preview, setPreview] = useState<ImportPreview | null>(null), [page, setPage] = useState(1), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [status, setStatus] = useState(''), [batchID, setBatchID] = useState<string | null>(null)
  const attempt = useRef<string | null>(null), inFlight = useRef(false), feedback = useRef<HTMLParagraphElement>(null)
  function changed() { setPreview(null); setPage(1); setError(''); setStatus(''); setBatchID(null); attempt.current = null }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || !file) return
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') || 'preview'
    if (action === 'stage' && !preview) return
    if (file.size > templates[kind].maxBytes) { setError(importFailureLabel('too_large')); feedback.current?.focus(); return }
    inFlight.current = true; setBusy(true); setError(''); setStatus(''); setBatchID(null)
    try {
      const headers: Record<string, string> = {'Content-Type': 'text/csv; charset=utf-8', 'X-Import-Source': source, 'X-Import-Reference': reference, 'X-Import-Reason': kind === 'report_evidence' ? 'report_reconciliation' : reason}
      if (action === 'stage') { attempt.current ??= crypto.randomUUID(); headers['Idempotency-Key'] = attempt.current }
      const response = await send(endpoint(kind) + (action === 'preview' ? '/preview' : ''), {method: 'POST', headers, body: file})
      const {result} = response
      if (!response.ok) { setError(importFailureLabel(String(result.code)) + (typeof result.line === 'number' ? ` Linha ${result.line}.` : '')); return }
      if (action === 'preview') { setPreview(result as ImportPreview); setPage(1); setStatus('Prévia consultada. Nenhum lote ou fato foi gravado. Confira as linhas antes de preparar o lote.') }
      else { setBatchID(String(result.id)); setStatus(result.duplicate ? 'Esta tentativa já tem lote registrado. Abra o lote para conferir seu estado atual.' : 'Lote registrado. Abra o lote e confira o plano antes de confirmar.') }
    } catch { setError(action === 'preview' ? 'Não foi possível consultar a prévia. Confira a conexão e tente novamente.' : uncertain) }
    finally { inFlight.current = false; setBusy(false); feedback.current?.focus() }
  }
  const selected = templates[kind], pages = Math.max(1, Math.ceil((preview?.lines.length || 0) / 50))
  return <>
    <form className="bibliotheon-operational-form bibliotheon-import-form" action={endpoint(kind)} method="post" encType="multipart/form-data" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy}><legend>Arquivo e origem da conferência</legend>
        <label htmlFor="import-kind">Contrato do arquivo</label><select id="import-kind" value={kind} onChange={event => { changed(); setKind(event.target.value as ImportKind) }}><option value="snapshot">Snapshot comercial — 13 colunas</option><option value="report_evidence">Evidência complementar — 18 colunas</option></select>
        <p id="import-contract-help">{kind === 'snapshot' ? 'Compara o estado atual ao histórico. Casos elegíveis podem gerar fatos na fila após confirmação.' : 'Registra prova complementar. A aplicação de valores à transação exige decisão financeira própria.'} Um provedor e uma conta por lote. Limite: {selected.maxRows.toLocaleString('pt-BR')} linhas e {selected.maxBytes / 1024} KiB.</p>
        <p><a download={`bibliotheon-${kind}.csv`} href={'data:text/csv;charset=utf-8,' + encodeURIComponent(selected.header + '\r\n')}>Baixar cabeçalho do contrato escolhido</a></p>
        <label htmlFor="import-file">Arquivo CSV canônico em UTF-8</label><input id="import-file" name="file" type="file" accept=".csv,text/csv" required aria-describedby="import-contract-help" onChange={event => { changed(); setFile(event.target.files?.[0] || null) }} />
        <label htmlFor="import-source">Onde você conferiu?</label><select id="import-source" value={source} onChange={event => { changed(); setSource(event.target.value) }}><option value="provider_report">Relatório do provedor</option><option value="manual_reconciliation">Conciliação manual</option></select>
        <label htmlFor="import-reference">Referência da conferência</label><input id="import-reference" type="text" required minLength={3} maxLength={96} pattern="[a-z][a-z0-9_\-]{2,95}" value={reference} onChange={event => { changed(); setReference(event.target.value) }} aria-describedby="import-reference-help" />
        <p id="import-reference-help">Crie um código como fechamento-outubro-2026. Use letras minúsculas, números, hífen ou sublinhado, sem dados pessoais.</p>
        {kind === 'snapshot' && <><label htmlFor="import-reason">Motivo</label><select id="import-reason" value={reason} onChange={event => { changed(); setReason(event.target.value) }}><option value="report_reconciliation">Conferência de relatório</option><option value="missing_webhook">Evento não recebido</option></select></>}
        <div className="bibliotheon-import-buttons"><button type="submit" value="preview" disabled={busy || !file}>{busy ? 'Aguarde…' : 'Consultar prévia'}</button>{preview && <button type="submit" value="stage" disabled={busy || !!batchID}>Preparar lote para conferência</button>}</div>
      </fieldset>
      <p ref={feedback} tabIndex={-1} role={error ? 'alert' : 'status'}>{error || status}</p>
      {batchID && <p><Link href={'/admin/commercial-imports?batch=' + encodeURIComponent(batchID)}>Abrir lote registrado</Link></p>}
      <noscript>Ative JavaScript para enviar o CSV. Lotes já registrados podem ser consultados nesta página.</noscript>
    </form>
    {preview && <section aria-labelledby="import-preview-heading"><h3 id="import-preview-heading">Prévia provisória do arquivo</h3><p>O plano persistido será calculado novamente ao preparar o lote. A prévia não autoriza confirmação.</p><ul className="bibliotheon-import-counts">{Object.entries(preview.counts).filter(([, count]) => count > 0).map(([name, count]) => <li key={name}>{importClassificationLabels[name] || name}: {count}</li>)}</ul>
      <ol className="bibliotheon-import-lines" start={(page - 1) * 50 + 1}>{preview.lines.slice((page - 1) * 50, page * 50).map(line => <li key={line.line}><strong>Linha {line.line} · {importClassificationLabels[line.classification] || 'Exige conferência'}</strong><p>{importReasonLabel(line.reason)}{line.duplicateOf ? ` Repetição da linha ${line.duplicateOf}.` : ''}</p></li>)}</ol>
      {pages > 1 && <nav aria-label="Linhas da prévia" className="bibliotheon-commercial-pagination"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Linhas anteriores</button><span>Página {page} de {pages}</span><button type="button" disabled={page === pages} onClick={() => setPage(page + 1)}>Próximas linhas</button></nav>}
    </section>}
  </>
}

export function CommercialImportConfirmation({id, kind, planHash, state}: {id: string; kind: ImportKind; planHash: string; state: string}) {
  const [reviewed, setReviewed] = useState(false), [busy, setBusy] = useState(false), [currentState, setCurrentState] = useState(state)
  const [message, setMessage] = useState(''), [error, setError] = useState('')
  const inFlight = useRef(false), feedback = useRef<HTMLParagraphElement>(null)
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || !reviewed || currentState !== 'ready') return
    inFlight.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const response = await send(`${endpoint(kind)}/${id}/commit`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({confirmed: true, planHash})})
      const {result} = response
      if (!response.ok) { if (result.state) setCurrentState(String(result.state)); setError(importFailureLabel(result.state === 'stale' ? 'plan_conflict' : String(result.code))); return }
      setCurrentState(String(result.state)); setReviewed(false)
      setMessage(result.state === 'queued' ? 'Fatos enfileirados para processamento. A confirmação não comprova aplicação, recebimento ou lucro.' : kind === 'report_evidence' ? 'Evidências registradas. Aplicar valores exige decisão financeira explícita; nenhum webhook nativo foi criado.' : 'Confirmação registrada. Nenhum fato novo precisou ser enfileirado.')
    } catch { setError(uncertain) }
    finally { inFlight.current = false; setBusy(false); feedback.current?.focus() }
  }
  return <div className="bibliotheon-import-confirmation"><p><strong>Estado da confirmação:</strong> {importStateLabels[currentState] || 'Exige conferência'}</p>
    {currentState === 'ready' && <form className="bibliotheon-operational-form" onSubmit={confirm} aria-busy={busy}><fieldset disabled={busy}><legend>Confirmar o plano deste lote</legend><p>{kind === 'snapshot' ? 'A confirmação revalida o plano e pode enfileirar fatos comerciais elegíveis.' : 'A confirmação revalida o plano e registra as evidências complementares.'} Divergências novas bloqueiam a operação.</p><label className="bibliotheon-review"><input type="checkbox" required checked={reviewed} onChange={event => setReviewed(event.target.checked)} />Conferi a fonte, as linhas e as consequências deste lote.</label><button type="submit" disabled={!reviewed || busy}>{busy ? 'Confirmando…' : 'Confirmar lote conferido'}</button></fieldset><noscript>Ative JavaScript para confirmar. A consulta deste lote permanece disponível.</noscript></form>}
    <p ref={feedback} tabIndex={-1} role={error ? 'alert' : 'status'}>{error || message}</p>
    {currentState !== state && <p><a href={'/admin/commercial-imports?batch=' + id}>Atualizar dados persistidos do lote</a></p>}
  </div>
}
