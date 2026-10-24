import {getPayload} from 'payload'
import config from '@payload-config'
import {stageCommercialImportRequest} from '@/modules/commerce/import-http'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 try{return await stageCommercialImportRequest(request,await getPayload({config}))}
 catch{return Response.json({code:'unavailable'},{status:503,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}})}
}
