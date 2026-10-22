import { APIError, type CollectionConfig } from 'payload'
import { ownerAccess } from '../access/owner'
import { slugField, titleField } from './shared'
import { serial } from '../modules/marketing/transaction'
import { idOf } from '../modules/marketing/sequence-copy'
export const LeadMagnets: CollectionConfig = {
  slug: 'lead-magnets', labels: { singular: 'Amostra', plural: 'Amostras' }, access: ownerAccess,
  admin: { useAsTitle: 'title', group: 'Conteúdo' },
  fields: [titleField, slugField,
    { name: 'ebook', type: 'relationship', relationTo: 'ebooks', required: true },
    { name: 'media', type: 'upload', relationTo: 'media', required: true },
    { name: 'version', type: 'text', required: true, maxLength: 160 }, { name: 'active', type: 'checkbox', defaultValue: false },
    { name: 'description', type: 'textarea' },
  ],
  hooks: { beforeChange: [async ({ data, originalDoc, req }) => {
    const merged = { ...originalDoc, ...data }
    if (originalDoc?.id) {
      await serial(req, `magnet:${originalDoc.id}`)
      const current = await req.payload.findByID({ collection: 'lead-magnets', id: originalDoc.id, depth: 0, overrideAccess: true, req })
      if (current.updatedAt !== originalDoc.updatedAt) throw new APIError('A amostra foi alterada. Recarregue antes de salvar.', 409)
      if ((idOf(merged.media) !== idOf(originalDoc.media) || idOf(merged.ebook) !== idOf(originalDoc.ebook)) && merged.version === originalDoc.version) throw new APIError('Use uma nova versão ao substituir arquivo ou livro da amostra.', 422)
      if (merged.version !== originalDoc.version) {
        const used = await req.payload.count({ collection: 'magnet-requests', where: { and: [{ magnet: { equals: originalDoc.id } }, { magnetVersion: { equals: merged.version } }] }, overrideAccess: true, req })
        const enrolled = await req.payload.count({ collection: 'sequence-enrollments', where: { and: [{ magnet: { equals: originalDoc.id } }, { magnetVersion: { equals: merged.version } }] }, overrideAccess: true, req })
        if (used.totalDocs || enrolled.totalDocs) throw new APIError('Esta versão já foi utilizada. Escolha uma versão nova.', 422)
      }
    }
    await serial(req, `sample-media:${idOf(merged.media)}`)
    if (merged.active) {
      const file = await req.payload.findByID({ collection: 'media', id: typeof merged.media === 'object' ? merged.media.id : merged.media, req, overrideAccess: false })
      if (file.visibility !== 'private' || file.presentationRole !== 'sample' || file.mimeType !== 'application/pdf') throw new APIError('A amostra exige PDF privado com finalidade sample.', 422)
    }
    return data
  }] },
}
