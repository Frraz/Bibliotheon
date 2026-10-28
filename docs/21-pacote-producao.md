# 21 — Pacote de produção e validação local

[Índice](../README.md) · [Infraestrutura](10-infraestrutura.md) · [Operação](11-operacao.md)

**Revisão documental D129 (28/10/2026):** código e imagem permanecem na revisão D127: 35 migrations, 314 unitários, 62 operacionais e 16 suítes HTTP aprovados localmente. H05/B19/B20 aceitos localmente em D126. P07 continua aberto: [auditoria D128](../artifacts/documentation/p07-closure-audit-d128.json) identificou 12 coleções comerciais sem retenção geral e limites na exportação financeira. Desenvolvimento de retenção aguarda política de guarda e revisão por finalidade; contas, CI e segurança/VPS reais continuam pendentes. Backup opcional; nenhuma publicação ou alteração de produção. [Imagem D127](../artifacts/container/d127-results.json) e [mitigação de deepmerge](../artifacts/security/d127-deepmerge-mitigation.json) preservadas; esta revisão não reexecutou testes da aplicação.

Estado vigente e ordem de execução em [pendencias.md](../pendencias.md). Seções Dxx abaixo descrevem cada etapa histórica; contagens antigas não substituem as 35 migrations atuais nem comprovam release completo homologado.

## Estado

Em fechamento e validação local. D127 renovou imagem, migrations e HTTP, incorporando D123/D125/D126 e mitigação de deepmerge. P07 ainda exige conclusão; alterações posteriores reabrem somente os gates afetados. Não houve publicação. D114 permanece como restore físico histórico do host, sem afirmar recuperação da imagem atual. A capacidade de recuperação é opcional; P07, H01/H02/H06 e configuração do host continuam conforme pendências. GitHub/deploy ficam com o proprietário.

## Artefato

Node 22.23.3 Alpine e PostgreSQL 17.9 Alpine fixados por digest. Dockerfile constrói Next e empacota standalone/dependências de runtime/CLI, sem copiar ambientes, uploads ou dados de teste. A construção externa é o fluxo original; o [guia de deploy](../deploy.md) acrescenta o fluxo clone/build na VPS solicitado em 22/10, condicionado à capacidade. App usa usuário node, sem privilégios Linux adicionais. CLI de migração incorpora as migrations versionadas e só aplica as pendentes; não faz rollback destrutivo automático.

Empacotador atual inclui migrate, create-admin, recover-admin, apply-suppression, prepare-promotions, media-gc, sync-brevo-suppressions, sync-brevo-registrations, prepare-brevo-list, prepare-brevo-preferences, prepare-brevo-campaign, send-brevo-campaign, observe-brevo-campaign, replay-brevo-webhook, process-commercial, analytics-retention, privacy-retention, privacy-inventory, privacy-recovery, worker e worker-health. D107 verificou na imagem o bundle de privacidade v2, 32 migrations em banco vazio e upgrade de revisão anterior, recortes de permissões HTTP e worker de retenção com provedores desligados. D108 completou o ensaio local de restore físico/replay v2 nessa imagem. Completar bateria funcional integral, destino externo/RPO/RTO e demais gates do release. Procedimento privado em [operação](11-operacao.md); fotografia em [estado atual](23-estado-atual.md).

Última imagem ensaiada: `bibliotheon:local-d127-secured`, ID `sha256:2239f2200be691eb71b9d7bd42569daabb157c98f32d54a620957860e57de86e`. Vazio e upgrade real 32→35, com prova do patch de deepmerge nos entrypoints empacotados. [Evidência D127](../artifacts/container/d127-results.json). O ID local não comprova publicação ou deploy; mudanças posteriores exigem renovar o recorte afetado.

## Configuração privada

Use [.env.production.example](../.env.production.example) como lista de campos, crie um arquivo privado fora do Git e proteja com permissão 600. Preencha domínio, porta livre confirmada no inventário, imagem imutável, segredos diferentes e URLs de banco com senhas codificadas como URL. Não executar com placeholders. Hosts de checkout vazios mantêm ofertas sem ativação.

O Compose recebe o arquivo por `--env-file /caminho/privado`; não injeta o arquivo inteiro na aplicação. App recebe só DATABASE_URL limitada e segredos necessários, sem senha de owner ou URL de migração. A manutenção usa DATABASE_MIGRATION_URL. Banco sem portas publicadas; app publica apenas em loopback para o proxy já existente.

`python3 scripts/check-compose.py --env-file /caminho/privado` verifica a estrutura sem imprimir valores. Não comprova domínio, capacidade livre, proteção administrativa ou recuperação.

O comando acima atende ao fluxo por registry/digest. No fluxo atualizar.sh, a imagem da aplicação recebe tag local exclusiva e seu ID SHA-256 é registrado/verificado pela ferramenta; o validador interno confere isolamento, URLs/papéis do banco e mídia persistente. O check-compose.py continua exigindo @sha256 e não é o validador das tags locais. Configurações/releases desse fluxo ficam fora do Git, em /etc/bibliotheon e /var/lib/bibliotheon, com permissões restritas. Há lock, checkpoint de interrupção e retomada explícita. Backup externo é exigido por padrão antes de migrations, mas pode ser pulado intencionalmente com `--sem-backup`; veja o guia raiz para efeitos e limites.

## Ordem para o operador após inventário e homologação

1. Conferir capacidade e proxy existentes; escolher porta livre e origem pública HTTPS.
2. Concluir configuração privada e imagem/digest. Decidir se realizará backup/restauração externa; sem backup não há ponto recente de recuperação.
3. Iniciar somente db no projeto Compose bibliotheon; o volume novo cria bibliotheon_owner e bibliotheon_runtime. Runtime tem DML/uso de sequências, sem superusuário, criação de banco ou papel.
4. Executar serviço migrate no profile maintenance uma vez por release, com backup prévio se adotado; schema não é sincronizado automaticamente.
5. Provisionar owner via CLI `node cli/create-admin.js` com JSON privado por stdin; inscrição pública permanece bloqueada. Não usar argumentos com senha ou copiar o JSON em documentação.
6. Subir app com a imagem homologada e verificar saúde, acesso, conteúdo, proxy/TLS, baseline dos demais sistemas e restauração se a capacidade de recuperação for adotada.

O serviço `worker` está preparado no perfil opcional `relationship`, sem portas, com mídia somente leitura, limite de 768 MiB e heartbeat local. Não é iniciado na base padrão. Transporte/captura continuam desativados por padrão; habilitar somente após homologação de remetente, avisos e quota. O heartbeat comprova atividade do processo, inclusive nos ciclos sem retenção diária a executar; saúde do banco deve ser conferida separadamente. Não comprova chegada de e-mail nem saúde da conta Brevo. O ensaio em container passou com fila sintética vazia, heartbeat, usuário limitado e timezone verificados; não homologa envio externo. As etapas acima não autorizam o agente a executá-las na VPS. O usuário assumiu GitHub e deploy.

## Backup e restauração

[ops/recovery.py](../ops/recovery.py) usa restic externo ao Git, configurado por RESTIC_BINARY, RESTIC_REPOSITORY e RESTIC_PASSWORD_FILE. O arquivo da chave deve ter permissão 600. Inicializar e conferir o repositório é responsabilidade do operador; o script não cria destino remoto nem contrata armazenamento. Backup operacional rejeita repositório local; `--lab` é restrito ao projeto bibliotheon-local. Backup/restore são opcionais para publicar: `--sem-backup` dispensa captura e configuração `backup_env` do deploy, deixando o release sem ponto recente de recuperação.

Antes da captura, pare somente app/worker do Bibliotheon, mantendo db ativo. O script verifica serviços Compose, gera pg_dump consistente, copia a mídia quiescente, calcula SHA-256 e envia um arquivo com manifesto ao restic por stdin. Não grava dump em Git nem imprime nomes/conteúdo dos contatos. Temporários privados são removidos ao fim; chave permanece separada do backup. Capture em host/armazenamento temporário protegido.

Restore exige snapshot explícito completo, projeto cujo nome comece por bibliotheon-restore-, banco vazio e diretório de mídia vazio. Verifica caminhos/links/tamanhos e hashes antes de restaurar com transação única. Não sobrescreve banco existente e não inicia app, worker ou envio externo. Antes de reativar e-mail, reaplicar exclusões/supressões posteriores ao snapshot pelo manifesto privado atual, conforme D104 e runbook 11. O relatório informa capturedAt e privacyReplayRequired; isso não executa a reaplicação automaticamente. Troca de tráfego permanece ação do operador.

Teste local registrado em D106: `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:recovery`, com restic 0.19.1. O teste criou repositório criptografado temporário e banco/volume isolados; essa evidência histórica cobriu 32 migrations e manifesto v2, não é o estado atual. D114 restaurou 34 migrations, mídia e nove entradas v4 no host; [resultado D114](../artifacts/recovery/d114-results.json). Nenhum dos ensaios representa RPO/RTO da VPS ou recuperação externa homologada.

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
