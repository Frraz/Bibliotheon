import { getPayload } from 'payload'
import config from '@payload-config'
import { editorialRequest } from '@/modules/editorial/http'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try { return await editorialRequest(request, await getPayload({ config }), 'publish') }
  catch { return Response.json({ code: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } }) }
}
