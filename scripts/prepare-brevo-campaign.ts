import type { Payload } from 'payload'
import { configuredBrevoLists, positiveId } from '../src/integrations/brevo/lists'
import { configuredBrevoContacts } from '../src/integrations/brevo/contacts'
import { validLinkSecret } from '../src/modules/marketing/tokens'
import { configuredBrevoCampaigns } from '../src/integrations/brevo/campaigns'
import { configuredBrevoPreferences } from '../src/integrations/brevo/preferences'
const args = process.argv.slice(2)
if (args.includes('--help')) { console.log('brevo:campaigns <batch-id> [--campaign-id <id> | --retry-rejected] — prepara/concilia rascunho exclusivo, sem agendar ou enviar.'); process.exit(0) }
const batch = args[0]
let adoptCampaignId: number | undefined, retryRejected = false
if (args[1] === '--campaign-id' && args.length === 3 && /^[1-9]\d*$/.test(args[2])) adoptCampaignId = Number(args[2])
else if (args[1] === '--retry-rejected' && args.length === 2) retryRejected = true
else if (args.length !== 1) { console.error('Argumentos de preparação inválidos. Consulte --help.'); process.exit(1) }
if (!batch || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(batch) || adoptCampaignId !== undefined && !positiveId(adoptCampaignId)) { console.error('Identificadores de preparação inválidos.'); process.exit(1) }
const campaigns = configuredBrevoCampaigns(), preferences = configuredBrevoPreferences(), lists = configuredBrevoLists(), contacts = configuredBrevoContacts(), secret = process.env.LEAD_TOKEN_SECRET
if (!campaigns || !preferences || !lists || !contacts || !validLinkSecret(secret)) {
  if (process.env.BREVO_CAMPAIGN_SYNC_ENABLED === 'true') { console.error('Rascunhos habilitados com configuração inválida; confira remetente, listas, preferências e chaves privadas.'); process.exit(1) }
  console.log(JSON.stringify({ state: 'disabled' })); process.exit(0)
}
let payload: Payload | undefined
try {
  const { getPayload } = await import('payload'), config = (await import('../src/payload.config')).default
  const { prepareBrevoBatchCampaign } = await import('../src/modules/marketing/batch-campaigns')
  payload = await getPayload({ config })
  console.log(JSON.stringify(await prepareBrevoBatchCampaign(payload, batch, { campaigns, preferences, lists, contacts, secret, adoptCampaignId, retryRejected })))
} catch { console.error('Preparação interrompida. Consulte manifesto e estados privados; nenhum contato, corpo ou chave foi exibido.'); process.exitCode = 1 }
finally { await payload?.destroy() }
process.exit(process.exitCode || 0)
