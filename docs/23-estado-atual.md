# 23 — Estado atual e mapa da implementação

[Índice](../README.md) · [Retomada](14-progresso.md) · [Backlog](13-backlog.md) · [Histórico técnico](19-desenvolvimento.md)

Fotografia documental revisada em 24/10/2026 (D68), com manutenção de raiz/CI D69 registrada abaixo, America/Belem, contra código, índice de migrations e relatórios existentes até D67. D68 não reexecutou aplicação/banco; D69 reexecutou checks estáticos e 192 unitários, além de testes de operação sintéticos. Nenhuma dessas revisões homologou contas/VPS ou repetiu a bateria de banco/HTTP da aplicação. O [inventário de 21/10](../artifacts/documentation/state-audit-2026-10-21.json) é histórico; a evidência local mais recente está no [release D67](../artifacts/commercial-imports/release-checks.json). Consulte [pendencias.md](../pendencias.md) para o plano de conclusão. Datas ISO dos artefatos podem estar em UTC.

## Situação do produto

Existe aplicação local funcional, com vitrine, painel manual e parte do relacionamento. **O projeto completo ainda não está pronto para produção.** Medição consentida e inbox/histórico comerciais comuns possuem implementação local D59/D61. Hotmart possui adaptador/endpoint nativos locais D63, desligados e sem homologação; Kiwify possui adaptador/endpoint locais D64, desligados e sem homologação; Cakto possui adaptador/endpoint V1/V2 locais D65, desligados e sem homologação; B11 possui prévia CSV D66 e lotes/linhas duráveis com confirmação auditada limitada D67; atribuição de compra, resolução de divergências, liquidação/custos, financeiro, retenção e operação comercial permanecem pendentes. Teste sintético não comprova homologação de fornecedor, publicação ou venda.

O proprietário autorizou implementação e testes locais; GitHub e deploy na VPS ficam com ele. Git local conferido em 24/10: commit 74fe451 existente; nenhum commit/push feito pelo agente nesta continuação. Sem execução de CI no GitHub comprovada ou acesso à VPS. Lotes promocionais duráveis foram acrescentados/testados localmente em 22/10; ver atualização final D48.

Primeiro título: **Crie Sistemas com IA e Ganhe Dinheiro**. Domínio informado: **bibliotheon.com.br**; responsável: **Warley Ferraz Almeida**. E-mail público fica vazio por decisão do proprietário, que o acrescentará antes da produção. Público específico, arquivos, preço, checkout e elegibilidade ainda precisam ser conferidos. Subdomínios não foram definidos. Ver [lançamento](22-lancamento.md).

Invariantes vigentes: nenhuma IA no produto; cadastro manual no Payload; checkout/entrega externos; Hotmart, Kiwify e Cakto mantidos separadamente; nenhuma avaliação, escassez ou renda inventada; clique, aprovação, recebimento e lucro são conceitos distintos. As duas conversas históricas são preservadas por hash.

## O que existe no código

| Área | Implementação presente | Limite atual |
|---|---|---|
| Base e acesso | Next/Payload/PostgreSQL, owner único, provisionamento privado, REST/Local API protegidas, GraphQL desabilitado, healthchecks | MFA/allowlist/VPN e operação do host não homologados |
| Editorial | Temas, livros, artigos, mídia, amostras, ofertas, campanhas e redirects; drafts, preview e validação de publicação | Fixtures não são livros/ofertas reais |
| Vitrine | Home, catálogo/busca/filtro/paginação, três LPs, artigos/temas, institucionais, sitemap/robots | Indexação exige revisão institucional; performance de campo não medida |
| Checkout | URL por host exato/provedor, oferta atual, campanha afiliada sem fallback, contexto c preservado em slug histórico | Nenhuma compra é confirmada por redirect; sem atribuição comercial implementada |
| Amostras | Captura, confirmação por POST, PDF privado temporário, consentimento opcional e descadastro | Captura e transporte desligados; sem contato público legalReady permanece falso |
| E-mail solicitado | Outbox, jobs, dispatcher, tokens só em hash, transporte Brevo transacional e classificação de falhas | Testes em memória; nenhum envio real ou remetente homologado |
| Supressão | Serviço, API owner/origem exata, formulário e CLI; auditoria por referência HMAC, fila outbound e callback inbound D58 | Testados localmente e desligados; homologação Brevo pendente |
| Cadastro consentido Brevo | Fila atômica com opt-in confirmado; reconciliação, lease e compensação tardia, listas/rascunhos/transporte/observação | Testes sintéticos locais D51–D58; flags false e conta não homologada |
| Conectores nativos | Hotmart D63, Kiwify D64 e Cakto V1/V2 D65; autenticação e recepção durável com fixtures | Endpoints locais desligados por padrão; contas/relatórios/reenvios ainda não homologados |
| Conciliação CSV | Prévia D66, lotes/linhas/auditoria privados e confirmação idempotente/revalidada D67 | Confirmação limitada para inbox; 202 queued não é aplicação; resolução, liquidação/custos/relatório e UI customizada pendentes |
| Inbox comercial | Recepção interna durável, conflitos, projeções/fatos/auditoria, lease/backoff, CLI/worker e retry owner | D61/D62 locais; acompanhamento/retry visuais; atribuição, resolução auditada e liquidação pendentes; QA por etapa na seção final |
| Recuperação do owner | CLI por stdin privado, senha nova, revogação de sessões/tokens e limpeza de lockout | Recuperação por e-mail indisponível; forgot/reset 503 genérico, unlock público negado |
| Sequências | Conteúdo manual revisado, snapshot imutável por inscrição, calendário D+2/4/7/10, elegibilidade e cancelamento | Agrupamento durável local; sem campanhas externas ou envio real; transporte sintético D56 validado |
| Quota | Contabilidade compartilhada por destinatário/dia UTC, teto até 250 e reserva transacional padrão 50; lock e rollback | Reserva ligada ao claim e à intenção de disparo no mesmo commit; worker opcional com flag false |
| Apresentação | Fontes locais, tokens canônicos, claro/escuro/system, variantes/acento por enum, extensões Payload e patches locais de acessibilidade | B20 parcial; formulários e telas futuras exigem novas rodadas |
| Infraestrutura | Dockerfile, Compose, perfis app/migrate/worker, runtime limitado, CLIs empacotadas e backup/restore com restic | Imagem e restauração testadas em revisão anterior; reconstruir/revalidar estado atual antes de release |

Implementação em [coleções](../src/collections/Relationship.ts), [configuração Payload](../src/payload.config.ts), [catálogo](../src/modules/catalog/public.ts), [checkout](../src/modules/commerce/resolve.ts), [relacionamento](../src/modules/marketing/service.ts), [calendário](../src/modules/marketing/sequence.ts), [quota](../src/modules/marketing/quota.ts) e [transporte transacional](../src/integrations/brevo/transactional.ts). Brevo possui clientes transacionais/marketing/callback testados localmente; o domínio comercial comum inclui contrato, projeção, inbox e worker. Hotmart v2, Kiwify e Cakto V1/V2 possuem adaptadores/endpoints nativos locais D63–D65. Nenhum homologado em conta.

## Requisitos: implementação, evidência e lacuna

Esta matriz não altera os aceites de [R01–R34](02-requisitos.md). “Local” descreve evidência sintética, sem concluir homologação externa ou operação real. “Parcial” indica que o aceite completo ainda não foi atendido. As referências de evidência abaixo são detalhadas na próxima seção.

| Requisito | Estado observado | Evidência e trabalho restante |
|---|---|---|
| R01 | Local, para as coleções existentes | AdminUsers/access, teste de acesso e recuperação; futuras coleções também deverão negar anônimo |
| R02 | Local | Ebooks e test:catalog; drafts e revisão publicada preservados |
| R03 | Local | Catálogo, test:site e estados 0/1/20; busca, filtro, paginação e vazio |
| R04 | Parcial | LPs/preview testados com fixtures; falta material e oferta reais revisados |
| R05 | Local, cadastro das três plataformas | Offers e teste de catálogo; contas/elegibilidade/URLs reais não conferidas |
| R06 | Local | ResolveCheckout, índice de primária e test:site; nenhuma comprovação de compra |
| R07 | Local | Artigos/temas/SEO/slugs e test:site; conteúdo e liberação institucional reais pendentes |
| R08 | Local, captura desativada | test:marketing e QA de relacionamento; revisão institucional/remetente antes de coletar |
| R09 | Parcial | Consentimento, descadastro e supressão local testados; bloqueios outbound testados com HTTP sintético; preflight importa bloqueio pontual; callback e sincronização/observação locais D58 presentes; falta homologação na conta Brevo |
| R10 | Parcial | Calendário, quota, lotes/claim e falhas/retentativas testados localmente; transporte/sincronização/observação de campanha testados localmente; callback e conciliação individual testados localmente em D58; falta homologação Brevo |
| R11 | Implementado/testado localmente; release pendente | D59: consentimento, Visit/PageView/CheckoutClick, UTMs controladas, endpoint de events, gerador e resumo; clique permanece distinto de compra. Inbox/histórico/retry locais D61; atribuição de compra pendente |
| R12 | Parcial, local | Adaptador/endpoint Hotmart v2, inbox e HTTP D63; conta, atribuição, relatório e homologação pendentes |
| R13 | Parcial | Adaptador/endpoint Kiwify nativos locais D64; HMAC, inbox e centavos testados. Conta, relatório, tempos de reversão e homologação pendentes |
| R14 | Parcial | Adaptador/endpoint Cakto V1/V2 locais D65; assinatura/janela e lote atômico testados. Conta, relatório, MED e homologação pendentes |
| R15 | Parcial | Prévia D66 e lotes/linhas duráveis, confirmação idempotente/auditada/revalidada para inbox D67; resolução de conflitos, exportação financeira e UI pendentes |
| R16 | Parcial, domínio local | Histórico/projeção D61; custos, liquidação e relatório financeiro ainda não implementados |
| R17 | Parcial | Cadastro de campanha/hipótese existe; tarefas, prazo e kit autorizado pendentes |
| R18 | Pendente | Título escolhido; sem lançamento, três conteúdos ou distribuição comprovados |
| R19 | Pendente | Modelo semanal existe; relatório conciliado e rotina comercial ainda não executados |
| R20 | Parcial | Rodadas públicas/admin sem falhas nos recortes testados; não certifica teclado/AA de todo o produto futuro |
| R21 | Pendente de medição | Build passou; não há evidência de orçamento completo de laboratório ou p75 real |
| R22 | Parcial, local | Acesso, uploads, tokens e origem testados; preservação em troca recusada/rollback e coleta com carência testadas em seis grupos; imagem atual ainda pendente |
| R23 | Parcial, local | Container limitado e banco privado testados; VPS/proxy/baseline não inspecionados |
| R24 | Parcial, local | Restore criptografado e mídia verificados em dataset anterior; destino externo/RPO/RTO reais pendentes |
| R25 | Parcial, local | Inbox/histórico duráveis, retorno após commit, replay/retry e auditoria D61; acompanhamento/retry visuais D62; recepção nativa local nos três provedores D63–D65; homologação externa pendente |
| R26 | Parcial | Consentimento/revogação implementados; retenção, exportação/exclusão e reaplicação após restore não executáveis ainda |
| R27 | Local | Fontes, tokens, briefing e QA de fundação; continuar aplicando em telas novas |
| R28 | Parcial | Tema persistente/system/fallback testados em site/painel; relacionamento e inbox visuais locais; importação/resolução/financeiro e matriz completa ainda pendentes |
| R29 | Parcial | Contrastes e controles atuais testados em recortes; matriz integral de estados permanece aberta |
| R30 | Local | Três variantes e acentos controlados, test:catalog/site e QA público; sem CSS livre |
| R31 | Parcial | Seis larguras, 320px e texto 200% em rodadas específicas; zoom nativo 400% e matriz integral pendentes |
| R32 | Parcial | Reduced-motion e ordenação nativa por teclado aprovados; repetir para telas/interações futuras |
| R33 | Parcial | Painel editorial e relacionamento testados; telas/estados financeiros dependem de R16 |
| R34 | Parcial | Relatórios renderizados e screenshots existentes; falta homologação completa da fase 2 e do release final |

## Evidências conferidas

Os relatórios representam revisões distintas. Não somar screenshots como uma única bateria da versão atual nem usar teste de uma tela para certificar todas. Screenshots demonstram renderização local, não conversão ou conformidade integral WCAG.

| Evidência | Resultado registrado | Limite |
|---|---|---|
| [Última bateria da aplicação: D67](../artifacts/commercial-imports/release-checks.json) | 192 unitários/27 arquivos, dez grupos de importação e quatro HTTP; regressões, tipos, lint e build aprovados | Execução anterior à revisão documental D68; sem nova QA visual, imagem, conta ou deploy |
| Verificação histórica do baseline de 21/10 | 29 testes/9 arquivos unitários, tipos aprovados, lint sem erros e com 2 avisos | Logs da última execução conferidos; testes não reexecutados nesta revisão documental |
| Build standalone registrado no histórico | Webpack 18,3s, TypeScript 16,7s, build concluído | Não é imagem atual homologada ou deploy |
| [HTTP do build final](../artifacts/qa-admin-editorial/runtime-smoke.json) | Listagem de livros autenticada 200 | Conferência HTTP; não é nova rodada visual |
| [Relacionamento](../artifacts/marketing/local-results.json) | 11 grupos, incluindo concorrência, quota, rollback, timeout e permissões | Transporte em memória; conta externa não homologada |
| [Sequências](../artifacts/sequences/local-results.json) | 7 grupos, datas/snapshot/cancelamento/versão/permissões e PDF preservado | Não testa lote ou disparo promocional |
| [Recuperação administrativa](../artifacts/admin-recovery/local-results.json) | 5 grupos, revogação e senha nova/antiga | Conta sintética; sem recuperação por e-mail |
| [Fundação pública](../artifacts/qa-foundation/results.json) e [login/dashboard](../artifacts/qa-foundation/admin-results.json) | 14 e 4 telas, sem falhas registradas | Recortes específicos |
| [Vitrine](../artifacts/qa-phase1/results.json) e [estados do catálogo](../artifacts/qa-phase1/catalog-states-results.json) | 170 e 36 telas, sem falhas registradas | Fixtures; não comprova R21/400%/venda |
| [Painel editorial](../artifacts/qa-admin-editorial/results.json) | 20 telas; teclado, rascunho e rolagem reduzida aprovados | Formulários editoriais em 390/1440; não todos em seis larguras |
| [Amostras e preferências](../artifacts/qa-relationship/results.json) | 84 telas, sem falhas registradas | Envio em memória |
| [Supressão administrativa](../artifacts/qa-suppressions/results.json) | 36 telas e 4 grupos de API/fluxo | Sem sincronização Brevo |
| [Calendário](../artifacts/qa-sequences/results.json) e [revisão do snapshot](../artifacts/qa-sequences/snapshot-review/results.json) | 48 e 12 telas, cadastro nativo, sem falhas registradas | Calendário local; snapshot somente leitura |
| [Container](../artifacts/container/local-results.json) | Saúde, não root/read-only, DDL negado, fila vazia e heartbeat aprovados | Imagem anterior às CLIs, migração de sequências e quota atuais |
| [Restauração](../artifacts/recovery/local-results.json) | Banco/mídia recuperados, sobrescrita recusada, envio não iniciado | Repositório local de laboratório, revisão anterior; sem backup externo |
| [Auditoria de dependências](../artifacts/security/audit-2026-10-21.json) | Zero vulnerabilidades conhecidas naquela consulta de produção | Não reconsultada nesta revisão; não certifica segurança integral |

## Banco, versões e artefatos

Host local Node 22.23.4 conferido em 24/10; imagem/CI fixam Node 22.23.3 e manifesto fixa pnpm 10.34.7; Next 16.4.2, React 19.3.1, Payload 3.91.0 e Sharp 0.35.5 fixados em [package.json](../package.json)/lockfile. PostgreSQL 17.9 por digest no Compose. Overrides e patches locais de Payload estão versionados; instalação exige lockfile e revalidação ao atualizar. Não houve instalação global de skills de referência.

21 migrações declaradas em [migrations/index.ts](../migrations/index.ts), conferidas no código nesta revisão documental. Aplicação local das 21 registrada na D67; o banco não foi consultado novamente na D68. Ordem:

1. 20261021_012104_initial
2. 20261021_013444_catalog
3. 20261021_104729_public_site
4. 20261021_121334_relationship
5. 20261021_155133_relationship_jobs
6. 20261021_155500_relationship_invariants
7. 20261021_233105_sequences
8. 20261022_051922_promotion_batches (acréscimo e aplicação local em 22/10)
9. 20261022_053258_brevo_suppressions (fila e preenchimento de bloqueios históricos locais)
10. 20261022_054929_provider_preflight (conferência e action própria de bloqueio observado)
11. 20261022_060415_brevo_registrations (cadastro consentido, backfill e compensação)
12. 20261022_110941_brevo_batch_lists (manifesto e composição exclusiva por lote)
13. 20261022_115043_brevo_preferences (intenção de links individuais e prova mínima)
14. 20261022_120651_brevo_campaign_drafts (manifesto privado de rascunhos e inventário de IDs)
15. 20261022_123536_brevo_campaign_sends (tentativas de disparo e estados de retorno)
16. 20261024_064354_brevo_campaign_observations (fila e prova separada de atividade por campanha)
17. 20261024_070440_brevo_webhook_events (envelopes privados e resultados por etapa)
18. 20261024_071409_brevo_send_recipients (identidade HMAC imutável antes de POST, sem backfill inventado)
19. 20261024_073316_analytics (consentimento/sessões/páginas/saídas/limites próprios e Campaign.utmTerm)
20. 20261024_115633_commercial_inbox (inbox, conflitos, transações/fatos e auditoria privados)
21. 20261024_190859_commercial_imports (lotes, linhas e auditoria da conciliação)

O [censo após cleanup da D67](../artifacts/commercial-imports/cleanup-counts.json) registrou owner/contatos e oito tabelas comerciais/importações consultadas zerados, com 21 migrations preservadas. É fotografia de testes locais, não censo comercial nem consulta repetida nesta revisão. Ensaios antigos de down/up em transação revertida não autorizam rollback destrutivo. A migration 21 recusa downgrade com registros. A imagem de laboratório anterior não comprova banco vazio, upgrade e restore das 21 migrations atuais; repetir antes do release.

Prévia gerenciada usa .next/porta 3000; QA standalone usa .next-qa/porta 3001 ou outra livre, com NEXT_DIST_DIR/TEST_BASE_URL. Não sobrescrever caches entre processos. O servidor de QA da última rodada foi encerrado; não presumir uma porta atualmente ativa só porque houve teste anterior.

## Rotas e comandos existentes

Inventário de código, sem substituir os contratos de [interfaces](06-interfaces.md). Events consentidos, inbox/retry, três webhooks nativos e importação limitada existem localmente. Relatórios financeiros permanecem previstos; nenhuma rota nativa implica homologação externa.

| Grupo | Rotas existentes |
|---|---|
| Público | /, /ebooks, /ebooks/[slug], /artigos, /artigos/[slug], /temas/[slug], /[institutional], /robots.txt, /sitemap.xml |
| Conteúdo privado/saída | /preview/ebooks/[id], /comprar/[offerId], /api/v1/media/[id] |
| Relacionamento | /amostras/[slug], /amostras/confirmar, /preferencias; POST /api/v1/lead-requests, /api/v1/lead-confirmations, /api/v1/unsubscribe; GET /api/v1/downloads/[token] |
| Admin | /admin e /admin/suppressions; POST /api/v1/admin/suppressions; CRUD/autenticação Payload /api/[...slug] protegido |
| Medição | POST /api/v1/analytics-consent, /api/v1/analytics-withdrawal e /api/v1/events; aviso e retirada nas páginas públicas |
| Inbox comercial | /admin/commercial-inbox; POST /api/v1/admin/inbox/[id]/retry |
| Recepção comercial | POST /api/v1/webhooks/hotmart, /api/v1/webhooks/kiwify, /api/v1/webhooks/cakto |
| Conciliação CSV | POST /api/v1/admin/imports/preview, /api/v1/admin/imports e /api/v1/admin/imports/[id]/commit; coleções privadas somente leitura |
| Saúde | /health/live, /health/ready |

| Comando/ferramenta | Finalidade |
|---|---|
| npm run dev / build / start | Desenvolvimento, build e runtime standalone |
| npm run lint / typecheck / test; bash scripts/check-local.sh | Verificações estáticas, unitárias e documentação |
| npm run payload; npm run db:migrate | CLI CMS e aplicação de migrations; não executar contra banco real sem procedimento de release |
| npm run generate:types / generate:importmap | Geração explícita; autoGenerate desativado, CI confere diferença dos gerados |
| npm run admin:create / admin:recover / suppression:apply | Operação privada por stdin; nunca senha, token ou dados pessoais em argumentos/documentação |
| npm run worker | Jobs solicitados, filas Brevo e inbox comercial conforme flags independentes; pode operar sem SMTP; requer configuração privada e homologação de cada modo |
| npm run commerce:process | Processamento privado da inbox conforme scripts do manifesto; consultar execução local antes de operar |
| npm run promotions:prepare | Até 100 etapas por execução, somente elegibilidade local; sem quota ou envio promocional |
| npm run test:integration / test:catalog / test:site | Acesso, domínio editorial e HTTP público |
| npm run test:marketing / test:sequences / test:admin-recovery | Domínio de relacionamento, calendário e recuperação por operador |
| npm run brevo:suppressions / brevo:contacts / brevo:lists / brevo:preferences / brevo:campaigns / brevo:send / brevo:observe / brevo:webhook-replay | CLIs privados para bloqueios, cadastro, listas, links individuais e rascunhos e transporte; flags separadas, envio real desligado |
| npm run test:batches / test:preflight / test:preferences / test:brevo-sync / test:brevo-contacts / test:brevo-lists / test:brevo-preferences / test:brevo-campaigns / test:brevo-send | Fixtures sequenciais dos contratos promocionais locais |
| scripts/qa-*.ts; scripts/qa-container.py | QA renderizado, restore e container; comandos em execução local/pacote de produção |
| node scripts/build-runtime.mjs | Empacota migrate, create-admin, recover-admin, apply-suppression, prepare-promotions, media-gc, sync-brevo-suppressions, sync-brevo-registrations, prepare-brevo-list, prepare-brevo-preferences, prepare-brevo-campaign, send-brevo-campaign, observe-brevo-campaign, replay-brevo-webhook, process-commercial, worker e worker-health em .release |
| python3 scripts/check-compose.py; ops/recovery.py | Configuração e backup/restore; ver procedimento de produção |
| python3 scripts/generate-tokens.py; python3 scripts/validar_contrastes.py; python3 scripts/validar_documentacao.py | Tokens, contrastes e estrutura documental; contraste padrão não mutante |

Comandos de integração/QA que criam owner ou fixtures usam banco sintético e são executados **sequencialmente**. Check estático não substitui build, integração, navegador, imagem ou homologação. O workflow em .github/workflows/quality.yml prepara geração, validação, testes, migrations, build e testes HTTP; não instala navegador, não executa toda a matriz de screenshots nem constrói/homologa imagem. Não há execução comprovada no GitHub.

## Pendências concretas e ordem de retomada

O plano vigente está em [pendencias.md](../pendencias.md), com responsáveis, dependências e critérios de conclusão. Próxima implementação: resolução auditada de divergências e identidades históricas B11, preservando fatos e bloqueando novas duplicidades. Seguir com ampliação segura da conciliação, liquidação/custos/relatório, UI e retenção B12. Hotmart/Kiwify/Cakto possuem código local; cada provedor e Brevo ainda exigem homologação própria.

Antes de produção: bateria do release atual com 21 migrations em banco vazio/upgrade/restore; segurança, privacidade, matriz visual, zoom/performance, inventário da VPS compartilhada e backup externo. GitHub e deploy ficam com o proprietário. B13–B15 tratam operação/campanha inicial; B16 é expansão condicionada, sem bloquear o primeiro deploy técnico por si só.

Aviso pg/Drizzle nas fixtures sem causa específica resolvida e dois avisos históricos de lint seguem registrados. O erro SortColumn/useListQuery anterior não se repetiu no build limpo, sem causa provada. Preservação/coleta de mídia D47 passou localmente; ainda precisa de homologação na imagem atual. Checks verdes parciais não eliminam essas limitações.

## Como manter este estado confiável

Após cada entrega, atualizar esta fotografia e a próxima ação em progresso; registrar a execução cronológica no documento 19 e associar evidências ao backlog/requisitos. Marcar separadamente implementação, teste local, homologação externa e publicação. Não transformar textos históricos como “em execução” ou “não implementado nesta entrega” em estado vigente. Rodar o validador documental e os checks proporcionais à mudança. O inventário desta revisão é datado, não se atualiza sozinho.

## Histórico das atualizações

As seções datadas abaixo registram o estado de cada entrega. Quantidades antigas de migrations/testes e próximas ações referem-se àquela etapa; o inventário vigente está nas seções anteriores e em [pendencias.md](../pendencias.md).

## Atualização: ferramentas de deploy — 22/10/2026

Criados [deploy.md](../deploy.md), [atualizar.sh](../atualizar.sh), alias então chamado altualizar.sh (retirado em D69) e [orquestrador](../ops/deploy.py). Configuração privada fora do Git; pull fast-forward; imagem de tag local exclusiva e ID verificado; backup externo antes de migrations; saúde local/pública; worker opcional. Inclui lock, checkpoint, retomada explícita, backup avulso e agendamento documentado. D46 autoriza a alternativa de build na VPS, condicionada à capacidade; não altera a arquitetura da aplicação nem o contrato de checkout.

Testes novos em tests/ops simulam Git/Docker/HTTP e verificam falhas, retomada, exclusão mútua, permissões/configuração e minimização dos logs. scripts/qa-deploy-config.py confere o Compose real e seu JSON normalizado com fixture sintética, inclusive cifrões; não inicia serviços. Bash/Python/CLI verificados. CI e check-local incluem os testes novos, sem execução GitHub comprovada. Evidências finais no [relatório local](../artifacts/deploy/local-results.json) e no documento 19.

Não houve atualização real de VPS, DNS, proxy ou repositório Git. Um container temporário da imagem restic já em cache foi criado sem iniciar, usado apenas para conferir /usr/bin/restic/versão e removido; não constitui novo ensaio de backup. Imagem/restore do produto atual e infraestrutura real continuam pendentes, assim como B06–B16. O inventário/hash de 21/10 permanece histórico e não representa estes arquivos novos. Projeto completo ainda não pronto para produção.

## Integridade de mídia — 22/10/2026

D47 corrige a perda de bytes em substituição recusada/rollback, mantendo substituição válida. [Teste dedicado](../tests/integration/media-integrity.ts) e [relatório](../artifacts/media-integrity/local-results.json): seis grupos, arquivos sintéticos, diretório temporário exclusivo e PostgreSQL loopback. Coleta sob lock consulta referências atuais, ignora links/nomes desconhecidos, falha com índice inválido e exige 24h desde primeira observação persistida. Sem nova migration. npm run media:gc é simulação; -- --apply modifica. CLI incluído no empacotamento; backup diário do atualizador chama coleta após confirmar snapshot, antes de retomar app/worker. Os 24 testes simulados do orquestrador incluem falha da coleta. Nenhum backup externo, integração real ou deploy nesta rodada.

Revalidação desta rodada: instalação congelada; TypeScript; lint com os dois avisos antigos; 29 unitários; catálogo; sete grupos de sequências; seis de mídia; 24 testes simulados de deploy; Compose real sem iniciar containers; build limpo .next-qa; CLI empacotado em ajuda/simulação; permissões HTTP e rotas públicas em 127.0.0.1:3001. Servidor QA encerrado. [Resultados e hashes](../artifacts/media-integrity/release-checks.json). Sem nova homologação visual ou imagem Docker. O relatório de deploy anterior com 23 testes é uma fotografia anterior à D47.

## Lotes promocionais — 22/10/2026 (D48)

Coleção privada email-campaign-batches e referência batch nas etapas; oitava migração aplicada localmente. Preparação persiste cópia e conjunto de referências, agrupa por tema/etapa/dia/revisão/oferta/contexto afiliado e conta cada destinatário uma vez. Claim interno revalida consentimento, material, pausa e oferta e reserva quota na mesma transação; duplicata não reserva novamente, falha reverte estado/quota. Quota insuficiente adia lote indivisível para próximo dia UTC; inelegibilidade cancela o lote e libera etapas para reagrupamento sem apagar histórico.

[Seis grupos de integração](../artifacts/promotion-batches/local-results.json), sete de sequências e 11 de marketing aprovados; 31 unitários. Worker e CLI promotions:prepare somente montam lotes; claim fora do worker até sincronização/transporte/conciliação Brevo. Sem chamadas externas, mensagens promocionais, novas telas homologadas ou operação real. Estado prepared/claimed não prova aceitação nem entrega.

Instalação congelada, TypeScript/lint, 31 unitários, 24 testes simulados de deploy, import map inalterado, build isolado e CLI de preparação aprovados. HTTP confirmou leitura/criação anônima negadas para lotes/etapas e leitura do owner autorizada; regressão pública aprovada. Servidor QA encerrado. [Resumo e hashes da D48](../artifacts/promotion-batches/release-checks.json). Imagem Docker/restore e homologação visual seguem pendentes.

## Bloqueios outbound — 22/10/2026 (D49)

brevo-suppressions implementada com nona migração aplicada somente no PostgreSQL local. Intenção transacional junto do descadastro/supressão, revisão e lease, backoff e retry explícito; GET/PUT/GET monotônicos sem troca de identidade ou criação de contato ausente. Oito grupos de integração com transporte sintético aprovados, incluindo up/down/backfill em transação revertida. Nenhuma chamada real. Flag independente BREVO_CONTACT_SYNC_ENABLED=false; worker pode operar apenas bloqueios sem SMTP, ou via CLI privado. Nova inscrição não reativa contato no provedor automaticamente. Sincronizado não comprova envio/entrega e é observação pontual. Inbound/listas/campanhas/preferências/conciliação promocional continuam pendentes. [Evidência](../artifacts/brevo-suppressions/local-results.json).

Revalidação da D49: instalação congelada, TypeScript/lint (dois avisos anteriores), 38 unitários, 25 testes simulados de deploy, 11 grupos de marketing, sete de sequências e seis de lotes aprovados. Build isolado, CLI e worker desativados, Compose real com flag false, HTTP de acesso/supressão com outbox e regressão pública aprovados; QA encerrado. [Resultados e hashes](../artifacts/brevo-suppressions/release-checks.json). Nenhuma nova homologação visual ou imagem Docker/restore.

## Conferência de destinatários — 22/10/2026 (D50)

Décima migração aplicada localmente. Claim interno exige consultas positivas recentes, prova privada vinculada ao lote/destinatários/versões locais e nova revisão sob locks antes de reservar quota. HTTP fora da transação; falta/expiração/ausência/falha segura o lote sem quota. Observação de blacklist tem action provider_blocked e não é classificada como bounce/complaint. Bloqueio local/auditoria/outbox atômicos; amostra solicitada preservada quando deliveryState continua ok. Downgrade recusa perda/reclassificação dos registros novos.

[Sete grupos locais](../artifacts/provider-preflight/local-results.json) aprovados, mais 40 unitários. Identidade divergente e replay não criam contato ou duplicam auditoria. Sem API real, webhook, listas/campanhas, criação de contato ou envio; claim fora do worker. Preflight pontual não substitui revalidação do transporte futuro.

Revalidação D50: TypeScript/lint (dois avisos anteriores), 40 unitários, 25 testes simulados de deploy e regressões de lotes/bloqueios/marketing/sequências aprovados. Instalação congelada e import map inalterado; build isolado/CLIs aprovados. HTTP confirmou acesso, supressão com outbox e recusa 422 de action forjada; site público aprovado e QA encerrado. [Resumo e hashes](../artifacts/provider-preflight/release-checks.json). Nenhuma nova homologação visual, imagem Docker/restore ou operação real.

## Cadastro consentido — 22/10/2026 (D51)

Décima primeira migração aplicada localmente. Fila brevo-registrations atômica com confirmação de marketing, privada por contato; só confirmados com assinatura ativa e sem bloqueio são elegíveis. Cliente consulta, cria somente ausente sem atualização/merge, reconfirma por GET e não reativa existente. Revisão/lease e contagem preservada protegem resultado antigo. Descadastro em voo mantém compensação canceling com GET/PUT e backoff, mesmo com novos cadastros desativados; 404 isolado não encerra criação incerta. Flag nova false exige bloqueios e chave privada de links. Down recusa perder tentativas/IDs.

[Dez grupos de integração](../artifacts/brevo-registrations/local-results.json), 45 unitários e regressões aprovados. Sem conta/API real, listas/campanhas, preferências promocionais, webhook ou envio. Registro não autoriza campanha: preflight e quota continuam obrigatórios. Identidade não é editável por API; alteração indevida exige revisão, sem retry automático.

Revalidação D51: 26 testes simulados de deploy, marketing/sequências/lotes/bloqueios/preflight, TypeScript/lint (dois avisos anteriores), instalação congelada/import map inalterado, build isolado e empacotamento final de CLIs/worker aprovados. CLI de cadastro habilitado foi exercitado com HTTP interceptado e persistência no PostgreSQL sintético; configurações inválidas/desligadas também conferidas. HTTP de coleção privada/supressão/outbox e site público passaram; QA encerrado. [Resumo e hashes](../artifacts/brevo-registrations/release-checks.json). Nenhuma imagem/restore atual, nova homologação visual ou conta real validada.

## Listas exclusivas de lote — 22/10/2026 (D52)

12a migração aplicada no PostgreSQL local. Manifesto único por lote, pasta/nome opaco, ID externo, snapshot/intenções e inclusões tentadas. Reconciliação sem criação/reinclusão cegas; composição paginada e exata, blocos de 150 e retenção de ID conhecido após falha/descadastro. Lease evita conclusão antiga. Validade separada para membros e contatos; flags ausentes/extra/bloqueio não autorizam ready. Nenhuma lista externa é removida. CLI privado desativado por flag própria e fora do worker.

[Dez grupos](../artifacts/brevo-lists/local-results.json) aprovados, com 200 destinatários em 150/50 e CLI interceptado. 51 unitários/27 testes simulados de deploy; regressões de cadastro/bloqueios/preflight/lotes/marketing/sequências, TypeScript/lint, instalação congelada, Compose, build isolado e empacotamento aprovados. HTTP de coleção privada e site público passaram; QA encerrado. [Resumo e hashes](../artifacts/brevo-lists/release-checks.json). Sem API real, campanha/envio, preferências promocionais completas, webhook ou conciliação de disparo. Listas órfãs/canceladas e limite de consulta de pasta ficam sujeitos a inventário/retenção B12; homologar campos reais e automações antes de ativar.


## Preferências por assunto — 22/10/2026 (D53)

Preferências locais agora incluem consulta explícita das assinaturas do titular e retirada de um tema, além do cancelamento global. Nenhuma inclusão/reativação por token; novo consentimento exige pedido e confirmação. Consulta e mutação são POST privados/no-store, com validação estrita de corpo/origem; GET não lê dados do contato nem altera estados. Retirada cancela calendário do tema atomicamente com assinatura/auditoria; lotes preparados são revistos antes do claim. Última assinatura cancela cadastro e enfileira bloqueio Brevo, sem remover amostra ou desbloquear provedor. Sem nova migração; continuam doze.

[Sete grupos de integração](../artifacts/preferences/local-results.json) e [36 capturas renderizadas](../artifacts/qa-preferences/results.json), dois temas/seis larguras, passaram com axe/overflow/consulta por teclado e persistência dos cancelamentos. 51 unitários, 27 testes simulados de deploy, tipos/lint e build isolado aprovados; regressões de marketing/sequências/lotes e HTTP de acesso/site passaram; GET da API recusado com 405, QA encerrado. [Resumo e hashes](../artifacts/preferences/release-checks.json). Sem API real, campanha/envio, GitHub ou VPS. Próxima frente: personalização dos links nas campanhas, transporte, webhook e conciliação; B06 ainda parcial.


## Personalização de links de preferências Brevo — 22/10/2026 (D54)

13a migração aplicada somente no PostgreSQL local. Intenção por contato com hash/nonce e validade fixa permite reconstruir token em memória e conciliar PUT sem criar links novos a cada repetição. Renovação perto do vencimento/troca de chave preserva hashes antigos até a validade original. Cliente confere schema normal/text de BIBLIOTHEON_PREFERENCES e ID/endereço/bloqueio antes de atualizar exclusivamente esse atributo e observar por GET; 204 sem valor correto não comprova personalização.

Preparação privada por lote exige preflight e revisão final das identidades/consentimento/tokens, persistindo só referências e expiração em preferenceCheck por até cinco minutos. CLI empacotado fora do worker, flag própria false. [Oito grupos locais](../artifacts/brevo-preferences/local-results.json) aprovados, incluindo concorrência, timeout, descadastro, rotação, identidade divergente e CLI habilitado interceptado; 58 unitários/28 testes simulados de deploy, build isolado e Compose passaram. Regressões de preferências/lotes/preflight/listas e HTTP de acesso/site passaram. [Resumo e hashes](../artifacts/brevo-preferences/release-checks.json).

Sem campanha externa, mensagem, quota promocional, API/conta real, GitHub/VPS ou nova imagem/restore. Homologar atributo/placeholder {{ contact.BIBLIOTHEON_PREFERENCES }} e renderização real antes de ativar. Próxima frente: criação/reconciliação de campanha, transporte, webhook e observação contínua; projeto completo ainda não pronto para produção.


## Rascunhos de campanhas Brevo — 22/10/2026 (D55)

14a migração local: manifesto único por lote com cópia/hash e inventário de IDs observados. Intenção precede POST; ID conhecido é preservado antes de conferir conteúdo. Criação incerta só reconcilia por nome exato ou ID revisado, sem novo POST por ausência. Conflito não gera PUT/remoção: rascunho alheio não é adotado e ID conflitante fica inventariado.

Renderer preserva texto manual como texto, usa links internos de checkout/contexto, preferências individuais e cancelamento nativo Brevo. Cliente só cria/consulta rascunho clássico, sem agendamento ou sendNow. GET precisa confirmar estado draft, lista exata, remetente, HTML e assunto; pré-requisitos/listas/tokens/consentimento e validade são revistos antes de ready. Flag false, CLI privado fora do worker, sem claim/quota promocional.

[Oito grupos de integração](../artifacts/brevo-campaigns/local-results.json), 64 unitários, 29 testes simulados, tipos/lint, build/runtime/Compose e regressões de links/listas/lotes aprovados. HTTP de privacidade/site passou; QA encerrado. [Resumo e hashes](../artifacts/brevo-campaigns/release-checks.json). Nenhuma conta/API real, campanha externa ou mensagem. Homologar remetente, HTML/placeholder e representação real do GET antes de ativar. Transporte, webhook e conciliação continuam pendentes; rascunho ready não comprova aceitação ou entrega.


## Transporte de campanhas — D56, conferido em 24/10/2026

Preparação com lease e registro privado por lote; intenção de POST, histórico mínimo e quota compartilhada no mesmo commit. Cada tentativa tem token, dia UTC, contagem, estado e código confirmado, sem contatos/links/corpos recebidos. 204 é solicitação aceita/agendada; lote continua reservado e etapas accepted não significam entrega. Recusas 400/402/404 ficam rejected; retry requer ação explícita, consentimento/identidade/listas/preferências/cópia frescos e outra reserva. Incerteza nunca autoriza novo POST nem devolução automática de quota.

15a migração já aplicada localmente; correção de down preserva índice parcial ao trocar enum. Guard recusa perda de tentativas/estados novos; down/up e rollback com índice conferidos em transações revertidas. Registros preparing podem retomar após lease; issuing abandonado passa a uncertain sem rede. Resposta tardia confirmada da mesma tentativa não consome outra quota. Worker examina até 20 candidatos e processa no máximo uma nova campanha por ciclo, com BREVO_CAMPAIGN_SEND_ENABLED=false por padrão.

[12 grupos locais](../artifacts/brevo-send/local-results.json), incluindo CLI empacotado solicitando um disparo sintético e worker --once habilitado/fila vazia sem rede, passaram. Regressões de lotes/preflight/rascunhos/preferências/marketing/sequências, build isolado e Compose passaram; 69 unitários e 30 testes simulados de deploy, tipos/lint, geração de tipos/import map inalterada e HTTP de privacidade/site aprovados; QA encerrado. [Resumo e hashes](../artifacts/brevo-send/release-checks.json). Sem API/conta real ou mensagem; homologar conta, quota/reset UTC, remetente, templates e automações antes de ativar. Observação/reconciliação de resultados incertos e webhook continuam pendentes. Imagem/restore das quinze migrações e homologação visual do novo painel seguem pendentes.


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


## Inbox e histórico comerciais comuns — 24/10/2026 (D61)

Migração 20 aplicada somente no PostgreSQL local: commercial-inbox, commercial-conflicts, transactions, transaction-events e commercial-audit privados. Receptor verifica adaptador antes do banco e retorna received após commit do envelope mínimo/auditoria; duplicata não cria fato, colisão conserva revisão e projeção conhecida. Processador mapeia catálogo por IDs exatos, recompõe histórico e mantém fatos divergentes sem inventar valores/liquidação. Lease de cinco minutos, backoff e cinco tentativas por orçamento; retry owner/origem exata/motivo controlado conserva contador total e auditoria. Identidade de oferta com histórico fica preservada.

[Doze grupos locais](../artifacts/commercial-inbox/local-results.json) aprovados: concorrência/dedup, conflitos, três adaptadores internos sintéticos, ordem/refund, catálogo desconhecido/ambíguo, retry autenticado/CSRF, permissões, integridade, lease, rollback no fato e na auditoria final, exaustão/reabertura e CLI/worker sem tentativas de rede. 99 unitários, 33 testes simulados do atualizador, tipos/lint, empacotamento e Compose real/normalizado passaram. Regressões de catálogo, analytics (oito grupos), transporte Brevo (12), HTTP de acesso e site público aprovadas. Permanecem dois avisos antigos da migration de sequências e aviso pg/Drizzle nas fixtures.

Build .next-qa aprovado com a nova rota privada de retry. Primeiro build restrito falhou ao interpretar JSON de --showConfig do TypeScript; repetição aprovada fora do sandbox concluiu sem alteração de dependências. Servidor de QA .next-qa/3001 encerrado após HTTP; prévia gerenciada .next/3000 preservada. Consulta independente final verificou owner/contatos, cinco coleções comerciais, analytics e coleções Brevo consultadas zerados, 20 migrations. Não houve nova homologação visual das coleções/ações. [Resumo, contagens e hashes](../artifacts/commercial-inbox/release-checks.json).

COMMERCIAL_EVENTS_ENABLED=false por padrão; worker pode operar somente a inbox, sem SMTP/API Brevo ou preparação de campanha. CLI commerce:process empacotado; endpoint privado de retry documentado. Nenhuma rota comercial nativa pública ou autenticação real de Hotmart/Kiwify/Cakto implementada: fixtures dos três nomes são somente do contrato comum. Sem atribuição de compra, API/conta real, mensagem, venda, GitHub ou VPS. B07 continua parcial; projeto completo ainda não pronto para produção.

Próxima ação: completar observabilidade consolidada e ação visual de retry B07 com design/QA; depois implementar B08/B09/B10 sequenciais com fontes oficiais atuais e fixtures nativas, sem habilitar antes de homologar. Atribuição só por referência oficialmente suportada. B11/B12, imagem/upgrade/banco vazio/restore das vinte migrations e homologação integral do release permanecem pendentes. GitHub/deploy continuam com o proprietário.


## Acompanhamento e reprocessamento pelo painel — 24/10/2026 (D62)

View privada /admin/commercial-inbox e resumo no dashboard implementados. Panorama preserva os três provedores, conta eventos de fila/processamento/atenção e mostra datas reais de recebimento/aplicação/pendência, em Belém. Attention inclui colisão em applied e lease vencido; categorias não representam vendas e podem se sobrepor. Filtros por provider/state/event UUID, paginação de vinte, leitura owner sem efeitos e seleção mínima sem envelope/hash/token na lista. Detalhe readonly oferece envelope legível, dez ações recentes e link ao acompanhamento; não contém formulário de retry aninhado no CMS.

Retry exige motivo e conferência, usa API D61 com autenticação/origem/auditoria e informa processamento desligado. Pending/applied/ignored, colisão e lease ativo ficam sem ação. Resposta 202 real local gerou uma única auditoria, conservou tentativas e retirou a linha do filtro de atenção; feedback/foco permaneceram em área estável. Erros conservam entrada e não simulam confirmação. Fallback sem JS permite leitura/filtros/disclosure, mantendo a ação desabilitada.

[Quatro grupos de integração](../artifacts/commercial-admin/local-results.json), regressão da inbox (12 grupos), 104 unitários, tipos/lint, build isolado .next-qa, geração de tipos/import map e HTTP de acesso/site aprovados. Permanecem dois avisos antigos de lint da migration de sequências e aviso pg/Drizzle nas fixtures. Primeiro wrapper HTTP retornou 143 apesar de mensagens de sucesso/cleanup; repetição com marcador explícito terminou em zero. Workflow preparado com as duas suítes comerciais, sem execução no GitHub comprovada.

[46 capturas locais](../artifacts/qa-commercial-admin/results.json): axe nas 45 com JS, sem violações/overflow/erros de execução; leitura sem JS validada por DOM/retângulo/screenshot, sem axe. Dois temas e seis larguras no acompanhamento/formulário, mais 320px/texto 200%, dashboard, detalhe, paginação, busy/sucesso/erros. Zero tentativas HTTP externas. Imagens representativas de dark mobile, detalhe/envelope, confirmação e fallback inspecionadas. Não é auditoria integral retroativa do produto.

Primeira rodada encontrou target-size nos links do detalhe nativo; corrigidos alvos mínimos de 44px e repetida a matriz. Ajustes posteriores do harness trataram seletor de alert do anunciador Next, leitura de noscript ignorada pelos matchers textuais e localStorage em frames opacos. Produto e harness ficaram separados nas evidências de falha; rodada completa final aprovada. [Resumo, contagens e hashes](../artifacts/commercial-admin/release-checks.json).

Sem migração nova: vinte aplicadas localmente. Após cleanup e consulta independente, owner/contatos, cinco coleções comerciais e analytics/Brevo consultados zerados. QA .next-qa/3001 encerrado; prévia .next/3000 preservada. Sem conta/API de fornecedor, mensagem, venda, GitHub ou VPS. Flags reais continuam false por padrão; Native Hotmart/Kiwify/Cakto ainda não implementados/homologados.

Próxima ação: B08 Hotmart, depois B09 Kiwify e B10 Cakto, revalidando fontes oficiais atuais antes de codificar autenticação/eventos, usando fixtures nativas sintéticas e mantendo ativação real dependente de homologação. B07 segue parcial na atribuição de compra, condicionada à referência oficialmente suportada; não correlacionar por email/IP/valor/horário. B11/B12, release da imagem/upgrade/banco vazio/restore e homologação integral continuam pendentes. Projeto completo ainda não pronto para produção; GitHub/deploy permanecem com o proprietário.


## Hotmart v2 nativo local — 24/10/2026 (D63)

Adaptador/endpoint POST /api/v1/webhooks/hotmart implementados e ligados à inbox. Campos cotejados em fontes oficiais consultáveis/indexadas; abertura direta do portal era shell dinâmico. Header Hottok validado antes de corpo limitado/fábrica Payload; conta vem da configuração. Tokens somente no app, sem repasse ao worker. Recepção independente do processamento, flag false por padrão e sem conta real configurada. [Contrato, fontes e limitações](integracoes/hotmart.md).

Normalização preserva ucode, oferta/transação/evento, total pago, criação da notificação e aprovação original. Números são convertidos do lexema JSON, sem arredondamento/coerção. Evidência opcional no JSON mantém digest legado quando ausente; sem nova migração. Campo de aprovação explícito desconhecido não é preenchido pela criação. COMPLETE usa prova da aprovação original e não apaga reversão; cancelamento após aprovação fica em revisão. Refund sem estado suficiente para distinguir parcial/total, protesto, formato fora de venda avulsa e precisão sem suporte não geram projeção financeira automática. Quantias de devolução/chargeback, taxas, líquido, liquidação e atribuição não são deduzidas. PII/pagamento/origem descartados.

[Sete grupos de integração](../artifacts/hotmart/local-results.json) e [quatro grupos HTTP](../artifacts/hotmart/http-results.json) passaram: autenticação/conta, ACK atômico, duplicação, rollback, colisões, reversões/COMPLETE tardio, PIX não aprovado, revisão, catálogo e isolamento por conta. 122 unitários, 35 testes simulados do atualizador, tipos/lint, build .next-qa e Compose real/normalizado aprovados. Hottok sintético com dólar foi preservado no manifesto e não chegou ao worker. Regressores de inbox 12, painel 4, catálogo e HTTP de acesso/site passaram; saída HTTP explícita zero. Permanecem dois avisos antigos de lint e aviso pg/Drizzle das fixtures.

Geração de tipos após ajuda de ucode/alias; import map sem novas entradas. Workflow preparado com testes nativos/HTTP, sem execução GitHub comprovada. Caminho documentado do CLI corrigido para node cli/process-commercial.js dentro da imagem, conforme Dockerfile; .release é empacotamento local. Sem nova rodada visual D63: screenshots D62 são evidência daquele recorte. [Resumo, contagens e hashes](../artifacts/hotmart/release-checks.json).

Vinte migrações locais; censo independente após cleanup mostrou owner/contatos, cinco coleções comerciais, analytics e Brevo consultados zerados. QA .next-qa/3001 encerrado e porta liberada; prévia .next/3000 preservada. Nenhuma API/conta Hotmart, compra, entrega, mensagem, GitHub ou VPS. Política real de reenvio, valores/campos efetivamente entregues e token na conta continuam a homologar. Padrões HOTMART_WEBHOOK_ENABLED=false e COMMERCIAL_EVENTS_ENABLED=false. Projeto completo ainda não pronto para produção.

Próxima ação: B09 Kiwify com revalidação oficial de autenticação/eventos, depois B10 Cakto. Não remover nenhum provedor. B08 permanece parcial na homologação da conta/relatório/reenvio e B07 na atribuição comprovada por referência suportada. B11 deve resolver conflitos/conciliação e ambiguidades de catálogo com histórico sem editar fatos/identidades referenciados. B12, imagem/upgrade/banco vazio/restore e homologação integral do release permanecem pendentes; GitHub/deploy ficam com o proprietário.

## Kiwify nativa local — 24/10/2026 (D64)

Adaptador e POST /api/v1/webhooks/kiwify ligados à inbox, desligados por padrão e sem conta homologada. Fontes oficiais atuais confirmam HMAC-SHA1 dos bytes originais, signature única na query e token privado não transmitido; vetor oficial reproduzido. JSON limitado/autenticado precede normalização/fábrica Payload. Conta vem da configuração; identidade documentada order_id + webhook_event_type é isolada por provedor/conta. Tokens somente no app; Compose/atualizador validam segregação e configuração. [Contrato, fontes e limites](integracoes/kiwify.md).

Valores Kiwify já são inteiros em centavos; leitor lossless JSON compartilhado conserva a conversão decimal Hotmart. Produto/oferta exatos, taxa somente na mesma moeda; líquido, liquidação, quantia devolvida e atribuição desconhecidos não são inferidos. PII/pagamento/acesso/origem descartados. Datas raiz usam Brasília com histórico DST, sem escolher horário ambíguo/inexistente. Aprovação e devolução exigem instante confirmado; chargeback/recusa sem instante financeiro ficam em unknown_event_time. Criação é apenas âncora técnica do envelope em revisão, sem aplicar fato financeiro ou sobrescrever projeção anterior. Retry não resolve a ausência de evidência. Assinaturas/afiliado/parcelamentos especiais/físico ficam em revisão; membership/club sem campos de recorrência não implica assinatura. Cancelamento de assinatura/carrinho/tipos desconhecidos são ignorados com registro mínimo.

[Sete grupos de integração](../artifacts/kiwify/local-results.json) e [quatro grupos HTTP](../artifacts/kiwify/http-results.json) passaram. 146 unitários/24 arquivos, 37 testes simulados do atualizador, tipos/lint, build final isolado .next-qa e Compose real/JSON frozen aprovados. Regressões Hotmart (sete grupos + quatro HTTP), inbox comum (12) e painel comercial (quatro) passaram. Workflow preparado com as duas suítes Kiwify, sem execução GitHub comprovada. Sem nova rodada visual; screenshots D62 continuam evidência daquele recorte. [Resumo e hashes](../artifacts/kiwify/release-checks.json).

Primeira integração não conectou porque o container PostgreSQL local estava desligado; inventariado/reiniciado sem trocar volume, e testes repetidos com sucesso. Duas tentativas restritas de build falharam ao ler --showConfig: diagnóstico reproduziu subprocesso Node com EPERM/saída vazia, enquanto CLI direto produzia JSON válido. Build autorizado fora dessa restrição passou; build final repetido após os ajustes de cronologia. Permanecem dois avisos antigos de lint na migration de sequências e aviso pg/Drizzle nas fixtures, sem nova falha. [Fontes públicas e método](../artifacts/kiwify/source-checks.json): Markdown atual lido por HTTP; complemento Notion consultado via índice público, leitura direta atual 403/404.

Sem nova migração: vinte preservadas. [Contagens independentes](../artifacts/kiwify/cleanup-counts.json) após cleanup: owner, contatos e cinco tabelas comerciais consultadas zerados; só contagens, sem cadastros/payloads. QA .next-qa/3001 encerrado com resultado zero e porta liberada; .next/3000 preservados. Container local do banco permaneceu disponível. Sem compra, API autenticada/conta de fornecedor, mensagem, GitHub ou VPS. Padrões KIWIFY_WEBHOOK_ENABLED=false e COMMERCIAL_EVENTS_ENABLED=false. Projeto completo ainda não pronto para produção.

Próxima ação: B10 Cakto, revalidando contrato oficial próprio antes de codificar. B08/B09 permanecem parciais até homologação na conta/relatório/reenvio; datas financeiras/formatos especiais Kiwify exigem conciliação B11. B07 continua parcial na atribuição suportada. B11 deve resolver divergências e ambiguidades de catálogo com histórico sem editar fatos/identidades referenciados. B12, release da imagem/upgrade/banco vazio/restore e homologação integral continuam pendentes. GitHub/deploy ficam com o proprietário.

## Cakto nativa V1/V2 local — 24/10/2026 (D65)

Adaptador e POST /api/v1/webhooks/cakto ligados à inbox, desligados por padrão e sem conta homologada. Revalidação oficial confirmou HMAC-SHA256 de timestamp.corpo bruto, headers assinados e janela de cinco minutos. Sem fallback por secret do corpo; valor recebido é descartado e não escolhe conta. Segredo independente só no app; Compose/atualizador validam segregação e dólar literal. [Contrato, fontes e limites](integracoes/cakto.md).

V1 objeto e V2 array: cada pedido normaliza separadamente, mas validação de todos os itens precede o banco e um único commit cobre recibos/ignorados/colisões/auditorias. Locks de inbox e transações ordenados; lote inválido não tem aceitação parcial. Limites locais de 25 itens/256 KiB. Chave por pedido/tipo e namespace próprio, sem usar índice ou data de envio. Caminho individual e digest legado Hotmart/Kiwify preservados. Leitura decimal exata em módulo compartilhado; sem nova migração.

Produto/oferta exatos, amount/fees decimais e paidAt/refundedAt/chargedbackAt específicos. Datas ISO com offset truncadas à precisão comum de milissegundos, sem presumir ordem submilissegundo. Pix/boleto/PicPay/Open Finance gerados permanecem pendentes. MED/pré-chargeback em dispute_not_final, recusa sem instante em unknown_event_time e assinatura/físico em revisão; sem inventar líquido, recebimento, quantia devolvida ou atribuição. Secret, PII, pagamento/acesso, comissões e origem descartados. Abandono sem id de pedido é ignorado/agrupado por produto/oferta/data sem email; esse registro não mede compradores/abandono.

[Nove grupos de integração](../artifacts/cakto/local-results.json) e [quatro grupos HTTP](../artifacts/cakto/http-results.json) aprovados. Incluem V2 concorrente em ordem invertida, rollback na segunda auditoria, item inválido sem persistência parcial, dois conflitos concorrentes de transações aplicadas, lote misto, reversões antecipadas, catálogo/retry, contas e minimização. 166 unitários/25 arquivos, 39 testes simulados do atualizador, tipos/lint, build isolado .next-qa e Compose real/frozen aprovados. Regressões Hotmart/Kiwify sete grupos locais e quatro HTTP cada, inbox comum 12 e painel comercial quatro aprovadas. Workflow preparado com Cakto, sem execução GitHub comprovada. [Resumo e hashes](../artifacts/cakto/release-checks.json).

A extração do preparador comum tornou explícita a união de resultados; teste antigo passou a conferir prepared_ignored antes de acessar event. Lint encontrou let não reatribuído numa fixture nova, corrigido para const. Verificações finais passaram; permanecem dois avisos antigos da migration de sequências e aviso pg/Drizzle nas fixtures. Sem nova rodada visual; screenshots D62 são evidência daquele recorte.

Sem nova migração: vinte preservadas. [Contagens independentes](../artifacts/cakto/cleanup-counts.json) após cleanup: owner/contatos e cinco tabelas comerciais consultadas zerados, sem leitura de cadastros/payloads. QA .next-qa/3001 encerrado com resultado zero e porta liberada; .next/3000 preservados. Sem compra, API autenticada/conta de fornecedor, mensagem, GitHub ou VPS. Flags CAKTO_WEBHOOK_ENABLED=false e COMMERCIAL_EVENTS_ENABLED=false por padrão. Projeto completo ainda não pronto para produção.

Particularidade operacional documentada: Cakto não repete automaticamente resposta HTTP de erro, inclusive 500/503, conforme guia atual. Restabelecer serviço e reenviar pelo histórico do fornecedor; Retry-After local não garante retry externo. Nunca responder sucesso sem commit. Teste oficial tem shape artificial e não substitui venda/homologação.

Próxima ação: B11 conciliação/CSV/financeiro, com fontes explícitas, preview/commit auditado, desconhecidos financeiros honestos e resolução de colisões/ambiguidades de catálogo com histórico sem editar fatos/identidades referenciados. Pode desenvolver com fixtures enquanto proprietário homologa contas; não inventar colunas de exportação nativa ou transformar clique em compra. B08/B09/B10 continuam parciais até conferência de conta/relatório/reenvio/formatos especiais. B07 mantém atribuição suportada pendente; B12, imagem/upgrade/banco vazio/restore e homologação integral continuam abertos. GitHub/deploy ficam com o proprietário.

## Prévia CSV comercial somente de leitura — 24/10/2026 (D66)

Primeira etapa B11 implementada: parser canônico UTF-8/cabeçalho exato/centavos, classificação e POST /api/v1/admin/imports/preview autenticado owner/origem. Até 5 MiB/dez mil registros lógicos, quotes/BOM/linhas, campo e colunas limitados; sem adivinhar layout de fornecedor, coerção/arredondamento ou conteúdo inválido no diagnóstico. Helper de planilha neutraliza fórmulas textuais, sem download/UI de exportação nesta etapa. [Contrato e estado da conciliação](24-conciliacao.md).

Prévia compara provedor/conta/produto/oferta exatos com catálogo/projeção, identifica repetidos/conflitos/lacunas/revisão prévia e preserva zero/null. Linhas são instantâneos candidatos, não movimentos novos. settled_cents informado exige evidência própria; nenhum valor é somado ou tratado como recebimento. Consultas mínimas em blocos, sem comprador/envelope/token. Resposta sempre provisional=true e committable=false. Leituras podem mudar durante a conferência; confirmação futura deverá persistir plano/fonte/autor/justificativa e revalidar sob locks, com idempotência/auditoria.

Sem escrita de CSV, lote, linha, auditoria, recibo ou transação durante a prévia. ImportBatch/ImportRow, confirmação, resolução de colisões e ambiguidades de catálogo com histórico, liquidação/custos, relatório e UI continuam pendentes. R15/B11 parciais, R16 pendente. Arquivo bruto não passa por Media nem é persistido. Sem nova migração, flag, segredo, CLI ou integração.

[Cinco grupos locais](../artifacts/commercial-csv/local-results.json) e [quatro grupos HTTP](../artifacts/commercial-csv/http-results.json) aprovados. Histórico sintético dos três provedores comparado, snapshots das cinco tabelas comerciais preservados após as prévias, catálogo ambíguo/desconhecido detectado, owner/JWT/origem e 201 identidades em blocos exercitados. 182 unitários/26 arquivos, tipos/lint e build isolado .next-qa aprovados. Permanecem dois avisos antigos de lint da migration de sequências e aviso pg/Drizzle nas fixtures locais. Workflow preparado com as duas suítes, sem execução GitHub comprovada. [Resumo e hashes](../artifacts/commercial-csv/release-checks.json).

Primeiro typecheck encontrou inferência do callback Where, corrigida com tipo explícito. Primeira rodada HTTP encontrou Referrer-Policy global sobrescrevendo no-referrer do handler. Rota adicionada à regra privada em next.config.mjs, build repetido e rodada HTTP completa aprovada; não se afrouxou a asserção. Sem QA visual nova, pois não há interface de importação nesta etapa.

[Contagens independentes](../artifacts/commercial-csv/cleanup-counts.json) após cleanup: owner/contatos e cinco tabelas comerciais consultadas zerados; vinte migrações preservadas, nenhuma nova. QA .next-qa/3001 encerrado com resultado zero e porta livre; .next/3000 preservados. Sem conta/relatório nativo/API autenticada de provedor, compra, mensagem, GitHub ou VPS. Projeto completo ainda não pronto para produção.

Próxima ação: completar B11 com lotes/linhas mínimos duráveis e fonte/autor/plano/justificativa, confirmação idempotente/auditada, revalidação concorrente, resolução explícita de divergências e identidades históricas sem editar fatos. Depois, liquidação/custos e financeiro com moedas/coortes/ausências honestas. Não usar o hash da prévia provisória como autorização nem inferir colunas de exportação nativa. B08–B10 mantêm homologação de conta pendente; B07 atribuição, B12 retenção, imagem/banco vazio/upgrade/restore e homologação integral seguem abertos. GitHub/deploy ficam com o proprietário.

## Lotes duráveis e confirmação auditada — 24/10/2026 (D67)

B11 ganhou commercial-import-batches/rows/audit privadas e migração 21 local. Estágio registra fonte/referência/razão controladas, owner, arquivo/manifesto/plano e linhas normalizadas, descartando bruto/inválidos. Idempotência vincula UUID ao autor/conteúdo/metadados. Uma conta/provedor por lote durável; prévia D66 segue provisória/somente de leitura e permite mistura para diagnóstico. [Contrato/API/limites](24-conciliacao.md).

Confirmação owner/origem, confirmed=true e hash do plano durável revalida whitelist/hashes/manifesto, catálogo/projeção e inbox inclusive não processada. Mudança vira stale sem recibo parcial. Novos pending/approved/refused/canceled sem devolução/recebimento são enfileirados; reversões, bases insuficientes e divergências bloqueiam. Para approved, aprovação original é declarada pelo operador no campo de instante, sem criação original inventada. CSV é fonte manual auditada, não HMAC do fornecedor.

202/queued é inbox durável, não aplicação/liquidação. Linhas vinculadas à inbox e auditoria participam do commit; snapshots compatíveis confirmam sem fato novo. Chave de fato independe de lote/linha/autor, preservando dedupe entre relatórios. Worker comercial permanece independente e false por padrão. queued do lote/linha descreve submissão; acompanhar aplicação pela inbox. Não modifica fatos/projeções originais na confirmação.

SQL parametrizado em blocos de 200 sob transação valida antes de persistir. Barreira por provedor/conta antes dos demais locks é compartilhada por recepção/processamento/retry e edição de oferta; não permanece enquanto humano confere. Índices/checks/FKs e down recusado com qualquer registro preservam evidência. Imagem/limites sob carga e restauração ainda precisam de homologação.

[Dez grupos locais](../artifacts/commercial-imports/local-results.json) e [quatro grupos HTTP](../artifacts/commercial-imports/http-results.json) passaram: idempotência/UUID upper/lower, revalidação por webhook/catálogo, bloqueio/integridade, migração vazia/guard, fonte/permissões, rollback de 201 linhas em dois blocos, barreira concorrente e três provedores. Aplicação da fila é explícita nas fixtures. 192 unitários/27 arquivos, tipos/lint e build .next-qa aprovados; tipos gerados e import map sem novas entradas. Regressões inbox 12, Hotmart 7, Kiwify 7, Cakto 9, prévia 5 locais/4 HTTP, painel 4 e catálogo aprovadas. Workflow inclui ambas as suítes, sem execução GitHub comprovada. [Resumo e hashes](../artifacts/commercial-imports/release-checks.json).

Primeira geração de migração não viu mudanças antes do registro das coleções; registro corrigido e migração 21 gerada/aplicada. Tipos de união Field/linhas normalizadas e parâmetro UUID da fixture foram ajustados após typecheck. Fixture antiga da inbox exigia documento em toda coleção estendida, embora não criasse importações; separadas coleções do ledger e cleanup total, com permissões próprias de importação testadas. Primeiro replay já havia carregado a versão anterior da fixture; repetição final passou. Migração 20 é ensaiada após down21/up21 na mesma transação revertida. Permanecem dois avisos antigos de lint e aviso pg/Drizzle nas fixtures. Diff de produto sem whitespace; log gerado .local-logs/next.log apresentou EOF vazio, não alterado para maquiar a verificação. Sem nova QA visual/customização de UI.

[Contagens independentes](../artifacts/commercial-imports/cleanup-counts.json) após cleanup: owner/contatos e oito tabelas comerciais/importações consultadas zerados; 21 migrações preservadas. QA .next-qa/3001 encerrado com zero e porta livre; .next/3000 preservados. Sem relatório nativo/conta/API autenticada de fornecedor, compra, mensagem, GitHub ou VPS. Projeto completo ainda não pronto para produção.

Próxima ação: resolução auditada de divergências/colisões e identidades duplicadas/ambíguas com histórico, sem editar fatos originais; evidência explícita de liquidação, custos e relatório financeiro com moedas/coortes/ausências honestas. UI de importação/resolução permanece pendente. R15/B11 parciais, R16 pendente; B08–B10 mantêm homologação de conta, B07 atribuição, B12 retenção e release da imagem/banco vazio/upgrade/restore/homologação integral abertos. GitHub/deploy ficam com o proprietário.

## Manutenção de raiz e workflow — D69 (24/10/2026)

[README](../README.md) passa a concentrar setup, comandos e organização; atualizar.sh é o único atualizador e o alias incorreto foi removido. start.sh/stop.sh usam [controle local comum](../scripts/local-dev.py), sem adotar processos existentes. Há pin Node compartilhado .nvmrc, padrões de edição/LF e exclusões de caches/estado/logs/mídia. Log local antes versionado saiu apenas do índice, permanecendo no disco.

[Workflow](../.github/workflows/quality.yml) separado em checks sem banco e integração sequencial; duas listas de suítes reutilizáveis com confirmação de banco sintético, saúde explícita e limpeza do grupo criado. Checks locais aprovaram 192 unitários, tipos, lint com dois avisos históricos, testes de operação e documentação. Sintaxe/estrutura conferidas; isso não é execução GitHub, bateria HTTP real da aplicação, homologação de imagem/restore ou deploy. Sem mudanças no schema/domínio comercial. [Evidência](../artifacts/maintenance/root-files-2026-10-24.json).
