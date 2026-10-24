import type { Payload } from 'payload'
import { webhookConfig } from '../src/integrations/brevo/webhook'
const args=process.argv.slice(2)
if(args.length===1&&args[0]==='--help'){console.log('brevo:webhook-replay <event-id> — reprocessa envelope mínimo em quarentena; não consulta nem envia à Brevo.');process.exit(0)}
if(args.length!==1||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(args[0]||'')){console.error('Informe o UUID de um evento persistido.');process.exit(1)}
const settings=webhookConfig()
if(!settings){if(process.env.BREVO_WEBHOOK_ENABLED==='true'){console.error('Configuração privada de webhook inválida.');process.exit(1)}console.log(JSON.stringify({state:'disabled'}));process.exit(0)}
let payload:Payload|undefined
try{
 const {getPayload}=await import('payload'),config=(await import('../src/payload.config')).default
 const {replayBrevoWebhook}=await import('../src/modules/marketing/brevo-webhook')
 payload=await getPayload({config})
 console.log(JSON.stringify(await replayBrevoWebhook(payload,args[0],settings)))
}catch{console.error('Reprocessamento interrompido; envelope preservado. Consulte a fila privada.');process.exitCode=1}
finally{await payload?.destroy()}
process.exit(process.exitCode||0)
