import { describe, expect, it } from 'vitest'
import { parseSuppressionInput } from '../../src/modules/marketing/suppression'

describe('Revisão manual de supressões', () => {
  const base = { email: 'Leitor+Livro@Example.invalid', reason: 'bounced', source: 'brevo-review', reference: 'synthetic-review-01' }
  it('normaliza endereço preservando alias e exige referência revisada', () => {
    expect(parseSuppressionInput(base)).toEqual({ ...base, email: 'leitor+livro@example.invalid' })
    for (const reason of ['unsubscribed', 'bounced', 'complaint']) expect(parseSuppressionInput({ ...base, reason })?.reason).toBe(reason)
  })
  it('recusa desbloqueio, coerção, payload arbitrário e referência com dados de contato', () => {
    for (const reason of ['ok', 'subscribed', ['bounced'], true, null]) expect(parseSuppressionInput({ ...base, reason })).toBeNull()
    for (const source of ['webhook', ['manual'], null]) expect(parseSuppressionInput({ ...base, source })).toBeNull()
    for (const reference of ['', 'a'.repeat(129), 'leitor@example.invalid', 'event\n01', null]) expect(parseSuppressionInput({ ...base, reference })).toBeNull()
    expect(parseSuppressionInput({ ...base, payload: {} })).toBeNull()
    expect(parseSuppressionInput({ ...base, email: 'a@example.invalid\r\nBcc:b' })).toBeNull()
  })
})
