import { getPayload } from 'payload'
import config from '@payload-config'
import { handleBrevoWebhook } from '@/integrations/brevo/webhook-http'
import { ingestBrevoWebhook } from '@/modules/marketing/brevo-webhook'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  return handleBrevoWebhook(request, async (event, settings) => ingestBrevoWebhook(await getPayload({ config }), event, settings))
}
