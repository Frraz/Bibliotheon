# 14 — Progresso e retomada

[Índice](../README.md) · [Backlog](13-backlog.md)

Atualização: 24/10/2026, America/Belem (D69: manutenção de raiz/CI). Última bateria da aplicação: D67, registrada separadamente; D69 reexecutou checks estáticos/unitários e testes de operação, sem nova bateria de banco/HTTP da aplicação. [Pendências priorizadas até produção](../pendencias.md).

## Estado real

| Frente | Estado | Evidência |
|---|---|---|
| Ideia e decisões | Definidas para primeira versão | Plano aprovado e documentos 01–17 |
| Documentação | Produzida; validação registrada no documento 18 | [Relatório](18-validacao.md) |
| Base / CI | Aplicação local implementada; CI preparado, sem execução GitHub | [Mapa vigente e evidências](23-estado-atual.md); 192 unitários; build isolado e HTTP locais, detalhes por etapa abaixo |
| Editorial / vitrine | Catálogo, três LPs, artigos, temas, preview, checkout e slugs implementados/testados localmente | test:catalog/site, 170 telas públicas e 36 de estados |
| Relacionamento | Captura, amostra, consentimento, supressão, recuperação por operador, calendário e quota locais | 11 grupos de marketing, 7 de sequências, 5 de recuperação; transporte real desligado |
| Marketing promocional | Parcial: lotes duráveis e claim/quota internos testados localmente | Seis grupos de lotes, oito de bloqueios outbound e sete de preflight, mais dez grupos de cadastro consentido aprovados; dez grupos de listas exclusivas aprovados; cancelamento por assunto implementado/testado localmente; rascunhos e transporte locais; 12 grupos de disparo e nove de observação; worker com flags false; callback e conciliação individual locais D58; homologação pendente |
| Inbox comercial / financeiro / retenção | Inbox/histórico/retry/worker D61 e acompanhamento visual D62 locais; financeiro/retenção pendentes | B07 parcial; adaptadores nativos locais D63–D65; atribuição, conciliação e homologação pendentes |
| Conciliação CSV | Prévia D66 e lotes/linhas/auditoria com confirmação limitada para inbox D67 locais | Dez grupos locais/quatro HTTP; resolução, liquidação/custos, relatório e UI customizada pendentes |
| Design / QA | Fundação e rodadas renderizadas locais; B19/B20 parciais | Matriz integral, fase 2, performance e zoom nativo 400% ainda abertos |
| Imagem / backup | Ensaios locais de revisão anterior | Revalidar código/migrations atuais; backup externo e RPO/RTO reais pendentes |
| Guia / atualização da VPS | deploy.md e atualizar.sh implementados; alias incorreto retirado em D69 | Orquestração simulada e Compose real/JSON sintético; sem implantação remota |
| Livros / primeiro título | Primeiro título selecionado; arquivos, público e oferta pendentes de conferência | [Lançamento](22-lancamento.md) |
| Links e produtos nas plataformas | Não verificados | Nenhuma conta acessada |
| Hotmart / Kiwify / Cakto | Hotmart/Kiwify/Cakto locais D63–D65; nenhum homologado em conta | Fixtures nativas, inbox e HTTP locais; checklists externos pendentes |
| E-mail e domínio | bibliotheon.com.br informado; e-mail público ficará vazio até produção por decisão do proprietário | DNS/TLS/remetente não homologados; [lançamento](22-lancamento.md) |
| VPS | Especificação informada; não inspecionada | Nenhum acesso remoto realizado |
| Publicação / vendas | Não confirmadas neste projeto | Sem evidência comercial |

**Projeto completo ainda não pronto para produção.** O [estado atual](23-estado-atual.md) mapeia 34 requisitos e 21 migrations declaradas. A última bateria registrada, [D67](../artifacts/commercial-imports/release-checks.json), contém 192 unitários/27 arquivos, build e integrações/HTTP locais; seu censo local registrou 21 migrations aplicadas e cleanup das tabelas consultadas. A revisão documental D68 conferiu código e relatórios sem consultar banco ou reexecutar aplicação. GitHub, contas externas e VPS não foram homologados pelo agente.

Riscos técnicos abertos: preservação/limpeza de mídia corrigidas e testadas localmente, ainda exigem homologação da imagem; aviso pg/Drizzle de queries concorrentes sem causa resolvida; dois avisos de lint na migration de sequências. Imagem atualizada e bateria integral do release continuam necessárias.

## Próxima ação técnica

Concluir B11: prevenir novas identidades externas duplicadas e permitir resolução auditada de divergências/colisões e associações históricas, preservando fatos originais. Depois ampliar a conciliação além dos casos limitados D67 e implementar prova de liquidação, custos e relatório financeiro. UI de importação/resolução e retenção B12 permanecem abertas. Adaptadores Hotmart/Kiwify/Cakto D63–D65 já existem localmente; cada conta mantém sua homologação independente. Atribuição comercial B07 só pode usar referência suportada e comprovada.

A sequência completa, critérios de conclusão e responsabilidades estão em [pendencias.md](../pendencias.md). Antes do release: bateria da imagem com as 21 migrations, upgrade/restore, privacidade, segurança e matriz visual/performance. Envio/callbacks e processamento real só depois de homologação, com flags explícitas. GitHub e deploy ficam com o proprietário. Retomar pelos contratos de [conciliação](24-conciliacao.md), [desenvolvimento](19-desenvolvimento.md) e [execução local](20-execucao-local.md).

## Dependências externas

| Pendência | Responsável | Bloqueia |
|---|---|---|
| Público, amostra, arquivos e preço do título selecionado | Proprietário | Campanha real B14 |
| E-mail público antes da produção e revisão institucional do responsável informado | Proprietário, conforme decisão já registrada | Publicação institucional/captura real; e-mail continua vazio no desenvolvimento |
| Inventário VPS/proxy/recursos livres | Operador autorizado | Deploy B05 |
| Destino externo de backup dentro do orçamento | Proprietário/operador | Produção B05 |
| Cadastro e elegibilidade por produto | Proprietário | Ativação das ofertas |
| Credenciais e eventos oficiais das três contas | Proprietário/implementador | Homologação B08–B10 |
| Conferência dos contratos nativos nas três contas e relatórios reais, sem dados em Git | Proprietário/implementador | Homologação e ativação segura dos conectores já implementados localmente |
| Conta Brevo, quota, remetente e supressões | Proprietário/implementador | Envio real B06 |
| Disponibilidade semanal atual | Proprietário | Ritmo da campanha, não arquitetura |

## Registro de continuidade

Ao concluir trabalho, adicionar data, item Bxx, ambiente, evidência, testes executados, limitações e próxima ação. Marcar separadamente `documentado`, `implementado`, `testado_localmente`, `homologado_externamente` e `publicado`. Não substituir o histórico por uma afirmação genérica de “pronto”.

Os registros a seguir são históricos. Afirmações antigas como “em validação” descrevem aquela rodada; para o estado vigente usar as seções acima e o documento 23.

## Ferramentas de deploy — 22/10/2026

A pedido do proprietário, criados [guia raiz](../deploy.md), [atualizador](../atualizar.sh), alias de grafia altualizar.sh e orquestrador Python privado por configuração. Fluxo: pull fast-forward, imagem local exclusiva/ID, backup externo antes de migrations, atualização e saúde local/pública; worker opcional. Lock/checkpoint, backup diário, retomada explícita e preservação de banco/volumes. A construção na VPS é a alternativa autorizada em D46, sujeita a inventário e recursos; o fluxo externo por digest permanece disponível.

Testes de orquestração são simulados; Compose real foi conferido com dados sintéticos e arquivo normalizado, inclusive cifrões. Não houve pull de repositório real, alteração de VPS/proxy ou envio externo. O guia não conclui B05 nem os gates do produto. A próxima frente funcional continua B06; antes de release, concluir pendências e homologar imagem/migrations/restore e infraestrutura reais. Evidência final no documento 19 e em artifacts/deploy.

## Entrega de design — 20/10/2026

**Estado: design especificado.** Criados briefing central, identidade, tokens, componentes, wireframes públicos/painel, comportamento, matriz visual e fontes. Paletas clara/escura têm cálculo reproduzível. Nenhum frontend, protótipo, logotipo final ou skill global foi instalado/criado.

Novos requisitos R27–R34, tarefas B17–B20 e testes T22–T29 estão documentados, não implementados. Próxima ação técnica continua B01; em seguida B17 antes das coleções e telas. Publicação, screenshot renderizado, acessibilidade em browser e conversão permanecem não validados. Evidência documental em [validação](18-validacao.md).

## Implementação autorizada — 20/10/2026

Registro anterior preservado como histórico. Agora existe aplicação local Next/Payload/PostgreSQL; B01 tem migração e testes de API, e B17 está em andamento com screenshots da home vazia, fontes e temas. Evidências, limites e pendências no [documento 19](19-desenvolvimento.md). Nenhuma conta externa, VPS, publicação de livro ou venda foi verificada. Os dois textos históricos continuam íntegros. Não declarar fase 1 ou operação comercial completas.

## Continuidade — 21/10/2026

Coleções editoriais/ofertas e migrações aditivas testadas localmente: drafts, uploads por bytes, três provedores sintéticos, publicação, primária única concorrente. Catálogo, LPs, artigos, temas, institucionais, preview privado, checkout/campanha e histórico de slugs implementados. Teste HTTP integrado passou no runtime standalone, incluindo sitemap após publicação e flatten de redirecionamentos.

Primeira rodada pública: 170 screenshots, dois temas/seis larguras, axe/overflow sem falhas, título longo/capa ausente/teclado. Refinamentos posteriores na apresentação, menu e dashboard requerem rodada atualizada. Dashboard padrão apresentou três falhas de acessibilidade; substituição pelo ponto de extensão suportado está em validação. Não declarar B20 concluído. Sem integrações externas, VPS, livro real ou operação comercial.


## Relacionamento e lançamento — 21/10/2026

Primeiro título, domínio e responsável registrados em [lançamento](22-lancamento.md). Por decisão do proprietário, e-mail público ficará vazio até preparação de produção; público específico ainda pendente. Nenhuma oferta real publicada.

B06 possui serviços e migrações locais de captura/confirmação/descadastro, fila e transporte transacional desativado. `test:marketing` passou com transporte em memória e fixtures; a rodada HTTP/browser passou com 84 screenshots em seis larguras. Supressão manual auditável possui API, CLI e tela com 36 screenshots aprovados; sincronização automática, marketing promocional e homologação externa continuam pendentes. Detalhes e limites no [desenvolvimento](19-desenvolvimento.md). Captura real continua bloqueada por configuração/avisos até revisão. Não declarar fase 2 ou produto completo.

Recuperação administrativa pelo operador implementada/testada localmente: troca privada de senha, revogação das sessões/tokens e limpeza de bloqueio/cooldown. Recuperação por e-mail segue indisponível explicitamente; não confundir com transporte Brevo homologado. E-mail público permanece vazio conforme decisão do proprietário.

Calendário D+2/D+4/D+7/D+10 implementado/testado localmente: migração aditiva, sete grupos de domínio aprovados, arquivo vinculado preservado byte a byte e cadastro pelo formulário nativo. Rodada do calendário com 48 telas e revisão complementar com 12 telas aprovadas. Novo build isolado e regressão editorial com 20 telas passaram, incluindo ordenação por teclado, rascunho separado da publicação e rolagem sob movimento reduzido. Política compartilhada de quota implementada/testada posteriormente; agrupamento por tema/dia/cópia, claim promocional e API de campanhas Brevo continuam pendentes. Nenhuma promoção enviada. Substituição recusada de mídia não vinculada ainda exige cobertura de integridade antes do release.

## Integridade e manutenção de mídia — 22/10/2026

Reproduzida perda de arquivo anterior por ENOENT após substituição recusada. D47 corrige a exclusão antecipada com patch opt-in de Payload, arquivo novo por UUID, lock comum às mutações e coleta de órfãos após carência de 24h desde primeira observação. Seis grupos de integração passaram com arquivos sintéticos em diretório temporário e PostgreSQL loopback, incluindo falhas tardias, rollback e concorrência observada em pg_locks. O backup diário passa a coletar apenas depois do snapshot externo confirmado. Testes simulados do orquestrador: 24 aprovados, incluindo retomada após falha da coleta. Nenhum backup externo ou deploy realizado; sem nova migration. Evidência: [integridade](../artifacts/media-integrity/local-results.json). Catálogo e sete grupos de sequências revalidados; seis grupos de mídia repetidos após ajuste de cleanup. TypeScript, lint (dois avisos já conhecidos), 29 unitários, 24 testes do orquestrador e documentação aprovados. Build isolado .next-qa, CLI empacotado (--help e dry-run), acesso HTTP e site público na porta 3001 aprovados; servidor QA encerrado. Compose real e sintaxe de 27 blocos Bash do guia conferidos, sem iniciar containers. [Resumo da rodada](../artifacts/media-integrity/release-checks.json). Próxima frente funcional continua B06.

## Lotes promocionais locais — 22/10/2026

D48 e oitava migração 20261022_051922_promotion_batches aplicadas no PostgreSQL local. Preparação persiste lotes privados por tema/etapa/dia/cópia, referências de destinatários/etapas e identidade; não consome quota. Claim interno revalida elegibilidade e reserva destinatários únicos junto da mudança de estado. Concorrência, rollback, contexto afiliado/revisão, permissões, quota indivisível, supressão e indisponibilidade/reagrupamento passaram em seis grupos de integração, incluindo duas amostras do mesmo contato. Regressões: sete grupos de sequências e 11 de marketing aprovados. 31 unitários e TypeScript/lint aprovados (dois avisos antigos). [Evidência](../artifacts/promotion-batches/local-results.json).

Worker e promotions:prepare montam lotes, sem claim ou envio promocional. Sincronização de supressões/listas/campanhas, preferências individuais, transporte e conciliação continuam pendentes. Build isolado, CLI empacotado, HTTP de acesso (incluindo lotes) e site público aprovados; servidor QA encerrado. [Resumo e hashes](../artifacts/promotion-batches/release-checks.json). Nenhuma chamada externa, nova oferta/venda real ou alteração de VPS. Próxima ação conforme B06 acima.

## Bloqueios outbound Brevo — 22/10/2026

D49 e nona migração 20261022_053258_brevo_suppressions aplicadas somente no PostgreSQL local. Descadastro global e supressão manual gravam intenção na mesma transação do bloqueio local, mesmo offline. Fila privada por contato com revisão, lease, backoff, confirmação e retry explícito de falhas definitivas. Adaptador de consulta/PUT bloqueia somente emailBlacklisted=true, confere antes/depois e não altera endereço/consentimento nem cria contato ausente. Nenhuma API real foi chamada.

Oito grupos locais passaram, incluindo up/down e preenchimento de bloqueios anteriores dentro de uma transação revertida, concorrência, rollback, timeout aplicado, intenção nova em voo, lease e permissões. 38 unitários e regressões (11 grupos de marketing, sete de sequências e seis de lotes) aprovados. BREVO_CONTACT_SYNC_ENABLED=false por padrão; worker pode operar só bloqueios, sem transporte de e-mail. Claim/envio promocional continuam fora do worker. [Evidência](../artifacts/brevo-suppressions/local-results.json). Build isolado, CLI empacotado (ajuda/desativação/configuração inválida), worker sem funções, Compose real com flag desativada e HTTP de privacidade/supressão/outbox/site público aprovados. 25 testes simulados de deploy aprovados, incluindo worker só de bloqueios e recusa de chave ausente. Servidor QA encerrado. [Resumo com hashes](../artifacts/brevo-suppressions/release-checks.json).

## Conferência de destinatários — 22/10/2026

D50 e décima migração 20261022_054929_provider_preflight aplicadas somente no PostgreSQL local. Claim exige consulta recente de todos os destinatários únicos, conferência persistida vinculada ao lote e às versões locais, validade de cinco minutos e nova revisão transacional antes da quota. GET fora da transação; falha, ausência ou conferência antiga não reservam quota. Bloqueio observado gera action provider_blocked, sem inventar reclamação/bounce ou autorizar reativação, e cancela marketing preservando a amostra solicitada. Entrada manual não pode forjar essa action.

Sete grupos locais passaram: elegibilidade, consulta/falha/ausência, importação com rollback, replay/identidade, descadastro durante GET, expiração e mudança posterior de versão. Downgrade recusa apagar/reclassificar registros novos. 40 unitários aprovados. [Evidência](../artifacts/provider-preflight/local-results.json). Regressões (seis grupos de lotes, oito de bloqueios, 11 de marketing e sete de sequências), build isolado/empacotamento, HTTP de acesso/supressão e recusa de action forjada (422), site público, TypeScript/lint e 25 testes simulados de deploy aprovados. Servidor QA encerrado. [Resumo e hashes](../artifacts/provider-preflight/release-checks.json). Sem chamadas externas, criação de contato/lista/campanha ou envio; claim continua fora do worker.

## Cadastro consentido de contatos — 22/10/2026

D51 e décima primeira migração 20261022_060415_brevo_registrations aplicadas somente no PostgreSQL local. Confirmação de marketing e fila privada por contato no mesmo commit, mesmo com integração desativada. Só contato confirmado com assinatura ativa e sem bloqueio pode ser cadastrado. GET primeiro, POST mínimo com updateEnabled=false/forceMerge=false somente se ausente, novo GET para confirmar; contato existente não é atualizado/reativado.

Revisão e lease protegem concorrência/nova confirmação. Descadastro em voo mantém recuperação; compensação canceling não termina em 404 isolado de criação incerta e continua via canal de bloqueios mesmo com novos cadastros desativados. Retentativas exponenciais até seis horas, recusa definitiva requer retry explícito; identidade alterada exige revisão, sem retry automático. Nenhum endereço/corpo/token na fila. 45 unitários, dez grupos de cadastro (incluindo CLI empacotado habilitado com HTTP interceptado), regressões de marketing/sequências/lotes/bloqueios/preflight e 26 testes simulados de deploy aprovados. Build isolado, empacotamento final do worker/CLI, TypeScript/lint, Compose e HTTP de privacidade/site passaram; QA encerrado. [Resumo e hashes](../artifacts/brevo-registrations/release-checks.json). [Evidência](../artifacts/brevo-registrations/local-results.json). Sem API real, listas/campanhas ou mensagens.

## Listas exclusivas por lote — 22/10/2026

D52 e 12a migração 20261022_110941_brevo_batch_lists aplicadas somente no PostgreSQL local. Manifesto privado único por lote com pasta/nome opaco, conjunto de referências, ID externo e inclusões tentadas. Intentos commitados antes de criar/incluir; retornos conhecidos são preservados inclusive após descadastro. Reconciliação por nome exato/pasta ou ID confirmado pelo operador, sem novo POST de criação incerta. Inclusões em blocos de até 150, composição real paginada e exata; inclusões já tentadas não são repetidas cegamente. Campos de preferência ausentes não são presumidos livres.

Dez grupos de listas aprovados, incluindo conjunto de 200 destinatários em 150/50, concorrência, resposta incerta, descadastro, lease, composição expirada e CLI habilitado com HTTP interceptado. 51 unitários e 27 testes simulados de deploy passaram. Regressões de cadastro/bloqueios/preflight/lotes/marketing/sequências, TypeScript/lint, instalação congelada, Compose, build isolado e empacotamento final aprovados. HTTP de privacidade e site público passaram; QA encerrado. [Evidência](../artifacts/brevo-lists/local-results.json) e [resumo com hashes](../artifacts/brevo-lists/release-checks.json). Flag BREVO_LIST_SYNC_ENABLED=false; CLI privado somente, fora do worker e sem campanha/envio. Próxima frente: preferências/campanhas, webhook e conciliação.


## Preferências por assunto — 22/10/2026 (D53)

Consulta explícita e retirada temática via POST com token opaco existente, sem login, endereço na URL ou inclusão/reativação. GET não consulta dados privados nem altera consentimento. Assinatura, auditoria e cancelamento do calendário do assunto no mesmo commit; outros temas preservados. Último assunto cancela cadastro Brevo e enfileira bloqueio externo. Cancelamento global continua separado; amostras não dependem de marketing. Sem nova migração.

[Sete grupos locais](../artifacts/preferences/local-results.json) aprovados, incluindo isolamento/entrada HTTP, concorrência, rollback, confirmação antiga e recusa de lote preparado. [36 telas](../artifacts/qa-preferences/results.json), dois temas e seis larguras, com consulta por teclado e cancelamentos: axe/overflow sem falhas. Build isolado, 51 unitários/27 testes simulados e TypeScript/lint passaram; regressões de marketing/sequências/lotes e HTTP de acesso/site passaram; GET da API recusado com 405, QA encerrado. [Resumo e hashes](../artifacts/preferences/release-checks.json). Personalização em campanha, webhook e conciliação continuam pendentes.


## Links individuais de preferências Brevo — 22/10/2026 (D54)

13a migração local, intenção de token com hash/nonce, expiração fixa e reutilização/rotação sem estender links antigos. Cliente limitado ao atributo normal/text BIBLIOTHEON_PREFERENCES, sem mudar identidade/blacklist/listas. GET antes/depois; ack ou timeout sem valor observado não concluem. Preparação de lote com preflight e prova mínima de cinco minutos, revendo identidade/consentimento/tokens no fim. CLI fora do worker e BREVO_PREFERENCE_SYNC_ENABLED=false.

[Oito grupos](../artifacts/brevo-preferences/local-results.json) aprovados; 58 unitários, 28 testes simulados de deploy, build isolado e Compose passaram. Regressões de preferências/lotes/preflight/listas e HTTP de acesso/site passaram. [Resumo e hashes](../artifacts/brevo-preferences/release-checks.json). Nenhuma API real, campanha, envio, GitHub ou VPS. Renderização do placeholder e conta exigem homologação; próxima frente campanhas/transporte, webhook e conciliação.


## Rascunhos de campanhas Brevo — 22/10/2026 (D55)

14a migração aplicada somente no PostgreSQL local. Manifesto privado por lote com cópia/hash, ID e inventário de IDs observados, intenção antes de POST e lease. Retorno conhecido retido antes do GET; criação incerta reconcilia nome exato ou ID revisado, sem recriação por ausência. Recusa explícita sem ID exige retry privado. Colisão entre lotes preserva ID no inventário sem apropriação.

HTML gerado de texto manual, placeholders próprios de preferências/cancelamento nativo e checkout interno com contexto comercial; assunto com instrução de template é recusado. Cliente oferece somente criar/consultar rascunho clássico sem agendamento, com GET confirmando conteúdo/remetente/lista/estado. Exige listas/preferências/preflight frescos e consentimento no fim; nenhum claim, quota promocional ou envio. BREVO_CAMPAIGN_SYNC_ENABLED=false, CLI fora do worker. [Oito grupos locais](../artifacts/brevo-campaigns/local-results.json), 64 unitários e 29 testes simulados aprovados. Regressões de links/listas/lotes, TypeScript/lint, build isolado/runtime, Compose e HTTP de privacidade/site passaram; QA encerrado. [Resumo e hashes](../artifacts/brevo-campaigns/release-checks.json). Próxima frente: transporte, webhook e conciliação.


## Transporte promocional — D56, fechamento em 24/10/2026

15a migração conferida como aplicada somente no banco local. Preparação usa lease; emissão grava tentativa/token e reserva de destinatários no mesmo commit do claim. POST sendNow fora da transação; 204 é solicitação aceita/agendada, sem entrega individual comprovada. Recusas documentadas permitem retry somente por ação explícita e revisão completa, com nova reserva conservadora. Timeout/resposta desconhecida ou intenção emitida abandonada fica incerta sem repetir POST; resposta tardia da mesma tentativa pode confirmar solicitação.

Worker opcional com flag false: seleção limitada a 20 candidatos, no máximo uma nova campanha por ciclo, sem retry automático de recusa/incerteza. CLI privado e worker --once empacotados testados com rede interceptada. [12 grupos locais](../artifacts/brevo-send/local-results.json), incluindo quota, rollback, mudança UTC, concorrência, descadastro, falha após HTTP, seleção de lote e guard de downgrade. Build isolado/Compose e regressões de lotes/preflight/rascunhos/preferências/marketing/sequências passaram; 69 unitários e 30 testes simulados de deploy, tipos/lint, geração de tipos/import map inalterada e HTTP de privacidade/site aprovados; QA encerrado. [Resumo e hashes](../artifacts/brevo-send/release-checks.json).

Corrigido apenas down da migração 15: índice parcial removido antes da troca do enum e recriado depois; up já aplicado preservado. Fixture de downgrade dos rascunhos agora reverte a dependência de disparos primeiro, em transação integralmente revertida. Nenhuma mensagem/API real, imagem/restore atual, GitHub ou VPS. Próximo: observação/reconciliação e webhook, depois B07–B16; projeto completo ainda não pronto para produção.


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

## Revisão documental e plano de produção — 24/10/2026 (D68)

Pedido atual restrito à documentação. Criado [pendencias.md](../pendencias.md), com desenvolvimento P01–P07, homologação H01–H06, preparação do proprietário O01–O04, operação L01–L03 e expansão E01. Os itens são critérios de conclusão e responsabilidades, não entregas implementadas nesta rodada. Próxima implementação permanece B11: identidades históricas e resolução auditada, seguida de conciliação/financeiro; GitHub/deploy continuam com o proprietário.

Corrigidos resumos vigentes que ainda apontavam ausência de Kiwify/Cakto, confirmação CSV, callback Brevo ou contagens antigas de migrations. Estado atual, arquitetura/dados/interfaces, aquisição/métricas, infraestrutura/segurança, execução/pacote de produção, backlog e guia de deploy alinhados até D67. Evidências antigas preservadas e identificadas como históricas. E-mail público continua vazio até o proprietário adicioná-lo antes da produção.

Validador passou a incluir pendencias.md, única alteração de ferramenta; aplicação, configuração, migrations, testes e scripts de deploy preservados byte a byte contra o início desta revisão. Validação documental e diff de produto aprovados; log gerado preexistente excluído da conferência de whitespace. Nenhum teste de aplicação, consulta de banco, conta, envio, commit/push ou deploy executado nesta revisão. [Evidência da revisão](../artifacts/documentation/documentation-review-2026-10-24.json).

## Organização da raiz e CI — 24/10/2026 (D69)

Pedido de manutenção dos arquivos operacionais executado. Apenas atualizar.sh permanece para produção; altualizar.sh removido e referências de uso corrigidas. start.sh/stop.sh viraram wrappers Linux com controle comum em scripts/local-dev.py, identidade por kernel/sessão/checkout, lock, proteção de porta/registro legado, saúde e encerramento do grupo criado; --keep-db disponível. Nenhum start/stop foi executado sobre a aplicação/banco existentes.

README reorganizado com setup, comandos e mapa de pastas; .gitignore/.dockerignore incluem estado e logs locais. Log .local-logs/next.log retirado do índice Git e mantido no disco; nenhuma outra mudança foi adicionada ao índice nesta etapa. Acrescentados .nvmrc, .editorconfig e .gitattributes. Workflow usa o pin de Node compartilhado, execução manual, cancelamento de revisão supersedida, checkout sem credencial persistida, checks sem banco e integração sobre PostgreSQL descartável. Runners mantêm todas as suítes sequenciais e recusam execução sem confirmação explícita de ambiente sintético. Não há deploy automático.

192 unitários/27 arquivos, tipos e lint (dois avisos históricos), testes de operação e validação documental aprovados. Testes novos usam processos/comandos temporários; não são nova bateria HTTP/DB da aplicação. YAML/blocos Bash, exclusões/exemplos/evidências e retirada do alias conferidos. [Relatório D69](../artifacts/maintenance/root-files-2026-10-24.json). Sem conta externa, CI GitHub, commit/push ou VPS. Próxima implementação do produto permanece P01/P02 de pendencias.md; release integral ainda pendente.
