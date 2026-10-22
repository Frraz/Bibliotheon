# 06 — Interfaces e contratos internos

[Índice](../README.md) · [Dados](05-dados.md) · [Segurança](12-seguranca-privacidade.md)

Contratos de referência para o produto completo; implementação e validação atuais no [estado atual](23-estado-atual.md) e no [histórico](19-desenvolvimento.md). A coluna de estado distingue código existente de contrato previsto; existência de rota não implica ativação/homologação. Prefixo customizado `/api/v1`; CRUD Payload fica em seu namespace próprio, protegido por coleção e campo. Interface de administração não é API pública de integrações.

## Convenções

JSON UTF-8, datas ISO 8601 UTC, UUID para IDs internos, dinheiro inteiro. Erro: `{ "error": { "code": "invalid_input", "message": "Revise os campos.", "requestId": "..." } }`. Sem stack trace ou dados submetidos na resposta. Validação estrita em servidor; descartar propriedades não declaradas. Mutação de sessão administrativa exige proteção CSRF e origem permitida.

| Método e rota | Entrada / autorização | Saída e comportamento | Estado atual |
|---|---|---|---|
| POST `/api/v1/lead-requests` | email, magnetId, marketingOptIn boolean, consentVersion se opt-in, campaignCode opcional | 202 genérico; valida material ativo, cria confirmação e fila; 422 inválido, 429 limite | Implementado localmente |
| POST `/api/v1/lead-confirmations` | token opaco | 200 confirmação/material; 410 expirado, inválido ou revogado; repetição de token válido não reenvia nem duplica assinatura | Implementado localmente |
| GET `/amostras/confirmar?t=...` | token opaco | Página no-store com botão de confirmar; GET não consome token para evitar scanners de e-mail | Implementado localmente |
| POST `/api/v1/unsubscribe` | token próprio, finalidade de cancelamento global | 200 idempotente; cancela marketing global, sem login; seleção por tema usa endpoint próprio | Implementado localmente |
| POST `/api/v1/preferences` | token opaco e action `read` ou `unsubscribe-theme` com UUID theme | Consulta explícita dos assuntos do próprio contato; retirada temática idempotente/auditada, sem inclusão/reativação; 410 token inválido/expirado, 422 entrada/origem/tema inválido; no-store/no-referrer | Implementado localmente |
| GET `/preferencias?t=...` | token opaco | Página noindex/no-store; ações por POST; sem expor email na URL | Implementado localmente |
| GET `/api/v1/downloads/[token]` | token assinado curto | Stream do arquivo gratuito; 410 expirado; attachment e no-store; sem path informado pelo cliente | Implementado localmente |
| GET `/comprar/[offerId]?c=...` | offerId e código c opcional; sem URL arbitrária nem c duplicado | 302 para URL cadastrada intacta; no-store; 400 incompatível/inválido, 404 inexistente, 410 indisponível; sem gravação de clique/UTMs analíticas | Implementado localmente |
| POST `/api/v1/events` | tipo allowlist, pagePath, contexto analítico consentido | 202; 400 inválido; nunca aceita evento `purchase` do browser | Previsto; não implementado |
| POST `/api/v1/webhooks/hotmart` | Autenticação própria Hotmart, corpo nativo | 200 após inbox durável ou duplicata; ver contrato do provedor | Previsto; não implementado |
| POST `/api/v1/webhooks/kiwify` | Autenticação própria Kiwify, corpo nativo | Mesmo padrão interno, validação própria | Previsto; não implementado |
| POST `/api/v1/webhooks/cakto` | Autenticação própria Cakto, corpo nativo | Mesmo padrão interno, validação própria | Previsto; não implementado |
| POST `/api/v1/admin/imports/preview` | Admin, CSV normalizado | Prévia com erros por linha, novos/duplicados/conflitos; não altera transações | Previsto; não implementado |
| POST `/api/v1/admin/suppressions` | Owner e Origin exata; email, reason (`unsubscribed/bounced/complaint`), source (`manual/brevo-review`), reference opaca | 200 com applied/canceledPending/inFlight; referência repetida idempotente, conflito 422; anônimo/origem ausente ou externa 403; sem desbloqueio | Implementado localmente |
| POST `/api/v1/admin/imports/[id]/commit` | Admin, hash da prévia, justificativa | 202; exatamente uma aplicação do lote; prévia alterada retorna 409 | Previsto; não implementado |
| POST `/api/v1/admin/inbox/[id]/retry` | Admin, justificativa | 202 com auditoria; não burla autenticação original | Previsto; não implementado |
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
  currency: string;
  grossCents: number | null;
  refundedCents: number | null;
  feesCents: number | null;
  producerNetCents: number | null;
  externalClickReference?: string;
};
```

`verify(rawBody, headers, config)` autentica antes de `normalize`. Cada implementação define extração, eventos suportados e dedupKey com fixtures; não compartilhar segredo ou mapeamento entre provedores. Corpo máximo inicial 256 KiB, reavaliado com fixtures oficiais. Tipo desconhecido autenticado é armazenado como ignorado, sem venda; identificação insuficiente fica em revisão. Limite excedido 413, assinatura inválida 401, envelope inválido 400; banco indisponível 503. Jamais responder 200 se o evento não ficou durável.

Segredos e dados desnecessários são removidos antes da persistência. Payload integral não será salvo por padrão. Envelope mínimo preserva campos necessários à normalização e reconciliação, sem dados do comprador. Não logar tokens, headers de autenticação ou query strings sensíveis.

## CSV de conciliação

Formato canônico UTF-8, cabeçalho, vírgula, valores em centavos: `provider,account_key,transaction_id,product_id,offer_id,status,occurred_at,currency,gross_cents,refunded_cents,fees_cents,producer_net_cents,settled_cents`. Opcionais vazios viram null; campos obrigatórios e enum validados. Até 5 MiB/10 mil linhas por lote. Exportação do provedor é convertida para esse formato, sem importador automático de layout desconhecido.

Duplicata exata não altera total; conflito com webhook exige resolução explícita na prévia, com justificativa e fonte. Valores de recebimento só vêm de evidência de liquidação, nunca da aprovação. Exportações para planilha neutralizam fórmulas começando com `=`, `+`, `-` ou `@` em células textuais.

## Interfaces de apresentação

Sem novas APIs comerciais. O CRUD administrativo do Ebook aceita somente `presentationVariant` e `accentPreset` conforme [dados](05-dados.md); Media recebe metadados de apresentação validados. Rejeitar enum inválido e CSS/HTML de estilo arbitrário. APIs públicas projetam somente campos de apresentação publicados.

`/amostras/[slug]` é página de captura, não rota para arquivo bruto; reutiliza o fluxo existente. Preferência local tem tipo `system | light | dark`; a chave `bibliotheon:appearance:v1` guarda apenas esse enum, com default system. O contrato de `/preferencias` para marketing não muda. Tema visual não altera destino de checkout, parâmetro afiliado ou disponibilidade comercial.
