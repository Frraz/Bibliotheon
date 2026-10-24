import {getPayload} from 'payload'
import config from '@payload-config'
import {retryCommercialRequest} from '@/modules/commerce/http'
import {privateJSON} from '@/modules/marketing/http'

export const dynamic='force-dynamic'
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{return await retryCommercialRequest(request,(await params).id,await getPayload({config}))}
 catch{return privateJSON({error:{code:'unavailable'}},503)}
}
