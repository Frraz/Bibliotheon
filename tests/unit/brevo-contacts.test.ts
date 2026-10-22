import { afterEach, describe, expect, it, vi } from 'vitest'
import { configuredBrevoContacts, createBrevoContacts } from '../../src/integrations/brevo/contacts'
const email = 'reader+synthetic@example.invalid'
const contact = (blocked: boolean) => new Response(JSON.stringify({ id: 42, email, emailBlacklisted: blocked, statistics: { discarded: 'private-content' }, attributes: { SECRET: 'discarded' } }), { status: 200 })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('Brevo contacts: consulta e bloqueio monotônico', () => {
  it('exige ativação independente e chave válida, sem exigir remetente de mensagens', () => {
    vi.stubEnv('BREVO_CONTACT_SYNC_ENABLED', 'false'); vi.stubEnv('BREVO_API_KEY', 'synthetic-key')
    expect(configuredBrevoContacts()).toBeNull()
    vi.stubEnv('BREVO_CONTACT_SYNC_ENABLED', 'true'); vi.stubEnv('EMAIL_TRANSPORT_ENABLED', 'false')
    expect(configuredBrevoContacts()).not.toBeNull()
    for (const key of ['', 'REPLACE_KEY', 'secret\ninvalid']) { vi.stubEnv('BREVO_API_KEY', key); expect(configuredBrevoContacts()).toBeNull() }
  })
  it('projeta somente ID e bloqueio, sem preservar atributos/estatísticas', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(contact(true))
    expect(await createBrevoContacts('synthetic-key', request).inspect(email)).toEqual({ state: 'found', id: 42, blocked: true })
    const [url, options] = request.mock.calls[0]
    expect(url).toBe('https://api.brevo.com/v3/contacts/reader%2Bsynthetic%40example.invalid')
    expect(options?.redirect).toBe('error'); expect(options?.signal).toBeInstanceOf(AbortSignal)
  })
  it('confere antes/depois e só envia emailBlacklisted=true; nunca muda identidade nem desbloqueia', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(contact(false)).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(contact(true))
    expect(await createBrevoContacts('synthetic-key', request).block(email)).toEqual({ state: 'blocked' })
    expect(request.mock.calls.map(([, options]) => options?.method)).toEqual(['GET', 'PUT', 'GET'])
    expect(JSON.parse(request.mock.calls[1][1]!.body as string)).toEqual({ emailBlacklisted: true })
  })
  it('não grava nem cria contato ausente ou já bloqueado', async () => {
    for (const response of [new Response(null, { status: 404 }), contact(true)]) {
      const request = vi.fn<typeof fetch>().mockResolvedValue(response)
      expect(['absent', 'blocked']).toContain((await createBrevoContacts('synthetic-key', request).block(email)).state)
      expect(request).toHaveBeenCalledTimes(1)
    }
  })
  it('timeout/429/5xx são reconferíveis; 4xx definitivos ficam para revisão', async () => {
    for (const [code, state] of [[429, 'retry'], [503, 'retry'], [401, 'rejected'], [400, 'rejected']] as const) {
      const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('private-body', { status: code }))
      expect(await createBrevoContacts('synthetic-key', request).block(email)).toEqual({ state })
    }
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(contact(false)).mockRejectedValueOnce(new Error('private-transport-detail'))
    expect(await createBrevoContacts('synthetic-key', request).block(email)).toEqual({ state: 'retry' })
  })
  it('não confirma apenas pelo 204 nem aceita corpo inválido, outra identidade ou resposta excessiva', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(contact(false)).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(contact(false))
    expect(await createBrevoContacts('synthetic-key', request).block(email)).toEqual({ state: 'retry' })
    for (const body of ['{broken', JSON.stringify({ id: 42, emailBlacklisted: 'false' }), JSON.stringify({ id: 42, emailBlacklisted: true, email: 'other@example.invalid' }), JSON.stringify({ id: 42, emailBlacklisted: true, ignored: 'x'.repeat(70_000) })]) {
      const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 200 }))
      expect(await createBrevoContacts('synthetic-key', request).inspect(email)).toEqual({ state: 'retry' })
    }
  })
  it('recusa endereço não canônico sem chamar rede', async () => {
    const request = vi.fn<typeof fetch>()
    expect(await createBrevoContacts('synthetic-key', request).block('https://other.invalid')).toEqual({ state: 'retry' })
    expect(request).not.toHaveBeenCalled()
  })
})
