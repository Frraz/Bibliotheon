import { afterEach, describe, expect, it, vi } from 'vitest'
import { configuredTransport } from '../../src/integrations/brevo/transactional'
const message = { to: 'reader@example.invalid', subject: 'Solicitação sintética', text: 'Somente teste.' }
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
function enable() {
  vi.stubEnv('EMAIL_TRANSPORT_ENABLED', 'true')
  vi.stubEnv('BREVO_API_KEY', 'synthetic-only-key')
  vi.stubEnv('BREVO_SENDER_EMAIL', 'sender@example.invalid')
}
describe('Classificação conservadora do transporte Brevo', () => {
  it('não cria transporte sem ativação explícita e remetente configurado', () => {
    vi.stubEnv('EMAIL_TRANSPORT_ENABLED', 'false')
    expect(configuredTransport()).toBeNull()
    enable(); vi.stubEnv('BREVO_SENDER_EMAIL', '')
    expect(configuredTransport()).toBeNull()
  })
  it('não repete cegamente timeout, erro do servidor ou sucesso sem identificador', async () => {
    enable()
    const send = configuredTransport()!
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('synthetic timeout'))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    for (let i = 0; i < 3; i++) expect(await send(message)).toEqual({ state: 'uncertain' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
  it('distingue rate limit, recusa definitiva e aceitação com ID', async () => {
    enable()
    const send = configuredTransport()!
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(new Response('{}', { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messageId: 'synthetic-provider-id' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await send(message)).toEqual({ state: 'retry' })
    expect(await send(message)).toEqual({ state: 'rejected' })
    expect(await send(message)).toEqual({ state: 'sent', messageId: 'synthetic-provider-id' })
    expect(fetchMock.mock.calls.every(([url, options]) => url === 'https://api.brevo.com/v3/smtp/email' && options.redirect === 'error')).toBe(true)
  })
})
