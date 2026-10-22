'use client'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { CONSENT_TEXT, CONSENT_VERSION } from '../modules/marketing/validation'

async function submit(endpoint: string, data: unknown) {
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'omit', cache: 'no-store' })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error?.message || 'Não foi possível concluir. Tente novamente mais tarde.')
  return body
}
export function SampleForm({ magnetId, campaignCode }: { magnetId: string; campaignCode?: string }) {
  const [pending, setPending] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget, fields = new FormData(form)
    setPending(true); setError(''); setMessage('')
    try {
      const marketingOptIn = fields.get('marketing') === 'on'
      const result = await submit('/api/v1/lead-requests', { email: fields.get('email'), magnetId, marketingOptIn, ...(marketingOptIn ? { consentVersion: CONSENT_VERSION } : {}), ...(campaignCode ? { campaignCode } : {}) })
      setMessage(result.message); form.reset()
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível enviar. Tente novamente.') }
    finally { setPending(false) }
  }
  return <form className="sample-form" method="post" action="/api/v1/lead-requests" onSubmit={send} aria-busy={pending}>
    <label htmlFor="sample-email">Seu e-mail</label>
    <input id="sample-email" name="email" type="email" autoComplete="email" maxLength={254} required aria-describedby="sample-explanation" disabled={pending} />
    <p id="sample-explanation" className="muted">Enviaremos um link para confirmar sua solicitação. A amostra não exige assinatura de marketing.</p>
    <label className="consent-option"><input name="marketing" type="checkbox" disabled={pending} /><span>{CONSENT_TEXT}</span></label>
    <p className="muted">Saiba como tratamos seus dados no <Link href="/privacidade">aviso de privacidade</Link>.</p>
    <button className="button" type="submit" disabled={pending}>{pending ? 'Solicitando…' : 'Solicitar amostra'}</button>
    <p role="status" aria-live="polite">{message}</p>{error && <p role="alert">{error}</p>}
    <noscript><p>Ative o JavaScript para enviar este formulário. O catálogo e os links de compra continuam disponíveis.</p></noscript>
  </form>
}
export function TokenAction({ token, kind }: { token: string; kind: 'confirmation' | 'unsubscribe' }) {
  const [pending, setPending] = useState(false), [result, setResult] = useState<{ message?: string; downloadUrl?: string; title?: string } | null>(null), [error, setError] = useState('')
  async function act() {
    if (pending) return
    setPending(true); setError('')
    try { setResult(await submit(kind === 'confirmation' ? '/api/v1/lead-confirmations' : '/api/v1/unsubscribe', { token })) }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.') }
    finally { setPending(false) }
  }
  return <div className="sample-form" aria-busy={pending}>
    {!result && <button className="button" type="button" onClick={act} disabled={pending || !token}>{pending ? 'Processando…' : kind === 'confirmation' ? 'Confirmar e acessar amostra' : 'Cancelar marketing por e-mail'}</button>}
    {result?.downloadUrl && <><p role="status">Solicitação confirmada. Sua amostra está disponível.</p><a className="button" href={result.downloadUrl} download>Baixar {result.title}</a><p className="muted">O link vale por 24 horas. A entrega por e-mail pode levar alguns minutos.</p></>}
    {result?.message && <p role="status">{result.message}</p>}
    {error && <p role="alert">{error}</p>}
    {!token && <p role="alert">O link está incompleto. Abra o endereço completo recebido por e-mail.</p>}
    <noscript><p>Ative o JavaScript para confirmar esta ação. Abrir esta página não confirma o pedido nem altera suas preferências.</p></noscript>
  </div>
}
