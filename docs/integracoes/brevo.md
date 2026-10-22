# Brevo — calendário, campanhas e supressão

[Índice](../../README.md) · [Aquisição](../08-aquisicao.md) · [Interfaces](../06-interfaces.md)

Consulta pública às fontes oficiais em 21/10/2026. Conta, remetente, créditos, DNS e webhooks não foram acessados/homologados. Calendário e confirmação possuem implementação local; agrupamento, transporte promocional e sincronização externa continuam pendentes. Não confundir consulta documental com integração ativa.

## Separação operacional

Confirmação e amostra solicitada usam o transporte transacional. As quatro mensagens promocionais usam campanhas de marketing, com conteúdo manual revisado. Consentimento e datas pertencem ao Bibliotheon. A preparação local não cria campanhas nem consome quota.

## Operações verificadas

| Operação | Contrato consultado | Limite de interpretação |
|---|---|---|
| Criar contato | POST /v3/contacts; email, listIds e updateEnabled documentados; 201 com ID | Não atualizar/desbloquear contato existente por conveniência; updateEnabled é false por padrão |
| Conferir contato | GET /v3/contacts/:identifier; 200 inclui emailBlacklisted | Projetar somente identidade/bloqueio necessários; não guardar atributos, IPs ou estatísticas pessoais recebidos |
| Bloquear marketing | PUT /v3/contacts/:identifier com emailBlacklisted=true; 204 | Não enviar atributo EMAIL, forceMerge ou desbloqueio; alteração do endereço pode remover bloqueio no provedor |
| Criar campanha | POST /v3/emailCampaigns; rascunho, sender, conteúdo e recipients; 201 com ID | Detalhes aninhados de recipients precisam ser conferidos antes do adaptador; não inferir de exemplos de terceiros |
| Solicitar disparo | POST /v3/emailCampaigns/:id/sendNow; 204, insuficiência de créditos 402 | Aceitação/agendamento pelo provedor não comprova entrega individual |
| Configurar webhook | POST /v3/webhooks; suporta auth e headers customizados | Schema aninhado e configuração real precisam ser confirmados; nenhuma assinatura nativa foi presumida |

Autenticação das chamadas de API por api-key no header, em HTTPS com destino fixo. Esse header não é autenticação automática de notificações recebidas. Não imprimir URL com contato, headers, corpo ou chave nas falhas.

Fontes: [criar contato](https://developers.brevo.com/reference/create-contact), [detalhes do contato](https://developers.brevo.com/reference/get-contact-info), [atualizar contato](https://developers.brevo.com/reference/update-contact), [criar campanha](https://developers.brevo.com/reference/create-email-campaign), [sendNow](https://developers.brevo.com/reference/send-email-campaign-now), [criar webhook](https://developers.brevo.com/reference/create-webhook). O [modelo do SDK oficial Go](https://github.com/getbrevo/brevo-go/blob/main/docs/CreateEmailCampaignRecipients.md) também identifica listas/segmentos; não foi instalado.

## Notificações de marketing

O corpo documentado usa spam, hard_bounce e unsubscribe, enquanto os nomes de seleção na configuração do webhook incluem hardBounce e unsubscribed. Não reutilizar um enum para as duas interfaces. ts_event/ts_sent são UTC; strings de data têm outras convenções. O campo id é descrito como ID interno do webhook: não assumir que sozinho identifica exclusivamente um evento.

Antes de ativar: comprovar autenticação da notificação, definir chave de deduplicação, validar fixtures próprias e persistir apenas envelope mínimo. Mensagens de abertura/clique não provam compra. O endpoint de ingestão Brevo ainda não está implementado; o fallback atual é revisão manual pelo owner.

Fonte: [eventos de marketing](https://developers.brevo.com/docs/marketing-webhooks).

## Próxima implementação

Agrupar por tema/etapa/dia e pela cópia comercial efetiva: revisão, oferta e contexto afiliado distintos não podem compartilhar mensagem inadequada. Persistir conjunto de destinatários e IDs de lista/campanha antes de avançar estados. Confirmar bloqueios no provedor e revalidar consentimento/material/oferta imediatamente antes do envio.

Definir a personalização dos links de preferência por destinatário a partir do contrato oficial, sem compartilhar um token entre contatos. Política local de quota compartilhada implementada: contabiliza destinatários sob lock por dia UTC e preserva capacidade transacional; ainda deve ser usada na transação do claim de cada lote promocional. Confirmar reset e todos os usos da conta antes de ativar. Criação/disparo com resultado incerto exige conciliação; não reenviar cegamente. Não agendar campanhas antecipadamente no provedor nem depender de automação paga.

Manter transporte promocional desativado até testes locais, homologação de conta/remetente, supressões, limites e decisão operacional. Nenhuma dessas operações foi executada externamente nesta consulta.
