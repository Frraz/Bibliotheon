import {getPayload} from 'payload'
import config from '@payload-config'
import {handleKiwifyWebhook} from '@/integrations/kiwify/webhook-http'
export const dynamic='force-dynamic'
export async function POST(request:Request){return handleKiwifyWebhook(request,()=>getPayload({config}))}
