import Link from 'next/link'
export default function NotFound() {
  return <div className="container hero"><p className="eyebrow">Página não encontrada</p><h1>Este caminho não está no catálogo.</h1><p>A página pode ter mudado de endereço.</p><Link className="button" href="/ebooks">Explorar o catálogo</Link></div>
}
