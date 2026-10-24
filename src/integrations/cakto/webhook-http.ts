import type {Payload} from 'payload'
import {receiveCommercialWebhook} from '../../modules/commerce/inbox'
import {createCaktoAdapter,caktoSignature,caktoWebhookConfig} from './webhook'
const MAX_BODY=262144
const response=(status:number,code:string)=>Response.json({code},{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow',...(status===503?{'Retry-After':'60'}:{})}})
/** Fresh signed raw bytes are required; body-secret-only delivery is never accepted. */
export async function handleCaktoWebhook(request:Request,payload:()=>Promise<Payload>,env:Readonly<Record<string,string|undefined>>=process.env){
 const config=caktoWebhookConfig(env)
 if(!config)return response(503,'unavailable')
 const signature=caktoSignature(request.headers)
 if(!signature)return response(401,'unauthorized')
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||request.headers.get('content-encoding')&&request.headers.get('content-encoding')?.trim().toLowerCase()!=='identity'||!request.body)return response(415,'unsupported_content')
 const length=request.headers.get('content-length')
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_BODY))return response(413,'body_too_large')
 const reader=request.body.getReader(),chunks:Uint8Array[]=[]
 let size=0,timer:ReturnType<typeof setTimeout>|undefined
 const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('body_timeout')),5000);timer.unref?.()})
 try{
  for(;;){const part=await Promise.race([reader.read(),deadline]);if(part.done)break;size+=part.value.byteLength;if(size>MAX_BODY){void reader.cancel().catch(()=>{});return response(413,'body_too_large')}chunks.push(part.value)}
 }catch{void reader.cancel().catch(()=>{});return response(503,'unavailable')}
 finally{clearTimeout(timer);reader.releaseLock()}
 try{
  const result=await receiveCommercialWebhook(payload,createCaktoAdapter(config),{provider:'cakto',accountKey:config.accountKey},Buffer.concat(chunks),request.headers)
  if(result.state==='received'||result.state==='duplicate'||result.state==='conflict')return response(200,'accepted')
  if(result.state==='unauthorized')return response(401,'unauthorized')
  if(result.state==='invalid_event')return response(422,'invalid_event')
  if(result.state==='too_large')return response(413,'body_too_large')
  return response(503,'unavailable')
 }catch{return response(503,'unavailable')}
}
