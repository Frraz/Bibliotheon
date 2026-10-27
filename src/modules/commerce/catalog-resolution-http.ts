import type {Payload} from 'payload'
import {readCommercialBody} from './import-http'
import {CommercialImportError} from './import-plan'
import {CatalogResolutionError,previewCatalogResolution,decideCatalogResolution} from './catalog-resolutions'
export const catalogResolutionResponse=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}})
export async function catalogResolutionRequest(request:Request,payload:Payload,preview=false){
 try{
  const {user}=await payload.auth({headers:request.headers})
  if(user?.collection!=='admin-users'||user.role!=='owner'||request.headers.get('origin')!==new URL(process.env.PUBLIC_SITE_URL||'http://127.0.0.1:3000').origin)throw new CatalogResolutionError(403,'forbidden')
  const body=await readCommercialBody(request,4096,'application/json');let input:unknown
  try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body))}catch{throw new CatalogResolutionError(422,'invalid_input')}
  if(preview)return catalogResolutionResponse(await previewCatalogResolution(payload,user,input))
  const decision=await decideCatalogResolution(payload,user,input,request.headers.get('idempotency-key'))
  return catalogResolutionResponse(decision,decision.duplicate?200:201)
 }catch(error){return catalogResolutionResponse({code:error instanceof CatalogResolutionError||error instanceof CommercialImportError?error.code:'unavailable'},error instanceof CatalogResolutionError||error instanceof CommercialImportError?error.status:503)}
}
