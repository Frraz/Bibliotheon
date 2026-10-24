import type { Payload } from 'payload'
import { configuredBrevoCampaignObserver } from '../src/integrations/brevo/campaign-observer'
const args=process.argv.slice(2)
if(args.length===1&&args[0]==='--help'){console.log('brevo:observe <batch-id> [--refresh] — consulta campanha existente; nunca envia nem altera consentimento.');process.exit(0)}
if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(args[0]||'')||!(args.length===1||args.length===2&&args[1]==='--refresh')){console.error('Informe um lote válido e, opcionalmente, --refresh.');process.exit(1)}
const client=configuredBrevoCampaignObserver()
if(!client){if(process.env.BREVO_CAMPAIGN_OBSERVE_ENABLED==='true'){console.error('Observação habilitada exige chave privada de API válida.');process.exit(1)}console.log(JSON.stringify({state:'disabled'}));process.exit(0)}
let payload:Payload|undefined
try{
 const {getPayload}=await import('payload'),config=(await import('../src/payload.config')).default
 const {observeBrevoCampaign}=await import('../src/modules/marketing/campaign-observation')
 payload=await getPayload({config})
 console.log(JSON.stringify(await observeBrevoCampaign(payload,args[0],{client,refresh:args[1]==='--refresh'})))
}catch{console.error('Consulta interrompida. Consulte a observação privada; não reenvie a campanha.');process.exitCode=1}
finally{await payload?.destroy()}
process.exit(process.exitCode||0)
