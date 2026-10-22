import type { Payload } from 'payload'
import { configuredBrevoCampaignDispatch } from '../src/integrations/brevo/campaign-dispatch'
import { configuredBrevoCampaigns } from '../src/integrations/brevo/campaigns'
import { configuredBrevoLists } from '../src/integrations/brevo/lists'
import { configuredBrevoPreferences } from '../src/integrations/brevo/preferences'
import { configuredBrevoContacts } from '../src/integrations/brevo/contacts'
import { validLinkSecret } from '../src/modules/marketing/tokens'
import { configuredQuotaPolicy } from '../src/modules/marketing/quota-policy'
const args=process.argv.slice(2)
if (args.length===1&&args[0]==='--help') { console.log('brevo:send <batch-id> [--retry-rejected] — solicita disparo imediato; resultado incerto não é repetido.');process.exit(0) }
if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(args[0]||'') || !(args.length===1||args.length===2&&args[1]==='--retry-rejected')) { console.error('Informe um lote válido e, opcionalmente, --retry-rejected.');process.exit(1) }
const dispatch=configuredBrevoCampaignDispatch(),campaigns=configuredBrevoCampaigns(),lists=configuredBrevoLists(),preferences=configuredBrevoPreferences(),contacts=configuredBrevoContacts(),secret=process.env.LEAD_TOKEN_SECRET
if (!dispatch||!campaigns||!lists||!preferences||!contacts||!validLinkSecret(secret)) {
  if (process.env.BREVO_CAMPAIGN_SEND_ENABLED==='true') { console.error('Disparo habilitado com configuração inválida; confira pipeline, remetente, origem e chaves privadas.');process.exit(1) }
  console.log(JSON.stringify({state:'disabled'}));process.exit(0)
}
let payload:Payload|undefined
try {
  const policy=configuredQuotaPolicy()
  const {getPayload}=await import('payload'),config=(await import('../src/payload.config')).default
  const {dispatchBrevoBatchCampaign}=await import('../src/modules/marketing/campaign-send')
  payload=await getPayload({config})
  console.log(JSON.stringify(await dispatchBrevoBatchCampaign(payload,args[0],{dispatch,campaigns,lists,preferences,contacts,secret,policy,retryRejected:args[1]==='--retry-rejected'})))
} catch { console.error('Disparo interrompido. Consulte intenção, histórico e quota privados; não repita uma tentativa incerta.');process.exitCode=1 }
finally {await payload?.destroy()}
process.exit(process.exitCode||0)
