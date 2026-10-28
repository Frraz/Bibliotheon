# 15 — Qualidade e homologação

[Índice](../README.md) · [Requisitos](02-requisitos.md)

## Camadas

Documentação: verificador Python sem dependências. Código existente: TypeScript strict, lint sem autofix, Vitest para regras, PostgreSQL de teste para constraints/transações e Playwright para jornadas. axe como apoio à acessibilidade, complementado por teclado e leitura visual. Fixtures sintéticas e relógio controlado para cronologia, expiração e coortes. Estado/evidência de cada requisito no [mapa atual](23-estado-atual.md); a matriz abaixo continua sendo o aceite do produto completo, não uma lista de testes todos aprovados.

CI alvo: instalar com lockfile → lint/typecheck → testes unitários/integração → build → testes de navegador → imagem. O workflow existente prepara geração/diff de tipos/import map, documentação, estáticos/unitários, migrations, catálogo/mídia/marketing/sequências/lotes/bloqueios outbound/preflight/cadastros/listas, build e testes HTTP de acesso/site/recuperação. Ainda não executa QA browser nem build/homologação de imagem; nenhuma execução no GitHub comprovada. Nenhuma credencial de produção em PR. Antes do release, testar migrations atuais de banco vazio e versão anterior. Revisão só documental roda o verificador, sem exigir subir aplicação ou Docker para isso.

## Matriz de cenários

QA administrativa D79–D80 usa `check:qa-financial-ledger` e `check:qa-commercial-imports` sobre build `.next-qa` e banco sintético exclusivo, conforme [execução local](20-execucao-local.md). A importação cobre acesso anônimo/API, prévia sem persistência, invalidação de entrada, resposta perdida após stage/commit, retomada após reload, três provedores, evidência sem fato nativo, bloqueio, stale real, erro/tamanho, paginação, teclado e fallback sem JS. São 8 grupos e 24 capturas; 23 recebem axe e a captura sem JS tem leitura/ação desabilitada verificadas à parte. Inclui claro/escuro, 320–1920 px, loading, erro e texto 200%. Na ampliação, a verificação também recusa entrelinha computada menor que a fonte; a inspeção visual detectou a necessidade de corrigir o line-height fixo herdado do admin. [Resultados](../artifacts/qa-commercial-imports/results.json). O recorte não conclui zoom nativo 400%, matriz integral, imagem ou conta externa.

| Teste | Requisitos | Cenário e resultado esperado |
|---|---|---|
| T01 | R01 | Anônimo tenta REST/GraphQL/preview/admin: sem acesso privado; owner autorizado |
| T02 | R02, R05 | Rascunho, livro em produção e oferta incompleta não habilitam compra; única primária no banco |

| T03 | R03, R07 | Busca com acentos, filtro vazio, paginação, canonical e sitemap de publicados |
| T04 | R04, R20 | LP 360/768/1280/1920px, teclado, foco, contraste e FAQ; preço legível e amostra real |
| T05 | R06 | Oferta inativa retorna indisponível; URL arbitrária rejeitada; afiliado mantém destino/parâmetros |
| T06 | R08, R09 | Pedido sem marketing entrega amostra após confirmação; duplicata não revela contato; token expirado falha |
| T07 | R09, R10 | Descadastro com envio na fila bloqueia marketing; amostra solicitada permanece independente; bounce/complaint cancelam pendentes; referência de supressão idempotente/conflitante, quota, timeout e retentativa tratados; lotes separam revisão/contexto, deduplicam destinatários e revertem vínculos/quota em falha; fila de bloqueios preserva intenção em rollback/queda/revisão concorrente e não reativa contatos; preflight importa bloqueio sem inferir motivo e exige prova fresca/versionada antes da quota; cadastro requer opt-in confirmado, reconcilia conflito/timeout e mantém compensação após descadastro em voo; listas retêm ID/intenção, conferem conjunto e limite 150, sem reincluir tentativa incerta ou presumir preferências ausentes; preferências temáticas isolam titular, cancelam somente o tema e revertem auditoria/calendário juntos; links individuais preservam expiração, são confirmados por GET e recusam divergência de titular/ID; rascunho retém intenção/IDs, reconcilia sem recriação incerta, recusa cópia/lista/estado divergentes e não agenda/envia; transporte grava intenção/quota atomicamente, não duplica por concorrência/timeout, só refaz recusa explícita com nova reserva e não reativa descadastro |
| T08 | R11, R26 | Recusa de analytics impede ID/cookie; compra funciona; revogação interrompe coleta |
| T09 | R12 | Hotmart válido/inválido, replay, reembolso antecipado e produto desconhecido |
| T10 | R13 | Kiwify válido/adulterado, dinheiro/unidade, replay e ordem invertida |
| T11 | R14 | Cakto válido/inválido; Pix não é aprovação; reversão e reenvio |
| T12 | R15 | CSV repetido não duplica; conflito exige decisão; fórmula exportada neutralizada |
| T13 | R16 | Receita com custos null fica incompleta; liquidação não é aprovação; coortes e fuso consistentes |
| T14 | R17, R18 | Campanha com kit e conteúdo público autorizado; sem conteúdo pago exposto |
| T15 | R19 | Revisão contém decisão baseada em evidência e próxima ação, mesmo com zero vendas |
| T16 | R21 | Build de produção medido em ambiente identificado; laboratório não é resultado de campo |
| T17 | R22 | Upload inválido/oversized/path traversal rejeitado; substituição recusada preserva arquivo anterior, incluindo mídia não vinculada a amostra, hooks tardios e rollback; coleta espera lock, respeita referências/carência e ignora symlinks; logs sem email/token/corpo |
| T18 | R23 | Apenas proxy acessível publicamente; DB privado; baseline de sistemas existentes preservado |
| T19 | R24 | Restaurar banco/mídia fora da produção; medir RPO/RTO; impedir envio de e-mails no restore |
| T20 | R25 | Queda após persistir inbox recupera pendência; ACK sem commit impossível; owner consulta o resumo, filtra e reprocessa com auditoria, foco e feedback persistentes, sem alterar envelope ou tratar evento como venda |
| T21 | R26 | Retenção/exclusão removem dados previstos e reaplicam supressão após restore |

P07 D90: `test:preferences` valida exportação owner-only, origem exata, verificação declarada, resposta no-store/no-referrer, exclusão de hashes e auditoria HMAC sem email em PostgreSQL sintético. Evidência [local](../artifacts/privacy-export/local-results.json). Não cobre pedido real, identidade verificada por provedor, correção/exclusão, volume operacional ou restauração.

P07 D91: `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-retention` cobre preview sem escrita, cutoff UTC de 24 meses, expurgo seletivo, repetição idempotente e preservação de auditoria recente. [Evidência](../artifacts/privacy-retention/local-results.json). Não equivale a revisão jurídica da política nem a operação com dados reais.

P07 D93: `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-delete` verifica remoção local/tombstone e bloqueio `pending` que preserva contato/outbox diante de entrega `uncertain`. [Evidência](../artifacts/privacy-delete/d93-results.json). A suíte não homologa API/conta Brevo, restauração, volume de produção ou política jurídica.

P07 D94: `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:http -- --only privacy-delete-http` verifica autorização owner, origem exata, confirmação, cabeçalhos privados, resposta sem email, repetição e bloqueio `pending` via HTTP no build standalone com PostgreSQL sintético. [Evidência](../artifacts/privacy-delete/http-results.json). Não equivale a homologação externa ou prova de restauração.

P07 D95–D96: `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-correct` verifica correção de endereço com relações locais, preservação dos eventos de consentimento, revogação de pedidos não confirmados, cancelamento do outbox de confirmação ainda pendente, replay, tombstone do endereço anterior e bloqueio sem efeitos quando o envio está `uncertain`. [Evidência](../artifacts/privacy-correct/local-results.json). Não homologa sincronização do novo endereço nem exclusão no Brevo; identidades externas permanecem em `pending`.

## Critérios de release

Sem falha crítica de autenticação, exposição de dados, duplicação financeira ou perda de eventos conhecida. Fluxo ponta a ponta do conteúdo ao checkout testado. Cada provedor tem evidência externa própria; teste sintético não a substitui. Monitoramento e procedimento de falha documentados. Backup/restauração são opcionais conforme decisão do proprietário: homologar recuperação se escolhida; `--sem-backup` permite deploy sem ponto recente de restauração.

Metas de desempenho dos requisitos são objetivos. Medir com dataset inicial de 30 livros/3 temas, 30 artigos e volume sintético de eventos suficiente para identificar queries lentas; não interpretar isso como capacidade de produção. Fazer teste de carga somente em ambiente isolado, começando com 5 usuários simultâneos e incrementando com medição, sem pressionar outros sistemas da VPS.

## Evidência

Registrar data, ambiente, versões, cenário, entrada sintética, resultado e artefato. Screenshots sem PII. Resultado pode ser passou/falhou/bloqueado; bloqueado nunca vira passou por ausência de acesso. Relatório documental fica separado em [validação](18-validacao.md).

## Cenários de design

| Teste | Requisitos | Cenário e resultado esperado |
|---|---|---|
| T22 | R27 | Fontes carregadas/falhas, títulos longos e identidade consistente; fallback sem quebra |
| T23 | R28 | Claro/escuro/system, reload, troca SO, storage negado; sem flash e sem alterar conteúdo |
| T24 | R29 | Matriz de componentes com foco/hover/disabled/erro/loading em dois temas; contraste funcional |
| T25 | R30 | Três variantes, acentos válidos/inválidos, capa ausente e campanha afiliada; destino intacto |
| T26 | R31 | 360/390/768/1024/1440/1920px, 320px/reflow, zoom e teclado mobile; sem sobreposição |
| T27 | R32 | Motion padrão e reduzido, JS lento/desligado; texto e CTA sempre disponíveis |
| T28 | R33 | CRUD, contatos, relatórios e integrações no Payload nos dois temas; null financeiro honesto |
| T29 | R34 | Home 0/1/3/20 livros, LP completa e demais telas com screenshots e crítica documentada |

Ver [matriz detalhada](design/07-qualidade.md). Alvo de acessibilidade WCAG 2.2 AA; axe apoia, não certifica. Cálculos sRGB são evidência documental, não resultado de teste renderizado. As rodadas B20 são registradas por fase e não bloqueiam a escrita de documentos enquanto não existir aplicação.


D56 acrescenta npm run test:brevo-send ao workflow sequencial: transporte HTTP e histórico, migração/índice, rollback antes de POST e falha de retorno depois de HTTP, reserva transacional/mudança UTC, recusa/retry, consentimento, lease e seleção do worker. Estados de solicitação não valem como entrega. CLI habilitado é exercitado com fetch integralmente interceptado; worker --once com fila vazia e rede bloqueada. Homologação real de recebimento, webhook e conciliação não é substituída por esses testes.


## Observação de campanhas (D57)

npm run test:brevo-observation usa banco loopback e HTTP sintético, incluindo CLI/worker empacotados. Verificar nove estados nativos por GET, identidade completa, tamanho/timeout e descarte de estatísticas; campanha incerta observada sem inventar 204/entrega ou liberar quota; monotonicidade de prova; ausência/conflito sem resend; lease contra retry, ACK tardio, rollback/recovery e backfill/down guardado. Contato/consentimento permanecem iguais após observação. Rotina desativada não abre banco; worker somente observador com SMTP/envio/cadastro desligados. Fluxos completos de eventos por destinatário/webhook e conta real continuam separados e pendentes.


## Callback e resultados por destinatário (D58)

npm run test:brevo-webhook: banco loopback, Brevo HTTP interceptado, CLI sem rede. Conferir deduplicação concorrente independente de ID isolado, envelope mínimo, dados fora de ordem, desconhecido em quarentena, identidade histórica e legado sem backfill, retirada/bounce/reclamação sem reativação, amostra independente, rollback atômico, lease contra retry, replay sem rede e guards das migrações17/18. Suítes de migração15/14 revertem dependências18/17 antes; backfill16 pode ser exercitado com17/18 preservadas, sem apagar identidades emitidas.

npm run test:brevo-webhook-http exige QA loopback configurado com token w repetido64 e segredo de evento v repetido64, explicitamente sintéticos, SMTP/envio/worker desligados. Não executar contra operação real. Validar autenticação, ACK só após persistência/supressão, retries concorrentes, limites/tempos/métodos e ausência de PII no retorno/envelope. Workflow inclui as duas suítes sequenciais; CI preparado não significa execução no GitHub.


## Medição consentida — D59

npm run test:analytics usa banco local vazio de analytics e fixtures sintéticas. Exercita migração 19/down guard, ausência de ID antes de aceite, deduplicação concorrente, sessão de 30 minutos inativa, first-touch direto/último não direto em 30 dias, UTMs cadastradas, saída sem/ com consentimento, revogação e novo aceite, rollback, APIs privadas, limite real de 60 eventos e falha de gravação que preserva o checkout. Não equivale a evento de compra.

npm run test:analytics-http exige QA com ANALYTICS_ENABLED=true, institucional sintético revisado e hosts sintéticos de checkout. Verifica origem/tipo de entrada, cookie __Host/HttpOnly/Secure, dedup, revogação, coleções privadas, URL externa intacta, HEAD/prefetch ignorados e fallback de formulário sem JS. Nenhum checkout externo é seguido. scripts/qa-analytics.ts cobre claro/escuro, seis larguras, aceitar/rejeitar/revogar por teclado, foco restaurado, rotas sensíveis sem coleta, fallback sem JavaScript, dashboard e link de campanha, com axe/overflow e telas.

Executar todas as fixtures sequencialmente; seedAnalytics recusa dados analíticos prévios e só limpa após assumir base vazia. Seed de site limpa saídas/páginas que referenciem ofertas/livros sintéticos próprios, sem apagar sessões reais por conveniência. Resultados medidos são limitados às telas/fluxos registrados; não homologam release integral ou privacidade jurídica.


## Evidência comercial D61

Doze grupos em npm run test:commercial-inbox: receiver só confirma commit; dedup/colisão/conservação de projeção; catálogo exato; três fixtures internas por provedor; histórico temporal; retry owner/origem/motivo; lease/hash/futuro; exaustão/backoff; rollback final; permissões/down guard; CLI/worker empacotados com contador de fetch zero. [Resultados](../artifacts/commercial-inbox/local-results.json) e [resumo do release local](../artifacts/commercial-inbox/release-checks.json). Não é homologação de payload/autenticação nativos.

Regressões de catálogo/analytics/transporte e HTTP de acesso/site passaram na revisão D61; 99 unitários/33 testes simulados do atualizador, tipos/lint, build isolado e Compose aprovados. Sem QA visual novo; testes/screenshot de D59 permanecem fotografia daquele estágio. Cenários comerciais completos dos três conectores, atribuição, CSV/liquidação, retenção, recuperação e release continuam abertos.


## Evidência do acompanhamento D62

[Quatro grupos locais](../artifacts/commercial-admin/local-results.json): acesso owner, resumo/datas/vazio, atenção, seleção mínima, filtros/paginação/UUID e GET sem efeitos. Regressão da inbox 12 e 104 unitários passaram. [46 capturas](../artifacts/qa-commercial-admin/results.json) com axe nas 45 com JS, sem violações/overflow/runtime errors e sem tentativas HTTP externas. Retry 202/auditoria real local; erros de formulário interceptados, teclado/foco, feedback persistente, detalhe readonly e no-JS próprios. [Resumo](../artifacts/commercial-admin/release-checks.json).

Falha inicial de target-size foi corrigida no produto, com screenshot anterior preservado. Ajustes de seletores/frames/noscript do harness foram registrados separadamente, com repetição final completa. Não assumir que toda falha de ferramenta é defeito da UI. Sem homologação nativa dos provedores, integral de B20 ou operação real; próximos testes seguem contratos de B08–B12.


## Evidência Hotmart D63

[Sete grupos nativos locais](../artifacts/hotmart/local-results.json), [quatro HTTP](../artifacts/hotmart/http-results.json), 122 unitários e 35 testes simulados de deploy. Header/conta, JSON limitado/deadline, lexema monetário exato, data original/criação, partial/COMPLETE/chargeback, unknowns, rollback, duplicata/colisão, revisão e ausência de PII cobertos. Regressões inbox/painel/catálogo/HTTP aprovadas. [Resumo](../artifacts/hotmart/release-checks.json). Não comprova conta, checkout, entrega, relatório, retry externo ou elegibilidade; checklist do [conector](integracoes/hotmart.md) continua pendente.

D63 não adicionou telas/QA visual; ajuda de cadastro/causas usa apresentação existente. Capturas D62 permanecem fotografia daquele estágio. Workflow preparado, sem alegar execução GitHub; imagem/upgrade/banco vazio/restore atuais ainda precisam de evidência antes do release.

## Kiwify nativa — D64

npm test cobre vetor HMAC oficial, adulteração de bytes, rotação, conta, assinatura única na query, JSON numérico exato em centavos, dados pessoais descartados, datas de Brasília/DST e cronologia, status, área de membros versus assinatura e eventos ignorados. Handler limita MIME/encoding/tamanho/tempo e valida assinatura/schema antes da fábrica Payload.

npm run test:kiwify usa PostgreSQL loopback e fixtures sintéticas: ACK após commit, concorrência, chegada invertida, colisão, rollback, retry de catálogo, conta separada e revisão temporal sem destruir projeção anterior. npm run test:kiwify-http exige servidor QA isolado com configuração sintética das fixtures. Workflow inclui ambas sequencialmente; não há execução GitHub comprovada. Complementar com regressões Hotmart e inbox comum. Homologação real de campos, datas, taxa/relatório, assinatura e reenvios continua pendente.

## Cakto e batch comercial — D65

npm test cobre HMAC padrão/bytes/timestamp, rotação, versões simultâneas de assinatura, limite temporal nos dois sentidos, números decimais exatos, ISO/cronologia, Pix/MED/reversões, formatos especiais, V2 e descarte de PII. npm run test:cakto exige PostgreSQL loopback vazio de owner/histórico: concorrência em ordem invertida, rollback na segunda auditoria, item inválido sem persistência parcial, dois conflitos concorrentes de transações aplicadas, lote misto, reembolso antecipado, catálogo/retry, conta separada e limpeza.

npm run test:cakto-http exige QA isolado com segredo sintético das fixtures, SMTP/worker desligados; validar rota real e regressões HTTP Hotmart/Kiwify após a extensão comum. Workflow inclui suítes sequenciais; sem execução GitHub comprovada. Tipos/lint/build/Compose e testes do atualizador complementam a evidência. Não declarar rodada visual nova por atualizar motivo textual de revisão. Conta, teste oficial, relatório/reenvio e MED efetivos continuam a homologar.

## Prévia CSV somente de leitura — D66

npm test cobre CSV/BOM/quotes/UTF-8, cinco MiB/dez mil registros, campo/colunas limitados, inteiros seguros sem coerção/rounding, zero/null, UTC/calendário, erro sem PII, dedupe linear, conflitos, catálogo e fórmulas em planilhas. Handler exige owner/origem antes da leitura, MIME/charset/encoding/limites e timeout.

npm run test:commercial-csv usa PostgreSQL loopback para comparar três provedores, duplicata/conflito, catálogo desconhecido/ambíguo, lacunas/liquidação e revisão existente; snapshots de todas as tabelas comerciais devem permanecer idênticos. Autenticação Payload/JWT real no handler. npm run test:commercial-csv-http usa QA isolado e owner/arquivo sintéticos para rota real, permissões/origem, erros/limites, 201 identidades em blocos e ausência de escrita. Cleanup ao final e workflow sequencial preparado; sem execução GitHub comprovada. Sem QA visual novo: não há interface de importação. Confirmação, concorrência de commit, fonte/auditoria e financeiro seguem sem aceite.

## Lotes/confirmação auditada — D67

npm run test:commercial-imports: PostgreSQL loopback com actor/CSV sintéticos, migração 21 up/down vazia em rollback e down recusado com registros; stage concorrente/idempotente, conteúdo diferente na chave, UUID upper/lower; fila separada da aplicação, snapshot compatível sem fato novo; inbox/catálogo alterados invalidam plano; whitelist/manifesto contra adulteração; auditoria com rollback integral de 201 linhas; recepção concorrente aguarda barreira e permanece durável; três provedores e permissões de modelos. Cleanup inclui import-audit/rows/batches antes do ledger/owner.

npm run test:commercial-imports-http: rotas reais, JWT/origem, metadados/linha inválidos, 201/202/200/409/404, repetição, vínculos e processo explícito da fila; REST das três coleções readonly owner. Regressão da prévia HTTP e integrações de inbox/provedores/catálogo/painel. Suíte de migração 20 reverte/recria dependência 21 antes do ensaio; permissões com registros do ledger permanecem na fixture antiga e importações têm fixture própria. Sem CI GitHub executado ou QA visual novo. UI customizada, resolução, financeiro e limites sob carga de produção seguem abertos.

## Ferramentas locais e CI — D69

Manutenção de scripts verificada por tests/ops/test_local_dev.py: identidade reciclada/checkout divergente não recebem sinais; encerramento alcança a árvore criada; servidor/registro legado impedem adoção e parada do banco; início idempotente não repete migrations; falha de início limpa processo/estado e preserva banco. As fixtures usam diretórios e processos efêmeros, sem Docker/Next/banco reais. Testam ainda wrappers a partir de outro diretório, cobertura única das suítes declaradas no manifesto e confirmação de ambiente descartável.

Harness HTTP executado em checkout temporário com comandos/servidor sintéticos: falha de saúde impede testes; falha de suíte interrompe a sequência; sucesso executa a lista completa; processo encerrado em todos esses caminhos. Isso testa orquestração, não substitui executar contratos HTTP da aplicação. Workflow separado em checks e integração sequencial, conferido por parser YAML e sintaxe Bash; execução real no GitHub permanece pendente.

## Identidade histórica — D72

Acrescentar aos cenários T02/T12/T20: duplicidade nova bloqueada na API/SQL; ambiguidade legada preservada; prévia/decisão owner com origem exata, fonte e justificativa; concorrência/idempotência/rollback; correção por oferta ou diretamente por livro sem duplicar cadastro; hold sem fallback; camada efetiva sem editar envelope/referências originais; vínculo da decisão nos novos fatos; alteração da revisão invalida lote pronto; decisões não removem colisão nem substituem evidência financeira insuficiente. Comandos test:catalog-identities, test:catalog-identity-db, test:catalog-resolutions e test:catalog-resolutions-http, em ambiente sintético exclusivo. QA customizada de UI permanece em P05/B19/B20.


## Colisão que muda o ID da transação — D73

T12/T20 passam a cobrir os dois lados da chave compartilhada, inclusive novo ID ainda sem projeção, outro evento limpo do segundo ID e cadeia A–B–C. Provar quarentena em worker/retry/CSV, reparo de flag legada, corrida entre colisão e aplicação, hash de fonte, namespace dos três provedores/contas e ausência de escrita na prévia READ ONLY. Simulação nunca recebe committable=true nesta etapa. Fixtures devem conferir erros de bulk delete e preservar backup institucional privado até concluir cleanup; não chamar isso de backup de produção. Testes: test:transaction-review e test:transaction-review-http.

## Decisão financeira por componente — D74

T12/T20 incluem decisão/aplicação atômica, falha tardia com rollback integral, chave idempotente em concorrência, plano stale, referências originais/efetivas, continuidade por reembolso nativo e conflito posterior. Cobrir união de componentes/pais e confirmações concorrentes, guarda SQL/API de provas, down/up vazio e recusa de downgrade com evidência. CSV deve comparar projeção efetiva e revalidar vigência ao confirmar. Comandos: test:financial-resolutions e test:financial-resolutions-http, adicionados aos runners sequenciais; usar somente banco sintético exclusivo. Sem declaração de homologação nativa, recebimento, margem ou QA visual.

## Prova complementar — D75

test:report-evidence cobre down/up vazio, imutabilidade/downgrade, deduplicação concorrente e conflito de linha, fonte incompleta, IDs corrigidos, exclusão obrigatória e sobreposição de substituições, rollback, quarentena anterior à primeira projeção/decisão, CSV/lote stale, continuidade nativa e correções de moeda/valor/data/estado sem alterar fatos. test:report-evidence-http cobre owner/origem/MIME/contrato, resposta privada, provas insuficientes e confirmações reais da rota, sem criar fato/recibo nativo. Ambos entram nos runners sequenciais; somente ambiente sintético exclusivo. Unitários verificam preservação de null, provas combinadas e hashes após serialização JSONB.

## Registros financeiros — D81

`tests/unit/ledger-entry.test.ts` cobre 22 cenários de entrada monetária/data: limite inteiro seguro, zero, round-trip sem arredondamento, rejeição de milhar/expoente/sinais/overflow, calendário e UTC com milissegundos. `check:qa-financial-records` usa o harness administrativo isolado e banco exclusivo: aprovação/moeda, resposta perdida depois de gravar, correções vigentes, campanha persistida, estimado/confirmado, crédito/débito, três provedores/moedas, zero explícito, erros sem gravação, permissão por API, história paginada com instantes iguais, fallback sem JS e matriz visual dos dois formulários. A conferência local não substitui a validação no servidor.

Evidência D81: [jornada completa](../artifacts/qa-financial-records/results.json) com seis grupos/40 capturas e [complemento `--zoom`](../artifacts/qa-financial-records/zoom-results.json) com oito capturas dos formulários/conferências em 320px/texto 200%. São 47 análises axe; fallback sem JS é verificado separadamente. O complemento verifica valores/IDs nos limites sem gravar e não reexecuta nem substitui o fluxo financeiro.

## Resolução de identidade no painel — D82

`check:qa-catalog-resolutions` usa build isolado e banco sintético exclusivo. [Seis grupos/29 capturas](../artifacts/qa-catalog-resolutions/results.json), 28 com axe: prévia sem escrita, voltar preservando campos, confirmação por teclado, resposta perdida após commit, repetição idempotente, associação/hold com fonte/atestação, anterior/sucessora, três namespaces, destino inexistente ou de outro escopo, stale concorrente, snapshot 20+1 e histórico 20+2 com datas iguais, filtro e leitura sem JS. Também cobre 14 combinações tema/largura de 320–1920px e formulário/conferência com texto 200%/IDs longos. Detalhe em ambos os temas, loading/erro/sucesso, permissões por API e projeções originais preservadas.

Axe identificou alvos pequenos no detalhe; botões e links foram corrigidos e a suíte integral repetida sobre o build final, sem violações/overflow/runtime. Check geral D82: 247 unitários/31 arquivos, 61 operacionais, tipos e lint sem erros (dois avisos históricos). Não conclui resolução financeira visual, matriz integral, zoom nativo 400%, homologação externa ou release da imagem.

## Resolução financeira visual — D83

`check:qa-financial-resolutions` testa os endpoints reais existentes pelo navegador com banco sintético: ausência de seleção automática, prova contraditória bloqueada, exclusões explícitas, conciliação/hold com fontes/atestação, resposta perdida após gravação e repetição idempotente, stale concorrente e nova prévia. Confere fatos originais, três namespaces/moedas, relatório substituto com exclusão obrigatória, 11 reembolsos posteriores via worker, aplicações em páginas 10+2 e fontes 20+1 conservando escolhas/cobertura. Sem JS há histórico/detalhe e prova JSON integral, com consulta/registro desabilitados. Seleção/prévia/detalhe são renderizados nos temas e texto ampliado; a QA também rejeita entrelinha computada menor que a fonte para impedir sobreposição de rótulos em 200%.

Quatro testes novos em ledger-entry cobrem -1/-99/-101 centavos e limite negativo seguro, sem arredondamento. Os 22 cenários positivos/de entrada anteriores continuam válidos. A função de exibição passa a suportar sinal negativo; entrada de liquidação/custo continua não negativa, com direção de caixa separada.

Evidência D83: [sete grupos/34 capturas](../artifacts/qa-financial-resolutions/results.json), 33 com axe sem violações; runtime/overflow/tentativas externas zerados. [Checks e limitações](../artifacts/qa-financial-resolutions/release-checks.json). Check geral: 251 unitários/31 arquivos, 61 operacionais, tipos e lint sem erros, com dois avisos históricos. Fix de entrelinha teve rodada integral final sobre build atualizado; fixtures limpas e banco parado preservando volume. P03/P04/P05 e B20 integrais continuam abertos.

## Cobertura financeira — D84

`financial-report-cohort.test.ts` acrescenta sete testes de população em revisão, taxa desconhecida/zero, não duplicação de reversão, status sem valor, idade sem prazo presumido, população vazia e overflow seguro. `test:financial-coverage` acrescenta [cinco grupos PostgreSQL](../artifacts/financial-coverage/local-results.json) no runner sequencial, cobrindo também queries reais de estado unknown/datas ausentes, moedas/janelas, correção fora do período, custos zero/ausência, overflow assinado e ausência de escrita. financial-ledger mantém seus três grupos de regressão aprovados.

[QA D84](../artifacts/qa-financial-coverage/results.json): quatro grupos/21 capturas, 20 com axe; POST real, cobertura por moeda, revisão/limite, tabela/filtro/teclado, dois temas/320–1920px, texto 200% com entrelinha proporcional e filtro/leitura sem JS. Zero runtime, overflow da página ou tentativas externas. Tipos/lint sem erros, 258 unitários/32 arquivos e 61 operacionais. [Auditoria de aceite restante](../artifacts/financial-coverage/acceptance-audit-d84.json) distingue evidência local de requisitos incompletos; não conclui P03/P04/P05, B20 integral ou homologação externa.

## Detalhamentos e processamento — D85

`financial-report-dimensions.test.ts` acrescenta seis cenários de livro efetivo, revisão/alocação desconhecida, caixa fora da janela, custos sem inferência, processamento real versus datas ausentes/inválidas/futuras e null/zero/overflow. `test:financial-dimensions` cobre [quatro grupos PostgreSQL](../artifacts/financial-dimensions/local-results.json), incluindo escrita de lastSuccessAt pelo processador real, namespaces, rótulos, campos efetivos/originais, clique sem atribuição e leitura sem escrita. Runner sequencial atualizado; cinco grupos financial-coverage reexecutados com [cópia D85](../artifacts/financial-dimensions/coverage-regression-results.json).

[QA final](../artifacts/qa-financial-dimensions/results.json): quatro grupos/25 capturas distintas/24 análises axe, POST real privado, 20+1 grupos de livro, disclosure/paginador server/filtros, temas/320–1920px, texto 200% e sem JS. Zero overflow/runtime/tentativas externas. Tipos/lint sem erros, 264 unitários/33 arquivos e 61 operacionais. [Aceite local P04](../artifacts/financial-dimensions/p04-audit-d85.json) não conclui P03/P05/P06, matriz B20 integral ou release/homologação.

## Estados persistidos e jornada conjunta — D86

`test:commercial-state-matrix` verifica [seis grupos/27 casos](../artifacts/commercial-state-matrix/local-results.json) em PostgreSQL: 21 estados/provedores persistidos e aplicados explicitamente, seis provas recusadas sem transação, preview/stage/commit, chaves/repetição/conflito, arquivos inválidos, rollback tardio, stale e snapshot compatível. Teste de planilha neutralizada continua em commercial-csv.test.ts.

`check:qa-commercial-operation` verifica [seis grupos/22 capturas/21 análises axe](../artifacts/qa-commercial-operation/results.json), ligando as cinco views, sete estados, catálogo, fonte/atestação, caixa/custo, relatório e repetição. Anônimo recusado, resultado nos dois temas e sem JS; zero runtime/overflow/tentativas externas. Aceites [P03](../artifacts/commercial-state-matrix/p03-audit-d86.json) e [P05](../artifacts/qa-commercial-operation/p05-audit-d86.json) são locais; matriz B20 integral/performance e homologações continuam abertas. Build D85 reutilizado com fontes conferidas; 264 unitários/33 arquivos e 61 operacionais, tipos/lint sem erros (dois avisos históricos).

## Atribuição HTTP sintética — D88

Quatro suítes loopback exercitam checkout analítico e callback Hotmart/Kiwify/Cakto com PostgreSQL e payloads sintéticos. A jornada Hotmart liga consentimento, clique, `sck`, inbox, projeção e relatório; verifica replay, contexto divergente, texto livre, referência ausente e cobertura financeira incompleta. Kiwify/Cakto verificam replay e vínculo usando os campos `TrackingParameters.sck`/`data.sck` dos fixtures, sem homologar entrega das contas. [Auditoria e resultados](../artifacts/attribution/p06-audit-d88.json). O check geral, build e typecheck locais passaram em D88; visual/browser não foi reexecutado e H01/P07 permanecem separados.

## Retenção analítica — D89

`test:analytics-retention` exige `BIBLIOTHEON_SYNTHETIC_TESTS=true` e banco loopback exclusivo sem owner/analytics prévios. Três grupos cobrem preview sem escrita; agregação por dia UTC e expurgo na mesma transação; remoção de sessão sem dependências; limpeza de contexto mantendo grant ativo; expiração de limites; repetição sem duplicar contagens e ausência de UUID/session/grant no agregado. Migration 29 aplicada no PostgreSQL local; fixtures limpas. Não testa pedidos de titular, cancelamento de envio, retenção comercial, restore, imagem, carga ou validade jurídica da política. Worker permanece opt-in.

## D92 — Retenção de pedidos sem confirmação

`test:privacy-retention` cobre preview sem escrita; cutoff UTC de 24 meses e expurgo idempotente da auditoria; remoção do pedido antigo não confirmado, seu evento e outbox; preservação de contato ainda referenciado/suprimido; proteção de estados `sending/uncertain`; retenção de solicitação recente/confirmada; relatório sem PII. A saída [D92](../artifacts/privacy-retention/d92-results.json) confirma sete verificações e zero mensagens/chamadas externas. Banco sintético obrigatório; não habilita a flag do worker.

## D97 — Inventário agregado de privacidade

`BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-inventory` verifica totais por coleção/grupo, soma coerente e ausência de email/ID/conteúdo no relatório agregado. [Evidência](../artifacts/privacy-inventory/local-results.json). Teste PostgreSQL sintético; não verifica retenção, exclusão, provedores ou restore.


## D98 — Tombstones de supressão

`npm run test:privacy-retention` cobre preview sem escrita, expiração seletiva/idempotente de tombstones vencidos e preservação dos ativos: [D98](../artifacts/privacy-retention/d98-results.json). `npm run test:brevo-sync` verifica que a supressão cria apenas HMAC de 12 meses, sem email, e que rollback desfaz tombstone junto com outbox/consentimento: [resultado](../artifacts/brevo-suppressions/local-results.json). `npm run test:brevo-webhook` cobre criação transacional pelo evento autenticado e rollback; [11 grupos](../artifacts/brevo-webhook/local-results.json). `npm run test:preferences` confirma que um novo opt-in só remove o tombstone depois da confirmação explícita: [resultado](../artifacts/preferences/local-results.json). `npm run test:privacy-inventory` também passou com a nova coleção no grupo marketing. PostgreSQL local sintético; sem chamadas externas ou mensagens reais.

## D99 — Expiração de tokens de preferências

`BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-retention` verifica preview sem escrita, exclusão do token vencido sob lock de contato, preservação de token ainda válido, limpeza do token antes de decidir se o contato pode ser removido, tombstone ativo e reexecução idempotente. [Nove verificações PostgreSQL sintéticas](../artifacts/privacy-retention/d99-results.json); sem migration, mensagem ou chamada externa.

## D100 — Retenção da auditoria comercial

A mesma suíte verifica cutoff UTC de 24 meses, expurgo idempotente de auditoria ligada a inbox `applied`, e preservação de inbox em revisão, conflito, transação com `needsReview` e registro recente. Preview não escreve; apply revalida sob lock da conta; relatório contém contagens. [12 verificações PostgreSQL sintéticas](../artifacts/privacy-retention/d100-results.json); sem migration, API externa ou mensagem.

## D101 — Retenção do envelope da inbox

`BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-retention` valida cutoff de 90 dias por `processedAt`, preview sem escrita, exclusão do envelope da cópia terminal e integridade do `transaction-event` preservado. Conflito, revisão financeira, referência incompleta e registro recente são retidos. Após o expurgo, processamento idempotente e `transactionReviewContext` reconstroem o evento do ledger validando hash. [15 verificações PostgreSQL sintéticas](../artifacts/privacy-retention/d101-results.json). Regressões de `test:transaction-review` (7 grupos) e `test:report-evidence` (10 grupos) passaram. Não é homologação externa, operação com dados reais ou teste de restore.

## D102 — Retenção de amostras confirmadas

`BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-samples-retention` passou em cinco grupos com 14 pedidos sintéticos: preview integrado sem escrita/PII e cutoff exato; rollback após excluir outbox/eventos; remoção de pedidos com envios enviados/falhos/cancelados; preservação de opt-in vigente, prova posterior ausente, sequência vinculada, estado pendente/incerto e alterações recentes; repetição idempotente. Contatos, assinatura vigente e evento de supressão são preservados. [Evidência D102](../artifacts/privacy-retention/d102-results.json). O runner de integração inclui a suíte sequencialmente. Sem migration, provedor, mensagem, política real homologada ou restore.

## D103 — Retenção além da primeira página

`BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-retention` passou em 18 verificações. Regressão adicional cria 100 pedidos com IDs/datas controlados e envios `sending`/`uncertain` antes de um pedido removível; somados ao fixture em voo anterior, são 102 candidatos. Preview não escreve. Apply preserva os 101 casos em voo, remove somente pedido/evento/outbox elegíveis e mantém o contato compartilhado. Reexecução remove zero e continua contando os 101 retidos. [Evidência D103](../artifacts/privacy-retention/d103-results.json). Fixtures sintéticas foram limpas; sem chamadas externas ou mensagens.

## D104 — Manifesto e replay de recuperação

Seis testes unitários cobrem assinatura/chave/domínio, schema estrito/adulteração, duplicatas/limite, prazos, datas do snapshot e isolamento. `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-recovery` passou em seis grupos PostgreSQL: exportação consistente sem emails/IDs/ator; CLI empacotada, modo 600 e recusa de permissões amplas; preview sem escrita e guards de isolamento/freshness; exclusão/correção reaplicada inclusive com auditoria preexistente e envio incerto revogado/bloqueado; retirada promocional independente de amostra e bounce restaurado; repetição sem duplicar decisão/renovar prazo, recaptura bloqueada e zero fetch. [Evidência D104](../artifacts/privacy-recovery/d104-results.json). Regressão `test:privacy-delete` passou em duas verificações. O ensaio simula banco anterior alterando fixtures exclusivas; não executa restic/pg_restore nem comprova arquivo externo atualizado, RPO/RTO ou conta real.

## D105 — Pending antes e depois do restore

`BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-recovery-pending` passou em sete grupos: pending preserva identidade e envio incerto, mas barra captura/confirmação; dispatcher/promoção/cadastro novo não emitem HTTP nem quota; auditoria pending com três anos sobrevive ao expurgo e entra no v2 sem prazo; replay preserva pending sem concluir/apagar identidade e bloqueia ausente; repetição não duplica nem expira a conciliação; bloqueio de entrega independe de globalSuppressedAt; apenas resolução owner explícita produz completed. [Evidência D105](../artifacts/privacy-recovery/d105-results.json).

Oito testes unitários incluem assinatura v1 legada e schema v2 pending/expiração inválida. A suíte D104 permanece com seis grupos. A fixture independente de marketing passou a exigir tombstones/auditorias vazios e remover seus tombstones na limpeza; a guarda da suíte seguinte identificou os sete resíduos sintéticos, que foram removidos só após verificar as demais coleções relacionais vazias. Registros reais/contas e restore físico continuam fora do ensaio.

## D106 — Restore físico local e privacidade — 26/10/2026

D106 validou backup criptografado e restore físico local das 32 migrations, com mídia íntegra e replay do manifesto v2 separado do snapshot; completed é reaplicado e pending permanece pendente. A telemetria automática do Payload foi desativada após a barreira de rede detectar sua tentativa. Imagem atual, guarda externa do manifesto/backup, RPO/RTO reais e release continuam pendentes. [Evidência D106](../artifacts/recovery/d106-results.json) Fonte, dump e destino usam somente fixtures sintéticas. Preview não escreve; repetição mantém prazos; amostra independente é preservada, bounce cancela pendência e identidade sem decisão não é alterada. Flags seguem falsas; sem conta real, VPS ou deploy.

O ensaio `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:recovery` é separado do runner de integrações de banco: também exige Docker Compose e restic local verificado. Não é executado pelo CI atual nem pelo check sem serviços.

## D107 — Imagem atual e upgrade local — 26/10/2026

D107 construiu a imagem local atual e verificou 32 migrations em banco vazio e upgrade real de 6 para 32, preservando contato e owner sintéticos. Saúde, HTTP interno, ACL, runtime sem root/read-only/DDL, CLIs de privacidade e worker de retenção passaram em rede Docker internal, sem saída para provedores. Corrigidos o encerramento das CLIs de inventário/retenção após a limpeza do Payload e a renovação do heartbeat no ciclo ocioso do worker de retenção. A imagem não foi publicada. Bateria funcional integral do release, restore físico nesta imagem, destino externo/RPO/RTO, contas e VPS continuam pendentes. [Evidência D107](../artifacts/container/d107-results.json). As sondagens HTTP rodam no loopback do container; não homologam proxy, TLS ou acesso da VPS. Replay v2 na imagem usa manifesto vazio; decisões reais de fixtures pós-snapshot ainda exigem o ensaio físico nessa imagem.

## D108 — Restore físico com a imagem atual — 26/10/2026

D108 aprovou restore físico com a imagem D107: 32 migrations, mídia íntegra, seis decisões de privacidade posteriores ao snapshot e replay v2 dentro da imagem. Preview, exclusão/correção, pending, supressão/bounce e repetição sem renovar prazos foram verificados. A aplicação só iniciou depois do replay, com credencial de banco separada e limitada: saúde/catálogo/capa responderam 200, contatos privados 403 e amostra privada na rota pública 404. Rede interna sem portas publicadas; transportes e worker desligados. Destino externo, guarda atual do manifesto, RPO/RTO reais, bateria integral e homologações continuam pendentes. [Evidência D108](../artifacts/recovery/d108-results.json). Não houve nova migration, rebuild, dado real, conta externa, VPS ou deploy; identidade sem decisão e entregas incertas foram preservadas.

## D109 — Retenção de estado promocional — 26/10/2026

D109 implementa retenção local de estado promocional para contatos globalmente descadastrados há pelo menos 30 dias: remove assinaturas encerradas e calendários cancelados com etapas antigas, sem lote. Preserva identidade, amostras/outbox, consentimento, auditoria e supressão com o prazo original. Não executa exclusão de identidade nem forja pedido owner. Impedimentos de privacidade, provedor, envio incerto, vínculo cruzado e manifestos compartilhados/JSON preservam os registros. Preview é padrão; apply revalida sob locks e é atômico por contato. P07 continua parcial para identidade, demais finalidades e dados compartilhados. A imagem/restore D107–D108 são evidências da revisão anterior, não incluem esta rotina. [Oito grupos PostgreSQL sintéticos](../artifacts/privacy-retention/d109-results.json). Sem migration, chamada externa, dado real, nova imagem, VPS ou deploy.

## D109 — Critérios de retenção promocional — 26/10/2026

Compartilha os locks promotion-batches → contact com a construção de lotes, revalida estado e datas e só remove etapas canceladas antigas sem lote/recibo/vínculo externo. Varre referências JSON paginadas; limites de 10 mil relações por contato/coleção de manifestos, um milhão de nós JSON e profundidade 64 interrompem a operação, sem tratar inventário truncado como elegível. Identidade, consentimento e amostras têm finalidades/prazos distintos; a rotina não conclui P07 nem homologa exclusão de identidade/provedor.

## D110 — Retenção de identidade e recuperação — 26/10/2026

`BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-identity-retention` passou em 12 grupos: preview, prazo duplo, ACL, exportação sem identidade, vínculos HMAC/callback, rollback, manifesto v3, nova finalidade, quarentena, concorrência, paginação e down/up vazio. `npm run check:recovery` com a mesma flag aprovou restore físico local de 33 migrations e mídia, preview/replay v3 de oito entradas, um expurgo automático e repetição sem renovar prazo. Não validou a imagem atual nem retomada HTTP. [Resultados de retenção](../artifacts/privacy-retention/d110-results.json) e [restore](../artifacts/recovery/d110-results.json). Corrigida corrida na fixture de encerramento de processos: PID publicado atomicamente após instalação do handler.

## D111 — Operações em lote e diagnóstico PostgreSQL — 26/10/2026

`BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:database-bulk` verifica quatro grupos: atualização sem hooks simultâneos, exclusão com rollback integral em transação explícita, exclusão com commit automático e ausência do aviso de consultas concorrentes/rede externa até a limpeza. A suíte entra primeiro no runner sequencial. O mesmo teste falhou antes do patch (quatro hooks concorrentes) e passou depois. [Resultado](../artifacts/database-bulk/d111-results.json); [checks](../artifacts/database-bulk/d111-checks.json). Não substitui auditoria de todas as consultas ou volume de produção.

## D112 — Descadastro e retenção por assunto — 26/10/2026

`BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-theme-retention` cobre oito grupos PostgreSQL, incluindo rollback após remover etapas/calendário, concorrência sob lock, backlog de 100 retidos, confirmação antiga e novo opt-in real com transporte sintético. 13 unitários de manifesto incluem v4, tema inválido/duplicado/pending, prazo e downgrade assinado, mantendo leitura v1/v2/v3. [Evidência temática](../artifacts/privacy-retention/d112-results.json). O harness físico agora testa nove entradas v4 e o assunto retirado, preservando outro assunto/amostra no snapshot restaurado; não equivale à imagem final ou conta homologada.

## D113 — Margem e acompanhamento do prazo — 26/10/2026

Quatro unitários em retention-policy verificam margem 28 dias + 25h <30 dias, fases horárias do ciclo UTC, fim de mês/relógio e saúde com arquivo ausente/corrompido/futuro/velho/exceções. `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-retention-deadline` testa quatro grupos com PostgreSQL exclusivo. `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:worker-health` executa oito cenários reais das CLIs atuais em container sem rede/banco, montadas read-only numa imagem antiga; não certifica a imagem inteira. [Testes do prazo](../artifacts/privacy-retention/d113-results.json) e [CLIs](../artifacts/worker-health/d113-results.json). Runner de integrações inclui o novo teste de prazo.

## D114 — Legado temático verificável — 26/10/2026

`BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-theme-legacy` verifica oito grupos no PostgreSQL exclusivo. Inclui exportação sem escrita, prova expirada sem renovação, snapshot anterior à retirada vencida recusado, omissão não permitida, cobertura global legítima, expurgo anterior a finalidade nova, chave divergente, tema/data/finalidade/prefixo errados, conflito temporal, rollback de fato+expurgo, reativação concorrente e paginação. [Resultado](../artifacts/privacy-retention/d114-results.json). O harness físico D114 remove só o fato sintético após descadastro nativo e prova que exportação/replay usam o evento preservado; não chama conta/provedor.

Verificação de laboratório D121: quatro rotas × três amostras, viewport móvel 390×844, CPU 4×, latência 150ms e download 200.000 bytes/s, cache do browser desabilitado e servidor aquecido. Dataset: 30 livros publicados, três temas e 30 artigos. P75 observado de LCP: home 1.160ms, catálogo 600ms, LP guia 640ms e artigo 592ms; CLS agregado conservador abaixo de 0,002. Limite superior do p75 da interação de teclado amostrada ficou em até 192ms; isso não é INP de campo. Todos passaram nos orçamentos amostrados.

Carga local pública: 25 requests com concorrência 5 e 50 com concorrência 10, sem erros; p95 de 599ms/838ms, respectivamente. Não são usuários reais, teste completo de operação comercial ou capacidade da VPS. [Resultados medidos](../artifacts/qa-release-layout/d121-results.json) e [inspeção visual representativa](../artifacts/qa-release-layout/d121-visual-review.json). A primeira tentativa do laboratório parou por localizador exato da aparência; foi corrigido e a retomada validou identidade de build/interface e os 120 PNGs antes de reutilizar a parte de zoom.

Banco descartável removido e banco configurado preservado em todas as tentativas encerradas. H05 continua parcial para o restante da matriz/estados e carga comercial; não foi marcada como concluída. Sem nova imagem, publicação, conta externa ou deploy. Próxima ação: consolidar os recortes de QA existentes e executar os cenários faltantes da matriz, depois fechar a imagem da revisão final. P07 continua aguardando definição da guarda comercial e conciliação das dependências externas.

## D122 — Evidência atual de navegador — 27/10/2026

[Nove suítes/496 capturas](../artifacts/qa-release-layout/d122-results.json) passaram: público/catálogo/aparência, editorial/login, amostras/preferências/sequências e jornada comercial integrada. Bancos descartáveis removidos; hashes dos artefatos conferidos. Sete suítes finais com mídia temporária e bloqueio de HTTP externo, sem tentativa registrada. [Inspeção representativa](../artifacts/qa-release-layout/d122/visual-review.json), sem afirmar leitura manual de todas as capturas. `npm run check` passou com 298 unitários/36 arquivos, 62 operacionais, tipos/lint e documentação. Sem migration ou alteração funcional do produto; H05 ainda parcial conforme a [matriz](design/07-qualidade.md). Sem conta externa, mensagem real, GitHub ou VPS.

D122 — imagem atual aprovada em banco vazio e upgrade 32→35, incluindo mídia/ACL/CLIs/worker em rede Docker interna. [Evidência da imagem](../artifacts/container/d122-results.json). [16 suítes HTTP](../artifacts/container/h03-http-d122-results.json) passaram no standalone QA atual com banco descartável removido; não foram executadas integralmente dentro do container. [Checks e limites](../artifacts/qa-release-layout/d122-checks.json). Sem publicação, conta externa, GitHub ou VPS. H05/P07 e gates externos continuam conforme pendências. Restore desta imagem/guarda externa só são exigidos se a capacidade opcional de recuperação for adotada; `--sem-backup` segue disponível.

## D123 — Foco e estados ativos dos formulários — 27/10/2026

Corrigida perda de foco após resposta de amostra/confirmação/preferências/cancelamento, com recuperação somente quando caiu no corpo da página. [250 verificações/284 capturas](../artifacts/qa-release-layout/d123-results.json), incluindo seis larguras/dois temas, zoom nativo 400% ativo e loading/erro/retentativa. 238 axe sem violações; 12 fallbacks sem JS têm validação própria de aviso/HTML/overflow/ausência de POST. [Crítica visual amostral](../artifacts/qa-release-layout/d123-visual-review.json). Reuso dos 204 estados regulares auditado; relatório original failed preservado após falha numérica do protocolo de zoom, sem esconder a falha inicial de foco corrigida.

Build QA e `npm run check` passaram (298 unitários, 62 operacionais, tipos/lint). Banco/mídia temporários removidos; transporte em memória, sem conta externa. Sem migration. H05 parcial para demais estados/componentes e carga comercial; P07 e homologações ainda abertos. Imagem D122 antecede a correção e precisa ser renovada no fechamento. Backup opcional; produção inalterada.

## D124 — Resultado de carga comercial — 27/10/2026

[Ensaio local](../artifacts/qa-release-layout/d124-results.json) com 30 livros/três temas/30 artigos e mil transações aprovadas sintéticas: cinco/dez clientes HTTP da mesma sessão owner, 45 jornadas/180 requests sem erro. Catálogo, relatório financeiro, inbox com todos os estados e replay de callback tiveram latências registradas; totais e null de recebimento preservados, replay/processamento repetido sem duplicação. p95 relatório/inbox com dez clientes: 2.852ms/3.090ms. Banco e mídia temporários removidos; banco configurado preservado, sem conta externa ou mensagem real.

Medição finita em servidor local aquecido, sem SLA novo, Web Vitals de campo ou capacidade da VPS. H05 permanece parcial para conteúdo adverso/componentes/views, conforme [matriz](design/07-qualidade.md). Produto e schema não mudaram nesta rodada; a imagem de fechamento ainda deve incorporar a correção de foco D123 depois de consolidar o código. Backup opcional, produção inalterada.

## D125 — Evidência pública atual

[208 verificações públicas](../artifacts/qa-release-layout/d125-results.json) passaram: erro/recuperação real em banco descartável, títulos/textos/links/listas extensos, capa indisponível, ofertas inativas, ausência de amostra, fonte bloqueada e JS lento. Cobertura detalhada na [matriz](design/07-qualidade.md). H05 continua parcial para operação administrativa de fase 2; imagem final posterior às correções D123/D125. Carga comercial local permanece comprovada por D124, sem inferir capacidade da VPS.

## Aceite visual local D126 — 28/10/2026

R31–R34/B19/B20/H05 têm [auditoria local por família](../artifacts/qa-release-layout/d126-h05-acceptance.json), combinando D121–D126. Nenhum requisito de negócio foi removido. Novas telas/estados ou falhas reabrem a cobertura afetada. Imagem/API atuais têm evidência D127; P07 e homologações do ambiente real continuam pendentes. Código posterior exige renovar apenas os gates afetados; campo será acompanhado após tráfego suficiente.

## D127 — Imagem atual e mitigação de dependência — 28/10/2026

A [imagem local](../artifacts/container/d127-results.json) passou em banco vazio e upgrade real 32→35, com contato/owner preservados, migrations idempotentes, DDL negado ao runtime, permissões privadas, mídia WebP/substituição inválida/persistência após restart, CLIs e worker saudável inclusive ocioso. Rede interna, transportes desligados e zero envios; projetos/volumes descartáveis removidos. Sem restore físico, registry, conta real ou VPS.

A nova auditoria identificou GHSA-gcqx-w48m-w2h4 em deepmerge 4.3.1, low, sem versão corrigida publicada. A reprodução confirmou protótipo controlado no objeto retornado; não demonstra exploração de endpoint do produto. Patch local bloqueia chaves reservadas na cópia de alvo/origem e grava propriedades próprias nos três entrypoints. [Auditoria bruta e mitigação](../artifacts/security/d127-deepmerge-mitigation.json): aviso mantido, 16 regressões CJS/UMD e oito casos dentro da imagem. O npm audit por versão não reconhece o patch; não declarar zero advisories. Reavaliar quando houver correção upstream.

Build QA e Docker com lockfile fixado passaram; `npm run check`: 314 unitários/37 arquivos e 62 operacionais, tipos/lint/documentação. [16 suítes HTTP](../artifacts/container/h03-http-d127-results.json) repetidas após o patch passaram e o banco exclusivo foi removido. A primeira bateria HTTP anterior à mitigação foi preservada separadamente, sem usá-la como prova do patch. [Fingerprint de fonte](../artifacts/container/d127-source-snapshot.json) conferido ao fim. H05 continua aceito localmente pela matriz D121–D126; nenhuma mudança de UI/estilo nesta etapa.

H03 tem evidência da revisão atual; o encerramento integral segue condicionado a P07 e aos gates externos. Próxima ação: definir prazo/marco de guarda financeira, concluir tratamento das finalidades/cópias externas aplicáveis e renovar somente verificações afetadas por código posterior. Contas, contato/material reais, CI, proteção administrativa, alertas e VPS continuam com proprietário/operador. Backup/restore continuam opcionais com `--sem-backup`.
