import type { Payload } from 'payload'
import { configuredBrevoPreferences } from '../src/integrations/brevo/preferences'
import { configuredBrevoContacts } from '../src/integrations/brevo/contacts'
import { validLinkSecret } from '../src/modules/marketing/tokens'
const args = process.argv.slice(2)
if (args.length === 1 && args[0] === '--help') { console.log('brevo:preferences <batch-id> — prepara links individuais; não cria campanha nem envia.'); process.exit(0) }
if (args.length !== 1 || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(args[0])) { console.error('Informe um identificador de lote válido. Consulte --help.'); process.exit(1) }
const preferences = configuredBrevoPreferences(), contacts = configuredBrevoContacts(), secret = process.env.LEAD_TOKEN_SECRET
if (!preferences || !contacts || !validLinkSecret(secret)) {
  if (process.env.BREVO_PREFERENCE_SYNC_ENABLED === 'true') { console.error('Preferências habilitadas com configuração inválida; confira origem, bloqueios e chaves privadas.'); process.exit(1) }
  console.log(JSON.stringify({ state: 'disabled' })); process.exit(0)
}
let payload: Payload | undefined
try {
  const { getPayload } = await import('payload'), config = (await import('../src/payload.config')).default
  const { prepareBrevoBatchPreferences } = await import('../src/modules/marketing/batch-preferences')
  payload = await getPayload({ config })
  console.log(JSON.stringify(await prepareBrevoBatchPreferences(payload, args[0], { preferences, contacts, secret })))
} catch { console.error('Preparação interrompida. Consulte estados privados; nenhum link, contato ou chave foi exibido.'); process.exitCode = 1 }
finally { await payload?.destroy() }
process.exit(process.exitCode || 0)
