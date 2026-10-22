import { APIError, Forbidden, type CollectionConfig } from 'payload'
import path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import sharp from 'sharp'
import { ownerAccess } from '../access/owner'
import { mediaDirectory } from '../modules/catalog/storage'
import { serial } from '../modules/marketing/transaction'

export const Media: CollectionConfig = {
  slug: 'media', labels: { singular: 'Mídia', plural: 'Mídias' }, access: ownerAccess,
  admin: { useAsTitle: 'alt', group: 'Conteúdo', description: 'Para substituir o arquivo de uma amostra vinculada, cadastre outra mídia e uma nova versão da amostra. Descrição e legenda continuam editáveis.' },
  upload: { staticDir: mediaDirectory(), mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], focalPoint: false, crop: false },
  fields: [
    { name: 'alt', label: 'Descrição acessível', type: 'text', required: true },
    { name: 'caption', label: 'Legenda', type: 'textarea' },
    { name: 'visibility', type: 'select', required: true, defaultValue: 'private', options: ['public', 'private'] },
    { name: 'presentationRole', type: 'select', required: true, options: ['cover', 'sample', 'contextual'] },
    { name: 'hash', type: 'text', admin: { readOnly: true }, access: { update: () => false } },
  ],
  hooks: {
    beforeOperation: [async ({ args, operation }) => {
      if (operation !== 'create' && operation !== 'update') return args
      if (args.req.user?.collection !== 'admin-users' || args.req.user.role !== 'owner') throw new Forbidden()
      const file = args.req.file
      if (!file) return args
      if (operation === 'update') {
        // Native upload processing can remove the previous file before beforeChange.
        // Reject here, while both its bytes and database record are still intact.
        if (!('id' in args) || typeof args.id !== 'string') throw new APIError('Substitua arquivos individualmente ou cadastre outra mídia.', 422)
        await serial(args.req, `sample-media:${args.id}`)
        const linked = await args.req.payload.count({ collection: 'lead-magnets', where: { media: { equals: args.id } }, overrideAccess: true, req: args.req })
        if (linked.totalDocs) throw new APIError('Arquivo vinculado a uma amostra: envie outra mídia e use uma versão nova.', 422)
      }
      if (file.name !== path.basename(file.name) || file.name.includes('\\') || file.name.includes('..')) throw new APIError('Nome de arquivo inválido.', 422)
      if (file.mimetype === 'application/pdf') {
        if (!file.name.toLowerCase().endsWith('.pdf') || file.data.subarray(0, 5).toString() !== '%PDF-' || file.data.length > 20 * 1024 * 1024) throw new APIError('PDF inválido ou maior que 20 MiB.', 422)
        file.name = `${randomUUID()}.pdf`
      } else {
        if (file.data.length > 5 * 1024 * 1024) throw new APIError('Imagem maior que 5 MiB.', 422)
        const bytes = file.data
        const sniffed = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
          : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
            : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : null
        if (!sniffed || sniffed !== file.mimetype) throw new APIError('Conteúdo ou MIME da imagem não permitido.', 422)
        let metadata
        try { metadata = await sharp(file.data, { limitInputPixels: 25000000 }).metadata() } catch { throw new APIError('Imagem inválida.', 422) }
        const allowed: Record<string, { mime: string; extensions: string[] }> = {
          jpeg: { mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'] }, png: { mime: 'image/png', extensions: ['.png'] }, webp: { mime: 'image/webp', extensions: ['.webp'] },
        }
        const format = metadata.format && allowed[metadata.format]
        if (!format || format.mime !== file.mimetype || !format.extensions.includes(path.extname(file.name).toLowerCase())) throw new APIError('Extensão, MIME e conteúdo da imagem precisam corresponder.', 422)
        try { file.data = await sharp(file.data).rotate().webp({ quality: 85 }).toBuffer() } catch { throw new APIError('Não foi possível processar a imagem.', 422) }
        file.name = `${randomUUID()}.webp`
        file.mimetype = 'image/webp'
        file.size = file.data.length
      }
      return args
    }],
    beforeChange: [({ data, req, originalDoc }) => {
      const merged = { ...originalDoc, ...data }
      if (merged.mimeType === 'application/pdf' && merged.visibility !== 'private') throw new APIError('PDF de amostra deve permanecer privado.', 422)
      if (merged.presentationRole === 'cover' && !merged.mimeType?.startsWith('image/')) throw new APIError('A capa deve ser imagem.', 422)
      if (req.file) data.hash = createHash('sha256').update(req.file.data).digest('hex')
      return data
    }],
  },
}
