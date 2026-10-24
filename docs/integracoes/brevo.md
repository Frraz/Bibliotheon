# Brevo — calendário, campanhas e supressão

[Índice](../../README.md) · [Aquisição](../08-aquisicao.md) · [Interfaces](../06-interfaces.md)

Consulta pública às fontes oficiais em 21/10/2026; GET/PUT de contatos revalidados em 22/10/2026. Conta, remetente, créditos, DNS e webhooks não foram acessados/homologados. Calendário e confirmação possuem implementação local; agrupamento e claim/quota internos implementados/testados localmente em 22/10; bloqueio outbound possui implementação e testes sintéticos em 22/10, sem ativação; transporte promocional, sincronização de listas/campanhas, observação e callback têm testes locais D51–D58; homologação real continua pendente. Não confundir consulta documental com integração ativa.

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

Antes de ativar: comprovar autenticação da notificação, definir chave de deduplicação, validar fixtures próprias e persistir apenas envelope mínimo. Mensagens de abertura/clique não provam compra. O endpoint de marketing foi implementado localmente em D58, descrito ao final; ativação real depende de homologação. Revisão manual continua disponível ao owner.

Fonte: [eventos de marketing](https://developers.brevo.com/docs/marketing-webhooks).

## Próxima implementação

Agrupamento local implementado por tema/etapa/dia previsto UTC e pela cópia comercial efetiva: revisão, oferta e contexto afiliado distintos não podem compartilhar mensagem inadequada. Persistir conjunto de destinatários e IDs de lista/campanha antes de avançar estados. Confirmar bloqueios no provedor e revalidar consentimento/material/oferta imediatamente antes do envio.

Definir a personalização dos links de preferência por destinatário a partir do contrato oficial, sem compartilhar um token entre contatos. Política local de quota compartilhada implementada: contabiliza destinatários sob lock por dia UTC e preserva capacidade transacional; usada na transação do claim interno de cada lote promocional, ainda fora do worker. Confirmar reset e todos os usos da conta antes de ativar. Criação/disparo com resultado incerto exige conciliação; não reenviar cegamente. Não agendar campanhas antecipadamente no provedor nem depender de automação paga.

Manter transporte promocional desativado até testes locais, homologação de conta/remetente, supressões, limites e decisão operacional. Nenhuma dessas operações foi executada externamente nesta consulta.

## Estado local em 22/10

[Seis grupos de lotes](../../artifacts/promotion-batches/local-results.json) validam cópia/contexto, concorrência, permissões, rollback, quota e revalidação. Preparação não consome quota nem cria listas/campanhas. Na entrega D48, claim apenas gravava intenção/reserva. Desde D50 exige preflight por GET antes de reservar; continua fora do worker e sem disparo. Falha comercial libera o vínculo para nova preparação, preservando lote cancelado. Não há aceitação/entrega promocional comprovada. Revalidar fontes, personalização de preferências, supressões e semântica de resultados antes do adaptador externo; consulta anterior não é prova de contrato atual.

## Bloqueios outbound implementados em 22/10 (D49)

Contrato revalidado: [GET do contato](https://developers.brevo.com/reference/get-contact-info) expõe emailBlacklisted para marketing; [PUT](https://developers.brevo.com/reference/update-contact) aceita bloqueio e documenta que alterar endereço pode remover a blacklist. Adaptador usa host fixo HTTPS/api-key, timeout de 15s por chamada, redirect recusado e resposta limitada a 64 KiB. Projeta somente ID e bloqueio. Não imprime URL, endereço, corpo ou chave.

Fluxo: GET; se bloqueado, conclui; se ausente, conclui como absent sem criar contato; se desbloqueado, PUT somente emailBlacklisted=true e GET para conferir. Acknowledgement 204 sem estado observado não conclui. Timeout/429/5xx/corpo inválido são reconferidos com backoff; 4xx definitivos exigem correção/retry. Registro local durável commitado antes do HTTP, junto do descadastro/supressão, com revisão para novas intenções em voo. Bloqueios antigos são enfileirados pela nona migração.

[Oito grupos locais](../../artifacts/brevo-suppressions/local-results.json); nenhuma conta ou endpoint real foi chamado. Nova inscrição local não desbloqueia o contato Brevo automaticamente. Worker pode sincronizar somente bloqueios com e-mail desligado; não cria/envia campanhas. Importação pontual do bloqueio e preflight implementados em D50. Listas/campanhas, links personalizados, webhook e conciliação seguem pendentes. Sincronizado é observação pontual, não garantia contra alterações posteriores na conta.

## Conferência obrigatória no claim (D50)

[GET oficial](https://developers.brevo.com/reference/get-contact-info) revalidado em 22/10; emailBlacklisted é estado de marketing, sem prova de bounce/complaint ou causa. Novo fluxo consulta cada destinatário único já consentido/elegível localmente, importa bloqueio em action própria provider_blocked e cancela o lote, sem tocar na amostra transacional solicitada. Nenhuma operação de criação, lista ou disparo é feita. Consulta desativada, falha ou contato ausente não autorizam claim/quota.

Conferência positiva persiste apenas IDs e versões locais, vinculada à chave do lote por cinco minutos; identidade local, consentimento, material/oferta e validade são conferidos novamente sob locks antes da reserva. Consulta lenta ou alteração posterior invalida a prova. Campos recebidos além de ID/bloqueio são descartados pelo cliente; chave de auditoria HMAC não copia endereço nem envelope. Entrada manual não aceita provider_blocked como reason. Sete grupos com cliente sintético: [relatório](../../artifacts/provider-preflight/local-results.json). Sem homologação da conta, webhook ou campanha. O transporte futuro também terá de revalidar imediatamente antes de solicitar envio; claimed não é envio aceito.

## Cadastro consentido implementado localmente (D51)

[POST de contatos](https://developers.brevo.com/reference/create-contact) e [GET](https://developers.brevo.com/reference/get-contact-info) revalidados em 22/10/2026. A API documenta updateEnabled=false e forceMerge=false; ID da resposta de criação pode ser opcional. O adaptador usa GET antes, POST somente se ausente, e GET posterior como estado observado. Não muda contato existente, envia emailBlacklisted=false, associa listas ou presume ID a partir de corpo inválido. Conflito/timeout não provoca atualização nem POST cego: reconcilia pelo endereço canônico.

Fila privada só é gravada junto de confirmação de marketing válida. Processador revalida assinatura/identidade/versão e mantém intenção antes do HTTP; recusa definitiva vai para revisão, outras falhas têm backoff. Bloqueio observado usa action própria e cancela marketing. Cadastro incerto durante descadastro conserva compensação, inclusive após 404, até observar bloqueio; cleanup usa apenas GET/PUT e permanece disponível com criação desativada. Resultado de auditoria usa instante após resposta, não o início de consulta lenta.

BREVO_CONTACT_REGISTRATION_ENABLED=false é independente e exige canal de bloqueios/chave de links habilitados para ativação. Antes de usar conta real, homologar permissões, consentimento, comportamento de conflitos, limites e automações da conta; não presumir ausência de automações externas. [Relatório sintético](../../artifacts/brevo-registrations/local-results.json). Nenhuma conta/API real acessada. Listas/campanhas, preferências, webhook e envio/conciliação continuam pendentes; registrar não autoriza claim sem preflight.

## Listas exclusivas de lote (D52)

Contratos revalidados em 22/10/2026: [criar lista](https://developers.brevo.com/reference/create-list), [detalhes](https://developers.brevo.com/reference/get-list), [listas de uma pasta](https://developers.brevo.com/reference/get-folder-lists), [incluir contatos](https://developers.brevo.com/reference/add-contact-to-list), [consultar membros](https://developers.brevo.com/reference/get-contacts-from-list). Modelo do [SDK oficial](https://github.com/getbrevo/brevo-java/blob/main/docs/AddContactToList.md) confirma ids e máximo 150 por inclusão. Não foi instalado SDK. Contagens agregadas de inscritos não substituem IDs efetivamente enumerados.

Cliente com host fixo, redirect recusado, timeout de 15s/chamada e JSON até 64 KiB. Projeta somente metadados/IDs/flags necessários e pagina consultas. Reconciliação local limitada a 1000 listas por pasta, em páginas de 50; acima disso ou com count instável/incompleto, não conclui ausência. Membros limitados ao máximo local de 200 por lote. Não guarda corpo, email, atributos ou estatísticas. listUnsubscribed ausente produz estado não conferido, sem presumir liberdade para envio; homologar a representação real antes de ativar.

Manifesto com intenção antes de POST e de inclusão; nome opaco exclusivo, ID conhecido retido antes de metadados/composição. Criação incerta não é repetida só por não ser encontrada: consultar/reconciliar por nome ou usar ID revisado privadamente. Inclusão usa blocos de até 150, mas resultado 201/partial failure não comprova composição. GET deve observar exatamente o conjunto, sem destinatários extras ou preferências bloqueadas; IDs já tentados não são reincluídos cegamente. Recusa de criação preservada até retry explícito. Nenhuma lista é removida automaticamente.

BREVO_LIST_SYNC_ENABLED=false; pasta dedicada BREVO_LIST_FOLDER_ID é exigida na ativação. Verificar conta, limites, pasta e automações externas antes de usar qualquer lista real. CLI por lote, ainda fora do worker/campanhas. [Relatório sintético](../../artifacts/brevo-lists/local-results.json) inclui 200 destinatários em 150/50 e CLI habilitado com HTTP interceptado; não é evidência de capacidade de produção ou homologação da conta. Ready é composição pontual; transporte futuro precisa revalidar consentimento, membros e quota antes do disparo.


Preferências locais D53: retirada de um assunto preserva os demais. Sem assinaturas ativas, cancela a fila de cadastro e enfileira bloqueio global de marketing no provedor; essa intenção é durável mesmo com canal desligado e não reativa contato posteriormente. A aplicação revalida elegibilidade temática antes de preparar/claim. Personalização do link opaco por destinatário em campanhas ainda não implementada/homologada; não compartilhar token entre contatos.


## Links de preferências individuais — D54

Contrato oficial reconferido em 22/10/2026: [atributos](https://developers.brevo.com/reference/get-attributes), [GET de contato](https://developers.brevo.com/reference/get-contact-info), [PUT de contato](https://developers.brevo.com/reference/update-contact) e [personalização](https://help.brevo.com/hc/en-us/articles/360001008200-Personalize-your-emails-with-contact-attributes). Operador cria/homologa BIBLIOTHEON_PREFERENCES como normal/text; cliente consulta schema e confirma ID/endereço e bloqueio por GET antes de PUT exclusivo desse atributo. Outro tipo/atributo ausente/duplicado impede mutação. Nunca altera identidade, blacklist, listas ou consentimento. GET final precisa observar o valor; timeout ou 204 sem valor correto não autoriza prova. Respostas limitadas, redirects recusados e timeout de 15s.

Placeholder reservado: {{ contact.BIBLIOTHEON_PREFERENCES }}; substituição efetiva ocorre no envio pelo provedor e ainda exige homologação da conta/template. Cada titular recebe token próprio, sem e-mail na URL. Chave/nonce com finalidade própria permitem recuperação só em memória; persistência local mantém hash, expiração fixa e referências. Renovação preserva validade original dos links recebidos.

BREVO_PREFERENCE_SYNC_ENABLED=false; CLI privado brevo:preferences, fora do worker. Exige canal de bloqueios/chave privada/origem HTTPS (HTTP só loopback), preflight e revisão de elegibilidade final. preferenceCheck é prova pontual mínima, sem token bruto; não é campanha ou autorização de envio. Campanhas, transporte, inbound e conciliação continuam pendentes. Nenhuma conta real consultada nesta etapa.


## Rascunhos de campanha — D55

Contrato público reconferido em 22/10/2026: [criação](https://developers.brevo.com/reference/create-email-campaign), [consulta individual](https://developers.brevo.com/reference/get-email-campaign), [listagem](https://developers.brevo.com/reference/get-email-campaigns), [recipients de criação](https://github.com/getbrevo/brevo-go/blob/main/docs/CreateEmailCampaignRecipients.md), [recipients de consulta](https://github.com/getbrevo/brevo-go/blob/main/docs/GetCampaignRecipients.md) e [cancelamento nativo](https://help.brevo.com/hc/en-us/articles/209553645-Insert-a-custom-unsubscribe-link-in-your-emails). POST usa recipients.listIds e remetente por ID; GET projeta recipients.lists/exclusionLists e confirma rascunho/cópia. Campos desconhecidos de destinatários impedem conclusão. Sem agendamento, sendNow, envio de teste, PUT ou DELETE.

Renderer usa assunto/conteúdo do snapshot manual, escapando HTML e chaves no corpo e recusando instruções de template no assunto. Rodapé inclui {{ contact.BIBLIOTHEON_PREFERENCES }} e {{ unsubscribe }}; nenhum token real compartilhado na cópia. Campanhas comerciais direcionam ao resolver interno de checkout com o contexto c preservado. Homologar renderização na conta e representação do HTML no GET; consulta pública não prova esse comportamento real.

Nome opaco por lote e cópia/hash persistidos antes de POST, ID/inventário retidos antes de GET. Reconciliação exige nome único em consulta completa paginada até mil campanhas, ou ID revisado com metadados exatos. Ausência após intenção emitida não autoriza recriar; recusas confirmadas exigem retry privado. Nenhuma remoção/alteração automática em conflito. Rascunho pronto exige pré-requisitos recentes e consentimento/tokens válidos, mas não faz claim/quota/envio. BREVO_CAMPAIGN_SYNC_ENABLED=false e BREVO_CAMPAIGN_SENDER_ID vazio por padrão; listas/preferências/bloqueios obrigatórios, CLI fora do worker.


## Transporte guardado por intenção — D56 (24/10/2026)

[sendNow oficial](https://developers.brevo.com/reference/send-email-campaign-now) reconferido em 24/10: POST por campaignId e 204 significam solicitação agendada para processamento imediato; 400/402/404 são recusas documentadas. O adaptador projeta somente esse resultado: não salva corpo/headers e não infere entrega individual, clique ou venda. Qualquer outra resposta/falha/timeout fica uncertain, sem retry de rede no cliente.

Coordenador prepara listas/preferências/rascunho, exige provas/consentimento frescos e grava reserva por destinatário + intenção/token no mesmo commit. POST depois do commit; descontinuidade entre intenção e HTTP fica conservadoramente incerta. 204 mantém lote claimed e etapas accepted (solicitação aceita); não é evento de recebimento. Resultado incerto preserva quota/histórico e não consulta/reenvia automaticamente; emissão abandonada após 30 minutos pode ser marcada uncertain sem rede. Resposta positiva tardia do mesmo token é aproveitada sem nova tentativa.

Recusa documentada só tem retry com --retry-rejected explícito, revisão completa e outra reserva diária. Descadastro cancela também etapas recusadas; não restaura inscrição. Preparação abandonada usa lease próprio e pode retomar operações idempotentes; não se confunde com POST de disparo emitido. Worker examina no máximo 20 candidatos e processa uma nova campanha por ciclo, sem retry automático de rejeição/incerteza.

BREVO_CAMPAIGN_SEND_ENABLED=false por padrão, dependente de bloqueios/listas/preferências/rascunhos/remetente/chave/origem/quota válidos. CLI empacotado e worker opcional testados só com HTTP sintético. Homologar conta, créditos, reset UTC, limites compartilhados, remetente/templates e automações antes de ativar. Observação contínua, webhook e conciliação dos incertos continuam pendentes.


## Observação GET implementada localmente — D57 (24/10/2026)

Cliente [campaign-observer](../../src/integrations/brevo/campaign-observer.ts) consulta apenas GET /v3/emailCampaigns/{id}?statistics=globalStats, com timeout, limite de corpo, sem seguir redirecionamento. Compara identidade completa com rascunho original; ignora estatísticas e não persiste resposta bruta. Enum nativo e fontes oficiais em [D57](../17-decisoes.md). Campo sentDate é opcional e normalizado quando válido; não comprova recebimento individual.

queued/in_process/in_review/sent geram prova de atividade, separada de HTTP. draft/archive/suspended/cancelling/cancelled, ausência e erro não provam que POST nunca foi aceito. Não há reenvio ou estorno de quota por observação. Prova positiva não regride; lease bloqueia retry concorrente. 16a migração adiciona fila e backfill. [Nove grupos locais](../../artifacts/brevo-observation/local-results.json), HTTP sintético; sem conta real ou mensagens.

Flag BREVO_CAMPAIGN_OBSERVE_ENABLED=false; CLI npm run brevo:observe -- UUID_DO_LOTE [--refresh] ou runtime node cli/observe-brevo-campaign.js UUID_DO_LOTE [--refresh]. Sem flag retorna disabled antes de abrir banco. Se habilitada com chave inválida, CLI/worker recusam iniciar. Worker pode operar somente observação com API key, sem SMTP, chave de links ou permissão local de disparo. Uma consulta por ciclo; intervalo de 15 minutos, lease de 30; sent/archive/cancelled suspendem polling. --refresh permite nova consulta explícita sem ignorar lease ativo. Webhook, eventos por destinatário e homologação continuam pendentes.


## Callback de marketing e conciliação individual — D58 (24/10/2026)

POST /api/webhooks/brevo recebe eventos individuais marketing/email autenticados por Bearer, com BREVO_WEBHOOK_ENABLED=false por padrão. Autenticação antecede leitura/banco. Nomes de corpo delivered/hard_bounce/soft_bounce/spam/unsubscribe; seleção no provedor usa delivered/hardBounce/softBounce/spam/unsubscribed. Configurar batched=false; arrays não são aceitos. Não usar token de API para o callback. Contratos e fontes oficiais revalidados em [D58](../17-decisoes.md).

Inbox/resultados são privados. HMAC semântico deduplica campanha/evento/datas/destinatário, sem depender do ID isolado. Envelope não guarda email/corpo/IP/URL/razão. ACK somente após commit da persistência, efeitos locais e conciliação/quarentena. Falha temporária/configuração off retorna 429 com Retry-After, pois a documentação de retry indica descarte em 5xx. Credencial inválida é 401; envelope inválido422, limite413, tipo415. Eventos não selecionados são ignorados, sem analytics ou venda.

Para conciliar, exige conjunto original, manifesto/hash/campanha íntegros, tempo compatível com intenção e impressão de destinatário capturada antes do POST. Migração17 cria eventos/resultados;18 acrescenta identidade de emissão sem backfill inventado. Legado sem prova, identidade alterada ou destinatário externo ficam em quarentena. Contato desconhecido não é criado nem associado depois. Replay explícito usa somente envelope mínimo, sem rede, e não reaplica supressão. Desconhecidos exigem revisão privada na conta/fluxo manual; não exportar payloads reais para Git/logs.

Cancelamento nativo é retirada global local; hard bounce/reclamação restringem entrega. Contato conhecido é protegido mesmo sem campanha mapeada. Amostra solicitada é preservada no unsubscribe; bounce/spam cancelam transacionais pendentes, sem prometer recall de envios iniciados. Soft bounce não cancela consentimento. Eventos positivos não reativam e não apagam negativos. Resultados guardam datas separadas por etapa; delivered não prova leitura, compra ou receita. Atividade correlacionada bloqueia retry e revoga lease de preparação; histórico HTTP/quota permanecem intactos.

BREVO_WEBHOOK_TOKEN e BREVO_WEBHOOK_PREVIOUS_TOKEN permitem rotação de autorização sem mudar a deduplicação. BREVO_WEBHOOK_EVENT_SECRET e a chave de links são estáveis, independentes e necessárias para verificar históricos; recuperar configuração privada junto do banco, sem substituir segredos indiscriminadamente. CLI npm run brevo:webhook-replay -- UUID_DO_EVENTO ou runtime node cli/replay-brevo-webhook.js UUID_DO_EVENTO. Não é replay de envio.

[11 grupos locais](../../artifacts/brevo-webhook/local-results.json) com eventos/conta sintéticos, sem mensagens reais. [Teste HTTP](../../tests/integration/brevo-webhook-http.ts) exige QA isolado com tokens explicitamente sintéticos. Homologação de callback real, permissões da conta, resultados e recuperação continuam pendentes; B07 comercial permanece separado.
