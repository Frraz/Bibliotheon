import { describe, expect, it } from 'vitest'
import { parseProvisionInput } from '../../src/modules/admin/provision-input'
describe('provisionamento privado', () => {
  it('não expõe conteúdo sensível quando o JSON está malformado', () => {
    const sensitive = 'SENTINELA_CREDENCIAL_PRIVADA'
    try { parseProvisionInput(`{"password":"${sensitive}`); throw new Error('Esperava recusa') }
    catch (error) { expect((error as Error).message).not.toContain(sensitive); expect((error as Error).message).toContain('JSON válido') }
  })
  it('recusa senha com tipo inesperado antes de chamar o CMS', () => expect(() => parseProvisionInput('{"email":"teste@example.invalid","password":1234567890123456}')).toThrow('senha'))
  it('aceita cinco caracteres e recusa quatro', () => {
    const email = 'teste@example.invalid'
    expect(parseProvisionInput(JSON.stringify({ email, password: 'abcde' })).password).toBe('abcde')
    expect(() => parseProvisionInput(JSON.stringify({ email, password: 'abcd' }))).toThrow('5 caracteres')
  })
  it('normaliza endereço sem alterar senha', () => expect(parseProvisionInput('{"email":"Teste@Example.invalid","password":"synthetic-password-123"}')).toEqual({ email: 'teste@example.invalid', password: 'synthetic-password-123' }))
  it('recusa campos extras, senha excessiva e controles sem revelar a entrada', () => {
    const base = { email: 'teste@example.invalid', password: 'synthetic-password-123' }
    for (const value of [{ ...base, role: 'owner' }, { ...base, password: 'a'.repeat(1025) }, { ...base, password: 'senha-com-nulo-123\0' }, { ...base, email: 'a@example.invalid\u0001' }, []]) expect(() => parseProvisionInput(JSON.stringify(value))).toThrow()
    expect(parseProvisionInput(JSON.stringify({ ...base, password: 'á'.repeat(512) })).password).toHaveLength(512)
    expect(() => parseProvisionInput(JSON.stringify({ ...base, password: 'á'.repeat(513) }))).toThrow()
  })
})
