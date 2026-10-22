import type { Payload } from 'payload'
import { configuredBrevoRegistration } from '../src/integrations/brevo/contacts'
import { validLinkSecret } from '../src/modules/marketing/tokens'
if (process.argv.includes('--help')) {
  console.log('brevo:contacts [--retry-failed] — sincroniza contatos consentidos; exige cadastro/bloqueios habilitados e chaves privadas. Não cria listas/campanhas nem envia mensagens.'); process.exit(0)
}
if (process.argv.slice(2).some(arg => arg !== '--retry-failed') || process.argv.slice(2).length > 1) {
  console.error('Use brevo:contacts sem argumentos ou somente --retry-failed.'); process.exit(1)
}
const client = configuredBrevoRegistration(), secret = process.env.LEAD_TOKEN_SECRET
if (!client || !validLinkSecret(secret)) {
  if (process.env.BREVO_CONTACT_REGISTRATION_ENABLED === 'true') { console.error('Cadastro habilitado com configuração inválida; confira bloqueios e chaves privadas.'); process.exit(1) }
  console.log(JSON.stringify({ enabled: false, examined: 0, synced: 0, pending: 0, failed: 0, canceled: 0, canceling: 0 })); process.exit(0)
}
let payload: Payload | undefined
try {
  const { getPayload } = await import('payload'), config = (await import('../src/payload.config')).default
  const { syncBrevoRegistrations, retryFailedBrevoRegistrations } = await import('../src/modules/marketing/brevo-registration')
  payload = await getPayload({ config })
  const retry = process.argv.includes('--retry-failed') ? await retryFailedBrevoRegistrations(payload) : { queued: 0 }
  console.log(JSON.stringify({ ...retry, ...await syncBrevoRegistrations(payload, { client, secret }) }))
} catch { console.error('Cadastro externo interrompido. Consulte estados e configuração privada; nenhum contato ou corpo foi exibido.'); process.exitCode = 1 }
finally { await payload?.destroy() }
process.exit(process.exitCode || 0)
