import {getPayload} from 'payload'
import config from '@payload-config'
import {catalogResolutionRequest,catalogResolutionResponse} from '@/modules/commerce/catalog-resolution-http'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 try{return await catalogResolutionRequest(request,await getPayload({config}),true)}
 catch{return catalogResolutionResponse({code:'unavailable'},503)}
}
