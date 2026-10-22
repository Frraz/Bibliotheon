import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook } from 'payload'

/** Old published paths remain reserved; incoming redirects are flattened atomically. */
export function slugHooks(collection: 'ebooks' | 'articles' | 'themes', prefix: 'ebooks' | 'artigos' | 'temas') {
  const before: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
    const slug = data.slug ?? originalDoc?.slug
    if (slug && slug !== originalDoc?.slug) {
      const reserved = await req.payload.count({ collection: 'redirects', where: { fromPath: { equals: `/${prefix}/${slug}` } }, overrideAccess: true, req })
      if (reserved.totalDocs) throw new APIError('Este slug já pertence a um endereço histórico. Escolha outro para preservar os links publicados.', 422)
    }
    if (originalDoc?.id && data._status === 'published') {
      const published = await req.payload.findByID({ collection, id: originalDoc.id, draft: false, overrideAccess: true, depth: 0, req })
      if (published._status === 'published') req.context[`publishedSlug:${collection}:${originalDoc.id}`] = published.slug
    }
    return data
  }
  const after: CollectionAfterChangeHook = async ({ doc, req }) => {
    const previous = req.context[`publishedSlug:${collection}:${doc.id}`]
    if (doc._status !== 'published' || typeof previous !== 'string' || previous === doc.slug) return doc
    const fromPath = `/${prefix}/${previous}`
    const toPath = `/${prefix}/${doc.slug}`
    await req.payload.update({ collection: 'redirects', where: { toPath: { equals: fromPath } }, data: { toPath }, overrideAccess: true, req })
    await req.payload.create({ collection: 'redirects', data: { fromPath, toPath }, overrideAccess: true, req })
    return doc
  }
  return { before, after }
}
