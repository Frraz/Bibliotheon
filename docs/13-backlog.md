# 13 — Backlog de implementação

[Índice](../README.md) · [Progresso](14-progresso.md) · [Testes](15-qualidade.md)

**Revisão documental D129 (28/10/2026):** código e imagem permanecem na revisão D127: 35 migrations, 314 unitários, 62 operacionais e 16 suítes HTTP aprovados localmente. H05/B19/B20 aceitos localmente em D126. P07 continua aberto: [auditoria D128](../artifacts/documentation/p07-closure-audit-d128.json) identificou 12 coleções comerciais sem retenção geral e limites na exportação financeira. Desenvolvimento de retenção aguarda política de guarda e revisão por finalidade; contas, CI e segurança/VPS reais continuam pendentes. Backup opcional; nenhuma publicação ou alteração de produção. [Imagem D127](../artifacts/container/d127-results.json) e [mitigação de deepmerge](../artifacts/security/d127-deepmerge-mitigation.json) preservadas; esta revisão não reexecutou testes da aplicação.

Prioridade P0 = base do lançamento; P1 = operação/campanha inicial; P2 = expansão condicionada. B01/B02 têm implementação/testes locais; B03/B04/B18 têm implementação inicial e refinamentos; B19/B20 têm aceite local D126; B17 também tem aceite local pelos critérios de fundação/tema registrados na matriz D126. D86 aceitou localmente P01–P05. D87–D88 implementaram/validaram atribuição consentida local, ainda sem confirmação por conta. D89–D119 avançam P07 com retenção analítica, exportação privada, auditoria, limpeza seletiva, exclusão/correção owner, inventário agregado e revisão de opt-in vencido que retém promoções. Estados incertos e identidades/manifestos externos bloqueiam alterações sem conciliação; nenhum fluxo remove cópia externa. Retenção abrangente de relacionamento/comércio continua parcial; D108 validou replay em restore físico na imagem D107 e D114 restaurou host local; guarda externa e recuperação de produção não foram homologadas. H04/backup pode ser dispensado no deploy pelo proprietário via `--sem-backup`. Homologações/release e B12–B16 seguem pendentes. O [plano para produção](../pendencias.md) separa desenvolvimento, homologação e ações do proprietário. Estado e limites em [desenvolvimento](19-desenvolvimento.md).

## Fase 0 — Preparar

Documentação e aplicação local presentes. Título, domínio e responsável já informados em [lançamento](22-lancamento.md); arquivos/público/preço/contas/elegibilidade ainda precisam de conferência. Preencher [briefing](templates/01-briefing-livro.md) antes da campanha. Estado por requisito, evidências e riscos no [mapa atual](23-estado-atual.md); retomar pela próxima ação, sem reiniciar B01.

## Fase 1 — Publicar

| ID | Prioridade / entrega | Dependências | Aceite / requisitos | Estado atual (28/10/2026) |
|---|---|---|---|---|
| B01 | P0: bootstrap Next/Payload/Postgres; versões fixadas, CI, auth e permissões | Documentação | Build local, migrations e bloqueio de anônimo; R01 | Base/testes locais; CI reorganizado D69 com runners sequenciais e checks sem banco, não executado no GitHub |
| B02 | P0: coleções editoriais, ofertas e uploads | B01, B17 | Validação/drafts das três plataformas; R02, R05, R22 | Implementado/testado localmente; mídia, ACL e restart confirmados na imagem D127. Conteúdo/ofertas e ambiente reais permanecem com proprietário |
| B03 | P0: site, LP, catálogo e preview | B02, B17, B18 | Rotas, busca, estados vazios, teclado/mobile e orçamento; R03, R04, R20, R21 | Aceite local: QA D121–D126, laboratório público D121 e carga comercial D124; oferta/material reais e desempenho de campo ainda não homologados |
| B04 | P0: artigos, SEO, redirecionamento e campanha afiliada | B03 | URLs seguras, parâmetros preservados, cache invalidado, sitemap; R06, R07 | Local: SEO, slugs e afiliado testados com fixtures |
| B05 | P0: imagem, Compose, inventário e proxy; recuperação opcional | B01; VPS/domínio; destino de backup somente se adotado | Isolamento e baseline preservado; R23, R24 conforme opção de recuperação | Imagem D127 aprovada localmente em vazio/upgrade 32→35. Restore D114 histórico de 34 migrations; VPS/proxy/segurança reais pendentes. Backup/restore/RPO/RTO externos somente se recuperação for adotada |

Saída: vitrine e painel homologados, incluindo a rodada de fase 1 de B20; produto real só publicado quando pronto e oferta conferida. Não declarar medição completa.

## Fase 2 — Captar e medir

| ID | Prioridade / entrega | Dependências | Aceite / requisitos | Estado atual (28/10/2026) |
|---|---|---|---|---|
| B06 | P0: amostra, consentimento, Brevo e supressão | B02, conta/remetente para homologar | Confirmação, entrega independente de marketing, fila e quota; R08, R09, R10 | Parcial: amostras/calendário/quota, lotes/claim, bloqueios outbound e preflight/cadastro consentido/listas exclusivas e cancelamento por assunto, links individuais e rascunhos e transporte locais; worker opcional com flag false; observação GET local (D57), worker com flag independente false; callback autenticado/resultados individuais locais (D58); homologação externa e P07 pendentes; recuperação somente se adotada |
| B07 | P0: eventos, campanhas, atribuição e inbox comum | B04 | Privacidade, eventos duráveis, dashboard operacional, replay; R11, R25 | Parcial: base local D59–D62; D87 usa UUID de `checkout-clicks` em `sck` com consentimento e só atribui após retorno/contexto conferidos. Fluxo HTTP sintético integrado D88 validado nos três provedores; retorno real Kiwify/Cakto e homologação por conta ainda pendentes; sem correlação por UTM livre, pessoa ou tempo |
| B08 | P0: adaptador Hotmart | B07; contrato e conta | Autenticação e fixtures, replay/reversão, homologação individual; R12 | Parcial: adaptador/endpoint Hotmart v2 locais D63, inbox e HTTP testados; desligado por padrão, conta/atribuição/conciliação/homologação pendentes |
| B09 | P0: adaptador Kiwify | B07; descoberta de autenticação atual e conta | Contrato verificado antes de ativar; bateria completa; R13 | Parcial: adaptador/endpoint local D64, HMAC-SHA1/corpo bruto e centavos confirmados em fontes oficiais; conta, conciliação temporal, atribuição e homologação pendentes |
| B10 | P0: adaptador Cakto | B07; autenticação técnica e conta | Semântica verificada, replay manual e financeiro; R14 | Parcial: adaptador/endpoint Cakto V1/V2 locais D65, assinatura/janela e lote atômico testados; conta, MED/tempos especiais, atribuição, conciliação e homologação pendentes |
| B11 | P0: CSV e dashboard financeiro | B08, B09, B10 | Preview/commit auditado, conflitos, desconhecidos e coortes; R15, R16 | Parcial: snapshot/inbox D66–D67, associação D72, decisão D74, evidências D75–D77, ledger D78, painel financeiro D79, importação D80 e registro/correção de liquidações/custos D81 e resolução de identidades D82 e resolução financeira D83 e cobertura/coortes D84 e detalhamentos/processamento D85 locais; P01–P05 aceitos localmente D86; atribuição HTTP sintética D88 validada; retorno real por conta e homologação pendentes |
| B12 | P0: retenção, pedidos de dados e homologação integral | B05, B06, B11, B20 | Privacidade e falhas completas; R26; recuperação se adotada | Parcial conforme auditoria D128: políticas P07-A, retenção/minimização comercial P07-B, finalidades/pedidos P07-C, cópias externas/pending P07-D e rotina real P07-E. Imagem/API D127 aceitas localmente; backup/manifesto externo/restore são opcionais para deploy |

B08/B09/B10 já possuem adaptadores e endpoints nativos locais, com fixtures próprias D63–D65. Homologar cada conta separadamente e concluir B11; não reiniciar os adaptadores como se estivessem ausentes. A falta de conta pode impedir homologação externa, mas não elimina o provedor do backlog. Conciliação manual informa limites enquanto o conector estiver pendente. A fase só está completa quando os três forem homologados.

### D87 — atribuição por referência consentida (parcial)

O redirecionador gera o registro de saída antes de incluir `sck`; usa a UUID daquele registro apenas com consentimento válido, campanha ativa e sem substituir parâmetro existente. Hotmart usa `purchase.origin.sck`; Kiwify e Cakto têm fontes públicas para parâmetro no checkout, mas callback precisa ser confirmado na conta. Adaptadores aceitam somente UUID e o relatório verifica clique, permissão, conta, provedor, oferta/livro e janela inclusiva de 30 dias. Cobertura ausente continua desconhecida. D87 confirmou junção PostgreSQL sintética. D88 acrescenta saída HTTP, callback e relatório sintéticos para cada provedor; P06 segue parcial até homologação por conta. P07 ainda não foi implementada.

Evidências D88: [`analytics-http`](../artifacts/attribution/analytics-http-d88.json), [Hotmart](../artifacts/attribution/hotmart-http-d88.json), [Kiwify](../artifacts/attribution/kiwify-http-d88.json), [Cakto](../artifacts/attribution/cakto-http-d88.json) e [auditoria P06](../artifacts/attribution/p06-audit-d88.json). Campos Kiwify/Cakto foram exercitados em fixtures sintéticas, sem provar que uma conta real entrega esses campos. Próximo desenvolvimento: P07; a homologação H01 permanece por conta.

## Fase 3 — Campanha inicial

| ID | Prioridade / entrega | Dependências | Aceite / requisitos | Estado atual (28/10/2026) |
|---|---|---|---|---|
| B13 | P1: tarefas e kit por campanha | B04, B11 | Conteúdo autorizado, hipótese e prazo registráveis; R17 | Pendente; campanha cadastrável, tarefas/kit inexistentes |
| B14 | P1: ativação da primeira campanha | B06, B12, B13; livro pronto | LP, amostra, três conteúdos, um canal e registro de distribuição; R18 | Pendente; título escolhido, sem lançamento real |

## Fase 4 — Otimizar

| ID | Prioridade / entrega | Dependências | Aceite / requisitos | Estado atual (28/10/2026) |
|---|---|---|---|---|
| B15 | P1: revisão semanal e melhoria | B14 | Relatório conciliado, custos, hipótese e próxima ação; R19 | Pendente; sem revisão operacional conciliada |
| B16 | P2: expansão por resultado | B15 e justificativa | Novo livro/canal ou ferramenta com problema definido, orçamento e métrica; sem requisito MVP adicional | Condicionado a resultado futuro |

## Como executar um item

Registrar objetivo, requisitos, arquivos afetados e critérios antes de editar. Implementar domínio e permissões antes da apresentação; testes de invariantes e smoke. Atualizar progresso com commit/artefato quando existir. Não executar deploy, enviar campanhas ou gastar orçamento apenas porque um item documental menciona a ação; respeitar autorização da tarefa futura.

Não há prazo garantido de oito semanas. A ordem é compromisso técnico; duração depende de disponibilidade e dependências externas. Desenvolvimento e divulgação competem pelo mesmo tempo e precisam de capacidade reservada.

## Fundação visual e integração nas fases

IDs B17–B20 preservam B01–B16; ordem numérica não é ordem de execução. Fundação, variantes e matriz visual de lançamento têm aceite local; produto/ambiente real continuam sujeitos aos gates externos e P07. A documentação de design está especificada no [briefing](../DESIGN-BRIEF.md).

| ID | Prioridade / entrega | Dependências | Aceite / requisitos | Estado atual (28/10/2026) |
|---|---|---|---|---|
| B17 | P0, fase 1: tokens/fontes/tema, componentes base e adaptação Payload | B01 | Contrastes, fallback, preferência local sem flash e adapter suportado; R27, R28, R29 | Concluído localmente: fundação/temas/storage/fallback D122 e matriz combinada aceita D126; novas telas/estados exigem reteste do recorte afetado |
| B18 | P0, fase 1: variantes editoriais, acentos e apresentação de mídia | B02 | Enums validados, três narrativas e imagens íntegras; R30 | Local: variantes/acento testados; conteúdo real não publicado |
| B19 | P0, fases 1–2: polimento responsivo, motion e painel | B03 para rodada 1; B06/B11 para rodada 2 | Zoom, seis larguras, reduced-motion e fluxos admin completos; R31, R32, R33 | Concluído localmente D126: matriz combinada D121–D126, correções de foco/paginação e laboratório/carga aprovados; ambiente real separado |
| B20 | P0, fases 1–2: QA visual renderizado e correções | B19 e telas da fase avaliada | Paridade de tema, teclado, screenshots, estados adversos; R34 | Concluído localmente D126: [auditoria por família](../artifacts/qa-release-layout/d126-h05-acceptance.json), capturas e inspeção amostral; não equivale a certificação WCAG, imagem final ou homologação de produção |

Sequência: B01 → B17 → B02 → B18 → B03/B04 → B19/B20 (rodada fase 1). Depois B06–B11 → B19/B20 (rodada fase 2) → B12. B05 mantém sua dependência de infraestrutura e pode ser preparado independentemente. B20 concluído exige as duas rodadas; a primeira recebe evidência parcial, não “concluído”.


Os registros D63–D67 abaixo descrevem a evolução em cada etapa; a próxima ação vigente está em [pendências](../pendencias.md).

D63: B08 possui execução local, sem concluir homologação. Próxima implementação independente é B09, depois B10. B11 deve incluir resolução auditada de divergências e de catálogo com histórico: impedir novas identidades externas duplicadas e permitir correção sem editar fatos/identidades já referenciados. Hoje duplicidade/ambiguidade fica em revisão, e o guard de ofertas com histórico proíbe troca de identidade; não prometer que retry sozinho resolve esses casos. Testar esses fluxos antes do release.

D64: B09 possui execução local de assinatura HMAC, centavos, datas e recepção durável. Continua parcial: sem conta homologada; chargeback/recusa sem instante confirmado e formatos especiais exigem conciliação auditada B11. Próximo adaptador é B10 Cakto, com descoberta oficial independente. B08/B09 não perdem suas pendências externas. Não ativar conectores/processamento real com base em fixtures.

D65: B10 possui adaptador/endpoint Cakto V1/V2 locais, assinatura/janela e lote atômico testados. Não conclui conta/relatório/reenvio/MED. Próxima implementação é B11, com fixtures e esquema explícito de importação, preview/commit auditado, conciliação e financeiro; não adivinhar exportação nativa. Resolver colisões e identidades duplicadas/ambíguas com histórico sem editar fatos. Desenvolvimento local pode prosseguir enquanto proprietário homologa contas, sem tratar homologação pendente como concluída.

D66: B11 possui parser e prévia owner/somente de leitura, com desconhecidos/conflitos explícitos e nenhuma escrita comercial. Continua parcial: lotes/linhas duráveis, fonte/autor/justificativa, confirmação idempotente/auditada, resolução de divergências/catalogação histórica, liquidação/custos/financeiro e UI pendentes. Prévia é provisória, sempre committable=false; confirmar futuramente exige revalidação sob locks, não aceitar hash/decisão do cliente como autorização. [Contrato](24-conciliacao.md).

D67: B11 possui lotes/linhas/auditoria e confirmação idempotente/revalidada para inbox. Não conclui resolução de conflito/catalogação histórica, reversões/recebimento com prova insuficiente, liquidação/custos, relatório ou UI customizada. Um provedor/conta por lote durável; campos da prévia não autorizam escrita. Próximo: decisões auditadas preservando fatos/identidades originais, depois liquidação/custos/financeiro. [Contrato](24-conciliacao.md).


## D70 — Prevenção de novas ambiguidades do catálogo — 24/10/2026

P01/B11 parcial: a API Payload recusa nova identidade externa duplicada em provedor/conta/produto/oferta (null e vazio equivalentes), ou associação do mesmo produto a outro livro. Inclui ofertas inativas; ofertas externas distintas para o mesmo livro continuam permitidas. Locks transacionais existentes serializam criações/alterações; edição de metadados legados permanece possível sem reescrever identidades/fatos. Não existe bypass no contexto da aplicação. As fixtures de ambiguidade histórica usam SQL exclusivamente no banco sintético.

[Evidência local](../artifacts/catalog-identities/local-results.json): quatro grupos com permissão via API local Payload, concorrência de criação/update, rollback, isolamento dos três provedores/contas e legado. Comando: BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:catalog-identities; incluído no runner sequencial/CI preparado. Sem migration nova: continuam 21. Não é proteção contra SQL administrativo direto, teste HTTP/browser ou homologação externa.

Próxima ação: complementar P01 com integridade no banco e fluxo auditado de resolução histórica, preservando referências/fatos originais; depois P02–P04. P01 e produção continuam pendentes.


## D71 — Integridade SQL de identidades do catálogo — 24/10/2026

Migração 22, [offer_identity_guard](../migrations/20261024_231500_offer_identity_guard.ts), aplicada somente no PostgreSQL local. Trigger BEFORE INSERT/UPDATE/DELETE e índice por provedor/conta/produto reforçam o guard da API D70: impedem novas duplicatas (null/vazio equivalentes), associação do produto a outro livro e alteração/exclusão de identidade com transação histórica. Inclui ofertas inativas. Preserva registros legados e seus metadados; não escolhe livro/oferta automaticamente nem altera fatos.

[Evidência SQL local](../artifacts/catalog-identity-db/local-results.json): seis grupos, papel runtime efêmero sem DDL, concorrência observada em pg_locks, API versus SQL, commit/rollback, lote de INSERT revertido, isolamento de contas/provedores, compatibilidade das chaves de lock e upgrade sem alteração de registros legados. Comando: BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:catalog-identity-db; incluído no runner sequencial de CI preparado. Sem novo serviço/flag/coleção ou campos/tipos Payload. Produção e P01 continuam pendentes até a resolução histórica auditada e homologação do release.


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

## D74 — Decisões financeiras e aplicações — 25/10/2026

B11/R15 continuam parciais. P02 ganhou decisão owner imutável, cobertura integral do componente, revisões/pais, fonte/motivo/idempotência e aplicação atômica das projeções, preservando originais e referências efetivas separadas. Worker/CSV/retry verificam vigência; fonte nativa limpa pode continuar a escolha, e conflito/ponte/hold exige revisão. Migração 25 aplicada localmente. [Contrato](24-conciliacao.md); [testes locais](../artifacts/financial-resolutions/local-results.json) e [HTTP](../artifacts/financial-resolutions/http-results.json).

P02 permanece aberta para evidência complementar ausente, junto de P03. Depois: liquidação/custos/relatório P04, UI P05, atribuição P06 e retenção P07, incluindo as novas provas. H03/H04 precisam do release final com 25 migrations; os demais gates permanecem em [pendencias.md](../pendencias.md). Sem nova imagem, restore, QA visual, conta externa ou implantação.

## D75 — Prova complementar e conclusão local P02 — 25/10/2026

P02 implementada/testada localmente: evidência canônica individual imutável, autoria/fonte/linha, substituições explícitas, cobertura do componente e aplicação pela decisão D74. Corrige inclusive ID errado sem apagar fontes; prova incompleta permanece bloqueada. Antes da primeira decisão/projeção, worker/retry/CSV já consultam a prova e lote preparado fica stale. Novo relatório exige nova decisão; relatório não vira fato/recibo nativo. [Auditoria por requisito](../artifacts/report-evidence/p02-audit.json), [seis grupos locais](../artifacts/report-evidence/local-results.json), [três HTTP](../artifacts/report-evidence/http-results.json) e [contrato](24-conciliacao.md).

B11/R15 continuam parciais. Próxima ação é P03: ampliar ingestão/lotes CSV e os casos restantes com prova, sem adivinhar exportações; recebimento exige fonte independente junto de P04. P04/P05/P06/P07 e homologações H01–H06 seguem abertas. Migração 26 aplicada somente no PostgreSQL local; sem imagem atualizada/restore/QA visual/conta externa/VPS.

## D76 — Lote canônico de evidências — 25/10/2026

Implementado endpoint owner `POST /api/v1/admin/report-evidence/batch`: lote JSON canônico de 1–20 registros, limites de corpo/tempo, validação completa, identidade idempotente por registro e persistência/atualização de revisão atômicas. Erro em uma linha reverte todo o lote. Integração local cobriu rollback; HTTP cobriu owner, repetição, conflito e limite. Build e runner HTTP de 14 suítes passaram em `.next-qa`/porta 3001. Não interpreta CSV do provedor; o CSV de treze colunas e sua confirmação continuam sem os casos adicionais de P03. [Contrato](24-conciliacao.md) e [evidência](../artifacts/report-evidence/d76-checks.json); P03 segue aberta.

## D77 — CSV canônico de evidências — 25/10/2026

Preview/stage/commit owner para CSV canônico separado de 18 colunas. Snapshot D66 de 13 colunas permanece compatível; não existe parsing de exportação nativa. Migração 27 aplicada no banco local. Typecheck, 13 testes unitários do parser, 10 grupos de integração da evidência, build `.next-qa` e 14 suítes HTTP (cinco grupos HTTP de evidência) aprovados. P03 continua parcial; P04–P07, gates externos, imagem/restore final e UI ficam abertos. [Contrato](24-conciliacao.md); resultado D77 em [checks](../artifacts/report-evidence/d77-checks.json).

Typecheck, lint, unitários, testes de operação, validador documental, sete grupos de integração, build isolado e 14 suítes HTTP aprovados localmente; dois avisos históricos de lint e aviso pg/Drizzle permanecem. Sem migration, homologação externa, imagem final, restore ou alteração da VPS.


## D78 — Ledger financeiro local — 25/10/2026

P04 avançou parcialmente: migração 28, evidência de crédito/débito por transação aprovada, custos confirmados/estimados com substituição append-only e prévia financeira privada com moedas separadas, coorte de aprovação, períodos independentes e coverage. 225 unitários/30 arquivos, 59 operações, typecheck/lint/documentação, build `.next-qa`, integração de ledger e 15 suítes HTTP locais passaram. P04 ainda precisa de interface operacional/cobertura final; fonte nativa, atribuição de campanha e operação externa não foram homologadas. [Evidências](../artifacts/financial-ledger/d78-checks.json).

## D80 — Importação canônica pelo painel — 25/10/2026

P05 avançou com upload dos dois contratos, prévia, lote persistido, dados de conferência por linha, confirmação explícita, histórico/paginação e mensagens de bloqueio/stale/resultado incerto. [Oito grupos e 24 capturas](../artifacts/qa-commercial-imports/results.json) validam localmente as jornadas; build/typecheck/lint passaram com os avisos históricos registrados. P03/P04/P05 permanecem parciais para cobertura integral, decisão auditada pela UI e registro de liquidação/custos; P06/P07 e H01–H06 continuam abertos. Revisão documental D80 inclui recuperação dos contratos de decisões/conciliação e controle de identidade numérica no validador.

## D81 — Registro/correção de liquidações e custos — 25/10/2026

P05 avançou com `/admin/financial-records`: conferência local antes de registrar, crédito/débito, custos confirmados/estimados, vínculo de campanha, fontes/linhas, correção por substituição e histórico com filtro/paginação. Corrigido mapeamento campaignId → campaign; não há migration, novo endpoint/segredo/flag nem backfill de registros anteriores. [Seis grupos e 40 capturas](../artifacts/qa-financial-records/results.json), [oito capturas adicionais de texto 200%](../artifacts/qa-financial-records/zoom-results.json) e 22 testes novos de valor/data validam o recorte local. A interface de registro está disponível; P03/P04/P05 seguem parciais para cobertura integral e resolução visual auditada. H01–H06 continuam abertos.

## D106 — Restore físico local e privacidade — 26/10/2026

D106 validou backup criptografado e restore físico local das 32 migrations, com mídia íntegra e replay do manifesto v2 separado do snapshot; completed é reaplicado e pending permanece pendente. A telemetria automática do Payload foi desativada após a barreira de rede detectar sua tentativa. Imagem atual, guarda externa do manifesto/backup, RPO/RTO reais e release continuam pendentes. [Evidência D106](../artifacts/recovery/d106-results.json) Fonte, dump e destino usam somente fixtures sintéticas. Preview não escreve; repetição mantém prazos; amostra independente é preservada, bounce cancela pendência e identidade sem decisão não é alterada. Flags seguem falsas; sem conta real, VPS ou deploy.

## D107 — Imagem atual e upgrade local — 26/10/2026

D107 construiu a imagem local atual e verificou 32 migrations em banco vazio e upgrade real de 6 para 32, preservando contato e owner sintéticos. Saúde, HTTP interno, ACL, runtime sem root/read-only/DDL, CLIs de privacidade e worker de retenção passaram em rede Docker internal, sem saída para provedores. Corrigidos o encerramento das CLIs de inventário/retenção após a limpeza do Payload e a renovação do heartbeat no ciclo ocioso do worker de retenção. A imagem não foi publicada. Bateria funcional integral do release, restore físico nesta imagem, destino externo/RPO/RTO, contas e VPS continuam pendentes. [Evidência D107](../artifacts/container/d107-results.json). As sondagens HTTP rodam no loopback do container; não homologam proxy, TLS ou acesso da VPS. Replay v2 na imagem usa manifesto vazio; decisões reais de fixtures pós-snapshot ainda exigem o ensaio físico nessa imagem.

## D108 — Restore físico com a imagem atual — 26/10/2026

D108 aprovou restore físico com a imagem D107: 32 migrations, mídia íntegra, seis decisões de privacidade posteriores ao snapshot e replay v2 dentro da imagem. Preview, exclusão/correção, pending, supressão/bounce e repetição sem renovar prazos foram verificados. A aplicação só iniciou depois do replay, com credencial de banco separada e limitada: saúde/catálogo/capa responderam 200, contatos privados 403 e amostra privada na rota pública 404. Rede interna sem portas publicadas; transportes e worker desligados. Destino externo, guarda atual do manifesto, RPO/RTO reais, bateria integral e homologações continuam pendentes. [Evidência D108](../artifacts/recovery/d108-results.json). Não houve nova migration, rebuild, dado real, conta externa, VPS ou deploy; identidade sem decisão e entregas incertas foram preservadas.

## D109 — Retenção de estado promocional — 26/10/2026

D109 implementa retenção local de estado promocional para contatos globalmente descadastrados há pelo menos 30 dias: remove assinaturas encerradas e calendários cancelados com etapas antigas, sem lote. Preserva identidade, amostras/outbox, consentimento, auditoria e supressão com o prazo original. Não executa exclusão de identidade nem forja pedido owner. Impedimentos de privacidade, provedor, envio incerto, vínculo cruzado e manifestos compartilhados/JSON preservam os registros. Preview é padrão; apply revalida sob locks e é atômico por contato. P07 continua parcial para identidade, demais finalidades e dados compartilhados. A imagem/restore D107–D108 são evidências da revisão anterior, não incluem esta rotina. [Oito grupos PostgreSQL sintéticos](../artifacts/privacy-retention/d109-results.json). Sem migration, chamada externa, dado real, nova imagem, VPS ou deploy.

## D110 — Retenção de identidade e recuperação — 26/10/2026

P07 avançou localmente: provas encerradas/identidades sem finalidade possuem retenção, fato HMAC e replay v3; 33 migrations e 12 grupos dedicados. Ainda parcial para descadastro temático, contatos ativos, compartilhamentos/provedor/ledger e conciliação/guarda externa. Próxima ação: inventariar e implementar os critérios das finalidades remanescentes; depois renovar H03/H04 na imagem final e concluir H05/H06/homologações. Não considerar esse recorte aceite integral de R26/B11.

## D111 — Operações em lote e diagnóstico PostgreSQL — 26/10/2026

H06 parcialmente avançado: origem local do aviso pg/Drizzle reproduzida e corrigida nas operações em lote; dois parâmetros não usados removidos da assinatura de migration, sem alterar SQL. Não encerra H06 nem P07/B05/R24/R26: revalidação de dependências/segurança/CI e revisão final da imagem continuam necessárias. Próximo desenvolvimento: contrato temático de retenção/restauração e demais finalidades P07.

## D112 — Descadastro e retenção por assunto — 26/10/2026

P07 tem recorte temático local D112: retirada durável, retenção de estado encerrado, manifesto v4 e proteção de confirmação antiga/consentimento posterior. Mantém provas, amostras e outros assuntos; vínculos externos/compartilhados e legado sem fato verificável ficam retidos. P07 ainda parcial para contatos ativos, demais finalidades/ledger/provedor, conciliação e guarda externa. Gates de release seguem abertos com 34 migrations.

## D113 — Margem e acompanhamento do prazo — 26/10/2026

P07 avança na meta de prazo: margem de 28 dias para estado promocional/temático e health operacional que não aceita ciclo velho ou assinaturas retidas além do prazo sem revisão. Sem nova migration. P07 continua parcial para legado sem prova, contatos ativos, demais finalidades/compartilhamentos/provedor/ledger, tratamento das exceções e guarda externa. Próximo desenvolvimento: tratar legado verificável e ampliar a cobertura da retenção; H03/H06 deverão validar duração/continuidade/alertas do release final.

## D114 — Legado temático verificável — 26/10/2026

P07 inclui agora reconstrução local do legado verificável, exportação sem escrita e retenção/replay com prazo original. Legado não verificável continua bloqueado e exige conciliação, sem inferir consentimento ou data. Contatos ativos, demais finalidades/compartilhamentos/provedor/ledger, exceções e guarda externa continuam abertos. Próximo: revisar contatos ativos e ampliar retenção restante; depois imagem/restore do release final e homologações H01–H06.

## D127 — Imagem atual e mitigação de dependência — 28/10/2026

A [imagem local](../artifacts/container/d127-results.json) passou em banco vazio e upgrade real 32→35, com contato/owner preservados, migrations idempotentes, DDL negado ao runtime, permissões privadas, mídia WebP/substituição inválida/persistência após restart, CLIs e worker saudável inclusive ocioso. Rede interna, transportes desligados e zero envios; projetos/volumes descartáveis removidos. Sem restore físico, registry, conta real ou VPS.

A nova auditoria identificou GHSA-gcqx-w48m-w2h4 em deepmerge 4.3.1, low, sem versão corrigida publicada. A reprodução confirmou protótipo controlado no objeto retornado; não demonstra exploração de endpoint do produto. Patch local bloqueia chaves reservadas na cópia de alvo/origem e grava propriedades próprias nos três entrypoints. [Auditoria bruta e mitigação](../artifacts/security/d127-deepmerge-mitigation.json): aviso mantido, 16 regressões CJS/UMD e oito casos dentro da imagem. O npm audit por versão não reconhece o patch; não declarar zero advisories. Reavaliar quando houver correção upstream.

Build QA e Docker com lockfile fixado passaram; `npm run check`: 314 unitários/37 arquivos e 62 operacionais, tipos/lint/documentação. [16 suítes HTTP](../artifacts/container/h03-http-d127-results.json) repetidas após o patch passaram e o banco exclusivo foi removido. A primeira bateria HTTP anterior à mitigação foi preservada separadamente, sem usá-la como prova do patch. [Fingerprint de fonte](../artifacts/container/d127-source-snapshot.json) conferido ao fim. H05 continua aceito localmente pela matriz D121–D126; nenhuma mudança de UI/estilo nesta etapa.

H03 tem evidência da revisão atual; o encerramento integral segue condicionado a P07 e aos gates externos. Próxima ação: definir prazo/marco de guarda financeira, concluir tratamento das finalidades/cópias externas aplicáveis e renovar somente verificações afetadas por código posterior. Contas, contato/material reais, CI, proteção administrativa, alertas e VPS continuam com proprietário/operador. Backup/restore continuam opcionais com `--sem-backup`.

## D128 — Dependência de política no fechamento P07

B12/R26 continuam parciais. A [auditoria por fonte](../artifacts/documentation/p07-closure-audit-d128.json) identifica 12 coleções comerciais sem retenção geral e limita a exportação atual ao relacionamento explicitamente selecionado. Encerrar P07-A–E conforme [plano](25-fechamento-producao.md), sem criar vínculo de comprador ou prazo presumido. Aplicação/imagem D127 preservadas; nenhuma funcionalidade, migration ou teste de código novo nesta revisão documental.
