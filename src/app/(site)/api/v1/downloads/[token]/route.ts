import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { cms } from '../../../../../../modules/catalog/public'
import { mediaDirectory } from '../../../../../../modules/catalog/storage'
import { failure, linkSecret } from '../../../../../../modules/marketing/http'
import { availableMagnet, LeadFlowError } from '../../../../../../modules/marketing/service'
import { verifyDownload } from '../../../../../../modules/marketing/tokens'
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const id = verifyDownload((await params).token, linkSecret())
    if (!id) throw new LeadFlowError('expired', 410)
    const payload = await cms()
    const requests = await payload.find({ collection: 'magnet-requests', where: { and: [{ id: { equals: id } }, { confirmedAt: { exists: true } }, { revokedAt: { exists: false } }] }, limit: 1, depth: 0, overrideAccess: true })
    const request = requests.docs[0]
    const material = request && await availableMagnet(payload, typeof request.magnet === 'string' ? request.magnet : request.magnet.id)
    if (!request || !material || request.magnetVersion !== material.magnet.version) throw new LeadFlowError('expired', 410)
    const filename = material.media.filename
    if (!filename || path.basename(filename) !== filename) throw new LeadFlowError('expired', 410)
    const bytes = await readFile(path.resolve(mediaDirectory(), filename))
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="amostra-bibliotheon.pdf"', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; sandbox" } })
  } catch (error) { return failure(error) }
}
