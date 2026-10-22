# 14 — Progresso e retomada

[Índice](../README.md) · [Backlog](13-backlog.md)

Atualização: 22/10/2026, America/Belem. Evidências da aplicação de 21/10 preservadas; ferramentas de deploy acrescentadas em 22/10.

## Estado real

| Frente | Estado | Evidência |
|---|---|---|
| Ideia e decisões | Definidas para primeira versão | Plano aprovado e documentos 01–17 |
| Documentação | Produzida; validação registrada no documento 18 | [Relatório](18-validacao.md) |
| Base / CI | Aplicação local implementada; CI preparado, sem execução GitHub | [Mapa vigente e evidências](23-estado-atual.md); 64 unitários; build isolado atual e HTTP aprovados localmente |
| Editorial / vitrine | Catálogo, três LPs, artigos, temas, preview, checkout e slugs implementados/testados localmente | test:catalog/site, 170 telas públicas e 36 de estados |
| Relacionamento | Captura, amostra, consentimento, supressão, recuperação por operador, calendário e quota locais | 11 grupos de marketing, 7 de sequências, 5 de recuperação; transporte real desligado |
| Marketing promocional | Parcial: lotes duráveis e claim/quota internos testados localmente | Seis grupos de lotes, oito de bloqueios outbound e sete de preflight, mais dez grupos de cadastro consentido aprovados; dez grupos de listas exclusivas aprovados; cancelamento por assunto implementado/testado localmente; rascunhos locais; transporte/webhook/conciliação pendentes; claim fora do worker |
| Eventos / financeiro / retenção | Ainda pendentes | B07–B12; campanhas cadastráveis não equivalem a eventos/vendas conciliadas |
| Design / QA | Fundação e rodadas renderizadas locais; B19/B20 parciais | Matriz integral, fase 2, performance e zoom nativo 400% ainda abertos |
| Imagem / backup | Ensaios locais de revisão anterior | Revalidar código/migrations atuais; backup externo e RPO/RTO reais pendentes |
| Guia / atualização da VPS | deploy.md e atualizar.sh implementados; altualizar.sh como alias | Orquestração simulada e Compose real/JSON sintético; sem implantação remota |
| Livros / primeiro título | Primeiro título selecionado; arquivos, público e oferta pendentes de conferência | [Lançamento](22-lancamento.md) |
| Links e produtos nas plataformas | Não verificados | Nenhuma conta acessada |
| Hotmart / Kiwify / Cakto | Não configurados e não homologados | Checklists individuais vazios |
| E-mail e domínio | bibliotheon.com.br informado; e-mail público ficará vazio até produção por decisão do proprietário | DNS/TLS/remetente não homologados; [lançamento](22-lancamento.md) |
| VPS | Especificação informada; não inspecionada | Nenhum acesso remoto realizado |
| Publicação / vendas | Não confirmadas neste projeto | Sem evidência comercial |

**Projeto completo ainda não pronto para produção.** O [estado atual](23-estado-atual.md) mapeia os 34 requisitos, código existente, quatorze migrations, relatórios, comandos e riscos. A revisão documental de 21/10 conferiu relatórios e metadados locais; não reexecutou os testes da aplicação nem iniciou agrupamento promocional. Git local conferido em 22/10: repositório existente com commit c518c6b; nenhum commit/push feito pelo agente nesta rodada. Na consulta ao banco local, owner/contatos/sequências/inscrições/etapas estavam zerados após as fixtures.

Riscos técnicos abertos: preservação/limpeza de mídia corrigidas e testadas localmente, ainda exigem homologação da imagem; aviso pg/Drizzle de queries concorrentes sem causa resolvida; dois avisos de lint na migration de sequências. Imagem atualizada e bateria integral do release continuam necessárias.

## Próxima ação técnica

Pedido de implementação recebido em 20/10/2026. B01 e B02 possuem evidência local. B03/B04/B18 implementados e com primeira rodada de testes; B17/B19/B20 em refinamento. Calendário e conteúdo manual D+2/D+4/D+7/D+10 implementados e testados localmente, incluindo cadastro nativo. Política compartilhada de quota implementada e testada com concorrência/rollback. B06: agrupamento durável e claim/quota internos implementados/testados localmente. Bloqueios outbound Brevo implementados em fila privada, testados localmente e desligados por padrão. Conferência/importação pontual de bloqueios no preflight implementada/testada localmente e obrigatória antes do claim. Cadastro consentido e compensação de descadastro em voo implementados localmente. Listas exclusivas de lote implementadas localmente com reconciliação de IDs/composição. Cancelamento por assunto implementado localmente sem reativação. Links individuais por destinatário preparados/testados localmente (D54). Rascunhos de campanhas com reconciliação implementados localmente (D55). Próxima frente: transporte, webhook/observação contínua e conciliação de resultado incerto, revalidando contratos oficiais antes de cada adaptador. Transporte promocional e claim do worker permanecem desativados. Depois continuar eventos/B07 e conectores/B08–B10, conciliação/relatórios e retenção. Rodada editorial atual passou com teclado, rascunho e movimento reduzido; cobertura de B20 permanece parcial. GitHub e deploy ficam com o proprietário. Retomar por [desenvolvimento](19-desenvolvimento.md) e [execução local](20-execucao-local.md).

## Dependências externas

| Pendência | Responsável | Bloqueia |
|---|---|---|
| Público, amostra, arquivos e preço do título selecionado | Proprietário | Campanha real B14 |
| E-mail público antes da produção e revisão institucional do responsável informado | Proprietário, conforme decisão já registrada | Publicação institucional/captura real; e-mail continua vazio no desenvolvimento |
| Inventário VPS/proxy/recursos livres | Operador autorizado | Deploy B05 |
| Destino externo de backup dentro do orçamento | Proprietário/operador | Produção B05 |
| Cadastro e elegibilidade por produto | Proprietário | Ativação das ofertas |
| Credenciais e eventos oficiais das três contas | Proprietário/implementador | Homologação B08–B10 |
| Contrato atual Kiwify e detalhes de autenticação Cakto | Implementador, fontes oficiais/conta | Ativação segura dos conectores |
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
