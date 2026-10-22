import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listArticles } from '../../../modules/catalog/public'
import { pageMetadata, pageNumber, type SearchParams } from '../../../modules/catalog/seo'
import { Pagination } from '../../../components/Pagination'
export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }) { return pageMetadata('Artigos', '/artigos', 'Ideias, exemplos e leituras da Bibliotheon.', Object.keys(await searchParams).length > 0) }
export default async function Articles({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const page = pageNumber((await searchParams).page)
  if (!page) notFound()
  const articles = await listArticles({ page })
  if (page > articles.totalPages) notFound()
  return <div className="container"><header className="page-heading"><p className="eyebrow">Para continuar aprendendo</p><h1>Artigos</h1><p className="intro">Ideias e exemplos para acompanhar suas leituras.</p></header>{articles.docs.length ? <div className="article-list">{articles.docs.map(article => <article key={article.id}><p className="eyebrow">{article.theme?.name}</p><h2><Link href={`/artigos/${article.slug}`}>{article.title}</Link></h2><p>{article.summary}</p><p className="muted">{article.author}</p></article>)}</div> : <div className="empty"><h2>As primeiras leituras estão em preparação.</h2><p>Volte em breve para conhecer os artigos publicados.</p></div>}<Pagination page={page} totalPages={articles.totalPages} path="/artigos" /></div>
}
