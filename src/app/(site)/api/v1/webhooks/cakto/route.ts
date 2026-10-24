import {getPayload} from 'payload'
import config from '@payload-config'
import {handleCaktoWebhook} from '@/integrations/cakto/webhook-http'
export const dynamic='force-dynamic'
export async function POST(request:Request){return handleCaktoWebhook(request,()=>getPayload({config}))}
