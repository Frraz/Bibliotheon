import { describe, expect, it } from 'vitest'
import { ACTIVE_MARKETING_REVIEW_MONTHS, MARKETING_RETENTION_DEADLINE_MS, MARKETING_RETENTION_ELIGIBILITY_MS, RETENTION_SUCCESS_MAX_AGE_MS, activeMarketingReviewCutoff, activeMarketingReviewRequired, marketingRetentionCutoff, workerHealth } from '../../src/modules/marketing/retention-policy'

const now = Date.UTC(2026,9,27), heartbeat = String(now)
const success = (completedAt = now, overdueSubscriptions = 0, activeMarketingReviews = 0) => JSON.stringify({version:2, completedAt, overdueSubscriptions, activeMarketingReviews})
describe('Prazo operacional e saúde da retenção', () => {
  it('antecipa elegibilidade e reserva margem para o ciclo diário antes dos 30 dias', () => {
    expect(MARKETING_RETENTION_ELIGIBILITY_MS + RETENTION_SUCCESS_MAX_AGE_MS).toBeLessThan(MARKETING_RETENTION_DEADLINE_MS)
    expect(marketingRetentionCutoff(now)).toBe('2026-09-29T00:00:00.000Z')
    for (let hour=0;hour<24;hour++) {
      const withdrawnAt = now + hour * 3600000
      const eligibleAt = withdrawnAt + MARKETING_RETENTION_ELIGIBILITY_MS
      const nextDailyCycle = Math.ceil(eligibleAt / 86400000) * 86400000
      expect(nextDailyCycle).toBeLessThan(withdrawnAt + MARKETING_RETENTION_DEADLINE_MS)
    }
  })
  it('usa dias UTC corridos em fim de mês e rejeita relógio inválido', () => {
    expect(marketingRetentionCutoff(Date.parse('2024-03-01T12:00:00.000Z'))).toBe('2024-02-02T12:00:00.000Z')
    expect(()=>marketingRetentionCutoff(NaN)).toThrow()
  })
  it('revisa opt-in antigo após 12 meses-calendário e não considera datas inválidas como renovação', () => {
    const cutoff = activeMarketingReviewCutoff(Date.parse('2025-03-31T12:00:00.000Z'))
    expect(ACTIVE_MARKETING_REVIEW_MONTHS).toBe(12)
    expect(cutoff).toBe('2024-03-31T12:00:00.000Z')
    expect(activeMarketingReviewRequired(cutoff, Date.parse('2025-03-31T12:00:00.000Z'))).toBe(true)
    expect(activeMarketingReviewRequired('2024-04-01T00:00:00.000Z', Date.parse('2025-03-31T12:00:00.000Z'))).toBe(false)
    expect(activeMarketingReviewRequired(undefined, now)).toBe(true)
    expect(activeMarketingReviewRequired('invalid', now)).toBe(true)
    expect(activeMarketingReviewRequired(new Date(now + 1).toISOString(), now)).toBe(true)
    expect(()=>activeMarketingReviewCutoff(NaN)).toThrow()
  })
  it('exige heartbeat recente mesmo quando a retenção está desligada', () => {
    expect(workerHealth(heartbeat, undefined, false, now)).toBe(true)
    for (const value of ['', 'invalid', String(now+1), String(now-90001)]) expect(workerHealth(value, undefined, false, now)).toBe(false)
    expect(workerHealth(String(now-90000), undefined, false, now)).toBe(true)
  })
  it('retenção habilitada exige sucesso íntegro recente e ausência de assinaturas para revisão', () => {
    expect(workerHealth(heartbeat, success(), true, now)).toBe(true)
    expect(workerHealth(heartbeat, success(now-RETENTION_SUCCESS_MAX_AGE_MS), true, now)).toBe(true)
    for (const value of [undefined, '', 'null', '{}', success(now+1), success(now-RETENTION_SUCCESS_MAX_AGE_MS-1), success(now,1), success(now,-1), success(now,0,1), success(now,0,-1), JSON.stringify({version:1,completedAt:now,overdueSubscriptions:0})]) expect(workerHealth(heartbeat, value, true, now)).toBe(false)
  })
})
