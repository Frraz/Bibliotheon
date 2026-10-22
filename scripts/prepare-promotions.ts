import { getPayload } from 'payload'
import config from '../src/payload.config'
import { preparePromotionBatches } from '../src/modules/marketing/batches'

const payload = await getPayload({ config })
try { console.log(JSON.stringify(await preparePromotionBatches(payload))) }
catch { console.error('Não foi possível preparar o calendário. Consulte as etapas no painel.'); process.exitCode = 1 }
finally { await payload.destroy() }
process.exit(process.exitCode || 0)
