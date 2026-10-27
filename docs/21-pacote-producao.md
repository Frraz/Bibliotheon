# 21 — Pacote de produção e validação local

[Índice](../README.md) · [Infraestrutura](10-infraestrutura.md) · [Operação](11-operacao.md)

**Revisão D114:** D114 reconstrói fatos temáticos legados somente com evento nativo coincidente, sem renovar prazo nem inventar consentimento. A exportação recusa lacunas sem cobertura verificável e preserva finalidades posteriores. Schema mantém 34 migrations; P07 e gates finais continuam abertos. Flags desligadas e produção não alterada.

Estado vigente e ordem de execução em [pendencias.md](../pendencias.md). Seções Dxx abaixo descrevem cada etapa histórica; contagens antigas não substituem as 34 migrations atuais nem comprovam imagem atual homologada.

## Estado

Em desenvolvimento e validação local. A imagem com dependências de segurança corrigidas passou em migrations de banco vazio, saúde, usuário sem root, filesystem somente leitura, DDL negado ao runtime, provisionamento/login, coleções de relacionamento privadas e jobs públicos bloqueados. As imagens anteriores são históricas. D107 construiu/testou a imagem então atual com as 32 migrations em banco vazio e upgrade real, incluindo retenção analítica, auditoria de pedidos, tombstones e envelope da inbox anulável; D108 comprovou restore físico e replay v2 nessa imagem; ainda exige bateria funcional integral e homologação externa da recuperação. D104 não adiciona migration; revalidar o runtime atual que inclui retenção e CLI de reaplicação de privacidade. O [plano de pendências](../pendencias.md) detalha os critérios. Não houve push, deploy, inventário de VPS nem backup externo. Publicação continua a cargo do proprietário, condicionada aos critérios dos documentos 10–12 e 15.

## Artefato

Node 22.23.3 Alpine e PostgreSQL 17.9 Alpine fixados por digest. Dockerfile constrói Next e empacota standalone/dependências de runtime/CLI, sem copiar ambientes, uploads ou dados de teste. A construção externa é o fluxo original; o [guia de deploy](../deploy.md) acrescenta o fluxo clone/build na VPS solicitado em 22/10, condicionado à capacidade. App usa usuário node, sem privilégios Linux adicionais. CLI de migração incorpora as migrations versionadas e só aplica as pendentes; não faz rollback destrutivo automático.

Empacotador atual inclui migrate, create-admin, recover-admin, apply-suppression, prepare-promotions, media-gc, sync-brevo-suppressions, sync-brevo-registrations, prepare-brevo-list, prepare-brevo-preferences, prepare-brevo-campaign, send-brevo-campaign, observe-brevo-campaign, replay-brevo-webhook, process-commercial, analytics-retention, privacy-retention, privacy-inventory, privacy-recovery, worker e worker-health. D107 verificou na imagem o bundle de privacidade v2, 32 migrations em banco vazio e upgrade de revisão anterior, recortes de permissões HTTP e worker de retenção com provedores desligados. D108 completou o ensaio local de restore físico/replay v2 nessa imagem. Completar bateria funcional integral, destino externo/RPO/RTO e demais gates do release. Procedimento privado em [operação](11-operacao.md); fotografia em [estado atual](23-estado-atual.md).

Build local atual: `docker build -t bibliotheon:local-d107 .`. A imagem bibliotheon:local-b05 é preservada como origem histórica do ensaio de upgrade. Essa tag é de teste. No fluxo registry, produção usa imagem publicada com digest real; na alternativa atualizar.sh, a ferramenta cria tag exclusiva por release e verifica o ID, conforme D46. O build não equivale a um teste de deploy.

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

O serviço `worker` está preparado no perfil opcional `relationship`, sem portas, com mídia somente leitura, limite de 768 MiB e heartbeat local. Não é iniciado na base padrão. Transporte/captura continuam desativados por padrão; habilitar somente após homologação de remetente, avisos e quota. O heartbeat comprova atividade do processo, inclusive nos ciclos sem retenção diária a executar; saúde do banco deve ser conferida separadamente. Não comprova chegada de e-mail nem saúde da conta Brevo. O ensaio em container passou com fila sintética vazia, heartbeat, usuário limitado e timezone verificados; não homologa envio externo. As etapas acima não autorizam o agente a executá-las na VPS. O usuário assumiu GitHub e deploy.

## Backup e restauração

[ops/recovery.py](../ops/recovery.py) usa restic externo ao Git, configurado por RESTIC_BINARY, RESTIC_REPOSITORY e RESTIC_PASSWORD_FILE. O arquivo da chave deve ter permissão 600. Inicializar e conferir o repositório é responsabilidade do operador; o script não cria destino remoto nem contrata armazenamento. Backup operacional rejeita repositório local; `--lab` é restrito ao projeto bibliotheon-local.

Antes da captura, pare somente app/worker do Bibliotheon, mantendo db ativo. O script verifica serviços Compose, gera pg_dump consistente, copia a mídia quiescente, calcula SHA-256 e envia um arquivo com manifesto ao restic por stdin. Não grava dump em Git nem imprime nomes/conteúdo dos contatos. Temporários privados são removidos ao fim; chave permanece separada do backup. Capture em host/armazenamento temporário protegido.

Restore exige snapshot explícito completo, projeto cujo nome comece por bibliotheon-restore-, banco vazio e diretório de mídia vazio. Verifica caminhos/links/tamanhos e hashes antes de restaurar com transação única. Não sobrescreve banco existente e não inicia app, worker ou envio externo. Antes de reativar e-mail, reaplicar exclusões/supressões posteriores ao snapshot pelo manifesto privado atual, conforme D104 e runbook 11. O relatório informa capturedAt e privacyReplayRequired; isso não executa a reaplicação automaticamente. Troca de tráfego permanece ação do operador.

Teste local atual: `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:recovery`, com restic 0.19.1 instalado em `.local/bin/restic`. A ferramenta foi obtida da imagem oficial `restic/restic:0.19.1@sha256:136600b6ff6843d61d355f7f71f460a166429f35de6fd11b568fece3c9a4d510`, sem instalação global. O teste cria repositório criptografado temporário e banco/volume isolados, verifica estado anterior à alteração e mídia idêntica, recusa sobrescrita e remove seus recursos. [Resultado D106 atual](../artifacts/recovery/d106-results.json): 32 migrations, capa e amostra privada idênticas, ponto anterior às decisões, exportação/replay v2 com pending, preview e repetição verificados, app/worker desligados. O [resultado anterior](../artifacts/recovery/local-results.json) é histórico. A porta do destino é aleatória e apenas loopback; o relatório registra as durações medidas nesse dataset sintético. Não representa RPO/RTO da VPS.

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


## D71 — Integridade SQL de identidades do catálogo — 24/10/2026

Migração 22, [offer_identity_guard](../migrations/20261024_231500_offer_identity_guard.ts), aplicada somente no PostgreSQL local. Trigger BEFORE INSERT/UPDATE/DELETE e índice por provedor/conta/produto reforçam o guard da API D70: impedem novas duplicatas (null/vazio equivalentes), associação do produto a outro livro e alteração/exclusão de identidade com transação histórica. Inclui ofertas inativas. Preserva registros legados e seus metadados; não escolhe livro/oferta automaticamente nem altera fatos.

[Evidência SQL local](../artifacts/catalog-identity-db/local-results.json): seis grupos, papel runtime efêmero sem DDL, concorrência observada em pg_locks, API versus SQL, commit/rollback, lote de INSERT revertido, isolamento de contas/provedores, compatibilidade das chaves de lock e upgrade sem alteração de registros legados. Comando: BIBLIOTHEON_SYNTHETIC_TESTS=true npm run test:catalog-identity-db; incluído no runner sequencial de CI preparado. Sem novo serviço/flag/coleção ou campos/tipos Payload. Produção e P01 continuam pendentes até a resolução histórica auditada e homologação do release.

## Decisões históricas — D72

Migração 23 acrescenta catalog-resolutions, vínculo opcional nos novos fatos e constraints/triggers. Não preenche decisões antigas por suposição. O release inclui duas novas rotas privadas owner e resolvedor compartilhado por inbox/CSV. Configuração e flags existentes permanecem; não habilitar operação real com base nos testes locais.

O hash de planos passa a considerar a decisão vigente. Lotes ready criados por versão anterior precisam de revalidação e podem exigir novo estágio após stale; não reaproveitar hash como autorização nem editar plano/fatos manualmente. Lotes já queued/confirmed conservam sua evidência; aplicação continua separada. Código anterior à D72 ignora decisões: não presumir rollback compatível apenas porque o banco aceita suas queries. Preferir correção progressiva; down recusa evidência existente e não deve ser forçado apagando registros. Imagem final, banco vazio/upgrade/restore e homologação externa continuam pendentes.


## Revisão de colisões — D73

Migração 24 acrescenta índice sobre o envelope interno normalizado e marca revisão em projeções relacionadas às variantes de colisão; não apaga/reescreve valores ou fontes. A prévia financeira é READ ONLY, sem endpoint de confirmação ou decisão financeira durável nesta etapa. Revalidar imagem/upgrade/banco vazio/restore com todas as migrations vigentes do release. Down remove apenas o índice novo e não inventa a flag anterior. Código anterior à D73 perde a proteção dos IDs secundários: compatibilidade de rollback exige análise de comportamento, além do schema. Não limpar flags para contornar a quarentena.

## Decisões/aplicações financeiras — D74

Migração 25 adiciona provas imutáveis, referências efetivas e guards de continuidade/referência; down só é permitido sem decisões/aplicações. O ensaio local down/up em transação revertida não autoriza apagar trilhas em produção. Código anterior à D74 não interpreta escolhas financeiras e cobertura vigente: compatibilidade de rollback exige análise do comportamento e plano de recuperação, além de schema compatível. Não trocar somente a imagem para contornar uma revisão.

Imagem atualizada, banco vazio/upgrade, runtime sem DDL e restore das migrations vigentes continuam em H03/H04. Testes PostgreSQL/HTTP locais não substituem esses ensaios. Incluir decisões/aplicações e referências originais/efetivas no backup e na integridade do restore; não executar helpers de fixture no release. [Contrato](24-conciliacao.md) e [pendências](../pendencias.md).

## Evidência complementar — D75

Migração 26 cria prova canônica imutável e índice GIN de IDs relacionados, com downgrade recusado se houver prova ou decisão que a utiliza. Código anterior à D75 não interpreta fontes de relatório e pode ignorar sua quarentena: rollback precisa preservar schema/provas e ser analisado também pelo comportamento. Banco vazio/upgrade/restore e runtime sem DDL das migrations vigentes ainda precisam ser homologados em H03/H04; build Next local não os substitui.

## Interfaces owner — D79–D80

As views `/admin/financial-ledger` e `/admin/commercial-imports` fazem parte da aplicação Payload/Next, com import map gerado; não exigem migration nova, segredo, flag, serviço ou SaaS. O inventário continua em 28 migrations. D80 validou build standalone `.next-qa` e jornadas sintéticas de upload/prévia/stage/commit/retomada; isso não substitui a imagem final, banco vazio/upgrade, runtime sem DDL ou restore exigidos em H03/H04. Preservar provas/lotes/decisões/ledger e suas referências no ensaio da versão final. [Resultados locais](../artifacts/qa-commercial-imports/results.json).

## Registros financeiros — D81

A view `/admin/financial-records` e a correção de mapeamento campaignId → campaign usam as coleções/rotas D78, sem migration ou variável adicional. O inventário permanece em 28 migrations. Revalidar a imagem final também com registro/correção de custo vinculado à campanha e caixa, preservação da linha original e runtime sem DDL; build/browser locais não substituem H03/H04. Nenhum backfill de registros anteriores ou implantação foi executado nesta fase.

D84 adiciona correções de cobertura/coortes e nova suíte financial-coverage no runner de integração; 28 migrations sem alteração. Não foi reconstruída/homologada a imagem de produção nem executado CI no GitHub. Revalidar release completo, banco vazio/upgrade/restore e H01–H06 antes de publicar.

D85 adiciona resposta/UI de detalhamentos e sucesso registrado, além da suíte financial-dimensions no runner sequencial. P04 possui aceite local, sem migration/schema/flag nova e com 28 migrations. Imagem, banco vazio/upgrade/restore e CI/GitHub ainda exigem homologação do release atual; não houve VPS ou operação externa.

D86 acrescenta testes de estados/operação e aceite local P03/P05, sem mudar aplicação/schema. Build D85 reutilizado com hashes conferidas, 28 migrations. Matriz de estados entra no runner sequencial/CI preparado; GitHub não foi executado. Imagem, banco vazio/upgrade/restore e H01–H06 continuam pendentes para o release atual.

## D104 — CLI privada de replay no pacote

`cli/privacy-recovery.js` acompanha o runtime empacotado para export/preview/apply do manifesto de decisões. Não precisa de nova migration ou chave: usa a chave privada de links estável, com domínio HMAC separado. Toda flag operacional deve permanecer falsa no ambiente de replay e app/worker ficam parados. O comando exige owner do banco restaurado e metadado real do snapshot, mantém decisões incertas em quarentena e retorna `releaseAuthorized=false`. Imagem atualizada, dump físico, guarda externa mais recente do manifesto e RPO/RTO continuam a homologar em H03/H04; teste sintético/CLI não conclui esses gates.

## D105 — Manifesto v2 no runtime

CLI de recuperação exporta v2 com pending/completed e mantém leitura de arquivos v1 concluídos. Pending não expira até resolução; o relatório indica versão e cobertura, sem autorizar release. Runtime também bloqueia novas emissões/cadastros enquanto a auditoria de exclusão/correção está pending. Não há migration; permanecem 32. Revalidar imagem/filas/API e guarda externa do manifesto atual com restore físico antes do release; fixtures não comprovam esses gates.

## D106 — Restore físico local e privacidade — 26/10/2026

D106 validou backup criptografado e restore físico local das 32 migrations, com mídia íntegra e replay do manifesto v2 separado do snapshot; completed é reaplicado e pending permanece pendente. A telemetria automática do Payload foi desativada após a barreira de rede detectar sua tentativa. Imagem atual, guarda externa do manifesto/backup, RPO/RTO reais e release continuam pendentes. [Evidência D106](../artifacts/recovery/d106-results.json) Fonte, dump e destino usam somente fixtures sintéticas. Preview não escreve; repetição mantém prazos; amostra independente é preservada, bounce cancela pendência e identidade sem decisão não é alterada. Flags seguem falsas; sem conta real, VPS ou deploy.

## D107 — Imagem atual e upgrade local — 26/10/2026

D107 construiu a imagem local atual e verificou 32 migrations em banco vazio e upgrade real de 6 para 32, preservando contato e owner sintéticos. Saúde, HTTP interno, ACL, runtime sem root/read-only/DDL, CLIs de privacidade e worker de retenção passaram em rede Docker internal, sem saída para provedores. Corrigidos o encerramento das CLIs de inventário/retenção após a limpeza do Payload e a renovação do heartbeat no ciclo ocioso do worker de retenção. A imagem não foi publicada. Bateria funcional integral do release, restore físico nesta imagem, destino externo/RPO/RTO, contas e VPS continuam pendentes. [Evidência D107](../artifacts/container/d107-results.json). As sondagens HTTP rodam no loopback do container; não homologam proxy, TLS ou acesso da VPS. Replay v2 na imagem usa manifesto vazio; decisões reais de fixtures pós-snapshot ainda exigem o ensaio físico nessa imagem.

## D108 — Restore físico com a imagem atual — 26/10/2026

D108 aprovou restore físico com a imagem D107: 32 migrations, mídia íntegra, seis decisões de privacidade posteriores ao snapshot e replay v2 dentro da imagem. Preview, exclusão/correção, pending, supressão/bounce e repetição sem renovar prazos foram verificados. A aplicação só iniciou depois do replay, com credencial de banco separada e limitada: saúde/catálogo/capa responderam 200, contatos privados 403 e amostra privada na rota pública 404. Rede interna sem portas publicadas; transportes e worker desligados. Destino externo, guarda atual do manifesto, RPO/RTO reais, bateria integral e homologações continuam pendentes. [Evidência D108](../artifacts/recovery/d108-results.json). Não houve nova migration, rebuild, dado real, conta externa, VPS ou deploy; identidade sem decisão e entregas incertas foram preservadas.

## D109 — Retenção de estado promocional — 26/10/2026

D109 implementa retenção local de estado promocional para contatos globalmente descadastrados há pelo menos 30 dias: remove assinaturas encerradas e calendários cancelados com etapas antigas, sem lote. Preserva identidade, amostras/outbox, consentimento, auditoria e supressão com o prazo original. Não executa exclusão de identidade nem forja pedido owner. Impedimentos de privacidade, provedor, envio incerto, vínculo cruzado e manifestos compartilhados/JSON preservam os registros. Preview é padrão; apply revalida sob locks e é atômico por contato. P07 continua parcial para identidade, demais finalidades e dados compartilhados. A imagem/restore D107–D108 são evidências da revisão anterior, não incluem esta rotina. [Oito grupos PostgreSQL sintéticos](../artifacts/privacy-retention/d109-results.json). Sem migration, chamada externa, dado real, nova imagem, VPS ou deploy.

## D110 — Retenção de identidade e recuperação — 26/10/2026

Release vigente exige 33 migrations e runtime com retenção automática/replay v3. D110 prova restore físico host das 33 migrations com mídia íntegra e expurgo reaplicado; não substitui a imagem/upgrade/HTTP/worker finais H03/H04. Para ensaio de imagem, configurar BIBLIOTHEON_QA_PHASE/BIBLIOTHEON_QA_IMAGE e o baseline correspondente em BIBLIOTHEON_RECOVERY_BASELINE; não usar a imagem D107 para certificar o schema novo. Manter manifesto externo atual, chaves estáveis e transportes desligados até conciliação; RPO/RTO externos ainda pendentes.

## D111 — Operações em lote e diagnóstico PostgreSQL — 26/10/2026

A revisão D111 requer lockfile e patch atualizado do Payload, além das 33 migrations. Revalidar imagem final/upgrade/restore e bateria funcional H03/H04 após esse patch; D107/D108 permanecem fotografias anteriores. Build local do host e teste PostgreSQL não equivalem ao aceite da imagem/runtime de produção.

## D112 — Descadastro e retenção por assunto — 26/10/2026

Release vigente exige 34 migrations e runtime que guarda retirada temática/consulta na confirmação e reaplica manifesto v4. H03/H04 devem reconstruir e testar imagem/upgrade/restore/HTTP/worker da revisão final; a imagem D107/restore D108 não incluem D110–D112. Ensaio físico host não autoriza produção nem substitui guarda externa atual das decisões e chaves.

## D113 — Margem e acompanhamento do prazo — 26/10/2026

Release final precisa das CLIs/worker novos e da política de 28 dias, mantendo 34 migrations. H03 deve repetir saúde de retenção e seus modos de falha na imagem final; H06 precisa homologar monitoramento/ação quando last success exceder 25 horas ou houver assinaturas a revisar. Oito cenários com CLIs montadas sobre imagem antiga são evidência funcional limitada, não novo aceite de imagem. Restore D112 é anterior a esta revisão do worker e deve ser revalidado no gate final.

## D114 — Legado temático verificável — 26/10/2026

Release final deve incluir verificação/preenchimento legado, novo relatório e exportação que recusa lacunas. Mantém 34 migrations e contrato v4. D114 aprova restore físico host derivando fato nativo sem marcador na fonte, mas imagem/upgrade/HTTP/worker finais continuam H03/H04. Guardar manifesto completo/atual fora do backup, preservar chaves e conciliar desconhecidos antes de liberar operação; não encobrir falha de exportação com arquivo antigo.
