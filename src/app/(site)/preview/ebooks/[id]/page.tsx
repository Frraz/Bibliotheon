import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { cms, projectBook } from '../../../../../modules/catalog/public'
import { BookLanding } from '../../../../../components/Books'
export const metadata = { title: 'Pré-visualização privada', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'
export default async function Preview({ params }: { params: Promise<{ id: string }> }) {
  const payload = await cms()
  const { user } = await payload.auth({ headers: await headers() })
  if (!user || user.collection !== 'admin-users' || user.role !== 'owner') redirect('/admin/login')
  const { id } = await params
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound()
  const doc = await payload.findByID({ collection: 'ebooks', id, overrideAccess: false, user, draft: true, disableErrors: true, depth: 0 })
  if (!doc) notFound()
  return <BookLanding book={await projectBook(doc)} preview />
}
