import {describe, expect, it} from 'vitest'
import {ledgerAmountCents, ledgerAmountInput, ledgerMoney, ledgerUTC, newLedgerEntry, prepareLedgerEntry} from '../../src/modules/commerce/ledger-entry'

describe('monetary entry without rounding', () => {
  it('preserves zero, cents and the maximum safe integer through display and input', () => {
    for (const value of [0, 1, 99, 100, 123456, Number.MAX_SAFE_INTEGER]) expect(ledgerAmountCents(ledgerAmountInput(value))).toBe(value)
    expect(ledgerAmountCents('1234.5')).toBe(123450)
    expect(ledgerMoney(Number.MAX_SAFE_INTEGER, 'BRL')).toBe('90.071.992.547.409,91 BRL')
  })
  it.each(['', '1.000,00', '1,000.00', '1e3', '-1', '+1', '1,001', 'NaN', 'Infinity', ' 1', '01', '90071992547409,92', '999999999999999999'])('rejects ambiguous or unsafe input %s', value => expect(() => ledgerAmountCents(value)).toThrow())
})
describe('UTC financial entry', () => {
  it('does not reinterpret UTC as the browser timezone and preserves milliseconds in corrections', () => {
    expect(ledgerUTC('2026-10-20T12:00')).toBe('2026-10-20T12:00:00.000Z')
    expect(ledgerUTC('2026-10-20T12:00:05.123')).toBe('2026-10-20T12:00:05.123Z')
    expect(ledgerUTC('2024-02-29T01:02:03.1')).toBe('2024-02-29T01:02:03.100Z')
  })
  it.each(['2026-02-29T12:00', '2026-10-20T24:00', '2026-10-20T12:60', '2026-10-20', '2026-10-20T12:00Z', '2026-10-20T12:00-03:00'])('rejects rolled calendars or timezone ambiguity %s', value => expect(() => ledgerUTC(value)).toThrow())
  it('keeps unknown campaign and exact source identities on prepared entries', () => {
    const values = {...newLedgerEntry('cost'), amount: '123,45', occurredAt: '2026-10-20T12:00', sourceReference: 'source-one', recordReference: 'line-two'}
    expect(prepareLedgerEntry('cost', values, 'parent-id')).toMatchObject({amountCents: 12345, campaignId: null, incurredAt: '2026-10-20T12:00:00.000Z', sourceReference: 'source-one', recordReference: 'line-two', supersedes: 'parent-id'})
    expect(prepareLedgerEntry('settlement', {...values, direction: 'debit', sourceKind: 'provider_report'}, null)).toMatchObject({direction: 'debit', evidenceVerified: true, settledAt: '2026-10-20T12:00:00.000Z'})
  })
})


describe('signed financial display', () => {
  it.each([[-1, '-0,01 BRL'], [-99, '-0,99 BRL'], [-101, '-1,01 BRL'], [-9007199254740991, '-90.071.992.547.409,91 BRL']])('preserves negative cents %s without rounding', (value, expected) => {
    expect(ledgerMoney(value, 'BRL')).toBe(expected)
  })
})
