import { afterEach, describe, expect, it, vi } from 'vitest'
import { canReserve, configuredQuotaPolicy, quotaWindow, validateQuotaPolicy } from '../../src/modules/marketing/quota-policy'

afterEach(() => vi.unstubAllEnvs())

describe('quota compartilhada de e-mail', () => {
  const policy = { limit: 250, transactionalReserve: 50 }
  it('protege a reserva e conta destinatários, sem reservar parcialmente um lote', () => {
    expect(canReserve(policy, 0, 200, 'promotional')).toBe(true)
    expect(canReserve(policy, 0, 201, 'promotional')).toBe(false)
    expect(canReserve(policy, 199, 2, 'promotional')).toBe(false)
    expect(canReserve(policy, 200, 1, 'promotional')).toBe(false)
    expect(canReserve(policy, 200, 50, 'transactional')).toBe(true)
    expect(canReserve(policy, 250, 1, 'transactional')).toBe(false)
    expect(canReserve(policy, 251, 1, 'transactional')).toBe(false)
    expect(canReserve(policy, 10, 190, 'promotional')).toBe(true)
  })
  it('rejeita configurações e contagens que liberariam capacidade indevida', () => {
    for (const limit of [0, -1, 251, 2.5, NaN, Infinity]) expect(() => validateQuotaPolicy({ ...policy, limit })).toThrow()
    for (const transactionalReserve of [0, -1, 251, 0.5, NaN]) expect(() => validateQuotaPolicy({ ...policy, transactionalReserve })).toThrow()
    for (const count of [0, -1, 1.5, NaN, Infinity]) expect(() => canReserve(policy, 0, count, 'promotional')).toThrow()
    for (const used of [-1, 0.5, NaN, Infinity]) expect(() => canReserve(policy, used, 1, 'transactional')).toThrow()
  })
  it('usa limite conservador de 250 e reserva configurável, inclusive limite reduzido', () => {
    vi.stubEnv('BREVO_DAILY_QUOTA', undefined)
    vi.stubEnv('BREVO_TRANSACTIONAL_RESERVE', undefined)
    expect(configuredQuotaPolicy()).toEqual(policy)
    vi.stubEnv('BREVO_DAILY_QUOTA', '20')
    expect(configuredQuotaPolicy()).toEqual({ limit: 20, transactionalReserve: 20 })
    vi.stubEnv('BREVO_TRANSACTIONAL_RESERVE', '5')
    expect(configuredQuotaPolicy()).toEqual({ limit: 20, transactionalReserve: 5 })
    vi.stubEnv('BREVO_TRANSACTIONAL_RESERVE', '21')
    expect(() => configuredQuotaPolicy()).toThrow()
  })
  it('vira o orçamento à meia-noite UTC independentemente do fuso de apresentação', () => {
    expect(quotaWindow(Date.parse('2030-01-01T23:59:59.999Z'))).toEqual({ day: '2030-01-01', nextDayAt: '2030-01-02T00:00:00.000Z' })
    expect(quotaWindow(Date.parse('2030-01-02T00:00:00Z')).day).toBe('2030-01-02')
    expect(() => quotaWindow(NaN)).toThrow()
  })
})
