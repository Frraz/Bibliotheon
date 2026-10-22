import { getPayload } from 'payload'
import config from '../src/payload.config'
import { preparePromotions } from '../src/modules/marketing/sequence'

const payload = await getPayload({ config })
try { console.log(JSON.stringify(await preparePromotions(payload))) }
catch { console.error('Não foi possível preparar o calendário. Consulte as etapas no painel.'); process.exitCode = 1 }
finally { await payload.destroy() }
process.exit(process.exitCode || 0)
