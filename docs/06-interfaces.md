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
| POST `/api/v1/admin/imports/preview` | Owner/origem exata, corpo text/csv canônico | Prévia provisória com erros por registro; committable=false; sem escrita | Implementado/testado localmente D66; prévia não autoriza escrita; estágio/confirmação separados D67, UI customizada pendente |
| POST `/api/v1/admin/suppressions` | Owner e Origin exata; email, reason (`unsubscribed/bounced/complaint`), source (`manual/brevo-review`), reference opaca | 200 com applied/canceledPending/inFlight; referência repetida idempotente, conflito 422; anônimo/origem ausente ou externa 403; sem desbloqueio | Implementado localmente |
| POST `/api/v1/admin/imports` | Owner/origem exata, text/csv canônico; Idempotency-Key UUID e X-Import-Source/Reference/Reason controlados | 201 novo lote durável; 200 repetição idêntica; 409 chave reutilizada com entrada diferente; um provedor/conta por lote | Implementado/testado localmente D67; [contrato detalhado](24-conciliacao.md) |
| POST `/api/v1/admin/imports/[id]/commit` | Owner/origem exata; JSON somente confirmed=true e planHash do lote durável | Revalida evidência/catálogo/inbox sob barreira; 202 queued não é aplicação; 200 confirmação sem novos fatos/repetição; 409 stale/blocked; não aceita hash da prévia provisória | Implementado/testado localmente D67 para casos limitados; resolução/liquidação/UI pendentes |
| POST `/api/v1/admin/inbox/[id]/retry` | Owner, Origin exata, JSON com reason controlado | 202 queued; 200 unchanged; 403 acesso/origem; 422 entrada; 409 conflito/lease ativo | Implementado/testado localmente D61 |
| GET `/api/v1/admin/reports` | Admin, período máximo 366 dias, filtros | Agregados, desconhecidos, cobertura e freshness; dados pessoais excluídos | Previsto; não implementado |
| GET `/health/live` e `/health/ready` | Sem dados sensíveis | 200 vivo/pronto; ready verifica banco com timeout, 503 indisponível | Implementado localmente |

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
