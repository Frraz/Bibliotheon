import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrevoLists, configuredBrevoLists } from '../../src/integrations/brevo/lists'
const name = 'bibliotheon-11111111-1111-4111-8111-111111111111'
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('contrato de listas Brevo', () => {
  it('exige flag própria, bloqueios, pasta e chave válidos', () => {
    vi.stubEnv('BREVO_LIST_SYNC_ENABLED', 'false'); vi.stubEnv('BREVO_CONTACT_SYNC_ENABLED', 'true'); vi.stubEnv('BREVO_API_KEY', 'synthetic'); vi.stubEnv('BREVO_LIST_FOLDER_ID', '12')
    expect(configuredBrevoLists()).toBeNull()
    vi.stubEnv('BREVO_LIST_SYNC_ENABLED', 'true'); expect(configuredBrevoLists()).not.toBeNull()
    for (const folder of ['', '0', '-1', '1.5', '1e2']) { vi.stubEnv('BREVO_LIST_FOLDER_ID', folder); expect(configuredBrevoLists()).toBeNull() }
  })
  it('cria apenas nome/pasta e não aceita 201 sem ID; nunca envia campanhas', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ id: 10 }, 201)).mockResolvedValueOnce(response({}, 201))
    const client = createBrevoLists('synthetic', 12, request)
    expect(await client.create(name)).toEqual({ state: 'created', id: 10 })
    expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toEqual({ name, folderId: 12 })
    expect(request.mock.calls[0][0]).toBe('https://api.brevo.com/v3/contacts/lists')
    expect(await client.create(name)).toEqual({ state: 'retry' })
    expect(request.mock.calls.every(([, options]) => options?.redirect === 'error')).toBe(true)
  })
  it('reconcilia por nome exato com paginação e recusa nomes duplicados', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ count: 51, lists: Array.from({ length: 50 }, (_, index) => ({ id: index + 1, name: 'other' })) })).mockResolvedValueOnce(response({ count: 51, lists: [{ id: 51, name }] }))
    expect(await createBrevoLists('synthetic', 12, request).find(name)).toEqual({ state: 'found', id: 51 })
    expect(String(request.mock.calls[1][0])).toContain('offset=50')
    const duplicate = vi.fn<typeof fetch>().mockResolvedValue(response({ count: 2, lists: [{ id: 1, name }, { id: 2, name }] }))
    expect(await createBrevoLists('synthetic', 12, duplicate).find(name)).toEqual({ state: 'conflict' })
  })
  it('confere destinatários por IDs paginados, sem conservar email/atributos/estatísticas', async () => {
    const data = (id: number) => ({ id, email: 'discarded@example.invalid', emailBlacklisted: false, listUnsubscribed: [], attributes: { PRIVATE: 'discarded' } })
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ count: 51, contacts: Array.from({ length: 50 }, (_, i) => data(i + 1)) })).mockResolvedValueOnce(response({ count: 51, contacts: [data(51)] }))
    const result = await createBrevoLists('synthetic', 12, request).members(10)
    expect(result.state).toBe('members')
    if (result.state === 'members') { expect(result.contacts).toHaveLength(51); expect(result.contacts[0]).toEqual({ id: 1, blocked: false, unsubscribed: false }); expect(JSON.stringify(result)).not.toContain('@') }
  })
  it('limita inclusão a 150 IDs distintos e não toma reconhecimento parcial como composição conferida', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({ success: [1], failure: [2] }, 201))
    const client = createBrevoLists('synthetic', 12, request)
    expect(await client.add(10, [1, 2])).toEqual({ state: 'acknowledged' })
    expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toEqual({ ids: [1, 2] })
    for (const ids of [[], [1, 1], [0], Array.from({ length: 151 }, (_, i) => i + 1)]) expect(await client.add(10, ids)).toEqual({ state: 'rejected' })
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('ausência de flags não prova consentimento na lista e respostas inválidas nunca viram lista vazia', async () => {
    const unknown = vi.fn<typeof fetch>().mockResolvedValue(response({ count: 1, contacts: [{ id: 1, emailBlacklisted: false }] }))
    expect(await createBrevoLists('synthetic', 12, unknown).members(10)).toEqual({ state: 'members', contacts: [{ id: 1, blocked: false, unsubscribed: null }] })
    for (const value of [{ count: 201, contacts: [] }, { contacts: [] }, { count: 1, contacts: [{ id: 1 }] }, { count: 2, contacts: [{ id: 1, emailBlacklisted: false }, { id: 1, emailBlacklisted: false }] }]) {
      const request = vi.fn<typeof fetch>().mockResolvedValue(response(value))
      expect((await createBrevoLists('synthetic', 12, request).members(10)).state).not.toBe('members')
    }
  })
})
