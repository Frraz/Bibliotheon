'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CONSENT_TEXT, CONSENT_VERSION } from '../modules/marketing/validation'

async function submit(endpoint: string, data: unknown) {
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'omit', cache: 'no-store' })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error?.message || 'Não foi possível concluir. Tente novamente mais tarde.')
  return body
}
function focusFeedbackWhenLost(target: HTMLElement | null) {
  const active = document.activeElement
  if (!active || active === document.body || active === document.documentElement) target?.focus()
}
export function SampleForm({ magnetId, campaignCode }: { magnetId: string; campaignCode?: string }) {
  const [pending, setPending] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  const statusRef = useRef<HTMLParagraphElement>(null), errorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (!pending && (error || message)) focusFeedbackWhenLost(error ? errorRef.current : statusRef.current)
  }, [pending, error, message])
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
    <input id="sample-email" name="email" type="email" autoComplete="email" maxLength={254} required aria-describedby={error ? 'sample-explanation sample-error' : 'sample-explanation'} disabled={pending} />
    <p id="sample-explanation" className="muted">Enviaremos um link para confirmar sua solicitação. A amostra não exige assinatura de marketing.</p>
    <label className="consent-option"><input name="marketing" type="checkbox" disabled={pending} /><span>{CONSENT_TEXT}</span></label>
    <p className="muted">Saiba como tratamos seus dados no <Link href="/privacidade">aviso de privacidade</Link>.</p>
    <button className="button" type="submit" disabled={pending}>{pending ? 'Solicitando…' : 'Solicitar amostra'}</button>
    <p role="status" aria-live="polite" tabIndex={-1} ref={statusRef}>{message}</p>{error && <p id="sample-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
    <noscript><p>Ative o JavaScript para enviar este formulário. O catálogo e os links de compra continuam disponíveis.</p></noscript>
  </form>
}
export function TokenAction({ token, kind, onSuccess }: { token: string; kind: 'confirmation' | 'unsubscribe'; onSuccess?: () => void }) {
  const [pending, setPending] = useState(false), [result, setResult] = useState<{ message?: string; downloadUrl?: string; title?: string } | null>(null), [error, setError] = useState('')
  const downloadRef = useRef<HTMLAnchorElement>(null), statusRef = useRef<HTMLParagraphElement>(null), errorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (!pending && (error || result)) focusFeedbackWhenLost(error ? errorRef.current : result?.downloadUrl ? downloadRef.current : statusRef.current)
  }, [pending, error, result])
  async function act() {
    if (pending) return
    setPending(true); setError('')
    try { setResult(await submit(kind === 'confirmation' ? '/api/v1/lead-confirmations' : '/api/v1/unsubscribe', { token })); onSuccess?.() }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.') }
    finally { setPending(false) }
  }
  return <div className="sample-form" aria-busy={pending}>
    {!result && <button className="button" type="button" onClick={act} disabled={pending || !token}>{pending ? 'Processando…' : kind === 'confirmation' ? 'Confirmar e acessar amostra' : 'Cancelar marketing por e-mail'}</button>}
    {result?.downloadUrl && <><p role="status">Solicitação confirmada. Sua amostra está disponível.</p><a className="button" href={result.downloadUrl} download ref={downloadRef}>Baixar {result.title}</a><p className="muted">O link vale por 24 horas. A entrega por e-mail pode levar alguns minutos.</p></>}
    {result?.message && <p role="status" tabIndex={-1} ref={statusRef}>{result.message}</p>}
    {error && <p role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
    {!token && <p role="alert">O link está incompleto. Abra o endereço completo recebido por e-mail.</p>}
    <noscript><p>Ative o JavaScript para confirmar esta ação. Abrir esta página não confirma o pedido nem altera suas preferências.</p></noscript>
  </div>
}


export function ThemePreferences({ token }: { token: string }) {
  const [pending, setPending] = useState(false)
  const [themes, setThemes] = useState<{ id: string; title: string }[] | null>(null)
  const [message, setMessage] = useState(''), [error, setError] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null), statusRef = useRef<HTMLParagraphElement>(null), errorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (!pending && (error || message || themes !== null)) focusFeedbackWhenLost(error ? errorRef.current : message ? statusRef.current : headingRef.current)
  }, [pending, error, message, themes])
  async function act(theme?: string) {
    if (pending) return
    setPending(true); setError(''); setMessage('')
    try {
      if (theme) {
        const result = await submit('/api/v1/preferences', { token, action: 'unsubscribe-theme', theme })
        setThemes(current => current?.filter(item => item.id !== theme) ?? null)
        setMessage(result.message)
      } else {
        const result = await submit('/api/v1/preferences', { token, action: 'read' })
        setThemes(result.themes)
        if (result.suppressed) setMessage('O marketing por e-mail está bloqueado para este contato.')
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.') }
    finally { setPending(false) }
  }
  return <div className="sample-form" aria-busy={pending}>
    <h2 tabIndex={-1} ref={headingRef}>Escolher por assunto</h2>
    <p>Consulte suas assinaturas e cancele apenas os assuntos que quiser. Para assinar novamente, solicite uma amostra com a opção de marketing e confirme o novo pedido.</p>
    {themes === null && <button type="button" className="button" disabled={pending || !token} onClick={() => act()}>{pending ? 'Consultando…' : 'Consultar minhas assinaturas'}</button>}
    {themes?.map(theme => <div key={theme.id}><p>{theme.title}</p><button type="button" className="button" disabled={pending} onClick={() => act(theme.id)} aria-label={`Cancelar e-mails sobre ${theme.title}`}>Cancelar este assunto</button></div>)}
    {themes?.length === 0 && <p>Não há assinaturas de assuntos ativas.</p>}
    <p role="status" aria-live="polite" tabIndex={-1} ref={statusRef}>{message}</p>
    {error && <p role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
  </div>
}


export function PreferencesActions({ token }: { token: string }) {
  const [canceled, setCanceled] = useState(false)
  return <>
    {!canceled && <ThemePreferences token={token} />}
    <h2>Cancelar todo o marketing</h2>
    <TokenAction token={token} kind="unsubscribe" onSuccess={() => setCanceled(true)} />
  </>
}
