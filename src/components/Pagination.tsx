import Link from 'next/link'
export function Pagination({ page, totalPages, path, params = {} }: { page: number; totalPages: number; path: string; params?: Record<string, string> }) {
  if (totalPages <= 1) return null
  const href = (p: number) => `${path}?${new URLSearchParams({ ...params, page: String(p) })}`
  return <nav className="pagination" aria-label="Paginação">{page > 1 && <Link className="button secondary" href={href(page - 1)}>Anterior</Link>}<span aria-current="page">Página {page} de {totalPages}</span>{page < totalPages && <Link className="button secondary" href={href(page + 1)}>Próxima</Link>}</nav>
}
