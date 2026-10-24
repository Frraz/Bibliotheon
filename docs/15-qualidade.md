# 15 — Qualidade e homologação

[Índice](../README.md) · [Requisitos](02-requisitos.md)

## Camadas

Documentação: verificador Python sem dependências. Código existente: TypeScript strict, lint sem autofix, Vitest para regras, PostgreSQL de teste para constraints/transações e Playwright para jornadas. axe como apoio à acessibilidade, complementado por teclado e leitura visual. Fixtures sintéticas e relógio controlado para cronologia, expiração e coortes. Estado/evidência de cada requisito no [mapa atual](23-estado-atual.md); a matriz abaixo continua sendo o aceite do produto completo, não uma lista de testes todos aprovados.

CI alvo: instalar com lockfile → lint/typecheck → testes unitários/integração → build → testes de navegador → imagem. O workflow existente prepara geração/diff de tipos/import map, documentação, estáticos/unitários, migrations, catálogo/mídia/marketing/sequências/lotes/bloqueios outbound/preflight/cadastros/listas, build e testes HTTP de acesso/site/recuperação. Ainda não executa QA browser nem build/homologação de imagem; nenhuma execução no GitHub comprovada. Nenhuma credencial de produção em PR. Antes do release, testar migrations atuais de banco vazio e versão anterior. Revisão só documental roda o verificador, sem exigir subir aplicação ou Docker para isso.

## Matriz de cenários

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

## Critérios de release

Sem falha crítica de autenticação, exposição de dados, duplicação financeira ou perda de eventos conhecida. Fluxo ponta a ponta do conteúdo ao checkout testado. Cada provedor tem evidência externa própria; teste sintético não a substitui. Backup restaurado, monitoramento e rollback documentados.

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
