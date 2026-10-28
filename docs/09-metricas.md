# 09 — Medição e decisões

[Índice](../README.md) · [Integrações](07-integracoes.md)

Especificação da medição completa, revisada documentalmente em 28/10/2026 (D129). P01–P05 têm aceite local D86; a atribuição por UUID de clique consentido foi validada em HTTP sintético integrado D88 e renovada em D127. P06 ainda exige confirmação nas contas reais; não está pendente a implementação desse fluxo HTTP local. Laboratório público D121 e carga comercial D124 têm evidência local; p75/INP de campo e capacidade da VPS não foram comprovados. P07, contas e operação/alertas reais continuam pendentes. Consentimento, clique, fato enfileirado e aprovação não equivalem a recebimento ou lucro. Ver [estado atual](23-estado-atual.md).

## Dicionário de eventos

| Evento | Fonte | Significado |
|---|---|---|
| page_view | Browser com consentimento | Página visualizada; não implica pessoa única |
| sample_requested | Servidor | Solicitação aceita, ainda não confirmada |
| sample_confirmed | Servidor | Contato confirmou pedido |
| checkout_click | Redirecionamento | Saída para oferta; nunca compra |
| purchase_approved | Conector/CSV validado | Pagamento aprovado registrado |
| purchase_refunded / chargeback | Conector/CSV validado | Reversão financeira |
| email_sent / failed | Worker/provedor | Envio tentado/aceito ou falho; aceitação não garante leitura |

Não usar abertura de e-mail como indicador central: pré-carregamento e proteção de privacidade distorcem o número. Não há GA4, pixels de anúncios ou ferramenta de analytics paga obrigatória no MVP. Analytics próprio mínimo com consentimento e Search Console externo.

## Definições de relatório

| Indicador | Cálculo e limite |
|---|---|
| Visitas medidas | Sessões consentidas de 30 minutos de inatividade; cobertura parcial |
| CTR de checkout | Sessões medidas com ≥1 clique / sessões medidas na LP; mesma população e período |
| Conversão de amostra | Sessões medidas com pedido / sessões medidas da página; não misturar pedidos sem vínculo |
| Compras aprovadas | Transações únicas com aprovação no período; exibir reversões separadamente |
| Conversão atribuída | Cliques consentidos com compra vinculada em até 30 dias / cliques consentidos da coorte; janela e maturidade visíveis |
| Receita bruta aprovada | Soma de grossCents de aprovações únicas em BRL |
| Receita após devoluções | Bruto menos devoluções conhecidas, sem duplicar reembolso e chargeback |
| Líquido informado | Valor explicitamente informado pelo provedor; não descontar taxas novamente |
| Recebido | Valores efetivamente liquidados conforme relatório de recebimento |
| Margem estimada | Receita após devoluções menos taxas, comissões e custos aplicáveis conhecidos; incompleta se faltar componente |
| Custo por venda | Custo de campanha / transações atribuídas; não chamar de CAC por cliente sem identidade deduplicada |
| Reembolso por coorte | Compras da coorte com reversão / compras da coorte; informar maturidade |

Lucro contábil/fiscal não é calculado. Taxes/tributos desconhecidos deixam a margem incompleta. Custos compartilhados podem ser rateados uniformemente entre campanhas ativas no período, com regra exibida; manter também total sem rateio. Não chamar de canal vencedor sem volume e comparabilidade.

## Atribuição

UTMs permitidas: source, medium, campaign, content, term; limitar 120 caracteres e rejeitar valores com e-mail ou dados pessoais aparentes. Usar códigos controlados no gerador de links do painel. Canonical remove parâmetros; query completa não entra em logs.

Com consentimento, armazenar first-touch e last-touch não direto em janela de 30 dias; sessão expira após 30 minutos inativa. Atribuição final da venda usa somente clickId retornado de forma validada. Sem suporte do provedor, sem consentimento ou fora da janela: origem desconhecida. Não atribuir proporcionalmente receita desconhecida.

Exibir separadamente tráfego medido, cliques totais operacionais e cliques atribuíveis. Não calcular taxa cruzando essas populações. Relatórios por ebook, plataforma e campanha mostram também quantidade de transações sem valores/atribuição e último processamento bem-sucedido.

## Rotina decisória

Semanal: comparar fontes, revisar fila de falhas, conciliar plataformas e preencher modelo de revisão. Documentar hipótese, ação, período e resultado. Mudança de preço/LP registra data para explicar comparações; evitar teste A/B com tráfego insuficiente.

Alertas: fila pendente >15min, falha de assinatura acima do baseline, backup >26h, disco >80%, erro 5xx persistente. Ausência de venda não é falha técnica; ausência de eventos só é alerta quando existe evento esperado ou divergência no relatório.


## Implementação local D59

Sessões/visualizações consentidas e saídas operacionais estão implementadas localmente, com flag false por padrão. Sessão não é pessoa única. First-touch inclui direto; último não direto usa campanha/UTMs registradas e janela de 30 dias. Sem consentimento não há sessão/ID de atribuição; saída operacional continua separada. Dashboard de sete dias apresenta populações distintas e não calcula CTR/conversão entre elas. Não há integração analítica externa.

Gerador no formulário de campanha cria link interno a partir de códigos salvos e oferta/livro disponíveis. Query/referrer livre não são fonte de medição. URLs externas permanecem intactas até adaptador homologado; atribuição final de venda permanece desconhecida. Não existem ainda transações/ledger, relatórios financeiros, inbox comum ou conectores comerciais. [D59](17-decisoes.md) e [estado atual](23-estado-atual.md).

## Prévia não é relatório financeiro — D66

CSV possui prévia local autenticada, sem somar valores nem gerar indicadores. new/matched/duplicate são classificações técnicas de registros, não novas vendas, dinheiro recebido ou conversão. settled_cents, inclusive zero/negativo, exige evidência independente e não é gravado na projeção. Nenhuma margem/custo/lucro é apresentado. [Contrato e próximos passos](24-conciliacao.md). R16 continua pendente.


## Ledger financeiro parcial — D78

A prévia `POST /api/v1/admin/financial-report/preview` agrega transações pelo mês/data de aprovação, créditos/débitos de evidência no período de liquidação e custos no período de ocorrência. A janela é UTC, limitada a 366 dias; moedas são separadas. Cobertura acompanha bruto, reversões, taxas e líquido informado; total incompleto permanece null, e sobreposição desconhecida entre reembolso/chargeback bloqueia o subtotal líquido. Um saldo de caixa só considera movimentos de settlement registrados pelo owner a partir de fonte conferida; não é derivado do líquido do provedor. Custos compartilhados permanecem sem campanha.

A prévia é provisória, somente leitura, sem conversão cambial, associação de receita à campanha ou ROAS. Sem componentes conhecidos suficientes, os subtotais são null; cobertura explicita quantidades conhecidas. Mesmo contribuição pré-impostos conhecida não é lucro: `marginComplete=false` porque tributos e componentes adicionais não são registrados. P04/R16 seguem parciais até estados de ausência/conflito e cobertura operacional completos, UI e aceite; não houve homologação de fonte externa.

## Entrada operacional de caixa e custos — D81

A interface `/admin/financial-records` registra os movimentos D78 com conferência explícita, fonte/linha e instante UTC. Valores decimais passam a centavos sem ponto flutuante; zero confirmado continua distinto de ausência. Custo associado à campanha permanece vinculado também após correção, mas não cria atribuição de receita ou ROAS. Linhas substituídas ficam no histórico e saem do cálculo; confirmação/estimativa continuam separadas. P04 ainda exige o aceite integral de cobertura e operação, sem fonte externa homologada nesta etapa.

D82: decisão visual de identidade associa destino ou mantém bloqueio sem reescrever transações e sem registrar liquidação/custo. Não altera os significados de pagamento aprovado, recebimento, contribuição ou lucro; uma associação não conclui resolução financeira.

D83 separa resultado por transação na decisão registrada das aplicações posteriores do owner/worker. Não somar aplicações como vendas adicionais. Fonte excluída ou componente em hold conserva a revisão, sem transformar valor anterior em comprovado; null aparece como Não informado. Taxas/líquido assinados são exibidos exatamente, inclusive centavos negativos, sem alteração dos cálculos. O fluxo não registra recebimento/custo nem lucro e não conclui cobertura integral P04.

## Cobertura e observação das coortes — D84

Corrigida cobertura de liquidação por moeda: movimentos de outra moeda não aumentam a contagem de transações com evidência. Caixa de aprovações fora da janela continua no período de liquidação próprio. Substituições são resolvidas antes do filtro temporal, impedindo que a linha antiga reapareça quando a correção muda de período.

Candidatas em revisão permanecem visíveis mesmo com estado unknown; não entram em somas confirmadas nem valores conhecidos/coorte. Sem data de aprovação, são contadas separadamente e não alocadas por inferência ao período. Coorte mostra total de candidatas, população sem revisão e cobertura dos valores. A taxa usa compras com reversão conhecida (reembolso ou chargeback, contada uma vez) sobre a população, e só aparece com cobertura integral de estado e nenhuma revisão. Estado de reversão pode ser conhecido sem valor monetário; ausência de valor em aprovação sem reversão explícita não vira taxa zero. Zero de reversão explícito continua conhecido.

Idade mínima/máxima é observada desde aprovações sem revisão até observedAt; a janela externa ainda não foi homologada (windowVerified=false). Nenhuma coorte é declarada encerrada por atingir um número arbitrário de dias. O mês mostra somente a fração incluída no período consultado. Somas usam BigInt e retornam null/amount_overflow quando o resultado excede o inteiro seguro, sem mascarar isso como origem ausente. Os valores de origem continuam acompanhados de sua cobertura.

P04 permanece parcial: faltam agregações por livro/provedor/campanha, cobertura de atribuição desconhecida e último processamento bem-sucedido. observedAt é a consulta, não processamento. Campanha depende do contrato comprovado P06; não inferir receita por custo, e-mail, IP ou coincidência temporal. Homologação externa e release continuam em H01–H06.

## Detalhamentos e sucesso registrado — D85

Relatório acrescenta livro, provedor e campanha, sempre separados por moeda. Por livro usa vínculo efetivo conferido, preservando original; revisão fica sem livro conferido e fora dos valores de aprovação. Caixa mantém sua data: alocação pode usar uma transação aprovada fora da janela, mas vínculo ausente/em revisão/moeda divergente continua sem livro conferido. Provedor usa o namespace do movimento/transação; não mistura moedas para calcular totais.

Custos são mostrados por campanha declarada, confirmados/estimados e sem campanha. Não há rateio de custo por livro/provedor ou cálculo de margem nesses grupos. Sem prova P06, receita/quantidade atribuídas à campanha são Não informado; a parcela de receita sem atribuição continua visível. Referência externa de clique ou custo ligado à campanha não concede prova de compra atribuída. Cada grupo de livro/provedor mostra transações sem algum valor, sem campanha comprovada e revisão.

Último processamento bem-sucedido é lastSuccessAt persistido pelos processadores, com cobertura de datas válidas. Refere-se à população com aprovação na janela; pode ser histórico de uma transação hoje em revisão. Não é indicador de saúde atual nem último sucesso global da conta. Data ausente/inválida/futura permanece desconhecida. observedAt continua sendo consulta e lastEventAt continua evento. Títulos/códigos atuais apenas rotulam os IDs, sem reescrever histórico.

P04 tem implementação/aceite local D78–D85; P03/P05, atribuição comprovada P06, homologações dos fornecedores e release completo permanecem abertos. Este aceite não afirma lucro fiscal, dados completos da conta, parsing nativo ou ativação externa.

## Referência de checkout e atribuição — D87

Em saída de uma campanha ativa, com consentimento analítico vigente, o redirecionador gera primeiro o registro `checkout-clicks` e usa sua UUID como `sck` somente se a URL do provedor ainda não trouxer esse parâmetro. Sem consentimento/campanha, falha de gravação ou `sck` preexistente, nenhum UUID novo é anexado. Não são enviados token de consentimento, UTM livre, email, IP ou ID de sessão.

Os adaptadores Hotmart, Kiwify e Cakto extraem apenas `sck` com formato UUID; outros valores são descartados antes do envelope persistido. O relatório local atribui a campanha só quando encontra exatamente o registro de saída com consentimento, aprovado dentro de 30 dias, mesmo provedor, conta, oferta e livro, e transação sem revisão. Sem correspondência, origem segue desconhecida. Para receita atribuída, bruto, reembolso e chargeback também precisam estar completos; custo continua sem atribuir venda ou comprovar ROAS/lucro. Reenvio com referência ausente ou parâmetro não retornado não é completado por valor, horário, email ou IP.

Fontes e limites estão em [referências D87](16-referencias.md#revalidação-de-rastreamento-de-vendas--25102026-d87) e nas fichas [Hotmart](integracoes/hotmart.md), [Kiwify](integracoes/kiwify.md) e [Cakto](integracoes/cakto.md). Evidência sintética por critério: [auditoria P06 D87](../artifacts/attribution/p06-audit-d87.json). A página técnica Kiwify não abriu e a presença de `sck` no webhook real de cada conta ainda depende de H01; por isso P06 segue desmarcada/parcial.

## Aceite operacional dos estados — D86

Aplicação explícita dos sete estados foi verificada nos três namespaces, mantendo aprovação/datas/valores conhecidos e nulls. CSV/prova confirmada não altera métricas até decisão; pendente/recusado/cancelado sem aprovação não entra como compra aprovada. Reversão parcial/total/chargeback conserva seus campos e não comprova recebimento. Prova incompatível ou insuficiente fica preservada sem gerar transação aplicada. A jornada pelo painel verificou caixa/custo independentes, relatório e receita sem atribuição, com reimportação sem duplicar valores.

P03/P05 possuem aceite local D86. Atribuição comprovada P06, retenção P07, alertas/homologação/release permanecem no escopo; não existe publicação ou venda real comprovada por esta validação.

## Evidência de atribuição HTTP — D88

O loopback ligou o `sck` consentido a callbacks e relatório nos três namespaces. Hotmart exercitou referência correspondente/replay, contexto incompatível, texto livre e ausência; Kiwify/Cakto exercitaram os campos de fixture e replay. Os dois últimos não têm payload/campo confirmado em conta. Reversões sem valor mantiveram receita atribuída null. A prova informa comportamento local, não vendas, conversão ou desempenho real. [Resultados D88](../artifacts/attribution/p06-audit-d88.json).

## Retenção analítica D89

Page views e saídas com mais de 90 dias são resumidos em contagens diárias antes de a fonte ligada a sessão/clique ser apagada. O contexto de atribuição do grant expira após 30 dias. `analytics-daily-aggregates` não guarda UUID de grant, visita ou clique; o caminho é reduzido à família pública, sem slug. Esses agregados são privados e ainda não possuem endpoint/painel de relatório específico; o painel atual mantém sua janela própria. Não deduzir pessoa única, comprador, conversão ou venda desses totais. A rotina diária está desligada por padrão e a política segue em revisão.
