import { getPayload } from 'payload'
import config from '@payload-config'
import { failure, linkSecret, privateJSON, readInput } from '@/modules/marketing/http'
import { exportContactData } from '@/modules/marketing/privacy-export'
import { LeadFlowError } from '@/modules/marketing/service'

export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (user?.collection !== 'admin-users' || user.role !== 'owner') return privateJSON({ error: { code: 'forbidden' } }, 403)
    if (request.headers.get('origin') !== new URL(process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:3000').origin) return privateJSON({ error: { code: 'forbidden' } }, 403)
    const input = await readInput(request)
    if (!input || typeof input !== 'object' || Array.isArray(input) || (input as Record<string, unknown>).identityVerified !== true || typeof (input as Record<string, unknown>).email !== 'string' || Object.keys(input).some(key => !['email', 'identityVerified'].includes(key))) throw new LeadFlowError('invalid_input', 422)
    return privateJSON(await exportContactData(payload, (input as { email: string }).email, user.id, linkSecret()))
  } catch (error) { return failure(error) }
}
