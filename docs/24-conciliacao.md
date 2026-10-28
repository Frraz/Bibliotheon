# 24 — Conciliação comercial e CSV

[Índice](../README.md) · [Estado atual](23-estado-atual.md) · [Backlog](13-backlog.md)

## Estado vigente — revisão documental D129, 28/10/2026

Há implementação local de snapshot CSV, evidência complementar individual/JSON/CSV, associação de catálogo, decisão/aplicação financeira, ledger de liquidação/custos, prévia financeira, importação canônica e registro/correção de liquidações/custos pelo painel. P01–P05 possuem aceite local D86, incluindo as interfaces de resolução auditada. P06 continua parcial até confirmação da atribuição por conta; P07-A–E seguem abertos e a implementação restante aguarda política financeira/revisão por finalidade. A imagem e 16 HTTP atuais têm evidência local D127; H05 foi aceito localmente D126. A auditoria D128 registra 12 coleções comerciais sem retenção geral e os limites da seleção/exportação financeira. D100–D101 implementaram expurgo seletivo da auditoria comercial e da cópia de envelope da inbox, preservando o ledger normalizado e a revisão financeira posterior. Os contratos D66/D67 abaixo continuam válidos para snapshots; as seções seguintes registram a evolução e as limitações de cada etapa histórica. Nenhum formato nativo ou conta externa foi homologado. Ver [estado atual](23-estado-atual.md) e [pendências](../pendencias.md).

## Estado registrado na D67 — 24/10/2026

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

A rota não aceita JSON normalizado nem devolve autorização de importação. A confirmação D67 fica em endpoint separado, descrito abaixo; a UI D80 usa esses endpoints sem alterar o contrato. Não há upload em Media nem arquivo bruto persistido.

## Planilhas

Helper spreadsheetCSV escapa aspas/vírgulas/quebras e prefixa texto que poderia iniciar fórmula com apóstrofo, inclusive após espaços/controles. Números assinados seguros permanecem numéricos; ausentes permanecem vazios. Helper coberto por testes, sem download/UI de exportação implementados. É formato de apresentação para planilha, não conversor de fornecedor nem garantia de round-trip do arquivo canônico: o apóstrofo protetor pode fazer parte do texto reimportado.

## Validação e próximas entregas registradas na D67

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

## Associação histórica do catálogo — D70–D72

API e banco impedem novas identidades externas duplicadas. Legados ambíguos ou um cadastro único errado exigem decisão auditada, preservando ofertas, livros e fatos originais. `POST /api/v1/admin/catalog-resolutions/preview` recebe exatamente provider, accountKey, externalProductId, externalOfferId, action (`associate` ou `hold`), targetOfferId e targetEbookId. Identidades usam o namespace exato; UUIDs opcionais usam null. Associate exige destino conferido por oferta ou livro; hold exige destinos null. Oferta escolhida deve pertencer ao escopo e ao livro indicado. Não há fallback por preço/oferta primária.

`POST /api/v1/admin/catalog-resolutions` exige Idempotency-Key UUID e os campos anteriores acrescidos de planHash, sourceKind, sourceReference, reason, evidenceVerified e confirmed=true. Origem provider_report/manual_reconciliation e referência controlada de 3–96 caracteres; associate exige evidenceVerified=true e reason catalog_mapping_verified/historical_mapping_correction; hold exige evidenceVerified=false e evidence_inconclusive. JSON até 4 KiB/5 s, owner/origem exata; 201 novo, 200 repetição, 409 conflito/stale, 422 contrato/evidência inválidos.

Migração 23 cria catalog-resolutions privada/imutável e referência opcional nos novos fatos. Revisão, anterior, fonte, autoria e snapshot são preservados. Inbox/CSV consultam o vínculo efetivo, sem substituir referências históricas; decisão nova invalida lote antigo e não contorna revisão financeira. [Serviço e contrato tipado](../src/modules/commerce/catalog-resolutions.ts); [evidência local](../artifacts/catalog-resolutions/local-results.json).

## Componente financeiro e decisão — D73–D74

`POST /api/v1/admin/transaction-resolutions/preview` recebe provider, accountKey, externalTransactionId, action (`reconcile` ou `hold`) e selections. Cada seleção contém inboxId, envelopeHash e reason (`source_confirmed` ou `source_rejected`). O componente inclui todas as identidades/variantes relacionadas por colisão, fontes complementares e decisões anteriores. A escolha não pode resolver isoladamente dois lados da mesma evidência. A prévia é somente leitura e não concede autorização de mutação.

`POST /api/v1/admin/transaction-resolutions` acrescenta planHash, sourceKind, sourceReference, reason, evidenceVerified e confirmed=true, com Idempotency-Key UUID. Reconcile exige atestação e motivo provider_records_verified/incorrect_source_reconciled; hold exige evidence_inconclusive e atestação false. Owner/origem exata, JSON até 5 MiB/5 s, chaves estritas; 201 decisão nova, 200 repetição, 409 plano stale/evidência insuficiente/conflito, 422 contrato inválido. [Escolha e prévia tipadas](../src/modules/commerce/transaction-review.ts) e [decisão/aplicação](../src/modules/commerce/financial-resolutions.ts).

Migração 24 protege revisão de IDs secundários; migração 25 acrescenta financial-resolutions e financial-resolution-applications imutáveis. Decisão, aplicações, projeções efetivas e novos fatos elegíveis usam uma transação. Originais permanecem; autoria, fonte/motivo, cobertura e pais são preservados. Novo fato nativo limpo pode continuar decisão vigente; prova nova conflitante, mudança de catálogo ou união de componentes exige revisão. Worker/retry/CSV verificam a cobertura, sem limpar flags para contorná-la. Pagamento/reversão sem prova não é inferido da atestação. [Evidências](../artifacts/financial-resolutions/local-results.json).

## Evidência complementar canônica individual/JSON — D75–D76

`POST /api/v1/admin/report-evidence` recebe o [ReportEvidenceInput estrito](../src/modules/commerce/report-evidence-schema.ts): provedor/conta, IDs operacionais de transação/produto/oferta, kind, occurredAt, approvedAt, moeda, valores gross/refunded/chargeback/fees/producerNet em centavos ou null, refundBasis, externalRefundId, sourceKind/sourceReference/recordReference, evidenceVerified=true e replaces. Fonte/linha usam aliases controlados; cada substituição tem kind native/report e UUID id. Datas são ISO UTC; aprovação anterior precisa estar comprovada. Nenhum campo de comprador, documento bruto ou autenticação de fornecedor é aceito.

Identidade de prova é provedor/conta/fonte/referência/linha; repetição idêntica retorna a mesma prova, conflito exige nova referência e substituição explícita. Selecionar substituto exige excluir a fonte anterior na decisão; não somar ambos. Registrar prova altera cobertura e pode recolocar a projeção em revisão, sem criar evento nativo ou aplicar valores por si. A coleção commercial-report-evidence da migração 26 é privada/imutável; downgrade recusa evidência persistida.

Endpoint individual: até 64 KiB/5 s, 201 novo, 200 repetição, 409 conflito, 422 contrato/prova inválidos. `POST /api/v1/admin/report-evidence/batch` recebe exatamente `{records: [...]}` com 1–20 entradas, até 512 KiB/5 s. Locks ordenados, deduplicação por linha e transação integral: conflito/erro aborta tudo. Resposta informa applied=false. Ambos exigem owner/origem exata e cabeçalhos privados. [Serviços](../src/modules/commerce/report-evidence.ts) e [auditoria local P02](../artifacts/report-evidence/p02-audit.json).

## CSV de evidência complementar — D77

Contrato separado do snapshot, com cabeçalho exato de 18 colunas:

```csv
provider,account_key,transaction_id,product_id,offer_id,kind,occurred_at,approved_at,currency,gross_cents,refunded_cents,chargeback_cents,fees_cents,producer_net_cents,refund_basis,external_refund_id,record_reference,replaces
```

UTF-8 (BOM inicial opcional), vírgula/aspas CSV, máximo 512 KiB, 20 registros lógicos e 512 caracteres por célula. Um provedor/conta por lote. Kind usa os estados canônicos; datas UTC e valores inteiros seguem a prova individual. gross/refunded/chargeback não negativos; fees/producerNet podem ser assinados. Campos vazios são null. refund_basis é vazio/cumulative/operation; operação individual exige external_refund_id. record_reference é obrigatório; replaces contém lista JSON com kind/id ou `[]`. Aspas do JSON precisam do escape CSV. Não há settled_cents neste contrato: caixa usa a trilha D78.

`POST /api/v1/admin/report-evidence/imports/preview` exige text/csv, owner/origem exata e metadados X-Import-Source/Reference/Reason; reason deve ser report_reconciliation. Retorna prévia provisória, committable=false, linhas new/duplicate/conflict; linha inválida recusa o arquivo. Não grava lote/prova/projeção. `POST /api/v1/admin/report-evidence/imports` acrescenta Idempotency-Key UUID e persiste lote/linhas/auditoria D67 com kind=report_evidence, migração 27; 201 novo ou 200 repetição. Mesmo key com entrada diferente dá 409.

`POST /api/v1/admin/report-evidence/imports/{id}/commit` recebe exatamente confirmed=true e planHash do lote persistido, até 4 KiB/5 s. Revalida manifesto, fonte/substituições e plano sob barreira de conta. 201 registra novas provas, 200 repetição, 409 stale/blocked/conflito; falha reverte lote inteiro. Linhas novas passam a recorded; lote confirmed. Isso não é aplicação financeira nem webhook do provedor. [Parser](../src/modules/commerce/report-evidence-csv.ts), [serviço](../src/modules/commerce/report-evidence-imports.ts) e [checks D77](../artifacts/report-evidence/d77-checks.json).

## D78 — Ledger de recebimento, custos e relatório provisório — 25/10/2026

D78 implementa duas trilhas owner imutáveis. `POST /api/v1/admin/settlement-evidence` registra crédito/débito de uma liquidação conferida com referência explícita a uma transação já aprovada, provedor/conta/moeda e linha da fonte. A relação é uma alocação manual do movimento comprovado; bruto e `producerNetCents` não geram recebido. Identidade fonte/linha é idempotente; correção cria linha nova com `supersedes`. Transação não comprovada, em revisão ou de outra moeda é recusada.

`POST /api/v1/admin/financial-costs` registra custo confirmado ou estimado, categoria/moeda/período, fonte/linha e campanha opcional. Custos compartilhados permanecem sem atribuição; correções também são append-only. Coleções negam REST/CRUD nativo, SQL bloqueia alteração/apagamento e migração 28 impede downgrade se houver registros.

`POST /api/v1/admin/financial-report/preview` recebe período UTC inclusivo, até 366 dias, e moeda opcional. Retorna aprovações/coortes por `approvedAt`, movimentos líquidos por `settledAt`, custos por `incurredAt`, bruto, reversões, taxas, líquido informado e cobertura; transações pagas sem data de aprovação são explicitamente contadas à parte e ficam fora da janela. Períodos e fontes são separados; moedas não são convertidas. Totais de bruto, reversões e taxas só aparecem quando os valores exigidos cobrem todas as transações; cobertura parcial mantém o total null. Sobreposição reembolso/chargeback desconhecida também bloqueia o líquido após reversões. Ausência não vira zero. Resultado é `provisional=true`, sem escrita, atribuição de receita/campanha, ROAS ou decisão fiscal. Mesmo subtotal pré-impostos conhecido não é lucro; `marginComplete=false` porque tributos e componentes não estão completos. Limite de 10.000 registros e timeout SQL de cinco segundos evitam truncamento silencioso.

Validação local sintética: ciclo down/up transacional vazio, rollback, idempotência/conflito, correção por substituição, crédito/débito, recusa de prova sem transação, custos estimados/confirmados, moedas separadas, coorte e ausência de margem completa. Migração 28 foi aplicada no PostgreSQL local. HTTP owner/origem/MIME, coleções nativas, no-store, dados agregados e ausência de evento comercial passaram nas suítes sintéticas locais. P04/R16 seguem parciais; não há parser/exportação nativa, conta homologada, interface operacional, release final ou implantação.

## Interfaces owner e repetição segura — D79–D80

`/admin/financial-ledger` consulta D78 por período/moeda, com cobertura explícita e sem mutação. `/admin/commercial-imports` oferece os dois contratos canônicos, cabeçalho para download, prévia sem gravação e preparação/retomada de lotes. Os 20 mais recentes ficam na página; o histórico completo permanece no Payload. Cada lote pagina 50 linhas, abre valores/identidades/datas/substituições e mostra auditoria. GET não altera fatos.

O arquivo fica no formulário em memória; não se armazena CSV/nome livre em localStorage, Media ou logs. Alterar arquivo/metadados invalida a prévia e a tentativa. A preparação reutiliza a mesma Idempotency-Key enquanto os dados não mudam; perda de resposta não cria outra operação na mesma página. Após reload, retomar pelo histórico persistido. Confirmação exige checkbox e usa apenas id/planHash do lote salvo; resposta incerta pode ser repetida no mesmo lote. Blocked/stale explicam a causa e não oferecem confirmação.

Confirmação snapshot/queued é submissão à inbox; confirmação de evidência registra prova. Aplicação depende do processamento/decisão apropriados. Sem JavaScript, a leitura e os links de histórico funcionam e as ações ficam desabilitadas com aviso visível. [8 grupos e 24 capturas locais D80](../artifacts/qa-commercial-imports/results.json) cobrem três provedores, resposta perdida real após commit, stale real, bloqueio, erros, paginação e temas. P03/P04/P05 seguem parciais para cobertura completa e interfaces de resolução/registro operacional; H01–H06 permanecem abertos.

Este documento foi reconstituído na revisão D80 a partir do contrato snapshot da base Git e dos serviços atuais, preservando a seção D78 existente. A versão encontrada no worktree continha uma cópia de métricas em lugar dos contratos; a [revisão documental](18-validacao.md) registra a correção.

## Registro e correção de liquidações/custos — D81

`/admin/financial-records` oferece dois formulários owner para os contratos D78. O valor é informado em unidades da moeda, sem separador de milhar, com vírgula ou ponto decimal e até duas casas; a conversão a centavos usa BigInt e recusa sinal negativo, expoente, formato ambíguo ou overflow. Datas usam controle de data/hora explicitamente UTC e preservam segundos/milissegundos; calendários normalizados para outro dia são recusados. Campos ficam vazios quando não conferidos. Zero é entrada explícita, nunca preenchimento de ausência.

Conferir registro mostra o resumo sem gravar. Registrar dados conferidos exige checkbox e envia JSON estrito ao serviço existente. A aprovação/câmbio/elegibilidade da transação são verificações do servidor no registro, não promessas da etapa local. Erro mantém os dados. Timeout/abort do navegador não garante rollback: repetir a mesma fonte/linha é idempotente; entrada diferente na chave existente exige correção explícita.

Registro selecionado e histórico mostram valores, fontes/linhas, datas UTC, autoria/data de registro, vínculo de campanha e encadeamento de substituições. Correção mantém identidade, moeda e fonte, além de categoria/campanha para custo e referência de liquidação para caixa, conforme invariantes D78. Nova linha e supersedes substituem o efeito no cálculo sem apagar o original. Linha já substituída oferece acesso à sucessora; não outra correção do mesmo pai. Campo de campanha aceita qualquer UUID cadastrado; as 100 recentes são apenas sugestões, não limite do catálogo.

D81 corrige uma falha de persistência: campaignId chegava ao serviço, mas não era mapeado ao campo campaign da coleção. Novos custos/correções agora preservam o relacionamento real; o hash continua vinculado ao contrato de entrada. Não há backfill de registros anteriores nem mutação de dados reais nesta entrega. Há histórico filtrado por tipo/moeda, 20 linhas por página com desempate pelo ID; sem JavaScript, leitura/disclosures/filtros funcionam e a gravação permanece desabilitada.

A view reutiliza autenticação, endpoints e schema; o inventário continua em 28 migrations. Não aplica decisão financeira, autentica fonte externa ou cria compra/webhook. P03/P04/P05 continuam parciais para cobertura integral e resolução visual auditada; H01–H06 permanecem abertos.

## Interface de associação histórica — D82

`/admin/catalog-resolutions` expõe preview/commit D72 sem alterar seus contratos: escolha de namespace/destino, fonte/motivo, atestação e confirmação. Prévia é provisória e mostra revisão anterior e hash; alterações concorrentes impedem o registro pelo plano antigo. Repetição após resposta perdida usa mesmo envelope/UUID para obter a decisão existente, inclusive se outra revisão já existir. Voltar para editar descarta a prévia e exige nova conferência. Hold não atesta evidência nem atribui destino. Transações originais não são reescritas, e a decisão de identidade não aplica a decisão financeira D74.

Histórico por provedor em páginas de 20, com desempate por ID; detalhes de fonte/ator, escopo, destino, atestação, revisão anterior/sucessora e link para snapshot integral imutável. A prévia lista ofertas e pagina transações do snapshot de produto; o escopo efetivo continua explícito. GET e navegação sem JS são somente leitura; POST de confirmação exige sessão/origem owner. Nenhuma nova migration/flag/integração. P05 continua parcial pela resolução financeira e cobertura integral.

## Interface de decisão/aplicação financeira — D83

`/admin/financial-resolutions` expõe D73–D75: consulta de componente por prévia hold sem escrita, seleção explícita de variante/exclusão por fonte, prévia revalidada de todo o componente e confirmação conciliar/hold. Nenhuma seleção automática; fonte substituída deve ser excluída quando se confirma relatório substituto. Cobertura insuficiente, contradição, processamento ativo e catálogo pendente conservam bloqueios do servidor. UI não oferece confirmação de plano não processável.

Escolha, fonte/motivo/hash e UUID permanecem congelados para repetição idempotente após resposta perdida. Voltar para selecionar descarta a prévia; outra análise é obrigatória. Fontes novas podem exigir novas escolhas. Hold usa nenhuma seleção, evidenceVerified=false e evidence_inconclusive; não zera o último valor nem o torna comprovado. Aplicação usa a transação existente D74 e não edita envelopes/fatos originais; fatos elegíveis de fontes nativas já recebidas podem ser aplicados pela primeira vez.

Histórico privado de decisões (20), aplicações (10) e detalhe com pais/cabeças atuais; fontes/variantes/resultados paginam 20. Prova JSON autenticada preserva snapshot integral. Resultados na decisão e aplicações posteriores são apresentados separadamente, sem somar como vendas. Sem JS há leitura/filtros/detalhes e primeiros 20 itens por lista; JSON permite consulta completa, mas consulta nova/decisão exige JS. Sem schema/migration/flag nova, atribuição ou homologação externa. P03/P04/P05 continuam parciais até o aceite integrado/cobertura integral.

## Cobertura agregada e coortes — D84

A prévia mantém contratos de entrada D78 e acrescenta observedAt/coberturas calculadas. Abrange candidatas pagas ou em revisão com data na janela; revisão fica fora das somas, inclusive nas coortes. Candidatas sem data não são datadas por inferência. Caixa continua independente da data de aprovação e sua cobertura é por moeda, com revisão identificada. Não reintroduzir substituídos após filtro de período.

Taxa de reversão exige conhecimento do estado de toda a coorte e nenhuma revisão; valores ausentes não viram zero. Estado explícito de reembolso/chargeback permite contar a compra uma vez mesmo sem valor, conservando cobertura monetária desconhecida. Idade observada não homologa janela externa (windowVerified=false). Overflow de soma retorna null com motivo explícito, sem arredondamento. Detalhamentos e último processamento ainda faltam em P04; aceite integrado P05/P03 e homologação externa continuam abertos. Nenhum schema/migration/flag novo.

## Detalhamentos e processamento do relatório — D85

Resposta de prévia acrescenta dimensions: livros/provedores por moeda, custos por campanha, parcela sem atribuição e cobertura de processamento. Livro efetivo conferido prevalece; revisão ou metadado de caixa inconsistente deixa o livro desconhecido. Caixa é alocado pelo vínculo atual conferido, inclusive se aprovação estiver fora da janela, sem editar evidência original. Custos não são rateados entre livros/provedores.

Receita e quantidade atribuídas à campanha são null sem prova P06; vínculo de custo ou referência externa não bastam. lastSuccessfulProcessingAt usa lastSuccessAt existente, somente datas válidas não futuras, na população approval_window. Não substitui fonte, revisão, saúde global ou homologação. observedAt é consulta; títulos/códigos são rótulos atuais. Paginação server GET/disclosures funciona sem JS e não grava. Sem schema/migration/flag nova; 28 migrations.

## Aceite dos estados persistidos e operação integrada — D86

CSV complementar de 18 colunas teve sete estados persistidos/confirmados/aplicados para cada provedor (21 casos). Preview não grava; stage não aplica; confirmação registra prova e outra decisão explícita aplica. Repetição não duplica e conflito bloqueia. Seis provas insuficientes/incompatíveis persistem como fonte, mas decisão é recusada sem criar transação: aprovação ausente, reversão sem valor, estado/valor incompatível e dinheiro em kind incompatível. Ausência não vira zero.

Arquivo inválido, misto, futuro ou com layout não suportado é recusado antes de criar lote. Falha injetada na confirmação final, após registrar as provas, reverte toda a transação. Prova nova entre stage/commit marca stale; reestágio reconhece duplicata sem nova prova. Snapshot de 13 colunas permanece compatível e queued/reprocessável, sem confundi-lo com prova/caixa.

Jornada das cinco views verifica catálogo desconhecido bloqueando financeiro, associação auditada, sete decisões, recusa de liquidação pendente, caixa/custo independentes, relatório e reimportação sem duplicação. P03/P05 têm aceite local D86; P06/P07 e homologações/release continuam abertos. Nenhum campo, endpoint, schema/migration/flag novo ou conta externa usada.

## Referência de campanha consentida — D87

`/comprar/{offerId}` só acrescenta `sck=<checkout-clicks.id>` quando o clique é consentido, a campanha foi resolvida como ativa e a URL não contém `sck`. O registro do clique é criado antes do redirect; falha de medição mantém a URL validada e não cria uma referência. Saídas sem consentimento e sem campanha não recebem UUID. Parâmetros preexistentes são preservados e não recebem atribuição pelo Bibliotheon.

Hotmart normaliza `purchase.origin.sck`; Kiwify, `TrackingParameters.sck`; Cakto, `data.sck`. Todos passam por filtro estrito UUID antes de compor o envelope. Texto livre é descartado para evitar persistir origem pessoal arbitrária. O relatório procura o registro de saída pelo ID e exige `attributionAllowed`, campanha, provider/accountKey iguais, oferta/livro coincidentes e `approvedAt` no intervalo fechado `[click.occurredAt, click.occurredAt + 30 dias]`. Sem aprovação, em revisão, sem clique, janela vencida ou contexto divergente, mantém sem atribuição. Aprovação atribuída só informa receita líquida de reversões quando bruto/reembolso/chargeback estão completos; caixa, taxas, custo e lucro não são inferidos.

P06 ainda parcial: não há QA integrado dessa ligação no PostgreSQL/HTTP e o campo retornado Kiwify/Cakto carece de confirmação por conta; as páginas técnicas públicas Kiwify não abriram na consulta D87. Nenhum endpoint/schema/migration novo; continuam 28 migrations. [Fontes oficiais, achados e evidência local](../artifacts/attribution/p06-audit-d87.json).

## Fluxo HTTP sintético — D88

Sem mudança de schema/endpoint. Os testes locais conectaram saída e callbacks dos três provedores à projeção e prévia financeira. Hotmart cobriu referência correspondente/replay, contexto incompatível, texto livre e ausência; Kiwify/Cakto validaram os campos de fixture e replay. O clique precisa ter consentimento gravado; receita continua null sem cobertura de estorno/chargeback. Esses testes validam o código e os formatos sintéticos, não o retorno das contas, especialmente Kiwify/Cakto. [Auditoria P06](../artifacts/attribution/p06-audit-d88.json); homologar H01 separadamente.
