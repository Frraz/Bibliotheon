import { notFound } from 'next/navigation'
import { EditorialText } from '../../../components/EditorialText'
import { siteSettings } from '../../../modules/catalog/public'
import { pageMetadata } from '../../../modules/catalog/seo'
const titles: Record<string, string> = { sobre: 'Sobre a Bibliotheon', contato: 'Contato', privacidade: 'Privacidade', termos: 'Termos de uso' }
type Props = { params: Promise<{ institutional: string }> }
export async function generateMetadata({ params }: Props) { const key = (await params).institutional; return pageMetadata(titles[key] || 'Página não encontrada', `/${key}`, undefined, !(await siteSettings()).legalReady) }
export default async function Institutional({ params }: Props) {
  const key = (await params).institutional
  if (!titles[key]) notFound()
  const settings = await siteSettings()
  const body = key === 'sobre' ? settings.about : key === 'privacidade' ? settings.privacyPolicy : key === 'termos' ? settings.terms : null
  return <article className="container reading-page"><header className="page-heading"><p className="eyebrow">Bibliotheon</p><h1>{titles[key]}</h1></header>{key === 'contato' ? settings.contactEmail && settings.legalReady ? <div className="prose"><p>Fale com {settings.responsibleName} pelo e-mail <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>.</p><p>Para acesso a compras já realizadas, consulte também o suporte da plataforma em que você comprou.</p></div> : <p>O canal de atendimento está em preparação.</p> : body && settings.legalReady ? <EditorialText data={body} /> : <p>As informações desta página estão em preparação e serão disponibilizadas antes do lançamento.</p>}</article>
}
