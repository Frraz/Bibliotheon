import { APIError, type CollectionConfig } from 'payload'
import { ownerAccess } from '../access/owner'
import { accents, normalizeSearch, variants } from '../modules/catalog/validation'
import { lockEbooks } from '../modules/commerce/lock'
import { slugHooks } from '../modules/catalog/slugs'
import { archiveField, publicationGuard, seoFields, slugField, titleField } from './shared'
export const Ebooks: CollectionConfig = {
  slug: 'ebooks', labels: { singular: 'Livro', plural: 'Livros' }, access: { ...ownerAccess, delete: () => false },
  admin: { useAsTitle: 'title', group: 'Conteúdo', defaultColumns: ['title', 'materialState', '_status', 'updatedAt'] },
  versions: { drafts: true, maxPerDoc: 30 },
  fields: [
    titleField, slugField, { name: 'summary', label: 'Resumo', type: 'textarea' },
    { name: 'theme', label: 'Tema', type: 'relationship', relationTo: 'themes' },
    { name: 'audience', label: 'Público', type: 'textarea' },
    { name: 'problem', label: 'Problema abordado', type: 'textarea' },
    { name: 'promise', label: 'O que o livro entrega', type: 'textarea' },
    { name: 'body', label: 'Apresentação', type: 'richText' },
    { name: 'benefits', label: 'Aprendizagens', type: 'array', fields: [{ name: 'text', type: 'text', required: true }] },
    { name: 'contents', label: 'Sumário', type: 'array', fields: [{ name: 'text', type: 'text', required: true }] },
    { name: 'requirements', label: 'Requisitos', type: 'textarea' }, { name: 'limits', label: 'Limites', type: 'textarea' },
    { name: 'cover', label: 'Capa', type: 'upload', relationTo: 'media' },
    { name: 'materialState', label: 'Estado do material', type: 'select', required: true, defaultValue: 'production', options: [{ label: 'Em produção', value: 'production' }, { label: 'Pronto', value: 'ready' }] },
    { name: 'presentationVariant', label: 'Apresentação', type: 'select', required: true, defaultValue: 'guide', options: [...variants] },
    { name: 'accentPreset', label: 'Acento editorial', type: 'select', required: true, defaultValue: 'mineral', options: [...accents] },
    { name: 'workbookExample', label: 'Exercício real de amostra', type: 'textarea' },
    { name: 'faq', label: 'Dúvidas frequentes', type: 'array', fields: [{ name: 'question', type: 'text', required: true }, { name: 'answer', type: 'textarea', required: true }] },
    { name: 'searchText', type: 'text', index: true, admin: { hidden: true }, access: { update: () => false } },
    seoFields, archiveField,
  ],
  hooks: {
    beforeChange: [slugHooks('ebooks', 'ebooks').before, publicationGuard(['summary', 'theme', 'audience', 'problem', 'promise', 'cover', 'requirements', 'limits']), async ({ data, originalDoc, req }) => {
      const merged = { ...originalDoc, ...data }
      if (originalDoc?.id) await lockEbooks(req, [originalDoc.id])
      data.searchText = normalizeSearch(`${merged.title || ''} ${merged.summary || ''}`)
      if (merged._status === 'published' && !merged.archived) {
        if (merged.presentationVariant === 'workbook' && !merged.workbookExample) throw new APIError('Cadastre um exercício real antes de publicar workbook.', 422)
        const cover = await req.payload.findByID({ collection: 'media', id: typeof merged.cover === 'object' ? merged.cover.id : merged.cover, req, overrideAccess: false })
        if (cover.visibility !== 'public' || cover.presentationRole !== 'cover' || !cover.mimeType?.startsWith('image/')) throw new APIError('A capa precisa ser uma imagem pública com finalidade capa.', 422)
        const theme = await req.payload.findByID({ collection: 'themes', id: typeof merged.theme === 'object' ? merged.theme.id : merged.theme, req, overrideAccess: false, draft: false })
        if (theme._status !== 'published' || theme.archived) throw new APIError('Publique o tema antes do livro.', 422)
      }
      if (originalDoc?.id && merged.materialState !== 'ready') {
        const active = await req.payload.count({ collection: 'offers', where: { and: [{ ebook: { equals: originalDoc.id } }, { active: { equals: true } }] }, req, overrideAccess: false })
        if (active.totalDocs) throw new APIError('Desative as ofertas antes de voltar o livro para produção.', 422)
      }
      return data
    }],
    afterChange: [slugHooks('ebooks', 'ebooks').after],
  },
}
