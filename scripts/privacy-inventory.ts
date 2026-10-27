import { getPayload } from 'payload'
import config from '../src/payload.config'
import { runPrivacyInventory } from '../src/modules/marketing/privacy-inventory'

if (process.argv.length !== 2) {
  console.error('Uso: npm run privacy:inventory')
  process.exit(2)
}

const payload = await getPayload({ config })
try { console.log(JSON.stringify(await runPrivacyInventory(payload))) }
finally { await payload.destroy() }
process.exit(0)
