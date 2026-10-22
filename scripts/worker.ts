import { setTimeout } from 'node:timers/promises'
import { writeFile } from 'node:fs/promises'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { configuredTransport } from '../src/integrations/brevo/transactional'
import { dispatchEmail } from '../src/modules/marketing/dispatcher'
import { validLinkSecret } from '../src/modules/marketing/tokens'
import { configuredQuotaPolicy } from '../src/modules/marketing/quota-policy'
import { preparePromotions } from '../src/modules/marketing/sequence'

if (process.env.EMAIL_TRANSPORT_ENABLED !== 'true' || !configuredTransport() || !validLinkSecret(process.env.LEAD_TOKEN_SECRET)) throw new Error('Worker de e-mail desativado: configure transporte e chave privada antes de ativar.')
configuredQuotaPolicy()
const payload = await getPayload({ config })
let stopping = false
const shutdown = new AbortController()
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { stopping = true; shutdown.abort() })
try {
  do {
    try {
      await dispatchEmail(payload)
      await payload.jobs.run({ queue: 'email', limit: 1, overrideAccess: true, silent: true })
      await preparePromotions(payload)
      await writeFile('/tmp/bibliotheon-worker-health', String(Date.now()), { mode: 0o600 })
    } catch { console.error('Ciclo operacional falhou. Pendências duráveis serão retomadas; consulte os estados no painel.') }
    if (!process.argv.includes('--once') && !stopping) await setTimeout(30_000, undefined, { signal: shutdown.signal }).catch(() => {})
  } while (!process.argv.includes('--once') && !stopping)
} finally { await payload.destroy() }
process.exit(0)
