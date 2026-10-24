import { APIError, type CollectionConfig } from 'payload'
import { ownerAccess } from '../access/owner'
import { allowedCheckoutHosts, validCheckout } from '../modules/commerce/checkout'
import { controlledCode } from '../modules/analytics/validation'
import { slugValidation } from '../modules/catalog/validation'

export const Campaigns: CollectionConfig = {
  slug: 'campaigns', labels: { singular: 'Campanha', plural: 'Campanhas' }, access: ownerAccess,
  admin: { useAsTitle: 'code', group: 'Comercial' },
  fields: [
    { name: 'publicCampaignLink', type: 'ui', admin: { components: { Field: '/components/admin/CampaignLink#CampaignLink' } } },
    { name: 'code', label: 'Código', type: 'text', required: true, unique: true, validate: slugValidation },
    { name: 'ebook', type: 'relationship', relationTo: 'ebooks', required: true },
    { name: 'offer', type: 'relationship', relationTo: 'offers', required: true },
    { name: 'audience', label: 'Público', type: 'textarea', required: true },
    { name: 'hypothesis', label: 'Hipótese', type: 'textarea', required: true },
    { name: 'channel', label: 'Canal principal', type: 'text', required: true },
    { name: 'kind', type: 'select', options: ['owned', 'affiliate'], defaultValue: 'owned', required: true },
    { name: 'affiliateUrl', label: 'URL oficial do afiliado', type: 'text' },
    { name: 'state', type: 'select', options: ['draft', 'active', 'paused', 'closed'], defaultValue: 'draft', required: true },
    { name: 'startsAt', type: 'date' }, { name: 'endsAt', type: 'date' },
    { name: 'utmSource', type: 'text', maxLength: 120, validate: (value:unknown)=>!value||controlledCode(value)||'Use um código sem dados pessoais, espaços ou URLs.' }, { name: 'utmMedium', type: 'text', maxLength: 120, validate: (value:unknown)=>!value||controlledCode(value)||'Use um código sem dados pessoais, espaços ou URLs.' },
    { name: 'utmTerm', type: 'text', maxLength: 120, validate: (value:unknown)=>!value||controlledCode(value)||'Use um código sem dados pessoais, espaços ou URLs.' },
    { name: 'utmContent', type: 'text', maxLength: 120, validate: (value:unknown)=>!value||controlledCode(value)||'Use um código sem dados pessoais, espaços ou URLs.' },
  ],
  hooks: { beforeChange: [async ({ data, originalDoc, req }) => {
    const merged = { ...originalDoc, ...data }
    const offer = await req.payload.findByID({ collection: 'offers', id: typeof merged.offer === 'object' ? merged.offer.id : merged.offer, req, overrideAccess: false, depth: 0 })
    const ebookId = typeof merged.ebook === 'object' ? merged.ebook.id : merged.ebook
    if (offer.ebook !== ebookId) throw new APIError('A oferta precisa pertencer ao livro da campanha.', 422)
    if (merged.kind === 'affiliate' && !validCheckout(merged.affiliateUrl, allowedCheckoutHosts(offer.provider))) throw new APIError('Revise o link oficial do afiliado e os hosts aprovados para a plataforma.', 422)
    if (merged.startsAt && merged.endsAt && new Date(merged.startsAt) >= new Date(merged.endsAt)) throw new APIError('O fim deve ocorrer depois do início.', 422)
    if (merged.state === 'active' && !offer.active) throw new APIError('Ative e confira a oferta antes da campanha.', 422)
    return data
  }] },
}
