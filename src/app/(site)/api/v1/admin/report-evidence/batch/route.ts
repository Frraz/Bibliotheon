import {getPayload} from 'payload'
import config from '@payload-config'
import {reportEvidenceBatchRequest} from '@/modules/commerce/report-evidence-http'
import {transactionReviewResponse} from '@/modules/commerce/transaction-review-http'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 try{return await reportEvidenceBatchRequest(request,await getPayload({config}))}
 catch{return transactionReviewResponse({code:'unavailable'},503)}
}
