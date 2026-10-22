import { notFound, permanentRedirect } from 'next/navigation'
import { BookLanding } from '../../../../components/Books'
import { bookOffers, cms, getBook, getRedirect, sampleForBook } from '../../../../modules/catalog/public'
import { pageMetadata, preserveCampaignQuery, single, type SearchParams } from '../../../../modules/catalog/seo'
import { CheckoutError, resolveCheckout } from '../../../../modules/commerce/resolve'
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }
export async function generateMetadata({ params }: Props) {
  const { slug } = await params, book = await getBook(slug)
  return book ? pageMetadata(book.seo?.title || book.title, `/ebooks/${book.slug}`, book.seo?.description || book.summary) : pageMetadata('Livro não encontrado', '/ebooks', undefined, true)
}
export default async function BookPage({ params, searchParams }: Props) {
  const { slug } = await params, query = await searchParams
  const book = await getBook(slug)
  if (!book) { const to = await getRedirect(`/ebooks/${slug}`); if (to) permanentRedirect(preserveCampaignQuery(to, query)); notFound() }
  let offers = await bookOffers(book)
  const campaignCode = single(query.c)
  let unavailable = Array.isArray(query.c)
  if (campaignCode) {
    const payload = await cms()
    const campaigns = await payload.find({ collection: 'campaigns', overrideAccess: true, depth: 0, limit: 1, where: { code: { equals: campaignCode.slice(0, 160) } }, select: { offer: true } })
    const offerID = campaigns.docs[0]?.offer
    if (typeof offerID !== 'string') unavailable = true
    else {
      try { await resolveCheckout(offerID, campaignCode); offers = offers.filter(o => o.id === offerID).map(o => ({ ...o, primary: true })); unavailable ||= offers.length === 0 }
      catch (error) { if (error instanceof CheckoutError) unavailable = true; else throw error }
    }
  }
  if (unavailable) offers = []
  return <BookLanding book={book} offers={offers} campaignCode={campaignCode || undefined} campaignUnavailable={unavailable} sample={await sampleForBook(book.id)} />
}
