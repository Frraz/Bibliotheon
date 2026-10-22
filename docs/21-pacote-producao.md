# 21 — Pacote de produção e validação local

[Índice](../README.md) · [Infraestrutura](10-infraestrutura.md) · [Operação](11-operacao.md)

## Estado

Em desenvolvimento e validação local. A imagem com dependências de segurança corrigidas passou em migrations de banco vazio, saúde, usuário sem root, filesystem somente leitura, DDL negado ao runtime, provisionamento/login, coleções de relacionamento privadas e jobs públicos bloqueados. Alterações posteriores de consentimento, apresentação e worker exigem reconstrução e nova rodada. Não houve push, deploy, inventário de VPS nem backup externo. Publicação continua a cargo do proprietário, condicionada aos critérios dos documentos 10–12 e 15.

## Artefato

Node 22.23.3 Alpine e PostgreSQL 17.9 Alpine fixados por digest. Dockerfile constrói Next e empacota standalone/dependências de runtime/CLI, sem copiar ambientes, uploads ou dados de teste. A construção externa é o fluxo original; o [guia de deploy](../deploy.md) acrescenta o fluxo clone/build na VPS solicitado em 22/10, condicionado à capacidade. App usa usuário node, sem privilégios Linux adicionais. CLI de migração incorpora as migrations versionadas e só aplica as pendentes; não faz rollback destrutivo automático.

Empacotador atual inclui migrate, create-admin, recover-admin, apply-suppression, prepare-promotions, media-gc, sync-brevo-suppressions, sync-brevo-registrations, prepare-brevo-list, prepare-brevo-preferences, prepare-brevo-campaign, worker e worker-health. A geração local dessas entradas passou; a imagem do relatório atual precede recuperação/supressão, migração de sequências e quota compartilhada atuais. Reconstruir/testar as quatorze migrations de banco vazio e revisão anterior, entradas operacionais, privacidade, worker desativado por padrão e restauração antes do release. Procedimento privado em [operação](11-operacao.md); fotografia em [estado atual](23-estado-atual.md).

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
