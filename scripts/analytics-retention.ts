import {getPayload} from 'payload'
import config from '../src/payload.config'
import {runAnalyticsRetention} from '../src/modules/analytics/retention'

const args=process.argv.slice(2)
if(args.some(arg=>!['--preview','--apply'].includes(arg))||args.length>1){
 console.error('Uso: npm run analytics:retention [--preview|--apply]')
 process.exit(2)
}
const apply=args[0]==='--apply'
const payload=await getPayload({config})
try{
 const report=await runAnalyticsRetention(payload,{apply})
 console.log(JSON.stringify(report))
}finally{await payload.destroy()}
process.exit(0)
