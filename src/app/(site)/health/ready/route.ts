import { getPayload } from 'payload'
import config from '@payload-config'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const payload = await getPayload({ config })
    await Promise.race([
      // Internal liveness probe only: no documents or counts leave this route.
      payload.count({ collection: 'admin-users', overrideAccess: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ])
    return Response.json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return Response.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
}
