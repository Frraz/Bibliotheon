import { APIError, type CollectionConfig } from 'payload'
import { ownerAccess } from '../access/owner'
import { allowedCheckoutHosts, providers, validCents, validCheckout } from '../modules/commerce/checkout'
import { lockEbooks } from '../modules/commerce/lock'

export const Offers: CollectionConfig = {
  slug: 'offers', labels: { singular: 'Oferta', plural: 'Ofertas' }, access: { ...ownerAccess, delete: () => false },
  admin: { useAsTitle: 'name', group: 'Comercial', defaultColumns: ['name', 'provider', 'active', 'primary', 'priceCents'] },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'ebook', type: 'relationship', relationTo: 'ebooks', required: true, index: true },
    { name: 'provider', type: 'select', options: [...providers], required: true },
    { name: 'accountKey', type: 'text', required: true }, { name: 'externalProductId', type: 'text', required: true },
    { name: 'externalOfferId', type: 'text' }, { name: 'checkoutUrl', type: 'text' },
    { name: 'priceCents', label: 'Preço em centavos', type: 'number', min: 0, validate: (v: unknown) => v == null || validCents(v) || 'Informe centavos inteiros.' },
    { name: 'currency', type: 'select', options: ['BRL'], defaultValue: 'BRL', required: true },
    { name: 'active', type: 'checkbox', defaultValue: false, index: true },
    { name: 'primary', type: 'checkbox', defaultValue: false },
    { name: 'lastVerifiedAt', type: 'date' }, { name: 'eligibilityNote', label: 'Elegibilidade e entrega verificadas', type: 'textarea' },
  ],
  hooks: { beforeChange: [async ({ data, originalDoc, req }) => {
    const merged = { ...originalDoc, ...data }
    const ebookId = typeof merged.ebook === 'object' ? merged.ebook.id : merged.ebook
    const previousId = typeof originalDoc?.ebook === 'object' ? originalDoc.ebook.id : originalDoc?.ebook
    await lockEbooks(req, [ebookId, previousId].filter(Boolean))
    if (merged.checkoutUrl && !validCheckout(merged.checkoutUrl, allowedCheckoutHosts(merged.provider))) throw new APIError('URL HTTPS precisa de host exato aprovado para a plataforma na configuração.', 422)
    if (merged.active) {
      if (!merged.checkoutUrl || !validCents(merged.priceCents) || !merged.lastVerifiedAt || !merged.eligibilityNote) throw new APIError('Confira preço, URL, data, elegibilidade e entrega antes de ativar.', 422)
      const ebook = await req.payload.findByID({ collection: 'ebooks', id: typeof merged.ebook === 'object' ? merged.ebook.id : merged.ebook, req, overrideAccess: false, draft: false })
      if (ebook.materialState !== 'ready' || ebook.archived) throw new APIError('A oferta exige livro pronto e não arquivado.', 422)
    }
    return data
  }] },
}
