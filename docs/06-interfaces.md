# 06 — Interfaces e contratos internos

[Índice](../README.md) · [Dados](05-dados.md) · [Segurança](12-seguranca-privacidade.md)

Contratos de referência para o produto completo; implementação e validação atuais no [estado atual](23-estado-atual.md) e no [histórico](19-desenvolvimento.md). A coluna de estado distingue código existente de contrato previsto; existência de rota não implica ativação/homologação. Prefixo customizado `/api/v1`; CRUD Payload fica em seu namespace próprio, protegido por coleção e campo. Interface de administração não é API pública de integrações.

## Convenções

JSON UTF-8, datas ISO 8601 UTC, UUID para IDs internos, dinheiro inteiro. Erros usam códigos sanitizados; o formato depende do endpoint: rotas comerciais/importações retornam objetos simples com `code` ou `state`, enquanto outros contratos podem usar `error`. Não pressupor um envelope universal; consultar contrato e testes HTTP da rota. Sem stack trace ou dados submetidos na resposta. Validação estrita em servidor; descartar propriedades não declaradas. Mutação de sessão administrativa exige proteção CSRF e origem permitida.

| Método e rota | Entrada / autorização | Saída e comportamento | Estado atual |
|---|---|---|---|
| POST `/api/v1/lead-requests` | email, magnetId, marketingOptIn boolean, consentVersion se opt-in, campaignCode opcional | 202 genérico; valida material ativo, cria confirmação e fila; 422 inválido, 429 limite | Implementado localmente |
| POST `/api/v1/lead-confirmations` | token opaco | 200 confirmação/material; 410 expirado, inválido ou revogado; repetição de token válido não reenvia nem duplica assinatura | Implementado localmente |
| GET `/amostras/confirmar?t=...` | token opaco | Página no-store com botão de confirmar; GET não consome token para evitar scanners de e-mail | Implementado localmente |
| POST `/api/v1/unsubscribe` | token próprio, finalidade de cancelamento global | 200 idempotente; cancela marketing global, sem login; seleção por tema usa endpoint próprio | Implementado localmente |
| POST `/api/v1/preferences` | token opaco e action `read` ou `unsubscribe-theme` com UUID theme | Consulta explícita dos assuntos do próprio contato; retirada temática idempotente/auditada, sem inclusão/reativação; 410 token inválido/expirado, 422 entrada/origem/tema inválido; no-store/no-referrer | Implementado localmente |
| GET `/preferencias?t=...` | token opaco | Página noindex/no-store; ações por POST; sem expor email na URL | Implementado localmente |
| GET `/api/v1/downloads/[token]` | token assinado curto | Stream do arquivo gratuito; 410 expirado; attachment e no-store; sem path informado pelo cliente | Implementado localmente |
| GET `/comprar/[offerId]?c=...` | offerId e código c opcional; sem URL arbitrária nem c duplicado | 302 para URL cadastrada intacta; no-store; 400 incompatível/inválido, 404 inexistente, 410 indisponível; saída operacional e contexto consentido separados quando analytics está habilitado (D59) | Implementado localmente |
| POST `/api/v1/events` | page_view com UUID/pagePath e consentimento analítico | 202 genérico; 422 inválido; não aceita purchase do browser | Implementado localmente D59, flag false |
| POST `/api/v1/webhooks/hotmart` | Hottok no cabeçalho, corpo nativo v2; conta da configuração | 200 após commit/duplicata/colisão durável; 401/413/415/422/503 | Implementado/testado localmente D63, flag false; não homologado |
| POST `/api/v1/webhooks/kiwify` | HMAC-SHA1 do corpo bruto, signature única na query; token privado configurado | 200 após commit/duplicata/colisão durável; 401/413/415/422/503 | Implementado/testado localmente D64, flag false; não homologado |
| POST `/api/v1/webhooks/cakto` | HMAC-SHA256 de timestamp.corpo, headers Cakto; V1/V2 | 200 após commit do conjunto; 401/413/415/422/503 | Implementado/testado localmente D65, flag false; não homologado |
| POST `/api/v1/admin/imports/preview` | Owner/origem exata, corpo text/csv canônico | Prévia provisória com erros por registro; committable=false; sem escrita | Implementado/testado localmente D66; prévia não autoriza escrita; estágio/confirmação separados D67; UI D80 |
| POST `/api/v1/admin/suppressions` | Owner e Origin exata; email, reason (`unsubscribed/bounced/complaint`), source (`manual/brevo-review`), reference opaca | 200 com applied/canceledPending/inFlight; referência repetida idempotente, conflito 422; anônimo/origem ausente ou externa 403; sem desbloqueio | Implementado localmente |
| POST `/api/v1/admin/privacy/delete` | Owner, Origin exata; `email`, `identityVerified: true` e `confirmDelete: "EXCLUIR"` | Exclui relações locais em transação; 200 `completed`, `pending` com bloqueios de conciliação ou `not_found`; repetição reconhece tombstone; 403 sem owner/origem, 422 contrato inválido | Implementado/testado localmente D93–D94; limitado por manifestos e filas externas |
| POST `/api/v1/admin/privacy/correct` | Owner, Origin exata; `previousEmail`, `correctedEmail`, `identityVerified: true` e `confirmCorrection: "CORRIGIR"` | Preserva relações/consentimentos locais; invalida confirmações e tokens antigos. Bloqueia envio incerto ou referências de identidade externa/manifesto; auditoria HMAC impede recaptura do endereço anterior. Colisão/tombstone de destino retorna `pending`; repetição é idempotente | Implementado/testado localmente D95–D96; relações externas ainda exigem conciliação |
| POST `/api/v1/admin/imports` | Owner/origem exata, text/csv canônico; Idempotency-Key UUID e X-Import-Source/Reference/Reason controlados | 201 novo lote durável; 200 repetição idêntica; 409 chave reutilizada com entrada diferente; um provedor/conta por lote | Implementado/testado localmente D67; [contrato detalhado](24-conciliacao.md) |
| POST `/api/v1/admin/imports/[id]/commit` | Owner/origem exata; JSON somente confirmed=true e planHash do lote durável | Revalida evidência/catálogo/inbox sob barreira; 202 queued não é aplicação; 200 confirmação sem novos fatos/repetição; 409 stale/blocked; não aceita hash da prévia provisória | Implementado/testado localmente D67 para casos limitados; UI de importação D80; resolução visual/liquidação operacionais pendentes |
| POST `/api/v1/admin/inbox/[id]/retry` | Owner, Origin exata, JSON com reason controlado | 202 queued; 200 unchanged; 403 acesso/origem; 422 entrada; 409 conflito/lease ativo | Implementado/testado localmente D61 |
| POST `/api/v1/admin/transaction-resolutions/preview` | Owner/origem exata; ReviewChoice JSON | Prévia provisória e READ ONLY do componente, sem escrita | Implementada D73; [contrato](24-conciliacao.md) |
| POST `/api/v1/admin/transaction-resolutions` | Owner/origem exata; escolha/hash/atestação e Idempotency-Key | 201 decisão/aplicação atômica; 200 repetição; 409 stale/prova/chave | Implementada localmente D74; [contrato](24-conciliacao.md) |
| GET `/api/v1/admin/reports` | Admin, período máximo 366 dias, filtros | Agregados, desconhecidos, cobertura e freshness; dados pessoais excluídos | Previsto; não implementado |
| GET `/health/live` e `/health/ready` | Sem dados sensíveis | 200 vivo/pronto; ready verifica banco com timeout, 503 indisponível | Implementado localmente |

## Ledger e relatório financeiro — D78

| Método e rota | Entrada / autorização | Saída e comportamento | Estado atual |
|---|---|---|---|
| POST `/api/v1/admin/settlement-evidence` | JSON estrito; owner e Origin exata; crédito/débito, transação aprovada comprovada, moeda, fonte/linha e atestação | 201 novo / 200 repetição / 409 conflito ou vínculo não comprovado / 422 contrato inválido; nova correção referencia `supersedes`; nunca marca recebimento pela projeção comercial | Implementado/testado localmente D78; sem fonte nativa homologada |
| POST `/api/v1/admin/financial-costs` | JSON estrito; owner e Origin exata; categoria, valor/moeda, confirmado/estimado, fonte/linha, período e campanha opcional | 201 novo / 200 repetição / 409 conflito / 422 inválido; substituição append-only | Implementado/testado localmente D78 |
| POST `/api/v1/admin/financial-report/preview` | `{from, through, currency?}`; owner e Origin exata; janela até 366 dias | Prévia privada somente leitura por moeda, coorte de aprovação, período de liquidação/custo e cobertura; `provisional=true`, margem não completa, desconhecidos null | Implementado/testado localmente D78; R16/P04 continuam parciais |

As três rotas limitam JSON a 64 KiB e cinco segundos, ocultam erros e respondem no-store/no-referrer. O período de relatório usa UTC e cada dimensão temporal é exibida separadamente. Nenhuma rota aceita payload real de comprador ou interpreta formato nativo de provedor.

O painel owner `/admin/financial-ledger` apresenta a prévia D78 sem mutações: período UTC e moeda opcional por formulário GET, cobertura, desconhecidos, coortes e valores de liquidação/custos. A página respeita os mesmos limites do serviço e não oferece edição de fatos; P05 permanece parcial para resolução auditada e cobertura integral; o registro operacional de liquidações/custos está na view D81.

O painel owner `/admin/commercial-imports` (D80) usa as rotas de snapshot D67 e evidência D77: upload privado em memória, prévia provisória, preparação com Idempotency-Key estável durante repetição e confirmação com o planHash do lote persistido. Alterar arquivo/metadados invalida a prévia. O histórico exibe os 20 lotes recentes; cada lote pagina 50 linhas, permite abrir valores/identidades/datas/referências e consultar auditoria. A leitura usa autorização das coleções e não muta em GET. Bloqueios e planos stale exigem corrigir a causa e preparar novo lote. Resposta de rede incerta conserva a tentativa para repetição segura; o usuário também pode retomar pelo histórico. Sem JavaScript, a leitura funciona e as ações ficam desabilitadas.

## Captura e e-mail

Normalizar email com trim e lowercase; máximo 254 caracteres; não alterar aliases ou pontos. Uma confirmação por contato/material em 15 minutos, limite diário configurável, resposta pública sempre igual. Rate limit em banco/proxy, não apenas memória do processo.

Token de confirmação: aleatório criptográfico 32 bytes, só hash persistido, 24h de validade. Pedido confirma a solicitação de amostra; assinatura só se houve opt-in explícito. Link de download com validade de 24h pode ser renovado pelo fluxo de solicitação. Descadastro usa token de finalidade própria, válido por 180 dias; nova assinatura exige nova confirmação. Não usar JWT de admin nesses links.

Material já pode ter páginas públicas de demonstração. O download da amostra completa não fica em URL pública permanente. A entrega de material solicitado continua independente de assinatura de marketing.

Supressão operacional está disponível no painel `/admin/suppressions` e por CLI local. A entrada é uma conferência do proprietário, não um webhook autenticado do Brevo. A referência aceita 1–128 caracteres ASCII alfanuméricos, ponto, hífen, sublinhado ou dois-pontos; somente HMAC fica na chave do ConsentEvent. Fonte e motivo são preservados, sem payload bruto. Não importar consentimento nem limpar bounce/complaint por esse fluxo. Descadastro mantém os e-mails transacionais solicitados; bounce/complaint cancelam pendentes, mas envios já iniciados exigem conciliação. Confirmar também a supressão na conta externa até existir sincronização homologada. JSON limitado a 4 KiB; respostas sem endereço ou referência submetidos.

## Redirecionamento e atribuição

Nunca aceitar `url`, `redirectTo` ou domínio arbitrário do navegador. `offerId` resolve destino validado; `c` resolve campanha ativa vinculada ao mesmo livro/oferta. Campanha afiliada com oferta incompatível retorna 400, sem fallback. URL afiliada é cadastrada e revisada, não recebida livremente via query.

Preservar todos os parâmetros comerciais existentes. Novos parâmetros de atribuição só podem ser acrescentados pelo adaptador em campos oficialmente suportados e testados, sem sobrescrever assinatura, afiliado ou oferta. Até homologação, redirecionar URL intacta e registrar venda sem vínculo ao clique.

A gravação analítica falhar não bloqueia um destino seguro já resolvido. Falha ao verificar disponibilidade/URL no banco retorna 503, sem confiar em cópia desatualizada. Visitas sem consentimento não recebem cookie analítico ou identificador persistente de atribuição.

## Webhook e normalização

Contrato interno do adaptador:

```ts
type Provider = 'hotmart' | 'kiwify' | 'cakto';
type NormalizedEvent = {
  provider: Provider;
  accountKey: string;
  eventKey: string;
  externalTransactionId: string;
  externalProductId: string;
  externalOfferId?: string;
  kind: 'pending' | 'approved' | 'refused' | 'canceled'
    | 'partially_refunded' | 'refunded' | 'chargeback';
  occurredAt: string;
  approvedAt?: string | null; // null explícito preserva aprovação sem data conhecida
  sourceCreatedAt?: string; // criação da notificação, quando confirmada
  sourceEvent?: string; // nome original validado, sem PII
  reviewReason?: 'unsupported_currency_precision' | 'unsupported_purchase_shape' | 'unsupported_native_status';
  currency: string;
  grossCents: number | null;
  refundedCents: number | null;
  feesCents: number | null;
  producerNetCents: number | null;
  externalClickReference?: string;
  refundBasis?: 'cumulative' | 'operation';
  externalRefundId?: string;
  chargebackCents?: number | null;
};
```

`verify(rawBody, headers, config)` autentica antes de `normalize`. Cada implementação define extração, eventos suportados e dedupKey com fixtures; não compartilhar segredo ou mapeamento entre provedores. Corpo máximo inicial 256 KiB, reavaliado com fixtures oficiais. Tipo desconhecido autenticado é armazenado como ignorado, sem venda; identificação insuficiente fica em revisão. Limite excedido 413, assinatura inválida 401, envelope nativo inválido 422 nos três endpoints locais D63–D65; banco indisponível 503. Jamais responder 200 se o evento não ficou durável.

Segredos e dados desnecessários são removidos antes da persistência. Payload integral não será salvo por padrão. Envelope mínimo preserva campos necessários à normalização e reconciliação, sem dados do comprador. Não logar tokens, headers de autenticação ou query strings sensíveis.

## CSV de conciliação

Formato canônico UTF-8, cabeçalho, vírgula, valores em centavos: `provider,account_key,transaction_id,product_id,offer_id,status,occurred_at,currency,gross_cents,refunded_cents,fees_cents,producer_net_cents,settled_cents`. Opcionais vazios viram null; campos obrigatórios e enum validados. Até 5 MiB/10 mil linhas por lote. Exportação do provedor é convertida para esse formato, sem importador automático de layout desconhecido.

Duplicata exata não altera total; conflito com webhook exige resolução explícita na prévia, com justificativa e fonte. Valores de recebimento só vêm de evidência de liquidação, nunca da aprovação. Exportações para planilha neutralizam fórmulas começando com `=`, `+`, `-` ou `@` em células textuais.

## Interfaces de apresentação

Sem novas APIs comerciais. O CRUD administrativo do Ebook aceita somente `presentationVariant` e `accentPreset` conforme [dados](05-dados.md); Media recebe metadados de apresentação validados. Rejeitar enum inválido e CSS/HTML de estilo arbitrário. APIs públicas projetam somente campos de apresentação publicados.

`/amostras/[slug]` é página de captura, não rota para arquivo bruto; reutiliza o fluxo existente. Preferência local tem tipo `system | light | dark`; a chave `bibliotheon:appearance:v1` guarda apenas esse enum, com default system. O contrato de `/preferencias` para marketing não muda. Tema visual não altera destino de checkout, parâmetro afiliado ou disponibilidade comercial.


## Callback Brevo de marketing (D58)

POST /api/webhooks/brevo usa Authorization: Bearer TOKEN_PRIVADO, sem cookie, origem de navegador ou chave na URL. Endpoint separado da inbox comercial implementada localmente. Apenas evento individual de marketing/email, batched=false; nomes recebidos delivered/hard_bounce/soft_bounce/spam/unsubscribe. Eventos não selecionados são ignorados sem gerar métricas. Envelope conhecido é persistido e aplicado/quarentenado atomicamente antes de 200; duplicata semântica recebe mesmo ACK. Resposta não contém endereço, IDs recebidos ou situação do contato.

Limite 32 KiB/5 segundos de leitura. 401 credencial ausente/incorreta; 413 grande; 415 MIME/encoding; 422 JSON/envelope incorreto; 429 + Retry-After para configuração desligada/inválida ou indisponibilidade temporária. A exceção ao 503 do contrato comercial é intencional: [retry Brevo](https://developers.brevo.com/docs/retry-mechanism) documenta descarte em 5xx. Estado por destinatário e consentimento permanecem separados da aceitação HTTP de disparo. Contrato completo em [Brevo](integracoes/brevo.md) e [D58](17-decisoes.md).


## Medição opcional — D59

GET /api/v1/analytics-consent retorna apenas enabled/manage/choice, sem criar cookie ou sessão. POST na mesma rota aceita somente choice=accept|reject em JSON, com Origin exata, até 2 KiB. Aceite habilitado retorna enabled/choice e cookie opaco HttpOnly/Secure, nunca token no JSON; rejeição limpa identificador e persiste preferência não identificável. Cookie velho revogado não pode enviar eventos. Recusar funciona com a coleta desativada; aceitar exige flag e aviso institucional revisado.

POST /api/v1/events aceita type=page_view, UUID eventId, pagePath público sem query e campaignCode/UTMs opcionais e controlados. 202 genérico com accepted, sem revelar sessão ou origem; cookie sem permissão não produz coleta. Tipos purchase, campos extras, página sensível, dados aparentes e origem inválida são 400; limite 429; indisponibilidade 503. Coleções privadas não são APIs de coleta pública. Status e mutações no-store/no-referrer; sem origens externas.

Checkout mantém resolver/302 e URL externa intacta. Quando medição está habilitada, requisição elegível registra saída operacional; vínculo de sessão só com consentimento vigente. Falha de gravação não interrompe saída segura. API não retorna clickId nem o anexa aos provedores. Não existe compra confirmada pelo browser. Veja [decisão](17-decisoes.md) e [qualidade](15-qualidade.md).


POST /api/v1/analytics-withdrawal é fallback de formulário nativo: application/x-www-form-urlencoded, somente choice=reject, Origin exata e corpo limitado. Revoga cookie existente e responde 303 para /privacidade, sem destino externo. Leitura de entrada analítica tem teto de 2 KiB/5 segundos; timeout 408, duplicidade em formulário 400. Não depende de JavaScript, flag ativa ou aviso publicado para retirar uma permissão anterior.


## Retry comercial implementado — D61

POST /api/v1/admin/inbox/[id]/retry exige sessão/token do owner e Origin exatamente igual à origem PUBLIC_SITE_URL. JSON até 4 KiB, somente reason: catalog_updated, service_restored ou reviewed_envelope. Ator vem da autenticação Payload, nunca do corpo. Resposta privada/no-store contém apenas estado ou código sanitizado/requestId. Falha operacional retorna 503. Registro inexistente também permanece resposta indisponível genérica nesta versão.

A ação recoloca o envelope persistido na fila; não cria evento comercial, não troca identidade/valores e não autentica payload bruto. Applied/ignored retornam unchanged com auditoria; colisão e processamento ativo retornam 409. Tentativas totais permanecem, e somente o orçamento automático reabre. A recepção interna valida o contrato normalizado; nenhum endpoint público aceita esse tipo diretamente. Os endpoints nativos Hotmart/Kiwify/Cakto foram acrescentados em D63–D65, com autenticação própria e flags false. D67 acrescenta confirmação owner limitada de lotes CSV para a mesma inbox. Não confundir retry da inbox com reenvio de campanha Brevo.


## Administração comercial — D62

GET /admin/commercial-inbox é view privada do Payload. Anônimo vai ao login; serviços de resumo/lista exigem owner. Filtros GET: provider=all/hotmart/kiwify/cakto; state=all/attention/pending/processing/needs_review/failed/applied/ignored; page inteiro positivo até seis dígitos; event opcional deve ser UUID. Default all/attention/1. Página inexistente/filtro inválido exibe erro recuperável e link para reabrir; nenhuma mutação é executada por GET. Paginação de vinte mantém os filtros.

Resumo geral por provedor não segue o filtro da lista: informa pending, processing e attention, datas da pendência mais antiga, último recebimento e última aplicação local. Attention pode incluir applied com colisão e processing vencido; não somar categorias como transações únicas. Datas de aplicação não significam conciliação ou liquidação financeira. Modelos de lista não retornam envelope, hash ou lease.

A ação visual reusa POST /api/v1/admin/inbox/[id]/retry: motivo e conferência obrigatórios no cliente, acesso/origem/estado/auditoria obrigatórios no servidor. Interface bloqueia pendentes/concluídos/colisão/lease ativo e informa processamento desligado. UI não contorna uma resposta 409 se o estado mudar entre leitura e envio. Retorno 202 registra o único ACK de fila e atualiza o acompanhamento; mensagem continua visível se o evento sai do filtro. Detalhe nativo readonly tem ações recentes e link para selecionar o evento na view, sem formulário aninhado.


## Evidências opcionais do contrato — D63

Campos opcionais approvedAt/sourceCreatedAt/sourceEvent e reviewReason controlado cabem no envelope JSON, sem coluna/migração nova. Hash de envelope legado sem essas evidências permanece byte a byte compatível; extensão informada entra no digest, inclusive approvedAt:null, que difere de ausência legada. Não backfillar data ou corpo por aproximação. Fábrica Payload pode ser recebida pelo receptor comum e só é chamada após verificação/normalização. Motivo de revisão impede projeção automática; fatos e última projeção conhecida são conservados.

Hotmart mantém data financeira original e criação da notificação separadas, descarta PII/origem não homologada e não deduz devolução monetária de full_price. Ver [contrato e limites Hotmart](integracoes/hotmart.md). Nenhum endpoint aceita o tipo normalizado vindo do navegador.

## Recepção Kiwify nativa — D64

POST /api/v1/webhooks/kiwify exige signature única na query com HMAC-SHA1 minúsculo do corpo bruto; token configurado não é enviado. MIME/tamanho/prazo e assinatura são conferidos antes de JSON/fábrica Payload. Contrato interno não é API pública de ingestão. Resposta 200 exige commit de inbox/duplicata/ignorado/colisão; 401 assinatura, 413 limite, 415 conteúdo, 422 schema e 503 indisponibilidade com Retry-After. Conta só vem da configuração. [Campos, revisão temporal e limites](integracoes/kiwify.md).

## Cakto nativa — D65

POST /api/v1/webhooks/cakto exige headers X-Cakto-Timestamp e X-Cakto-Signature com v1 HMAC-SHA256 sobre timestamp.corpo bruto. Janela de cinco minutos; uma assinatura v1 conhecida, podendo coexistir versão futura. Secret do corpo não substitui os headers. Corpo limitado a 256 KiB/cinco segundos; V1 objeto ou V2 com uma a 25 entradas, todas validadas antes do banco. Um commit cobre todos os recibos/auditorias; 200 só depois dele. Erros: 401/413/415/422/503 conforme [contrato Cakto](integracoes/cakto.md). Resposta de erro requer reenvio manual no fornecedor; Retry-After não garante nova tentativa externa. Nenhuma rota pública aceita envelope normalizado de navegador.

## Prévia CSV privada local — D66

POST /api/v1/admin/imports/preview implementado com sessão owner/origem exata, text/csv UTF-8/identity e limite 5 MiB/cinco segundos. Prévia 200 pode conter erros de registros; sempre provisional=true e committable=false. Erro estrutural 422, conteúdo 415, limite 413, leitura lenta 408, consulta indisponível 503, autenticação/origem 403. Arquivo não é salvo; sem JSON normalizado aceito, confirmação, UI ou escrita financeira. [Semântica, classes e limites](24-conciliacao.md). Confirmação futura dependerá de plano durável/revalidação auditada, não desse hash/resposta.

## Confirmação de importação — D67

POST /api/v1/admin/imports: owner/origem, text/csv, Idempotency-Key UUID, X-Import-Source/Reference/Reason controlados. 201 cria lote/linhas/auditoria, inclusive blocked; 200 repetição exata; 409 reutilização da chave com outro conteúdo/metadado. Uma conta/provedor por estágio; prévia aceita mistura para diagnóstico.

POST /api/v1/admin/imports/{id}/commit: owner/origem, JSON de até 4 KiB/cinco segundos, exatamente confirmed=true e planHash. 202 queued significa inbox durável; 200 confirmed/duplicate não cria novos fatos; 409 stale/plano/bloqueio, 404 ausente, 422 entrada inválida. Revalidar estado/manifesto/evidências do servidor, sem ator/valores/classificações enviados pelo cliente. Coleções nativas permitem read owner e negam create/update/delete diretos. Headers privados/no-store/no-referrer cobrem a família de rotas. [Contrato](24-conciliacao.md).


## Decisões de identidade do catálogo — D72

POST /api/v1/admin/catalog-resolutions/preview e POST /api/v1/admin/catalog-resolutions reutilizam autenticação owner e Origin exata. Corpo JSON limitado, prévia provisória e confirmação com prova declarada/justificativa controlada/Idempotency-Key. 201 nova revisão imutável, 200 repetição (current=false quando substituída), 409 plano stale/chave reutilizada. Não aceitam ator nem fatos financeiros arbitrários. Coleção nativa catalog-resolutions é somente de leitura para owner. [Campos, limites, respostas e efeito sobre inbox/CSV](24-conciliacao.md).

## Prévia por componente de transações — D73

POST /api/v1/admin/transaction-resolutions/preview é privado, owner/origem exata e somente leitura, com escolhas por recibo e variantes persistidas. Retorna todo o componente conectado, projeções simuladas e motivos de bloqueio; sempre provisional=true/committable=false. processable não autoriza escrita. Não existe confirmação financeira nesta etapa. [Corpo, limites e respostas](24-conciliacao.md).

## Confirmação de decisão financeira — D74

POST /api/v1/admin/transaction-resolutions implementa confirmação owner/origem exata, JSON 5 MiB/5s, Idempotency-Key UUID, plano revalidado e atestação de evidência controlada. 201 nova decisão/aplicação, 200 repetição, 409 chave/plano/prova incompatível, 422 contrato, 403 permissão/origem. Coleções financial-resolutions e financial-resolution-applications negam escrita nativa e leitura anônima. A prévia continua provisória/somente leitura. Sem aceitar ator/valores arbitrários; evidência complementar continua em P02/P03. [Contrato completo](24-conciliacao.md).

## Cadastro de evidência complementar — D75

POST /api/v1/admin/report-evidence: owner/origem exata, JSON canônico 64 KiB/5s, fonte/linha/atestação e substituições explícitas. Identidade da linha dá 201/200 idempotentes; conflito de conteúdo na mesma identidade 409. applied=false significa que cadastro não aplica projeção. Fonte aparece na prévia/decisão de componente; proof insuficiente permanece bloqueada. CRUD nativo não grava provas. [Contrato completo](24-conciliacao.md).

`POST /api/v1/admin/report-evidence/batch`: envelope JSON exato `{ records: [...] }`, 1–20 registros com os mesmos campos/canonização D75, até 512 KiB/5 s. Toda a validação antecede a transação; fontes, marcações de revisão e deduplicação são atômicas. 201 quando houver linha nova, 200 em repetição integral, 409 se qualquer identidade existente conflitar, 422 para lote inválido/linha repetida, 413/415/408 para corpo/tipo/tempo e 503 em limites ou indisponibilidade. Não aceita CSV bruto nem interpreta layout nativo. [Contrato e cobertura D76](24-conciliacao.md).

`POST /api/v1/admin/report-evidence/imports/preview` lê CSV canônico UTF-8 de 18 colunas, 512 KiB/20 linhas e retorna classificação provisória sem persistência. `/imports` exige `Idempotency-Key` UUID e metadados `x-import-source`, `x-import-reference`, `x-import-reason`; cria lote privado D67 (201 novo, 200 repetição). `/imports/{id}/commit` recebe somente `{ confirmed: true, planHash }`, revalida manifesto/fonte/conta sob lock e grava evidências, linhas `recorded`, lote e auditoria atomicamente; 201 novo, 200 repetição, 409 stale/integridade. Ambos exigem owner/Origin exata, usam até cinco segundos e respostas privadas. Não interpreta layout nativo nem registra evento/venda/recebimento. [Contrato D77](24-conciliacao.md).

## Registro financeiro no painel — D81

View owner `/admin/financial-records`, com kind settlement/cost, moeda opcional e paginação de 20 registros ordenados por recordedAt/id decrescentes. entry abre uma linha; replace prepara uma correção somente se ela não foi substituída. UUID/tipo/moeda inválidos não preparam formulário. Leituras respeitam o acesso das coleções; GET não grava. Há links no dashboard e na prévia financeira.

A conferência inicial é local ao formulário: valor decimal sem separador de milhar, data/hora UTC e resumo dos vínculos/fonte. Não cria prova nem antecipa a validação da transação. Após checkbox explícito, POST usa os endpoints D78; owner, origem, contrato e elegibilidade são novamente conferidos no servidor. Valores passam exatamente a centavos por BigInt, sem arredondamento; IDs de conta/transação aceitam os 200 caracteres do contrato. Fonte/linha é estável durante repetição, inclusive se a resposta se perder. Após navegar, o histórico permite localizar o registro.

Correção envia nova referência de linha e supersedes. Liquidação preserva provedor/conta/transação/moeda/referência da liquidação/fonte; custo preserva categoria/moeda/campanha/fonte. Valor, instante, sentido de caixa ou classificação podem ser corrigidos conforme o tipo. A linha anterior permanece; outra substituição já existente bloqueia o formulário/API. Campanha opcional aceita ID cadastrado, com sugestões das 100 mais recentes; campaignId do contrato é gravado no relacionamento campaign. Não há migração, segredo, flag ou endpoint novo. A decisão financeira auditada pela UI segue pendente.

## Resolução de identidades no painel — D82

View owner `/admin/catalog-resolutions` chama os contratos D72 existentes de prévia e decisão. O formulário mantém identificadores exatos de provedor/conta/produto/oferta externa; destino é UUID de livro ou oferta conferida, validado pelo servidor. Hold usa destinos null, evidenceVerified=false e evidence_inconclusive. Associate exige fonte/motivo e atestação explícita. A prévia mostra escopo, destino, revisão anterior, hash, ofertas e transações do produto; as transações paginam 20 por vez. Confirmação congela escolha/metadados/hash e UUID idempotente em memória até voltar ou navegar. A mesma confirmação pode ser repetida após perda de resposta; stale exige nova prévia. Nenhum endpoint, schema, segredo ou contrato de fornecedor mudou.

Histórico GET privado mostra 20 decisões por página, filtro por provedor, detalhe/autoria/fonte/atestação e revisão anterior/sucessora. Snapshot integral permanece na coleção nativa somente leitura. Sem JS o formulário de prévia está desabilitado e histórico/filtros/disclosures funcionam. Falhas preservam entrada; sem gravação por GET. Decisão de catálogo não aplica transação nem decide conflito financeiro.

## Resolução financeira no painel — D83

`/admin/financial-resolutions` exige owner e expõe os contratos existentes: consultar fonte usa preview com hold/selections=[] sem escrita; operador escolhe reconcile/hold e cada fonte/variante ou exclusão explícita. Nenhuma variante vem selecionada. Reconcile exige cobertura completa, inclusive fontes substituídas por relatório; hold envia selections=[] e evidenceVerified=false. Fonte/motivo e atestação são próprios da decisão.

Prévia apresenta bloqueios, resultados por transação, destinos efetivos, valores conhecidos/null, revisão anterior e hash. processable não é autorização; o servidor revalida tudo ao registrar. Escolha/metadados/hash/UUID são congelados em memória para repetição após resposta perdida. Voltar descarta a prévia e exige outra conferência; fontes novas podem bloquear cobertura. A decisão aplica projeções derivadas e registra aplicação, preservando fatos/envelopes originais; não comprova recebimento.

Fontes, variantes e resultados têm páginas de 20; histórico de decisões 20, aplicações 10, com desempate por ID. Detalhe mostra revisões anteriores e cabeças mais recentes sem certificar vigência atual. Snapshot/resultados registrados ficam separados das aplicações posteriores. Links JSON autenticados permitem consultar prova/aplicação completas. Sem JS há histórico, filtros, detalhes e primeiros 20 itens das listas; nova consulta e registro ficam desabilitados.

## Cobertura de relatório — D84

Entrada e autorização de `POST /api/v1/admin/financial-report/preview` permanecem iguais. Resposta aditiva: observedAt é instante UTC da consulta; transactionApprovalDateCoverage distingue candidatas pagas/em revisão no período e candidatas sem data, inclusive revisões. transactionsWithEvidence é restrito à moeda/coorte; transactionsInReviewWithEvidence mostra alocação sob revisão, sem invalidar o movimento de caixa documentado. Créditos/débitos usam o período de liquidação, mesmo quando aprovação pertence a outro mês.

Cada resumo informa arithmeticOverflowFields: total fora do inteiro seguro retorna null com amount_overflow, distinguindo origem conhecida de soma não representável. Coortes mantêm transactions como candidatas na janela, verifiedTransactions para população sem revisão e transactionsInReview separadas. Valores conhecidos e suas coberturas excluem revisão. reversedTransactions conta compras com reversão conhecida uma vez; reversalCoverage acompanha o estado (independente de valor), e reversalRate é null sem cobertura integral, sem população ou com revisão. Maturity informa idade mínima/máxima observada das aprovações sem revisão; windowVerified=false não é prazo de reversão. O relatório continua provisório, sem margem fiscal ou atribuição inferida.

## Detalhamentos de relatório — D85

Entrada/autorização da prévia não mudam. dimensions.byProvider/byBook separam moeda, valores/quantidades/cobertura, revisões, caixa, transações sem algum valor/sem campanha comprovada e processamento registrado. Livro usa effectiveEbook quando conferido, senão original; revisão vai ao grupo sem livro conferido. Cash fora da janela de aprovação conserva movimento; vínculo ausente, em revisão ou moeda/provedor divergente não recebe livro por suposição. Custos não são rateados por livro/provedor e os grupos não calculam margem.

byCampaign usa campaign da linha de custo. Campanha específica tem custos confirmados/estimados, mas receita e compras atribuídas null; a parcela sem atribuição guarda os resultados sem inventar relação por custo ou externalClickReference. attributionCoverage.implemented=false e provenTransactions=0 descrevem prova disponível, não zero vendas de cada campanha. processing traz população approval_window, quantidade com/sem sucesso e lastSuccessfulProcessingAt de lastSuccessAt válido e não futuro; não é heartbeat global do provedor.

View pagina cada dimensão em 20 grupos via GET providerPage/bookPage/campaignPage; detail=provider/book/campaign conserva disclosure nativo aberto ao mudar página, inclusive sem JS. Campos inválidos de paginação usam página segura/limitada. Filtros de período/moeda são preservados nos links; mudar filtros reinicia detalhamentos. API continua a devolver os grupos completos dentro dos limites existentes. Nenhuma mutação ou novo endpoint.

## Aceite dos contratos canônicos — D86

Nenhum endpoint/campo novo. Estados pending, approved, refused, canceled, partially_refunded, refunded e chargeback foram persistidos/confirmados/aplicados explicitamente para Hotmart/Kiwify/Cakto. Campo monetário sem informação fica vazio no CSV/null no modelo; não preencher campos de reversão incompatíveis com kind só para representar ausência. Prova incompleta ou estado/valor incompatíveis fica bloqueada no preview financeiro, sem botão de confirmação na UI e sem transação via decisão recusada.

Stage/commit não substituem a decisão financeira, e decisão não comprova caixa. Repetição do mesmo arquivo/linha/chave não duplica prova; conflito bloqueia e mudança após stage pode marcar stale, exigindo nova conferência. Falha tardia na confirmação reverte prova/linhas/lote integralmente. Snapshot continua queued quando enfileira fato e depende de processamento; não é aplicação ou recebimento. Jornada integrada validou as cinco views no build D85 conferido, sem alterar os contratos existentes.

## Atribuição por referência validada — D87

Nenhum endpoint novo. A rota de saída pode anexar `sck` ao checkout externo, usando UUID de `checkout-clicks` somente com consentimento vigente e campanha ativa. Callback nativo normalizado continua privado na inbox/projeção. A prévia financeira relaciona essa referência ao clique interno e só agrega campanha se provedor/conta/oferta/livro coincidirem e a aprovação ocorrer em até 30 dias após o clique; transações em revisão não são atribuídas. `dimensions.attributionCoverage` informa transações com/sem prova; receita por campanha exige cobertura monetária completa. A prévia permanece somente leitura e não calcula ROAS/margem. P06 é parcial até confirmar o campo retornado em cada conta Kiwify/Cakto.

## Verificação HTTP da atribuição — D88

Sem alteração de endpoint ou contrato em D88. Testes loopback exercitaram `GET /comprar/[offerId]?c=...` com consentimento, sem consentimento e `sck` preexistente; o identificador próprio só entra com consentimento e sem referência pré-configurada. Testes dos três callbacks chegaram à inbox/projeção e ao relatório. Referência ausente/livre e contexto Hotmart divergente não atribuem; replay é idempotente. Kiwify/Cakto confirmam apenas os formatos das fixtures sintéticas, não campos entregues por suas contas. [Evidências](../artifacts/attribution/p06-audit-d88.json). P06 continua parcial até H01.

## D105 — Pendências de privacidade e fluxos existentes

Os contratos owner de exclusão/correção continuam retornando pending quando a conciliação não está comprovada, sem apagar identidade ou fabricar conclusão. A auditoria pending também bloqueia novos pedidos/confirmações e nova emissão de e-mail/promoção/cadastro. Respostas públicas mantêm os erros genéricos existentes, sem revelar motivo ou endereço. Origem exata, sessão owner e declaração de identidade continuam obrigatórias nas rotas administrativas.

A CLI privada de recuperação usa manifesto v2 com pending separado de completed e aceita v1 somente para decisões concluídas já cobertas por esse formato. `pendingCoverage=false` no relatório de v1 impede tratá-lo como evidência de preservação das pendências. Resolver exige a operação owner existente e conciliação apropriada; o replay nunca converte pending em completed automaticamente.

## D107 — Conclusão das CLIs de manutenção — 26/10/2026

privacy-inventory, privacy-retention e analytics-retention agora encerram com sucesso após concluir o relatório e aguardar Payload.destroy(). Argumentos inválidos e falhas continuam com código não zero. O ensaio da imagem aplica limite de 60 segundos e registra duração de cada CLI; flags, modos preview/apply e contratos dos relatórios permanecem iguais. [Evidência](../artifacts/container/d107-results.json).

## D109 — Retenção de estado promocional — 26/10/2026

D109 implementa retenção local de estado promocional para contatos globalmente descadastrados há pelo menos 30 dias: remove assinaturas encerradas e calendários cancelados com etapas antigas, sem lote. Preserva identidade, amostras/outbox, consentimento, auditoria e supressão com o prazo original. Não executa exclusão de identidade nem forja pedido owner. Impedimentos de privacidade, provedor, envio incerto, vínculo cruzado e manifestos compartilhados/JSON preservam os registros. Preview é padrão; apply revalida sob locks e é atômico por contato. P07 continua parcial para identidade, demais finalidades e dados compartilhados. A imagem/restore D107–D108 são evidências da revisão anterior, não incluem esta rotina. [Oito grupos PostgreSQL sintéticos](../artifacts/privacy-retention/d109-results.json). Sem migration, chamada externa, dado real, nova imagem, VPS ou deploy.

## D109 — Relatório suppressedMarketing — 26/10/2026

O relatório de `privacy:retention` acrescenta `suppressedMarketing`: cutoff próprio de 30 dias, guardAvailable, candidates, eligible, processed, removedSubscriptions/Enrollments/Promotions, preservedForReconciliation e withoutExpiredMarketing. O cutoff principal de 24 meses permanece. Preview classifica, mas contadores de remoção continuam zero. Sem LEAD_TOKEN_SECRET válida, somente esta categoria preserva todos os candidatos e informa guardAvailable=false; as demais categorias mantêm seus contratos. Contagens de preservação incluem impedimentos ou mudança de estado na revalidação; não criam pedidos de privacidade pending.

## D110 — Retenção de identidade e recuperação — 26/10/2026

O relatório de privacy-retention passa a incluir closedIdentities: cutoff, suppressionCutoff, guardAvailable, candidatos/elegíveis/processados, provas e contatos removidos, preservações por finalidade/conciliação e marcadores expirados. Preview não escreve. Manifestos v1/v2 continuam legíveis; exportação usa v2 sem fatos automáticos, v3 quando contém retention. Replay informa retiredContacts, retirementPendingContacts e protectedNewerPurposes; releaseAuthorized continua false. Não há nova rota pública de exclusão automática.

## D112 — Descadastro e retenção por assunto — 26/10/2026

privacy-retention inclui withdrawnThemes com cutoff de 30 dias, disponibilidade de chave, candidatos/elegíveis/processados, assinaturas/calendários/etapas removidos, preservações e marcadores expirados. Manifesto exporta v4 quando existe theme-unsubscribe (theme UUID + HMAC + ocorrido/expiração); sem tema mantém v2/v3 e lê v1–v4. Replay acrescenta thematicCoverage, withdrawnThemes, protectedNewerThemeConsents, importedThemeWithdrawals e themePendingWithdrawals. Preview não escreve; releaseAuthorized continua false.

## D113 — Margem e acompanhamento do prazo — 26/10/2026

privacy-retention acrescenta marketingDeadline: cutoff de 30 dias, overdueSubscriptions (assinaturas state=unsubscribed com unsubscribedAt ≤ cutoff ainda presentes) e reviewRequired. Preview conta antes de expurgar; apply conta o estado remanescente no fim da rotina, usando relógio atual quando não há relógio de teste explícito. Não contém IDs/emails e não classifica esses registros como elegíveis para descarte. O contador não cobre automaticamente todos os calendários órfãos ou outras finalidades. suppressedMarketing/withdrawnThemes usam cutoff de 28 dias; closedIdentities mantém seu cutoff de 30 dias e provas de 24 meses.

## D114 — Legado temático verificável — 26/10/2026

privacy-retention acrescenta legacyThemeWithdrawals: guardAvailable, candidates, verified, persisted, existing, expired e unverified. withdrawnThemes acrescenta backfilledMarkers (chamada direta com prova vigente) e expiredProofClosures (estado encerrado com prova vencida, sem marcador novo). Preview pode reconhecer elegibilidade legada sem escrever. Exportação mantém v4, mas agora rejeita assinatura encerrada sem fato/prova nem cobertura global aplicável; não gera manifesto aparentemente completo omitindo a retirada. Cobertura de expurgo automático exige ausência de finalidade posterior. Campos/limites/assinaturas v1–v4 permanecem.
