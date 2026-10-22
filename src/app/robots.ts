import type { MetadataRoute } from 'next'
import { siteOrigin } from '../modules/catalog/seo'
export const dynamic = 'force-dynamic'
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/preview/', '/comprar/', '/preferencias', '/amostras/confirmar'] }, sitemap: `${siteOrigin()}/sitemap.xml` }
}
