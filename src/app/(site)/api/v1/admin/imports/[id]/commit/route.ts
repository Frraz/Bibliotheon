import {getPayload} from 'payload'
import config from '@payload-config'
import {commitCommercialImportRequest} from '@/modules/commerce/import-http'
export const dynamic='force-dynamic'
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{return await commitCommercialImportRequest(request,(await params).id,await getPayload({config}))}
 catch{return Response.json({code:'unavailable'},{status:503,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}})}
}
