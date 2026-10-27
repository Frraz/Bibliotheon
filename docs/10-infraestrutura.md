# 10 — Infraestrutura e implantação planejada

[Índice](../README.md) · [Operação](11-operacao.md)

**Revisão D114:** D114 reconstrói fatos temáticos legados somente com evento nativo coincidente, sem renovar prazo nem inventar consentimento. A exportação recusa lacunas sem cobertura verificável e preserva finalidades posteriores. Schema mantém 34 migrations; P07 e gates finais continuam abertos. Flags desligadas e produção não alterada.

Dockerfile, Compose e recuperação já possuem implementação/ensaios locais, detalhados no [pacote de produção](21-pacote-producao.md). D107 verificou localmente a imagem com as 32 migrations e CLIs atuais; D108 comprovou restore físico/replay nessa imagem e retomada HTTP limitada. Ainda exige bateria integral de retenção, inbox/conectores/conciliação/ledger e interfaces presentes; os limites abaixo são plano de implantação, não recursos livres comprovados. Nenhuma VPS foi acessada.

## Inventário obrigatório da VPS compartilhada

A VPS não foi acessada nesta entrega. Antes de preparar deploy, registrar versão do Ubuntu, arquitetura, Docker/Compose, RAM/disco livres, uso de CPU, serviços, containers, portas, firewall e proxy. Exemplos de inspeção futura: `cat /etc/os-release`, `uname -m`, `free -h`, `df -h`, `docker ps`, `docker compose version`, `ss -ltn`. Não publicar envs, secrets ou saída completa de inspect.

Registrar hosts já atendidos, dono de portas 80/443, mecanismo de TLS e backup existente. Não substituir proxy, regras de firewall ou redes compartilhadas. Se o proxy está no host, publicar app somente em loopback numa porta livre identificada no inventário; se em container, usar rede externa específica para app/proxy. Banco e worker nunca entram na rede pública do proxy.

Sem proxy existente, instalar Caddy em etapa própria do deploy, após confirmar 80/443 livres e DNS. Caddy não é requisito para substituir Nginx/Traefik já instalado.

## Topologia Docker Compose

Projeto Compose `bibliotheon`, redes e volumes com nomes exclusivos. Serviços: `app`, `worker`, `db`; proxy opcional. App/worker usam mesma imagem imutável. `db` sem `ports`, volume próprio e usuário de privilégio mínimo; app não usa superusuário. Migrations usam credencial segregada quando possível.

| Serviço | Limite inicial planejado | Observação |
|---|---|---|
| App | 1536 MiB, 0,75 CPU | Renderização/cache/uploads limitados |
| Worker | 512 MiB, 0,25 CPU | Concorrência 1 |
| PostgreSQL | 1024 MiB, 0,50 CPU | Pool total app/worker ≤15 conexões inicialmente |

Limites são orçamento inicial, não benchmark nem reserva garantida. Implantar somente se inventário permitir pelo menos 4 GiB disponíveis e margem para serviços existentes. Se não houver capacidade, reduzir cargas/concorrência após teste ou planejar outra infraestrutura; não derrubar serviços existentes. Reservar armazenamento local até 20 GiB inicialmente e monitorar crescimento, sem pressupor disco livre.

Healthchecks, restart policy, usuário não root no app, filesystem somente leitura quando compatível e tmpfs para temporários. Não montar Docker socket. Volumes: banco, uploads e cache quando necessário. Logs com rotação (10 MiB × 3 por serviço, como ponto inicial).

## Configuração

| Chave lógica | Finalidade |
|---|---|
| PUBLIC_SITE_URL | Origem pública HTTPS, sem segredo |
| DATABASE_URL | Credencial de runtime, segredo |
| PAYLOAD_SECRET | Autenticação Payload, segredo estável |
| BREVO_API_KEY / EMAIL_FROM | Transporte e remetente validado |
| HOTMART_HOTTOK | Verificação Hotmart |
| CAKTO_WEBHOOK_SECRET | Verificação Cakto conforme contrato homologado |
| Kiwify auth config | KIWIFY_WEBHOOK_ENABLED, KIWIFY_ACCOUNT_KEY, KIWIFY_WEBHOOK_TOKEN e rotação opcional; código D64 local, ativação depende de homologação |
| TOKEN_SIGNING_SECRET | Tokens de download/preferências, separado do admin |
| BACKUP_DESTINATION / BACKUP_KEY | Destino externo e criptografia, fora da aplicação |

Arquivo real de ambiente fora do Git, permissão restrita. Futuro `.env.example` só com nomes e placeholders. Nenhum segredo `NEXT_PUBLIC_*`. Startup valida campos necessários à funcionalidade habilitada; conector não configurado pode ficar desabilitado sem impedir catálogo.

## Deploy e migrações

Fluxo original: CI ou máquina de desenvolvimento gera imagem compatível com arquitetura da VPS. Em 22/10/2026 o proprietário solicitou também clone/pull/build na própria VPS, documentado em [deploy](../deploy.md) e D46. Esse fluxo exige inventário, margem de recursos e janela monitorada; usa tag local exclusiva e verifica ID da imagem, sem registry obrigatório. O fluxo por registry/digest continua disponível para host sem margem. Artefato inclui código e dependências fixadas, sem dados/credenciais. Testes e migrations devem ser verificados em banco descartável antes da release.

Produção usa alterações aditivas e sequência expandir → migrar dados → mudar código → remover em release posterior. Não executar alteração destrutiva automática. Backup antes de migrar; rollback de código não reverte schema. Deploy completo e critérios de interrupção em [operação](11-operacao.md).

## Backup e continuidade

Alvo inicial: RPO ≤24h, RTO ≤4h, a comprovar em restauração. Diariamente gerar dump consistente PostgreSQL e cópia dos uploads com manifesto de versão; criptografar e enviar para armazenamento fora da VPS. Usar restic como ferramenta prevista, com backend suportado escolhido no B05 conforme conta e custo. Não chamar volume local ou snapshot no mesmo servidor de backup externo.

Retenção inicial: 7 diários, 4 semanais, 3 mensais; aplicar ciclo de exclusão conforme privacidade. Guardar chave de recuperação separada, fora da VPS e do repositório. Confirmar sucesso remoto e integridade; restauração mensal em ambiente isolado. Objetos versionados de mídia evitam troca durante backup; suspender alterações de uploads durante a captura caso necessário.

O destino externo real é dependência de implantação, não placeholder a ignorar. Falta de backup testado impede marcar produção pronta. Operação permanece local até existir capacidade, domínio e recuperação validados.

## D106 — Restore físico local e privacidade — 26/10/2026

D106 validou backup criptografado e restore físico local das 32 migrations, com mídia íntegra e replay do manifesto v2 separado do snapshot; completed é reaplicado e pending permanece pendente. A telemetria automática do Payload foi desativada após a barreira de rede detectar sua tentativa. Imagem atual, guarda externa do manifesto/backup, RPO/RTO reais e release continuam pendentes. [Evidência D106](../artifacts/recovery/d106-results.json) Fonte, dump e destino usam somente fixtures sintéticas. Preview não escreve; repetição mantém prazos; amostra independente é preservada, bounce cancela pendência e identidade sem decisão não é alterada. Flags seguem falsas; sem conta real, VPS ou deploy.

## D107 — Imagem atual e upgrade local — 26/10/2026

D107 construiu a imagem local atual e verificou 32 migrations em banco vazio e upgrade real de 6 para 32, preservando contato e owner sintéticos. Saúde, HTTP interno, ACL, runtime sem root/read-only/DDL, CLIs de privacidade e worker de retenção passaram em rede Docker internal, sem saída para provedores. Corrigidos o encerramento das CLIs de inventário/retenção após a limpeza do Payload e a renovação do heartbeat no ciclo ocioso do worker de retenção. A imagem não foi publicada. Bateria funcional integral do release, restore físico nesta imagem, destino externo/RPO/RTO, contas e VPS continuam pendentes. [Evidência D107](../artifacts/container/d107-results.json). As sondagens HTTP rodam no loopback do container; não homologam proxy, TLS ou acesso da VPS. Replay v2 na imagem usa manifesto vazio; decisões reais de fixtures pós-snapshot ainda exigem o ensaio físico nessa imagem.

## D108 — Restore físico com a imagem atual — 26/10/2026

D108 aprovou restore físico com a imagem D107: 32 migrations, mídia íntegra, seis decisões de privacidade posteriores ao snapshot e replay v2 dentro da imagem. Preview, exclusão/correção, pending, supressão/bounce e repetição sem renovar prazos foram verificados. A aplicação só iniciou depois do replay, com credencial de banco separada e limitada: saúde/catálogo/capa responderam 200, contatos privados 403 e amostra privada na rota pública 404. Rede interna sem portas publicadas; transportes e worker desligados. Destino externo, guarda atual do manifesto, RPO/RTO reais, bateria integral e homologações continuam pendentes. [Evidência D108](../artifacts/recovery/d108-results.json). Não houve nova migration, rebuild, dado real, conta externa, VPS ou deploy; identidade sem decisão e entregas incertas foram preservadas.

## D110 — Retenção de identidade e recuperação — 26/10/2026

O schema vigente tem 33 migrations. O ensaio físico D110 usa PostgreSQL/restic locais com fixtures e runtime host, sem validar imagem ou retomada HTTP. D107/D108 cobrem imagem de 32 migrations. Reconstruir/testar a imagem da revisão final, upgrade e restore/replay v3 antes de H03/H04; backup externo e RPO/RTO reais não foram homologados.

## D111 — Operações em lote e diagnóstico PostgreSQL — 26/10/2026

Instalar com pnpm 10.34.7 e lockfile congelado aplica o patch ampliado do Payload às operações em lote; não trocar por alterações manuais em node_modules. Dependências e 33 migrations mantidas. A imagem D107 e restore D108 não contêm o patch; reconstruir a revisão final e repetir H03/H04 antes de operação real.

## D112 — Descadastro e retenção por assunto — 26/10/2026

Schema vigente tem 34 migrations; imagem final deve incluir o novo fato temático, confirmação protegida e CLI v4. A imagem D107/restore D108 são anteriores. O ensaio host usa banco isolado e não certifica runtime/upgrade/HTTP da imagem final; backup externo e metas reais continuam pendentes.

## D113 — Margem e acompanhamento do prazo — 26/10/2026

O healthcheck existente do worker usa as CLIs novas: heartbeat ≤90 segundos e, com DATA_RETENTION_ENABLED=true, ciclo concluído ≤25 horas e nenhuma assinatura para revisão aos 30 dias. Arquivo /tmp/bibliotheon-retention-health privado, publicado por rename atômico. A marca de sucesso só é atualizada após analytics/privacidade retornarem e o registro ser publicado. O teste usa CLIs atuais montadas somente leitura sobre uma imagem antiga em container sem rede; isso não valida a nova imagem completa. Homologar alertas/ação operacional e duração sob carga em H03/H06.

## D114 — Legado temático verificável — 26/10/2026

D114 mantém 34 migrations e não altera versões/flags. O restore físico host passa a representar a revisão anterior aos fatos temáticos: preserva evento nativo e remove só o marcador sintético antes de exportar; a CLI gera v4 sem escrita e reaplica no destino. Isso não valida imagem final, guarda externa ou RPO/RTO reais. QA de container usa fase/tag D114 por padrão, ainda sem rebuild nesta etapa.
