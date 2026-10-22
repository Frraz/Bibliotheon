import { describe, expect, it, vi, afterEach } from 'vitest'
import { createBrevoPreferences, configuredBrevoPreferences, PREFERENCE_ATTRIBUTE } from '../../src/integrations/brevo/preferences'
import { derivePreferenceToken, preferenceOrigin } from '../../src/modules/marketing/preference-links'
import { hashOpaqueToken } from '../../src/modules/marketing/tokens'
const origin = 'https://bibliotheon.example.invalid', email = 'person@example.invalid', url = `${origin}/preferencias?t=${'a'.repeat(43)}`
const schema = () => Response.json({ attributes: [{ name: PREFERENCE_ATTRIBUTE, category: 'normal', type: 'text' }] })
const contact = (value?: string, extra = {}) => Response.json({ id: 41, email, emailBlacklisted: false, attributes: value ? { [PREFERENCE_ATTRIBUTE]: value } : {}, ...extra })
afterEach(() => vi.unstubAllEnvs())
describe('links privados no Brevo', () => {
  it('deriva token opaco por titular/nonce/chave e recusa origem insegura ou com credenciais', () => {
    const person='00000000-0000-0000-0000-000000000001', nonce='00000000-0000-0000-0000-000000000002', secret='synthetic-key-private-at-least-32-bytes'
    const token=derivePreferenceToken(person,nonce,secret)
    expect(token).toHaveLength(43); expect(hashOpaqueToken(token)).not.toBeNull()
    expect(derivePreferenceToken(person,nonce,secret)).toBe(token)
    expect(derivePreferenceToken(nonce,person,secret)).not.toBe(token)
    expect(derivePreferenceToken(person,nonce,secret+'2')).not.toBe(token)
    for (const invalid of ['http://public.example.invalid','https://user:pass@example.invalid','https://example.invalid/path','https://example.invalid/?t=secret','https://example.invalid/#x','ftp://127.0.0.1']) expect(()=>preferenceOrigin(invalid)).toThrow()
    expect(preferenceOrigin('http://127.0.0.1:3001')).toBe('http://127.0.0.1:3001')
  })
  it('confere schema, PUT exclusivo do atributo e GET; timeout aplicado pode ser reconciliado', async () => {
    const request=vi.fn<typeof fetch>().mockResolvedValueOnce(schema()).mockResolvedValueOnce(contact()).mockRejectedValueOnce(new Error('synthetic timeout')).mockResolvedValueOnce(contact(url))
    expect(await createBrevoPreferences('synthetic',origin,request).ensure(41,email,url)).toEqual({ state:'verified' })
    const [target, options]=request.mock.calls[2]
    expect(target).toBe('https://api.brevo.com/v3/contacts/41?identifierType=contact_id')
    expect(JSON.parse(String(options?.body))).toEqual({ attributes:{ [PREFERENCE_ATTRIBUTE]:url } })
    expect(options?.redirect).toBe('error'); expect(options?.signal).toBeDefined()
  })
  it('atributo existente evita escrita e schema válido pode ser reutilizado', async () => {
    const request=vi.fn<typeof fetch>().mockImplementation(async () => contact(url)).mockResolvedValueOnce(schema())
    const client=createBrevoPreferences('synthetic',origin,request)
    expect(await client.ensure(41,email,url)).toEqual({ state:'verified' })
    expect(await client.ensure(41,email,url)).toEqual({ state:'verified' })
    expect(request).toHaveBeenCalledTimes(3)
    expect(request.mock.calls.every(([,options])=>options?.method==='GET')).toBe(true)
  })
  it('schema ausente/incompatível/duplicado e identidade/bloqueio impedem PUT', async () => {
    for (const attributes of [[],[{ name:PREFERENCE_ATTRIBUTE,category:'normal',type:'date' }],[{name:PREFERENCE_ATTRIBUTE,category:'normal',type:'text'},{name:PREFERENCE_ATTRIBUTE,category:'normal',type:'text'}]]) {
      const request=vi.fn<typeof fetch>().mockResolvedValue(Response.json({ attributes }))
      expect(await createBrevoPreferences('synthetic',origin,request).ensure(41,email,url)).toEqual({ state:'rejected' }); expect(request).toHaveBeenCalledTimes(1)
    }
    for (const [extra,state] of [[{email:'other@example.invalid'},'retry'],[{id:42},'retry'],[{emailBlacklisted:true},'blocked']] as const) {
      const request=vi.fn<typeof fetch>().mockResolvedValueOnce(schema()).mockResolvedValueOnce(contact(undefined,extra))
      expect(await createBrevoPreferences('synthetic',origin,request).ensure(41,email,url)).toEqual({ state }); expect(request).toHaveBeenCalledTimes(2)
    }
  })
  it('204 ignorado não basta; estados indisponíveis/recusa são conservadores', async () => {
    for (const [code,state] of [[204,'retry'],[400,'rejected'],[429,'retry'],[503,'retry']] as const) {
      const request=vi.fn<typeof fetch>().mockResolvedValueOnce(schema()).mockResolvedValueOnce(contact()).mockResolvedValueOnce(new Response(null,{status:code})).mockResolvedValueOnce(contact())
      expect(await createBrevoPreferences('synthetic',origin,request).ensure(41,email,url)).toEqual({ state })
    }
  })
  it('não envia para URL externa, token inválido ou ID/endereço malformado; respostas grandes falham fechadas', async () => {
    const request=vi.fn<typeof fetch>()
    const client=createBrevoPreferences('synthetic',origin,request)
    for (const [id,mail,link] of [[0,email,url],[41,'wrong',url],[41,email,'https://foreign.example.invalid/preferencias?t='+ 'a'.repeat(43)],[41,email,origin+'/preferencias?t=invalid']] as const) expect(await client.ensure(id,mail,link)).toEqual({state:'rejected'})
    expect(request).not.toHaveBeenCalled()
    request.mockResolvedValueOnce(new Response('x'.repeat(65_537)))
    expect(await client.ensure(41,email,url)).toEqual({state:'retry'})
  })
  it('flag desativada ou configuração incompleta não habilita cliente', () => {
    vi.stubEnv('BREVO_PREFERENCE_SYNC_ENABLED','false'); expect(configuredBrevoPreferences()).toBeNull()
    vi.stubEnv('BREVO_PREFERENCE_SYNC_ENABLED','true'); vi.stubEnv('BREVO_CONTACT_SYNC_ENABLED','false'); expect(configuredBrevoPreferences()).toBeNull()
    vi.stubEnv('BREVO_CONTACT_SYNC_ENABLED','true'); vi.stubEnv('BREVO_API_KEY','synthetic'); vi.stubEnv('PUBLIC_SITE_URL',origin); expect(configuredBrevoPreferences()).not.toBeNull()
  })
})
