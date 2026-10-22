import { getPayload } from 'payload'
import { randomUUID } from 'node:crypto'
import config from '@payload-config'
import { failure, linkSecret, privateJSON, readInput } from '@/modules/marketing/http'
import { applySuppression, parseSuppressionInput } from '@/modules/marketing/suppression'
import { LeadFlowError } from '@/modules/marketing/service'

export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (user?.collection !== 'admin-users' || user.role !== 'owner') return privateJSON({ error: { code: 'forbidden', message: 'Acesso restrito.', requestId: randomUUID() } }, 403)
    if (request.headers.get('origin') !== new URL(process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:3000').origin) return privateJSON({ error: { code: 'forbidden', message: 'Origem não permitida.', requestId: randomUUID() } }, 403)
    const input = parseSuppressionInput(await readInput(request))
    if (!input) throw new LeadFlowError('invalid_input', 422)
    return privateJSON(await applySuppression(payload, input, linkSecret()))
  } catch (error) { return failure(error) }
}
