import { describe, expect, it } from 'vitest'
import { createOpaqueToken, DOWNLOAD_TTL, hashOpaqueToken, signDownload, verifyDownload } from '../../src/modules/marketing/tokens'
import { CONSENT_VERSION, parseLeadInput } from '../../src/modules/marketing/validation'
const id = '0d5841e8-1dcc-46c3-a0e7-51b6a034dc97'
const secret = 'chave-sintetica-exclusiva-do-teste-01'
const now = Date.UTC(2026, 9, 21)
describe('Links privados de amostra', () => {
  it('gera tokens independentes com 256 bits e guarda somente hash', () => {
    const first = createOpaqueToken(), second = createOpaqueToken()
    expect(first.token).not.toBe(second.token)
    expect(Buffer.from(first.token, 'base64url')).toHaveLength(32)
    expect(first.hash).not.toContain(first.token)
    expect(hashOpaqueToken(first.token)).toBe(first.hash)
    for (const value of [null, {}, '', first.token + 'x', '../arquivo', 'a'.repeat(1000)]) expect(hashOpaqueToken(value)).toBeNull()
  })
  it('recusa alteração, finalidade diferente, chave errada e expiração exata', () => {
    const token = signDownload(id, secret, now)
    expect(verifyDownload(token, secret, now + DOWNLOAD_TTL - 1)).toBe(id)
    expect(verifyDownload(token, secret, now + DOWNLOAD_TTL)).toBeNull()
    expect(verifyDownload(token, secret, now - 1)).toBeNull()
    expect(verifyDownload(token, secret + 'outra', now)).toBeNull()
    expect(verifyDownload(token.replace('eyJ', 'eyK'), secret, now)).toBeNull()
    expect(verifyDownload(createOpaqueToken().token, secret, now)).toBeNull()
    expect(() => signDownload(id, 'curta', now)).toThrow()
  })
})
describe('Solicitação e consentimento separados', () => {
  it('preserva alias e aceita amostra sem inscrição', () => {
    expect(parseLeadInput({ email: ' Pessoa.Silva+Livro@Example.invalid ', magnetId: id, marketingOptIn: false })).toEqual({ email: 'pessoa.silva+livro@example.invalid', magnetId: id, marketingOptIn: false })
  })
  it('não interpreta strings como consentimento nem aceita versão desconhecida', () => {
    const base = { email: 'leitor@example.invalid', magnetId: id }
    for (const marketingOptIn of ['true', 'false', 1, null, undefined]) expect(parseLeadInput({ ...base, marketingOptIn })).toBeNull()
    expect(parseLeadInput({ ...base, marketingOptIn: true })).toBeNull()
    expect(parseLeadInput({ ...base, marketingOptIn: true, consentVersion: CONSENT_VERSION })?.marketingOptIn).toBe(true)
    expect(parseLeadInput({ ...base, marketingOptIn: false, role: 'owner' })).toBeNull()
    expect(parseLeadInput({ ...base, email: 'a@example.invalid\r\nBcc:outro', marketingOptIn: false })).toBeNull()
  })
})
