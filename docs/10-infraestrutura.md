# 10 — Infraestrutura e implantação planejada

[Índice](../README.md) · [Operação](11-operacao.md)

Dockerfile, Compose e recuperação já possuem implementação/ensaios locais, detalhados no [pacote de produção](21-pacote-producao.md). A revisão atual exige reconstruir/homologar a imagem com as sete migrations, CLIs e quota presentes; os limites abaixo são plano de implantação, não recursos livres comprovados. Nenhuma VPS foi acessada.

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
| Kiwify auth config | Nome/formato a registrar após descoberta B09; não ativar sem ele |
| TOKEN_SIGNING_SECRET | Tokens de download/preferências, separado do admin |
| BACKUP_DESTINATION / BACKUP_KEY | Destino externo e criptografia, fora da aplicação |

Arquivo real de ambiente fora do Git, permissão restrita. Futuro `.env.example` só com nomes e placeholders. Nenhum segredo `NEXT_PUBLIC_*`. Startup valida campos necessários à funcionalidade habilitada; conector não configurado pode ficar desabilitado sem impedir catálogo.

## Deploy e migrações

CI ou máquina de desenvolvimento gera imagem compatível com arquitetura da VPS; não compilar Next no servidor compartilhado. Artefato inclui código e dependências fixadas, sem dados/credenciais. Testes e migrations verificadas em banco descartável antes da release. Tag imutável e digest registrados.

Produção usa alterações aditivas e sequência expandir → migrar dados → mudar código → remover em release posterior. Não executar alteração destrutiva automática. Backup antes de migrar; rollback de código não reverte schema. Deploy completo e critérios de interrupção em [operação](11-operacao.md).

## Backup e continuidade

Alvo inicial: RPO ≤24h, RTO ≤4h, a comprovar em restauração. Diariamente gerar dump consistente PostgreSQL e cópia dos uploads com manifesto de versão; criptografar e enviar para armazenamento fora da VPS. Usar restic como ferramenta prevista, com backend suportado escolhido no B05 conforme conta e custo. Não chamar volume local ou snapshot no mesmo servidor de backup externo.

Retenção inicial: 7 diários, 4 semanais, 3 mensais; aplicar ciclo de exclusão conforme privacidade. Guardar chave de recuperação separada, fora da VPS e do repositório. Confirmar sucesso remoto e integridade; restauração mensal em ambiente isolado. Objetos versionados de mídia evitam troca durante backup; suspender alterações de uploads durante a captura caso necessário.

O destino externo real é dependência de implantação, não placeholder a ignorar. Falta de backup testado impede marcar produção pronta. Operação permanece local até existir capacidade, domínio e recuperação validados.
