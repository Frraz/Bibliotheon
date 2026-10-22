import type { MetadataRoute } from 'next'
import { cms, listThemes, published, siteSettings } from '../../modules/catalog/public'
import { siteOrigin } from '../../modules/catalog/seo'
export const dynamic = 'force-dynamic'
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!(await siteSettings()).legalReady) return []
  const payload = await cms()
  const rows: MetadataRoute.Sitemap = []
  for (const [collection, prefix] of [['ebooks', '/ebooks'], ['articles', '/artigos']] as const) {
    let page = 1, totalPages = 1, count = 0
    do {
      const result = await payload.find({ collection, overrideAccess: true, draft: false, depth: 0, limit: 100, page, where: published, select: { slug: true, updatedAt: true } })
      rows.push(...result.docs.map(doc => ({ url: `${siteOrigin()}${prefix}/${doc.slug}`, lastModified: doc.updatedAt })))
      totalPages = result.totalPages; count += result.totalDocs; page++
    } while (page <= totalPages)
    if (count > 0) rows.push({ url: `${siteOrigin()}${prefix}` })
  }
  rows.push(...(await listThemes()).map(t => ({ url: `${siteOrigin()}/temas/${t.slug}` })))
  rows.push(...['/', '/sobre', '/contato', '/privacidade', '/termos'].map(path => ({ url: `${siteOrigin()}${path}` })))
  return rows
}
