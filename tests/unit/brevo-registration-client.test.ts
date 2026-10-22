import { afterEach, describe, expect, it, vi } from 'vitest'
import { configuredBrevoRegistration, createBrevoContacts } from '../../src/integrations/brevo/contacts'
const email = 'reader@example.invalid'
const found = (blocked = false) => new Response(JSON.stringify({ id: 52, emailBlacklisted: blocked, email }), { status: 200 })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('cadastro de contato Brevo sem reativação', () => {
  it('exige flag própria e canal de bloqueios habilitado', () => {
    vi.stubEnv('BREVO_API_KEY', 'synthetic-only-key'); vi.stubEnv('BREVO_CONTACT_REGISTRATION_ENABLED', 'false'); vi.stubEnv('BREVO_CONTACT_SYNC_ENABLED', 'true')
    expect(configuredBrevoRegistration()).toBeNull()
    vi.stubEnv('BREVO_CONTACT_REGISTRATION_ENABLED', 'true'); vi.stubEnv('BREVO_CONTACT_SYNC_ENABLED', 'false')
    expect(configuredBrevoRegistration()).toBeNull()
    vi.stubEnv('BREVO_CONTACT_SYNC_ENABLED', 'true'); expect(configuredBrevoRegistration()).not.toBeNull()
  })
  it('consulta antes e não escreve em contato existente, inclusive bloqueado', async () => {
    for (const blocked of [true, false]) {
      const request = vi.fn<typeof fetch>().mockResolvedValue(found(blocked))
      expect(await createBrevoContacts('synthetic-only', request).ensure(email)).toEqual({ state: 'found', id: 52, blocked })
      expect(request).toHaveBeenCalledTimes(1)
    }
  })
  it('cria somente email com updateEnabled/forceMerge false e confirma por GET', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response('{ignored}', { status: 201 })).mockResolvedValueOnce(found())
    expect(await createBrevoContacts('synthetic-only', request).ensure(email)).toEqual({ state: 'found', id: 52, blocked: false })
    expect(request.mock.calls.map(([, options]) => options?.method)).toEqual(['GET', 'POST', 'GET'])
    expect(request.mock.calls[1][0]).toBe('https://api.brevo.com/v3/contacts')
    expect(JSON.parse(request.mock.calls[1][1]!.body as string)).toEqual({ email, updateEnabled: false, forceMerge: false })
    expect(request.mock.calls.every(([, options]) => options?.redirect === 'error')).toBe(true)
  })
  it('reconcilia timeout aplicado e conflito sem atualizar/reativar contato concorrente', async () => {
    for (const state of ['timeout', 'conflict'] as const) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 404 }))
      if (state === 'timeout') request.mockRejectedValueOnce(new Error('synthetic timeout'))
      else request.mockResolvedValueOnce(new Response('{}', { status: 400 }))
      request.mockResolvedValueOnce(found(true))
      expect(await createBrevoContacts('synthetic-only', request).ensure(email)).toEqual({ state: 'found', id: 52, blocked: true })
      expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
    }
  })
  it('201 não observado/425/429/5xx aguardam reconciliação; recusa definitiva não vira sucesso', async () => {
    for (const [code, state] of [[201, 'retry'], [425, 'retry'], [429, 'retry'], [503, 'retry'], [400, 'rejected'], [401, 'rejected']] as const) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response('{}', { status: code })).mockResolvedValueOnce(new Response(null, { status: 404 }))
      expect(await createBrevoContacts('synthetic-only', request).ensure(email)).toEqual({ state })
    }
  })
})
