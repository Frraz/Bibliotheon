import {Suspense} from 'react'
import {Analytics} from '../../components/Analytics'
import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { appearanceBootstrap } from '../../modules/appearance'
import { SiteHeader } from '../../components/SiteHeader'
import '../../styles/site.css'
import { siteSettings } from '../../modules/catalog/public'
import { siteOrigin } from '../../modules/catalog/seo'
export const dynamic = 'force-dynamic'
export async function generateMetadata(): Promise<Metadata> { await headers(); return { metadataBase: new URL(siteOrigin()), title: { default: 'Bibliotheon', template: '%s | Bibliotheon' }, description: 'Conhecimento em edição.', ...(!(await siteSettings()).legalReady ? { robots: { index: false, follow: false } } : {}) } }
export default async function Layout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') || undefined
  return <html lang="pt-BR" suppressHydrationWarning><head><script nonce={nonce} dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} /></head><body>
    <a className="skip" href="#conteudo">Ir para o conteúdo</a>
    <SiteHeader />
    <main id="conteudo" tabIndex={-1}>{children}</main>
    <Suspense fallback={null}><Analytics /></Suspense>
    <noscript><section className="analytics-choice container" aria-labelledby="measurement-noscript"><h2 id="measurement-noscript">Privacidade de navegação</h2><p>Sem JavaScript, as páginas não são medidas. Você pode remover uma permissão anterior de medição.</p><form action="/api/v1/analytics-withdrawal" method="post"><input type="hidden" name="choice" value="reject" /><button type="submit">Revogar medição</button></form></section></noscript>
    <footer className="site-footer"><div className="container footer-inner"><div><Link className="brand" href="/">Bibliotheon</Link><p className="muted">Conhecimento em edição.</p></div><nav className="footer-links" aria-label="Institucional"><Link href="/sobre">Sobre</Link><Link href="/contato">Contato</Link><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos</Link></nav></div></footer>
  </body></html>
}
