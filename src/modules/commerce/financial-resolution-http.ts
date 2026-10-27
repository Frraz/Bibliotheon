import type {Payload} from 'payload'
import {readCommercialBody} from './import-http'
import {CommercialImportError} from './import-plan'
import {TransactionReviewError} from './transaction-review'
import {transactionReviewResponse} from './transaction-review-http'
import {decideFinancialResolution} from './financial-resolutions'
export async function financialResolutionRequest(request:Request,payload:Payload){
 try{
  const {user}=await payload.auth({headers:request.headers})
  if(user?.collection!=='admin-users'||user.role!=='owner'||request.headers.get('origin')!==new URL(process.env.PUBLIC_SITE_URL||'http://127.0.0.1:3000').origin)throw new TransactionReviewError(403,'forbidden')
  const bytes=await readCommercialBody(request,5*1024*1024,'application/json');let input:unknown
  try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new TransactionReviewError(422,'invalid_financial_decision')}
  const result=await decideFinancialResolution(payload,user,input,request.headers.get('idempotency-key'))
  return transactionReviewResponse(result,result.duplicate?200:201)
 }catch(error){return transactionReviewResponse({code:error instanceof TransactionReviewError||error instanceof CommercialImportError?error.code:'unavailable'},error instanceof TransactionReviewError||error instanceof CommercialImportError?error.status:503)}
}
