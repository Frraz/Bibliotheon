# 05 — Modelo de dados e invariantes

[Índice](../README.md) · [Interfaces](06-interfaces.md) · [Integrações](07-integracoes.md)

## Convenções

IDs internos UUID; datas em UTC, apresentação America/Belem. Valores monetários em centavos inteiros com moeda ISO (`BRL` inicialmente). Quantia desconhecida é `null`, nunca zero. Strings externas são opacas, sem conversão numérica. Todas as entidades têm createdAt/updatedAt. Slugs minúsculos ASCII com hífens, únicos no tipo.

Modelo lógico de referência. Parte já está mapeada em coleções e migrações; estado e evidências em [desenvolvimento](19-desenvolvimento.md). Relações e índices devem existir no banco, não depender só do formulário.

Na revisão de 21/10/2026 existem coleções editoriais, Campaign, Redirects, SiteSettings, contatos/consentimento, pedidos/outbox, tokens, limites/quota, EmailSequence, SequenceEnrollment, PromotionDelivery e, desde 22/10, EmailCampaignBatch, BrevoSuppression, BrevoRegistration e BrevoBatchList locais. Visit/PageView/CheckoutClick e permissões foram acrescentados em D59. D61 acrescenta commercial-inbox, commercial-conflicts, transactions, transaction-events e commercial-audit. D67 acrescenta commercial-import-batches/rows/audit locais. MarketingTask, CostEntry e AuditEvent genérico permanecem previstos. A trilha de consentimento/supressão existente não substitui auditoria financeira. Ver [mapa vigente](23-estado-atual.md).

| Entidade | Campos principais e restrições |
|---|---|
| AdminUser | email único, autenticação Payload, papel único `owner`; sem inscrição pública |
| Theme | slug, nome, introdução, estado editorial |
| Ebook | slug, título, resumo, themeId, público, problema, promessa, benefícios, sumário, requisitos, limites, coverId, blocos LP, materialState (`production/ready`), estado editorial |
| Media | nome interno, MIME real, tamanho, hash, finalidade, visibilidade (`public/private`), alt; nenhum livro pago completo |
| LeadMagnet | ebookId, mediaId, título, versão, ativo; material gratuito privado entregue por link temporário |
| Article | slug, título, resumo, corpo, themeId, ebookId opcional, autor exibido, estado editorial, SEO |
| Offer | ebookId, provider, accountKey, externalProductId, externalOfferId opcional, checkoutUrl, priceCents, currency, active, primary, lastVerifiedAt, eligibilityNote |
| Campaign | código único, ebookId, offerId, público, hipótese, canal, UTMs, tipo (`owned/affiliate`), affiliateUrl opcional, estado (`draft/active/paused/closed`), datas |
| MarketingTask | campaignId, descrição, prazo, estado (`todo/doing/done`), evidenceUrl opcional |
| Contact | email normalizado único, confirmedAt opcional, globalSuppressedAt, estado de entrega (`ok/bounced/complaint`); sem CPF/telefone |
| Subscription | contactId + themeId únicos, estado (`pending/subscribed/unsubscribed`), consentVersion, timestamps |
| ConsentEvent | contactId, themeId opcional, finalidade, ação, versão do texto e instante; trilha append-only |
| MagnetRequest | contactId, magnetId, confirmationTokenHash, expiresAt, confirmedAt, deliveredAt; solicitação não implica marketing |
| EmailSequence | amostra/versão únicas, revisão inteira crescente, oferta, quatro assuntos/textos manuais, ativo e hash do conteúdo; ativação exige cópia completa e vínculos coerentes |
| SequenceEnrollment | contato/material/versão únicos, pedido, tema, sequência, confirmedAt, snapshot de revisão/conteúdo/oferta/campanha e estado; nova solicitação não reinicia sequência anterior |
| PromotionDelivery | inscrição/etapa únicas, D+2/4/7/10, dueAt fixo, nextCheckAt, estado e motivo; coleção privada, pronta indica elegibilidade local para agrupamento; referência opcional ao lote |
| EmailCampaignBatch | Implementado localmente: tema/etapa/dia previsto UTC, chave única, cópia revisada, referências de contatos/etapas e contagem de destinatários únicos, estado/timestamps e providerCheck pontual, vinculada a chave/versões locais e IDs de contatos do provedor. IDs/sincronização de listas e rascunhos/campanhas, transporte/observação e callback locais D52–D58; conta não homologada |
| BrevoSuppression | fila privada única por contato, revisão, estado pending/processing/synced/failed, tentativas, lease, próxima conferência, resultado blocked/absent e códigos genéricos; sem endereço/payload/token na fila |
| BrevoRegistration | fila privada única por contato, revisão/lease/tentativas, estado pending/processing/synced/failed/canceled/canceling, versão local e ID no provedor; sem endereço/payload/token na fila |
| BrevoBatchList | manifesto privado único por lote, nome/pasta, conjunto imutável, ID externo único, lease, criação emitida, inclusões tentadas e conferência recente; sem endereços/payloads |
| EmailDelivery | chave única de pedido/etapa, contactId, providerMessageId opcional, estado, attempts, nextAttemptAt; sem corpo de mensagem nos logs |
| PreferenceToken | contactId, tokenHash único, expiresAt; finalidade de cancelamento global de marketing, 180 dias, sem token bruto persistido |
| MailQuota / RequestLimit | Quota compartilhada reservada por destinatário/dia UTC; promoções preservam capacidade transacional. Limites globais/por endereço com chave pseudonimizada e expiração de até 24h |
| Visit | id aleatório consentido, início/fim, campanha e UTMs sanitizadas; sem identidade do comprador |
| CheckoutClick | id aleatório, offerId, campaignId opcional, visitId opcional, instante, attributionAllowed; sem e-mail |
| Transaction | provider + accountKey + externalTransactionId únicos; offerId opcional, externalProductId, estado, valores, moeda, providerUpdatedAt, approvedAt, attributionClickId opcional, evidenceSource |
| TransactionEvent | transactionId, tipo normalizado, occurredAt, valor parcial se aplicável, inboxId/importRowId; histórico imutável |
| WebhookInbox | provider, accountKey, eventKey único nesse escopo, envelope mínimo validado, hash, receivedAt, status, attempts, erro sanitizado, adapterVersion |
| ImportBatch / ImportRow | autor, hash de arquivo, linhas normalizadas, prévia, status, contagens, justificativa; CSV original descartado após processamento |
| CostEntry | período, campaignId opcional, categoria, amountCents, currency, fonte, confirmado/estimado |
| AuditEvent | ator, ação, entidade/id, horário, resumo sem segredos/PII |

## Relações

```mermaid
erDiagram
  Theme ||--o{ Ebook : agrupa
  Ebook ||--o{ Offer : oferece
  Ebook ||--o{ LeadMagnet : possui
  Ebook ||--o{ Campaign : promove
  Offer ||--o{ CheckoutClick : recebe
  Offer o|--o{ Transaction : corresponde
  Contact ||--o{ Subscription : escolhe
  Contact ||--o{ MagnetRequest : solicita
  Transaction ||--o{ TransactionEvent : historico
  WebhookInbox o|--o{ TransactionEvent : origina
```

## Estados e regras

Editorial: `draft → published → archived`; editar um publicado mantém revisão anterior pública até nova publicação. Uma versão em produção não pode habilitar compra. Preview autenticado pode mostrar pendências.

Oferta: publicação de CTA exige livro ready, URL revisada, preço e IDs externos. No máximo uma oferta primária ativa por livro (índice parcial e validação transacional). Desativar primária deixa compra principal indisponível até escolha explícita; não fazer rodízio automático. Moedas não suportadas não são convertidas implicitamente.

Transação: `pending`, `approved`, `refused`, `canceled`, `partially_refunded`, `refunded`, `chargeback`, `unknown`. Compra aprovada só nasce de evento autenticado mapeado ou relatório reconciliado. Cliques e abandonos não criam receita. Eventos de assinatura não anulam uma compra avulsa.

Manter valores aprovados e devolvidos separados. Valor parcial não informado não é inferido. Chargeback é estado financeiro separado e não soma uma segunda devolução por padrão. Timestamp ausente, conflito de valores ou sequência ambígua resulta em `needs_review` na inbox, preservando a transação conhecida.

Eventos anteriores ao estado conhecido entram no histórico sem regredir projeção. Reembolso recebido antes da aprovação mantém projeção de reembolso; aprovação antiga posterior não reabre receita. Mesmo timestamp com estados conflitantes exige conciliação. Identidade externa desconhecida fica em quarentena sem inventar associação ao livro.

## Índices e exclusão

Índices: slugs; provider/account/transaction; provider/account/eventKey; offer/occurredAt; campaign/occurredAt; inbox status/nextAttemptAt; subscriptions contact/theme; jobs due/status. Search simples no texto normalizado.

Livro/oferta com histórico são arquivados, não apagados em cascata. Contato pode ser excluído ou anonimizado conforme política; transação mínima não deve depender de FK para contato. IDs pseudônimos ainda exigem proteção e retenção. Ver [política](12-seguranca-privacidade.md).

## Extensão de apresentação

Campos lógicos adicionais do Ebook: `presentationVariant: guide | reading | workbook` (default guide) e `accentPreset: mineral | slate | plum` (default mineral). Validação no servidor por allowlist. `workbook` exige amostra de exercício real referenciada; capas e sumário continuam campos existentes. Ausência de campo em registros anteriores usa defaults; migração futura aditiva. Tema de assunto (`Theme`) não se confunde com aparência clara/escura.

Media acrescenta `width` e `height` extraídos do arquivo, `caption` editorial opcional, `presentationRole: cover | sample | contextual` e `focalPoint: {x,y}` opcional, normalizado 0–1, exclusivo de contextual. Alt existente continua obrigatório quando informativo. Capas e amostras preservam proporção, usam contain e ignoram crop; aplicação deve impedir ponto focal em papéis incompatíveis. Default para legado: papel segundo finalidade existente; desconhecido exige revisão antes de publicação.

A preferência `system | light | dark` não pertence ao livro nem ao comprador: fica em `bibliotheon:appearance:v1` no navegador. Não criar endpoint de perfil, tabela de aparência ou identificador de visitante para esse fim. Dados monetários, afiliados, transações e consentimento permanecem com seus contratos atuais.

## Lotes locais (D48)

Preparação limitada a 200 etapas por passagem, sob lock comum de montagem, com locks de contato em ordem. Agrupa tema, etapa, dia previsto UTC e snapshot integral da cópia (revisão, mensagens, livro, oferta e contexto de campanha). Várias etapas do mesmo destinatário dentro do lote preservam suas referências, mas contam uma vez para quota. Snapshot não contém e-mail nem token. Identidade do lote inclui o ID gerado pelo CMS, permitindo reagrupamento posterior sem colidir com lote cancelado.

Estados implementados: prepared (conjunto persistido), claimed (intenção reservada com quota), canceled e uncertain (retenção conservadora prevista para integração). Somente prepared pode ser tomado; resultado incerto não deve ser reciclado automaticamente. O claim interno revalida consentimento/material/versão/pausa e oferta comercial, usa a quota na mesma transação e muda as etapas para sending. O worker opcional D56 usa a reserva antes do POST; nenhum desses estados comprova entrega individual. Membros inelegíveis cancelam o lote inteiro sem quota e liberam vínculos para nova preparação; histórico permanece. IDs de lista/campanha e observação de atividade foram acrescentados em D52/D55–D57, descritos adiante.

## Sincronização de bloqueios (D49)

O descadastro global e a supressão revisada persistem intenção junto da mudança local; configuração desligada não impede a fila. Uma revisão nova durante processamento não é consumida pela resposta antiga. Claim é confirmado antes do HTTP, com lease de 30 minutos; chamadas fora da transação. Retentativa de bloqueio é segura porque não envia mensagem nem reativa contatos. Timeout/429/5xx/resposta inválida mantêm pendência com backoff de 1 minuto até 6 horas; recusa definitiva fica failed até retry explícito após correção. Processamento antigo não sobrescreve lease novo.

synced com outcome blocked significa bloqueio de marketing observado naquele instante; absent significa 404 observado, sem criar contato. Não prova entrega, bloqueio transacional nem preservação futura contra alterações externas. Não se envia emailBlacklisted=false ou atributo EMAIL. Nova inscrição local não limpa o bloqueio no provedor automaticamente; revisar elegibilidade antes de futuras campanhas. A nona migração enfileira bloqueios históricos locais. Exclusão/retorno de dados após restore continuam na B12.

## Conferência pontual de destinatários (D50)

providerCheck na coleção de lotes guarda somente versão do formato, chave do lote, checkedAt e referências de contato/versão local/providerId; não copia e-mail, token, atributos ou estatísticas. Validade de até cinco minutos desde o início das consultas, conservadora para o destinatário mais antigo. Destinatários e IDs do provedor devem ser únicos e corresponder ao conjunto atual; alteração do lote/contato, data futura ou expirada invalidam a prova. Claim interno executa o preflight obrigatoriamente, revisa tudo sob locks e só então reserva quota.

Bloqueio observado em GET autenticado produz ConsentEvent.action=provider_blocked por referência HMAC, independente das ações manuais e sem supor o motivo da blacklist. A identidade local deve continuar correspondendo ao endereço consultado; não cria contato a partir dessa observação. Importação, cancelamento e intenção outbound são atômicos. Contato ausente/falha/recusa mantém lote prepared, sem prova, com motivo e nova conferência em 15 minutos. Preflight não cria contato, lista/campanha nem envia. A observação pontual não substitui callback D58 e revalidação do transporte D56, implementados localmente sem homologação externa.

## Cadastro consentido no provedor (D51)

A confirmação com opt-in e assinatura temática ativa enfileira cadastro no mesmo commit; amostra isolada não enfileira. Backfill da migração seleciona somente confirmados, sem bloqueio e com assinatura ativa. O processamento captura identidade/versão e revalida consentimento, grava claim antes do HTTP e reconcilia por GET. POST contém apenas email/updateEnabled=false/forceMerge=false, sem listas/atributos, troca de identidade ou desbloqueio. Resultado synced significa contato observado e elegibilidade local conferida, não campanha/entrega. Nova confirmação em voo aumenta revisão e exige nova conferência.

Descadastro antes de tentativa cancela sem criar. Havendo tentativa incerta, canceling preserva compensação: ausência observada não prova que um POST anterior nunca será aplicado. Reconsulta/bloqueio com backoff até seis horas, inclusive por worker só de bloqueios, até observar bloqueio; não faz POST nessa fase. Depois de contato já observado/resultado resolvido, intenção de bloqueio permanece durável. API pública não permite trocar identidade de contatos; alteração indevida interrompe como identity_changed e exige intervenção. Retentativa não apaga histórico de tentativas; downgrade recusa perder tentativas/IDs/compensações.

## Listas exclusivas de lote (D52)

Estados creating/filling/ready/uncertain/failed/canceled. Nome opaco bibliotheon-UUID do lote e pasta dedicada conferida pelo operador. Snapshot contém referências e IDs de contatos já conferidos; não copia email/atributos. Intento de criação e cada bloco de até 150 IDs são commitados antes do HTTP. ID retornado é retido imediatamente, inclusive se metadados falharem ou consentimento tiver sido retirado; isso não autoriza composição.

Criação incerta busca por nome exato na pasta, com paginação e recusa de duplicidade; 404 não autoriza repetir POST depois de emitida a intenção. ID explícito do operador exige metadados correspondentes. Só criação explicitamente recusada sem ID pode ter retry de criação, mediante opção privada; recusa permanece registrada até essa intervenção. Inclusão parcial/incerta é reconferida por GET; ID já tentado e ainda ausente não é reincluído automaticamente, evitando apagar preferência de lista. Destinatários extras, blacklist ou descadastro na lista interrompem sem remoção arbitrária; campos opcionais ausentes ficam não conferidos.

ready indica composição observada, com mesmo conjunto e metadados, seguida de nova revisão local/preflight. A conferência de membros e a de contatos têm validade própria de até cinco minutos; preflight novo não renova uma composição antiga. Não significa campanha/aceitação/entrega. Listas canceladas ou órfãs permanecem identificadas no manifesto para revisão/retenção B12; nenhuma lista externa é apagada automaticamente.


### Preferências temáticas — D53

Usa PreferenceTokens, Subscription e ConsentEvent existentes; sem nova migração. POST de consulta só projeta ID/nome dos temas já assinados pelo titular do token; não devolve endereço ou dados de outro contato. Retirada grava estado unsubscribed/unsubscribedAt e evento marketing/unsubscribed com theme, no mesmo commit do cancelamento das inscrições e etapas daquele assunto. Se não restar assinatura ativa, cancela cadastro Brevo e enfileira bloqueio externo. Não remove amostras/pedidos nem reativa temas ou contatos. Global continua em fluxo separado.


### Links individuais no provedor — D54

PreferenceToken recebe sourceKey única/opcional por contato e nonce opcional; tokens transacionais antigos continuam intactos. HMAC de finalidade própria permite reconstruir token em memória, com hash único para autorização pública existente. Rotação limpa somente sourceKey anterior; preserva hash/expiração, cria novo nonce e nunca estende a validade do registro antigo. URL/token bruto não pertencem a JSON de lote, auditoria, logs ou artifacts.

EmailCampaignBatch.preferenceCheck contém version, batchKey, checkedAt e referências contact/version/providerId/tokenId/expiresAt. Só é concluído após GET observar atributo correto para cada contato e revisão local final; TTL próprio de cinco minutos e correspondência com o preflight atual. Falha limpa prova, atraso usa nextAttemptAt e cancelamento limpa providerCheck/preferenceCheck. Sem nova tabela, quota ou estado de envio.


### Rascunho de campanha Brevo — D55

BrevoCampaignDraft possui relação única com lote, name opaco, content (cópia de assunto/HTML/lista/remetente), contentHash, providerCampaignId único opcional, observedIds, state, leaseToken, startedAt, creationIssuedAt, nextAttemptAt, verifiedAt e errorCode. Estados creating/ready/uncertain/failed/canceled; coleção somente leitura do owner via API, mutações só pelo fluxo privado. Não contém emails/tokens de destinatários nem estatísticas recebidas.

ID conhecido é retido antes de GET, inclusive após descadastro; IDs conflitantes são inventariados sem violar unicidade de associação entre lotes. Descadastro ou prova expirada impede ready. Retomada de criação incerta não reenvia POST, mesmo após ausência; somente rejeição explícita sem ID permite retry privado. Rascunhos órfãos permanecem para inventário/retenção B12. 14a migração recusa downgrade que perderia intenção/IDs.


### Tentativas de disparo — D56

BrevoCampaignSend liga-se exclusivamente a lote/rascunho/campanha. Guarda batchKey, contentHash, recipientCount, attempts, attemptToken, history, state, leaseToken, prepareStartedAt, nextAttemptAt, issuedAt, settledAt, retryRequestedAt, responseCode e errorCode. Estados preparing/issuing/submitted/rejected/uncertain/canceled. Campos de rascunho/ID/intenção ficam opcionais em preparing e obrigatórios por constraint na emissão/resultados; histórico mínimo por tentativa sem emails/tokens de preferência/corpos externos.

Intenção de emissão e quota atômicas. Retorno conhecido atualiza solicitação, lote e etapas no mesmo commit: submitted mantém lote claimed e etapas accepted; rejected aparece no lote/etapas; uncertain preserva reserva e bloqueia reenvio. Rejeição documentada só pode retornar à preparação por ação explícita, com revalidação; descadastro cancela também etapas rejected e não restaura inscrição. Cada nova tentativa conta outra reserva diária, sem devolução automática das anteriores.

15a migração aditiva amplia enums e adiciona coleção. Downgrade só sem tentativas/estados novos; remove/recria o índice parcial de etapas na troca do enum, preservando acesso por data. Não apagar histórico para forçar rollback ou novo envio.


## Observação de campanha — D57

BrevoCampaignObservations é privada, única por send, com attemptToken/lease, estado pending/processing/matched/conflict/failed, próxima consulta e timestamps separados de checagem/atividade/envio observado/data informada pelo provedor. lastStatus preserva o enum nativo; activityStatus guarda apenas atividade positiva. Estatísticas e payload bruto não são persistidos. O manifesto original permanece a referência de identidade mesmo se o catálogo for editado.

BrevoCampaignSends e PromotionDeliveries acrescentam observed, sem mudar o histórico HTTP. Lote permanece claimed e quota reservada; etapas canceladas não são reativadas. Estado observado não comprova entrega individual. Fila nasce no commit de emissão e possui backfill aditivo na migração 16. Consulta não altera inscrição, consentimento ou destinatários. Ver D57 em [decisões](17-decisoes.md).


## Inbox Brevo e resultados individuais — D58

BrevoWebhookEvents: chave semântica e impressão HMAC de destinatário, contato previamente existente opcional, evento nativo, ID de campanha/webhook, datas UTC de ocorrência/envio/recepção/processamento, estado pending/processed/quarantined, motivo, indicador de supressão aplicada e etapa correlacionada opcional. Sem email duplicado, payload bruto ou links. Desconhecido não cria contato nem é associado automaticamente a um futuro cadastro.

BrevoDeliveryReceipts: único por promotion-delivery, relacionado ao send, campanha e impressão de identidade; firstObservedAt, deliveredAt, hardBouncedAt, softBouncedAt, spamAt e unsubscribedAt preservados separadamente, escolhendo a primeira data de cada ocorrência. Não existe projeção de venda ou receita a partir dessas datas. Inbox/resultados e efeitos locais são atômicos; replay não aplica supressão novamente.

BrevoCampaignSends.recipientIdentities guarda somente versão e conjunto ordenado de contato/etapa/impressão HMAC capturados antes de POST. Legado sem prova não recebe backfill baseado no cadastro atual. Chave de links e segredo de deduplicação devem ser recuperados junto da configuração privada; rotação requer plano para históricos, não simples substituição. Migrações 17/18 aditivas, com downgrade guardado; ver [D58](17-decisoes.md).


## Medição própria — D59

AnalyticsGrant guarda hash de token/versão/datas de permissão e revogação, sessão atual e first-touch/último toque não direto na janela de 30 dias. Visit é sessão consentida de 30 minutos inativa, sem identidade do comprador. PageView tem chave de idempotência por permissão/UUID, sessão, caminho público sem query, referência opcional de livro/campanha e UTMs controladas. CheckoutClick tem oferta/livro/plataforma/campanha e data; sessão e contexto só existem se attributionAllowed. Campo booleano não prova vínculo de compra. AnalyticsLimit limita emissões/eventos sem capturar IP. Não são Transaction/TransactionEvent nem inbox comercial.

Datas e integridade de atribuição têm constraints/índices na migração 19. Campaign acrescenta utmTerm e valida códigos UTM; componente de link usa somente registros salvos e destinos comerciais conferidos. Excluir oferta/livro com saídas históricas continua exigindo preservação/arquivamento; não apagar provas em cascata. Retenção/exclusão/restore de medição são B12, ainda pendentes. Ver [D59](17-decisoes.md).


## Histórico comercial persistido — D61

Migração 20 cria cinco coleções privadas. commercial-inbox conserva chave única por provider/account/event, envelope mínimo, hash, versão do adaptador, chave da transação, datas, estado, lease, erro e contador cumulativo. attemptBase marca o início do orçamento automático atual sem apagar attempts. commercial-conflicts conserva o segundo envelope divergente uma única vez por impressão; o original não é trocado.

transactions é projeção por provider/account/externalTransactionId, ligada a livro por catálogo exato e a oferta somente quando a identidade é explícita. Guarda moeda, valores conhecidos, último sucesso e revisão. transaction-events conserva cada fato normalizado único e sua origem, inclusive divergências que impediram atualizar a projeção; outcome registra o resultado daquela aplicação, não reescreve retrospectivamente o fato. commercial-audit registra recebimento, ignorado, conflito, aplicação, revisão, falha e retry, com data/ator/motivo controlado. Não guarda corpo original, e-mail, credenciais ou justificativa livre.

Há índices de unicidade/fila/identidade e checks SQL de centavos seguros, orçamento e lease. Valores ausentes permanecem null; aprovação não gera liquidação. Mudanças de identidade de oferta com histórico da mesma conta/produto são recusadas; criar outra oferta preserva a referência histórica. Downgrade recusa qualquer registro nas cinco tabelas. Atribuição a clique, liquidação, CSV e custos ainda não existem.


## Evidência nativa mínima Hotmart — D63

Envelope pode preservar sourceEvent, sourceCreatedAt e approvedAt explícito. As duas datas não se confundem: aprovação financeira original versus criação da notificação. Null de aprovação é desconhecido; ausência em envelopes legados preserva interpretação/hash anteriores. ReviewReason só aceita enum controlado; precisão de moeda/forma de compra/estado sem suporte não vira aprovação automática. Tudo permanece no JSON existente, sem nova migração ou corpo integral.

A projeção protege também cancelamento regressivo após aprovação, inclusive quando a aprovação conhecida ainda não tinha data. Divergência entre datas explícitas mantém a última projeção em revisão, sem reescrever fatos antigos. Nenhum backfill por data de recebimento, endereço, valor ou aproximação.

## Evidência Kiwify — D64

Sem nova tabela/migração. Envelope comercial JSON inclui sourceEvent, sourceCreatedAt (criação do pedido), approvedAt explícito/null e motivo controlado unknown_event_time. occurredAt pode ser criação como âncora de envelope em revisão, nunca prova de chargeback/recusa: revisão impede aplicação. approvedAt não é inferido de updated_at/criação. Valores Kiwify já são inteiros em centavos; taxa em outra moeda, líquido, recebido, atribuição e devolução monetária permanecem desconhecidos. PII, campos de pagamento/acesso e assinatura da URL não entram na inbox. Ver [contrato](integracoes/kiwify.md).

## Cakto V1/V2 — D65

Cada pedido nativo possui um recibo/fato próprio, inclusive em lista da mesma cobrança. Identidade interna combina data.id + event e namespace de provedor/conta; não usar refId, índice ou instante de envio. sourceCreatedAt é criação do pedido, approvedAt preserva paidAt. amount/fees são decimais convertidos exatamente; net/settled/reversões monetárias e atribuição seguem desconhecidos. Campos de pagamento, comprador, acesso, comissões, callback e secret são descartados.

O motivo controlado dispute_not_final no JSON mantém MED/pré-chargeback em revisão. Recusa sem instante e datas insuficientes usam unknown_event_time. Sem novas colunas/migração. Datas ISO nativas têm precisão normalizada a milissegundos sem arredondamento; conflitos simultâneos permanecem em revisão. Abandonos são ignorados/agrupados sem identificar comprador, e não constituem analytics de abandono. [Contrato](integracoes/cakto.md).

## Prévia de instantâneos CSV — D66

Prévia canônica interpreta as treze colunas documentadas e compara com catálogo/projeção, sem criar ImportBatch/ImportRow, fato, transação, auditoria ou arquivo Media. FileHash e linhas normalizadas só na resposta owner; dados inválidos retornam número/código sem conteúdo. settled_cents informado exige revisão e não é projetado; zero/null distintos, sem inferir movimentos/somas. Registros distintos da mesma transação no lote conflitam, não são sequência de webhooks. [Contrato completo](24-conciliacao.md). Vinte migrações preservadas; persistência/auditoria de importação ainda pendentes.

## Lotes e linhas duráveis — D67

commercial-import-batches guarda hashes do pedido/arquivo/manifesto/plano, fonte/referência/justificativa controladas, actor, estado/counts/datas e confirmedBy. commercial-import-rows guarda linha lógica, chave/hash, snapshot normalizado, classificação/razão, duplicateOf, estado e referências a inbox/transação. commercial-import-audit é trilha privada de estágio/confirmação/repetição/stale com owner/data/motivo. CSV bruto e linha inválida não persistem. Migração 21 tem unicidade batch/line, checks de hashes/contagem/linha e recusa down com qualquer evidência.

Fonte nova csv-owner-snapshot-v1 não se passa por autenticação do fornecedor. Fato mantém approvedAt declarado somente em approved, sem criação original inventada; outras aprovações ficam desconhecidas. Commit enfileira ou confirma compatibilidade, não escreve projeção/recebimento. [Estados, limites e custódia](24-conciliacao.md).
