# 20 — Executar o Bibliotheon localmente

[Índice](../README.md) · [Evidências](19-desenvolvimento.md)

Este documento atende ao desenvolvimento/QA local. Para clone na VPS, configuração privada e atualização automática, seguir [deploy.md](../deploy.md); não usar compose.local.yaml em produção. atualizar.sh e seus testes não dependem de Node instalado no host da VPS, mas exigem Python/Docker/Git e configuração inicial conforme o guia.

Estado vigente e ordem de execução em [pendencias.md](../pendencias.md). Seções Dxx abaixo descrevem cada etapa histórica; contagens antigas não substituem as 32 migrations atuais nem comprovam imagem atual homologada.

## Pré-requisitos

Node >=22.23.0 e <23 (host da D67: 22.23.4; imagem/CI: 22.23.3), pnpm 10.34.7 e Docker com Compose. Nenhuma conta externa é necessária para os testes sintéticos. O banco local possui nome/volume exclusivos e escuta apenas em loopback na porta 55432. Não use esse Compose na VPS.

```bash
python3 scripts/setup-local.py
corepack pnpm install --frozen-lockfile
docker compose --env-file .env.local -f compose.local.yaml up -d --wait
node --env-file=.env.local node_modules/payload/bin.js migrate
npm run dev
```

Se Corepack não estiver disponível, `npm exec --yes --package=pnpm@10.34.7 -- pnpm install --frozen-lockfile` instala usando a mesma versão. O setup local preserva um arquivo existente; `.env.local` é privado e ignorado. Não copiar seu conteúdo em issues, screenshots ou commits.

## Start e stop locais

Depois do setup e da instalação, `./start.sh` inicia banco, aplica migrations e aguarda `/health/ready` na porta 3000. `./stop.sh` encerra o grupo gerenciado e para somente o banco local, sem remover volumes; `./stop.sh --keep-db` preserva o banco ativo. Implementação em [scripts/local-dev.py](../scripts/local-dev.py). Requer Linux/Python; não substitui o procedimento de produção.

O controle usa lock compartilhado e `.local-run/dev.json` com PID, início no kernel, sessão e checkout. Não adota nem encerra outro servidor; uma prévia gerenciada na porta 3000 impede o start. Logs privados em `.local-logs/next.log`, sem impressão automática no terminal. Estado inválido ou identidade divergente bloqueia a ação. `next.pid` do controle antigo exige conferência/encerramento da instância antiga e remoção apenas do registro obsoleto; o script não migra um processo ativo silenciosamente. Interrupção/falha na inicialização encerra o processo criado, preservando banco para diagnóstico.

## Verificações reproduzidas pelo CI

`npm run check` roda checks sem banco/Docker/configuração privada: Bash, tipos, lint, unitários, testes de operação e documentação. Pode ser chamado de outro diretório por caminho absoluto de scripts/check-local.sh. O workflow usa [.nvmrc](../.nvmrc), lockfile e dois jobs: checks estáticos, depois PostgreSQL descartável/migrations/gerados/integrações/build/HTTP. Não executa deploy, matriz visual ou homologação de fornecedor.

Os runners [check-integration.sh](../scripts/check-integration.sh) e [check-http.sh](../scripts/check-http.sh) compartilham fixtures por suíte e mantêm execução sequencial. Ambos exigem BIBLIOTHEON_SYNTHETIC_TESTS=true, banco exclusivo de testes e configuração sintética. A confirmação não transforma um banco real em ambiente seguro; nunca apontar para produção. Listar as suítes é uma operação sem banco:

```bash
bash scripts/check-integration.sh --list
bash scripts/check-http.sh --list
```

Após preparar e migrar o banco sintético, com PUBLIC_SITE_URL/segredos/hosts de teste conforme o job de integração:

```bash
BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:integration
npm run build
node scripts/build-runtime.mjs
BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:http
```

O runner HTTP usa porta 3000 por padrão; `CHECK_HTTP_PORT=3001` escolhe outra porta loopback quando há uma prévia em uso. Precisa do build correspondente (ex.: `NEXT_DIST_DIR=.next-qa`). Sobe seu próprio grupo de processos, aguarda saúde com limite explícito, interrompe na primeira falha e encerra o grupo na saída/sinal. Ativa somente recepção sintética/analytics necessários às fixtures; allowlists de checkout usam `pay.example.invalid`; envios e processamento comercial automático ficam desativados. Não inicia worker nem publica log bruto; preserva qualquer servidor já ativo.

## Primeiro administrador

O painel não aceita inscrição pública, inclusive no banco vazio. O comando `npm run admin:create` recebe um único JSON por stdin com `email` e `password` (mínimo 16 caracteres), cria somente o primeiro owner e recusa se já houver administrador. Use entrada privada ou um gerenciador de segredos; não coloque valores reais em argumentos de shell, arquivos versionados ou histórico. Nunca execute com credenciais de produção nos testes.

Sem transporte configurado o envio de e-mail falha de forma explícita, sem imprimir mensagem/token no console. Recuperação por operador já existe e foi testada localmente; recuperação por e-mail permanece indisponível até fluxo/remetente homologados, mesmo que o transporte de amostras venha a ser habilitado.

## Verificações

```bash
bash scripts/check-local.sh
npm run build
npm start
```

Com a aplicação em loopback e banco sem owner: `npm run test:integration`. O teste cria e remove um administrador sintético em `example.invalid`, valida REST/Local API e não imprime sua senha/token. Não executar num banco com dados reais. O teste aborta se já existir owner.

Parar apenas o banco local: `docker compose --env-file .env.local -f compose.local.yaml stop`. Não remover volumes sem avaliar perda de dados locais.

## Estado

Instruções para a aplicação local até D67: B06 possui calendário/quota, listas/campanhas, transporte/observação e callback implementados/testados com fixtures, sem envio externo. Medição, inbox, três conectores nativos e confirmação CSV limitada também existem localmente; financeiro/retenção e homologação externa seguem pendentes. A presença deste procedimento não comprova execução bem-sucedida; resultados e pendências no [estado atual](23-estado-atual.md) e no [histórico](19-desenvolvimento.md).

## Amostras e e-mail em desenvolvimento

`npm run test:marketing` usa banco local operacional vazio, fixtures `example.invalid` e transporte em memória; não depende de conta Brevo. Executar separadamente de qualquer QA que também crie owner. O teste verifica concorrência, confirmação/descadastro, quota e falhas; o relatório não homologa a conta externa.

O setup de um ambiente novo gera `LEAD_TOKEN_SECRET` independente de `PAYLOAD_SECRET`. Para ambiente local já existente, acrescentar uma chave aleatória privada de pelo menos 32 bytes, sem sobrescrever o segredo anterior. Manter `LEADS_ENABLED=false` e `EMAIL_TRANSPORT_ENABLED=false` até revisão dos avisos, conta/remetente e fila. A captura também exige `legalReady`; sem e-mail público, não ativá-la.

`npm run worker` processa jobs de e-mail, concorrência 1, polling de 30 segundos; `-- --once` executa um ciclo. As filas são habilitadas por flags independentes; o modo somente comercial ou de observação pode operar sem SMTP. Cada modo exige sua própria configuração válida; sem modo habilitado o worker recusa ativação. Não rodar com credenciais reais nos ensaios. Envios em estado `uncertain` exigem conciliação com o provedor antes de intervenção; não os recolocar automaticamente na fila.

## Conferir descadastros e bloqueios

No painel, abra “Registrar descadastro ou bloqueio de e-mail”. Informe contato e motivo revisados; use a referência do evento quando existir. O registro impede marketing local; bounce/complaint também cancelam entregas ainda pendentes. Confirme a supressão na conta Brevo separadamente até a sincronização ser homologada. Envios já iniciados exigem conciliação e não podem ser desfeitos pelo formulário.

Alternativa do operador: `npm run suppression:apply < /caminho/privado/conferencia.json`. JSON com email, reason, source e reference conforme [contrato](06-interfaces.md); não guardar esse arquivo no projeto, histórico de comandos ou Git. Mesma referência e conteúdo repetem sem aplicar novamente; conflito é recusado. A CLI mostra somente contagens. A chave LEAD_TOKEN_SECRET precisa permanecer estável durante a operação; uma rotação exige migração planejada das identidades de deduplicação, além da revogação dos links afetados. Essa CLI não contata o provedor.

`TEST_BASE_URL=http://127.0.0.1:3001 node --env-file-if-exists=.env.local --import tsx scripts/qa-suppressions.ts` cria somente contatos sintéticos, verifica a API e renderiza inicial/erro/sucesso. Executar sequencialmente com os demais ensaios. O runtime de QA exige LEAD_TOKEN_SECRET válido; não precisa habilitar transporte nem captura para esse formulário administrativo.

## Recuperação do owner

`npm run admin:recover < /caminho/privado/recuperacao.json` é o fallback do operador, descrito no [runbook](11-operacao.md). Não usar em fixtures de outro ensaio ou em conta real sem intenção de trocar sua senha: encerra sessões anteriores. A recuperação por e-mail está explicitamente indisponível enquanto não houver fluxo homologado.

No banco loopback vazio e runtime isolado, `TEST_BASE_URL=http://127.0.0.1:3001 npm run test:admin-recovery` cria owner sintético e testa CLI, rejeição de entrada/contato desconhecido, respostas públicas, lockout, tokens e senha. Executar sequencialmente. Credenciais aleatórias passam por stdin do filho e não aparecem em argumentos/artefatos. CI está preparado para esse teste após os outros ensaios HTTP; não comprova execução no GitHub.

## Calendário promocional

Cadastre a sequência manual no Payload para a versão exata da amostra. Complete os quatro assuntos/textos e a oferta do mesmo livro antes de ativar; aumente a revisão ao editar o conteúdo. A cópia das inscrições existentes é preservada. Desativar cancela as etapas e reativar não as recria. Arquivo de amostra vinculado é preservado: para substituí-lo, envie nova mídia e altere a versão, sem reutilizar versão já solicitada.

`npm run promotions:prepare` confere até 100 etapas por execução e atualiza apenas elegibilidade local. O worker também executa essa conferência após priorizar os jobs transacionais. Etapas retidas/prontas têm nova conferência em 15 minutos, sem alterar a data original. O comando não cria campanha externa, não usa quota e não envia promoção. O transporte opcional D56 aplica o calendário ao disparo, com flag false por padrão; a observação D57 possui flag independente.

A quota local é compartilhada por destinatário/dia UTC, com teto conservador BREVO_DAILY_QUOTA=250 e reserva BREVO_TRANSACTIONAL_RESERVE=50. Ao reduzir o teto, ajuste a reserva para um inteiro positivo que caiba nele. O transporte promocional D56 respeita total menos reserva; confirmações/amostras podem usar o total. A reserva é gravada na transação do claim, sem estorno automático de tentativas incertas. Configuração inválida interrompe o worker. Essa política não confirma créditos, reset ou outros usos da conta Brevo.

`npm run test:sequences` usa banco operacional vazio/loopback, relógio controlado e confirmação em memória. Executar sequencialmente com os outros testes que criam owner. O aceite fica no relatório de desenvolvimento; a existência do comando não comprova homologação externa.

Geração automática de tipos está desativada para evitar reentrada no hot reload. Após qualquer alteração de schema, executar `npm run generate:types` e revisar o arquivo gerado; usar `npm run generate:importmap` quando mudar componentes registrados. A checagem TypeScript continua obrigatória. Não iniciar várias gerações simultâneas.

## QA de produção com a prévia aberta

Se houver uma prévia de desenvolvimento gerenciada na porta 3000, preserve-a. Use pasta e porta separadas para não misturar os caches do Next:

```bash
NEXT_DIST_DIR=.next-qa NEXT_TELEMETRY_DISABLED=1 npm run build
NEXT_DIST_DIR=.next-qa PORT=3001 PUBLIC_SITE_URL=http://127.0.0.1:3001 \
CHECKOUT_ALLOWED_HOSTS_HOTMART=pay.example.invalid \
CHECKOUT_ALLOWED_HOSTS_KIWIFY=pay.example.invalid \
CHECKOUT_ALLOWED_HOSTS_CAKTO=pay.example.invalid npm start
```

Escolha outra porta livre se 3001 já estiver em uso. Em outro terminal, `TEST_BASE_URL=http://127.0.0.1:3001 npm run test:integration` usa o runtime isolado. Os scripts `qa-*.ts` que acessam HTTP também aceitam `TEST_BASE_URL` e recusam origem fora de loopback. O banco sintético continua compartilhado entre os ensaios locais: executar fixtures e testes com owner **sequencialmente**. A captura de amostra exige as flags e remetente sintético para QA; `qa-relationship` injeta transporte em memória e não executa o worker real.

Para a rodada específica qa-relationship, encerrar somente o runtime de QA e reiniciá-lo com a mesma origem/pasta/hosts, acrescentando as variáveis abaixo ao comando npm start. A chave privada de links continua vindo do .env.local já gerado. O seed fornece avisos/contato exclusivamente sintéticos para esse ensaio.

```bash
NEXT_DIST_DIR=.next-qa PORT=3001 PUBLIC_SITE_URL=http://127.0.0.1:3001 \
CHECKOUT_ALLOWED_HOSTS_HOTMART=pay.example.invalid \
CHECKOUT_ALLOWED_HOSTS_KIWIFY=pay.example.invalid \
CHECKOUT_ALLOWED_HOSTS_CAKTO=pay.example.invalid \
LEADS_ENABLED=true EMAIL_TRANSPORT_ENABLED=true \
BREVO_API_KEY=synthetic-only BREVO_SENDER_EMAIL=no-reply@example.invalid npm start
```

Essas flags servem apenas à elegibilidade da captura no servidor de QA isolado; não persistir no ambiente real nem executar o worker com elas. O script de navegador chama processDelivery com transporte em memória; nenhum envio externo é necessário. Encerrar esse runtime após o ensaio. A configuração padrão permanece desligada.

Não executar `next dev` e `next build` simultaneamente na mesma pasta de saída. Docker/CI continuam usando `.next`, isolados do filesystem da prévia.

## Comandos de QA e manutenção dos artefatos

Executar contra banco sintético vazio e um único ensaio de fixtures por vez. Os scripts que usam HTTP precisam do runtime já iniciado. A existência destes comandos não significa que toda rodada foi executada no build mais recente; conferir os relatórios no estado atual.

| Comando | Escopo |
|---|---|
| TEST_BASE_URL=http://127.0.0.1:3001 npm run test:site | HTTP público, SEO, preview, oferta/afiliado e redirects |
| TEST_BASE_URL=http://127.0.0.1:3001 node --env-file-if-exists=.env.local --import tsx scripts/qa-foundation.ts | Fundação/tema/fallback públicos |
| TEST_BASE_URL=http://127.0.0.1:3001 node --env-file-if-exists=.env.local --import tsx scripts/qa-admin-foundation.ts | Login/dashboard e tema administrativo |
| TEST_BASE_URL=http://127.0.0.1:3001 node --env-file-if-exists=.env.local --import tsx scripts/qa-public-site.ts | Rodada pública completa com fixtures |
| TEST_BASE_URL=http://127.0.0.1:3001 node --env-file-if-exists=.env.local --import tsx scripts/qa-catalog-states.ts | Estados 0/1/20, paginação e menu |
| TEST_BASE_URL=http://127.0.0.1:3001 node --env-file-if-exists=.env.local --import tsx scripts/qa-admin-editorial.ts | CRUD nativo, teclado, rascunho e reduced-motion |
| TEST_BASE_URL=http://127.0.0.1:3001 node --env-file-if-exists=.env.local --import tsx scripts/qa-relationship.ts | Amostra/confirmação/preferências, transporte em memória |
| TEST_BASE_URL=http://127.0.0.1:3001 node --env-file-if-exists=.env.local --import tsx scripts/qa-sequences.ts | Sequências/calendário; --snapshot-review limita à revisão complementar |
| BIBLIOTHEON_SYNTHETIC_TESTS=true BIBLIOTHEON_UPGRADE_IMAGE=bibliotheon:local-b05 python3 scripts/qa-container.py | Imagem bibliotheon:local-d107 já construída; vazio e upgrade em projetos descartáveis com rede internal; não VPS |
| BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:recovery | Backup/restore físico e replay v2 em laboratório com restic; ver pacote de produção |

Supressão e recuperação administrativa têm comandos nas seções próprias. Para empacotar CLIs, executar `node scripts/build-runtime.mjs`; saídas em .release, usadas pela imagem. `npm run build` gera Next standalone; sozinho não homologa o pacote Docker. Nenhuma dessas instruções exige credenciais reais para ensaios sintéticos.

Os patches pnpm de @payloadcms/ui, @payloadcms/next e @payloadcms/richtext-lexical 3.91.0 ficam em patches, referenciados por package.json/lockfile. Preservam controles nativos e corrigem problemas de acessibilidade/teclado identificados no QA. Não copiar uma pasta de patch antiga por cima da revisão atual. Após atualização de dependência/patch, instalar com lockfile, reconstruir saída isolada e repetir os fluxos afetados; remover patch só após evidência de correção upstream. Um 500 anterior de contexto da listagem não se repetiu no build limpo, mas sua causa específica não foi confirmada.

## Integridade de mídia

npm run test:media usa somente PostgreSQL loopback sem owner, arquivos sintéticos e diretório temporário exclusivo; executar sequencialmente com as outras fixtures. npm run media:gc apenas inspeciona; npm run media:gc -- --apply registra candidatos e só apaga órfãos após 24h desde primeira observação. O CLI empacotado é .release/media-gc.js após node scripts/build-runtime.mjs. Em produção, seguir o backup/lock do [guia](../deploy.md), evitando coleta manual concorrente com a cópia. Não usar essa rotina como substituta da retenção B12.

## Lotes promocionais locais

npm run test:batches usa fixtures sintéticas e banco loopback sem owner/dados operacionais; executar sequencialmente com marketing/sequências. npm run promotions:prepare agora prepara etapas e persiste lotes, retornando contagens examined/batches/recipients. A preparação não envia nem consome quota. Claim é função interna de domínio, sem endpoint/CLI público e fora do worker enquanto transporte/sincronização/conciliação não existirem. Testes não homologam conta ou remetente Brevo.

## Bloqueios outbound Brevo

npm run test:brevo-sync usa banco loopback vazio e HTTP/cliente sintéticos, sem acesso ao provedor. Executar sequencialmente com as demais fixtures. npm run brevo:suppressions (runtime: node cli/sync-brevo-suppressions.js) consulta no máximo 25 pendências; desligado por padrão, retorna enabled=false sem acessar banco ou rede. Com BREVO_CONTACT_SYNC_ENABLED=true e BREVO_API_KEY privada, fará consultas/bloqueios reais; somente após homologação/autorização operacional. Configuração ativada inválida retorna erro genérico.

-- --retry-failed reabre até 100 recusas definitivas após correção e executa o mesmo lote limitado; não limpa consentimento nem bloqueios. Fila e estados aparecem no painel do owner somente para leitura. Sem e-mail habilitado, o worker pode operar apenas essa sincronização; nenhum sender é usado em GET/PUT de contatos. Não usar a flag para habilitar envio promocional: este continua sem transporte.

## Conferência de destinatários

npm run test:preflight usa PostgreSQL loopback e consultas sintéticas; executar sequencialmente com as demais fixtures. claimPromotionBatch agora exige preflight: cliente desativado/chave privada de links ausente não reserva; um cliente sintético é injetado somente nos testes. A função não está ligada ao worker e não possui endpoint público de execução. Com integração configurada, consultas usarão a API real de contatos; manter flag desligada até homologação. Receipt da conferência é privado, não contém endereço/token e expira em cinco minutos.

Décima migração adiciona providerCheck/action/códigos de pendência. Seu down recusa remover/reclassificar observações novas ou códigos em uso: não apagar auditoria para forçar rollback; seguir correção progressiva e procedimento de recuperação.

## Cadastro consentido Brevo

npm run test:brevo-contacts primeiro empacota CLIs, usa PostgreSQL loopback e HTTP totalmente sintético e exercita também o CLI habilitado com fetch interceptado; executar sequencialmente com as demais fixtures. npm run brevo:contacts (runtime node cli/sync-brevo-registrations.js) fica desativado por padrão e retorna contagens sem banco/rede. -- --retry-failed reabre até 100 falhas após corrigir configuração, preservando tentativas; identity_changed exige revisão separada e não é reaberto automaticamente. Cada execução processa até 25 pendências.

Ativação exige BREVO_CONTACT_REGISTRATION_ENABLED=true, BREVO_CONTACT_SYNC_ENABLED=true, BREVO_API_KEY e LEAD_TOKEN_SECRET privados e homologados. Worker processa no máximo um cadastro por ciclo; compensações são drenadas pelo canal de bloqueios mesmo sem novos cadastros habilitados. Nenhuma lista/campanha/mensagem é criada por essa rotina. Não retirar chave/canal de bloqueios enquanto houver canceling/processing pendentes.

## Listas exclusivas de lote

npm run test:brevo-lists empacota CLIs e usa PostgreSQL loopback/HTTP inteiramente sintéticos, incluindo dataset de 200 e CLI habilitado interceptado. Executar sequencialmente com as demais fixtures. npm run brevo:lists -- UUID_DO_LOTE (runtime node cli/prepare-brevo-list.js UUID_DO_LOTE) prepara/reconcilia uma lista; flag padrão false, sem banco/rede nesse modo. Ativação exige BREVO_LIST_SYNC_ENABLED=true, BREVO_CONTACT_SYNC_ENABLED=true, BREVO_LIST_FOLDER_ID dedicado e chaves privadas válidas/homologadas. O worker ainda não executa listas automaticamente.

--list-id ID é confirmação privada de objeto revisado após criação incerta: nome/pasta/conjunto continuam conferidos, sem confiar cegamente no ID. --retry-rejected permite nova criação apenas quando a anterior foi explicitamente recusada e não há ID conhecido. Não usar para resultado incerto. Inclusão incerta deve ser conferida na conta, inclusive preferências, antes de reparação manual; repetir o CLI apenas reconcilia IDs já tentados. Não editar estados/manifestos no painel nem remover listas/contatos arbitrários.


### Preferências por assunto (D53)

npm run test:preferences exercita o serviço e contrato POST com banco loopback e fixtures sintéticas: token/escopo/validação, retirada concorrente, rollback, preservação de outro tema, recusa de lote preparado e cancelamento do último assunto. Executar sequencialmente às demais fixtures. QA renderizado: TEST_BASE_URL na porta isolada, node --env-file-if-exists=.env.local --import tsx scripts/qa-preferences.ts; requer build atual/servidor QA e banco operacional vazio. Relatório/screenshot sem tokens ou endereços. Nenhuma migração adicional ou flag de transporte.


### Links Brevo por destinatário (D54)

npm run test:brevo-preferences empacota CLI e valida emissão/reutilização/rotação, HTTP limitado, reconciliação, concorrência, descadastro, validade e guard de migração usando fixtures sintéticas; executar sequencialmente às demais suites. npm run brevo:preferences -- <UUID-do-lote> prepara/concilia o atributo individual, sem campanha ou envio. Sem flag configurada retorna disabled antes de banco/rede. Nunca copiar o resultado bruto do provedor ou os links para logs.


### Rascunhos de campanhas (D55)

npm run test:brevo-campaigns empacota CLI e exercita criação/conciliação/concorrência/IDs/lease/descadastro com banco loopback e HTTP sintético. Executar sequencialmente às demais fixtures. npm run brevo:campaigns -- UUID_DO_LOTE prepara listas/preferências e cria/confere um rascunho; --campaign-id ID admite reconciliação revisada, --retry-rejected somente criação explicitamente recusada sem ID. Flag falsa retorna disabled antes de banco/rede. Não compartilhe saída bruta de APIs, links privados ou secrets. Não existe envio de campanha nessa CLI.


### Transporte promocional (D56)

npm run test:brevo-send empacota CLI/worker e valida intenção/quota atômicas, concorrência, rollback, mudança UTC, timeout após aceitação, retry explícito, descadastro, emissão abandonada e falha ao registrar retorno. Seleção de candidatos do worker exercitada com lote concorrente ativo; worker empacotado --once com fila vazia e rede bloqueada. Tudo em banco loopback/HTTP sintético; executar sequencialmente às demais fixtures.

npm run brevo:send -- UUID_DO_LOTE prepara/concilia e solicita disparo; --retry-rejected somente após recusa documentada. Sem BREVO_CAMPAIGN_SEND_ENABLED=true retorna disabled antes de banco/rede. Worker com flag habilitada pode disparar sem EMAIL_TRANSPORT_ENABLED; dependências e quota inválidas são recusadas antes de getPayload. Não habilitar no ambiente real para reproduzir testes. Use fixtures/interceptação, nunca compradores reais.


## Consultar atividade de campanhas existentes (D57)

Manter BREVO_CAMPAIGN_OBSERVE_ENABLED=false no primeiro deploy; atualizar.sh preserva o ambiente privado. A flag de observação é independente de BREVO_CAMPAIGN_SEND_ENABLED. Após homologar a consulta e conceder chave privada de API, pode ativar somente observação: não exige habilitar SMTP/cadastro/disparo nem altera consentimento. Para execução periódica na VPS, ativar também o worker na configuração privada do atualizador conforme o procedimento anterior.

CLI local: npm run brevo:observe -- UUID_DO_LOTE; runtime da imagem: node cli/observe-brevo-campaign.js UUID_DO_LOTE. Acrescentar --refresh para consultar novamente um registro ainda não vencido/terminal; lease ativo é respeitado. Sem flag retorna disabled; flag com chave inválida falha. Fila é criada com cada intenção de emissão e preenchida para tentativas anteriores pela migração 16. Worker consulta até uma campanha por ciclo; 15 minutos entre consultas, lease de 30 minutos e parada automática em sent/archive/cancelled.

observed significa atividade da campanha, sem comprovar destinatário/entrega ou autoria exclusiva do POST. Histórico HTTP/código e quota permanecem preservados; nenhum estado de consulta autoriza reenviar pedido incerto. Não ligar envio para investigar timeout. Prova, datas e falhas ficam em brevo-campaign-observations, privada e sem resposta bruta. Consulte [contrato Brevo](integracoes/brevo.md) e o estado atual antes da produção.


## Callback Brevo de marketing e resultados individuais (D58)

No primeiro deploy manter BREVO_WEBHOOK_ENABLED=false. As migrações 17/18 são aditivas; não fabricam identidade histórica para disparos existentes. Atualizar com ./atualizar.sh preserva o ambiente privado e não ativa webhooks/envio automaticamente. Runtime inclui node cli/replay-brevo-webhook.js UUID_DO_EVENTO; localmente npm run brevo:webhook-replay -- UUID_DO_EVENTO. Replay de envelope não reenvia mensagem nem consulta a API.

Para homologação posterior, gerar segredos privados independentes com pelo menos 32 bytes conforme o procedimento de chaves deste projeto. Configurar BREVO_WEBHOOK_TOKEN (32–128 caracteres ASCII alfanuméricos/hífen/sublinhado) e BREVO_WEBHOOK_EVENT_SECRET (HMAC estável), sem copiar sessão/chave de links. BREVO_WEBHOOK_PREVIOUS_TOKEN é opcional para transição de autorização. Nunca trocar o segredo HMAC junto de rotação de token: a deduplicação histórica depende dele. A identidade capturada no disparo depende também da chave privada de links; recuperar esses segredos junto do banco/configuração privada, fora do Git e com permissões restritas.

Na conta Brevo, configurar manualmente webhook type=marketing, channel=email, batched=false, URL HTTPS da aplicação terminada em /api/webhooks/brevo, events delivered/hardBounce/softBounce/spam/unsubscribed e auth.type=bearer com token privado. A API key usada para criar/configurar webhook na conta não é a credencial do callback. Só ativar BREVO_WEBHOOK_ENABLED=true depois de conferir proxy/TLS, autenticação e teste controlado; não precisa ativar SMTP, worker, envio ou cadastro para receber. Homologação real não foi executada nesta etapa. Não usar os tokens sintéticos de CI em produção.

Callback autentica antes de corpo/banco, limita 32 KiB/5 segundos e confirma somente depois do commit. Configuração desativada/indisponibilidade responde 429 com Retry-After; a política pública da Brevo documenta descarte de notificações em 5xx. Corpo/credencial inválidos não são aceitos. Configurar endpoint/canal/eventos incorretos exige correção e revisão na conta; não presumir retry ilimitado. Não colocar chave na URL nem registrar Authorization/corpos no proxy.

Coleções privadas brevo-webhook-events e brevo-delivery-receipts mostram quarentena/resultados mínimos, sem payload bruto. Desconhecidos exigem revisão na conta e, quando necessário, fluxo manual de supressão; replay não associa um email antigo a cadastro criado depois. Legado sem impressão histórica, identidade divergente, campanha/destinatário/tempo incompatíveis não são entregas conciliadas. Notificações negativas válidas de contato conhecido protegem consentimento mesmo sem campanha mapeada. delivered significa relato do provedor e não comprova leitura/compra. Não reenviar pedido incerto para investigar resultados; quota/histórico permanecem preservados. Ver [contrato Brevo](integracoes/brevo.md).


## Medição própria opcional (D59)

ANALYTICS_ENABLED=false no primeiro deploy. A migração 19 cria permissões/sessões/páginas/saídas/limites e termo de campanha. atualizar.sh preserva o ambiente privado e aplica migrations pendentes. Medição também exige institucional legalReady revisado; enquanto responsável/contato/textos não estiverem prontos, não haverá novo aceite/coleta. A autorização de marketing não vale como autorização analítica. Não ativar para operação real antes de retenção/exclusão B12 e revisão do release/políticas.

Em homologação, ativar a flag no ambiente privado e atualizar; não exige Brevo/SMTP/worker/API paga. Verificar aceitar/rejeitar equivalentes no rodapé, cookie __Host/HttpOnly/Secure em HTTPS e revogação com cookie antigo. A recusa só guarda preferência igual para todos. Há formulário nativo de retirada sem JavaScript, com redirecionamento fixo à privacidade. GET de preferência não cria ID/sessão. Revogação já existente permanece acessível se a flag/aviso forem desativados.

Sessões são medidas com 30 minutos inativas; first-touch e último não direto usam janela de 30 dias. Campo de campanha/UTMs deve conter códigos salvos e revisados, sem dados pessoais. Formulário Campaign gera link interno somente com livro/oferta/campanha disponíveis. D87/D88 acrescentam `sck` somente à saída com consentimento vigente e quando ainda ausente na URL. O painel de sete dias separa sessões/páginas consentidas, saídas totais e saídas consentidas. Não ler contagens como pessoas únicas, vendas ou conversão. Falha de medição não interrompe checkout validado.

QA local: npm run test:analytics, npm run test:analytics-http, npm run test:analytics-retention e scripts/qa-analytics.ts, com base sintética/loopback e testes sequenciais. `npm run analytics:retention` é prévia; `--apply` agrega/expira analytics. A rotina diária do worker exige `DATA_RETENTION_ENABLED=true`, falso por padrão. Nunca persistir query completa, referer, IP, credenciais ou payloads reais em logs; conferir também política do proxy existente, sem alterar os outros serviços da VPS. D89 cobre retenção analítica, D90 exportação de titular, D98 tombstones HMAC, D99 tokens expirados, D100 auditoria comercial resolvida e D101 envelope expirado com ledger preservado e D102 amostras confirmadas antigas. Retenção ampla, correção/exclusão completa e reaplicação pós-restore seguem pendentes. Há 32 migrations atuais, ainda sem imagem/restore final homologado. Ver [estado atual](23-estado-atual.md).


## Inbox comercial comum (D61)

Aplicar a migração 20 com npm run db:migrate antes de testar ofertas no schema novo. npm run test:commercial-inbox empacota runtime e valida banco loopback vazio, adaptadores internos sintéticos, concorrência, rollback, retry owner, CLI/worker e cleanup. Não executar fixtures simultaneamente nem apontar para banco real.

COMMERCIAL_EVENTS_ENABLED=false mantém a fila desativada; npm run commerce:process -- 1 retorna disabled sem abrir banco. Em ambiente local de teste habilitado, processa de 1 a 25 envelopes previamente persistidos. Worker pode operar apenas comércio sem SMTP/Brevo. Não há formulário público de evento normalizado, adaptador nativo ou callback comercial externo habilitado. [Operação](11-operacao.md) descreve revisão, lease e retry.


## Painel comercial (D62)

Após as vinte migrations, npm run test:commercial-admin valida resumo, atenção, datas, filtros, UUID, paginação e leitura sem efeitos com fixtures locais. npm run test:commercial-inbox cobre o domínio/worker/API de retry. Ambas as suítes estão declaradas no workflow de qualidade, cuja execução no GitHub continua a cargo do proprietário e não foi comprovada nesta sessão.

QA renderizado: iniciar o build isolado .next-qa na porta 3001, com PUBLIC_SITE_URL e TEST_BASE_URL iguais à origem loopback, COMMERCIAL_EVENTS_ENABLED=false, e executar node --env-file-if-exists=.env.local --import tsx scripts/qa-commercial-admin.ts. Requer Chromium já disponível no ambiente. O harness exige banco sem owner/comércio, cria fixtures sintéticas, bloqueia HTTP externo, valida retorno 202/auditoria reais locais, intercepta erros de formulário e limpa em finally. Não executar junto com outras fixtures ou contra banco real.

O fallback sem JS é somente de leitura: filtros GET e details funcionam; envio exige JS e botão permanece desabilitado. Axe só roda nos contextos com JS. Erro da ferramenta de teste não deve ser reportado como defeito do produto sem conferir DOM/estilo/screenshot. Não alterar .next/3000 da prévia gerenciada durante QA.


## Hotmart v2 local — D63

npm run test:hotmart usa handler real com PostgreSQL loopback e payloads v2 sintéticos. npm run test:hotmart-http exige servidor QA isolado com HOTMART_WEBHOOK_ENABLED=true, HOTMART_ACCOUNT_KEY=synthetic e HOTMART_HOTTOK=synthetic-hotmart-private-token, sem ativar processamento automático ou serviços externos. Os três valores são exclusivamente de teste e não devem ser copiados para produção. PUBLIC_SITE_URL/TEST_BASE_URL precisam ser a mesma origem loopback; usar .next-qa/3001 e preservar .next/3000 da prévia.

As suítes exigem banco local sem owner/ledger, executam sequencialmente e limpam fixtures. Não testam conta real; nenhuma chamada de saída à Hotmart é feita. Unitários exercitam reviver source do JSON no Node fixado, centavos exatos, tokens, deadlines e datas. Node/runtime sem suporte ao texto numérico original não deve normalizar silenciosamente por arredondamento. Vinte migrações continuam suficientes nesta etapa.

## Kiwify sintética — D64

npm run test:kiwify exige banco loopback sem owner/histórico comercial; cria fixtures e limpa ao final. npm run test:kiwify-http exige build isolado .next-qa/3001, TEST_BASE_URL=http://127.0.0.1:3001 e app com KIWIFY_WEBHOOK_ENABLED=true, KIWIFY_ACCOUNT_KEY=synthetic, KIWIFY_WEBHOOK_TOKEN=synthetic-kiwify-current-token-32-characters. Esse token é deliberadamente público/sintético e proibido na operação real. SMTP/worker reais continuam desligados. Não substituir .next ou usar porta 3000 da prévia para QA. A assinatura gerada pelo teste não deve aparecer nos logs do servidor/proxy.

## Cakto sintética — D65

npm run test:cakto cria fixtures nativas V1/V2 no PostgreSQL loopback, com guards de banco vazio e cleanup. npm run test:cakto-http exige build isolado .next-qa/3001, TEST_BASE_URL=http://127.0.0.1:3001, CAKTO_WEBHOOK_ENABLED=true, CAKTO_ACCOUNT_KEY=synthetic e CAKTO_WEBHOOK_SECRET=synthetic-cakto-current-secret-32-characters no app QA. Esse segredo é público/sintético e proibido na operação real. SMTP/processamento automáticos desligados; testes aplicam fila explicitamente. Executar suítes de banco sequencialmente e encerrar servidor QA ao final; preservar .next/3000. Não imprimir corpo/assinatura em logs.

## Prévia CSV sintética — D66

npm run test:commercial-csv usa PostgreSQL loopback sem owner/histórico e cria somente fixtures locais. npm run test:commercial-csv-http exige build QA isolado .next-qa/3001 e TEST_BASE_URL=http://127.0.0.1:3001; cria owner efêmero, autentica JWT e limpa ao final. Integradores/SMTP/worker podem permanecer desligados. Não executar contra produção ou banco com cadastros reais. Sem nova migração, segredo, flag, CLI de importação ou UI. [Formato/limites](24-conciliacao.md).

## Importações duráveis sintéticas — D67

Aplicar migração 21 somente no banco de desenvolvimento. npm run test:commercial-imports exige owner/histórico comercial e de importação vazios; fixtures incluem estágios/filas e cleanup. npm run test:commercial-imports-http exige .next-qa/3001 e TEST_BASE_URL correspondente, owner/CSV efêmeros, worker/envios/provedores desligados. Não executar em produção. Testes de migração 20 respeitam dependência21. Tipos gerados/import map conferido, sem componente customizado novo. [Protocolo/limites](24-conciliacao.md).


## Recuperação de fixtures institucionais — D73

A fixture de site guarda o estado institucional anterior em .local-run/fixture-site-settings-<sufixo>.json, privado (0600) e ignorado por Git/imagem. Limpeza normal restaura os campos e remove a cópia apenas ao final. Uma cópia restante após falha exige conferir ambiente/namespace e a tentativa correspondente; não apagar para forçar novo teste nem publicar seu conteúdo. Não é backup de produção. Fixtures comerciais passam a conferir erros de exclusão em lote, respeitando referências antes de remover ofertas/livros.

## Decisões financeiras sintéticas — D74

Aplicar migração 25 somente no banco local. BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:financial-resolutions exige banco loopback sem owner/histórico/decisões. Teste HTTP correspondente exige build QA atualizado e TEST_BASE_URL/PUBLIC_SITE_URL concordantes. Ambos criam exclusivamente fontes/atores sintéticos e removem provas por helper de fixture restrito ao banco exclusivo; essa remoção não existe na aplicação. Nunca executar contra contas ou dados reais. Os runners check:integration e check:http compartilham o banco e devem ser sequenciais. [Contrato](24-conciliacao.md).

## Evidência canônica sintética — D75

Migração 26 e banco loopback exclusivo, sem dados/cadastros anteriores. BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:report-evidence executa cenários de prova/decisão/CSV e restaura as fixtures. test:report-evidence-http exige build isolado atualizado e origem correspondente; check:http inclui essa suíte. Flags externas permanecem desligadas salvo endpoints sintéticos do harness. Não usar helpers de remoção de prova fora das fixtures. Não interpretar contrato canônico como exportação nativa homologada. [Contrato](24-conciliacao.md).

D76: `test:report-evidence` também cobre rollback de lote; `test:report-evidence-http` cobre permissões, repetição, conflito e limite de 20 registros. Runner final executado em `.next-qa`/3001; ver [checks](../artifacts/report-evidence/d76-checks.json).

D77: `npm run db:migrate` aplica a migração 27 no PostgreSQL local. `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:report-evidence` prova importação canônica, idempotência, stale, atomicidade e proteção de downgrade. `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:report-evidence-http` exercita preview/stage/commit owner via HTTP. Os testes usam fixtures sintéticas; não homologam exportação nativa ou conta de provedor. Ver contrato e limites em [D77](24-conciliacao.md).


## Ledger financeiro local — D78

Após migrations aplicadas no PostgreSQL sintético exclusivo, valide o ledger e as rotas HTTP com:

```bash
BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:financial-ledger
CHECK_HTTP_PORT=3001 NEXT_DIST_DIR=.next-qa BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:http -- --only financial-ledger-http
```

Para regressão completa, use `npm run check:http`; o argumento `--only SUITE` executa apenas uma suíte escolhida do runner, sem mudar as garantias de porta, readiness e cleanup. Ambos encerram somente o processo que iniciaram. Escolha uma porta livre. O build precisa ser atualizado antes: `NEXT_DIST_DIR=.next-qa npm run build`. Resultados sintéticos D78 não são homologação de formato ou conta comercial.

## QA das interfaces financeiras e de importação — D79–D81

Com PostgreSQL sintético exclusivo iniciado e as 28 migrations aplicadas:

```bash
NEXT_DIST_DIR=.next-qa npm run build
BIBLIOTHEON_SYNTHETIC_TESTS=true CHECK_ADMIN_QA_PORT=3005 npm run check:qa-commercial-imports
BIBLIOTHEON_SYNTHETIC_TESTS=true CHECK_ADMIN_QA_PORT=3005 npm run check:qa-financial-ledger
BIBLIOTHEON_SYNTHETIC_TESTS=true CHECK_ADMIN_QA_PORT=3006 npm run check:qa-financial-records
```

Execute as suítes sequencialmente. Elas exigem banco sem owner/histórico, criam fixtures e limpam ao final. O harness compartilhado `scripts/check-qa-admin.sh` recusa listener ativo, distingue TIME_WAIT, usa `.next-qa`, aguarda saúde e encerra somente o servidor iniciado; a porta 3000 é preservada. `CHECK_FINANCIAL_QA_PORT` permanece como alias; `CHECK_ADMIN_QA_PORT` tem precedência. Chromium/Playwright e banco local são pré-requisitos já usados pelo projeto, sem instalação global automática. Artefatos sintéticos ficam em `artifacts/qa-commercial-imports` e `artifacts/qa-financial-ledger` e `artifacts/qa-financial-records`; logs do servidor são privados em `.local-logs`. O harness encerra o servidor QA; pare o banco local quando seu uso terminar.

O argumento `--zoom` de `check:qa-financial-records` executa apenas o complemento de formulários/conferências em texto 200% e grava `zoom-results.json`, preservando `results.json` da jornada completa:

```bash
BIBLIOTHEON_SYNTHETIC_TESTS=true CHECK_ADMIN_QA_PORT=3006 npm run check:qa-financial-records -- --zoom
```

As duas execuções usam banco exclusivo e são sequenciais; o complemento não grava movimentos/custos e limpa as fixtures de autenticação/catálogo. O modo não substitui a jornada completa nem o zoom nativo 400%.

## QA da resolução de catálogo — D82

Com build isolado atual e PostgreSQL local sintético exclusivo já migrado: `BIBLIOTHEON_SYNTHETIC_TESTS=true CHECK_ADMIN_QA_PORT=3007 npm run check:qa-catalog-resolutions`. Usa o harness administrativo com recusa de porta ocupada e encerra apenas seu servidor. A suíte cobre associação/bloqueio, fonte/atestação, plano stale, resposta perdida após gravação, histórico/paginação, permissões API, temas, texto 200% e fallback sem JS. Não executar sobre banco operacional ou contas reais.

## QA da resolução financeira — D83

Com `.next-qa` atualizado e PostgreSQL local sintético exclusivo já migrado: `BIBLIOTHEON_SYNTHETIC_TESTS=true CHECK_ADMIN_QA_PORT=3008 npm run check:qa-financial-resolutions`. Harness recusa porta ocupada e encerra apenas seu servidor. A suíte confere fontes, contradições, exclusões, conciliação/hold, stale, resposta perdida, relatório substituto, três provedores, continuação worker e paginação, além de permissões e navegador. Nunca usar banco ou contas operacionais.

## Regressões de cobertura financeira — D84

`BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:financial-coverage` executa cinco grupos PostgreSQL com relógio controlado, sobre banco local exclusivo/vazio de owners. Está no runner sequencial `check:integration` após financial-ledger. `BIBLIOTHEON_SYNTHETIC_TESTS=true CHECK_ADMIN_QA_PORT=3009 npm run check:qa-financial-coverage` usa build `.next-qa` e navegador local para conferir POST real, tabela/coortes/filtros, estados, temas e texto ampliado. Não executar em banco operacional. Nenhuma conta de fornecedor ou serviço externo é usado.

## QA dos detalhamentos financeiros — D85

`BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:financial-dimensions` usa banco local exclusivo para quatro grupos de processamento real da inbox, separação de dimensões, custos/atribuição desconhecida e leitura/filtro sem escrita. Está no runner sequencial após financial-coverage. `BIBLIOTHEON_SYNTHETIC_TESTS=true CHECK_ADMIN_QA_PORT=3010 npm run check:qa-financial-dimensions` usa build `.next-qa` e valida POST real, tabelas, paginação 20+1 e disclosure, temas/texto ampliado e navegação sem JS. Não usar banco/contas operacionais. A regressão financial-coverage mantém resultado no caminho padrão; a reexecução D85 tem cópia identificada em artifacts/financial-dimensions/coverage-regression-results.json.

## Matriz e jornada integrada — D86

`BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:commercial-state-matrix` percorre 21 casos aceitos e seis recusados, em seis grupos, com PostgreSQL local exclusivo. Está no runner sequencial após report-evidence. Testa preview/stage/commit/decisão, idempotência, conflito, atomicidade, stale e snapshot compatível. Não executar em banco operacional.

`BIBLIOTHEON_SYNTHETIC_TESTS=true CHECK_ADMIN_QA_PORT=3011 npm run check:qa-commercial-operation` usa build `.next-qa` conferido e percorre cinco views, sete estados por UI, catálogo bloqueado/resolvido, caixa/custo, relatório e reimportação. Usa somente contas/arquivos sintéticos locais e encerra apenas o próprio servidor. Reuso do build exige conferência das fontes registradas; mudança na aplicação exige novo build. Não equivale à matriz visual integral ou homologação de fornecedor.

## D90 — Exportação de dados de titular

Após iniciar o banco conforme a seção de ambiente sintético, `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:preferences` executa integração de preferências e exportação privada. Migration `20261025_192350_privacy_request_audit` (número 30) foi aplicada no PostgreSQL local; execução concluiu com oito grupos e fixtures limpas. A suíte não envia mensagens nem acessa provedor. A rota exige owner/origem/verificação declarada; tratar a resposta como dado pessoal e não persistir fora do canal autorizado. Evidência: [resultado D90](../artifacts/privacy-export/local-results.json). Correção, exclusão, retenção completa e restore seguem pendentes.

## D91–D92 — Retenção de privacidade

`npm run privacy:retention` apresenta preview; acrescente `-- --apply` para expirar auditorias com mais de 24 meses e pedidos de amostra não confirmados após sete dias. Pedidos cujo outbox está `sending/uncertain` permanecem para conciliação. O worker diário executa a rotina junto da retenção analítica quando `DATA_RETENTION_ENABLED=true`, falso por padrão. Validação: `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-retention`, sete verificações PostgreSQL sintéticas; [resultado D92](../artifacts/privacy-retention/d92-results.json). Sem dados pessoais reais, mensagens ou serviço externo.

D93: `POST /api/v1/admin/privacy/delete` é exclusivo do owner e exige confirmação explícita. `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-delete` cobre exclusão local e `pending` diante de envio incerto. Execute somente com o PostgreSQL sintético exclusivo preparado neste guia; a rotina não chama Brevo. Estado externo e manifestos compartilhados exigem conciliação antes de repetir o pedido. Tombstones expiram junto da auditoria após 24 meses; restore ainda não reaplica o manifesto.

D94: com o build standalone e banco sintético exclusivos ativos, `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:http -- --only privacy-delete-http` testa owner, origem exata, confirmação, cabeçalhos privados, repetição e bloqueio de envio incerto via HTTP. O runner inicia e encerra somente seu processo Next. Requer acesso loopback; não usa conta nem API Brevo.

D95–D96: `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-correct` cobre preservação das relações/consentimentos locais, revogação de solicitação ainda não confirmada, cancelamento do outbox de confirmação pendente, tombstone do endereço anterior, replay e bloqueio `pending` sem mutação se houver envio incerto. Usa somente PostgreSQL local sintético; não chama provedores nem envia mensagens. A rota HTTP owner é `/api/v1/admin/privacy/correct`; valide identidade fora do sistema e concilie primeiro qualquer identidade ou manifesto externo.

## D97 — Inventário agregado de privacidade

Com o PostgreSQL local configurado, `npm run privacy:inventory` lê somente contagens por coleção em marketing, analytics e commerce e imprime JSON agregado. A saída inclui timestamp de geração, total e contagens; não inclui IDs, emails ou conteúdo. O comando não altera registros. Para validar com fixtures sintéticas: `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-inventory`. Consulte a [evidência](../artifacts/privacy-inventory/local-results.json). Não trate o inventário como relatório individual de titular ou comprovação de expurgo.

## D98 — Tombstones e expiração de supressões

`npm run privacy:retention` apresenta também a contagem agregada `expiredSuppressionTombstones`. Com `-- --apply`, elimina tombstones HMAC vencidos há 12 meses; preview é padrão. A integração `npm run test:privacy-retention` valida preservação dos tombstones ativos e expiração seletiva. Os fluxos de supressão precisam de `LEAD_TOKEN_SECRET` válido e armazenam apenas HMAC; não exponha esse valor. Novo opt-in passa pela confirmação habitual e só então remove o tombstone anterior.

## D99 — Expiração de links de preferências

`npm run privacy:retention` também informa `expiredPreferenceTokens`; `-- --apply` remove somente tokens com validade de 24 horas já encerrada, sob lock do contato. Execute `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-retention` no PostgreSQL sintético preparado neste guia para validar preview, expiração, preservação do ativo e repetição. A rotina roda antes da avaliação de referências de contatos abandonados. Ela não remove consentimentos, não dispara envios nem consulta provedores; a flag diária continua falsa por padrão. [Resultado](../artifacts/privacy-retention/d99-results.json).

## D100 — Expiração seletiva da auditoria comercial

`npm run privacy:retention` informa `commercialAudit`; com `-- --apply`, expira somente auditorias anteriores a 24 meses cujo inbox esteja resolvido, sem conflito, e sem transação em revisão. Preview não escreve. A integração de retenção verifica preservação de casos pendentes/conflitantes/revisão e repetição; executar no banco sintético exclusivo com `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-retention`. A rotina não apaga inbox, fatos financeiros nem projeções. [Resultado D100](../artifacts/privacy-retention/d100-results.json).

## D101 — Expiração do envelope da inbox

`npm run privacy:retention` apresenta `commercialInboxEnvelopes`; com `-- --apply`, expira o envelope após 90 dias do processamento apenas para evento terminal, sem conflito e com ledger íntegro. Para `applied`, é necessária uma única linha em `transaction-events` que valide chave/hash; pendências e revisão são preservadas. O marcador e o ledger permanecem, e replay/revisão recuperam o evento da trilha normalizada. Migration 32 aplicada no banco sintético. Verifique com `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-retention`; [15 verificações](../artifacts/privacy-retention/d101-results.json). Rotina automática segue opt-in; não aplicar antes da revisão de política do responsável.

## D102 — Amostras confirmadas antigas

O preview de `npm run privacy:retention` inclui `confirmedSamples`; `-- --apply` aplica o cutoff de 24 meses a pedidos confirmados sem atividade recente e sem dependências/prova vigente a preservar. Mantém contatos, assinaturas atuais e supressões. Para validar em banco sintético exclusivo: `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-samples-retention`. [Cinco grupos locais](../artifacts/privacy-retention/d102-results.json). Não habilita flags ou transporte; as 32 migrations continuam atuais.

## D103 — Paginação da retenção

`BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-retention` inclui regressão de backlog: 100 casos retidos na primeira página não impedem o expurgo de um pedido posterior. [18 verificações locais](../artifacts/privacy-retention/d103-results.json). CLI/flags não mudam; preview continua padrão. Sem migration; permanecem 32 no release atual.

## D104 — Manifesto de recuperação de privacidade

`npm run privacy:recovery -- export --output .local/privacy/manifesto.json` grava arquivo novo 600 após preparar diretório privado. No destino isolado, com flags falsas e chave original, usar `preview` ou `apply` com `--input ARQUIVO --snapshot-at CAPTURED_AT --owner UUID --isolated`; argumentos estão no [runbook D104](11-operacao.md). `capturedAt` deve vir do relatório real de `ops/recovery.py`; não adivinhar data nem usar manifesto guardado apenas no snapshot antigo. Na imagem, comando equivalente é `node cli/privacy-recovery.js`.

Teste exclusivo: `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-recovery`. [Seis grupos e CLI empacotada](../artifacts/privacy-recovery/d104-results.json) passaram; não executa restic/pg_restore. O arquivo é sensível mesmo sem email; cópia externa criptografada atualizada e ensaio físico permanecem pendentes. Nenhuma flag, migration ou transporte habilitado.

## D105 — Testar preservação de pending

Executar `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-recovery-pending` somente no banco sintético exclusivo. [Sete grupos locais](../artifacts/privacy-recovery/d105-results.json) exercitam bloqueio de novas emissões, pending antigo, assinatura v2, replay e resolução explícita. O runner inclui a suíte sequencialmente. Comandos privacy:recovery de D104 não mudam; exportação informa version 2 e relatório de replay inclui manifestVersion/pendingCoverage/pendingDecisions. V1 continua aceito para completed e não cobre pending. Sem migration nova, flags ou envio habilitados.

## D106 — Executar o ensaio físico — 26/10/2026

Com PostgreSQL sintético exclusivo e as 32 migrations aplicadas, executar `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:recovery`. Exige Docker Compose e restic 0.19.1 verificado em `.local/bin/restic`; não instala binário nem acessa repositório remoto. Cria repositório restic criptografado temporário, banco/volume separados e porta aleatória só loopback; exporta manifesto privado 600 depois do snapshot e usa `capturedAt` real no CLI empacotado. Faz preview/apply/repetição e rejeita restore sobre destino ocupado. Remove recursos do próprio laboratório e limpa fixtures ao terminar. D106 validou backup criptografado e restore físico local das 32 migrations, com mídia íntegra e replay do manifesto v2 separado do snapshot; completed é reaplicado e pending permanece pendente. A telemetria automática do Payload foi desativada após a barreira de rede detectar sua tentativa. Imagem atual, guarda externa do manifesto/backup, RPO/RTO reais e release continuam pendentes. [Evidência D106](../artifacts/recovery/d106-results.json)

## D107 — Executar QA da imagem — 26/10/2026

Construir `docker build -t bibliotheon:local-d107 .`; depois executar `BIBLIOTHEON_SYNTHETIC_TESTS=true BIBLIOTHEON_UPGRADE_IMAGE=bibliotheon:local-b05 python3 scripts/qa-container.py`. BIBLIOTHEON_QA_IMAGE pode selecionar outra imagem já construída. O harness fixa IDs resolvidos, cria dois projetos/volumes sintéticos separados, rede internal e segredos privados temporários; confere nomes das migrations e preservação de owner/contato no upgrade. Sem BIBLIOTHEON_UPGRADE_IMAGE testa somente banco vazio e informa upgradeValidated=false. Não inclui banco de produção ou dump real. Remove os próprios recursos após cada cenário. D107 construiu a imagem local atual e verificou 32 migrations em banco vazio e upgrade real de 6 para 32, preservando contato e owner sintéticos. Saúde, HTTP interno, ACL, runtime sem root/read-only/DDL, CLIs de privacidade e worker de retenção passaram em rede Docker internal, sem saída para provedores. Corrigidos o encerramento das CLIs de inventário/retenção após a limpeza do Payload e a renovação do heartbeat no ciclo ocioso do worker de retenção. A imagem não foi publicada. Bateria funcional integral do release, restore físico nesta imagem, destino externo/RPO/RTO, contas e VPS continuam pendentes. [Evidência](../artifacts/container/d107-results.json).

## D108 — Executar restore com imagem — 26/10/2026

Com PostgreSQL local sintético exclusivo já migrado, restic 0.19.1 local verificado e imagem D107 construída, executar `BIBLIOTHEON_SYNTHETIC_TESTS=true BIBLIOTHEON_RECOVERY_IMAGE=bibliotheon:local-d107 npm run check:recovery`. O harness confere o ID contra a evidência D107; compara o hash do CLI, usa rede interna sem portas e manifesto privado fora do snapshot. CLI de replay usa manutenção; aplicação só inicia após replay com papel distinto sem privilégios administrativos e mídia somente leitura. Remove seu app, banco, rede/volume e temporários ao fim; preserva a imagem. Sem variável de imagem mantém o ensaio com CLI do host D106. D108 aprovou restore físico com a imagem D107: 32 migrations, mídia íntegra, seis decisões de privacidade posteriores ao snapshot e replay v2 dentro da imagem. Preview, exclusão/correção, pending, supressão/bounce e repetição sem renovar prazos foram verificados. A aplicação só iniciou depois do replay, com credencial de banco separada e limitada: saúde/catálogo/capa responderam 200, contatos privados 403 e amostra privada na rota pública 404. Rede interna sem portas publicadas; transportes e worker desligados. Destino externo, guarda atual do manifesto, RPO/RTO reais, bateria integral e homologações continuam pendentes. [Evidência](../artifacts/recovery/d108-results.json).

## D109 — Testar retenção após descadastro — 26/10/2026

Com PostgreSQL sintético exclusivo e 32 migrations aplicadas: `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-marketing-retention`. A suíte está no runner sequencial e cobre corte inclusivo de 30 dias, preview/aplicação, idempotência, rollback por contato, reativação concorrente, página inicial com 100 retidos, referências cruzadas e guardas de privacidade/manifestos/provedor/incerteza. Não envia mensagens. CLI e flags existentes são mantidos; `secret` é opção interna para testes/rotinas, não novo argumento público. [Oito grupos](../artifacts/privacy-retention/d109-results.json).

## D110 — Retenção de identidade e recuperação — 26/10/2026

Executar `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-identity-retention` em banco descartável/exclusivo e as demais suítes de privacidade sequencialmente. `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:recovery` grava artifacts/recovery/d110-results.json, usa runtime host por padrão e exige 33 migrations. BIBLIOTHEON_RECOVERY_PHASE muda a fase; BIBLIOTHEON_RECOVERY_BASELINE seleciona evidência da imagem quando usada. No QA de container, BIBLIOTHEON_QA_PHASE padrão D110 e BIBLIOTHEON_QA_IMAGE padrão bibliotheon:local-d110; é preciso construir essa imagem antes, pois a última comprovada é D107 (32 migrations). Não executar fixtures em banco real.

## D111 — Operações em lote e diagnóstico PostgreSQL — 26/10/2026

Após instalar dependências com lockfile congelado, executar `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:database-bulk` no PostgreSQL exclusivo, sequencial com as demais suítes. NODE_OPTIONS=--trace-deprecation pode ajudar diagnóstico sem alterar comportamento. O teste usa dados sintéticos e limpa as fixtures; não executá-lo contra banco operacional. O patch é aplicado pelo pnpm; não editar node_modules manualmente.

## D112 — Descadastro e retenção por assunto — 26/10/2026

Aplicar as 34 migrations no banco sintético exclusivo antes de `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-theme-retention`. Runner sequencial inclui a suíte. `npm run check:recovery` com a mesma flag usa D112 por padrão, produz artifacts/recovery/d112-results.json e exercita nove entradas v4 no restore host. BIBLIOTHEON_RECOVERY_PHASE/BIBLIOTHEON_RECOVERY_BASELINE continuam configuráveis. QA de container usa D112/imagem bibliotheon:local-d112 por padrão; precisa construí-la, pois a comprovada D107 tem 32 migrations.

## D113 — Margem e acompanhamento do prazo — 26/10/2026

Executar `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-retention-deadline` no banco exclusivo e sequencialmente com outras fixtures. `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:worker-health` requer Docker e a imagem local D107 por padrão; BIBLIOTHEON_HEALTH_TEST_IMAGE pode selecionar outra base. Monta somente CLIs atuais, rede none e filesystem read-only/tmpfs privado; não precisa de banco e não altera arquivos globais /tmp do host. O resultado não valida a imagem final. QA de imagem usa fase/tag D113 por padrão; ainda precisa reconstrução.

## D114 — Legado temático verificável — 26/10/2026

Com PostgreSQL exclusivo e 34 migrations, executar `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:privacy-theme-legacy`, sequencialmente com as demais suítes. `npm run check:recovery` com a mesma flag grava D114 por padrão e simula fonte legada retirando apenas o marcador sintético, mantendo evento nativo. A exportação precisa continuar sem escrever. BIBLIOTHEON_RECOVERY_PHASE permite outra fase; QA de imagem usa D114/tag local-d114 por padrão, mas exige construir a imagem. Não rodar fixtures em banco real.
