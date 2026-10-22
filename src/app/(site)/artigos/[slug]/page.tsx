import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { EditorialText, TableOfContents } from '../../../../components/EditorialText'
import { getArticle, getRedirect } from '../../../../modules/catalog/public'
import { pageMetadata } from '../../../../modules/catalog/seo'
type Props = { params: Promise<{ slug: string }> }
export async function generateMetadata({ params }: Props) { const article = await getArticle((await params).slug); return article ? pageMetadata(article.seo?.title || article.title, `/artigos/${article.slug}`, article.seo?.description || article.summary) : pageMetadata('Artigo não encontrado', '/artigos', undefined, true) }
export default async function Article({ params }: Props) {
  const { slug } = await params, article = await getArticle(slug)
  if (!article) { const to = await getRedirect(`/artigos/${slug}`); if (to) permanentRedirect(to); notFound() }
  return <article className="container reading-page"><header className="page-heading"><p className="eyebrow">{article.theme?.name || 'Leituras'}</p><h1>{article.title}</h1><p className="intro">{article.summary}</p><p className="muted">Por {article.author} · Revisado em {new Date(article.updatedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Belem' })}</p></header><TableOfContents data={article.body} /><EditorialText data={article.body} />{article.ebookSlug && <aside className="section"><h2>Continue esta leitura</h2><Link className="button secondary" href={`/ebooks/${article.ebookSlug}`}>Conhecer o livro relacionado</Link></aside>}</article>
}
