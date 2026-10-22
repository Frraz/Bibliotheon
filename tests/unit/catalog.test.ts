import { describe, expect, it } from 'vitest'
import { normalizeSearch, validSlug } from '../../src/modules/catalog/validation'
import { validCents, validCheckout } from '../../src/modules/commerce/checkout'
describe('catálogo e ofertas', () => {
  it('busca normaliza acentos sem alterar títulos', () => expect(normalizeSearch('  Edição e AÇÃO  ')).toBe('edicao e acao'))
  it('slugs recusam caminhos, Unicode e slug vazio', () => {
    for (const v of ['../ebook', 'ação', 'Foo', '', '-foo', 'foo--bar']) expect(validSlug(v)).toBe(false)
    expect(validSlug('um-livro-2')).toBe(true)
  })
  it('URL exige host exato, HTTPS e ausência de credenciais/fragmento/porta alternativa', () => {
    for (const url of ['https://pay.example.invalid.evil.test/a', 'https://pay.example.invalid@evil.test/', 'http://pay.example.invalid/', 'javascript:alert(1)', 'https://pay.example.invalid:8080/a', 'https://pay.example.invalid/a#b']) expect(validCheckout(url, ['pay.example.invalid'])).toBe(false)
    expect(validCheckout('https://pay.example.invalid/a?affiliate=abc&signature=xyz', ['pay.example.invalid'])).toBe(true)
    expect(validCheckout('https://pay.example.invalid/a', [])).toBe(false)
  })
  it('centavos não inferem nem arredondam valores desconhecidos', () => {
    for (const value of [null, undefined, '100', 1.5, -1, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(validCents(value)).toBe(false)
    expect(validCents(0)).toBe(true)
    expect(validCents(9900)).toBe(true)
  })
})
