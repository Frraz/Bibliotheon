import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import type { Article, Ebook, Media, Offer, Theme } from '../../payload-types'
import { normalizeSearch, validSlug } from './validation'
import { allowedCheckoutHosts, validCheckout, validCents } from '../commerce/checkout'
import { published } from './publication'
export { published } from './publication'

export const cms = () => getPayload({ config })
const relationID = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id
export type PublicCover = { id: string; alt: string; width: number; height: number }
export type PublicBook = Pick<Ebook, 'id' | 'title' | 'slug' | 'summary' | 'audience' | 'problem' | 'promise' | 'body' | 'benefits' | 'contents' | 'requirements' | 'limits' | 'materialState' | 'presentationVariant' | 'accentPreset' | 'workbookExample' | 'faq' | 'seo' | 'updatedAt'> & { cover: PublicCover | null; theme: { slug: string; name: string } | null }
export type PublicOffer = Pick<Offer, 'id' | 'provider' | 'priceCents' | 'currency' | 'lastVerifiedAt' | 'primary'>
export type PublicArticle = Pick<Article, 'id' | 'title' | 'slug' | 'summary' | 'author' | 'body' | 'seo' | 'updatedAt' | 'createdAt'> & { theme: { slug: string; name: string } | null; ebookSlug: string | null }

async function themeProjection(value: Ebook['theme']) {
  const id = relationID(value)
  if (!id) return null
  const payload = await cms()
  const result = await payload.find({ collection: 'themes', overrideAccess: true, draft: false, depth: 0, limit: 1, where: { and: [published, { id: { equals: id } }] }, select: { name: true, slug: true } })
  const doc = result.docs[0]
  return doc ? { name: doc.name, slug: doc.slug } : null
}
async function coverProjection(value: Ebook['cover']): Promise<PublicCover | null> {
  const id = relationID(value)
  if (!id) return null
  const payload = await cms()
  const result = await payload.find({ collection: 'media', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ id: { equals: id } }, { visibility: { equals: 'public' } }, { mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] } }] }, select: { alt: true, width: true, height: true } })
  const doc = result.docs[0]
  return doc ? { id: doc.id, alt: doc.alt, width: doc.width || 600, height: doc.height || 900 } : null
}
// These internal overrides only return explicit projections of published content.
// No caller can supply an arbitrary collection, override, select or draft flag.
export async function projectBook(doc: Ebook): Promise<PublicBook> {
  const { id, title, slug, summary, audience, problem, promise, body, benefits, contents, requirements, limits, materialState, presentationVariant, accentPreset, workbookExample, faq, seo, updatedAt } = doc
  return { id, title, slug, summary, audience, problem, promise, body, benefits, contents, requirements, limits, materialState, presentationVariant, accentPreset, workbookExample, faq, seo, updatedAt, cover: await coverProjection(doc.cover), theme: await themeProjection(doc.theme) }
}
export async function listBooks({ q = '', theme = '', page = 1, limit = 12 }: { q?: string; theme?: string; page?: number; limit?: number } = {}) {
  const payload = await cms()
  const and: Where[] = [published]
  if (q) and.push({ searchText: { contains: normalizeSearch(q.slice(0, 120)) } })
  if (theme) {
    if (!validSlug(theme)) return { docs: [], totalDocs: 0, totalPages: 1, page: 1 }
    const themes = await payload.find({ collection: 'themes', overrideAccess: true, draft: false, depth: 0, limit: 1, where: { and: [published, { slug: { equals: theme } }] }, select: { slug: true } })
    if (!themes.docs[0]) return { docs: [], totalDocs: 0, totalPages: 1, page: 1 }
    and.push({ theme: { equals: themes.docs[0].id } })
  }
  const result = await payload.find({ collection: 'ebooks', overrideAccess: true, draft: false, depth: 0, sort: '-createdAt', page, limit: Math.min(Math.max(limit, 1), 30), where: { and } })
  return { docs: await Promise.all(result.docs.map(projectBook)), totalDocs: result.totalDocs, totalPages: Math.max(result.totalPages, 1), page: result.page || 1 }
}
export async function getBook(slug: string) {
  if (!validSlug(slug)) return null
  const payload = await cms()
  const result = await payload.find({ collection: 'ebooks', overrideAccess: true, draft: false, depth: 0, limit: 1, where: { and: [published, { slug: { equals: slug } }] } })
  return result.docs[0] ? projectBook(result.docs[0]) : null
}
export async function bookOffers(book: PublicBook): Promise<PublicOffer[]> {
  if (book.materialState !== 'ready') return []
  const payload = await cms()
  const result = await payload.find({ collection: 'offers', overrideAccess: true, depth: 0, limit: 100, sort: '-primary', where: { and: [{ ebook: { equals: book.id } }, { active: { equals: true } }] } })
  return result.docs.filter(o => validCents(o.priceCents) && validCheckout(o.checkoutUrl, allowedCheckoutHosts(o.provider))).map(({ id, provider, priceCents, currency, lastVerifiedAt, primary }) => ({ id, provider, priceCents, currency, lastVerifiedAt, primary }))
}
export async function sampleForBook(id: string) {
  const payload = await cms()
  const result = await payload.find({ collection: 'lead-magnets', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ ebook: { equals: id } }, { active: { equals: true } }] }, select: { slug: true, title: true, description: true } })
  const doc = result.docs[0]
  return doc ? { slug: doc.slug, title: doc.title, description: doc.description } : null
}
export async function listThemes(): Promise<Pick<Theme, 'id' | 'name' | 'slug' | 'introduction'>[]> {
  const payload = await cms()
  const result = await payload.find({ collection: 'themes', overrideAccess: true, draft: false, depth: 0, limit: 100, sort: 'name', where: published, select: { name: true, slug: true, introduction: true } })
  const populated = await Promise.all(result.docs.map(async doc => {
    const where: Where = { and: [published, { theme: { equals: doc.id } }] }
    const [books, articles] = await Promise.all([payload.count({ collection: 'ebooks', where, overrideAccess: true }), payload.count({ collection: 'articles', where, overrideAccess: true })])
    return books.totalDocs || articles.totalDocs ? doc : null
  }))
  return populated.filter((doc): doc is NonNullable<typeof doc> => doc !== null)
}
async function projectArticle(doc: Article): Promise<PublicArticle> {
  const { id, title, slug, summary, author, body, seo, updatedAt, createdAt } = doc
  let ebookSlug: string | null = null
  if (doc.ebook) {
    const payload = await cms()
    const result = await payload.find({ collection: 'ebooks', overrideAccess: true, draft: false, limit: 1, depth: 0, where: { and: [published, { id: { equals: relationID(doc.ebook) } }] }, select: { slug: true } })
    ebookSlug = result.docs[0]?.slug || null
  }
  return { id, title, slug, summary, author, body, seo, updatedAt, createdAt, ebookSlug, theme: await themeProjection(doc.theme) }
}
export async function listArticles({ page = 1, theme = '' }: { page?: number; theme?: string } = {}) {
  const payload = await cms()
  const and: Where[] = [published]
  if (theme) and.push({ theme: { equals: theme } })
  const result = await payload.find({ collection: 'articles', overrideAccess: true, draft: false, depth: 0, sort: '-createdAt', page, limit: 12, where: { and } })
  return { docs: await Promise.all(result.docs.map(projectArticle)), totalDocs: result.totalDocs, totalPages: Math.max(result.totalPages, 1) }
}
export async function getArticle(slug: string) {
  if (!validSlug(slug)) return null
  const payload = await cms()
  const result = await payload.find({ collection: 'articles', overrideAccess: true, draft: false, depth: 0, limit: 1, where: { and: [published, { slug: { equals: slug } }] } })
  return result.docs[0] ? projectArticle(result.docs[0]) : null
}
export async function getRedirect(path: string) {
  if (!/^\/(ebooks|artigos|temas)\/[a-z0-9-]+$/.test(path)) return null
  const payload = await cms()
  const result = await payload.find({ collection: 'redirects', overrideAccess: true, depth: 0, limit: 1, where: { fromPath: { equals: path } }, select: { toPath: true } })
  return result.docs[0]?.toPath || null
}
export async function siteSettings() {
  const payload = await cms()
  const settings = await payload.findGlobal({ slug: 'site-settings', overrideAccess: true, depth: 0 })
  return { responsibleName: settings.responsibleName, contactEmail: settings.contactEmail, about: settings.about, privacyPolicy: settings.privacyPolicy, terms: settings.terms, legalReady: Boolean(settings.legalReady), updatedAt: settings.updatedAt }
}
export async function publicImage(id: string): Promise<Media | null> {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null
  const payload = await cms()
  const result = await payload.find({ collection: 'media', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ id: { equals: id } }, { visibility: { equals: 'public' } }, { mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] } }] } })
  return result.docs[0] || null
}
