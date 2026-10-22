import Link from 'next/link'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'

export async function Dashboard({ initPageResult }: AdminViewServerProps) {
  const { req } = initPageResult
  const [books, drafts, offers, requests, queued, attention] = await Promise.all([
    req.payload.count({ collection: 'ebooks', overrideAccess: false, req, where: { and: [{ _status: { equals: 'published' } }, { archived: { not_equals: true } }] } }),
    req.payload.count({ collection: 'ebooks', overrideAccess: false, req, where: { _status: { equals: 'draft' } } }),
    req.payload.count({ collection: 'offers', overrideAccess: false, req, where: { active: { equals: true } } }),
    req.payload.count({ collection: 'magnet-requests', overrideAccess: false, req, where: { confirmedAt: { exists: true } } }),
    req.payload.count({ collection: 'email-deliveries', overrideAccess: false, req, where: { state: { equals: 'pending' } } }),
    req.payload.count({ collection: 'email-deliveries', overrideAccess: false, req, where: { state: { in: ['uncertain', 'failed'] } } }),
  ])
  return <Gutter className="bibliotheon-dashboard"><header><p className="bibliotheon-kicker">Bibliotheon</p><h1>Painel de controle</h1><p>Organize suas edições e prepare a próxima publicação.</p></header>
    <section aria-labelledby="catalogo-painel"><h2 id="catalogo-painel">Seu catálogo</h2><dl className="bibliotheon-summary"><div><dt>Livros publicados</dt><dd>{books.totalDocs}</dd></div><div><dt>Livros em rascunho</dt><dd>{drafts.totalDocs}</dd></div><div><dt>Ofertas ativas</dt><dd>{offers.totalDocs}</dd></div></dl></section>
    <section aria-labelledby="trabalho-editorial"><h2 id="trabalho-editorial">Trabalho editorial</h2><ul className="bibliotheon-admin-links"><li><Link href="/admin/collections/ebooks/create">Cadastrar livro</Link></li><li><Link href="/admin/collections/ebooks">Revisar livros</Link></li><li><Link href="/admin/collections/offers">Conferir ofertas</Link></li><li><Link href="/admin/collections/articles">Preparar artigos</Link></li><li><Link href="/admin/globals/site-settings">Revisar informações institucionais</Link></li></ul></section>
    <section aria-labelledby="amostras-painel"><h2 id="amostras-painel">Amostras e relacionamento</h2><dl className="bibliotheon-summary"><div><dt>Pedidos confirmados</dt><dd>{requests.totalDocs}</dd></div><div><dt>E-mails na fila</dt><dd>{queued.totalDocs}</dd></div><div><dt>Envios para revisar</dt><dd>{attention.totalDocs}</dd></div></dl><p>Um envio aceito pelo transporte ainda não comprova chegada à caixa postal. Resultados incertos precisam de conferência antes de repetir.</p><ul className="bibliotheon-admin-links"><li><Link href="/admin/collections/lead-magnets">Preparar amostras</Link></li><li><Link href="/admin/collections/email-deliveries">Conferir envios</Link></li><li><Link href="/admin/collections/contacts">Consultar contatos</Link></li></ul></section>
    <ul className="bibliotheon-admin-links"><li><Link href="/admin/collections/email-sequences">Preparar sequências</Link></li><li><Link href="/admin/collections/promotion-deliveries">Conferir calendário promocional</Link></li><li><Link href="/admin/suppressions">Registrar descadastro ou bloqueio de e-mail</Link></li></ul>
    <section aria-labelledby="resultados-pendentes"><h2 id="resultados-pendentes">Resultados comerciais</h2><p>Os resultados aguardam configuração das integrações e conciliação. Uma oferta ativa ou um clique não confirma uma compra.</p></section>
  </Gutter>
}
