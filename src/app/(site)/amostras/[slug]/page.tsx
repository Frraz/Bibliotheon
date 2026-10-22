import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SampleForm } from '../../../../components/SampleForms'
import { cms } from '../../../../modules/catalog/public'
import { pageMetadata, single, type SearchParams } from '../../../../modules/catalog/seo'
import { captureEnabled } from '../../../../modules/marketing/http'
import { availableMagnet } from '../../../../modules/marketing/service'
import { validSlug } from '../../../../modules/catalog/validation'
export const metadata = pageMetadata('Amostra gratuita', '/ebooks', undefined, true)
export default async function SamplePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const { slug } = await params
  if (!validSlug(slug)) notFound()
  const payload = await cms()
  const magnets = await payload.find({ collection: 'lead-magnets', where: { and: [{ slug: { equals: slug } }, { active: { equals: true } }] }, limit: 1, depth: 0, overrideAccess: true })
  const material = magnets.docs[0] && await availableMagnet(payload, magnets.docs[0].id)
  if (!material) notFound()
  const query = await searchParams, campaign = single(query.c)
  return <section className="container section sample-page"><p className="eyebrow">Leia antes de escolher</p><h1>{material.magnet.title}</h1>
    {material.magnet.description && <p className="lead">{material.magnet.description}</p>}
    <p>Amostra gratuita de <Link href={`/ebooks/${material.book.slug}`}>{material.book.title}</Link>.</p>
    {await captureEnabled() ? <SampleForm magnetId={material.magnet.id} campaignCode={/^[a-z0-9][a-z0-9_-]{0,79}$/.test(campaign) ? campaign : undefined} /> : <p>A solicitação de amostras está temporariamente indisponível. Você pode continuar explorando o livro.</p>}
  </section>
}
