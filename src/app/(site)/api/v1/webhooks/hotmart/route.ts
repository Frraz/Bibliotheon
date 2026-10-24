import {getPayload} from 'payload'
import config from '@payload-config'
import {handleHotmartWebhook} from '@/integrations/hotmart/webhook-http'
export const dynamic='force-dynamic'
export async function POST(request:Request){return handleHotmartWebhook(request,()=>getPayload({config}))}
