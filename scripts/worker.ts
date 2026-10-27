import { processCommercialQueue } from '../src/modules/commerce/inbox'
import { configuredBrevoCampaignObserver } from '../src/integrations/brevo/campaign-observer'
import { observePromotionCampaigns } from '../src/modules/marketing/campaign-observation'
import { setTimeout } from 'node:timers/promises'
import { writeFile, rename } from 'node:fs/promises'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { syncBrevoRegistrations, syncBrevoRegistrationCleanup } from '../src/modules/marketing/brevo-registration'
import { configuredBrevoContacts, configuredBrevoRegistration } from '../src/integrations/brevo/contacts'
import { syncBrevoSuppressions } from '../src/modules/marketing/brevo-suppression'
import { configuredBrevoCampaignDispatch } from '../src/integrations/brevo/campaign-dispatch'
import { configuredBrevoLists } from '../src/integrations/brevo/lists'
import { configuredBrevoPreferences } from '../src/integrations/brevo/preferences'
import { dispatchPromotionCampaigns } from '../src/modules/marketing/campaign-send'
import { configuredTransport } from '../src/integrations/brevo/transactional'
import { dispatchEmail } from '../src/modules/marketing/dispatcher'
import { validLinkSecret } from '../src/modules/marketing/tokens'
import { configuredQuotaPolicy } from '../src/modules/marketing/quota-policy'
import { preparePromotionBatches } from '../src/modules/marketing/batches'
import { runAnalyticsRetention } from '../src/modules/analytics/retention'
import { runPrivacyRequestAuditRetention } from '../src/modules/marketing/privacy-retention'

const commercialEnabled = process.env.COMMERCIAL_EVENTS_ENABLED === 'true'
const retentionEnabled = process.env.DATA_RETENTION_ENABLED === 'true'
const emailEnabled = process.env.EMAIL_TRANSPORT_ENABLED === 'true'
const observer = configuredBrevoCampaignObserver()
const promotional = configuredBrevoCampaignDispatch()
const contactSync = configuredBrevoContacts()
const registration = configuredBrevoRegistration()
if (retentionEnabled && !validLinkSecret(process.env.LEAD_TOKEN_SECRET)) throw new Error('Retenção automática exige uma chave privada de links estável e válida.')
if (contactSync && !validLinkSecret(process.env.LEAD_TOKEN_SECRET)) throw new Error('Worker de bloqueios exige chave privada de links para recuperar compensações.')
if (process.env.BREVO_CONTACT_REGISTRATION_ENABLED === 'true' && (!registration || !validLinkSecret(process.env.LEAD_TOKEN_SECRET))) throw new Error('Cadastro externo desativado: configure bloqueios, chave de API e chave privada de links.')
if (emailEnabled && (!configuredTransport() || !validLinkSecret(process.env.LEAD_TOKEN_SECRET))) throw new Error('Worker de e-mail desativado: configure transporte e chave privada antes de ativar.')
if (process.env.BREVO_CONTACT_SYNC_ENABLED === 'true' && !contactSync) throw new Error('Sincronização de bloqueios desativada: confira a configuração privada.')
if (process.env.BREVO_CAMPAIGN_OBSERVE_ENABLED === 'true' && !observer) throw new Error('Observação de campanhas exige chave privada de API válida.')
if (!emailEnabled && !contactSync && !observer && !commercialEnabled && !retentionEnabled) throw new Error('Worker desativado: habilite uma função operacional antes de iniciar.')
if (process.env.BREVO_CAMPAIGN_SEND_ENABLED === 'true' && (!promotional || !configuredBrevoLists() || !configuredBrevoPreferences() || !validLinkSecret(process.env.LEAD_TOKEN_SECRET))) throw new Error('Disparo promocional desativado: confira pipeline, origem e chaves privadas antes de iniciar.')
if (emailEnabled || promotional) configuredQuotaPolicy()
const heartbeat = () => writeFile('/tmp/bibliotheon-worker-health', String(Date.now()), { mode: 0o600 })
const payload = await getPayload({ config })
let stopping = false
let retentionDay = ''
const shutdown = new AbortController()
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { stopping = true; shutdown.abort() })
try {
  do {
    try {
      if (commercialEnabled && !stopping) { await processCommercialQueue(payload, {limit: 1}); await heartbeat() }
      if (observer && !stopping) { await observePromotionCampaigns(payload, { client: observer, limit: 1 }); await heartbeat() }
      if (emailEnabled) {
        await dispatchEmail(payload)
        await payload.jobs.run({ queue: 'email', limit: 1, overrideAccess: true, silent: true })
        await heartbeat()
      }
      if (contactSync && !stopping) { await syncBrevoSuppressions(payload, { client: contactSync, limit: 1 }); await heartbeat() }
      if (contactSync && !stopping) { await syncBrevoRegistrationCleanup(payload, { client: contactSync, limit: 1 }); await heartbeat() }
      if (registration && !stopping) { await syncBrevoRegistrations(payload, { client: registration, limit: 1 }); await heartbeat() }
      if ((emailEnabled || contactSync || promotional) && !stopping) { await preparePromotionBatches(payload); await heartbeat() }
      if (promotional && !stopping) { await dispatchPromotionCampaigns(payload, { dispatch: promotional }); await heartbeat() }
      const utcDay = new Date().toISOString().slice(0, 10)
      if (retentionEnabled && !stopping && retentionDay !== utcDay) {
        const report = await runAnalyticsRetention(payload, { apply: true })
        const privacyReport = await runPrivacyRequestAuditRetention(payload, { apply: true })
        console.log(`Retenção analítica ${report.mode}: ${JSON.stringify(report.processed)}`)
        console.log(`Retenção de auditoria de privacidade ${privacyReport.mode}: ${JSON.stringify({ processed: privacyReport.processed })}`)
        console.log(`Retenção promocional ${privacyReport.mode}: ${JSON.stringify(privacyReport.suppressedMarketing)}`)
        console.log(`Retenção de identidades ${privacyReport.mode}: ${JSON.stringify(privacyReport.closedIdentities)}`)
        console.log('Retenção temática ' + JSON.stringify(privacyReport.withdrawnThemes))
        console.log('Provas temáticas legadas ' + JSON.stringify(privacyReport.legacyThemeWithdrawals))
        console.log('Prazo de marketing ' + JSON.stringify(privacyReport.marketingDeadline))
        const retentionHealthFile = `/tmp/bibliotheon-retention-health-${process.pid}.tmp`
        await writeFile(retentionHealthFile, JSON.stringify({ version: 1, completedAt: Date.now(), overdueSubscriptions: privacyReport.marketingDeadline.overdueSubscriptions }), { mode: 0o600 })
        await rename(retentionHealthFile, '/tmp/bibliotheon-retention-health')
        retentionDay = utcDay
        await heartbeat()
      }
      if (!stopping) await heartbeat()
    } catch { console.error('Ciclo operacional falhou. Pendências duráveis serão retomadas; consulte os estados no painel.') }
    if (!process.argv.includes('--once') && !stopping) await setTimeout(30_000, undefined, { signal: shutdown.signal }).catch(() => {})
  } while (!process.argv.includes('--once') && !stopping)
} finally { await payload.destroy() }
process.exit(0)
