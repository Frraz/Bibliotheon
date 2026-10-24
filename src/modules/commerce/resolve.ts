import { published } from '../catalog/publication'
import { allowedCheckoutHosts, validCheckout, validCents } from './checkout'
import type { Payload, PayloadRequest } from 'payload'
export class CheckoutError extends Error { constructor(public status: number, message: string) { super(message) } }
export async function resolveCheckout(offerID: string, campaignCode?: string, options?: { payload: Payload; req: PayloadRequest; now: number }) {
  if (!/^[a-f0-9-]{36}$/.test(offerID)) throw new CheckoutError(404, 'Oferta não encontrada.')
  const payload = options?.payload ?? await (await import('../catalog/public')).cms(), req = options?.req, now = options?.now ?? Date.now()
  const offers = await payload.find({ collection: 'offers', overrideAccess: true, depth: 0, limit: 1, where: { id: { equals: offerID } }, req })
  const offer = offers.docs[0]
  if (!offer) throw new CheckoutError(404, 'Oferta não encontrada.')
  if (!offer.active || !validCents(offer.priceCents) || !validCheckout(offer.checkoutUrl, allowedCheckoutHosts(offer.provider))) throw new CheckoutError(410, 'Esta oferta está indisponível. Consulte o catálogo para ver as informações atuais.')
  const books = await payload.find({ collection: 'ebooks', overrideAccess: true, draft: false, depth: 0, limit: 1, where: { and: [published, { id: { equals: offer.ebook } }, { materialState: { equals: 'ready' } }] }, select: { slug: true }, req })
  if (!books.docs[0]) throw new CheckoutError(410, 'Este livro ainda não está disponível para compra.')
  let campaignID: string | undefined
  let destination = offer.checkoutUrl!
  if (campaignCode) {
    if (!/^[a-z0-9-]{1,160}$/.test(campaignCode)) throw new CheckoutError(400, 'Campanha inválida.')
    const campaigns = await payload.find({ collection: 'campaigns', overrideAccess: true, depth: 0, limit: 1, where: { code: { equals: campaignCode } }, req })
    const campaign = campaigns.docs[0]
    if (!campaign || campaign.offer !== offer.id || campaign.ebook !== offer.ebook) throw new CheckoutError(400, 'Esta campanha não corresponde à oferta.')
    if (campaign.state !== 'active' || campaign.startsAt && new Date(campaign.startsAt).getTime() > now || campaign.endsAt && new Date(campaign.endsAt).getTime() <= now) throw new CheckoutError(410, 'Esta campanha está indisponível.')
    campaignID = campaign.id
    if (campaign.kind === 'affiliate') {
      if (!validCheckout(campaign.affiliateUrl, allowedCheckoutHosts(offer.provider))) throw new CheckoutError(410, 'O link desta campanha está indisponível.')
      destination = campaign.affiliateUrl!
    }
  }
  return { destination, campaignID, offerID: offer.id, ebookID: typeof offer.ebook === 'string' ? offer.ebook : offer.ebook.id, provider: offer.provider }
}
