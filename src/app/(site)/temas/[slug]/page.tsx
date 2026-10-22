import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { listThemes, listBooks, listArticles, getRedirect } from '../../../../modules/catalog/public'
import { pageMetadata, pageNumber, type SearchParams } from '../../../../modules/catalog/seo'
import { BookCard } from '../../../../components/Books'
import { Pagination } from '../../../../components/Pagination'
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }
export async function generateMetadata({ params, searchParams }: Props) { const { slug } = await params; const current = (await listThemes()).find(t => t.slug === slug); return current ? pageMetadata(current.name, `/temas/${slug}`, current.introduction, Object.keys(await searchParams).length > 0) : pageMetadata('Tema não encontrado', '/ebooks', undefined, true) }
export default async function ThemePage({ params, searchParams }: Props) {
  const { slug } = await params, theme = (await listThemes()).find(t => t.slug === slug)
  if (!theme) { const to = await getRedirect(`/temas/${slug}`); if (to) permanentRedirect(to); notFound() }
  const page = pageNumber((await searchParams).page)
  if (!page) notFound()
  const [books, articles] = await Promise.all([listBooks({ theme: slug, page }), listArticles({ theme: theme.id })])
  if (page > books.totalPages) notFound()
  return <div className="container"><header className="page-heading"><p className="eyebrow">Caminhos de leitura</p><h1>{theme.name}</h1><p className="intro">{theme.introduction}</p></header>{books.docs.length > 0 && <section className="section"><h2>E-books sobre o tema</h2><div className="book-grid">{books.docs.map(book => <BookCard key={book.id} book={book} />)}</div><Pagination page={page} totalPages={books.totalPages} path={`/temas/${slug}`} /></section>}{articles.docs.length > 0 && <section className="section"><h2>Artigos relacionados</h2><div className="article-list">{articles.docs.map(article => <article key={article.id}><h3><Link href={`/artigos/${article.slug}`}>{article.title}</Link></h3><p>{article.summary}</p></article>)}</div></section>}</div>
}
