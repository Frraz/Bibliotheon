import type {Payload} from 'payload'
import {readCommercialBody} from './import-http'
import {CommercialImportError} from './import-plan'
import {previewTransactionReview,TransactionReviewError} from './transaction-review'
export const transactionReviewResponse=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}})
export async function transactionReviewRequest(request:Request,payload:Payload){
 try{
  const {user}=await payload.auth({headers:request.headers})
  if(user?.collection!=='admin-users'||user.role!=='owner'||request.headers.get('origin')!==new URL(process.env.PUBLIC_SITE_URL||'http://127.0.0.1:3000').origin)throw new TransactionReviewError(403,'forbidden')
  const bytes=await readCommercialBody(request,5*1024*1024,'application/json');let input:unknown
  try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new TransactionReviewError(422,'invalid_review_choice')}
  return transactionReviewResponse(await previewTransactionReview(payload,user,input))
 }catch(error){return transactionReviewResponse({code:error instanceof TransactionReviewError||error instanceof CommercialImportError?error.code:'unavailable'},error instanceof TransactionReviewError||error instanceof CommercialImportError?error.status:503)}
}
