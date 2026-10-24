import { authenticatedWebhook, parseMarketingWebhook, webhookConfig, type MarketingWebhookEvent, type WebhookConfig } from './webhook'
const response = (status: number, code: string) => Response.json({ code }, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', ...(status === 429 ? { 'Retry-After': '60' } : {}) } })
/** Auth before reading a bounded body; no received values or errors enter logs/responses. */
export async function handleBrevoWebhook(request: Request, ingest: (event: MarketingWebhookEvent, config: WebhookConfig) => Promise<unknown>, env: Readonly<Record<string, string | undefined>> = process.env) {
  const config = webhookConfig(env)
  // Brevo documents discard on 5xx; temporary failures deliberately use retryable 429.
  if (!config) return response(429, 'unavailable')
  if (!authenticatedWebhook(request.headers.get('authorization'), config)) return response(401, 'unauthorized')
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json' || request.headers.get('content-encoding') && request.headers.get('content-encoding') !== 'identity' || !request.body) return response(415, 'unsupported_content')
  const reader = request.body.getReader(), chunks: Uint8Array[] = []
  let size = 0, timer: ReturnType<typeof setTimeout> | undefined, value: unknown
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 5000); timer.unref?.() })
  try {
    for (;;) {
      const part = await Promise.race([reader.read(), deadline])
      if (part.done) break
      size += part.value.byteLength
      if (size > 32_768) { void reader.cancel().catch(() => {}); return response(413, 'body_too_large') }
      chunks.push(part.value)
    }
    value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch (error) { void reader.cancel().catch(() => {}); return error instanceof SyntaxError ? response(422, 'invalid_event') : response(429, 'unavailable') }
  finally { clearTimeout(timer); reader.releaseLock() }
  const event = parseMarketingWebhook(value)
  if (!event) return response(422, 'invalid_event')
  if (event === 'ignored') return response(200, 'ignored')
  try { await ingest(event, config); return response(200, 'accepted') }
  catch { return response(429, 'unavailable') }
}
