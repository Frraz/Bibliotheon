import type { Manifest } from './contract'
const escape = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
function text(v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(text).join('\n')
  if (v && typeof v === 'object') {
    const d = v as Record<string, unknown>
    if (typeof d.text === 'string') return d.text
    if (d.root) return text(d.root)
    if (d.children) return text(d.children)
    if (d.question) return `${text(d.question)}\n${text(d.answer)}`
  }
  return ''
}
export function previewHTML(m: Manifest, result: Record<string, unknown>, origin: string, cover: string) {
  const b = result.book as Record<string, unknown>, offers = result.offers as { data: Record<string, unknown> }[] || []
  const blockers = [...new Set([...(Array.isArray(result.blockers) ? result.blockers : []), ...(Array.isArray(result.conflicts) ? result.conflicts.map(c => `Escolher qual conteúdo preservar: ${c}`) : [])])]
  const fields = [['Resumo', 'summary'], ['Para quem é', 'audience'], ['Problema abordado', 'problem'], ['O que o livro entrega', 'promise'], ['Apresentação', 'body'], ['Aprendizagens', 'benefits'], ['Sumário', 'contents'], ['Requisitos', 'requirements'], ['Limites', 'limits'], ['Dúvidas frequentes', 'faq']]
  const ext = m.cover.file.split('.').at(-1), mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>Revisão — ${escape(b.title)}</title><style>body{max-width:880px;margin:40px auto;padding:20px;font:18px/1.6 system-ui;color:#172536;background:#faf9f5}img{max-width:240px}p,pre{white-space:pre-wrap;overflow-wrap:anywhere}section{margin:2rem 0}aside{padding:1rem;border:1px solid #777}summary{cursor:pointer}pre{font-size:14px}</style><h1>${escape(b.title)}</h1><p>Destino: ${escape(origin)}<br>Revisão do conteúdo que será enviado. Esta tela não publica o livro.</p><aside><strong>${result.canPublish ? 'Pronto para confirmar a publicação' : 'Ainda há pendências'}</strong>${blockers.length ? `<ul>${blockers.map(v => `<li>${escape(v)}</li>`).join('')}</ul>` : '<p>Depois de revisar, volte ao terminal e confirme PUBLICAR.</p>'}</aside>${b.cover === `sha256:${m.cover.sha256}` ? `<img alt="${escape(b.coverAlt || m.cover.alt)}" src="data:${mime};base64,${cover}">` : '<p>Capa preservada do site. Confira a imagem no painel antes de confirmar.</p>'}${fields.map(([label, key]) => text(b[key]) ? `<section><h2>${label}</h2><p>${escape(text(b[key]))}</p></section>` : '').join('')}<section><h2>Compra</h2>${offers.length ? offers.map(o => `<p>${escape(o.data.provider)} — ${o.data.active ? 'oferta ativa' : 'oferta inativa'}<br>${o.data.priceCents == null ? 'Preço não informado' : `R$ ${(Number(o.data.priceCents) / 100).toFixed(2)}`}<br>${escape(o.data.checkoutUrl)}</p>`).join('') : '<p>Nenhuma nova oferta neste envio. Ofertas já cadastradas no site são preservadas.</p>'}</section><details><summary>Ver diferenças e dados técnicos</summary><pre>${escape(JSON.stringify({ book: b, offers, changes: result.changes }, null, 2))}</pre></details></html>`
}
