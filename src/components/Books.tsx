import Image from 'next/image'
import Link from 'next/link'
import type { PublicBook, PublicOffer } from '../modules/catalog/public'
import { EditorialText } from './EditorialText'

export function Cover({ book, priority = false }: { book: PublicBook; priority?: boolean }) {
  return <div className="book-cover">{book.cover ? <Image src={`/api/v1/media/${book.cover.id}`} alt={book.cover.alt} width={book.cover.width} height={book.cover.height} unoptimized priority={priority} /> : <div className="cover-missing"><span>{book.title}</span><small>Capa indisponível</small></div>}</div>
}
export function BookCard({ book }: { book: PublicBook }) {
  return <article className="book-card"><Link href={`/ebooks/${book.slug}`} tabIndex={-1} aria-hidden="true"><Cover book={book} /></Link><div>{book.theme && <p className="eyebrow">{book.theme.name}</p>}<h2><Link href={`/ebooks/${book.slug}`}>{book.title}</Link></h2><p className="muted">{book.summary}</p>{book.materialState === 'production' && <p className="availability">Em preparação</p>}</div></article>
}
export const providerNames = { hotmart: 'Hotmart', kiwify: 'Kiwify', cakto: 'Cakto' }
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
function Offer({ offer, campaignCode }: { offer: PublicOffer; campaignCode?: string }) {
  return <div className="offer-item"><p className="price">{offer.priceCents == null ? 'Preço não informado' : brl.format(offer.priceCents / 100)}</p><p>E-book digital. Compra e entrega pela {providerNames[offer.provider]}.</p><a className="button" href={`/comprar/${offer.id}${campaignCode ? `?c=${encodeURIComponent(campaignCode)}` : ''}`}>Comprar na {providerNames[offer.provider]}</a>{offer.lastVerifiedAt && <p className="offer-note">Preço conferido em {new Date(offer.lastVerifiedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Belem' })}. Confira as condições no checkout.</p>}</div>
}
export function PurchaseOptions({ offers, campaignCode, unavailable }: { offers: PublicOffer[]; campaignCode?: string; unavailable?: boolean }) {
  const primary = offers.find(offer => offer.primary)
  const alternatives = offers.filter(offer => offer.id !== primary?.id)
  return <section className="purchase" aria-labelledby="oferta"><h2 id="oferta">A edição digital</h2>{unavailable ? <p role="status">A oferta desta campanha está indisponível. O destino original foi preservado; consulte o responsável pela divulgação.</p> : <>{primary ? <Offer offer={primary} campaignCode={campaignCode} /> : <p>Oferta principal indisponível no momento.</p>}{alternatives.length > 0 && <details><summary>Outras opções de compra</summary><div className="alternative-offers">{alternatives.map(offer => <Offer key={offer.id} offer={offer} />)}</div></details>}</>}</section>
}
export function BookLanding({ book, offers = [], campaignCode, campaignUnavailable, sample, preview }: { book: PublicBook; offers?: PublicOffer[]; campaignCode?: string; campaignUnavailable?: boolean; sample?: { slug: string; title: string } | null; preview?: boolean }) {
  const content = <><section className="section prose"><h2>O que você encontra nesta edição</h2><EditorialText data={book.body} />{book.contents?.length ? <ol className="contents-list">{book.contents.map((item, i) => <li key={item.id || i}>{item.text}</li>)}</ol> : <p>{book.summary}</p>}</section><section className="section split"><div><h2>Antes de começar</h2><p>{book.requirements}</p></div><div><h2>Escopo e limites</h2><p>{book.limits}</p></div></section></>
  const exercise = book.workbookExample ? <section className="section"><p className="eyebrow">Trecho do material</p><h2>Um exercício para conhecer a proposta</h2><blockquote className="exercise prose">{book.workbookExample}</blockquote></section> : null
  return <article className={`container landing variant-${book.presentationVariant}`} data-accent={book.accentPreset}>
    {preview && <p className="alert">Pré-visualização privada. Esta revisão ainda pode ter pendências; os botões de compra estão desativados aqui.</p>}
    <div className="book-hero"><div><p className="eyebrow">{book.theme?.name || 'Edição digital'}</p><h1>{book.title}</h1><p className="intro">{book.promise || book.summary}</p><p className="muted">{book.audience}</p>{book.materialState === 'production' && <p className="availability">Livro em preparação. Compra indisponível.</p>}{sample && <Link className="text-action" href={`/amostras/${sample.slug}`}>Conhecer a amostra →</Link>}{!preview && !campaignUnavailable && offers.find(offer => offer.primary) && <div className="hero-offer"><Offer offer={offers.find(offer => offer.primary)!} campaignCode={campaignCode} /></div>}</div><Cover book={book} priority /></div>
    {book.presentationVariant === 'workbook' && exercise}
    {book.presentationVariant === 'reading' ? content : <><section className="section split"><div><h2>Para quem é este livro</h2><p>{book.audience}</p><p>{book.problem}</p></div>{book.benefits?.length ? <div><h2>O que você poderá aprender</h2><ul>{book.benefits.map((item, i) => <li key={item.id || i}>{item.text}</li>)}</ul></div> : null}</section>{content}</>}
    {!preview && book.materialState === 'ready' && <PurchaseOptions offers={offers} campaignCode={campaignCode} unavailable={campaignUnavailable} />}
    {book.faq?.length ? <section className="section faq"><h2>Perguntas frequentes</h2>{book.faq.map((item, i) => <details key={item.id || i}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section> : null}
  </article>
}
