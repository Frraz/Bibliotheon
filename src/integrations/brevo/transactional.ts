export type MailMessage = { to: string; subject: string; text: string }
export type MailResult = { state: 'sent'; messageId: string } | { state: 'retry' | 'rejected' | 'uncertain' }
export type MailTransport = (message: MailMessage) => Promise<MailResult>

export function configuredTransport(): MailTransport | null {
  const apiKey = process.env.BREVO_API_KEY
  const email = process.env.BREVO_SENDER_EMAIL
  const name = process.env.BREVO_SENDER_NAME || 'Bibliotheon'
  if (process.env.EMAIL_TRANSPORT_ENABLED !== 'true' || !apiKey || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\x00-\x1f\x7f]/.test(apiKey + email + name)) return null
  return async message => {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', signal: AbortSignal.timeout(15_000), redirect: 'error',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: { email, name }, to: [{ email: message.to }], subject: message.subject, textContent: message.text }),
      })
      if (response.status === 429) { await response.body?.cancel(); return { state: 'retry' } }
      if (response.status >= 400 && response.status < 500) { await response.body?.cancel(); return { state: 'rejected' } }
      if (response.status !== 201) { await response.body?.cancel(); return { state: 'uncertain' } }
      const text = await response.text()
      if (text.length > 8192) return { state: 'uncertain' }
      const result = JSON.parse(text)
      if (typeof result.messageId !== 'string' || result.messageId.length > 254 || /[\r\n]/.test(result.messageId)) return { state: 'uncertain' }
      return { state: 'sent', messageId: result.messageId }
    } catch {
      // A timeout may happen after acceptance. Never log the response, recipient or link.
      return { state: 'uncertain' }
    }
  }
}
