import type { Payload } from 'payload'
import { configuredBrevoContacts } from '../src/integrations/brevo/contacts'

if (process.argv.includes('--help')) {
  console.log('brevo:suppressions [--retry-failed] — sincroniza somente bloqueios; exige BREVO_CONTACT_SYNC_ENABLED=true e chave privada. Não envia mensagens.'); process.exit(0)
}
if (process.argv.slice(2).some(arg => arg !== '--retry-failed') || process.argv.slice(2).length > 1) {
  console.error('Use brevo:suppressions sem argumentos ou somente --retry-failed.'); process.exit(1)
}
const client = configuredBrevoContacts()
if (!client && process.env.BREVO_CONTACT_SYNC_ENABLED === 'true') { console.error('Sincronização habilitada com configuração inválida; confira a chave privada.'); process.exit(1) }
if (!client) { console.log(JSON.stringify({ enabled: false, examined: 0, synced: 0, pending: 0, failed: 0 })); process.exit(0) }
let payload: Payload | undefined
try {
  const { getPayload } = await import('payload'), config = (await import('../src/payload.config')).default
  const { syncBrevoSuppressions, retryFailedBrevoSuppressions } = await import('../src/modules/marketing/brevo-suppression')
  payload = await getPayload({ config })
  const retry = process.argv.includes('--retry-failed') ? await retryFailedBrevoSuppressions(payload) : { queued: 0 }
  console.log(JSON.stringify({ ...retry, ...await syncBrevoSuppressions(payload, { client }) }))
} catch { console.error('Sincronização interrompida. Consulte estados e configuração privada; nenhum endereço ou corpo foi exibido.'); process.exitCode = 1 }
finally { await payload?.destroy() }
process.exit(process.exitCode || 0)
