'use client'
import { useState, type FormEvent } from 'react'

export function SuppressionForm() {
  const [email, setEmail] = useState(''), [reason, setReason] = useState('unsubscribed'), [source, setSource] = useState('manual')
  const [reference, setReference] = useState(''), [reviewed, setReviewed] = useState(false), [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(''), [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !reviewed) return
    setBusy(true); setStatus(''); setError('')
    const ref = reference || crypto.randomUUID()
    setReference(ref)
    try {
      const response = await fetch('/api/v1/admin/suppressions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, reason, source, reference: ref }) })
      if (!response.ok) { setError(response.status === 403 ? 'Sua sessão expirou ou a origem não foi aceita. Entre novamente no painel.' : response.status === 422 ? 'Revise o endereço e a referência. Uma referência já usada deve corresponder ao mesmo contato e motivo.' : 'Não foi possível confirmar o registro. Mantenha a referência e tente novamente.'); return }
      const result = await response.json() as { applied: boolean; canceledPending: number; inFlight: number }
      setStatus(`${result.applied ? 'Bloqueio registrado.' : 'Esta conferência já estava registrada.'} ${result.canceledPending} entrega(s) pendente(s) cancelada(s).${result.inFlight ? ` ${result.inFlight} envio(s) já iniciado(s): confira no provedor.` : ''}`)
      setEmail(''); setReference(''); setReviewed(false)
    } catch { setError('Não foi possível confirmar o registro. Mantenha a referência e tente novamente.') }
    finally { setBusy(false) }
  }
  return <form className="bibliotheon-operational-form" action="/api/v1/admin/suppressions" method="post" onSubmit={submit} aria-busy={busy}>
    <fieldset disabled={busy}><legend>Dados da conferência</legend>
      <label htmlFor="suppression-email">E-mail do contato</label><input id="suppression-email" name="email" type="email" autoComplete="off" required maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setReviewed(false) }} />
      <label htmlFor="suppression-reason">Motivo</label><select id="suppression-reason" name="reason" value={reason} onChange={event => { setReason(event.target.value); setReviewed(false) }}><option value="unsubscribed">Pedido de descadastro</option><option value="bounced">Devolução permanente (hard bounce)</option><option value="complaint">Reclamação de spam</option></select>
      <label htmlFor="suppression-source">Onde você conferiu?</label><select id="suppression-source" name="source" value={source} onChange={event => { setSource(event.target.value); setReviewed(false) }}><option value="manual">Solicitação recebida diretamente</option><option value="brevo-review">Conta Brevo</option></select>
      <details><summary>Referência da conferência</summary><p id="suppression-reference-help">Opcional: use o identificador do evento, sem dados pessoais. Um identificador será criado automaticamente se deixar vazio. Preserve a referência ao repetir uma tentativa.</p><label htmlFor="suppression-reference">Identificador</label><input id="suppression-reference" name="reference" type="text" maxLength={128} pattern="[A-Za-z0-9._:\-]+" aria-describedby="suppression-reference-help" value={reference} onChange={event => { setReference(event.target.value); setReviewed(false) }} /></details>
      <label className="bibliotheon-review"><input name="reviewed" type="checkbox" required checked={reviewed} onChange={event => setReviewed(event.target.checked)} />Conferi o endereço e o motivo do bloqueio.</label>
      <button type="submit" disabled={!reviewed || busy}>{busy ? 'Registrando…' : 'Registrar bloqueio'}</button>
    </fieldset>
    <p role="status">{status}</p>{error && <p role="alert">{error}</p>}
    <noscript>Ative JavaScript para registrar a conferência neste formulário.</noscript>
  </form>
}
