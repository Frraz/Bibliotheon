import type {Payload} from 'payload'
import {readCommercialBody} from './import-http'
import {CommercialImportError} from './import-plan'
import {transactionReviewResponse} from './transaction-review-http'
import {FinancialLedgerError,previewFinancialReport,recordFinancialCost,recordSettlementEvidence} from './financial-ledger'
const failure=(error:unknown)=>transactionReviewResponse({code:error instanceof FinancialLedgerError||error instanceof CommercialImportError?error.code:'unavailable'},error instanceof FinancialLedgerError||error instanceof CommercialImportError?error.status:503)
async function authorize(request:Request,payload:Payload,env:Readonly<Record<string,string|undefined>>){
 const {user}=await payload.auth({headers:request.headers})
 if(user?.collection!=='admin-users'||user.role!=='owner'||request.headers.get('origin')!==new URL(env.PUBLIC_SITE_URL||'http://127.0.0.1:3000').origin)throw new FinancialLedgerError(403,'forbidden')
 return user
}
async function json(request:Request){const bytes=await readCommercialBody(request,64*1024,'application/json');try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown}catch{throw new FinancialLedgerError(422,'invalid_financial_record')}}
export async function settlementEvidenceRequest(request:Request,payload:Payload,env:Readonly<Record<string,string|undefined>>=process.env){try{const user=await authorize(request,payload,env),result=await recordSettlementEvidence(payload,user,await json(request));return transactionReviewResponse(result,result.duplicate?200:201)}catch(error){return failure(error)}}
export async function financialCostRequest(request:Request,payload:Payload,env:Readonly<Record<string,string|undefined>>=process.env){try{const user=await authorize(request,payload,env),result=await recordFinancialCost(payload,user,await json(request));return transactionReviewResponse(result,result.duplicate?200:201)}catch(error){return failure(error)}}
export async function financialReportRequest(request:Request,payload:Payload,env:Readonly<Record<string,string|undefined>>=process.env){try{const user=await authorize(request,payload,env),result=await previewFinancialReport(payload,user,await json(request));return transactionReviewResponse(result)}catch(error){return failure(error)}}
