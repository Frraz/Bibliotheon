import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { publicImage } from '../../../../../../modules/catalog/public'
import { mediaDirectory } from '../../../../../../modules/catalog/storage'
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const image = await publicImage((await params).id)
  if (!image?.filename || path.basename(image.filename) !== image.filename) return new Response(null, { status: 404 })
  try {
    const file = await readFile(path.resolve(mediaDirectory(), image.filename))
    return new Response(new Uint8Array(file), { headers: { 'Content-Type': image.mimeType!, 'Cache-Control': 'public, max-age=0, must-revalidate', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } })
  } catch { return new Response(null, { status: 404 }) }
}
