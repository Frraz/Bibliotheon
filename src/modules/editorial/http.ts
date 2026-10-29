import { APIError, type Payload } from 'payload'
import { readCommercialBody } from '../commerce/import-http'
import { CommercialImportError } from '../commerce/import-plan'
import { CONTRACT, EditorialError, parseManifest } from './contract'
import { preview, publish, receipt } from './service'
const response = (status: number, data: unknown) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
export async function editorialRequest(request: Request, payload: Payload, action: 'preview' | 'publish' | 'receipt', env: Readonly<Record<string, string | undefined>> = process.env) {
  try {
    const { user } = await payload.auth({ headers: request.headers })
    if (user?.collection !== 'admin-users' || user.role !== 'owner' || request.headers.get('origin') !== new URL(env.PUBLIC_SITE_URL || 'http://localhost:3000').origin) return response(403, { code: 'forbidden' })
    const raw = await readCommercialBody(request, action === 'receipt' ? 8192 : 8 * 1024 * 1024, 'application/json')
    let body
    try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)) } catch { throw new EditorialError(422, 'invalid_json') }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new EditorialError(422, 'invalid_request')
    const allowed = action === 'receipt' ? ['token'] : action === 'preview' ? ['manifest', 'cover'] : ['manifest', 'cover', 'token']
    if (Object.keys(body).some(k => !allowed.includes(k))) throw new EditorialError(422, 'invalid_request')
    if (action !== 'preview' && (typeof body.token !== 'string' || body.token.length > 4096)) throw new EditorialError(422, 'invalid_token')
    if (action === 'receipt') return response(200, { contract: CONTRACT, receipt: await receipt(payload, user, body.token) })
    const manifest = parseManifest(body.manifest)
    if (typeof body.cover !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.cover)) throw new EditorialError(422, 'invalid_cover')
    const bytes = Buffer.from(body.cover, 'base64')
    if (bytes.toString('base64') !== body.cover) throw new EditorialError(422, 'invalid_cover')
    return response(200, action === 'preview' ? await preview(payload, user, manifest, bytes) : await publish(payload, user, manifest, bytes, body.token))
  } catch (error) {
    if (error instanceof EditorialError) return response(error.status, { code: error.code, message: error.message })
    if (error instanceof CommercialImportError) return response(error.status, { code: error.code })
    if (error instanceof APIError && error.status < 500) return response(error.status, { code: 'catalog_validation', message: 'O catálogo recusou os dados; confira as validações do painel e prepare novamente.' })
    return response(503, { code: 'unavailable', message: 'Resultado não confirmado. Consulte o recibo antes de repetir.' })
  }
}
