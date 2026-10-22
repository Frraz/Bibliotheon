import { configuredBrevoCampaigns } from './campaigns'
export type CampaignDispatchResult = { state: 'submitted'; code: 204 } | { state: 'rejected'; code: 400 | 402 | 404 } | { state: 'uncertain' }
export type BrevoCampaignDispatch = { sendNow(id: number): Promise<CampaignDispatchResult> }
/** 204 means scheduled for immediate dispatch; no individual delivery is inferred. */
export function createBrevoCampaignDispatch(key: string, request: typeof fetch = fetch): BrevoCampaignDispatch {
  if (!key || key.startsWith('REPLACE_') || /[\x00-\x20\x7f]/.test(key)) throw new Error('Configuração de envio inválida.')
  return { async sendNow(id) {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Campanha inválida.')
    try {
      const response = await request(`https://api.brevo.com/v3/emailCampaigns/${id}/sendNow`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { 'api-key': key, Accept: 'application/json' } })
      await response.body?.cancel().catch(() => {})
      if (response.status === 204) return { state: 'submitted', code: 204 }
      if (response.status === 400 || response.status === 402 || response.status === 404) return { state: 'rejected', code: response.status }
      // Includes undocumented 4xx, throttling and failures that can follow acceptance.
      return { state: 'uncertain' }
    } catch { return { state: 'uncertain' } }
  } }
}
export function configuredBrevoCampaignDispatch(): BrevoCampaignDispatch | null {
  if (process.env.BREVO_CAMPAIGN_SEND_ENABLED !== 'true' || !configuredBrevoCampaigns()) return null
  try { return createBrevoCampaignDispatch(process.env.BREVO_API_KEY || '') } catch { return null }
}
