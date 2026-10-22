import type { CollectionConfig } from 'payload'
import { ownerAccess } from '../access/owner'
import { archiveField, publicationGuard, seoFields, slugField, titleField } from './shared'
import { slugHooks } from '../modules/catalog/slugs'
export const Articles: CollectionConfig = {
  slug: 'articles', labels: { singular: 'Artigo', plural: 'Artigos' }, access: ownerAccess,
  admin: { useAsTitle: 'title', group: 'Conteúdo' }, versions: { drafts: true, maxPerDoc: 30 },
  fields: [titleField, slugField, { name: 'summary', type: 'textarea' }, { name: 'body', type: 'richText' },
    { name: 'author', type: 'text' }, { name: 'theme', type: 'relationship', relationTo: 'themes' },
    { name: 'ebook', type: 'relationship', relationTo: 'ebooks' }, seoFields, archiveField],
  hooks: { beforeChange: [slugHooks('articles', 'artigos').before, publicationGuard(['summary', 'body', 'author', 'theme'])], afterChange: [slugHooks('articles', 'artigos').after] },
}
