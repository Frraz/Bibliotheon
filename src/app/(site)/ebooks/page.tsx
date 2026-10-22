import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listBooks, listThemes } from '../../../modules/catalog/public'
import { pageMetadata, pageNumber, single, type SearchParams } from '../../../modules/catalog/seo'
import { BookCard } from '../../../components/Books'
import { Pagination } from '../../../components/Pagination'
export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  return pageMetadata('Catálogo de e-books', '/ebooks', 'Explore o catálogo da Bibliotheon por assunto e conheça cada edição.', Object.keys(params).length > 0)
}
export default async function Catalog({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const q = single(params.q).slice(0, 120), theme = single(params.tema), page = pageNumber(params.page)
  if (!page || Array.isArray(params.q) || Array.isArray(params.tema)) notFound()
  const [books, themes] = await Promise.all([listBooks({ q, theme, page }), listThemes()])
  if (page > books.totalPages) notFound()
  return <div className="container"><header className="page-heading"><p className="eyebrow">Explore por interesse</p><h1>Catálogo de e-books</h1><p className="intro">Cada livro, uma oportunidade de aprender algo novo. Conheça o conteúdo antes de escolher sua edição.</p></header>
    <form className="catalog-search" action="/ebooks" method="get"><label>Buscar no catálogo<input type="search" name="q" defaultValue={q} maxLength={120} placeholder="Título ou assunto" /></label><label>Tema<select name="tema" defaultValue={theme}><option value="">Todos os temas</option>{themes.map(t => <option key={t.id} value={t.slug}>{t.name}</option>)}</select></label><button type="submit" className="button">Buscar</button>{(q || theme) && <Link href="/ebooks">Limpar filtros</Link>}</form>
    <p className="result-count" role="status">{books.totalDocs} {books.totalDocs === 1 ? 'livro encontrado' : 'livros encontrados'}</p>
    {books.docs.length ? <div className="book-grid">{books.docs.map(book => <BookCard key={book.id} book={book} />)}</div> : <div className="empty"><h2>{q || theme ? 'Nenhum livro para esta busca.' : 'Nosso catálogo está em preparação.'}</h2><p>{q || theme ? 'Tente outro termo ou remova os filtros.' : 'As primeiras obras aparecerão aqui quando forem publicadas.'}</p></div>}
    <Pagination page={page} totalPages={books.totalPages} path="/ebooks" params={{ ...(q ? { q } : {}), ...(theme ? { tema: theme } : {}) }} />
  </div>
}
