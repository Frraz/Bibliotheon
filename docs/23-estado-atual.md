# 23 — Estado atual e mapa da implementação

[Índice](../README.md) · [Retomada](14-progresso.md) · [Backlog](13-backlog.md) · [Histórico técnico](19-desenvolvimento.md)

Baseline revisado em 21/10/2026, America/Belem; atualização de ferramentas de deploy em 22/10 na seção final. Fonte: código presente, migrações declaradas/aplicadas no banco local e relatórios existentes. [Inventário do baseline](../artifacts/documentation/state-audit-2026-10-21.json), anterior às ferramentas novas. A revisão documental do baseline não reexecutou os testes da aplicação; a validação posterior está registrada separadamente. Datas ISO dos artefatos podem estar em UTC: 22/10 às 01h corresponde a 21/10 às 22h em Belém.

## Situação do produto

Existe aplicação local funcional, com vitrine, painel manual e parte do relacionamento. **O projeto completo ainda não está pronto para produção.** As fases de eventos comerciais, três conectores, conciliação/financeiro, retenção e operação comercial permanecem pendentes. Teste sintético não comprova homologação de fornecedor, publicação ou venda.

O proprietário autorizou implementação e testes locais; GitHub e deploy na VPS ficam com ele. Git local conferido em 22/10: repositório existente com commit c518c6b; nenhum commit/push feito pelo agente nesta rodada. Sem execução de CI no GitHub comprovada ou acesso à VPS. Lotes promocionais duráveis foram acrescentados/testados localmente em 22/10; ver atualização final D48.

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
| Supressão | Serviço, API owner/origem exata, formulário e CLI; auditoria idempotente por referência HMAC | Fila/adaptador outbound testados localmente e desligados; sem homologação/webhook inbound Brevo |
| Cadastro consentido Brevo | Fila atômica com opt-in confirmado; reconciliação, lease e compensação tardia | Testado com HTTP sintético e CLI empacotado; flag false, sem listas/campanhas ou conta homologada |
| Recuperação do owner | CLI por stdin privado, senha nova, revogação de sessões/tokens e limpeza de lockout | Recuperação por e-mail indisponível; forgot/reset 503 genérico, unlock público negado |
| Sequências | Conteúdo manual revisado, snapshot imutável por inscrição, calendário D+2/4/7/10, elegibilidade e cancelamento | Agrupamento durável local; sem campanhas externas ou envio promocional |
| Quota | Contabilidade compartilhada por destinatário/dia UTC, teto até 250 e reserva transacional padrão 50; lock e rollback | Reserva ligada ao claim durável interno dos lotes; claim ainda fora do worker |
| Apresentação | Fontes locais, tokens canônicos, claro/escuro/system, variantes/acento por enum, extensões Payload e patches locais de acessibilidade | B20 parcial; formulários e telas futuras exigem novas rodadas |
| Infraestrutura | Dockerfile, Compose, perfis app/migrate/worker, runtime limitado, CLIs empacotadas e backup/restore com restic | Imagem e restauração testadas em revisão anterior; reconstruir/revalidar estado atual antes de release |

Implementação em [coleções](../src/collections/Relationship.ts), [configuração Payload](../src/payload.config.ts), [catálogo](../src/modules/catalog/public.ts), [checkout](../src/modules/commerce/resolve.ts), [relacionamento](../src/modules/marketing/service.ts), [calendário](../src/modules/marketing/sequence.ts), [quota](../src/modules/marketing/quota.ts) e [transporte transacional](../src/integrations/brevo/transactional.ts). Só existe adaptador de transporte Brevo transacional; não existem adaptadores comerciais Hotmart/Kiwify/Cakto.

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
| R09 | Parcial | Consentimento, descadastro e supressão local testados; bloqueios outbound testados com HTTP sintético; preflight importa bloqueio pontual; faltam webhook e sincronização de campanhas no provedor |
| R10 | Parcial | Calendário, quota, lotes/claim e falhas/retentativas testados localmente; faltam transporte/sincronização/conciliação promocional e homologação Brevo |
| R11 | Não implementado por completo | Campaigns armazena contexto; não existem Visit, CheckoutClick nem endpoint de events |
| R12 | Pendente | Contrato/checklist Hotmart documentados; sem adaptador/inbox/homologação |
| R13 | Pendente | Contrato/checklist Kiwify documentados; autenticação atual ainda exige confirmação |
| R14 | Pendente | Contrato/checklist Cakto documentados; detalhes técnicos e homologação pendentes |
| R15 | Pendente | CSV/importação com prévia/commit/auditoria ainda não implementados |
| R16 | Pendente | Ledger comercial, custos, liquidação e relatório financeiro ainda não implementados |
| R17 | Parcial | Cadastro de campanha/hipótese existe; tarefas, prazo e kit autorizado pendentes |
| R18 | Pendente | Título escolhido; sem lançamento, três conteúdos ou distribuição comprovados |
| R19 | Pendente | Modelo semanal existe; relatório conciliado e rotina comercial ainda não executados |
| R20 | Parcial | Rodadas públicas/admin sem falhas nos recortes testados; não certifica teclado/AA de todo o produto futuro |
| R21 | Pendente de medição | Build passou; não há evidência de orçamento completo de laboratório ou p75 real |
| R22 | Parcial, local | Acesso, uploads, tokens e origem testados; preservação em troca recusada/rollback e coleta com carência testadas em seis grupos; imagem atual ainda pendente |
| R23 | Parcial, local | Container limitado e banco privado testados; VPS/proxy/baseline não inspecionados |
| R24 | Parcial, local | Restore criptografado e mídia verificados em dataset anterior; destino externo/RPO/RTO reais pendentes |
| R25 | Pendente de inbox comercial | Health e outbox de e-mail existem; não substituem inbox durável, ACK/replay e observação de vendas |
| R26 | Parcial | Consentimento/revogação implementados; retenção, exportação/exclusão e reaplicação após restore não executáveis ainda |
| R27 | Local | Fontes, tokens, briefing e QA de fundação; continuar aplicando em telas novas |
| R28 | Parcial | Tema persistente/system/fallback testados em site/painel; novas telas de fase 2 ainda inexistentes |
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
| Verificação local registrada no histórico e no inventário desta revisão | 29 testes/9 arquivos unitários, tipos aprovados, lint sem erros e com 2 avisos | Logs da última execução conferidos; testes não reexecutados nesta revisão documental |
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

Node 22.23.3 e pnpm 10.34.7; Next 16.4.2, React 19.3.1, Payload 3.91.0 e Sharp 0.35.5 fixados em [package.json](../package.json)/lockfile. PostgreSQL 17.9 por digest no Compose. Overrides e patches locais de Payload estão versionados; instalação exige lockfile e revalidação ao atualizar. Não houve instalação global de skills de referência.

Quatorze migrações declaradas em [migrations/index.ts](../migrations/index.ts) e conferidas como aplicadas no PostgreSQL local nesta revisão, nesta ordem:

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

O banco local estava saudável, publicado apenas em 127.0.0.1:55432. Contagens consultadas de owner, contatos, sequências, inscrições e etapas promocionais: zero, após limpeza das fixtures. Isso é fotografia local, não censo de uma operação comercial. Nenhuma migration foi executada nesta revisão documental. O down de sequências não foi testado. A bateria de imagem/banco vazio da revisão anterior não comprova as quatorze migrations atuais juntas; repetir antes do release.

Prévia gerenciada usa .next/porta 3000; QA standalone usa .next-qa/porta 3001 ou outra livre, com NEXT_DIST_DIR/TEST_BASE_URL. Não sobrescrever caches entre processos. O servidor de QA da última rodada foi encerrado; não presumir uma porta atualmente ativa só porque houve teste anterior.

## Rotas e comandos existentes

Inventário de código, sem substituir os contratos de [interfaces](06-interfaces.md). Não há endpoints de events, webhooks comerciais, imports, retry da inbox ou relatórios implementados.

| Grupo | Rotas existentes |
|---|---|
| Público | /, /ebooks, /ebooks/[slug], /artigos, /artigos/[slug], /temas/[slug], /[institutional], /robots.txt, /sitemap.xml |
| Conteúdo privado/saída | /preview/ebooks/[id], /comprar/[offerId], /api/v1/media/[id] |
| Relacionamento | /amostras/[slug], /amostras/confirmar, /preferencias; POST /api/v1/lead-requests, /api/v1/lead-confirmations, /api/v1/unsubscribe; GET /api/v1/downloads/[token] |
| Admin | /admin e /admin/suppressions; POST /api/v1/admin/suppressions; CRUD/autenticação Payload /api/[...slug] protegido |
| Saúde | /health/live, /health/ready |

| Comando/ferramenta | Finalidade |
|---|---|
| npm run dev / build / start | Desenvolvimento, build e runtime standalone |
| npm run lint / typecheck / test; bash scripts/check-local.sh | Verificações estáticas, unitárias e documentação |
| npm run payload; npm run db:migrate | CLI CMS e aplicação de migrations; não executar contra banco real sem procedimento de release |
| npm run generate:types / generate:importmap | Geração explícita; autoGenerate desativado, CI confere diferença dos gerados |
| npm run admin:create / admin:recover / suppression:apply | Operação privada por stdin; nunca senha, token ou dados pessoais em argumentos/documentação |
| npm run worker | Jobs solicitados, polling/heartbeat e elegibilidade do calendário; exige configuração privada, não habilitar em ensaio com credenciais reais |
| npm run promotions:prepare | Até 100 etapas por execução, somente elegibilidade local; sem quota ou envio promocional |
| npm run test:integration / test:catalog / test:site | Acesso, domínio editorial e HTTP público |
| npm run test:marketing / test:sequences / test:admin-recovery | Domínio de relacionamento, calendário e recuperação por operador |
| npm run brevo:suppressions / brevo:contacts / brevo:lists / brevo:preferences / brevo:campaigns | CLIs privados para bloqueios, cadastro, listas, links individuais e rascunhos; flags separadas, sem campanha/envio |
| npm run test:batches / test:preflight / test:preferences / test:brevo-sync / test:brevo-contacts / test:brevo-lists / test:brevo-preferences / test:brevo-campaigns | Fixtures sequenciais dos contratos promocionais locais |
| scripts/qa-*.ts; scripts/qa-container.py | QA renderizado, restore e container; comandos em execução local/pacote de produção |
| node scripts/build-runtime.mjs | Empacota migrate, create-admin, recover-admin, apply-suppression, prepare-promotions, media-gc, sync-brevo-suppressions, sync-brevo-registrations, prepare-brevo-list, prepare-brevo-preferences, prepare-brevo-campaign, worker e worker-health em .release |
| python3 scripts/check-compose.py; ops/recovery.py | Configuração e backup/restore; ver procedimento de produção |
| python3 scripts/generate-tokens.py; python3 scripts/validar_contrastes.py; python3 scripts/validar_documentacao.py | Tokens, contrastes e estrutura documental; contraste padrão não mutante |

Comandos de integração/QA que criam owner ou fixtures usam banco sintético e são executados **sequencialmente**. Check estático não substitui build, integração, navegador, imagem ou homologação. O workflow em .github/workflows/quality.yml prepara geração, validação, testes, migrations, build e testes HTTP; não instala navegador, não executa toda a matriz de screenshots nem constrói/homologa imagem. Não há execução comprovada no GitHub.

## Pendências concretas e ordem de retomada

1. B06: agrupamento/conjunto de destinatários/claim com reserva implementados localmente; bloqueios outbound testados. Preflight/importação pontual implementados. Cadastro consentido implementado localmente. Listas exclusivas, cancelamento por assunto e links individuais implementados localmente. Rascunhos/reconciliação implementados localmente. Próximo: transporte, webhook e conciliação; preferências individuais e supressões revalidadas imediatamente antes do envio; campanha Brevo com resultado incerto sem repetição cega. O contrato de detalhes ainda desconhecidos deve ser confirmado antes de codificar; ver [Brevo](integracoes/brevo.md).
2. B07: coleta consentida, cliques/atribuição, inbox durável, replay e painel operacional. Depois B08/B09/B10 sequenciais, cada qual com contrato, fixtures e homologação próprios.
3. B11/B12: conciliação CSV, ledger/financeiro, retenção, pedidos de dados e reaplicação de exclusões/supressões após restore. Homologar na imagem atual a preservação e coleta de mídia corrigidas localmente.
4. B19/B20 e B05: completar matriz visual/zoom/performance, imagem/migrations/restore do código final, restrição administrativa, inventário VPS/proxy e backup externo. Aviso de concorrência pg 8.20.0/Drizzle segue sem causa específica resolvida; não ignorar antes de atualizar para pg 9. Dois avisos de lint na migration de sequências permanecem registrados.
5. B13–B16: tarefas/kit, primeiro lançamento e acompanhamento com evidências comerciais reais. Dependem também de conteúdo, público, preço, conta/remetente, contato público e ofertas autorizadas.

O erro 500 de SortColumn/useListQuery de uma tentativa anterior não se repetiu no build limpo e na conferência HTTP final; causa específica não confirmada. Patches pnpm e isolamento de builds precisam ser preservados/revalidados, sem atribuir a correção a uma hipótese não provada. O helper de uploads do Payload remove arquivo anterior antes dos hooks de validação: o novo patch opt-in D47 difere essa exclusão para a coleta após commit/carência, com prova local byte a byte também para mídia não vinculada. Essas limitações não foram apagadas por checks verdes.

## Como manter este estado confiável

Após cada entrega, atualizar esta fotografia e a próxima ação em progresso; registrar a execução cronológica no documento 19 e associar evidências ao backlog/requisitos. Marcar separadamente implementação, teste local, homologação externa e publicação. Não transformar textos históricos como “em execução” ou “não implementado nesta entrega” em estado vigente. Rodar o validador documental e os checks proporcionais à mudança. O inventário desta revisão é datado, não se atualiza sozinho.

## Atualização: ferramentas de deploy — 22/10/2026

Criados [deploy.md](../deploy.md), [atualizar.sh](../atualizar.sh), alias [altualizar.sh](../altualizar.sh) e [orquestrador](../ops/deploy.py). Configuração privada fora do Git; pull fast-forward; imagem de tag local exclusiva e ID verificado; backup externo antes de migrations; saúde local/pública; worker opcional. Inclui lock, checkpoint, retomada explícita, backup avulso e agendamento documentado. D46 autoriza a alternativa de build na VPS, condicionada à capacidade; não altera a arquitetura da aplicação nem o contrato de checkout.

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
