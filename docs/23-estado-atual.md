# 23 — Estado atual e mapa da implementação

[Índice](../README.md) · [Retomada](14-progresso.md) · [Backlog](13-backlog.md) · [Histórico técnico](19-desenvolvimento.md)

Revisão de 21/10/2026, America/Belem. Fonte: código presente, migrações declaradas/aplicadas no banco local e relatórios existentes. [Inventário da revisão](../artifacts/documentation/state-audit-2026-10-21.json). Esta revisão não reexecutou os testes da aplicação; conferiu suas evidências e executou o validador documental. Datas ISO dos artefatos podem estar em UTC: 22/10 às 01h corresponde a 21/10 às 22h em Belém.

## Situação do produto

Existe aplicação local funcional, com vitrine, painel manual e parte do relacionamento. **O projeto completo ainda não está pronto para produção.** As fases de eventos comerciais, três conectores, conciliação/financeiro, retenção e operação comercial permanecem pendentes. Teste sintético não comprova homologação de fornecedor, publicação ou venda.

O proprietário autorizou implementação e testes locais; GitHub e deploy na VPS ficam com ele. Não há repositório Git inicializado neste diretório, execução de CI no GitHub comprovada ou acesso à VPS. A continuação imediatamente anterior a esta revisão apenas leu o código para planejar agrupamento: nenhum lote promocional durável foi implementado.

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
| Supressão | Serviço, API owner/origem exata, formulário e CLI; auditoria idempotente por referência HMAC | Conferência externa manual; sem sincronização/webhook Brevo |
| Recuperação do owner | CLI por stdin privado, senha nova, revogação de sessões/tokens e limpeza de lockout | Recuperação por e-mail indisponível; forgot/reset 503 genérico, unlock público negado |
| Sequências | Conteúdo manual revisado, snapshot imutável por inscrição, calendário D+2/4/7/10, elegibilidade e cancelamento | Sem agrupamento durável, campanhas externas ou envio promocional |
| Quota | Contabilidade compartilhada por destinatário/dia UTC, teto até 250 e reserva transacional padrão 50; lock e rollback | Reserva promocional existe como serviço interno; falta ligá-la ao claim durável dos lotes |
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
| R09 | Parcial | Consentimento, descadastro e supressão local testados; falta sincronização de campanhas no provedor |
| R10 | Parcial | Calendário, quota, falhas/retentativas testados; faltam lotes, transporte promocional e homologação Brevo |
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
| R22 | Parcial, com risco conhecido | Acesso, uploads, tokens e origem testados; falta preservar arquivo em troca recusada/rollback de mídia não vinculada |
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

Sete migrações declaradas em [migrations/index.ts](../migrations/index.ts) e conferidas como aplicadas no PostgreSQL local nesta revisão, nesta ordem:

1. 20261021_012104_initial
2. 20261021_013444_catalog
3. 20261021_104729_public_site
4. 20261021_121334_relationship
5. 20261021_155133_relationship_jobs
6. 20261021_155500_relationship_invariants
7. 20261021_233105_sequences

O banco local estava saudável, publicado apenas em 127.0.0.1:55432. Contagens consultadas de owner, contatos, sequências, inscrições e etapas promocionais: zero, após limpeza das fixtures. Isso é fotografia local, não censo de uma operação comercial. Nenhuma migration foi executada nesta revisão documental. O down de sequências não foi testado. A bateria de imagem/banco vazio da revisão anterior não comprova as sete migrations atuais juntas; repetir antes do release.

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
| scripts/qa-*.ts; scripts/qa-container.py | QA renderizado, restore e container; comandos em execução local/pacote de produção |
| node scripts/build-runtime.mjs | Empacota migrate, create-admin, recover-admin, apply-suppression, prepare-promotions, worker e worker-health em .release |
| python3 scripts/check-compose.py; ops/recovery.py | Configuração e backup/restore; ver procedimento de produção |
| python3 scripts/generate-tokens.py; python3 scripts/validar_contrastes.py; python3 scripts/validar_documentacao.py | Tokens, contrastes e estrutura documental; contraste padrão não mutante |

Comandos de integração/QA que criam owner ou fixtures usam banco sintético e são executados **sequencialmente**. Check estático não substitui build, integração, navegador, imagem ou homologação. O workflow em .github/workflows/quality.yml prepara geração, validação, testes, migrations, build e testes HTTP; não instala navegador, não executa toda a matriz de screenshots nem constrói/homologa imagem. Não há execução comprovada no GitHub.

## Pendências concretas e ordem de retomada

1. B06: agrupamento durável por tema/etapa/dia/cópia/oferta/contexto; conjunto de destinatários e IDs externos; reserva no claim; preferências individuais e supressões revalidadas imediatamente antes do envio; campanha Brevo com resultado incerto sem repetição cega. O contrato de detalhes ainda desconhecidos deve ser confirmado antes de codificar; ver [Brevo](integracoes/brevo.md).
2. B07: coleta consentida, cliques/atribuição, inbox durável, replay e painel operacional. Depois B08/B09/B10 sequenciais, cada qual com contrato, fixtures e homologação próprios.
3. B11/B12: conciliação CSV, ledger/financeiro, retenção, pedidos de dados e reaplicação de exclusões/supressões após restore. Corrigir e testar a integridade da troca de mídia não vinculada antes do release.
4. B19/B20 e B05: completar matriz visual/zoom/performance, imagem/migrations/restore do código final, restrição administrativa, inventário VPS/proxy e backup externo. Aviso de concorrência pg 8.20.0/Drizzle segue sem causa específica resolvida; não ignorar antes de atualizar para pg 9. Dois avisos de lint na migration de sequências permanecem registrados.
5. B13–B16: tarefas/kit, primeiro lançamento e acompanhamento com evidências comerciais reais. Dependem também de conteúdo, público, preço, conta/remetente, contato público e ofertas autorizadas.

O erro 500 de SortColumn/useListQuery de uma tentativa anterior não se repetiu no build limpo e na conferência HTTP final; causa específica não confirmada. Patches pnpm e isolamento de builds precisam ser preservados/revalidados, sem atribuir a correção a uma hipótese não provada. O helper de uploads do Payload remove arquivo anterior antes dos hooks de validação: o guard da amostra vinculada tem prova byte a byte, mas não cobre mídia não vinculada. Essas limitações não foram apagadas por checks verdes.

## Como manter este estado confiável

Após cada entrega, atualizar esta fotografia e a próxima ação em progresso; registrar a execução cronológica no documento 19 e associar evidências ao backlog/requisitos. Marcar separadamente implementação, teste local, homologação externa e publicação. Não transformar textos históricos como “em execução” ou “não implementado nesta entrega” em estado vigente. Rodar o validador documental e os checks proporcionais à mudança. O inventário desta revisão é datado, não se atualiza sozinho.
