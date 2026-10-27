import {getPayload} from 'payload'
import config from '@payload-config'
import {previewReportEvidenceImportRequest} from '@/modules/commerce/report-evidence-import-http'
export const dynamic='force-dynamic'
export async function POST(request:Request){try{return await previewReportEvidenceImportRequest(request,await getPayload({config}))}catch{return Response.json({code:'unavailable'},{status:503,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}})}}
