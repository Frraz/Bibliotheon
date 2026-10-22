import type { Payload } from 'payload'
import { configuredBrevoLists, positiveId } from '../src/integrations/brevo/lists'
import { configuredBrevoContacts } from '../src/integrations/brevo/contacts'
import { validLinkSecret } from '../src/modules/marketing/tokens'
const args = process.argv.slice(2)
if (args.includes('--help')) { console.log('brevo:lists <batch-id> [--list-id <id> | --retry-rejected] — prepara/concilia lista exclusiva, sem criar campanha ou enviar.'); process.exit(0) }
const batch = args[0]
let adoptListId: number | undefined, retryRejected = false
if (args[1] === '--list-id' && args.length === 3 && /^[1-9]\d*$/.test(args[2])) adoptListId = Number(args[2])
else if (args[1] === '--retry-rejected' && args.length === 2) retryRejected = true
else if (args.length !== 1) { console.error('Argumentos de preparação inválidos. Consulte --help.'); process.exit(1) }
if (!batch || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(batch) || adoptListId !== undefined && !positiveId(adoptListId)) { console.error('Identificadores de preparação inválidos.'); process.exit(1) }
const lists = configuredBrevoLists(), contacts = configuredBrevoContacts(), secret = process.env.LEAD_TOKEN_SECRET
if (!lists || !contacts || !validLinkSecret(secret)) {
  if (process.env.BREVO_LIST_SYNC_ENABLED === 'true') { console.error('Listas habilitadas com configuração inválida; confira pasta, bloqueios e chaves privadas.'); process.exit(1) }
  console.log(JSON.stringify({ state: 'disabled' })); process.exit(0)
}
let payload: Payload | undefined
try {
  const { getPayload } = await import('payload'), config = (await import('../src/payload.config')).default
  const { prepareBrevoBatchList } = await import('../src/modules/marketing/batch-lists')
  payload = await getPayload({ config })
  console.log(JSON.stringify(await prepareBrevoBatchList(payload, batch, { lists, contacts, secret, adoptListId, retryRejected })))
} catch { console.error('Preparação interrompida. Consulte manifesto e estados privados; nenhum contato, corpo ou chave foi exibido.'); process.exitCode = 1 }
finally { await payload?.destroy() }
process.exit(process.exitCode || 0)
