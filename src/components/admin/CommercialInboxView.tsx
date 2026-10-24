import type {AdminViewServerProps} from 'payload'
import {DefaultTemplate} from '@payloadcms/next/templates'
import {Gutter} from '@payloadcms/ui'
import {redirect} from 'next/navigation'
import Link from 'next/link'
import {commercialSummary,commercialInboxPage,parseInboxFilters,inboxPageLink,inboxFilters,type InboxFilters} from '../../modules/commerce/admin'
import {commercialDate,commercialErrorLabel,inboxStateLabels,retryAvailability} from '../../modules/commerce/presentation'
import {CommercialRetryForm} from './CommercialRetryForm'
import {CommercialFeedback} from './CommercialFeedback'

const names={all:'Todos os estados',attention:'Precisam de atenção',...inboxStateLabels}
const providers={hotmart:'Hotmart',kiwify:'Kiwify',cakto:'Cakto'} as const
type InboxData={filters:InboxFilters;summary:Awaited<ReturnType<typeof commercialSummary>>;page:Awaited<ReturnType<typeof commercialInboxPage>>}
function InboxContent({filters,summary,page,now}:InboxData&{now:number}){
 return <>
   <section aria-labelledby="commercial-overview"><h2 id="commercial-overview">Panorama dos provedores</h2><p>Consulta em {commercialDate(summary.observedAt)} (horário de Belém). Contagens abrangem todas as contas. São eventos operacionais, não quantidades de vendas; revisão pode incluir um evento já aplicado.</p>
    <div className="bibliotheon-commercial-providers">{summary.providers.map(p=><article key={p.provider}><h3>{providers[p.provider]}</h3><p>Recepção nativa ainda não homologada.</p><dl className="bibliotheon-commercial-facts"><div><dt>Na fila</dt><dd>{p.pending}</dd></div><div><dt>Em processamento</dt><dd>{p.processing}</dd></div><div><dt>Precisam de atenção</dt><dd>{p.attention}</dd></div><div><dt>Pendência mais antiga</dt><dd>{p.oldestOutstandingAt?commercialDate(p.oldestOutstandingAt):'Sem pendências'}</dd></div><div><dt>Último evento recebido</dt><dd>{p.lastReceivedAt?commercialDate(p.lastReceivedAt):'Sem registro'}</dd></div><div><dt>Última aplicação local</dt><dd>{p.lastSuccessAt?commercialDate(p.lastSuccessAt):'Sem aplicação registrada'}</dd></div></dl></article>)}</div>
   </section>
   <section aria-labelledby="commercial-events"><h2 id="commercial-events">Eventos recebidos</h2>{filters.event&&<p>Consulta de um evento selecionado. <Link href="/admin/commercial-inbox?provider=all&state=all">Consultar todos os eventos</Link></p>}<form className="bibliotheon-operational-form bibliotheon-commercial-filters" action="/admin/commercial-inbox" method="get"><fieldset><legend>Filtrar eventos</legend>{filters.event&&<input type="hidden" name="event" value={filters.event}/>}<label htmlFor="commercial-provider">Provedor</label><select id="commercial-provider" name="provider" defaultValue={filters.provider}><option value="all">Todos os provedores</option>{Object.entries(providers).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><label htmlFor="commercial-state">Estado do processamento</label><select id="commercial-state" name="state" defaultValue={filters.state}>{inboxFilters.map(value=><option value={value} key={value}>{names[value]}</option>)}</select><button type="submit">Aplicar filtros</button></fieldset></form>
    <p>{page.totalDocs} evento(s) encontrados. A lista segue os filtros; as contagens acima permanecem gerais.</p>
    {!page.docs.length?<p>Nenhum evento corresponde a estes filtros.</p>:<ol className="bibliotheon-commercial-events">{page.docs.map(row=><li key={row.id}><article><h3>{providers[row.provider]} · {row.eventKey}</h3><p>{inboxStateLabels[row.state]}{row.conflicted?' · Colisão de evento':''}</p><dl className="bibliotheon-commercial-facts"><div><dt>Conta interna</dt><dd>{row.accountKey}</dd></div><div><dt>Recebido em</dt><dd>{commercialDate(row.receivedAt)}</dd></div><div><dt>Tentativas acumuladas</dt><dd>{row.attempts}</dd></div><div><dt>Próxima tentativa</dt><dd>{row.state==='pending'||row.state==='failed'?commercialDate(row.nextAttemptAt):'Não agendada'}</dd></div></dl><p>{row.state==='processing'&&!retryAvailability(row,now)?'O prazo de processamento foi excedido. Confira a causa antes de reprocessar.':commercialErrorLabel(row.errorCode)}</p><p><Link href={`/admin/collections/commercial-inbox/${row.id}`}>Conferir histórico do evento</Link></p><details><summary>Reprocessar evento</summary><CommercialRetryForm id={row.id} blockedReason={retryAvailability(row,now)} processingEnabled={process.env.COMMERCIAL_EVENTS_ENABLED==='true'}/></details></article></li>)}</ol>}
    <nav aria-label="Páginas de eventos" className="bibliotheon-commercial-pagination">{page.hasPrevPage&&<Link href={inboxPageLink(filters,filters.page-1)}>Página anterior</Link>}<span aria-current="page">Página {filters.page} de {Math.max(1,page.totalPages)}</span>{page.hasNextPage&&<Link href={inboxPageLink(filters,filters.page+1)}>Próxima página</Link>}</nav>
   </section>
  </>
}
export async function CommercialInboxView({initPageResult,params,searchParams,user}:AdminViewServerProps){
 const {req}=initPageResult
 if(req.user?.collection!=='admin-users'||req.user.role!=='owner')redirect('/admin/login')
 let content:InboxData|null=null
 try{
  const filters=parseInboxFilters(searchParams||{}),summary=await commercialSummary(req)
  const page=await commercialInboxPage(req,filters,Date.parse(summary.observedAt))
  content={filters,summary,page}
 }catch{/* Render a recoverable query error below, without exposing database details. */}
 return <DefaultTemplate i18n={req.i18n} locale={initPageResult.locale} params={params} payload={req.payload} permissions={initPageResult.permissions} searchParams={searchParams} user={user} visibleEntities={initPageResult.visibleEntities}><Gutter className="bibliotheon-dashboard bibliotheon-commercial"><header><p className="bibliotheon-kicker">Operação comercial</p><h1>Acompanhamento de eventos</h1><p>Confira pendências e preserve o histórico de cada transação.</p><p>Processamento automático {process.env.COMMERCIAL_EVENTS_ENABLED==='true'?'habilitado':'desativado'}. Aprovação de pagamento, dinheiro recebido e lucro são conceitos distintos. Integrações e conciliação reais ainda aguardam homologação.</p></header><CommercialFeedback>{content?<InboxContent {...content} now={Date.parse(content.summary.observedAt)}/>:(<section><h2>Consulta indisponível</h2><p role="alert">Não foi possível carregar esta consulta. Revise os filtros e tente novamente. Nenhum evento foi alterado.</p><p><Link href="/admin/commercial-inbox">Reabrir acompanhamento com filtros padrão</Link></p></section>)}</CommercialFeedback><p><Link href="/admin">Voltar ao painel</Link></p></Gutter></DefaultTemplate>
}
