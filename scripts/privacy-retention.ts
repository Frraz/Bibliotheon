import { getPayload } from 'payload'
import config from '../src/payload.config'
import { runPrivacyRequestAuditRetention } from '../src/modules/marketing/privacy-retention'

const args = process.argv.slice(2)
if (args.some(arg => !['--preview', '--apply'].includes(arg)) || args.length > 1) {
  console.error('Uso: npm run privacy:retention [--preview|--apply]')
  process.exit(2)
}
const payload = await getPayload({ config })
try {
  const report = await runPrivacyRequestAuditRetention(payload, { apply: args[0] === '--apply' })
  console.log(JSON.stringify(report))
} finally { await payload.destroy() }
process.exit(0)
