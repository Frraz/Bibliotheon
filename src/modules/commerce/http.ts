import {randomUUID} from 'node:crypto'
import type {Payload} from 'payload'
import {privateJSON,readInput} from '../marketing/http'
import {LeadFlowError} from '../marketing/service'
import {CommercialError,retryCommercialInbox,retryReasons,type RetryReason} from './inbox'

/** Actor comes exclusively from Payload authentication, never from request JSON. */
export async function retryCommercialRequest(request:Request,id:string,payload:Payload){
 try{
  const {user}=await payload.auth({headers:request.headers})
  if(user?.collection!=='admin-users'||user.role!=='owner')throw new CommercialError(403,'forbidden')
  if(request.headers.get('origin')!==new URL(process.env.PUBLIC_SITE_URL||'http://127.0.0.1:3000').origin)throw new CommercialError(403,'forbidden')
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw new CommercialError(422,'invalid_input')
  const input=await readInput(request)
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||!('reason'in input)||!retryReasons.includes(input.reason as RetryReason))throw new CommercialError(422,'invalid_reason')
  const result=await retryCommercialInbox(payload,id,input.reason as RetryReason,user)
  return privateJSON(result,result.state==='queued'?202:200)
 }catch(error){
  const known=error instanceof CommercialError||error instanceof LeadFlowError
  return privateJSON({error:{code:known?error.code:'unavailable',requestId:randomUUID()}},known?error.status:503)
 }
}
