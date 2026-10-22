# 20 — Executar o Bibliotheon localmente

[Índice](../README.md) · [Evidências](19-desenvolvimento.md)

Este documento atende ao desenvolvimento/QA local. Para clone na VPS, configuração privada e atualização automática, seguir [deploy.md](../deploy.md); não usar compose.local.yaml em produção. Atualizar.sh/altualizar.sh e seus testes não dependem de Node instalado no host da VPS, mas exigem Python/Docker/Git e configuração inicial conforme o guia.

## Pré-requisitos

Node 22.23.3, pnpm 10.34.7 e Docker com Compose. Nenhuma conta externa é necessária para os testes sintéticos. O banco local possui nome/volume exclusivos e escuta apenas em loopback na porta 55432. Não use esse Compose na VPS.

```bash
python3 scripts/setup-local.py
corepack pnpm install --frozen-lockfile
docker compose --env-file .env.local -f compose.local.yaml up -d --wait
node --env-file=.env.local node_modules/payload/bin.js migrate
npm run dev
```

Se Corepack não estiver disponível, `npm exec --yes --package=pnpm@10.34.7 -- pnpm install --frozen-lockfile` instala usando a mesma versão. O setup local preserva um arquivo existente; `.env.local` é privado e ignorado. Não copiar seu conteúdo em issues, screenshots ou commits.

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

Instruções para a base local; B06 parcial, com calendário e quota implementados/testados, sem campanhas externas. A presença deste procedimento não comprova execução bem-sucedida; resultados e pendências no [estado atual](23-estado-atual.md) e no [histórico](19-desenvolvimento.md).

## Amostras e e-mail em desenvolvimento

`npm run test:marketing` usa banco local operacional vazio, fixtures `example.invalid` e transporte em memória; não depende de conta Brevo. Executar separadamente de qualquer QA que também crie owner. O teste verifica concorrência, confirmação/descadastro, quota e falhas; o relatório não homologa a conta externa.

O setup de um ambiente novo gera `LEAD_TOKEN_SECRET` independente de `PAYLOAD_SECRET`. Para ambiente local já existente, acrescentar uma chave aleatória privada de pelo menos 32 bytes, sem sobrescrever o segredo anterior. Manter `LEADS_ENABLED=false` e `EMAIL_TRANSPORT_ENABLED=false` até revisão dos avisos, conta/remetente e fila. A captura também exige `legalReady`; sem e-mail público, não ativá-la.

`npm run worker` processa jobs de e-mail, concorrência 1, polling de 30 segundos; `-- --once` executa um ciclo. O worker recusa ativação sem transporte configurado. Não rodar com credenciais reais nos ensaios. Envios em estado `uncertain` exigem conciliação com o provedor antes de intervenção; não os recolocar automaticamente na fila.

## Conferir descadastros e bloqueios

No painel, abra “Registrar descadastro ou bloqueio de e-mail”. Informe contato e motivo revisados; use a referência do evento quando existir. O registro impede marketing local; bounce/complaint também cancelam entregas ainda pendentes. Confirme a supressão na conta Brevo separadamente até a sincronização ser homologada. Envios já iniciados exigem conciliação e não podem ser desfeitos pelo formulário.

Alternativa do operador: `npm run suppression:apply < /caminho/privado/conferencia.json`. JSON com email, reason, source e reference conforme [contrato](06-interfaces.md); não guardar esse arquivo no projeto, histórico de comandos ou Git. Mesma referência e conteúdo repetem sem aplicar novamente; conflito é recusado. A CLI mostra somente contagens. A chave LEAD_TOKEN_SECRET precisa permanecer estável durante a operação; uma rotação exige migração planejada das identidades de deduplicação, além da revogação dos links afetados. Essa CLI não contata o provedor.

`TEST_BASE_URL=http://127.0.0.1:3001 node --env-file-if-exists=.env.local --import tsx scripts/qa-suppressions.ts` cria somente contatos sintéticos, verifica a API e renderiza inicial/erro/sucesso. Executar sequencialmente com os demais ensaios. O runtime de QA exige LEAD_TOKEN_SECRET válido; não precisa habilitar transporte nem captura para esse formulário administrativo.

## Recuperação do owner

`npm run admin:recover < /caminho/privado/recuperacao.json` é o fallback do operador, descrito no [runbook](11-operacao.md). Não usar em fixtures de outro ensaio ou em conta real sem intenção de trocar sua senha: encerra sessões anteriores. A recuperação por e-mail está explicitamente indisponível enquanto não houver fluxo homologado.

No banco loopback vazio e runtime isolado, `TEST_BASE_URL=http://127.0.0.1:3001 npm run test:admin-recovery` cria owner sintético e testa CLI, rejeição de entrada/contato desconhecido, respostas públicas, lockout, tokens e senha. Executar sequencialmente. Credenciais aleatórias passam por stdin do filho e não aparecem em argumentos/artefatos. CI está preparado para esse teste após os outros ensaios HTTP; não comprova execução no GitHub.

## Calendário promocional

Cadastre a sequência manual no Payload para a versão exata da amostra. Complete os quatro assuntos/textos e a oferta do mesmo livro antes de ativar; aumente a revisão ao editar o conteúdo. A cópia das inscrições existentes é preservada. Desativar cancela as etapas e reativar não as recria. Arquivo de amostra vinculado é preservado: para substituí-lo, envie nova mídia e altere a versão, sem reutilizar versão já solicitada.

`npm run promotions:prepare` confere até 100 etapas por execução e atualiza apenas elegibilidade local. O worker também executa essa conferência após priorizar os jobs transacionais. Etapas retidas/prontas têm nova conferência em 15 minutos, sem alterar a data original. O comando não cria campanha externa, não usa quota e não envia promoção. A aplicação do calendário ao transporte Brevo ainda está pendente.

A quota local é compartilhada por destinatário/dia UTC, com teto conservador BREVO_DAILY_QUOTA=250 e reserva BREVO_TRANSACTIONAL_RESERVE=50. Ao reduzir o teto, ajuste a reserva para um inteiro positivo que caiba nele. Promoções futuras terão de respeitar total menos reserva; confirmações/amostras podem usar o total. A reserva é gravada na transação do claim, sem estorno automático de tentativas incertas. Configuração inválida interrompe o worker. Essa política não confirma créditos, reset ou outros usos da conta Brevo.

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
| python3 scripts/qa-container.py | Imagem bibliotheon:local-b05 já construída, projeto/volumes descartáveis; não VPS |
| node --env-file-if-exists=.env.local --import tsx scripts/qa-recovery.ts | Backup/restore de laboratório com restic; ver pacote de produção |

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
