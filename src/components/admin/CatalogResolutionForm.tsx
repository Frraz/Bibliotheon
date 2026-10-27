'use client'
import {useRef, useState, useSyncExternalStore, type FormEvent} from 'react'
import Link from 'next/link'
import type {CatalogChoice, catalogResolutionPlan} from '../../modules/commerce/catalog-resolutions'

type Plan = Awaited<ReturnType<typeof catalogResolutionPlan>>
type Metadata = {sourceKind: 'provider_report' | 'manual_reconciliation'; sourceReference: string; reason: 'catalog_mapping_verified' | 'historical_mapping_correction' | 'evidence_inconclusive'}
type Prepared = {plan: Plan; metadata: Metadata; key: string}
const subscribe = () => () => {}
const uuid = '[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}'
const messages: Record<string, string> = {stale_plan: 'O catálogo ou o histórico mudou. Prepare uma nova prévia e confira novamente.', target_scope_mismatch: 'O destino não pertence ao escopo informado ou não existe. Confira livro e oferta.', idempotency_conflict: 'A chave já foi usada para outra decisão. Confira o histórico antes de preparar uma nova prévia.', forbidden: 'Sua sessão ou origem não foi autorizada. Entre novamente.', catalog_resolution_limit: 'O escopo excede o limite de conferência. A decisão não foi registrada.', invalid_choice: 'Confira os identificadores, o escopo e o destino.', invalid_decision: 'Confira a fonte, o motivo e os campos da decisão.', evidence_required: 'A decisão exige a atestação e o motivo correspondentes.'}
async function post(path: string, body: unknown, key?: string) {
  let response: Response, result
  try {response = await fetch(path, {method: 'POST', headers: {'Content-Type': 'application/json', ...(key ? {'Idempotency-Key': key} : {})}, body: JSON.stringify(body), signal: AbortSignal.timeout(20000)})
    result = await response.json()
  } catch {throw new Error('Resposta não confirmada. Confira o histórico e repita a mesma confirmação se a resposta se perdeu.')}
  if (!response.ok) throw new Error(messages[result.code] || 'A operação não foi confirmada. Confira o histórico; se a resposta se perdeu, repita a mesma confirmação.')
  return result
}
export function CatalogResolutionForm() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)
  const [action, setAction] = useState<'associate' | 'hold'>('associate'), [target, setTarget] = useState<'ebook' | 'offer'>('ebook')
  const [prepared, setPrepared] = useState<Prepared | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirmed, setConfirmed] = useState(false), [result, setResult] = useState<{id: string; revision: number; duplicate: boolean; current: boolean} | null>(null)
  const [previewPage, setPreviewPage] = useState(1), pending = useRef(false), form = useRef<HTMLFormElement>(null), feedback = useRef<HTMLDivElement>(null)
  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return
    const data = new FormData(event.currentTarget), text = (key: string) => String(data.get(key) || '')
    const choice: CatalogChoice = {provider: text('provider') as CatalogChoice['provider'], accountKey: text('accountKey'), externalProductId: text('externalProductId'), externalOfferId: text('externalOfferId') || null, action, targetOfferId: action === 'associate' && target === 'offer' ? text('targetID') : null, targetEbookId: action === 'associate' && target === 'ebook' ? text('targetID') : null}
    const metadata: Metadata = {sourceKind: text('sourceKind') as Metadata['sourceKind'], sourceReference: text('sourceReference'), reason: action === 'hold' ? 'evidence_inconclusive' : text('reason') as Metadata['reason']}
    pending.current = true; setBusy(true); setError(''); setResult(null)
    try { const plan = await post('/api/v1/admin/catalog-resolutions/preview', choice) as Plan; setPrepared({plan, metadata, key: crypto.randomUUID()}); setPreviewPage(1); setConfirmed(false) }
    catch (e) { setError(e instanceof Error ? e.message : 'Prévia indisponível.') }
    finally { pending.current = false; setBusy(false); requestAnimationFrame(() => feedback.current?.focus()) }
  }
  async function commit() {
    if (!prepared || !confirmed || pending.current || result) return
    pending.current = true; setBusy(true); setError('')
    try { setResult(await post('/api/v1/admin/catalog-resolutions', {...prepared.plan.choice, ...prepared.metadata, planHash: prepared.plan.planHash, evidenceVerified: prepared.plan.choice.action === 'associate', confirmed: true}, prepared.key)) }
    catch (e) {setError(e instanceof Error ? e.message : 'Confirmação indisponível.')}
    finally {pending.current = false; setBusy(false); requestAnimationFrame(() => feedback.current?.focus())}
  }
  function edit() {setPrepared(null); setResult(null); setError(''); setConfirmed(false); requestAnimationFrame(() => form.current?.querySelector('select')?.focus())}
  const plan = prepared?.plan
  return <>
    <noscript><p role="status">A conferência e o registro exigem JavaScript. O histórico abaixo continua disponível para leitura.</p></noscript>
    <form ref={form} onSubmit={preview} method="post" action="/api/v1/admin/catalog-resolutions/preview" className="bibliotheon-operational-form bibliotheon-catalog-form" hidden={!!prepared}>
      <fieldset disabled={busy}><legend>Identidade externa e decisão</legend>
        <label htmlFor="catalog-provider">Provedor</label><select id="catalog-provider" name="provider"><option value="hotmart">Hotmart</option><option value="kiwify">Kiwify</option><option value="cakto">Cakto</option></select>
        <label htmlFor="catalog-account">Identificador da conta</label><input id="catalog-account" name="accountKey" required maxLength={200}/>
        <label htmlFor="catalog-product">Identificador externo do produto</label><input id="catalog-product" name="externalProductId" required maxLength={200}/>
        <label htmlFor="catalog-external-offer">Identificador externo da oferta (opcional)</label><input id="catalog-external-offer" name="externalOfferId" maxLength={200} aria-describedby="catalog-scope-help"/>
        <p id="catalog-scope-help">Copie os identificadores exatos da fonte. Sem oferta externa, a decisão é para o escopo do produto; com oferta, é específica para ela. Não remove uma decisão de outro escopo.</p>
        <label htmlFor="catalog-action">Decisão</label><select id="catalog-action" value={action} onChange={e => setAction(e.target.value as typeof action)}><option value="associate">Associar a destino conferido</option><option value="hold">Manter bloqueado por evidência inconclusiva</option></select>
        {action === 'associate' && <><label htmlFor="catalog-target-kind">Tipo de destino</label><select id="catalog-target-kind" value={target} onChange={e => setTarget(e.target.value as typeof target)}><option value="ebook">Livro</option><option value="offer">Oferta do mesmo escopo</option></select><label htmlFor="catalog-target">ID do destino (UUID)</label><input id="catalog-target" name="targetID" required pattern={uuid} aria-describedby="catalog-target-help"/><p id="catalog-target-help">Confira o cadastro em <Link href="/admin/collections/ebooks">Livros</Link> ou <Link href="/admin/collections/offers">Ofertas</Link> antes de copiar o ID. A oferta deve pertencer ao provedor, conta, produto e, quando informada, oferta externa.</p></>}
        <label htmlFor="catalog-source-kind">Fonte da conferência</label><select id="catalog-source-kind" name="sourceKind"><option value="provider_report">Relatório do provedor</option><option value="manual_reconciliation">Conciliação manual</option></select>
        <label htmlFor="catalog-source">Referência da fonte</label><input id="catalog-source" name="sourceReference" required pattern="[a-z](?:[a-z0-9_]|-){2,95}" minLength={3} maxLength={96} aria-describedby="catalog-source-help"/><p id="catalog-source-help">Alias interno com letras minúsculas, números, hífen ou sublinhado, começando por letra. Não cole relatório, dados de compradores ou credenciais.</p>
        {action === 'associate' && <><label htmlFor="catalog-reason">Motivo da associação</label><select id="catalog-reason" name="reason"><option value="catalog_mapping_verified">Vínculo de catálogo conferido</option><option value="historical_mapping_correction">Correção de vínculo histórico</option></select></>}
        <button type="submit" disabled={!hydrated || busy} aria-busy={busy}>{busy ? 'Consultando prévia…' : 'Preparar prévia de identidade'}</button>
      </fieldset>
    </form>
    <div ref={feedback} tabIndex={-1} className="bibliotheon-catalog-feedback">{error && <p role="alert">{error}</p>}{result && <p role="status">{result.duplicate ? 'Decisão já registrada; repetição sem duplicação.' : 'Decisão registrada com histórico preservado.'} Revisão {result.revision}. {result.current ? 'Era vigente na confirmação.' : 'Outra revisão já estava vigente.'} <Link href={'/admin/catalog-resolutions?entry=' + result.id}>Consultar decisão registrada</Link></p>}</div>
    {plan && <section aria-labelledby="catalog-preview-heading" className="bibliotheon-catalog-preview"><h2 id="catalog-preview-heading">Conferência da decisão de identidade</h2><p>Prévia provisória. O servidor revalida o catálogo e o histórico ao confirmar. A decisão não aplica venda, recebimento ou resolução financeira e não edita os fatos originais.</p>
      <dl className="bibliotheon-commercial-facts"><div><dt>Provedor e conta</dt><dd>{plan.choice.provider} · {plan.choice.accountKey}</dd></div><div><dt>Produto externo</dt><dd>{plan.choice.externalProductId}</dd></div><div><dt>Oferta externa</dt><dd>{plan.choice.externalOfferId || 'Escopo do produto, sem oferta específica'}</dd></div><div><dt>Decisão</dt><dd>{plan.choice.action === 'hold' ? 'Manter bloqueado: evidência inconclusiva' : 'Associar a destino conferido'}</dd></div><div><dt>Livro de destino</dt><dd>{plan.targetEbookId ? <Link href={'/admin/collections/ebooks/' + plan.targetEbookId}>{plan.targetEbookId}</Link> : 'Sem destino'}</dd></div><div><dt>Oferta de destino</dt><dd>{plan.choice.targetOfferId ? <Link href={'/admin/collections/offers/' + plan.choice.targetOfferId}>{plan.choice.targetOfferId}</Link> : 'Sem oferta de destino'}</dd></div><div><dt>Revisão anterior do mesmo escopo</dt><dd>{plan.currentResolutionId ? <Link href={'/admin/catalog-resolutions?entry=' + plan.currentResolutionId}>{plan.currentRevision} · {plan.currentResolutionId}</Link> : 'Nenhuma'}</dd></div><div><dt>Fonte e motivo</dt><dd>{prepared!.metadata.sourceKind === 'provider_report' ? 'Relatório do provedor' : 'Conciliação manual'} · {prepared!.metadata.sourceReference} · {plan.choice.action === 'hold' ? 'Evidência inconclusiva' : prepared!.metadata.reason === 'historical_mapping_correction' ? 'Correção de vínculo histórico' : 'Vínculo de catálogo conferido'}</dd></div><div><dt>Hash da prévia</dt><dd>{plan.planHash}</dd></div></dl>
      <details><summary>Ofertas e transações do produto na prévia ({plan.snapshot.candidates.length} / {plan.snapshot.transactions.length})</summary><p>O snapshot inclui todo o produto/conta/provedor, inclusive outras ofertas externas. Os IDs abaixo permitem conferir a origem; não indicam que todas as transações serão alteradas.</p>{plan.snapshot.candidates.map(row => <p key={row.id}>Oferta <Link href={'/admin/collections/offers/' + row.id}>{row.id}</Link> · livro {typeof row.ebook === 'string' ? row.ebook : row.ebook?.id || 'Não informado'} · oferta externa {row.externalOfferId || 'Não informada'}</p>)}{plan.snapshot.transactions.slice((previewPage - 1) * 20, previewPage * 20).map(row => <p key={row.id}>Transação <Link href={'/admin/collections/transactions/' + row.id}>{row.id}</Link> · estado {row.state} · {row.needsReview ? 'Revisão pendente' : 'Sem flag de revisão'}</p>)}{plan.snapshot.transactions.length > 20 && <p>Página {previewPage} de {Math.ceil(plan.snapshot.transactions.length / 20)} <button type="button" disabled={previewPage === 1} onClick={() => setPreviewPage(p => p - 1)}>Transações anteriores</button> <button type="button" disabled={previewPage * 20 >= plan.snapshot.transactions.length} onClick={() => setPreviewPage(p => p + 1)}>Próximas transações</button></p>}</details>
      {!result && <><label className="bibliotheon-ledger-checkbox"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)}/>{plan.choice.action === 'associate' ? 'Conferi a evidência, o escopo e o destino desta associação.' : 'Confirmo manter este escopo bloqueado por evidência inconclusiva.'}</label><button type="button" disabled={!confirmed || busy} onClick={commit} aria-busy={busy}>{busy ? 'Registrando decisão…' : 'Registrar decisão conferida'}</button>{busy && <p role="status">Aguardando a confirmação do servidor.</p>}</>}
      <button type="button" disabled={busy} onClick={edit}>{result ? 'Preparar outra decisão' : 'Voltar e preparar nova prévia'}</button>
    </section>}
  </>
}
