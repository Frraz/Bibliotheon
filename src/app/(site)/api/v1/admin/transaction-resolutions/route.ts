import {getPayload} from 'payload'
import config from '@payload-config'
import {financialResolutionRequest} from '@/modules/commerce/financial-resolution-http'
import {transactionReviewResponse} from '@/modules/commerce/transaction-review-http'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 try{return await financialResolutionRequest(request,await getPayload({config}))}
 catch{return transactionReviewResponse({code:'unavailable'},503)}
}
