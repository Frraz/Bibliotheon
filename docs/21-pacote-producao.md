# 21 — Pacote de produção e validação local

[Índice](../README.md) · [Infraestrutura](10-infraestrutura.md) · [Operação](11-operacao.md)

Estado vigente e ordem de execução em [pendencias.md](../pendencias.md). Seções Dxx abaixo descrevem cada etapa histórica; contagens antigas não substituem as 21 migrations atuais nem comprovam imagem atual homologada.

## Estado

Em desenvolvimento e validação local. A imagem com dependências de segurança corrigidas passou em migrations de banco vazio, saúde, usuário sem root, filesystem somente leitura, DDL negado ao runtime, provisionamento/login, coleções de relacionamento privadas e jobs públicos bloqueados. Essa imagem é evidência histórica: o release atual D67 tem 21 migrations, filas/callbacks, conectores e importação limitada; exige reconstrução, banco vazio/upgrade e restore completos. O [plano de pendências](../pendencias.md) detalha os critérios. Não houve push, deploy, inventário de VPS nem backup externo. Publicação continua a cargo do proprietário, condicionada aos critérios dos documentos 10–12 e 15.

## Artefato

Node 22.23.3 Alpine e PostgreSQL 17.9 Alpine fixados por digest. Dockerfile constrói Next e empacota standalone/dependências de runtime/CLI, sem copiar ambientes, uploads ou dados de teste. A construção externa é o fluxo original; o [guia de deploy](../deploy.md) acrescenta o fluxo clone/build na VPS solicitado em 22/10, condicionado à capacidade. App usa usuário node, sem privilégios Linux adicionais. CLI de migração incorpora as migrations versionadas e só aplica as pendentes; não faz rollback destrutivo automático.

Empacotador atual inclui migrate, create-admin, recover-admin, apply-suppression, prepare-promotions, media-gc, sync-brevo-suppressions, sync-brevo-registrations, prepare-brevo-list, prepare-brevo-preferences, prepare-brevo-campaign, send-brevo-campaign, observe-brevo-campaign, replay-brevo-webhook, process-commercial, worker e worker-health. A geração local dessas entradas passou; a imagem do relatório atual precede recuperação/supressão, migração de sequências e quota compartilhada atuais. Reconstruir/testar as 21 migrations atuais em banco vazio e upgrade de revisão anterior, entradas operacionais, privacidade, worker desativado por padrão e restauração antes do release. Procedimento privado em [operação](11-operacao.md); fotografia em [estado atual](23-estado-atual.md).

Build local: `docker build -t bibliotheon:local-b05 .`. Essa tag é de teste. No fluxo registry, produção usa imagem publicada com digest real; na alternativa atualizar.sh, a ferramenta cria tag exclusiva por release e verifica o ID, conforme D46. O build não equivale a um teste de deploy.

## Configuração privada

Use [.env.production.example](../.env.production.example) como lista de campos, crie um arquivo privado fora do Git e proteja com permissão 600. Preencha domínio, porta livre confirmada no inventário, imagem imutável, segredos diferentes e URLs de banco com senhas codificadas como URL. Não executar com placeholders. Hosts de checkout vazios mantêm ofertas sem ativação.

O Compose recebe o arquivo por `--env-file /caminho/privado`; não injeta o arquivo inteiro na aplicação. App recebe só DATABASE_URL limitada e segredos necessários, sem senha de owner ou URL de migração. A manutenção usa DATABASE_MIGRATION_URL. Banco sem portas publicadas; app publica apenas em loopback para o proxy já existente.

`python3 scripts/check-compose.py --env-file /caminho/privado` verifica a estrutura sem imprimir valores. Não comprova domínio, capacidade livre, proteção administrativa ou recuperação.

O comando acima atende ao fluxo por registry/digest. No fluxo atualizar.sh, a imagem da aplicação recebe tag local exclusiva e seu ID SHA-256 é registrado/verificado pela ferramenta; o validador interno confere isolamento, URLs/papéis do banco e mídia persistente. O check-compose.py continua exigindo @sha256 e não é o validador das tags locais. Configurações/releases desse fluxo ficam fora do Git, em /etc/bibliotheon e /var/lib/bibliotheon, com permissões restritas. Há lock, checkpoint de interrupção, backup externo antes de migrations e retomada explícita; procedimento completo no guia raiz.

## Ordem para o operador após inventário e homologação

1. Conferir capacidade e proxy existentes; escolher porta livre e origem pública HTTPS.
2. Concluir configuração privada, imagem/digest e backup externo/restauração.
3. Iniciar somente db no projeto Compose bibliotheon; o volume novo cria bibliotheon_owner e bibliotheon_runtime. Runtime tem DML/uso de sequências, sem superusuário, criação de banco ou papel.
4. Executar serviço migrate no profile maintenance uma vez por release, com backup prévio; schema não é sincronizado automaticamente.
5. Provisionar owner via CLI `node cli/create-admin.js` com JSON privado por stdin; inscrição pública permanece bloqueada. Não usar argumentos com senha ou copiar o JSON em documentação.
6. Subir app com a imagem homologada e verificar saúde, acesso, conteúdo, proxy/TLS, baseline dos demais sistemas e restauração.

O serviço `worker` está preparado no perfil opcional `relationship`, sem portas, com mídia somente leitura, limite de 768 MiB e heartbeat local. Não é iniciado na base padrão. Transporte/captura continuam desativados por padrão; habilitar somente após homologação de remetente, avisos e quota. O heartbeat comprova atividade do processo/banco, não chegada de e-mail nem saúde da conta Brevo. O ensaio em container passou com fila sintética vazia, heartbeat, usuário limitado e timezone verificados; não homologa envio externo. As etapas acima não autorizam o agente a executá-las na VPS. O usuário assumiu GitHub e deploy.

## Backup e restauração

[ops/recovery.py](../ops/recovery.py) usa restic externo ao Git, configurado por RESTIC_BINARY, RESTIC_REPOSITORY e RESTIC_PASSWORD_FILE. O arquivo da chave deve ter permissão 600. Inicializar e conferir o repositório é responsabilidade do operador; o script não cria destino remoto nem contrata armazenamento. Backup operacional rejeita repositório local; `--lab` é restrito ao projeto bibliotheon-local.

Antes da captura, pare somente app/worker do Bibliotheon, mantendo db ativo. O script verifica serviços Compose, gera pg_dump consistente, copia a mídia quiescente, calcula SHA-256 e envia um arquivo com manifesto ao restic por stdin. Não grava dump em Git nem imprime nomes/conteúdo dos contatos. Temporários privados são removidos ao fim; chave permanece separada do backup. Capture em host/armazenamento temporário protegido.

Restore exige snapshot explícito completo, projeto cujo nome comece por bibliotheon-restore-, banco vazio e diretório de mídia vazio. Verifica caminhos/links/tamanhos e hashes antes de restaurar com transação única. Não sobrescreve banco existente e não inicia app, worker ou envio externo. Antes de reativar e-mail, reaplicar exclusões/supressões posteriores ao snapshot. Troca de tráfego permanece ação do operador.

Teste local: `node --env-file=.env.local --import tsx scripts/qa-recovery.ts`, com restic 0.19.1 instalado em `.local/bin/restic`. A ferramenta foi obtida da imagem oficial `restic/restic:0.19.1@sha256:136600b6ff6843d61d355f7f71f460a166429f35de6fd11b568fece3c9a4d510`, sem instalação global. O teste cria repositório criptografado temporário e banco/volume isolados, verifica estado anterior à alteração e mídia idêntica, recusa sobrescrita e remove seus recursos. [Resultado local](../artifacts/recovery/local-results.json): o relatório registra as durações medidas nesse dataset sintético. Não representa RPO/RTO da VPS.

Referências revalidadas em 21/10/2026: [restic backup](https://restic.readthedocs.io/en/stable/040_backup.html), [restic restore](https://restic.readthedocs.io/en/stable/050_restore.html), [PostgreSQL 17 pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).

## Pendências

Reconstruir imagem para o release após concluir os ajustes funcionais, configurar retenção operacional, confirmar backup remoto criptografado, RPO/RTO e baseline de VPS. A existência do Compose e o teste sintético local não tornam o lançamento pronto.


Transporte D56 tem entrada send-brevo-campaign e branch opcional do worker. BREVO_CAMPAIGN_SEND_ENABLED permanece false em app/worker; ativação real exige homologação e pipeline completo. Histórico de tentativa é gravado com quota antes do HTTP. Não promover imagem sem revalidar as quinze migrations (incluindo down guardado em laboratório), privacidade, worker desligado/ligado com rede sintética e restore. Build standalone local não substitui esses ensaios de imagem.


Observação D57 acrescenta observe-brevo-campaign e 16a migração, com BREVO_CAMPAIGN_OBSERVE_ENABLED=false em app/worker. Compose valida a chave privada se ativada; worker somente observador não exige canal de SMTP/sincronização de contatos. Empacotamento local/Compose sintético não equivalem a imagem homologada. Revalidar as dezesseis migrations em banco vazio/upgrade, runtime operacional e restauração antes do release.


D58 acrescenta replay-brevo-webhook e migrações17/18 (inbox/resultados e identidade histórica dos destinatários). BREVO_WEBHOOK_ENABLED=false por padrão; segredo Bearer e HMAC de eventos são privados/independentes, com rotação de token separada. Atualizador valida chaves quando ativado e preserva ambiente privado; não cria webhook na conta. Revalidar a imagem com as dezoito migrations de banco vazio/upgrade, CLI/replay, callback off/on sintético e recuperação. Testes standalone/Compose não substituem essa rodada nem homologação externa.


D59 acrescenta migração 19 e flag ANALYTICS_ENABLED=false em app/worker, sem novo serviço/segredo/SaaS obrigatório. Rotas de preferência, coleta e retirada são da aplicação Next. O pacote precisa de revalidação da imagem com as dezenove migrations em banco vazio/upgrade/restore; build standalone e Compose local não substituem isso. Corpo/operações analíticas não devem contaminar logs do proxy; aplicação não persiste query/IP/referer/email ou comprador no ledger de medição.


## Acréscimo comercial D61

Runtime empacota cli/process-commercial.js e inclui a migração 20. Compose exporta COMMERCIAL_EVENTS_ENABLED=false para app/worker; perfil/validador admitem worker somente comercial sem credenciais de e-mail. Esse processamento não consulta nem habilita provedores externos. Ainda é necessário validar imagem atual, upgrade, banco vazio e restauração das vinte migrações antes de release. [Guia de deploy](../deploy.md) e [runbook](11-operacao.md) estão alinhados com a flag e os limites da inbox. Nenhuma implantação remota foi executada.


## Acréscimo Hotmart D63

Endpoint no app recebe flags/conta/token por anchor exclusivo; segredo não é repassado ao worker. Validador do atualizador confere alias/token independente e rejeita Hottok no worker. Compose normalizado testado também com dólar em token sintético, preservando literal. HOTMART_WEBHOOK_ENABLED=false é padrão. Não há nova migração; evidência complementar vive no JSON existente e hashes legados são preservados.

Runtime CLI do processador é cli/process-commercial.js dentro da imagem; .release é o diretório local de empacotamento, copiado pelo Dockerfile. Guia/runbook corrigidos. Imagem atual, upgrade/banco vazio/restore e conta real ainda precisam ser validados. Não confundir build .next-qa e Compose config com imagem/deploy de produção.

## Kiwify no pacote — D64

Compose passa quatro variáveis KIWIFY_* de recepção somente ao app; padrões false/vazios. Atualizador valida conta opaca/token independente com ao menos 32 caracteres e recusa segredo no worker. Configuração Compose real/frozen exercitada com valores sintéticos incluindo dólar literal. Não implica implantação ou imagem atual homologada. [Guia do conector](integracoes/kiwify.md); revalidar imagem, migrações em banco vazio/upgrade e restore antes do release.

## Cakto no pacote — D65

Quatro variáveis CAKTO_* de recepção somente no app; padrões false/vazios. Atualizador valida alias opaco, segredo independente com ao menos 32 caracteres e ausência de segredo no worker. Compose real/frozen exercitado com dólar literal. Batch comercial usa transação nas coleções existentes; sem nova migração. [Contrato e operação](integracoes/cakto.md). Imagem atual/banco vazio/upgrade/restore e contas continuam a homologar; integração local não equivale a release de produção.

## Migração 21 e importação — D67

Pacote inclui lotes/linhas/auditoria privados e confirmação limitada para inbox. Nenhum segredo, flag ou serviço novo. Worker usa COMMERCIAL_EVENTS_ENABLED, false por padrão; queued não é aplicação. Down21 recusa registros; preservar schema/evidências em rollback de código. Imagem atual, banco vazio/upgrade/restore e latência dos limites precisam de homologação própria antes do release. [Contrato e limites](24-conciliacao.md).
