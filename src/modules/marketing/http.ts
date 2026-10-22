import { randomUUID } from 'node:crypto'
import { configuredTransport } from '../../integrations/brevo/transactional'
import { siteSettings } from '../catalog/public'
import { LeadFlowError } from './service'
import { validLinkSecret } from './tokens'

export function privateJSON(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' } })
}
export function failure(error: unknown) {
  const known = error instanceof LeadFlowError
  return privateJSON({ error: { code: known ? error.code : 'unavailable', message: known && error.status === 422 ? 'Revise os campos.' : known && error.status === 429 ? 'Aguarde antes de tentar novamente.' : known && error.status === 410 ? 'Este link expirou ou foi revogado.' : 'Serviço temporariamente indisponível.', requestId: randomUUID() } }, known ? error.status : 503)
}
export async function readInput(request: Request): Promise<unknown> {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:3000').origin) throw new LeadFlowError('invalid_input', 422)
  if (request.headers.get('sec-fetch-site') === 'cross-site' || !request.headers.get('content-type')?.toLowerCase().startsWith('application/json') || !request.body) throw new LeadFlowError('invalid_input', 422)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 4096) { await reader.cancel(); throw new LeadFlowError('invalid_input', 422) }
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch { throw new LeadFlowError('invalid_input', 422) }
  finally { reader.releaseLock() }
}
export async function captureEnabled() {
  return process.env.LEADS_ENABLED === 'true' && validLinkSecret(process.env.LEAD_TOKEN_SECRET) && !!configuredTransport() && (await siteSettings()).legalReady
}
export function linkSecret() {
  const secret = process.env.LEAD_TOKEN_SECRET
  if (!validLinkSecret(secret)) throw new LeadFlowError('unavailable', 503)
  return secret
}
