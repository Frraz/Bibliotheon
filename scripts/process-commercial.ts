import type {Payload} from 'payload'
const args=process.argv.slice(2)
if(args.length===1&&args[0]==='--help'){console.log('commerce:process [1..25] — processa inbox autenticada; sem rede ou recepção pública.');process.exit(0)}
if(args.length>1||args.length===1&&!/^(?:[1-9]|1[0-9]|2[0-5])$/.test(args[0])){console.error('Informe um limite inteiro de 1 a 25.');process.exit(1)}
if(process.env.COMMERCIAL_EVENTS_ENABLED!=='true'){console.log(JSON.stringify({state:'disabled'}));process.exit(0)}
let payload:Payload|undefined
try{
 const {getPayload}=await import('payload'),config=(await import('../src/payload.config')).default
 const {processCommercialQueue}=await import('../src/modules/commerce/inbox')
 payload=await getPayload({config})
 console.log(JSON.stringify(await processCommercialQueue(payload,{limit:Number(args[0]||1)})))
}catch{console.error('Processamento interrompido. Consulte os estados privados da inbox.');process.exitCode=1}
finally{await payload?.destroy()}
process.exit(process.exitCode||0)
