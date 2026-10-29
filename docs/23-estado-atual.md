# 23 — Estado atual e mapa da implementação

**Integração editorial local (28/10/2026):** pacote do projeto `ebooks`, prévia sem escrita e confirmação autenticada de livro/capa/ofertas implementados. Uma migration interna adicional; deploy e primeiro uso remoto pendentes. [Contrato e operação](integracoes/editorial.md).

[Índice](../README.md) · [Retomada](14-progresso.md) · [Backlog](13-backlog.md) · [Histórico técnico](19-desenvolvimento.md)

**Redesign público local — 28/10/2026:** apresentação pública atualizada e aceita no recorte B17/B20 com 342 capturas no mesmo build. A imagem D127 não contém esta alteração; P07 e homologações externas continuam pendentes. [Evidências e limites](../artifacts/qa-public-redesign/README.md).

**Registro histórico D129 (28/10/2026), anterior ao redesign público:** naquela revisão, código e imagem permaneciam na revisão D127: 35 migrations, 314 unitários, 62 operacionais e 16 suítes HTTP aprovados localmente. H05/B19/B20 aceitos localmente em D126. P07 continua aberto: [auditoria D128](../artifacts/documentation/p07-closure-audit-d128.json) identificou 12 coleções comerciais sem retenção geral e limites na exportação financeira. Desenvolvimento de retenção aguarda política de guarda e revisão por finalidade; contas, CI e segurança/VPS reais continuam pendentes. Backup opcional; nenhuma publicação ou alteração de produção. [Imagem D127](../artifacts/container/d127-results.json) e [mitigação de deepmerge](../artifacts/security/d127-deepmerge-mitigation.json) preservadas; esta revisão não reexecutou testes da aplicação.

O caminho sem backup foi exercitado na suíte operacional de deploy: atualização sem `backup_env`, captura restic ou snapshot, mantendo pausa antes das migrations, healthcheck e registro `backup_skipped` no manifesto. A suíte passou 40 testes; o [caso de regressão](../tests/ops/test_deploy.py) cobre a atualização sem configuração de backup. A simulação local não é deploy nem homologação operacional em VPS. `--sem-backup` permite seguir sem ponto recente de recuperação, que permanece pendente/opcional.

Estado revisado documentalmente em 28/10/2026 (D129; runtime D127): 35 migrations; D119 permite ao proprietário dissolver lotes comprovadamente locais na mesma transação, auditando contagens e mantendo etapas dos demais titulares. Estados externos/incertos continuam pendentes. Imagem D127 aprovada localmente em vazio/upgrade 32→35; 16 suítes HTTP D127 passaram. D123 valida a correção de foco e D125 a recuperação após falha do catálogo no build QA; D127 empacota essas correções, D126 e o patch de deepmerge; alterações posteriores de P07 exigem rever os gates afetados. O release integral continua condicionado aos gates remanescentes. P07 segue parcial para ledger/evidências, demais finalidades, conciliação externa e operação contínua.

## Situação do produto

Existe aplicação local funcional, com vitrine, painel manual e parte do relacionamento. **O projeto completo ainda não está pronto para produção.** Medição consentida e inbox/histórico comerciais comuns possuem implementação local D59/D61. Adaptadores Hotmart/Kiwify/Cakto D63–D65 seguem desligados e sem homologação. D87–D88 implementaram/validaram atribuição por `sck` UUID sintética; cada conta ainda exige homologação. D89 implementou retenção analítica agregada de 90 dias; D98 adiciona tombstone HMAC por 12 meses, D99 expira tokens de preferências vencidos, D100 expira auditorias comerciais resolvidas e D101 expira envelope da inbox processada preservando o ledger; D102 expira amostras confirmadas antigas sem remover prova vigente ou trabalho pendente. Retenção ampla de contatos/marketing/comércio continua pendente em P07; replay físico local passou com CLI do host em D106 e na imagem histórica D107 em D108. Guarda externa de recuperação permanece opcional; conciliação real continua pendente. P01–P05 têm aceite local D86. Teste sintético não comprova homologação, publicação ou venda.

O proprietário autorizou implementação e testes locais; GitHub e deploy na VPS ficam com ele. Git local conferido em 24/10: base cba2edb; D70–D72 permanecem no worktree; nenhum commit/push feito pelo agente nesta continuação. Sem execução de CI no GitHub comprovada ou acesso à VPS. Lotes promocionais duráveis foram acrescentados/testados localmente em 22/10; ver atualização final D48.

Primeiro título: **Crie Sistemas com IA e Ganhe Dinheiro**. Domínio informado: **bibliotheon.com.br**; responsável: **Warley Ferraz Almeida**. E-mail público fica vazio por decisão do proprietário, que o acrescentará antes da produção. Público específico, arquivos, preço, checkout e elegibilidade ainda precisam ser conferidos. Subdomínios não foram definidos. Ver [lançamento](22-lancamento.md).

Invariantes vigentes: nenhuma IA no produto; cadastro manual ou importação editorial revisada no Payload; checkout/entrega externos; Hotmart, Kiwify e Cakto mantidos separadamente; nenhuma avaliação, escassez ou renda inventada; clique, aprovação, recebimento e lucro são conceitos distintos. As duas conversas históricas são preservadas por hash.

## O que existe no código

| Área | Implementação presente | Limite atual |
|---|---|---|
| Base e acesso | Next/Payload/PostgreSQL, owner único, provisionamento privado, REST/Local API protegidas, GraphQL desabilitado, healthchecks | MFA/allowlist/VPN e operação do host não homologados |
| Editorial | Temas, livros, artigos, mídia, amostras, ofertas, campanhas e redirects; drafts, preview e validação de publicação | Fixtures não são livros/ofertas reais |
| Vitrine | Home, catálogo/busca/filtro/paginação, três LPs, artigos/temas, institucionais, sitemap/robots | Indexação exige revisão institucional; performance de campo não medida |
| Checkout | URL por host exato/provedor, campanha afiliada sem fallback, referência `sck` da saída consentida quando ausente | Redirect não confirma compra; atribuição exige callback compatível e segue parcial até QA/homologação por conta |
| Amostras | Captura, confirmação por POST, PDF privado temporário, consentimento opcional e descadastro | Captura e transporte desligados; sem contato público legalReady permanece falso |
| E-mail solicitado | Outbox, jobs, dispatcher, tokens só em hash, transporte Brevo transacional e classificação de falhas | Testes em memória; nenhum envio real ou remetente homologado |
| Supressão | Serviço, API owner/origem exata, formulário e CLI; auditoria por referência HMAC, fila outbound e callback inbound D58 | Testados localmente e desligados; homologação Brevo pendente |
| Cadastro consentido Brevo | Fila atômica com opt-in confirmado; reconciliação, lease e compensação tardia, listas/rascunhos/transporte/observação | Testes sintéticos locais D51–D58; flags false e conta não homologada |
| Conectores nativos | Hotmart D63, Kiwify D64 e Cakto V1/V2 D65; autenticação e recepção durável com fixtures | Endpoints locais desligados por padrão; contas/relatórios/reenvios ainda não homologados |
| Conciliação CSV / financeiro | Snapshot D66/D67, associação D72, decisão financeira D74, evidências D75–D77, ledger D78 e interfaces de prévia/importação/registro/identidade D79–D83 | 202 queued não é aplicação; P01–P05 locais D86; faltam casos/cobertura completos e aceite integrado das interfaces; sem layout nativo homologado |
| Inbox comercial | Recepção durável, conflitos, projeções/fatos/auditoria, lease/backoff, CLI/worker e retry owner; resoluções auditadas D72–D75 | Acompanhamento/retry visuais D62; atribuição, cobertura final de conciliação e homologação pendentes; QA por etapa na seção final |
| Retenção e privacidade | D89–D119: retenção analítica/auditoria/amostras/identidade/marketing por assunto, revisão de opt-in ativo, pending e replay v1–v4, exportação/exclusão/correção owner e inventário agregado | `DATA_RETENTION_ENABLED=false`; P07 ainda tem finalidades amplas, dependências compartilhadas, conciliação externa, revisão humana e operação contínua pendentes |
| Recuperação do owner | CLI por stdin privado, senha nova, revogação de sessões/tokens e limpeza de lockout | Recuperação por e-mail indisponível; forgot/reset 503 genérico, unlock público negado |
| Sequências | Conteúdo manual revisado, snapshot imutável por inscrição, calendário D+2/4/7/10, elegibilidade e cancelamento | Agrupamento durável local; sem campanhas externas ou envio real; transporte sintético D56 validado |
| Quota | Contabilidade compartilhada por destinatário/dia UTC, teto até 250 e reserva transacional padrão 50; lock e rollback | Reserva ligada ao claim e à intenção de disparo no mesmo commit; worker opcional com flag false |
| Apresentação | Fontes locais, tokens canônicos, claro/escuro/system, variantes/acento por enum, extensões Payload e patches locais de acessibilidade | B19/B20 com aceite local D126; novas telas ou falhas exigem revalidar o recorte afetado |
| Infraestrutura | Dockerfile, Compose, perfis app/migrate/worker, runtime limitado, CLIs empacotadas, backup/restore opcional | Imagem e HTTP D122 aprovados localmente; consolidar os gates remanescentes antes do release final. `--sem-backup` dispensa recuperação recente |

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
| R11 | Parcial; base D59–D61 local e atribuição D87 parcial; release pendente | Consentimento, saídas e inbox locais. D87 transporta UUID consentida em `sck` e exige retorno/contexto compatíveis; Fluxo HTTP sintético integrado D88 validado nos três provedores; callback real e homologação por conta pendentes |
| R12 | Parcial, local | Adaptador/endpoint Hotmart v2, inbox e HTTP D63; conta, atribuição, relatório e homologação pendentes |
| R13 | Parcial | Adaptador/endpoint Kiwify nativos locais D64; HMAC, inbox e centavos testados. Conta, relatório, tempos de reversão e homologação pendentes |
| R14 | Parcial | Adaptador/endpoint Cakto V1/V2 locais D65; assinatura/janela e lote atômico testados. Conta, relatório, MED e homologação pendentes |
| R15 | Implementado/testado localmente D66–D86; homologação pendente | Dois contratos canônicos, origem/auditoria, 21 estados/provedores, seis provas recusadas e jornada integrada; sem parsing nativo ou homologação de fornecedor |
| R16 | Parcial por dependências/homologação; P04 local D78–D85 | Liquidações/custos, cobertura/coortes, detalhamentos por livro/provedor/campanha e sucesso registrado aceitos localmente; null honesto. Aceite integrado P05 local D86; atribuição P06 e homologações/release ainda pendentes |
| R17 | Parcial | Cadastro de campanha/hipótese existe; tarefas, prazo e kit autorizado pendentes |
| R18 | Pendente | Título escolhido; sem lançamento, três conteúdos ou distribuição comprovados |
| R19 | Pendente | Modelo semanal existe; relatório conciliado e rotina comercial ainda não executados |
| R20 | Local | Teclado, axe, contrastes e inspeção amostral na matriz combinada D121–D126; sem certificação WCAG ou aceite automático de telas futuras |
| R21 | Laboratório local aprovado; campo pendente | D121: orçamento público e 75 requests; D124: 45 jornadas/180 requests comerciais. p75/INP de campo após tráfego suficiente; capacidade da VPS depende do ambiente real |
| R22 | Local; ambiente real pendente | D127: ACL/runtime, uploads WebP, troca inválida preservada, restart/mídia e CLI/worker; 16 HTTP no build QA atual. Segredos/admin/alertas do host continuam pendentes |
| R23 | Parcial, local | Container limitado e banco privado testados; VPS/proxy/baseline não inspecionados |
| R24 | Parcial, local | D114: restore físico host das 34 migrations, mídia e nove entradas v4 com retirada legada derivada sem escrita. Imagem final, destino externo, continuidade e RPO/RTO reais pendentes; backup pode ser dispensado pelo proprietário no deploy |
| R25 | Parcial, local | Inbox/histórico duráveis, retorno após commit, replay/retry e auditoria D61; acompanhamento/retry visuais D62; recepção nativa local nos três provedores D63–D65; homologação externa pendente |
| R26 | Parcial | Auditoria D128: 43 coleções inventariadas; 12 comerciais sem retenção geral. Política financeira, finalidades/pedidos, conciliação externa e rotina real precisam fechar P07-A–E. Recuperação externa somente se adotada |
| R27 | Local | Fontes, tokens, briefing e QA de fundação; continuar aplicando em telas novas |
| R28 | Local | Claro/escuro/system, persistência, storage negado e estados públicos/admin avaliados na matriz D121–D126 |
| R29 | Local | 76 pares de contraste autorizados e matriz de controles/estados auditada D126; inspeção manual amostral, sem certificação WCAG |
| R30 | Local | Três variantes e acentos controlados, test:catalog/site e QA público; sem CSS livre |
| R31 | Local | Seis larguras, conteúdo adverso, reflow 320px e zoom nativo 400% D121/D123; matriz combinada D126 |
| R32 | Local | Reduced-motion, teclado e fallbacks/movimento padrão D121–D126; sem bloqueio conhecido nos cenários avaliados |
| R33 | Local | Painel editorial, contatos/integrações, inbox e views financeiras com dados/estados sintéticos; aceite local D126 |
| R34 | Local | Screenshots, adversidades, correções e inspeção amostral; aceite local da matriz D121–D126, sem certificar produção |

## Evidências conferidas

A fotografia vigente usa relatórios consolidados, com revisão e limites explícitos. Não somar capturas de fases diferentes como uma execução única. Registros históricos abaixo e no documento 19 preservam os resultados anteriores.

| Evidência | Resultado registrado | Limite |
|---|---|---|
| [Release local D127](../artifacts/container/d127-checks.json) | 314 unitários/37 arquivos, 62 operacionais, build QA/Docker e checks aprovados | Não é CI remoto ou deploy; resultados preservados, não repetidos nesta revisão documental |
| [Imagem D127](../artifacts/container/d127-results.json) | Banco vazio e upgrade real 32→35; ACL/runtime, mídia, CLIs e worker aprovados; oito provas de deepmerge empacotado | Rede local isolada; sem restore físico nesta imagem, registry ou VPS |
| [HTTP D127](../artifacts/container/h03-http-d127-results.json) | 16 suítes após o patch; banco descartável removido | Build QA; nenhum provedor real homologado |
| [Mitigação D127](../artifacts/security/d127-deepmerge-mitigation.json) | 16 regressões CJS/UMD e patch versionado contra GHSA-gcqx-w48m-w2h4 | Auditoria bruta mantém um aviso low da versão publicada; não declarar zero advisories |
| [Aceite visual combinado](../artifacts/qa-release-layout/d126-h05-acceptance.json) | H05/B19/B20 aceitos localmente pela matriz D121–D126 | Inspeção manual amostral; não certificação WCAG, métricas de campo ou capacidade da VPS |
| [Administração e medição D126](../artifacts/qa-release-layout/d126-results.json) | Dez suítes, 354 capturas, 346 axe e oito sem JavaScript | Fixtures sintéticas; builds/reutilização por escopo documentados |
| [Adversidades públicas D125](../artifacts/qa-release-layout/d125-results.json) | 208 verificações/capturas/axe, incluindo erro e recuperação do catálogo | 180 resultados preservados e 28 recapturados com auditoria de hashes |
| [Formulários D123](../artifacts/qa-release-layout/d123-results.json) | 250 verificações, 284 capturas e 238 axe; foco, erros, fallback e zoom ativo | Recortes e retomada auditada constam no relatório |
| [Zoom D121](../artifacts/qa-release-layout/d121-native-results.json) e [laboratório público](../artifacts/qa-release-layout/d121-results.json) | Zoom nativo 400% em 60 combinações; 12 medições e 75 requests com 30 livros/três temas/30 artigos | Laboratório local; não INP/p75 de campo ou benchmark da VPS |
| [Carga comercial D124](../artifacts/qa-release-layout/d124-results.json) | Mil transações sintéticas, 45 jornadas/180 requests, cinco/dez clientes, sem erro ou duplicação | Não SLA ou capacidade do ambiente real |
| [Auditoria P07 D128](../artifacts/documentation/p07-closure-audit-d128.json) | 43 coleções inventariadas; 12 comerciais sem retenção geral; limites da exportação identificados | P07-A–E permanecem abertos; inventário não é expurgo ou aceite de privacidade |
| [Restore histórico D114](../artifacts/recovery/d114-results.json) | Restore físico local da revisão com 34 migrations e manifesto v4 | Não certifica recuperação da imagem D127 ou destino externo; H04 opcional |

## Banco, versões e artefatos

Versões fixadas em [package.json](../package.json), lockfile, [.nvmrc](../.nvmrc), Dockerfile e Compose: Node 22.23.3 na imagem/CI (host local usado: 22.23.4), pnpm 10.34.7, Next 16.4.2, React 19.3.1, Payload 3.91.0, Sharp 0.35.5 e PostgreSQL 17.9 por digest. Overrides e patches Payload/deepmerge são versionados; usar instalação com lockfile. Nenhuma skill foi instalada globalmente.

**35 migrations declaradas**, verificadas em banco vazio e upgrade real 32→35 na [imagem D127](../artifacts/container/d127-results.json). Lista conforme [migrations/index.ts](../migrations/index.ts):

1. `20261021_012104_initial`
2. `20261021_013444_catalog`
3. `20261021_104729_public_site`
4. `20261021_121334_relationship`
5. `20261021_155133_relationship_jobs`
6. `20261021_155500_relationship_invariants`
7. `20261021_233105_sequences`
8. `20261022_051922_promotion_batches`
9. `20261022_053258_brevo_suppressions`
10. `20261022_054929_provider_preflight`
11. `20261022_060415_brevo_registrations`
12. `20261022_110941_brevo_batch_lists`
13. `20261022_115043_brevo_preferences`
14. `20261022_120651_brevo_campaign_drafts`
15. `20261022_123536_brevo_campaign_sends`
16. `20261024_064354_brevo_campaign_observations`
17. `20261024_070440_brevo_webhook_events`
18. `20261024_071409_brevo_send_recipients`
19. `20261024_073316_analytics`
20. `20261024_115633_commercial_inbox`
21. `20261024_190859_commercial_imports`
22. `20261024_231500_offer_identity_guard`
23. `20261025_003403_catalog_resolutions`
24. `20261025_014000_commercial_review_lookup`
25. `20261025_031113_financial_resolutions`
26. `20261025_041432_financial_report_evidence`
27. `20261025_051744_report_evidence_csv`
28. `20261025_054113_financial_ledger`
29. `20261025_185933_analytics_retention`
30. `20261025_192350_privacy_request_audit`
31. `20261025_213716_marketing_suppression_tombstones`
32. `20261025_224500_commercial_inbox_envelope_retention`
33. `20261026_231335_contact_retirements`
34. `20261027_001515_theme_withdrawals`
35. `20261027_033952_active_marketing_review`

A imagem atual é `bibliotheon:local-d127-secured` (alias local `bibliotheon:local-d127`), ID `sha256:2239f2200be691eb71b9d7bd42569daabb157c98f32d54a620957860e57de86e`. ID local não é digest publicado de registry nem comprova deploy. O primeiro build anterior ao patch não recebeu aceite de release; a tag D127 passou a apontar para a imagem corrigida.

Restore físico D114 é histórico da revisão com 34 migrations; não certifica restauração da imagem atual. Backup/manifesto externo/restore pertencem à capacidade opcional H04. Com `--sem-backup`, sua ausência não bloqueia o deploy; P07 e os demais gates continuam necessários.

Desenvolvimento e QA usam caches/processos separados (`.next` e `.next-qa`, com porta livre reservada). Não presumir que uma porta esteja ativa por ter sido usada em testes; preservar processos existentes. Bancos, containers e volumes descartáveis D127 foram removidos; o banco configurado de desenvolvimento foi preservado.

## Rotas e comandos existentes

Inventário de código, sem substituir os contratos de [interfaces](06-interfaces.md). Events consentidos, inbox/retry, três webhooks nativos e importação limitada existem localmente. Relatórios financeiros permanecem previstos; nenhuma rota nativa implica homologação externa.

| Grupo | Rotas existentes |
|---|---|
| Público | /, /ebooks, /ebooks/[slug], /artigos, /artigos/[slug], /temas/[slug], /[institutional], /robots.txt, /sitemap.xml |
| Conteúdo privado/saída | /preview/ebooks/[id], /comprar/[offerId], /api/v1/media/[id] |
| Relacionamento | /amostras/[slug], /amostras/confirmar, /preferencias; POST /api/v1/lead-requests, /api/v1/lead-confirmations, /api/v1/unsubscribe; GET /api/v1/downloads/[token] |
| Admin | /admin, /admin/suppressions, /admin/financial-ledger, /admin/commercial-imports e /admin/financial-records e /admin/catalog-resolutions e /admin/financial-resolutions; POST /api/v1/admin/suppressions; CRUD/autenticação Payload /api/[...slug] protegido |
| Medição | POST /api/v1/analytics-consent, /api/v1/analytics-withdrawal e /api/v1/events; aviso e retirada nas páginas públicas |
| Inbox comercial | /admin/commercial-inbox; POST /api/v1/admin/inbox/[id]/retry |
| Recepção comercial | POST /api/v1/webhooks/hotmart, /api/v1/webhooks/kiwify, /api/v1/webhooks/cakto |
| Conciliação CSV | POST /api/v1/admin/imports/preview, /api/v1/admin/imports e /api/v1/admin/imports/[id]/commit; importação canônica de evidência em /api/v1/admin/report-evidence/imports/*; coleções privadas somente leitura; UI em /admin/commercial-imports |
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
| npm run privacy:retention / test:privacy-retention | Preview/apply de retenção de privacidade e suíte sintética; apply é mutante, exige revisão do cutoff e nunca deve apontar para dados reais antes da aprovação da política |
| npm run promotions:prepare | Até 100 etapas por execução, somente elegibilidade local; sem quota ou envio promocional |
| npm run test:integration / test:catalog / test:site | Acesso, domínio editorial e HTTP público |
| npm run test:marketing / test:sequences / test:admin-recovery | Domínio de relacionamento, calendário e recuperação por operador |
| npm run brevo:suppressions / brevo:contacts / brevo:lists / brevo:preferences / brevo:campaigns / brevo:send / brevo:observe / brevo:webhook-replay | CLIs privados para bloqueios, cadastro, listas, links individuais e rascunhos e transporte; flags separadas, envio real desligado |
| npm run test:batches / test:preflight / test:preferences / test:brevo-sync / test:brevo-contacts / test:brevo-lists / test:brevo-preferences / test:brevo-campaigns / test:brevo-send | Fixtures sequenciais dos contratos promocionais locais |
| scripts/qa-*.ts; scripts/qa-container.py | QA renderizado, restore e container; comandos em execução local/pacote de produção |
| node scripts/build-runtime.mjs | Empacota migrate, create-admin, recover-admin, apply-suppression, prepare-promotions, media-gc, sync-brevo-suppressions, sync-brevo-registrations, prepare-brevo-list, prepare-brevo-preferences, prepare-brevo-campaign, send-brevo-campaign, observe-brevo-campaign, replay-brevo-webhook, process-commercial, worker e worker-health em .release |
| python3 scripts/check-compose.py; ops/recovery.py | Configuração e backup/restore; ver procedimento de produção |
| python3 scripts/generate-tokens.py; python3 scripts/validar_contrastes.py; python3 scripts/validar_documentacao.py | Tokens, contrastes e estrutura documental; contraste padrão não mutante |

Comandos que compartilham banco sintético executam fixtures sequencialmente. O runner `admin-final` pode executar no máximo duas suítes em paralelo, cada uma com banco/mídia exclusivos; não compartilhar fixtures entre elas. Check estático não substitui build, integração, navegador, imagem ou homologação. O workflow em .github/workflows/quality.yml prepara geração, validação, testes, migrations, build e testes HTTP; não instala navegador, não executa toda a matriz de screenshots nem constrói/homologa imagem. Não há execução comprovada no GitHub.

## Pendências concretas e ordem de retomada

O [plano F01–F05](25-fechamento-producao.md) e [pendencias.md](../pendencias.md) governam o fechamento. P01–P05 têm aceite local; P06 aguarda homologação por conta. H05/B19/B20 e a imagem/API atuais têm evidência local, sem produção homologada.

1. P07-A: definir duração/marco de guarda financeira e revisar finalidades/exceções com o responsável. Essa informação continua pendente; não presumir prazo para expurgo.
2. P07-B/C: implementar e validar retenção/minimização comercial e a cobertura de pedidos de dados a partir da política; o inventário não executa retenção e a exportação por e-mail não seleciona ledger automaticamente. A [auditoria D128](../artifacts/documentation/p07-closure-audit-d128.json) identifica o conjunto restante.
3. P07-D/E, H01/H02/H06 e O01–O04: conciliar cópias/pending, homologar cada conta, material/contato, rotina/alertas, proteção administrativa, CI e ambiente real com proprietário/operador. Não enviar segredos ou dados reais para Git/documentação.
4. Após código posterior, renovar somente os gates afetados e a imagem correspondente. GitHub e deploy permanecem com o proprietário; backup é opcional por `--sem-backup`.

Melhorias evolutivas ficam para atualizações. Esta revisão documental mantém o runtime D127 e não reabre testes aprovados sem mudança ou falha nova.

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


## D70 — Prevenção de novas ambiguidades do catálogo — 24/10/2026

P01/B11 parcial: a API Payload recusa nova identidade externa duplicada em provedor/conta/produto/oferta (null e vazio equivalentes), ou associação do mesmo produto a outro livro. Inclui ofertas inativas; ofertas externas distintas para o mesmo livro continuam permitidas. Locks transacionais existentes serializam criações/alterações; edição de metadados legados permanece possível sem reescrever identidades/fatos. Não existe bypass no contexto da aplicação. As fixtures de ambiguidade histórica usam SQL exclusivamente no banco sintético.

[Evidência local](../artifacts/catalog-identities/local-results.json): quatro grupos com permissão via API local Payload, concorrência de criação/update, rollback, isolamento dos três provedores/contas e legado. Comando: BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:catalog-identities; incluído no runner sequencial/CI preparado. Sem migration nova: continuam 21. Não é proteção contra SQL administrativo direto, teste HTTP/browser ou homologação externa.

Próxima ação: complementar P01 com integridade no banco e fluxo auditado de resolução histórica, preservando referências/fatos originais; depois P02–P04. P01 e produção continuam pendentes.

Validação D70: [checks e regressões locais](../artifacts/catalog-identities/release-checks.json) aprovados: tipos/lint (dois avisos históricos), 192 unitários, 57 testes de operação, documentação, catálogo e regressões de inbox (12 grupos), CSV (cinco) e importação (dez). Aviso pg/Drizzle reproduzido, sem causa resolvida. Relatórios desta reexecução foram preservados na pasta D70, mantendo os relatórios históricos originais. Sem novo build/HTTP/browser/imagem/restore.


## D71 — Integridade SQL de identidades do catálogo — 24/10/2026

Migração 22, [offer_identity_guard](../migrations/20261024_231500_offer_identity_guard.ts), aplicada somente no PostgreSQL local. Trigger BEFORE INSERT/UPDATE/DELETE e índice por provedor/conta/produto reforçam o guard da API D70: impedem novas duplicatas (null/vazio equivalentes), associação do produto a outro livro e alteração/exclusão de identidade com transação histórica. Inclui ofertas inativas. Preserva registros legados e seus metadados; não escolhe livro/oferta automaticamente nem altera fatos.

[Evidência SQL local](../artifacts/catalog-identity-db/local-results.json): seis grupos, papel runtime efêmero sem DDL, concorrência observada em pg_locks, API versus SQL, commit/rollback, lote de INSERT revertido, isolamento de contas/provedores, compatibilidade das chaves de lock e upgrade sem alteração de registros legados. Comando: BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:catalog-identity-db; incluído no runner sequencial de CI preparado. Sem novo serviço/flag/coleção ou campos/tipos Payload. Produção e P01 continuam pendentes até a resolução histórica auditada e homologação do release.

Validação final D71: [checks, hashes e regressões](../artifacts/catalog-identity-db/release-checks.json), com 192 unitários, 57 testes de operação, tipos/lint/documentação e regressões locais de catálogo, inbox e CSV/importação aprovados. [Censo independente após cleanup](../artifacts/catalog-identity-db/cleanup-counts.json): ofertas/owners/transações/inbox/lotes zerados, 22 migrations, trigger habilitado e nenhum papel de teste restante. CLIs reconstruídas pela suíte inbox; sem novo build Next/HTTP/browser/imagem/restore. Dois avisos históricos de lint e aviso pg/Drizzle permanecem. P01 continua aberta para decisões auditadas de associação histórica.


## D72 — Associação histórica auditada — 24/10/2026

P01 concluída como implementação/testes locais D70–D72: prevenção de novas duplicidades pela API/banco e trilha imutável de associação/hold com fonte, justificativa, autor e revisões. Permite escolher oferta no namespace ou diretamente livro conferido, corrigindo um cadastro único errado sem duplicá-lo. Transações/fatos/cadastros originais são preservados; novos fatos vinculam a decisão usada. Inbox e CSV consultam a associação efetiva; lote desatualizado não confirma. A decisão não contorna revisão financeira nativa, colisão ou evidência insuficiente.

Migração 23 aplicada/testada somente em PostgreSQL local; coleção privada catalog-resolutions, referência opcional nos novos fatos e constraints/triggers. [Contrato completo](24-conciliacao.md). Coleção nativa é somente de leitura owner; API privada exige origem exata e confirmação revalidada/idempotente. Interface customizada permanece em P05, sem nova QA visual.

[Evidências e hashes D72](../artifacts/catalog-resolutions/release-checks.json): 198 unitários/28 arquivos, 57 testes de operação, tipos/lint/documentação, nove grupos locais e três HTTP de resolução, regressões de catálogo, inbox, CSV/importação e guards D70/D71. Build standalone isolado .next-qa e 11 suítes HTTP locais aprovados; geração de tipos/import map conferida. [Censo independente](../artifacts/catalog-resolutions/cleanup-counts.json): owners/contatos/ofertas/histórico/inbox/importações/decisões zerados nas tabelas consultadas; 23 migrations, quatro triggers habilitados e nenhum papel efêmero restante. Servidor QA encerrado, porta 3000 sem listener; .next preservado. Relatórios desta reexecução ficam na pasta D72 e os históricos anteriores foram preservados.

P02 é a próxima ação: divergências e colisões de identidade da transação/valores/moeda/datas/estados com prova e auditoria. Depois P03/P04 para ampliar conciliação e financeiro. R15/B11 continuam parciais; P05/P06/P07, imagem final/upgrade/banco vazio/restore, segurança/privacidade/visual/performance e homologação externa permanecem abertos. Dois avisos antigos de lint e aviso pg/Drizzle continuam sem resolução. Sem contas externas, GitHub, VPS, mensagem, publicação ou venda real. Projeto completo ainda não pronto para produção.


## D73 — Quarentena e prévia do componente financeiro — 24/10/2026

P02 permanece parcial. Corrigida a quarentena quando uma variante da mesma chave de evento nomeia outra transação: recepção sinaliza as projeções dos dois IDs, e worker/retry/CSV consultam também os IDs dos envelopes de commercial-conflicts. ID ainda sem projeção não é aplicado por outro recibo limpo. Fatos, envelopes, referências e valores conhecidos são preservados. Migração 24 acrescenta lookup funcional e repara flags legadas; reutiliza o índice transaction_key existente.

Nova API owner/origem exata POST /api/v1/admin/transaction-resolutions/preview expande todos os recibos/variantes conectados A–B–C e permite simular uma escolha por recibo. Abre transação READ ONLY, revalida hashes/schema e usa a projeção e associação comuns. **Sempre provisional=true/committable=false.** processable não autoriza escrita; hold, cobertura incompleta, fonte insuficiente/ignorada, processamento ativo, catálogo pendente ou projeção divergente ficam explícitos. [Contrato](24-conciliacao.md).

[Checks, hashes e limitações D73](../artifacts/transaction-review/release-checks.json): 206 unitários/29 arquivos, 57 testes de operação, tipos/lint/documentação; sete grupos locais, três HTTP de revisão, regressões inbox/CSV/importação/associação e 12 suítes HTTP locais aprovados. Build standalone isolado .next-qa aprovado; servidor QA encerrado. [Censo independente](../artifacts/transaction-review/cleanup-counts.json): tabelas comerciais consultadas, owners/contatos/ofertas zerados; 24 migrations e índices conferidos; contato público vazio/legalReady=false. [Limpeza de processos/fixtures](../artifacts/transaction-review/process-cleanup.json): porta 3000 sem listener e nenhum backup institucional de fixture pendente. Relatórios anteriores preservados; reexecuções ficam na pasta D73. Dois avisos históricos de lint e aviso pg/Drizzle continuam abertos.

Próxima ação: persistir decisão financeira imutável com autoria/fonte/justificativa/idempotência e aplicar as projeções efetivas atomicamente para o componente inteiro, revalidando sob barreira de conta. Integrar evidência nova e prova complementar/relatórios quando as variantes existentes não bastarem, sem escolher dois lados da mesma chave em decisões separadas. P03–P07, UI, imagem final/upgrade/banco vazio/restore, QA visual/performance/segurança e homologação externa continuam pendentes. Sem GitHub, contas reais, VPS, mensagem externa, publicação ou venda. O projeto completo ainda não está pronto para produção.


## D74 — Decisão financeira e aplicação atômica — 25/10/2026

Decisão owner imutável por componente completo, com autoria/fonte/motivo/idempotência, cobertura por recibo, hold/revisões/pais e projeções efetivas. Aplicações têm trilha separada e são atômicas com decisão/projeções/novos fatos elegíveis. Originais são preservados; produto/livro/oferta efetivos ficam separados. Novo fato nativo limpo pode continuar a escolha; novo conflito ou união de componentes exige revisão completa. Worker/retry/CSV conferem vigência. Migração 25 aplicada e down/up vazio ensaiado localmente; com provas o downgrade é recusado. [Contrato](24-conciliacao.md).

[Oito grupos locais](../artifacts/financial-resolutions/local-results.json), [três HTTP](../artifacts/financial-resolutions/http-results.json) e [checks/hashes](../artifacts/financial-resolutions/release-checks.json): rollback tardio owner/worker, integridade de vínculos, concorrência/idempotência, fusão de componentes, produto/livro corrigidos, continuidade por reembolso nativo, hold/stale e permissões/imutabilidade. 211 unitários/29 arquivos, 57 testes de operação, tipos/lint/documentação, regressões comerciais e 13 suítes HTTP locais aprovados. Build standalone isolado atualizado após o ajuste final de integridade. Dois avisos históricos de lint e aviso pg/Drizzle permanecem em H06.

[Censo independente](../artifacts/financial-resolutions/cleanup-counts.json): owners/contatos/ofertas e tabelas comerciais consultadas zerados, inclusive decisões/aplicações; 25 migrations, guards/índices conferidos; contato vazio/legalReady=false. [Limpeza de processos](../artifacts/financial-resolutions/process-cleanup.json): porta QA livre e nenhum backup de fixture pendente. Banco local encerrado preservando volume; 127 relatórios anteriores preservados byte a byte, com [15 reexecuções separadas](../artifacts/financial-resolutions/replayed-reports.json).

P02 continua parcial para evidência complementar quando as fontes existentes não bastam, junto de P03. Próxima ação: implementar esse contrato de prova e os casos restantes de conciliação; depois liquidação/custos/relatório P04, UI P05, atribuição P06 e retenção P07, incluindo as novas trilhas. Atestação do operador não é autenticação/homologação de relatório ou conta externa. Sem nova imagem/restore, QA visual, conta externa, mensagem, GitHub, VPS ou operação real. Projeto completo ainda não pronto para produção.


## D75 — Evidência complementar e conclusão local P02 — 25/10/2026

P02 implementada/testada localmente com prova canônica individual, imutável e atestada pelo owner. Fonte/linha/autoria, referências de substituição e IDs relacionados integram a revisão completa; escolher substituto exige excluir fonte anterior e não permite sobreposição. Sem prova de aprovação/reversão, estado/data incoerentes ou origem íntegra, confirmação continua bloqueada. Cadastros de prova não aplicam valores nem criam webhook/fato nativo. Novo relatório exige decisão; fato nativo limpo pode continuar a escolha conforme D74. [Contrato](24-conciliacao.md) e [auditoria P02 por requisito/evidência](../artifacts/report-evidence/p02-audit.json).

Migração 26 aplicada localmente, com down/up vazio e recusa de downgrade com prova; coleção readonly e guard SQL imutável. [Seis grupos locais](../artifacts/report-evidence/local-results.json) cobrem ID corrigido, origem/fonte insuficiente, substituições, rollback, deduplicação/concorrência, CSV/lote stale, continuidade nativa e correções de moeda/valor/data/estado. [Três HTTP](../artifacts/report-evidence/http-results.json) cobrem acesso/origem/MIME/contrato, resposta privada, evidência insuficiente e aplicação explícita. [Checks/hashes](../artifacts/report-evidence/release-checks.json): 223 unitários/30 arquivos, 57 testes de operação, tipos/lint/documentação, regressões comerciais e 14 suítes HTTP locais aprovados. Build isolado final inclui limites de consulta/gravação.

[Censo independente](../artifacts/report-evidence/cleanup-counts.json): tabelas comerciais consultadas/owners/contatos/ofertas zerados, inclusive prova/decisão/aplicações; 26 migrations e guards/índices conferidos; contato vazio/legalReady=false. [Processos/fixtures](../artifacts/report-evidence/process-cleanup.json): porta QA livre e sem backup institucional pendente; banco local encerrado preservando volume. 148 relatórios históricos preservados byte a byte; [17 reexecuções separadas](../artifacts/report-evidence/replayed-reports.json).

Próxima ação: P03, ampliar ingestão/lotes e os casos restantes de conciliação com prova de aprovação/reversões e recebimento independente junto de P04. O CSV de treze colunas/confirmador D67 não foi ampliado nesta etapa. B11/R15 continuam parciais; P04/P05/P06/P07 e gates de [pendencias.md](../pendencias.md) seguem abertos. [Consulta de fontes](../artifacts/report-evidence/source-review.json) não confirmou esquema de exportação nativa; não foi implementado parser de relatório nativo nem alterada autenticação dos provedores. Dois avisos de lint e aviso pg/Drizzle permanecem em H06. Sem nova imagem/restore, QA visual, conta externa, mensagem, GitHub, VPS ou operação real. Projeto completo ainda não pronto para produção.

## D76 — Lote canônico de evidências — 25/10/2026

Endpoint owner de lote JSON `POST /api/v1/admin/report-evidence/batch`, 1–20 registros D75, transação all-or-nothing e deduplicação por referência de linha. Sete grupos locais, quatro grupos HTTP da evidência, 14 suítes HTTP, 223 unitários/30 arquivos, 57 testes de operação, lint/typecheck/documentação e build `.next-qa` passaram; dois avisos antigos de lint e aviso pg/Drizzle permanecem. [Evidência D76](../artifacts/report-evidence/d76-checks.json). O endpoint não interpreta CSV/exportações nativas; P03 permanece aberta. Runner HTTP encerrado em 3001; prévia 3000 preservada; banco sintético parado com volume preservado. Sem deploy/VPS ou homologação externa.

## D77 — CSV canônico de evidências — 25/10/2026

O CSV de evidência em 18 colunas tem preview provisório, stage durável D67 e commit explicitamente confirmado/revalidado. Snapshot D66 de 13 colunas não mudou. Migração 27 está aplicada localmente; parser (13 testes), typecheck e integração local (10 grupos) passaram. [Checks D77](../artifacts/report-evidence/d77-checks.json) comprovam 224 unitários/30 arquivos, 57 operacionais, build isolado e 14 suítes HTTP (cinco grupos HTTP de evidência). CSV permanece transcrição canônica do owner, sem parser nativo ou homologação externa. P03 continua aberta para os casos restantes; sem VPS, conta externa ou produção.


## D78 — Ledger financeiro parcial — 25/10/2026

P04 possui implementação local de duas coleções privadas e imutáveis e três endpoints owner: evidência independente de liquidação, custos e relatório provisório. O serviço exige pagamento aprovado/verificado, preserva crédito/débito, substituições append-only e moedas separadas. Relatório tem coortes por aprovação, movimentos pelo período liquidado e custos pelo período ocorrido; ausência é null, margem completa false e lucro fiscal não calculado. Cobertura e limites estão em [conciliação](24-conciliacao.md).

Migração 28 aplicada localmente. Typecheck, 225 testes unitários/30 arquivos, lint com dois avisos históricos, 59 testes operacionais, documentação, integração sintética de ledger, build `.next-qa` e 15 suítes HTTP aprovados. Evidências: [local](../artifacts/financial-ledger/local-results.json), [HTTP](../artifacts/financial-ledger/http-results.json), [checks](../artifacts/financial-ledger/d78-checks.json). Faltam UI P05, cobertura completa P04/P03, release final/restore, revisão de privacidade/segurança/visual/performance e homologação H01–H06. Nenhuma mudança em GitHub/VPS, conta externa ou operação real.

## D79 — Painel financeiro somente leitura e QA visual recortado — 25/10/2026

P05 iniciada no admin do Payload com `/admin/financial-ledger`: apenas owner, filtro GET por período/moeda, coortes e prévia D78 sem mutação. Exibe valores incompletos como “Não informado”, cobertura, recebimentos por créditos/débitos e custos confirmados/estimados em janelas próprias; não sugere lucro nem converte moedas. O dashboard fornece acesso direto. A interface operacional de CSV/resolução e registro de evidências/custos permanece pendente.

Build `.next-qa` passou. QA navegador local em banco sintético cobriu acesso anônimo, estado vazio em dois temas e 14 capturas de relatório em claro/escuro de 320 a 1920 px: sem overflow da página, violações axe ou erros de runtime; filtros foram submetidos por teclado e tabelas largas permanecem em região rolável. [Resultados e screenshots](../artifacts/qa-financial-ledger/results.json). O CSS foi ajustado após inspeção visual direta de 320 px e nova matriz completa passou. Fixtures foram limpas; nenhuma requisição externa foi permitida. Isto é evidência parcial B20 somente para esta tela, não homologação visual integral.

Typecheck está incluído no build; a validação documental passou (49 documentos, 868 links locais, 34 requisitos, 20 tarefas, 29 cenários e 76 pares de contraste). P03/P04/P05 continuam parciais. Faltam telas operacionais, cobertura integral, release/restore atual, segurança/privacidade/performance, homologação de contas externas e etapas H01–H06. Sem alteração na VPS/GitHub ou operação real.

## D80 — Importação pelo painel e documentação alinhada — 25/10/2026

View owner `/admin/commercial-imports` reutiliza as APIs de snapshot/evidência, sem nova migration, flag, segredo ou serviço. Upload/prévia, preparação idempotente, dados completos por linha, confirmação explícita, retomada/auditoria e paginação estão implementados localmente. As coleções nativas continuam readonly. O check geral D80 passou com 225 testes unitários/30 arquivos e 61 operacionais; a correção visual final usa entrelinha proporcional e verificação própria no texto 200%. [8 grupos e 24 capturas](../artifacts/qa-commercial-imports/results.json) cobrem três provedores, ausência de persistência na prévia, respostas perdidas após stage/commit sem duplicação, stale real, bloqueios/erros/tamanho, teclado, loading, duas aparências, 320–1920 px, texto 200% e fallback sem JS. São 23 análises axe sem violações; fallback sem JS tem controles próprios. Zero overflow nas capturas, erros de runtime ou tentativas externas; fixtures limpas.

Build `.next-qa`/typecheck, lint (dois avisos históricos), documentação e controle negativo de troca de título aprovados; [checks](../artifacts/qa-commercial-imports/release-checks.json). O aviso pg/Drizzle conhecido reapareceu, sem causa resolvida. Revisão dos 49 documentos corrigiu resumos antigos, inventário de migrations e recuperação dos documentos 17/24, encontrados como cópias indevidas de métricas. [Auditoria e hashes documentais](../artifacts/documentation/documentation-review-d80.json). Decisões e contratos restaurados não ampliam o escopo aprovado.

P03/P04/P05 continuam parciais: casos/cobertura integrais, resolução visual e registro operacional de liquidação/custos ainda faltam. P06/P07 e H01–H06 permanecem abertos; 28 migrations declaradas, sem nova imagem/restore, conta externa, GitHub, VPS ou operação real. As fontes externas mantêm suas datas de consulta; essa revisão local não substitui a revalidação de homologação.

## D81 — Registro financeiro operacional — 25/10/2026

`/admin/financial-records` está implementado localmente: owner, conferência local sem escrita, registro/correção por endpoints D78, valores exatos sem ponto flutuante, instantes UTC, fontes/linhas, campanha opcional e histórico vigente/substituído. O mapeamento campaignId → campaign foi corrigido e verificado por leitura do relacionamento no banco, inclusive após correção. Os originais permanecem; identidade/fonte/campanha fixadas seguem os limites do contrato, sem backfill nem migration nova.

[Seis grupos de jornadas e 40 capturas](../artifacts/qa-financial-records/results.json), [oito capturas de ampliação](../artifacts/qa-financial-records/zoom-results.json), build/typecheck e 22 testes novos de valor/data passaram localmente. Total: 48 capturas e 47 análises axe, com dois formulários, claro/escuro, 320–1920px, texto 200%, teclado, erro/carregamento, correções, zero explícito, resposta perdida após gravação repetida sem duplicação, três provedores/moedas, paginação e fallback sem JS. Sem overflow da página, erros de runtime ou tentativas externas. Lint/pg mantêm os avisos históricos. [Checks da fase](../artifacts/qa-financial-records/release-checks.json) e [auditoria dos documentos](../artifacts/documentation/documentation-review-d81.json).

P05 ainda exige resolução auditada pela UI e cobertura integral dos estados. P03/P04, atribuição/P06, retenção/P07 e H01–H06 seguem abertos. Não há nova migration (28 declaradas), imagem/restore final, conta externa, GitHub, VPS ou operação real; não declarar sistema pronto para produção.

## D82 — Resolução de identidades do catálogo — 25/10/2026

View owner `/admin/catalog-resolutions` implementada sobre os contratos D72: associação por livro/oferta ou hold inconclusivo, prévia sem escrita, escopo/destino/hash/revisão/snapshot, fonte/motivo e atestação, confirmação revalidada e idempotente, histórico por provedor com anterior/sucessora. GET não grava e as coleções nativas continuam imutáveis. Nenhuma migration, dependência, segredo ou flag nova; são 28 migrations. A decisão não reescreve transações nem substitui a resolução financeira.

Build `.next-qa` e check geral passaram: typecheck, lint sem erros (dois avisos históricos), 247 unitários/31 arquivos e 61 operacionais. [QA local](../artifacts/qa-catalog-resolutions/results.json): seis grupos, 29 capturas, 28 análises axe sem violações; sem overflow da página, erros de runtime ou requisições externas. Foram verificados prévia sem persistência, fonte/atestação de hold, três provedores, resposta perdida após commit e repetição sem duplicação, alvo inválido, plano stale e nova conferência, transações originais preservadas, snapshot paginado 20+1, histórico 20+2 com empate de data, filtros, permissão por API e fallback sem JS. Formulário em claro/escuro e 320–1920px; formulário/conferência com texto 200%/320px e IDs longos. A rodada detectou alvos de interação pequenos no detalhe: botões/links corrigidos antes da repetição aprovada. Capturas representativas de detalhe, desktop e ampliação foram inspecionadas.

Fixtures limpas, contagens confirmadas no banco local e PostgreSQL parado com volume preservado. [Checks/hashes](../artifacts/qa-catalog-resolutions/release-checks.json) e [revisão dos documentos](../artifacts/documentation/documentation-review-d82.json). O aviso pg/Drizzle conhecido reapareceu e H06 continua aberto. P03/P04/P05 seguem parciais: próxima ação é a interface de resolução financeira auditada e cobertura integral, depois atribuição/retenção e gates de release. Sem zoom nativo 400%, imagem/restore final, conta externa, GitHub, VPS ou operação real.

## D83 — Resolução financeira pela interface — 25/10/2026

View owner `/admin/financial-resolutions` implementada sobre os contratos D73–D75. Consulta inicial obtém o componente sem gravar hold; operador confirma/exclui fontes e variantes explicitamente, prepara prévia de todo o componente, confere efeitos/bloqueios e registra conciliação ou hold com fonte/motivo/atestação. Nenhuma seleção automática. Escolha/hash/metadados/UUID são conservados para repetição após resposta perdida; stale exige outra prévia. Histórico/detalhe mostram pais/cabeças e separam resultado registrado de aplicações posteriores; fontes/variantes/resultados paginam 20, decisões 20 e aplicações 10. Sem JS há leitura/filtro/detalhe e prova JSON integral; consulta nova/registro exigem JS. Sem schema, migration, dependência, segredo ou flag nova; 28 migrations.

Corrigida exibição compartilhada de centavos negativos, usando BigInt absoluto e sinal explícito: -1 centavo agora aparece como -0,01, mantendo precisão até o limite seguro. Quatro testes novos, sem alterar cálculo financeiro ou entrada não negativa de liquidação/custo. Build `.next-qa`, typecheck, lint sem erros (dois avisos históricos), 251 testes unitários/31 arquivos e 61 operacionais passaram. A inspeção visual detectou entrelinha restaurada pelo shorthand font nos botões em 200%; fixada após o shorthand e verificada por comparação computada de fonte/entrelinha antes da rodada final.

[QA final](../artifacts/qa-financial-resolutions/results.json): sete grupos/34 capturas/33 análises axe sem violações, sem overflow da página, runtime ou requisições externas. Cobertura: contradição bloqueada, exclusões explícitas, conciliação/hold, preservação de fatos originais, resposta perdida após commit e repetição sem duplicar decisão/aplicação, concorrência stale, relatório substituto/exclusão obrigatória, três provedores/moedas, 11 reembolsos posteriores via worker e 12 aplicações em páginas 10+2, 21 fontes em páginas 20+1 conservando escolhas. Também permissões por API, fallback sem JS, 14 combinações de tema/largura 320–1920px, seleção/conferência com texto 200%/320px, loading/erro/sucesso e detalhe nos dois temas. Capturas representativas foram inspecionadas. Não certifica zoom nativo 400%, performance ou toda a matriz B20.

Fixtures limpas, contagens independentes do banco zeradas e PostgreSQL parado preservando volume. [Checks/hashes](../artifacts/qa-financial-resolutions/release-checks.json) e [auditoria documental](../artifacts/documentation/documentation-review-d83.json). Aviso pg/Drizzle conhecido reapareceu; H06 continua aberto. P03/P04/P05 continuam parciais para cobertura integral/aceite integrado. Próximo: conferir os critérios/estados de conciliação e cobertura financeira e encerrar o aceite integrado das interfaces; depois atribuição/retenção e gates de release. Sem imagem/restore final, conta externa, GitHub, VPS ou operação real.

## D84 — Cobertura financeira, quarentena e coortes — 25/10/2026

Corrigida a contagem de liquidações por moeda/coorte (antes reutilizada entre moedas), inclusão visível de candidatas em revisão state=unknown e exclusão dos seus valores das coortes. Datas ausentes têm contagens próprias sem inferência de período; caixa/custos mantêm período independente, resolvendo substituições antes do filtro. Overflow de totais mantém null com motivo explícito e cobertura da origem. Coortes agora mostram população sem revisão/quarentena, estado de reversão, taxa somente com cobertura integral e idade observada, com windowVerified=false. observedAt é consulta, não último processamento. Sem migration/schema, dependência, segredo ou flag nova; continuam 28 migrations.

Sete unitários novos verificam quarentena, ausência versus zero, contagem única de reversão, estado conhecido sem valor, idade sem prazo presumido, população vazia e limite inteiro. Check geral: 258 unitários/32 arquivos, 61 operacionais, tipos e lint sem erros (dois avisos históricos). Build `.next-qa` passou. [Cinco grupos PostgreSQL](../artifacts/financial-coverage/local-results.json) cobrem moedas/períodos, correção que sai da janela, revisão unknown/datas ausentes, zero conhecido, overflow positivo/negativo e leitura sem escrita. A regressão existente financial-ledger também passou em três grupos; a nova suíte entra no runner sequencial de integração/CI preparado, sem execução no GitHub.

[QA local](../artifacts/qa-financial-coverage/results.json): quatro grupos/21 capturas, 20 análises axe sem violações, sem overflow da página/runtime/tentativas externas. POST real confirmou autorização/origem/MIME/período/privacidade e novos campos; UI confirmou tabela/denominadores/0% versus taxa desconhecida, filtro GET/erro, scroll regional por teclado, dois temas e 320–1920px, texto 200% com entrelinha proporcional e leitura/filtro sem JS. Captura representativa inspecionada. Fixtures limpas e contagens independentes zeradas; PostgreSQL parado com volume preservado. Aviso pg/Drizzle conhecido reapareceu; H06 continua aberto.

[Checks/hashes](../artifacts/financial-coverage/release-checks.json), [auditoria de aceite P03/P04/P05](../artifacts/financial-coverage/acceptance-audit-d84.json) e [revisão documental](../artifacts/documentation/documentation-review-d84.json). P03/P04/P05 continuam parciais: faltam comprovação integral dos casos persistidos de conciliação, detalhamentos por livro/provedor/campanha e último processamento bem-sucedido; depois, aceite integrado das interfaces. Atribuição P06 e retenção P07 continuam abertas. Não houve layout nativo/conta homologados, zoom nativo 400%, imagem/restore final, GitHub, VPS ou operação real.

## D85 — Detalhamentos financeiros e processamento registrado — 25/10/2026

Implementadas dimensões por livro efetivo/provedor/campanha, separadas por moeda, com cobertura de valores/revisão/atribuição e custos declarados versus parcela sem campanha. Referência de clique/custo não atribui receita: campanha específica continua com quantidade/receita null sem P06. Caixa de aprovação fora da janela mantém alocação; revisão/vínculo ausente/moeda divergente ficam sem livro conferido, preservando o movimento. Custos não são rateados por livro/provedor e esses grupos não calculam margem.

Sucesso vem de lastSuccessAt já persistido pelos processadores. População é approval_window, com cobertura de datas válidas não futuras; sucesso histórico não libera revisão atual nem prova saúde global do provedor. observedAt e lastEventAt continuam distintos. Títulos/códigos atuais são rótulos; IDs e originais ficam preservados. Tabelas paginam 20 grupos por GET, mantendo filtros/disclosure aberto, inclusive sem JS. Sem schema/migration, dependência, segredo ou flag nova; 28 migrations.

Build `.next-qa` e check geral passaram: 264 unitários/33 arquivos, 61 operacionais, tipos e lint sem erros (dois avisos históricos). Seis unitários novos cobrem dimensões, alocações desconhecidas, campanha sem inferência, processamento/datas e aritmética. [Quatro grupos PostgreSQL](../artifacts/financial-dimensions/local-results.json) verificam processamento real da inbox, campos efetivos, moedas/caixa, custos/campanhas e snapshot sem escrita; [cinco grupos de cobertura reexecutados](../artifacts/financial-dimensions/coverage-regression-results.json) passaram. A suíte de regressão atualiza seu caminho padrão e a reexecução D85 está identificada na cópia acima.

[QA final](../artifacts/qa-financial-dimensions/results.json): quatro grupos/25 capturas distintas/24 análises axe sem violações, sem overflow da página/runtime/tentativas externas. POST real, títulos/códigos, sucesso separado de evento/consulta, 21 grupos de livro em páginas 20+1, filtros, disclosure preservado, dois temas/320–1920px e livros/campanhas em texto 200%/320px com entrelinha proporcional; paginação sem JS. Captura representativa inspecionada. Fixtures e livros extras limpos; contagens independentes zeradas e PostgreSQL parado preservando volume. Aviso pg/Drizzle conhecido reapareceu; H06 continua aberto.

P04 implementado/testado localmente conforme [auditoria dos critérios](../artifacts/financial-dimensions/p04-audit-d85.json). [Checks/hashes](../artifacts/financial-dimensions/release-checks.json) e [revisão documental](../artifacts/documentation/documentation-review-d85.json). Próximo: prova integral dos casos persistidos P03 e aceite integrado P05, depois atribuição P06/retenção P07 e release/homologações. Não encerra R16/B11 dependentes, B20 integral, zoom nativo 400%, conta/fornecedor, imagem/restore, GitHub ou VPS; produto completo ainda não pronto para produção.

## D86 — Estados canônicos e aceite operacional conjunto — 25/10/2026

P03/P05 implementados/testados localmente, conforme [auditoria P03](../artifacts/commercial-state-matrix/p03-audit-d86.json) e [auditoria P05](../artifacts/qa-commercial-operation/p05-audit-d86.json). Aplicação/schema não mudaram: build D85 foi reutilizado com 25 fontes registradas mais recentes conferidas contra D80–D85. Nenhuma migration, dependência, segredo ou flag nova; continuam 28 migrations.

[Seis grupos PostgreSQL/27 casos](../artifacts/commercial-state-matrix/local-results.json): sete estados por provedor persistidos/confirmados/aplicados separadamente (21), seis provas insuficientes/incompatíveis recusadas sem transação, preview sem escrita, stage durável sem aplicação, commit/decisão idempotentes, conflito bloqueado, arquivo inválido/misto/futuro/nativo não suportado, rollback após registro de provas e antes da confirmação final, stale por prova nova, reestágio duplicado e snapshot de 13 colunas compatível/queued/reprocessável. Não foi necessário mudar a lógica existente. Matriz entra no runner sequencial após report-evidence.

[Seis grupos navegador/22 capturas distintas/21 análises axe](../artifacts/qa-commercial-operation/results.json) passaram: cinco views negam anônimo; CSV de sete estados passa por prévia/stage/commit sem fabricar transação; catálogo desconhecido bloqueia, associação auditada libera nova conferência; sete decisões preservam estado/valores/null/livro; caixa pendente é recusado, aprovação permite caixa separado e custo manual; relatório distingue 400,00 BRL de bruto, 75,00 de caixa e 10,00 de custo sintéticos, sem margem completa/atribuição inferida. Reimportação não duplica. Resultado consultável nos dois temas e sem JS, sem overflow/runtime/tentativas externas. Captura representativa inspecionada; não encerra matriz B20 integral, zoom nativo 400% ou performance.

Check geral passou: 264 unitários/33 arquivos, 61 operacionais, tipos/lint sem erros (dois avisos históricos). Fixtures limpas e contagens independentes zeradas; PostgreSQL parado preservando volume. Aviso pg/Drizzle conhecido reapareceu; H06 permanece aberto. [Checks/hashes](../artifacts/commercial-state-matrix/release-checks.json) e [revisão documental](../artifacts/documentation/documentation-review-d86.json).

P01–P05 têm aceite local D86. A cadeia P06 foi exercitada por HTTP sintético nos três provedores D88 e no relatório, sem provar entrega da conta. Próximo desenvolvimento: P07/retenção e política; em paralelo, H01 deve confirmar callback/campo em cada conta e H03–H06 validar o release final. Nenhuma conta, envio, venda, imagem/restore final, CI/GitHub ou VPS foi homologada. R15/R16/B11 completos para produção continuam dependendo desses gates; objetivo permanece em desenvolvimento.

## D87 — Referência de checkout consentida — 25/10/2026

`/comprar/{offerId}` registra a saída e acrescenta `sck` apenas quando medição está ativa, campanha vigente e consentimento válido; mantém URL já configurada com `sck` e não emite referência se o registro opcional falhar. O valor passado é a UUID do próprio `checkout-clicks`, sem cookie/ID analítico ou dados pessoais.

Os três adaptadores filtram a origem para UUID. A prévia financeira cruza a UUID retornada ao registro de saída, valida consentimento, provedor, conta na identidade histórica da oferta, livro/oferta e janela de 30 dias; revisão e falta de prova não atribuem. Receita de campanha depende da cobertura completa de bruto e reversões. Custos não criam venda e não há ROAS/margem.

Validação executada nesta etapa: 84 unit tests direcionados e typecheck passaram. QA PostgreSQL/HTTP integrado, revisão visual e contas externas não foram executados. P06 permanece parcial até a cobertura integrada e homologação separada dos três provedores; P07 continua aberta. [Pesquisa/critério/evidência](../artifacts/attribution/p06-audit-d87.json). Schema mantém 28 migrations.

## D88 — Atribuição HTTP nos três provedores — 25/10/2026

O checkout consentido passou pela rota HTTP e preservou o `sck` configurado pelo operador, sem acrescentar UUID própria quando não há consentimento. Os callbacks HTTP sintéticos Hotmart, Kiwify e Cakto foram ligados à inbox, projeção e prévia financeira. Hotmart também cobriu replay, contexto incompatível, referência livre e ausente; Kiwify/Cakto cobriram replay e atribuição por campo sintético. Receita permaneceu null porque reversões sem valores não são presumidas. [Quatro evidências HTTP](../artifacts/attribution/p06-audit-d88.json).

`npm run build`, `npm run typecheck` e `npm run check` passaram; o check reportou 280 unitários/34 arquivos e 61 operacionais, lint sem erros (dois avisos históricos). As quatro suítes HTTP usaram PostgreSQL local sintético e limparam as fixtures; o banco foi parado preservando volume. Não houve contato com provedor/conta, envio, venda, migration, visual QA ou deploy. Próximos gates: P07, callback real de cada conta H01, imagem/upgrade/restore e demais H03–H06.

## D89 — Retenção analítica inicial — 25/10/2026

Migration 29 cria `analytics-daily-aggregates` com chaves de dimensão/controladas e contagem, sem relacionamento com visitante, grant, sessão ou clique. `runAnalyticsRetention` oferece preview e apply. Page views e checkout clicks com mais de 90 dias são agregados por dia UTC, tipo, livro/campanha/provedor e família de rota; slug nunca é copiado. Incrementar/criar o agregado e apagar cada evento-fonte ocorre na mesma transação, sob lock idempotente. Contextos de grant expiram após 30 dias. Depois, visitas sem eventos vinculados e anteriores ao prazo são removidas; grants vencidos só são excluídos sem visitas dependentes. Limites analytics/request expirados também são removidos.

CLI `npm run analytics:retention` é preview; `--apply` executa. Worker diário requer `DATA_RETENTION_ENABLED=true`; Compose/exemplos deixam falso. [Quatro grupos PostgreSQL sintéticos](../artifacts/analytics-retention/local-results.json) passaram (preview sem escrita, agregação/expurgo, reexecução idempotente e downgrade protegido). Migration aplicada no banco local. `npm run check` passou com 280 unitários/34 arquivos, 61 operacionais, tipos, lint e documentação; permanecem dois avisos históricos de lint. Build standalone passou, incluindo CLI empacotada. Fixtures removidas.

P07 continua parcial: nenhum fluxo de localizar/exportar/corrigir/excluir contato foi implementado; filas de envio/marketing, consentimento, inbox, importações e evidências/decisões comerciais não entram na retenção D89; não há manifesto tombstone nem reaplicação pós-restore. A flag permanece desligada e a revisão da política para operação real ainda é requisito. Sem dados reais, restore, conta externa ou produção.

## D90 — Exportação privada de titular — 25/10/2026

Migration 30 cria auditoria de pedidos de dados com fingerprint HMAC, ação, resultado, contagens, owner e instante. A rota `POST /api/v1/admin/privacy/export` exige sessão owner, Origin pública exata e declaração `identityVerified: true`; a verificação real da identidade ocorre fora do sistema. Retorna dados de contato e relações paginadas (incluindo recibos vinculados às etapas) com allowlist de campos, excluindo hashes, chaves, HMACs de destinatários e payloads. Resposta `private, no-store`/`no-referrer`; exportação não gera log com email nem grava conteúdo no audit. A suíte sintética passou em oito grupos [com evidência local](../artifacts/privacy-export/local-results.json); build standalone e `npm run check` passaram (280 unitários/34 arquivos, 61 operacionais, lint sem erros e dois avisos históricos). Nenhuma identidade real, pedido externo ou envio foi processado.

P07 segue parcial: ainda faltam correção de contatos vinculados com conciliação segura, exclusão abrangente, cancelamento global de envios pendentes, retenção de relacionamento/comércio e reaplicação após restore. A flag de retenção permanece desativada; nenhuma revisão jurídica ou operação real foi inferida.

## D91 — Retenção da auditoria de pedidos — 25/10/2026

`runPrivacyRequestAuditRetention` aplica o default documental de 24 meses a `privacy-request-audit`; preview informa cutoff/candidatos sem PII, e apply exclui seletivamente, uma linha por transação idempotente. CLI `privacy:retention` usa preview por padrão e aceita `--apply`. O worker diário executa esse expurgo junto da retenção analítica sob `DATA_RETENTION_ENABLED=true`, falso nos exemplos. [Cinco verificações PostgreSQL sintéticas](../artifacts/privacy-retention/local-results.json) passaram. Não há migration nova nem mudança do default habilitado. P07 continua aberta para retenção abrangente das demais coleções, correção/exclusão completa e restauração.

## D92 — Expiração de solicitações não confirmadas — 25/10/2026

A rotina de privacidade também remove pedidos de amostra não confirmados há mais de sete dias, seus eventos de solicitação e entregas do outbox. Transação e advisory lock do contato coordenam cleanup com confirmação/envio; estados `sending/uncertain` mantêm pedido e identidade para conciliação. Contato só é excluído quando não há referências restantes nem supressão. Preview segue sem mutação; apply é repetível, sem migration ou mudança da flag. Sete verificações PostgreSQL sintéticas: [resultado D92](../artifacts/privacy-retention/d92-results.json).

## D93 — Exclusão owner parcial — 25/10/2026

`POST /api/v1/admin/privacy/delete` requer owner, origem exata, `identityVerified: true` e confirmação `EXCLUIR`. A transação local remove relações de relacionamento, recibos associados e limites por endereço, registra contagens sem email e preserva fatos comerciais não relacionados. O tombstone HMAC retido por 24 meses evita recriação pelo formulário de amostra e pela importação de supressão. Duas verificações PostgreSQL sintéticas passaram: exclusão e proteção contra recriação; envio `uncertain` resulta em `pending` e mantém os dados para conciliação. [Resultado D93](../artifacts/privacy-delete/d93-results.json).

Estados Brevo existentes, eventos pendentes, envios em andamento/incertos e manifestos compartilhados bloqueiam a exclusão sem efeitos parciais. Não há remoção externa nem chamada a API do provedor. Correção, retenção ampla, reconciliação manual e reaplicação pós-restore permanecem em P07; sem migration nova ou produção.

## D94 — Homologação HTTP local da exclusão — 25/10/2026

O teste standalone confirmou owner obrigatório, origem exata, confirmação literal, resposta sem endereço, `private, no-store`, `no-referrer`, repetição idempotente e `pending` com preservação do contato quando o envio está `uncertain`. A verificação encontrou a política global do Next sobrescrevendo o `Referrer-Policy` das rotas de privacidade; `/api/v1/admin/privacy/:path*` agora aplica cabeçalhos privados. Build otimizado e suíte HTTP sintética passaram. [Resultado HTTP](../artifacts/privacy-delete/http-results.json).

D95 implementou inicialmente correção só para contato sem relações. D96 amplia `POST /api/v1/admin/privacy/correct`: mantém subscriptions, eventos de consentimento, pedidos confirmados, sequências e promoções locais elegíveis; invalida tokens e revoga solicitação não confirmada; exclui tokens antigos de preferência. Jobs Brevo sem tentativas seguem o contato atualizado; opt-in ativo elegível pode gerar job local de cadastro. Envio incerto/ativo, jobs Brevo já tentados/concluídos, webhooks e manifestos externos retornam `pending`. O teste sintético confirmou consentimento preservado, confirmação/outbox invalidados, revisão do job local, idempotência e bloqueio de envio incerto. `identityVerified` continua declaração do operador; sem sincronização externa, envio ou teste de restore.

## D102 — Retenção de amostras confirmadas — 25/10/2026

Pedidos confirmados há mais de 24 meses podem expirar com seu outbox terminal e eventos diretamente vinculados, preservando atividade recente, sequência dependente, referências incompletas e prova de opt-in vigente. Uma assinatura posterior só libera a anterior com evento de consentimento correspondente. Contatos, assinatura atual e eventos de supressão permanecem. Preview/apply por pedido sob lock do contato, relatório agregado e rollback verificados em [cinco grupos PostgreSQL sintéticos](../artifacts/privacy-retention/d102-results.json). Sem migration; flag diária continua falsa. Retenção ampla, identidade externa e manifesto de restore seguem em P07.

## D103 — Paginação do expurgo — 25/10/2026

A retenção não confirmada usa cursor por ID e continua depois de uma página sem exclusões quando há casos retidos. Cutoff e locks preservados; outbox lido sem truncamento por página. [18 verificações PostgreSQL sintéticas](../artifacts/privacy-retention/d103-results.json) passaram, incluindo backlog com 102 candidatos, preservação dos 101 casos em voo e reexecução segura. A lacuna identificada em D102 está corrigida localmente. P07 continua aberta para retenção ampla, coordenação externa e restore.

## D104 — Manifesto privado e replay isolado — 25/10/2026

Implementados export/preview/apply de decisões concluídas e tombstones ativos, com HMAC, prazos originais, owner, flags falsas, limites e conferência da janela do snapshot. Exclusão/correção reaplicada remove cópia local elegível ou mantém quarentena; retirada de marketing preserva amostra e bounce/complaint preserva restrição. Marcadores voltam mesmo sem contato; arquivo/relatório não contêm email/IDs. [Seis grupos PostgreSQL sintéticos e CLI](../artifacts/privacy-recovery/d104-results.json), mais seis unitários e regressão de exclusão passaram. Sem migration, rede ou produção. Guarda externa do manifesto atualizado, pedidos pendentes, conciliação e restore físico da imagem atual continuam P07/H04/H06.

## D105 — Preservação de pedidos pendentes — 25/10/2026

Manifesto v2 inclui pending sem expiração automática; auditoria não é expurgada até resolução. Captura/confirmação e novos envios/promoções/cadastros consultam o bloqueio. Restore preserva pending mesmo se a cópia local parecer removível, mantendo identidade e quarentena; ausência de contato não remove a pendência. V1 é compatível apenas para completed e o relatório informa a cobertura. [Sete grupos sintéticos](../artifacts/privacy-recovery/d105-results.json) e regressões locais passaram. Sem migration/rede/produção; retenção ampla, conciliação externa, guarda atualizada e ensaio físico seguem abertos.

## D106 — Restore físico local e privacidade — 26/10/2026

D106 validou backup criptografado e restore físico local das 32 migrations, com mídia íntegra e replay do manifesto v2 separado do snapshot; completed é reaplicado e pending permanece pendente. A telemetria automática do Payload foi desativada após a barreira de rede detectar sua tentativa. Imagem atual, guarda externa do manifesto/backup, RPO/RTO reais e release continuam pendentes. [Evidência D106](../artifacts/recovery/d106-results.json) Fonte, dump e destino usam somente fixtures sintéticas. Preview não escreve; repetição mantém prazos; amostra independente é preservada, bounce cancela pendência e identidade sem decisão não é alterada. Flags seguem falsas; sem conta real, VPS ou deploy.

## D107 — Imagem atual e upgrade local — 26/10/2026

D107 construiu a imagem local atual e verificou 32 migrations em banco vazio e upgrade real de 6 para 32, preservando contato e owner sintéticos. Saúde, HTTP interno, ACL, runtime sem root/read-only/DDL, CLIs de privacidade e worker de retenção passaram em rede Docker internal, sem saída para provedores. Corrigidos o encerramento das CLIs de inventário/retenção após a limpeza do Payload e a renovação do heartbeat no ciclo ocioso do worker de retenção. A imagem não foi publicada. Bateria funcional integral do release, restore físico nesta imagem, destino externo/RPO/RTO, contas e VPS continuam pendentes. [Evidência D107](../artifacts/container/d107-results.json). As sondagens HTTP rodam no loopback do container; não homologam proxy, TLS ou acesso da VPS. Replay v2 na imagem usa manifesto vazio; decisões reais de fixtures pós-snapshot ainda exigem o ensaio físico nessa imagem.

## D108 — Restore físico com a imagem atual — 26/10/2026

D108 aprovou restore físico com a imagem D107: 32 migrations, mídia íntegra, seis decisões de privacidade posteriores ao snapshot e replay v2 dentro da imagem. Preview, exclusão/correção, pending, supressão/bounce e repetição sem renovar prazos foram verificados. A aplicação só iniciou depois do replay, com credencial de banco separada e limitada: saúde/catálogo/capa responderam 200, contatos privados 403 e amostra privada na rota pública 404. Rede interna sem portas publicadas; transportes e worker desligados. Destino externo, guarda atual do manifesto, RPO/RTO reais, bateria integral e homologações continuam pendentes. [Evidência D108](../artifacts/recovery/d108-results.json). Não houve nova migration, rebuild, dado real, conta externa, VPS ou deploy; identidade sem decisão e entregas incertas foram preservadas.

## D109 — Retenção de estado promocional — 26/10/2026

D109 implementa retenção local de estado promocional para contatos globalmente descadastrados há pelo menos 30 dias: remove assinaturas encerradas e calendários cancelados com etapas antigas, sem lote. Preserva identidade, amostras/outbox, consentimento, auditoria e supressão com o prazo original. Não executa exclusão de identidade nem forja pedido owner. Impedimentos de privacidade, provedor, envio incerto, vínculo cruzado e manifestos compartilhados/JSON preservam os registros. Preview é padrão; apply revalida sob locks e é atômico por contato. P07 continua parcial para identidade, demais finalidades e dados compartilhados. A imagem/restore D107–D108 são evidências da revisão anterior, não incluem esta rotina. [Oito grupos PostgreSQL sintéticos](../artifacts/privacy-retention/d109-results.json). Sem migration, chamada externa, dado real, nova imagem, VPS ou deploy.

## D110 — Retenção de identidade e recuperação — 26/10/2026

Estado vigente: 33 migrations, retenção automática de identidades sem finalidade/provas antigas e replay v3 implementados/testados localmente. [12 grupos](../artifacts/privacy-retention/d110-results.json); [restore físico host](../artifacts/recovery/d110-results.json) com mídia íntegra e oito entradas, incluindo expurgo automático, sem fake pedido humano. Guardas cobrem novos propósitos, callbacks órfãos, HMAC e falha de chaves; nenhuma supressão é renovada. A imagem D107/restore D108 não incluem este schema/rotina. P07 e gates de produção permanecem abertos conforme pendencias.md; próximo: finalidades remanescentes e revalidação do release final.

## D111 — Operações em lote e diagnóstico PostgreSQL — 26/10/2026

H06 avançou localmente: concorrência update/delete do Payload em transação compartilhada foi reproduzida e corrigida via patch versionado; novo teste PostgreSQL cobre rollback e ausência do aviso no caminho exercitado. As 33 migrations e versões permanecem. Retenção P07 e gates finais continuam abertos; nenhuma conta, imagem nova, VPS ou deploy.

## D112 — Descadastro e retenção por assunto — 26/10/2026

D112 implementa retenção temática com fato HMAC por 24 meses, sem FK/email, e protege confirmação antiga após expurgo da assinatura. Manifesto v4/replay por assunto preservam outros temas/amostras e consentimento posterior; dependências externas ficam pendentes. Schema tem 34 migrations locais. [Oito grupos](../artifacts/privacy-retention/d112-results.json), [restore físico](../artifacts/recovery/d112-results.json) e [checks](../artifacts/privacy-retention/d112-checks.json). P07 permanece parcial; próximos são legado verificável, demais finalidades e gates do release.

## D113 — Margem e acompanhamento do prazo — 26/10/2026

D113 implementa margem de 28 dias para estado promocional/temático, marketingDeadline e saúde do worker que verifica sucesso recente/assinaturas para revisão, mantendo identidade/provas com seus prazos. [Quatro grupos](../artifacts/privacy-retention/d113-results.json) e [oito cenários CLI](../artifacts/worker-health/d113-results.json). Schema: 34 migrations; flags falsas. Prazo real requer continuidade/duração/alertas homologados. P07 segue aberto para demais finalidades e legado, sem declarar todas as retenções concluídas.

## D114 — Legado temático verificável — 26/10/2026

D114 cobre legado temático verificável e impede omissão silenciosa na exportação, preservando finalidade posterior a expurgo. [Oito grupos](../artifacts/privacy-retention/d114-results.json), [restore físico host](../artifacts/recovery/d114-results.json) e [checks](../artifacts/privacy-retention/d114-checks.json). Fatos recebem data/vencimento originais; prova vencida não renova supressão. Schema: 34 migrations, flags falsas. P07 permanece parcial para casos sem prova, contatos ativos, demais finalidades/compartilhamentos/provedor/ledger, exceções e guarda externa; H03–H06 finais abertos.

## D122 — Evidência atual de navegador — 27/10/2026

[Nove suítes/496 capturas](../artifacts/qa-release-layout/d122-results.json) passaram: público/catálogo/aparência, editorial/login, amostras/preferências/sequências e jornada comercial integrada. Bancos descartáveis removidos; hashes dos artefatos conferidos. Sete suítes finais com mídia temporária e bloqueio de HTTP externo, sem tentativa registrada. [Inspeção representativa](../artifacts/qa-release-layout/d122/visual-review.json), sem afirmar leitura manual de todas as capturas. `npm run check` passou com 298 unitários/36 arquivos, 62 operacionais, tipos/lint e documentação. Sem migration ou alteração funcional do produto; H05 ainda parcial conforme a [matriz](design/07-qualidade.md). Sem conta externa, mensagem real, GitHub ou VPS.

D122 — imagem atual aprovada em banco vazio e upgrade 32→35, incluindo mídia/ACL/CLIs/worker em rede Docker interna. [Evidência da imagem](../artifacts/container/d122-results.json). [16 suítes HTTP](../artifacts/container/h03-http-d122-results.json) passaram no standalone QA atual com banco descartável removido; não foram executadas integralmente dentro do container. [Checks e limites](../artifacts/qa-release-layout/d122-checks.json). Sem publicação, conta externa, GitHub ou VPS. H05/P07 e gates externos continuam conforme pendências. Restore desta imagem/guarda externa só são exigidos se a capacidade opcional de recuperação for adotada; `--sem-backup` segue disponível.

## D123 — Foco e estados ativos dos formulários — 27/10/2026

Corrigida perda de foco após resposta de amostra/confirmação/preferências/cancelamento, com recuperação somente quando caiu no corpo da página. [250 verificações/284 capturas](../artifacts/qa-release-layout/d123-results.json), incluindo seis larguras/dois temas, zoom nativo 400% ativo e loading/erro/retentativa. 238 axe sem violações; 12 fallbacks sem JS têm validação própria de aviso/HTML/overflow/ausência de POST. [Crítica visual amostral](../artifacts/qa-release-layout/d123-visual-review.json). Reuso dos 204 estados regulares auditado; relatório original failed preservado após falha numérica do protocolo de zoom, sem esconder a falha inicial de foco corrigida.

Build QA e `npm run check` passaram (298 unitários, 62 operacionais, tipos/lint). Banco/mídia temporários removidos; transporte em memória, sem conta externa. Sem migration. H05 parcial para demais estados/componentes e carga comercial; P07 e homologações ainda abertos. Imagem D122 antecede a correção e precisa ser renovada no fechamento. Backup opcional; produção inalterada.

## D124 — Resultado de carga comercial — 27/10/2026

[Ensaio local](../artifacts/qa-release-layout/d124-results.json) com 30 livros/três temas/30 artigos e mil transações aprovadas sintéticas: cinco/dez clientes HTTP da mesma sessão owner, 45 jornadas/180 requests sem erro. Catálogo, relatório financeiro, inbox com todos os estados e replay de callback tiveram latências registradas; totais e null de recebimento preservados, replay/processamento repetido sem duplicação. p95 relatório/inbox com dez clientes: 2.852ms/3.090ms. Banco e mídia temporários removidos; banco configurado preservado, sem conta externa ou mensagem real.

Medição finita em servidor local aquecido, sem SLA novo, Web Vitals de campo ou capacidade da VPS. H05 permanece parcial para conteúdo adverso/componentes/views, conforme [matriz](design/07-qualidade.md). Produto e schema não mudaram nesta rodada; a imagem de fechamento ainda deve incorporar a correção de foco D123 depois de consolidar o código. Backup opcional, produção inalterada.

## D125 — Recuperação e adversidades públicas — 28/10/2026

[208 verificações/208 capturas/208 análises axe](../artifacts/qa-release-layout/d125-results.json) passaram sem overflow, violações detectadas ou requisições externas. Dois temas e seis larguras (360/390/768/1024/1440/1920px): 12 erros reais de consulta no banco descartável e 12 recuperações por teclado, 120 estados de conteúdo extenso/capa indisponível e 36 LPs com oferta inativa. Mais 28 estados em 390/1440px: disclosure hover/focus/active/expandido, fonte bloqueada, JavaScript atrasado e retomado com movimento padrão.

O botão “Tentar novamente” usava `reset` e não recuperava a consulta do servidor após restabelecer o catálogo. Agora usa `retry`, disponível no Next instalado. A falha foi provocada somente em banco exclusivo e a tabela foi restaurada. O caso de capa indisponível usa mídia privada; a obrigatoriedade de capa no livro publicado foi preservada. Ofertas inativas não exibem compra; LPs sem amostra não exibem esse convite.

Foram preservadas 180 verificações da execução integral aprovada e recapturados 28 estados após limpar seleção de texto causada pelo gesto do teste. Identidade do build, dependências/estilos e hashes das 208 imagens conferidos; protocolos e relatórios anteriores preservados. [Inspeção amostral](../artifacts/qa-release-layout/d125-visual-review.json). As tentativas anteriores identificaram a recuperação defeituosa, uma fixture inválida e uma leitura prematura do título durante a navegação; não foram registradas como aprovação. Bancos/mídias temporários removidos, banco de desenvolvimento preservado.

Build QA e `npm run check` passaram (298 unitários, 62 operacionais, tipos, lint e documentação); o ajuste posterior do protocolo recebe conferência própria de tipos/lint. Sem migration ou dependência nova. A imagem D122 antecede as correções D123/D125 e será renovada no fechamento. H05 permanece parcial para consolidar a operação administrativa de fase 2. P07 ainda depende do prazo/marco de guarda financeira e da conciliação externa aplicável; nenhuma conta, CI remoto, VPS ou produção foi homologada. Backup continua opcional com `--sem-backup`.

## D126 — Fechamento do QA local administrativo — 28/10/2026

[Dez suítes/354 capturas](../artifacts/qa-release-layout/d126-results.json), 346 análises axe sem violações e oito capturas sem JavaScript passaram. Cobertura: consentimento/medição, supressões, lista/detalhe de contatos e consulta da integração, inbox/retry, prévia e registros financeiros, importações, identidades, decisões, cobertura e detalhamentos. Dois temas/seis larguras e recortes 320px/teclado/texto ampliado conforme os protocolos. Sem overflow da página, erros de runtime registrados ou chamadas externas; os 18 ensaios (dez aprovações e oito tentativas anteriores) removeram seus bancos/mídias exclusivos.

Duas falhas de aplicação corrigidas: feedback de supressão agora recupera foco perdido após envio e preserva foco escolhido durante a espera; setas de paginação nativa receberam nomes acessíveis em módulo e bundle do patch Payload. A repetição de supressões passou em 78 capturas, incluindo loading em 390/1440px, erro/sucesso por teclado e página 2 da lista. Seletores antigos de valores repetidos e colunas de atribuição foram corrigidos nos testes, sem alterar cálculos. Manifestos das tentativas malsucedidas foram preservados; não contam como aceite.

Build QA e `npm run check` passaram: 298 unitários, 62 operacionais, tipos, lint e documentação. Não houve migration ou atualização de versões. Lockfile mudou somente no hash do patch; retirar a adição da paginação reconstrói exatamente os 14 hunks anteriores. Oito suítes do build anterior permanecem válidas por escopo; supressões e prévia financeira foram renovadas no build corrigido. [Inspeção amostral](../artifacts/qa-release-layout/d126-visual-review.json).

[Auditoria combinada D121–D126](../artifacts/qa-release-layout/d126-h05-acceptance.json): H05/B19/B20 com aceite **local de lançamento**. Não é certificação WCAG, inspeção manual de cada PNG, métrica de campo, capacidade da VPS ou homologação externa. Próxima ação: concluir P07 após definir prazo/marco de guarda financeira e conciliar cópias externas aplicáveis; então renovar imagem/validação final e preparar contas/host/CI do proprietário. A imagem D122 antecede D123/D125/D126. Backup permanece opcional, inclusive com `--sem-backup`; melhorias evolutivas ficam para atualizações.

## D127 — Imagem atual e mitigação de dependência — 28/10/2026

A [imagem local](../artifacts/container/d127-results.json) passou em banco vazio e upgrade real 32→35, com contato/owner preservados, migrations idempotentes, DDL negado ao runtime, permissões privadas, mídia WebP/substituição inválida/persistência após restart, CLIs e worker saudável inclusive ocioso. Rede interna, transportes desligados e zero envios; projetos/volumes descartáveis removidos. Sem restore físico, registry, conta real ou VPS.

A nova auditoria identificou GHSA-gcqx-w48m-w2h4 em deepmerge 4.3.1, low, sem versão corrigida publicada. A reprodução confirmou protótipo controlado no objeto retornado; não demonstra exploração de endpoint do produto. Patch local bloqueia chaves reservadas na cópia de alvo/origem e grava propriedades próprias nos três entrypoints. [Auditoria bruta e mitigação](../artifacts/security/d127-deepmerge-mitigation.json): aviso mantido, 16 regressões CJS/UMD e oito casos dentro da imagem. O npm audit por versão não reconhece o patch; não declarar zero advisories. Reavaliar quando houver correção upstream.

Build QA e Docker com lockfile fixado passaram; `npm run check`: 314 unitários/37 arquivos e 62 operacionais, tipos/lint/documentação. [16 suítes HTTP](../artifacts/container/h03-http-d127-results.json) repetidas após o patch passaram e o banco exclusivo foi removido. A primeira bateria HTTP anterior à mitigação foi preservada separadamente, sem usá-la como prova do patch. [Fingerprint de fonte](../artifacts/container/d127-source-snapshot.json) conferido ao fim. H05 continua aceito localmente pela matriz D121–D126; nenhuma mudança de UI/estilo nesta etapa.

H03 tem evidência da revisão atual; o encerramento integral segue condicionado a P07 e aos gates externos. Próxima ação: definir prazo/marco de guarda financeira, concluir tratamento das finalidades/cópias externas aplicáveis e renovar somente verificações afetadas por código posterior. Contas, contato/material reais, CI, proteção administrativa, alertas e VPS continuam com proprietário/operador. Backup/restore continuam opcionais com `--sem-backup`.

## D128 — Lacunas concretas de P07 — 28/10/2026

A [auditoria de fonte](../artifacts/documentation/p07-closure-audit-d128.json) confere 43 coleções no inventário operacional: 23 de relacionamento, seis de analytics e 14 comerciais. Inventariar não executa retenção. No comércio, a rotina atual limpa parcialmente envelopes elegíveis da inbox e auditorias resolvidas; outras 12 coleções não têm retenção geral implementada. Não basta definir um número e considerar P07 concluído.

A exportação por e-mail cobre dados de relacionamento e registros correlatos explicitamente selecionados; não seleciona ledger/evidências comerciais. As coleções financeiras não fornecem nesse fluxo uma relação de titular por e-mail. Não criar associação por UTM, coincidência temporal ou aproximação. Revisar a identificação e o conjunto efetivamente sujeito ao pedido antes de ampliar exportação/correção/exclusão; não inventar campos pessoais ou remover fatos financeiros como efeito colateral de excluir um contato.

Ordem de fechamento: **P07-A**, política de guarda financeira (duração, marco e exceções); **P07-B**, retenção/minimização comercial e regressões; **P07-C**, revisão das finalidades de relacionamento/campanhas e cobertura dos pedidos; **P07-D**, conciliação comprovada de cópias externas/pending; **P07-E**, continuidade/saúde/alertas reais. Critérios detalhados no [plano de fechamento](25-fechamento-producao.md). A pergunta de prazo/marco continua pendente; tempo decorrido não autoriza expurgo presumido. Backup, guarda externa de recuperação e restore continuam opcionais para o deploy.

Esta rodada alterou somente documentação/evidência. Os 331 arquivos do fingerprint D127 continuam idênticos; imagem, 314 unitários, 62 operacionais, 16 HTTP e aceite H05 preservam suas evidências anteriores, sem alegar repetição. Nenhum dado ou serviço externo foi acessado, nenhum expurgo foi executado e produção permanece inalterada.

## D129 — Conferência geral da documentação — 28/10/2026

Revisados os resumos e guias contra a evidência local D127 e a auditoria de P07 D128. Corrigidas contagens/lista de migrations, referências de imagem/QA, status de integração/atribuição/financeiro e a distinção entre backup opcional e controles obrigatórios de privacidade. Inventário ativo passa a listar as 35 migrations do código; evidências antigas não substituem os relatórios consolidados atuais. Requisitos e contratos de produto foram preservados; B17 recebe o aceite local de fundação/tema já coberto pela matriz D126.

P07-A–E e homologações/configurações reais continuam pendentes; o desenvolvimento de retenção aguarda política financeira e revisão por finalidade. O código/imagem permanecem D127, sem build, expurgo, envio ou deploy nesta revisão. Históricos Dxx, modelos ainda não preenchidos e datas de consulta externa continuam identificados como tais; fontes históricas preservadas. [Relatório documental](../artifacts/documentation/documentation-review-d129.json).

## Ajuste do mínimo de senha administrativa — 28/10/2026

Por solicitação do proprietário, criação, recuperação e alteração de senha passam a exigir pelo menos cinco caracteres. Sem alteração de schema. Mudança local; a imagem em execução na VPS ainda exige rebuild e atualização antes de aceitar a nova regra. Verificações desta alteração são registradas na entrega; não representam homologação da VPS. Próxima ação: publicar a alteração pelo proprietário e atualizar com `./atualizar.sh --sem-backup`.


## Redesign público editorial — 28/10/2026

A interface pública recebe uma evolução editorial local sobre o runtime existente: home assimétrica, botão de aparência com grupo de rádios, navegação e estilos compartilhados refinados. Aceite local do recorte público B17/B20: 342 capturas no mesmo build e checks registrados no relatório. Sem schema, API ou integração novos. A imagem D127 e os aceites D126 são históricos e não representam este novo frontend.

Evidências e limites: [redesign público](../artifacts/qa-public-redesign/README.md).

Conferência final da ponte editorial em 29/10/2026: 11 grupos sintéticos aprovados, incluindo cliente HTTP/PTY, senha oculta, preservação de tema/capa do painel e recuperação de recibo. [Evidências e limites](../artifacts/editorial/README.md). Primeiro pacote mantém três pendências; implantação/primeiro uso remoto continuam com o proprietário.
