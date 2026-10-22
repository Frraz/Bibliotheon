import { TokenAction } from '../../../components/SampleForms'
import { pageMetadata, single, type SearchParams } from '../../../modules/catalog/seo'
export const metadata = { ...pageMetadata('Preferências de e-mail', '/preferencias', undefined, true), referrer: 'no-referrer' as const }
export default async function PreferencesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const token = single((await searchParams).t)
  return <section className="container section sample-page"><p className="eyebrow">Suas escolhas</p><h1>Preferências de e-mail</h1><p>Você pode cancelar todo o marketing por e-mail da Bibliotheon. Amostras solicitadas continuam disponíveis; uma nova assinatura exige uma nova confirmação.</p><TokenAction token={token.length <= 128 ? token : ''} kind="unsubscribe" /></section>
}
