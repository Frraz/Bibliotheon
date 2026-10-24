# 24 — Conciliação comercial e CSV

[Índice](../README.md) · [Estado atual](23-estado-atual.md) · [Backlog](13-backlog.md)

## Estado D67 — 24/10/2026

Prévia provisória D66 preservada. D67 acrescenta estágio durável de lote/linhas/auditoria e confirmação owner com revalidação. Fonte, referência operacional, justificativa controlada e responsável ficam registrados; CSV bruto e conteúdo inválido são descartados. Coleções privadas commercial-import-batches, commercial-import-rows e commercial-import-audit, somente de leitura pelo CMS/API, migração 21 local.

Confirmação de candidato novo significa **inbox durável**, não aplicação nem recebimento. Worker continua independente/desligado por padrão; linha aponta o evento enfileirado. Snapshots já compatíveis confirmam sem novo fato. Divergência, evidência pendente, reversão/recebimento sem contrato suficiente ou plano desatualizado não são aplicados automaticamente.

Primeiro contrato permite fatos novos pending/approved/refused/canceled com refunded_cents e settled_cents vazios. Outros estados, inclusive zero explícito de devolução, exigem a conciliação posterior. Não autentica relatório externo: owner declara que verificou a fonte e, para approved, que occurred_at é a aprovação original. Os três provedores são suportados como namespaces, sem inferir layout de exportação nativa.

R15/B11 seguem parciais: resolução auditada de conflitos/catálogo histórico, evidência de liquidação, custos, relatório financeiro e interface customizada continuam pendentes. Sem conta/relatório real ou homologação externa. R16 permanece pendente.

## Formato canônico

UTF-8, BOM inicial opcional, vírgula, cabeçalho exato nesta ordem:

```csv
provider,account_key,transaction_id,product_id,offer_id,status,occurred_at,currency,gross_cents,refunded_cents,fees_cents,producer_net_cents,settled_cents
```

Até 5 MiB e dez mil registros lógicos, sem cabeçalho na contagem. CRLF/LF/CR e aspas CSV escapadas são reconhecidos; não adivinhar delimitador, encoding, colunas ou fazer trim silencioso. Aspas abertas/lixo depois de aspas, cabeçalho incorreto, UTF-8 inválido, campo acima de 512 caracteres ou limite excedido recusam o arquivo. Campos financeiros/identificadores/datas têm validação adicional. Erro por registro informa apenas número lógico e código, sem ecoar campo inválido. Linha com várias quebras dentro de aspas continua um registro lógico; valores com quebras não passam como IDs/datas/dinheiro.

| Coluna | Regra |
|---|---|
| provider | hotmart, kiwify ou cakto |
| account_key | Alias local opaco, igual ao catálogo/configuração da conta |
| transaction_id, product_id | IDs opacos obrigatórios; não usar email, URL ou dados do comprador |
| offer_id | ID externo opcional; vazio significa desconhecido, não oferta primária |
| status | pending, approved, refused, canceled, partially_refunded, refunded ou chargeback |
| occurred_at | Instante do estado financeiro em ISO UTC com Z e até três casas fracionárias; não data de geração do relatório |
| currency | Código com três letras maiúsculas; nenhuma conversão cambial |
| gross_cents, refunded_cents | Inteiros não negativos seguros, ou vazio |
| fees_cents, producer_net_cents, settled_cents | Inteiros assinados seguros, ou vazio; sinal não é inferido |

Vazio permanece null; zero permanece zero. Sem expoente, decimal, separador de milhar, espaço ou arredondamento. settled_cents, quando informado inclusive zero/negativo, exige revisão/evidência de liquidação e não entra em projeção. Não pressupor movimento de caixa, soma ou base acumulada a partir do nome da coluna.

Cada linha é um **instantâneo candidato de uma transação**, não evento nativo ou movimento financeiro novo. Provedor/conta/transação identificam o grupo; linhas diferentes para essa identidade no mesmo arquivo entram em conflito, mesmo que descrevam momentos distintos. Não processar como sequência de webhooks. Idênticas após normalização apontam o primeiro registro; o hash do arquivo preserva bytes e não substitui a identidade comercial.

Exportações Hotmart/Kiwify/Cakto precisam de conversão explícita com colunas/unidades verificadas. Não houve consulta a conta nem descoberta de layout de exportação nativa em D66. Não enviar relatórios reais ao agente ou incluir compradores/credenciais na documentação/fixtures.

## Classificação da prévia

| Classe | Significado |
|---|---|
| new | Candidato sem transação conhecida e com catálogo resolvido; não é venda importada/aprovada |
| matched | Campos do instantâneo compatíveis com a projeção conhecida, sem lacunas adicionais |
| duplicate | Mesmo registro normalizado no arquivo; duplicateOf aponta a linha original, inclusive se ela exigir revisão |
| conflict | Divergência interna no arquivo, catálogo versus histórico, estado, data, moeda ou valores conhecidos |
| unknown_catalog | Produto/oferta não resolvidos no provedor e conta exatos |
| ambiguous_catalog | Mais de um livro ou oferta possível; sem fallback de primária/preço |
| needs_review | Revisão anterior, instante futuro, evidência adicional, campos incompletos ou liquidação a comprovar |
| invalid | Erro de campos/contagem no registro; sem conteúdo bruto na resposta |

Diferenças conhecidas não são substituídas; null não apaga conhecido e valores adicionais não completam automaticamente a projeção. Revisão/colisão existente tem prioridade sobre aparente compatibilidade. A prévia informa transação existente por ID para conferência privada; não devolve envelope, token, lease, corpo nativo ou comprador.

Consultas em blocos de 200 transações/100 identidades de catálogo, com seleção mínima. Até mil ofertas por bloco e dez mil no conjunto; excedente retorna indisponível, sem classificação falsa por truncamento. Contas/provedores permanecem separados. As leituras não são snapshot transacional e podem mudar enquanto o proprietário confere. O estágio/commit D67 usa plano próprio durável e revalida fatos/catálogo sob barreira da conta; não usa o hash dessa prévia como autorização.

Nenhum valor é somado no relatório desta etapa. Receita, recebido, margem e custo por venda continuam sem implementação. O projeto não calcula lucro contábil/fiscal; desconhecido nunca vira zero para apresentar resultado.

## API privada

POST /api/v1/admin/imports/preview recebe corpo text/csv, charset UTF-8 opcional, encoding identity e sessão owner de admin-users. Origin deve corresponder exatamente à origem PUBLIC_SITE_URL, inclusive ao usar JWT. Sem sessão/papel/origem corretos: 403 antes de ler o arquivo. A autenticação usa Payload; não há token novo nem variável de ambiente adicional.

Leitura limitada a 5 MiB/cinco segundos. HTTP 200 retorna prévia com erros de registros; 413 limite, 415 conteúdo/charset/compressão, 422 erro estrutural do CSV, 408 corpo lento e 503 consulta indisponível. Cache privado/no-store, noindex e Referrer-Policy no-referrer. Não registrar corpo, Authorization ou CSV em proxy/APM/debug. GET não disponível.

A rota não aceita JSON normalizado nem devolve autorização de importação. A confirmação D67 fica em endpoint separado, descrito abaixo; não há ação de UI customizada. Não há upload em Media nem arquivo bruto persistido.

## Planilhas

Helper spreadsheetCSV escapa aspas/vírgulas/quebras e prefixa texto que poderia iniciar fórmula com apóstrofo, inclusive após espaços/controles. Números assinados seguros permanecem numéricos; ausentes permanecem vazios. Helper coberto por testes, sem download/UI de exportação implementados. É formato de apresentação para planilha, não conversor de fornecedor nem garantia de round-trip do arquivo canônico: o apóstrofo protetor pode fazer parte do texto reimportado.

## Validação e próximas entregas

npm test, npm run test:commercial-csv e npm run test:commercial-csv-http. Banco loopback sem owner/histórico e fixtures exclusivamente sintéticas; suíte limpa ao final. HTTP exige QA isolado e TEST_BASE_URL correspondente; cria owner efêmero, não usar contra produção. Workflow inclui ambas, sem execução GitHub comprovada. D66 não criou migração; D67 acrescenta a 21, sem QA visual novo.

Próximo B11: resolução explícita e auditada de conflitos/identidades históricas e evidência independente para liquidação. Depois, custos e relatório financeiro com null honesto, coortes/moedas separadas e fórmulas exportadas neutralizadas. Preservar fatos originais e testar concorrência/rollback/permissões; ainda não liberar operação real.

## Estágio durável e confirmação — D67

POST /api/v1/admin/imports recebe text/csv com os mesmos limites da prévia. Além de owner/origem, exige Idempotency-Key UUID, X-Import-Source (provider_report ou manual_reconciliation), X-Import-Reference (código operacional com 3–96 caracteres minúsculos, letras/dígitos/hífen/sublinhado, começando com letra) e X-Import-Reason (missing_webhook ou report_reconciliation). Não usar nomes, emails, URLs, credenciais ou compradores como referência. A justificativa é controlada, sem texto livre nesta etapa.

Cada lote durável cobre uma única combinação de provedor/conta; prévia D66 continua aceitando mistura para diagnóstico. Separar relatórios de contas/provedores antes de estagiar. Isso vincula a fonte e limita a barreira de concorrência ao namespace afetado, sem remover nenhum provedor. Linha inválida recusa estágio inteiro antes do banco. Linhas válidas divergentes podem formar lote blocked, com razões preservadas e sem recibo comercial.

201 cria lote/linhas/auditoria atomicamente; 200 recupera o mesmo lote em repetição exata da chave, inclusive UUID em caixa diferente; conteúdo/metadados diferentes na mesma chave retornam 409. A chave é vinculada ao autor. Arquivo bruto/nome original não são armazenados. Normalizado, hashes/manifesto, avaliação, autor, fonte/referência/razão e datas permanecem privados. Ids e linhas são gerados no servidor.

POST /api/v1/admin/imports/{id}/commit exige JSON de até 4 KiB, cinco segundos de leitura, exatamente confirmed=true e planHash do lote durável. Owner/origem continuam obrigatórios; cliente não escolhe ator, valores, classificações ou resolução. Hash é conferência otimista, não credencial. Manifesto, whitelist/tipos e hashes das linhas são revalidados, assim como catálogo, projeção e inbox, incluindo eventos ainda pendentes/processing/failed/review.

202/queued significa recibos/auditorias e vínculos das linhas no mesmo commit, sem tocar na projeção. 200/confirmed significa que todos já eram compatíveis/duplicados e nenhum novo fato foi criado. Repetição de confirmação, inclusive UUID uppercase, retorna o estado já confirmado e registra a repetição sem reenfileirar. Aplicação depende do worker/CLI comerciais existentes. queued no lote/linha é estado da submissão, não monitor ao vivo da aplicação; consultar a inbox vinculada.

Se evidência ou catálogo mudaram, 409/stale registra invalidade sem enfileirar qualquer parte. Lote blocked/stale não é editado/reaberto pelo navegador: corrigir a origem do problema e estagiar novamente com outra chave para nova conferência. Conflito precisa de resolução futura, não de repetição cega. Item inesperado/manifesto alterado não passa só porque o cliente reenviou planHash.

Estados de lote: ready, blocked, stale, queued, confirmed. Estados de linha: planned, matched, duplicate, blocked, queued. Auditoria registra staged, queued, confirmed, stale e duplicate_commit com owner/data/motivo. Publicação nativa de fatos CSV identifica adapterVersion=csv-owner-snapshot-v1 e sourceEvent=csv_snapshot_*; não se faz passar por HMAC/webhook do fornecedor. Chave do fato deriva do snapshot normalizado e do namespace, não do lote/linha/autor, impedindo duplicação financeira entre relatórios.

Barreira PostgreSQL por provedor/conta antes dos demais locks é compartilhada com recepção/processamento/retry e alterações de oferta. Cobre apenas operação no banco, sem manter lock enquanto o humano confere. Contas diferentes seguem independentes. Medir latência e carga da conta antes do release, sobretudo no limite de dez mil linhas; teste local não comprova capacidade na VPS compartilhada.

Linhas e fila são gravadas por SQL parametrizado em blocos de 200, dentro da transação owner, após validação/manifesto. Esse caminho interno não é API genérica e não aceita JSON de fatos arbitrário. A auditoria final do lote participa do mesmo commit: falha reverte linhas/recibos/auditorias, inclusive blocos anteriores. Modelos/hashes/checks/FKs reforçam a integridade. Migração down recusa qualquer registro; rollback de código não deve apagar schema/evidências.

Sem flag/segredo novos. Reutilizar COMMERCIAL_EVENTS_ENABLED para processar, mantendo provedores de recepção/SMTP independentes. Sem envio externo, liquidação/custo ou resolução automática. Novas suítes: npm run test:commercial-imports e npm run test:commercial-imports-http, sempre com fixtures e banco loopback descartável/vazio de owner/histórico.
