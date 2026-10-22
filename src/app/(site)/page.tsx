import Link from 'next/link'
import { BookCard, Cover } from '../../components/Books'
import { listArticles, listBooks, listThemes } from '../../modules/catalog/public'
import { pageMetadata } from '../../modules/catalog/seo'
export const metadata = pageMetadata('Bibliotheon — conhecimento em edição', '/', 'Livros digitais para explorar ideias, aprender e colocar o conhecimento em prática.')
export default async function Home() {
  const [books, articles, themes] = await Promise.all([listBooks({ limit: 6 }), listArticles(), listThemes()])
  const first = books.docs[0]
  return <div className="container"><section className="hero"><p className="eyebrow">Conhecimento em edição</p><h1>Bibliotheon</h1><p className="intro">Livros digitais para explorar ideias, aprender e colocar o conhecimento em prática.</p></section>
    {books.totalDocs === 1 && first ? <section className="section feature-book"><div><p className="eyebrow">Conheça nossa primeira edição</p><h2>{first.title}</h2><p className="intro">{first.summary}</p><Link className="button" href={`/ebooks/${first.slug}`}>Conhecer o livro</Link></div><Cover book={first} priority /></section> : books.docs.length ? <section className="section"><div className="section-title"><h2>Explore nossas edições</h2><Link href="/ebooks">Ver catálogo completo →</Link></div><div className="book-grid">{books.docs.map(book => <BookCard key={book.id} book={book} />)}</div></section> : <section className="section"><div className="empty"><h2>Nosso catálogo está em preparação.</h2><p className="muted">Estamos preparando as primeiras obras. Os livros e suas amostras estarão disponíveis aqui quando forem publicados.</p></div></section>}
    {themes.length > 0 && <section className="section"><h2>Caminhos de leitura</h2><ul className="theme-list">{themes.map(theme => <li key={theme.id}><Link href={`/temas/${theme.slug}`}>{theme.name} →</Link></li>)}</ul></section>}
    {articles.docs.length > 0 && <section className="section"><div className="section-title"><h2>Entre uma leitura e outra</h2><Link href="/artigos">Todos os artigos →</Link></div><div className="article-list">{articles.docs.slice(0, 3).map(article => <article key={article.id}><h3><Link href={`/artigos/${article.slug}`}>{article.title}</Link></h3><p className="muted">{article.summary}</p></article>)}</div></section>}
  </div>
}
