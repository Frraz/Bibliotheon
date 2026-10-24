# 18 — Validação da entrega documental

[Índice](../README.md) · [Progresso](14-progresso.md)

Leitura atual: [estado até D67 e revisão D68](23-estado-atual.md) e [pendências para produção](../pendencias.md). Os registros abaixo são cronológicos: próximas ações, contagens e limitações antigas descrevem a respectiva etapa, sem substituir a fotografia vigente.

Histórico inicial: 20/10/2026, documentos e verificador local, então sem aplicação e sem acesso à VPS. As seções iniciais preservam o resultado daquela entrega. A revisão atual está ao final; implementação e evidências de software estão separadas no [estado atual](23-estado-atual.md).

## Verificação inicial — histórico

Executar `python3 scripts/validar_documentacao.py` na raiz.

Na primeira entrega, o script verificou títulos, fechamento de blocos de código, destinos dos links Markdown locais, cobertura de R01–R26 em backlog/testes, presença de B01–B16 e T01–T21, além do SHA-256 de `reflexoes.md`.

SHA-256 original esperado: `e9be41f92ab65d33cfdc5e8f9447d7fb05cf84ad43cb920d7d4906d15d8a262c`.

Resultado inicial: **aprovado** — 30 documentos, 104 links locais válidos, 18 URLs externas distintas catalogadas, 26 requisitos, 16 tarefas e 21 cenários. Nenhum erro estrutural detectado. As URLs externas não são verificadas pelo script; a pesquisa de fontes está registrada separadamente.

Sintaxe do verificador validada com parser Python. Dois controles negativos em cópias temporárias confirmaram que o script retorna falha para link local inexistente e alteração da fonte original. Os arquivos reais não foram modificados por esses controles.

## Revisão semântica

Revisada a consistência entre consentimento, entrega da amostra e marketing; oferta versus venda confirmada; autenticação por provedor; eventos duplicados/fora de ordem; atribuição desconhecida; preço e valores null; VPS compartilhada; backup externo; limites do orçamento e fontes ainda pendentes.

A revisão separou transporte transacional e campanhas de marketing no Brevo e manteve explícitas as dependências de autenticação dos provedores. Todos os requisitos têm fase, dependência e aceite; todos aparecem no backlog e na matriz de cenários. Os seis modelos operacionais estão ligados ao índice.

## Limites

O verificador não testa endpoints externos, domínio, software futuro, desempenho, acessibilidade renderizada, segurança implementada, integrações reais ou capacidade da VPS. Fontes externas foram consultadas e seus limites registrados em [referências](16-referencias.md); uma URL técnica Kiwify retornou 404 e não foi usada para inventar autenticação.

Não houve deploy, publicação de livro, envio de campanha, compra ou confirmação de vendas. Checklists de homologação permanecem pendentes deliberadamente.

## Evolução documental de design

O verificador atual inclui `DESIGN-BRIEF.md`, todos os documentos de design, R01–R34, B01–B20 e T01–T29. Verifica os dois hashes de conversas originais e executa a verificação não mutante dos contrastes. O relatório de cores deve corresponder exatamente à paleta canônica.

Hash da conversa de design: `a78685e178c4453a71f9abfcc30aac0c32a7f114b4081f41790c1a6f7561e122`.

Resultado da evolução: **40 documentos, 161 links locais válidos, 31 URLs externas distintas catalogadas, 34 requisitos, 20 tarefas e 29 cenários**. Os 76 pares autorizados de contraste passaram; o relatório gerado corresponde à paleta JSON. Sintaxe dos dois verificadores válida.

Controles matemáticos confirmaram preto/branco = 21:1 e #777777/branco abaixo de 4,5:1. Quatro controles negativos em cópias temporárias detectaram link quebrado no briefing, alteração da conversa de design, contraste insuficiente e perda de cobertura de requisito no backlog. Nenhuma conversa real foi alterada.

Revisão semântica: substituídas as direções iniciais de fonte de sistema e tema somente claro; preservados os contratos comerciais; enums visuais integrados a dados/interfaces; dependências B17–B20 incorporadas sem renumerar tarefas antigas. A identidade, as três variantes de LP, todas as famílias de páginas, painel e componentes prioritários estão especificados para ambos os temas. Os testes visuais futuros permanecem não executados.

A avaliação de pares sRGB não certifica acessibilidade, aparência ou conversão. Fontes externas não são verificadas pelo script; fontes e falhas de consulta estão registradas nos documentos de referência. Nenhum browser de aplicação, frontend ou infraestrutura foi iniciado.

## Consolidação do estado implementado — 21/10/2026

Revisão documental posterior à implementação autorizada. Conferidos código/rotas, package.json/lockfile, sete migrations, workflow CI e 16 relatórios existentes. Consultados somente nomes/batches de migrations e contagens locais, sem ler contatos/credenciais ou alterar serviços. O [inventário datado](../artifacts/documentation/state-audit-2026-10-21.json) registra o recorte observado; não substitui nova execução dos testes de software.

Criado documento 23 com mapa dos 34 requisitos, componentes existentes, evidências e lacunas, comandos, migrations e ordem de retomada. README, progresso, backlog, contratos HTTP, dados, arquitetura, segurança/operação e direção visual foram alinhados. Backlog mantém 20 IDs e a qualidade mantém os 29 cenários, sem reduzir aceites ou marcar fases incompletas como concluídas. Corrigidas descrições antigas de aplicação inexistente, domínio/título desconhecidos, cache/CI e quota totalmente pendentes; histórico cronológico preservado no documento 19.

O exemplo privado de produção agora explicita BREVO_TRANSACTIONAL_RESERVE=50, já consumido pelo código/Compose; nenhum segredo real ou flag de ativação foi alterado. E-mail público permanece vazio até produção por decisão do proprietário. Nenhuma nova implementação de lote promocional, deploy, integração externa ou teste da aplicação foi realizada nesta revisão. Resultado do validador documental registrado após a conferência final.

Resultado final: **aprovado — 46 documentos, 285 links locais, 58 URLs externas catalogadas, 34 requisitos, 20 itens de backlog, 29 cenários e 76 pares de contraste**. URLs externas não foram reconsultadas nesta revisão. Checagem complementar confirmou os 34 requisitos mapeados uma vez, os estados dos 20 itens, 9 linhas HTTP implementadas/8 previstas e a presença dos 16 relatórios referenciados. Inventário inclui hashes dos arquivos de implementação/configuração pública/scripts para identificar esta revisão; não inclui ambientes privados nem dados de usuários. Fontes históricas permaneceram byte a byte intactas.

## Guia e automação de deploy — 22/10/2026

deploy.md passou a integrar o próprio validador, com links/blocos/hashes verificados. Ferramentas novas: dois launchers Bash, orquestrador Python, 23 testes de orquestração simulada e ensaio de configuração Compose real/JSON privado. Bash, sintaxe Python e --help dos dois nomes passaram. A normalização foi testada inclusive com senha sintética contendo cifrão; nenhum container de aplicação foi iniciado. Caminho/versão do restic conferidos em container temporário não iniciado e removido.

check-local passou com tipos, lint sem erros (dois avisos já conhecidos na migration) e 29 unitários da aplicação; a última execução isolada das ferramentas passou nos 23 testes após os ajustes finais de Git/cifrões. Workflow preparado inclui os testes novos, sem execução comprovada no GitHub. [Resultado e hashes da entrega](../artifacts/deploy/local-results.json). Fontes operacionais oficiais Docker/Caddy/restic/GitHub foram consultadas; o verificador não testa rede nem configurações reais da VPS. Nenhum deploy, pull real, backup externo real, DNS ou proxy foi executado.

## Continuação de 22/10 — mídia e manutenção

D47 com [seis grupos de integridade](../artifacts/media-integrity/local-results.json) e [checagens do release local](../artifacts/media-integrity/release-checks.json). Orquestração passa a ter 24 testes simulados; backup confirmado precede coleta e falha tenta retomar app. Build isolado/CLI/HTTP aprovados. Sem VPS, backup externo, CI GitHub ou nova rodada visual. Relatórios anteriores preservam o estado daquela execução.

## Continuação de 22/10 — lotes locais

D48: [seis grupos de integração](../artifacts/promotion-batches/local-results.json), regressões de sequências/marketing, 31 unitários, 24 testes simulados de deploy e build/CLI/HTTP aprovados. [Resumo e hashes](../artifacts/promotion-batches/release-checks.json). Oitava migration aplicada somente no banco loopback; nenhuma campanha ou lista criada no provedor, sem envio promocional, VPS ou nova homologação visual.

## Continuação de 22/10 — bloqueios outbound

D49: [oito grupos](../artifacts/brevo-suppressions/local-results.json) e [resumo/hashes](../artifacts/brevo-suppressions/release-checks.json). 38 unitários, 25 testes simulados de deploy, regressões, build/CLI/Compose/HTTP aprovados. Nona migração aplicada só no banco loopback; down/up e preenchimento histórico conferidos em transação revertida. Contrato público GET/PUT consultado, nenhuma conta/API real ou mensagem. Sem nova homologação visual, VPS ou imagem/restore.

## Continuação de 22/10 — conferência de destinatários

D50: [sete grupos](../artifacts/provider-preflight/local-results.json) e [resumo/hashes](../artifacts/provider-preflight/release-checks.json). 40 unitários, 25 testes de deploy simulado, regressões, build/CLIs/HTTP/site aprovados. Décima migração aplicada só no PostgreSQL loopback; guard de downgrade preserva registros novos. Consulta oficial GET revalidada; conta real não acessada, sem envio, webhook, listas/campanhas ou nova homologação visual/imagem.

## Continuação de 22/10 — cadastro consentido

D51: [dez grupos](../artifacts/brevo-registrations/local-results.json) e [resumo/hashes](../artifacts/brevo-registrations/release-checks.json). 45 unitários, 26 testes simulados de deploy, regressões, build/empacotamento/Compose/HTTP aprovados. CLI habilitado exercitado com fetch interceptado; nenhum endpoint real. Migração 11 aplicada só no banco local, down/up/backfill e recusa de perda de tentativas conferidos em transações revertidas. Sem nova homologação visual, imagem/restore ou operação real.


## Continuação de 22/10 — listas exclusivas Brevo (D52)

12a migração aplicada somente no PostgreSQL local; down/up vazio revertido e recusa de downgrade com intenções/IDs confirmados. [Dez grupos de integração](../artifacts/brevo-lists/local-results.json): concorrência, reconciliação sem recriação incerta, retenção imediata de ID, composição exata/paginada, resultado parcial, preferências ausentes, descadastro em voo, lease, validade e 200 destinatários sintéticos em inclusões de 150/50. CLI empacotado habilitado exercitado com fetch inteiramente interceptado e persistência conferida; ajuda/desativação/configuração inválida também passaram.

51 unitários e 27 testes simulados de deploy aprovados; regressões de cadastro (10), bloqueios (8), preflight (7), lotes (6), marketing (11) e sequências (7) passaram sequencialmente. TypeScript, lint sem erros (dois avisos anteriores), instalação congelada/import map inalterado, build isolado e runtime final aprovados. Configuração Compose real mantém flags false em app/worker; nenhum container de aplicação iniciado. HTTP na porta 3001 validou coleção privada e páginas públicas; servidor de QA encerrado sem alterar prévia da porta 3000. [Resumo e hashes](../artifacts/brevo-lists/release-checks.json).

Nenhuma API real, lista/campanha externa, mensagem, VPS ou GitHub nesta rodada. Sem nova homologação visual, imagem/restore do release de 12 migrations ou resultado comercial. Aviso pg/Drizzle de queries concorrentes permanece. Campos opcionais do provedor ausentes mantêm estado incerto; homologar conta/pasta/automações antes de ativar. Preferências promocionais completas, campanhas, webhook, conciliação e retenção de listas externas continuam pendentes.

Fechamento documental D52: 47 documentos, 367 links locais, 70 URLs externas catalogadas, 34 requisitos, 20 tarefas, 29 cenários e 76 pares de contraste aprovados. git diff --check, sintaxe dos dois launchers e compilação Python também passaram; URLs externas não são verificadas pelo validador.


## Continuação de 22/10 — preferências por assunto (D53)

[Sete grupos](../artifacts/preferences/local-results.json) aprovados com PostgreSQL loopback: consulta sem mutação/endereço, tokens e escopo entre contatos, contrato POST privado/estrito, retirada concorrente, rollback de auditoria/calendário, preservação de outro assunto, recusa de lote preparado e cancelamento do último tema com fila externa. Confirmação antiga expirada não reativa tema. Primeiro assunto usa pedido/confirmação/calendário; segundo é semeado sinteticamente. Sem alteração de schema.

[36 capturas](../artifacts/qa-preferences/results.json) em claro/escuro e seis larguras (360 a 1920), consulta explícita por teclado, cancelamento temático e global com estado persistido: axe/overflow sem falhas. GET da página não fez consulta privada nem mutação; GET da API retorna 405 no servidor real isolado. Telas móvel clara e desktop escura também inspecionadas visualmente. 51 unitários e 27 testes simulados de deploy, TypeScript/lint, build .next-qa, regressões de marketing (11), sequências (7), lotes (6), acesso HTTP e site aprovados. QA encerrado, prévia 3000 preservada. [Resumo e hashes](../artifacts/preferences/release-checks.json).

Nenhuma API externa, campanha, mensagem real, GitHub/VPS ou nova imagem/restore. Não houve nova instalação congelada: dependências/lockfile permaneceram iguais. Aviso pg/Drizzle e dois avisos de lint anteriores persistem. Rodada visual cobre esta página, sem concluir B20 integral. Personalização das preferências por destinatário em campanhas e webhook/conciliação ainda pendentes.

Fechamento documental D53: 47 documentos, 379 links locais, 70 URLs externas catalogadas, 34 requisitos, 20 tarefas, 29 cenários e 76 pares de contraste aprovados. git diff --check passou; URLs externas não foram reconsultadas por esta rodada.


## Continuação de 22/10 — links individuais Brevo (D54)

[Oito grupos](../artifacts/brevo-preferences/local-results.json) aprovados: intenção antes de HTTP, dois titulares com links distintos e hash sem token bruto, preparação concorrente, timeout aplicado/204 ignorado, descadastro em PUT, bloqueio observado, divergência de ID, expiração/rotação de chave, rollback e CLI empacotado habilitado com HTTP inteiramente interceptado. 13a migração aplicada só no PostgreSQL local; down/up vazio e guard contra perda de intenção/prova em transações revertidas.

58 unitários e 28 testes simulados de deploy passaram. Regressões sequenciais de preferências (7), lotes (6), preflight (7) e listas (10), tipos/lint (dois avisos anteriores), build isolado/runtime e configuração Compose real aprovados; flag de preferências false em app/worker, sem containers de aplicação iniciados. HTTP de privacidade/site passou, incluindo coleção de tokens com leitura/criação anônimas negadas e leitura do owner permitida. QA encerrado; prévia 3000 preservada. [Resumo e hashes](../artifacts/brevo-preferences/release-checks.json).

Sem API real, campanha criada/enviada, quota promocional, GitHub ou VPS. Nenhuma nova UI/homologação visual ou imagem/restore atual; dependências/lockfile inalterados, instalação congelada não repetida. Contrato oficial de atributos/GET/PUT e placeholder reconferido em fontes públicas; conta/schema real/renderização continuam sem homologação. Aviso pg/Drizzle persiste.

Fechamento documental D54: 47 documentos, 389 links locais, 72 URLs externas catalogadas, 34 requisitos, 20 tarefas, 29 cenários e 76 pares de contraste aprovados. Sintaxe Bash/Python e git diff --check passaram. URLs externas não são verificadas pelo validador; fontes de contrato foram consultadas separadamente.


## Continuação de 22/10 — rascunhos de campanha (D55)

[Oito grupos locais](../artifacts/brevo-campaigns/local-results.json) aprovados: concorrência, manifesto sem tokens/endereço, resposta de criação perdida, ausência sem recriação, ID conhecido antes de falha de GET, cópia alterada, colisão de ID entre lotes, retry de recusa explícita, descadastro em POST, lease e expiração. CLI empacotado habilitado reconciliou rascunho existente com HTTP totalmente interceptado; ajuda/desativação/configuração e argumentos inválidos também passaram antes de banco/rede. 14a migração aplicada só no PostgreSQL local; down/up vazio e recusa de perder intenção/IDs testados em transações revertidas.

64 unitários e 29 testes simulados de deploy passaram; renderer com texto literal, placeholders próprios e contexto comercial, requisição sem agendamento e conferência estrita de GET cobertos. Regressões sequenciais de links individuais (8), listas (10) e lotes (6), tipos/lint (dois avisos anteriores), build .next-qa/runtime e Compose real aprovados. HTTP de coleção privada/site passou, com owner autorizado para leitura e mutação negada pela Local API; QA encerrado sem alterar prévia 3000. [Resumo e hashes](../artifacts/brevo-campaigns/release-checks.json).

Sem campanha/conta/API real, mensagem, claim/quota promocional, GitHub ou VPS. Consulta oficial não homologa remetente, HTML/placeholder ou representação real do GET. Sem nova homologação visual/painel, imagem/restore atual ou instalação congelada; dependências/lockfile inalterados. Aviso pg/Drizzle persiste. Adaptador não oferece sendNow, envio de teste, agendamento, PUT ou DELETE. Transporte/webhook/conciliação e retenção continuam pendentes.

Fechamento documental D55: 47 documentos, 399 links locais, 76 URLs externas catalogadas, 34 requisitos, 20 tarefas, 29 cenários e 76 pares de contraste aprovados. Sintaxe Bash/Python, hashes da entrega e git diff --check passaram. URLs externas não são verificadas pelo validador; contratos públicos foram consultados separadamente.


## Continuação de 24/10 — transporte promocional (D56)

Retomada do código de 22/10 no commit local 74fe451 existente, sem commit/push do agente. PostgreSQL local iniciado em loopback; quinze migrations já aplicadas. Reproduzida falha de downgrade: índice parcial de etapas mantinha dependência do enum antigo. Corrigido somente down da 15a para remover/recriar esse índice, preservando up aplicado; teste confere índice após down/up dentro de transação revertida. Fixture de rollback da 14a agora reverte a 15a dependente antes. Guard continua recusando perda de tentativas/quota/estados novos.

[12 grupos de transporte](../artifacts/brevo-send/local-results.json) aprovados: claim/quota atômicos e concorrência; rollback antes de HTTP; quota/reserva transacional e UTC; resposta perdida; recusa/retry explícito; descadastro antes da reserva e após emissão; lease abandonado/resposta tardia; falha ao registrar retorno; permissões; CLI empacotado com exatamente um POST sintético; seleção do worker com preparação concorrente ativa e outro lote elegível; worker --once com fila vazia/rede bloqueada. Nenhum token/endereço no histórico/manifesto.

69 unitários e 30 testes simulados de deploy, tipos/lint (dois avisos anteriores), build .next-qa/runtime e Compose real aprovados. Tipos/import map regenerados sem diferença. Regressões sequenciais: lotes (6), preflight (7), rascunhos (8), preferências (7), marketing (11), sequências (7). HTTP da coleção privada/site passou; QA encerrado e prévia 3000 preservada. Contagens finais locais de owner, contatos, tentativas e inscrições: zero. [Resumo e hashes](../artifacts/brevo-send/release-checks.json).

Sem conta/API/mensagem real, imagem/restore atual, nova homologação visual, GitHub ou VPS. Fonte oficial sendNow reconferida em 24/10; 204 confirma solicitação para processamento imediato, sem provar entrega. Flag real continua false; homologar conta/quota/reset/remetente/templates/automações antes de ativar. Incertezas não são reenviadas nem reembolsadas automaticamente na quota; observação/webhook/conciliação externa continuam pendentes. Aviso pg/Drizzle persiste e dependências/lockfile não mudaram; instalação congelada não repetida.

Fechamento documental D56: 47 documentos, 409 links locais, 76 URLs externas catalogadas, 34 requisitos, 20 tarefas, 29 cenários e 76 pares de contraste aprovados. Sintaxe Bash/Python, hashes da entrega e git diff --check passaram. Fontes históricas preservadas; URLs externas não são verificadas pelo validador documental.


## Observação de campanhas — 24/10/2026 (D57)

16a migração 20261024_064354_brevo_campaign_observations aplicada somente no PostgreSQL local. Fila privada criada no commit da intenção de emissão e backfill para tentativas anteriores. GET confere identidade/cópia/lista/remetente do manifesto original; estados nativos documentados em D57. queued/in_process/in_review/sent registram atividade observada da campanha, sem atribuir autoria exclusiva ao POST ou provar entrega individual. Histórico HTTP/código/quota preservados, sem fabricação de 204 ou retry de pedido incerto. Prova positiva não regride; descadastro permanece intacto; ACK tardio mantém observação e registra código real.

[Nove grupos locais](../artifacts/brevo-observation/local-results.json) aprovados: concorrência, backfill/down/up revertidos, estado posterior/conflito, lease versus retry, retirada de consentimento, ACK tardio, rollback/recovery, CLI empacotado e coordenador de fila. Worker somente observador com SMTP/envio/cadastro desligados e rede bloqueada. 73 unitários, 31 testes simulados de deploy, regressões de transporte (12 grupos) e rascunhos (8), build isolado e Compose sintético aprovados. Tipos/lint passaram, permanecendo dois avisos antigos na migração de sequências e aviso pg/Drizzle nas fixtures.

BREVO_CAMPAIGN_OBSERVE_ENABLED=false por padrão, independente do envio. CLI brevo:observe e worker consultam campanha existente sem mudar consentimento; polling de 15 minutos, lease de 30, parada automática em sent/archive/cancelled. Runtime empacotado inclui observe-brevo-campaign. Nenhuma API/conta real, mensagem, GitHub ou VPS. Imagem/restore das dezesseis migrations e homologação visual do painel atual continuam pendentes. Próxima frente B06: webhook autenticado, conciliação por destinatário e homologação externa; depois B07–B12.


Fechamento D57: HTTP de acesso/privacidade (incluindo nova coleção) e site público aprovados no QA .next-qa/3001; servidor encerrado. O primeiro ensaio usava origem/allowlists incompletas; repetição com o ambiente sintético documentado passou. Contagens após limpeza: owner/contatos/inscrições/etapas/disparos/observações zero; 16 migrations aplicadas. [Resumo e hashes D57](../artifacts/brevo-observation/release-checks.json). Artefatos anteriores são fotografias dos respectivos estágios; os hashes atuais desta continuação estão no resumo D57.


## Callback autenticado e conciliação por destinatário — 24/10/2026 (D58)

Migrações 17/18 aplicadas somente no PostgreSQL local: inbox/resultados privados e impressão HMAC de identidade gravada na intenção/quota antes do POST. Nenhum backfill com endereço atual para históricos. Endpoint POST /api/webhooks/brevo autentica Bearer, deduplica semanticamente e confirma depois de persistência/efeitos locais atômicos. Eventos incompatíveis/desconhecidos ficam em quarentena. Resultados individuais preservam entrega/devoluções/reclamação/cancelamento em datas separadas; não significam leitura ou venda. Retirada de marketing, bloqueios e amostra permanecem separados; eventos positivos não restauram consentimento. Replay privado sem rede e callbacks de retry não rearmam transporte após atividade observada.

[11 grupos de integração](../artifacts/brevo-webhook/local-results.json) e [três grupos HTTP](../artifacts/brevo-webhook/http-results.json) aprovados, incluindo concorrência/deduplicação, rollback, replay, identidade histórica/legado, supressão, limites/autenticação e ausência de PII no envelope/retorno. 79 unitários e 32 testes simulados de deploy passaram; regressões de transporte 12, observação 9 e rascunhos 8 após identidade histórica aprovadas. Marketing 11 passou nesta rodada antes do acréscimo isolado da identidade de disparo. Build .next-qa, tipos/lint, empacotamento, Compose real/normalizado e HTTP de privacidade/site aprovados. Permanecem dois avisos antigos na migration de sequências e aviso pg/Drizzle nas fixtures. Import map sem novos componentes.

Configuração privada nova: BREVO_WEBHOOK_ENABLED=false, token atual/anterior e HMAC de eventos independente; SMTP/API key/envio/worker não são ativados. Fontes oficiais, semântica de retry 429 e limites em [D58](17-decisoes.md); guia de deploy atualizado. Callback real ainda não homologado. QA .next-qa/3001 encerrado, prévia gerenciada preservada; contagens de owner/contatos/inscrições/etapas/disparos/observações/eventos/resultados zeradas após cleanup, 18 migrations. Nenhum evento real, mensagem, API de conta, GitHub ou VPS. Imagem/upgrade/banco vazio/restore das 18 migrations e homologação externa/visual do painel seguem pendentes. Próximo desenvolvimento independente: eventos comerciais/inbox B07 e conectores B08–B10; relacionamento mantém homologação/recuperação pendentes. [Resumo e hashes D58](../artifacts/brevo-webhook/release-checks.json).


## Medição própria consentida — 24/10/2026 (D59)

Migração 19 aplicada somente no PostgreSQL local. Permissão analítica versionada e revogável, sessão de 30 minutos inativa, PageView idempotente e CheckoutClick separado por população. First-touch inclui entrada direta; último não direto respeita campanha/UTMs cadastradas e janela de 30 dias. Coleta exige ANALYTICS_ENABLED=true e institucional revisado; flag false por padrão. Não se cria ID/sessão antes do aceite. URL comercial externa permanece intacta; clique não significa compra e não injeta parâmetro de atribuição sem homologação.

Controle de aceitar/rejeitar/revogar no rodapé, formulário nativo de retirada sem JS, gerador privado de link de campanha e resumo de sete dias implementados. [Oito grupos locais](../artifacts/analytics/local-results.json), [seis grupos HTTP](../artifacts/analytics/http-results.json) e [41 telas](../artifacts/qa-analytics/results.json) aprovados. Axe executado nas 40 telas com JS, sem falhas; contexto sem JS teve revogação, captura e overflow próprios. As primeiras tentativas de executar axe com scripts desativados foram interrompidas; o harness foi corrigido, com finally de limpeza, e reexecutado com sucesso. Imagens representativas de mobile escuro, fallback e formulário de campanha inspecionadas.

81 unitários, 32 testes simulados do atualizador, TypeScript/lint (dois avisos anteriores), build .next-qa, Compose real/normalizado e HTTP de acesso/site passaram. Regressões de catálogo, marketing 11, transporte 12 e webhook 11 aprovadas com fixtures sintéticas. CLI/runtime empacotados novamente, incluindo migração 19. Prévia .next/3000 preservada; QA .next-qa/3001 encerrado. Fixtures concluíram seus finally/cleanup; a consulta independente final de contagens não foi executada porque a revisão automática de aprovação falhou por limite de uso. Não declarar censo final zerado sem essa consulta.

R11 possui implementação/testes locais; B07 continua parcial: falta inbox comercial comum, replay e atribuição de compra autenticada. Permanecem B08–B12/conectores/financeiro/retenção, homologação externa e revalidação da imagem/upgrade/banco vazio/restore das 19 migrations. Nenhum checkout real foi seguido; navegador bloqueou solicitações HTTP externas e registrou zero tentativas. Nenhuma API de conta, mensagem real, GitHub ou VPS. [Resumo e hashes D59](../artifacts/analytics/release-checks.json). Próxima ação: resolver indisponibilidade do revisor para conferir contagens; desenvolvimento independente pode avançar no contrato e inbox comercial B07 sem inventar eventos de provedor.


## Contrato comercial e conferência complementar — 24/10/2026 (D60)

A revisão automática voltou a funcionar após o horário informado. A consulta independente de contagens foi aprovada e concluída: owner, contatos, permissões/sessões/páginas/cliques/limites de analytics, disparos e eventos Brevo consultados estavam zerados; 19 migrations. O impedimento temporário registrado em D59 está resolvido, sem contornar a revisão. [Complemento da evidência](../artifacts/analytics/release-checks.json).

[Contrato](../src/modules/commerce/events.ts) e [projeção pura](../src/modules/commerce/projection.ts) comerciais implementados, com escopo por provider/conta, verificação antes de normalização, hash canônico, ignorados sem transação e bases explícitas de refund. Replay/ordem, operações repetidas/checkpoints, quantias tardias, conflitos, negativos explícitos e unknowns são tratados sem transformar clique em venda ou aprovação em dinheiro recebido. [Decisão D60](17-decisoes.md).

99 unitários e TypeScript/lint passaram (dois avisos anteriores na migração de sequências). Esses testes do contrato são independentes de banco, API e credenciais reais; não comprovam autenticação de Hotmart/Kiwify/Cakto ou persistência de inbox. Não houve nova migração/rota/worker comercial nesta etapa. O build/QA renderizado e regressões D59 permanecem evidência daquela etapa da aplicação; D60 não foi ligado aos fluxos públicos. [Resumo atual](../artifacts/commercial-domain/local-results.json).

Próxima ação B07: criar inbox/transações/histórico/auditoria privados com integridade, ingestão após adaptador verificado e ACK após commit, processamento com lease, replay administrativo e observabilidade. Preservar projeção em needs_review, resolver catálogo por IDs/conta sem adivinhar, não atribuir por email/IP/valor/horário, e testar conciliação de compra só com referência oficialmente suportada. Em seguida B08–B10, B11/B12 e critérios integrais do release. Objetivo completo ainda em desenvolvimento; GitHub/VPS permanecem com o proprietário.


## Continuação comercial D61 — 24/10/2026

Inbox/histórico/processamento/retry comuns possuem implementação local e [12 grupos de evidência](../artifacts/commercial-inbox/local-results.json), sem adaptadores nativos ou venda real. [Resumo com hashes/contagens](../artifacts/commercial-inbox/release-checks.json): 99 unitários, 33 testes simulados de deploy, build .next-qa, tipos/lint, runtime/Compose e regressões locais aprovados. Banco consultado após cleanup sem fixtures nas coleções verificadas, vinte migrações. Servidor QA encerrado; sem nova homologação visual, GitHub, VPS ou produção. Documentação de dados/contrato/arquitetura/operação/deploy/backlog/progresso/estado atual alinhada com limites de D61.


## Continuação do painel comercial D62 — 24/10/2026

Resumo, filtros, paginação, envelope/histórico readonly e retry owner implementados localmente. [Integração](../artifacts/commercial-admin/local-results.json), regressão da inbox, 104 unitários, build/tipos/lint e HTTP passaram. [46 capturas](../artifacts/qa-commercial-admin/results.json), 45 axe, teclado/foco/reflow e fallback sem JS aprovados; correções e limites no [resumo com hashes](../artifacts/commercial-admin/release-checks.json). Nada implantado no GitHub/VPS; vinte migrações, sem nova nesta etapa, e contagens verificadas após cleanup. Fontes históricas e paleta preservadas. Conectores nativos/financeiro/retenção/release completo continuam pendentes.


## Continuação Hotmart D63 — 24/10/2026

Conector nativo v2/endpoint ligados à inbox e documentados com fontes oficiais consultáveis/indexadas. [Integração](../artifacts/hotmart/local-results.json), [HTTP](../artifacts/hotmart/http-results.json), 122 unitários, 35 testes simulados, tipos/lint, build e Compose real/normalizado passaram. [Resumo/hashes](../artifacts/hotmart/release-checks.json) registra limites, regressões e limpeza com vinte migrations, sem nova. Nenhuma API/conta externa ou VPS acessada; homologação nativa real e sistema completo continuam pendentes. Histórico, paleta e conversas preservados.

## Validação D64 — Kiwify local (24/10/2026)

146 unitários/24 arquivos, sete grupos Kiwify locais e quatro HTTP aprovados. Regressões Hotmart sete locais/quatro HTTP, inbox 12 e painel comercial quatro; tipos, build final .next-qa, lint sem erros (dois avisos históricos), 37 testes simulados do atualizador e Compose real/frozen aprovados. Falha inicial de banco desligado e builds restritos com EPERM foram diagnosticados e repetidos com sucesso. QA encerrado/porta 3001 livre; contagens consultadas zeradas e vinte migrações preservadas, sem nova migração. Sem nova QA visual, conta, compra, API autenticada, GitHub ou VPS. [Evidências, hashes e limites](../artifacts/kiwify/release-checks.json), [contrato e fontes](integracoes/kiwify.md). Homologação real e projeto completo continuam pendentes.

## Validação D65 — Cakto V1/V2 e batch comercial (24/10/2026)

166 unitários/25 arquivos, nove grupos Cakto locais e quatro HTTP aprovados. Regressões Hotmart/Kiwify sete locais/quatro HTTP cada, inbox 12 e painel quatro; tipos, lint sem erros (dois avisos históricos), build .next-qa, 39 testes simulados do atualizador e Compose real/frozen aprovados. Rollback integral da segunda auditoria e conflitos simultâneos de duas transações exercitados, sem ACK parcial. Teste antigo ajustado para estreitar estado antes do acesso; let da fixture corrigido após lint. QA encerrado/porta livre; contagens consultadas zeradas e vinte migrações preservadas, sem nova migração. Sem nova QA visual, conta, compra, API autenticada, GitHub ou VPS. [Evidências, hashes e limites](../artifacts/cakto/release-checks.json), [contrato/fontes](integracoes/cakto.md). Projeto completo ainda não pronto para produção.

## Validação D66 — Prévia CSV comercial (24/10/2026)

182 unitários/26 arquivos, cinco grupos locais e quatro HTTP aprovados; tipos/lint sem erros (dois avisos históricos) e build isolado .next-qa aprovados. Pós-prévia, snapshots comerciais preservados; provider/conta, duplicata/conflito/catálogo, evidência de recebimento, owner/origem, limites e 201 identidades em blocos exercitados. Corrigidos callback Where tipado e precedência de Referrer-Policy após falha HTTP; build/rodada HTTP final aprovados. QA encerrado/porta livre; contagens consultadas zeradas e vinte migrações preservadas, sem nova migração. Sem UI/QA visual, confirmação/persistência de lote, financeiro ou homologação de fornecedor. [Evidências e hashes](../artifacts/commercial-csv/release-checks.json); [contrato e limites](24-conciliacao.md). Projeto completo ainda não pronto para produção.

## Validação D67 — Lotes/confirmação de conciliação (24/10/2026)

192 unitários/27 arquivos, dez grupos locais e quatro HTTP aprovados. Regressões inbox 12, Hotmart 7, Kiwify 7, Cakto 9, prévia 5 locais/4 HTTP, painel 4 e catálogo; tipos/lint (dois avisos históricos), build .next-qa, tipos/import map aprovados. Migração 21 aplicada localmente, up/down vazia em rollback e down bloqueada com registros; suite20 respeita dependência21. Revalidação/stale, UUID upper/lower, concorrência e rollback de 201 linhas exercitados. Ajustes de tipos/registro de coleção/fixture antiga registrados em progresso; rodada final aprovada. QA encerrado, contagens consultadas zeradas e 21 migrações preservadas. Diff de produto limpo; log gerado alheio com EOF vazio preservado. Sem UI/QA visual, conta, venda ou deploy. [Evidências/hashes](../artifacts/commercial-imports/release-checks.json), [contrato/limites](24-conciliacao.md). Confirmação é fila, não aplicação/liquidação; R15 parcial/R16 pendente, projeto completo ainda não pronto para produção.

## Revisão documental D68 — Estado e pendências (24/10/2026)

Revisão de documentação contra código e relatórios até D67; criado [pendencias.md](../pendencias.md), agora coberto pelo validador oficial. Atualizados inventários, interfaces CSV, estado/backlog, orientação operacional e distinção entre implementação local, homologação e produção. Preservadas fontes históricas e evidências das etapas anteriores.

Executados python3 scripts/validar_documentacao.py e git diff --check do produto, excluindo .local-logs gerado/preexistente. A primeira execução identificou link incorreto para a matriz visual no novo documento; link corrigido para docs/design/07-qualidade.md e validação repetida com sucesso. São 49 documentos, 34 requisitos, 20 tarefas, 29 cenários e 76 pares de contraste; URLs externas apenas inventariadas, sem consulta de rede. O [relatório final](../artifacts/documentation/documentation-review-2026-10-24.json) registra resultado e contagem final de links.

Hashes comparados com o início desta revisão: 343 dos 344 arquivos técnicos/históricos preservados; única mudança técnica é a inclusão do novo documento em scripts/validar_documentacao.py. Os 192 unitários e grupos de integração/HTTP citados no estado atual são resultados anteriores da D67, sem reexecução nesta revisão. Sem acesso a banco/contas/VPS, envio ou operação comercial. Pendências de produto e release continuam abertas.

## Manutenção de raiz, controle local e CI — D69 (24/10/2026)

Consolidados comandos de raiz: atualizar.sh permanece e altualizar.sh foi removido; wrappers locais start/stop compartilham scripts/local-dev.py. Controle por identidade kernel/sessão/checkout, lock, porta, saúde e grupo de processos, sem adotar prévia existente; opção --keep-db e recusa de registro legado ativo. README e documentação de execução atualizados; .nvmrc/.editorconfig/.gitattributes acrescentados; .gitignore/.dockerignore incluem estado/logs. .local-logs/next.log foi retirado somente do índice Git, preservado no disco; sem commit/push.

Workflow com execução manual/concurrency, permissões de leitura e checkout sem credencial persistida; checks sem banco antes de integrações sequenciais em PostgreSQL descartável. Dois runners compartilham a lista completa das suítes de integração/HTTP e exigem confirmação de ambiente sintético. Harness HTTP impede testes sem saúde e limpa o grupo na falha/sucesso/sinal. Ações e versões de dependências mantidas; Node compartilhado via .nvmrc.

Checks aprovados: TypeScript, lint (dois avisos históricos), 192 unitários/27 arquivos, 57 testes de operação (39 existentes e 18 novos), documentação, sintaxe Bash e estrutura YAML/blocos do workflow. Os testes novos usam subprocessos/árvores/comandos temporários: PID reciclado/checkout divergente, servidor alheio, registro legado/corrompido, start idempotente/falha, keep-db, wrappers fora do cwd, cobertura das suítes e harness HTTP em sucesso/falha. Um ResourceWarning da fixture de background foi eliminado mantendo/recolhendo explicitamente o filho no teste. Nenhum processo da aplicação/banco existente foi iniciado ou parado.

[Relatório e hashes D69](../artifacts/maintenance/root-files-2026-10-24.json). Não executados banco/HTTP da aplicação, build de produto, navegador, imagem/restore, conta de fornecedor, GitHub ou VPS nesta manutenção. Sintaxe YAML local não comprova execução real do workflow. Sem mudanças no domínio comercial/migrations ou resolução das pendências B11. Próxima implementação permanece P01/P02; projeto completo ainda não pronto para produção.
