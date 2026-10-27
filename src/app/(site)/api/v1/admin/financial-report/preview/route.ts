import {getPayload} from 'payload'
import config from '@payload-config'
import {financialReportRequest} from '@/modules/commerce/financial-ledger-http'
export const dynamic='force-dynamic'
export async function POST(request:Request){try{return await financialReportRequest(request,await getPayload({config}))}catch{return Response.json({code:'unavailable'},{status:503,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}})}}
