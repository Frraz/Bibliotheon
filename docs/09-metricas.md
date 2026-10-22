# 09 — Medição e decisões

[Índice](../README.md) · [Integrações](07-integracoes.md)

Especificação da medição completa. Em 21/10/2026 o dashboard existente apresenta contagens editoriais e operacionais de e-mail; visitas/cliques consentidos, inbox comercial, transações, custos, relatórios e alertas desta especificação ainda não estão implementados. Registros de pedido/consentimento não equivalem ao ledger analítico/comercial. Ver [estado atual](23-estado-atual.md).

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
