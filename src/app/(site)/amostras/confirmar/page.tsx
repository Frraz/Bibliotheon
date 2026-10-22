import { TokenAction } from '../../../../components/SampleForms'
import { pageMetadata, single, type SearchParams } from '../../../../modules/catalog/seo'
export const metadata = { ...pageMetadata('Confirme sua solicitação', '/amostras/confirmar', undefined, true), referrer: 'no-referrer' as const }
export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const token = single((await searchParams).t)
  return <section className="container section sample-page"><p className="eyebrow">Seu próximo capítulo</p><h1>Confirme sua solicitação</h1><p>Use o botão para confirmar e acessar a amostra. Abrir esta página não confirma o pedido.</p><TokenAction token={token.length <= 128 ? token : ''} kind="confirmation" /></section>
}
