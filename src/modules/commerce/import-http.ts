import type {Payload} from 'payload'
import {CommercialCSVError,CSV_MAX_BYTES} from './csv'
import {previewCommercialCSV} from './import-preview'
import {CommercialImportError,importMetadata} from './import-plan'
import {stageCommercialImport,commitCommercialImport} from './import-service'
const response=(status:number,value:unknown)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}})
async function authorize(request:Request,payload:Payload,env:Readonly<Record<string,string|undefined>>){
 const {user}=await payload.auth({headers:request.headers})
 if(user?.collection!=='admin-users'||user.role!=='owner'||request.headers.get('origin')!==new URL(env.PUBLIC_SITE_URL||'http://127.0.0.1:3000').origin)throw new CommercialImportError(403,'forbidden')
 return{id:user.id,collection:user.collection,role:user.role}
}
export async function readCommercialBody(request:Request,max:number,mime:'text/csv'|'application/json'){
 const type=request.headers.get('content-type')?.toLowerCase(),encoding=request.headers.get('content-encoding')?.toLowerCase()
 const charsets=type?.split(';').slice(1).map(value=>value.trim()).filter(value=>/^charset\s*=/.test(value))??[]
 if(!type||type.split(';')[0].trim()!==mime||charsets.length>1||charsets.some(value=>!/^charset\s*=\s*(?:utf-8|"utf-8")$/.test(value))||encoding&&encoding!=='identity'||!request.body)throw new CommercialImportError(415,'unsupported_content')
 const length=request.headers.get('content-length')
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>max))throw new CommercialImportError(413,'too_large')
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0,timer:ReturnType<typeof setTimeout>|undefined
 const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new CommercialImportError(408,'body_timeout')),5000);timer.unref?.()})
 try{
  for(;;){const part=await Promise.race([reader.read(),deadline]);if(part.done)break;size+=part.value.byteLength;if(size>max)throw new CommercialImportError(413,'too_large');chunks.push(part.value)}
 }catch(error){void reader.cancel().catch(()=>{});if(error instanceof CommercialImportError)throw error;throw new CommercialImportError(408,'body_timeout')}
 finally{clearTimeout(timer);reader.releaseLock()}
 return Buffer.concat(chunks)
}
function failure(error:unknown){
 if(error instanceof CommercialCSVError)return response(error.code==='too_large'?413:422,{code:error.code,...(error.line?{line:error.line}:{})})
 if(error instanceof CommercialImportError)return response(error.status,{code:error.code})
 return response(503,{code:'unavailable'})
}
export async function previewCommercialImportRequest(request:Request,payload:Payload,env:Readonly<Record<string,string|undefined>>=process.env){
 try{await authorize(request,payload,env);return response(200,await previewCommercialCSV(payload,await readCommercialBody(request,CSV_MAX_BYTES,'text/csv')))}catch(error){return failure(error)}
}
export async function stageCommercialImportRequest(request:Request,payload:Payload,env:Readonly<Record<string,string|undefined>>=process.env){
 try{
  const actor=await authorize(request,payload,env),metadata=importMetadata({sourceKind:request.headers.get('x-import-source'),sourceReference:request.headers.get('x-import-reference'),reason:request.headers.get('x-import-reason')})
  if(!metadata)throw new CommercialImportError(422,'invalid_import_metadata')
  const result=await stageCommercialImport(payload,actor,await readCommercialBody(request,CSV_MAX_BYTES,'text/csv'),metadata,request.headers.get('idempotency-key'))
  return response(result.duplicate?200:201,result)
 }catch(error){return failure(error)}
}
export async function commitCommercialImportRequest(request:Request,id:string,payload:Payload,env:Readonly<Record<string,string|undefined>>=process.env){
 try{
  const actor=await authorize(request,payload,env),body=await readCommercialBody(request,4096,'application/json');let input:unknown
  try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body))}catch{throw new CommercialImportError(422,'invalid_confirmation')}
  const result=await commitCommercialImport(payload,actor,id,input)
  return response(result.state==='stale'?409:result.state==='queued'&&!result.duplicate?202:200,result)
 }catch(error){return failure(error)}
}
