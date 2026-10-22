import { describe, expect, it } from 'vitest'
import { PROVIDER_CHECK_TTL, validProviderCheck } from '../../src/modules/marketing/batch-check-copy'
const now = Date.parse('2026-10-22T12:00:00.000Z')
const recipients = [{ contact: 'contact-one', version: 'revision-one' }, { contact: 'contact-two', version: 'revision-two' }]
const receipt = { version: 1, batchKey: 'batch-key', checkedAt: new Date(now).toISOString(), recipients: recipients.map((recipient, index) => ({ ...recipient, providerId: index + 1 })) }
describe('conferência recente de destinatários', () => {
  it('vincula lote, destinatários únicos, versão local e IDs do provedor', () => {
    expect(validProviderCheck(receipt, 'batch-key', recipients, now)).toBe(true)
    expect(validProviderCheck({ ...receipt, recipients: [...receipt.recipients].reverse() }, 'batch-key', recipients, now)).toBe(true)
    expect(validProviderCheck(receipt, 'other-batch', recipients, now)).toBe(false)
    expect(validProviderCheck(receipt, 'batch-key', [{ ...recipients[0], version: 'newer' }, recipients[1]], now)).toBe(false)
    for (const entries of [[receipt.recipients[0], receipt.recipients[0]], [{ contact: 'unknown-one', providerId: 1 }, { contact: 'unknown-two', providerId: 2 }], [{ ...receipt.recipients[0], providerId: 0 }, receipt.recipients[1]], [receipt.recipients[0], { ...receipt.recipients[1], providerId: 1 }]]) expect(validProviderCheck({ ...receipt, recipients: entries }, 'batch-key', recipients, now)).toBe(false)
  })
  it('expira em cinco minutos e recusa observação futura, incompleta ou inválida', () => {
    expect(validProviderCheck(receipt, 'batch-key', recipients, now + PROVIDER_CHECK_TTL)).toBe(true)
    expect(validProviderCheck(receipt, 'batch-key', recipients, now + PROVIDER_CHECK_TTL + 1)).toBe(false)
    expect(validProviderCheck(receipt, 'batch-key', recipients, now - 1)).toBe(false)
    for (const invalid of [null, {}, { ...receipt, checkedAt: 'invalid' }, { ...receipt, recipients: receipt.recipients.slice(0, 1) }]) expect(validProviderCheck(invalid, 'batch-key', recipients, now)).toBe(false)
    expect(validProviderCheck(receipt, 'batch-key', recipients, NaN)).toBe(false)
  })
})
