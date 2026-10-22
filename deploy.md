# Deploy do Bibliotheon na VPS

[README](README.md) · [Estado do produto](docs/23-estado-atual.md) · [Operação e recuperação](docs/21-pacote-producao.md)

Guia de 22/10/2026. Depois da preparação inicial, a atualização normal será:

```bash
cd /srv/bibliotheon
./atualizar.sh
```

O script faz pull com fast-forward, constrói uma imagem nova, pausa somente app/worker do Bibliotheon, confirma backup externo, aplica migrations e sobe/verifica os serviços. Banco e mídia ficam em volumes persistentes. Há uma janela de indisponibilidade entre a pausa para backup e o término da verificação. Não é deploy sem downtime.

O nome principal é **atualizar.sh**. **altualizar.sh**, com a grafia do primeiro pedido, é um atalho para o mesmo comando.

## 1. Antes do primeiro deploy

Este guia prepara a infraestrutura; não conclui funcionalidades ainda pendentes. O produto tem [lacunas conhecidas](docs/23-estado-atual.md), incluindo homologação da imagem atual, eventos comerciais, conectores, financeiro e retenção. Homologue a versão antes de abrir operação real. Captura/e-mail/worker ficam desligados inicialmente. O contato público será preenchido por você antes da produção, conforme a decisão já registrada.

Procedimento de referência: Ubuntu 24.04 LTS de 64 bits, Bash, Python **3.11+**, Git, Docker Engine com Buildx e Compose v2 recente (referência local: 2.40.3), restic 0.19.1. Node/pnpm ficam dentro da imagem; não precisam ser instalados no host. Se a VPS já possui serviços, use o sistema/proxy existentes; não reinstale o servidor nem remova pacotes em uso.

Use o mesmo usuário operacional em clone, configuração, Docker, backup e futuras atualizações. Os exemplos de instalação/configuração usam uma sessão administrativa (`sudo -i`, quando necessário); isso não exige habilitar login remoto de root. Não misture clone feito por um usuário com atualizações feitas por outro sem ajustar propriedade e acesso SSH.

Antes de alterar a VPS, registre privadamente:

```bash
cat /etc/os-release
uname -m
free -h
df -h
ss -ltn
docker ps
docker compose version
```

Se Docker ainda não existe, o erro desse comando é esperado; instale na próxima seção. Anote os serviços/domínios atuais, proxy e responsável por 80/443, regras de firewall, portas livres e backup existente. Confira suas URLs antes/depois da implantação.

O build ocorrerá **na VPS**, conforme este pedido. O script exige por padrão 4 GiB de memória disponível e 15 GiB livres no filesystem do checkout. Esses limiares não garantem capacidade: também é necessário espaço para imagens, volume de mídia e temporários do backup, que usam os filesystems do Docker e de /tmp. Reserve margem aos outros sistemas. Não reduz concorrência do host, não cria swap nem impõe limite global ao Docker. Faça o primeiro build numa janela monitorada; em host sem margem, construa fora dele e use o fluxo de imagem por digest do documento 21.

## 2. Instalar ferramentas, se necessário

No Ubuntu de referência:

```bash
apt-get update
apt-get install -y git ca-certificates curl python3 openssh-client
python3 -c 'import sys; assert sys.version_info >= (3, 11), "Use Python 3.11+"'
```

Se Docker/Compose já funcionam, preserve a instalação. Caso contrário, use o [repositório oficial Docker para Ubuntu](https://docs.docker.com/engine/install/ubuntu/), escolhendo versões estáveis para sua distribuição e instalando docker-ce, docker-ce-cli, containerd.io, docker-buildx-plugin e docker-compose-plugin. A página oficial inclui a configuração da chave/repositório apt. Em VPS compartilhada, não execute a remoção de pacotes conflitantes sem identificar quem os usa.

Exemplo para host Ubuntu novo, sem instalação conflitante (não executar como atualização global de um Docker já em uso):

```bash
install -d -m 755 /etc/apt/keyrings
curl --fail --silent --show-error --location https://download.docker.com/linux/ubuntu/gpg --output /etc/apt/keyrings/docker.asc
chmod 644 /etc/apt/keyrings/docker.asc
python3 - <<'PY'
from pathlib import Path
import subprocess
release = dict(line.split('=',1) for line in Path('/etc/os-release').read_text().splitlines() if '=' in line)
codename = release.get('UBUNTU_CODENAME', release['VERSION_CODENAME']).strip('"')
arch = subprocess.check_output(['dpkg','--print-architecture'], text=True).strip()
Path('/etc/apt/sources.list.d/docker.sources').write_text(f'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: {codename}\nComponents: stable\nArchitectures: {arch}\nSigned-By: /etc/apt/keyrings/docker.asc\n')
PY
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

```bash
docker version
docker compose version
docker buildx version
docker info
```

A sessão precisa acessar o daemon Docker sem prompt de sudo dentro do script. Acesso ao socket Docker equivale a controle administrativo do host; mantenha-o restrito. Não exponha o daemon pela rede. Não use imagens latest.

## 3. Configurar acesso de leitura ao Git

Se o git clone já foi feito e git pull funciona sem senha, prossiga. Para repositório privado no GitHub, configure uma deploy key somente de leitura para o usuário operacional. Gere uma chave dedicada, proteja a chave privada e cadastre somente a chave **pública** em Settings → Deploy keys do repositório. Não coloque token/senha na URL do origin.

Exemplo, adaptando a pasta pessoal ao usuário escolhido:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_bibliotheon -C bibliotheon-vps
```

Para atualização sem intervenção, a chave precisa estar disponível por agente ou por arquivo privado acessível à sessão. Se optar por arquivo sem passphrase, use-o somente como deploy key de leitura e mantenha permissão 600. Configure ~/.ssh/config:

```sshconfig
Host github-bibliotheon
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_bibliotheon
    IdentitiesOnly yes
    BatchMode yes
```

Confira a identidade do host pelos [fingerprints publicados pelo GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints) antes de aceitar a conexão. Teste o acesso e clone seu repositório, substituindo os nomes:

```bash
git clone git@github-bibliotheon:SEU_USUARIO/SEU_REPOSITORIO.git /srv/bibliotheon
cd /srv/bibliotheon
git branch --show-current
git status --short
chmod +x atualizar.sh altualizar.sh
```

Se já clonou, apenas entre na pasta e confira o origin privadamente. A branch padrão do atualizador é main; configure outra em deploy.json se necessário. O checkout precisa estar limpo. Publique os scripts com bit executável no Git; se chmod aparecer como alteração local, corrija o modo no repositório de origem e faça novo pull. Não use reset --hard para contornar modificações.

## 4. Criar configuração privada

Configurações e releases ficam **fora do Git e do contexto de build**:

| Local | Conteúdo |
|---|---|
| /etc/bibliotheon/production.env | Segredos e ambiente da aplicação/banco |
| /etc/bibliotheon/deploy.json | Branch, caminhos, limites e ativação do worker |
| /etc/bibliotheon/backup.json | Configuração privada do destino restic |
| /etc/bibliotheon/restic-password | Chave do backup; guarde outra cópia segura fora da VPS |
| /var/lib/bibliotheon | Lock, manifests e configurações privadas por release |

```bash
install -d -m 700 /etc/bibliotheon /var/lib/bibliotheon
```

O próximo comando gera valores privados sem exibi-los e recusa sobrescrever um arquivo existente. Execute na raiz do checkout, com permissão para escrever em /etc/bibliotheon:

```bash
python3 - <<'PY'
import os, secrets
from pathlib import Path
os.umask(0o077)
values = Path('.env.production.example').read_text()
owner, runtime = secrets.token_hex(32), secrets.token_hex(32)
replace = {
    'BIBLIOTHEON_IMAGE': 'managed-by-atualizar',
    'BIBLIOTHEON_PORT': '33001',
    'PAYLOAD_SECRET': secrets.token_hex(48),
    'LEAD_TOKEN_SECRET': secrets.token_hex(48),
    'DB_OWNER_PASSWORD': owner,
    'DB_RUNTIME_PASSWORD': runtime,
    'DATABASE_URL': f'postgresql://bibliotheon_runtime:{runtime}@db:5432/bibliotheon',
    'DATABASE_MIGRATION_URL': f'postgresql://bibliotheon_owner:{owner}@db:5432/bibliotheon',
}
lines = [line.split('=',1)[0]+'='+replace[line.split('=',1)[0]] if '=' in line and line.split('=',1)[0] in replace else line for line in values.splitlines()]
with Path('/etc/bibliotheon/production.env').open('x') as out:
    out.write('\n'.join(lines)+'\n')
print('Ambiente privado criado; valores não exibidos.')
PY
```

Edite privadamente production.env. Confirme PUBLIC_SITE_URL=https://bibliotheon.com.br e **uma porta livre** em BIBLIOTHEON_PORT; 33001 é apenas exemplo. Não acrescente barra/caminho à origem. Senhas geradas em hexadecimal já são seguras para as URLs; se trocar por outras, codifique caracteres especiais nas URLs. Não regenere senhas/segredos a cada atualização: banco existente não troca senha por mudar env, e a rotação de chaves invalida sessões/links e exige planejamento.

Mantenha LEADS_ENABLED=false, EMAIL_TRANSPORT_ENABLED=false e BREVO_CONTACT_SYNC_ENABLED=false e BREVO_CONTACT_REGISTRATION_ENABLED=false e BREVO_LIST_SYNC_ENABLED=false. Hosts de checkout podem ficar vazios até conferir as plataformas; isso mantém ofertas indisponíveis. O script escolhe a imagem automaticamente e ignora BIBLIOTHEON_IMAGE do env nesse fluxo; não é preciso registry/push de imagem.

Crie /etc/bibliotheon/deploy.json:

```json
{
  "env_file": "/etc/bibliotheon/production.env",
  "state_dir": "/var/lib/bibliotheon",
  "branch": "main",
  "worker": false,
  "backup_env": "/etc/bibliotheon/backup.json",
  "health_timeout": 180,
  "min_memory_mb": 4096,
  "min_disk_mb": 15360,
  "public_health": true
}
```

```bash
chmod 600 /etc/bibliotheon/production.env /etc/bibliotheon/deploy.json
```

O projeto Compose é fixo: bibliotheon. O primeiro deploy recusa containers/volumes desse projeto já existentes sem manifest gerenciado. Não confunde com bibliotheon-local. Se já houver uma instalação manual, planeje sua migração de controle; não apague volumes para passar pela checagem.

## 5. Preparar backup externo obrigatório

Antes de qualquer deploy, prepare um repositório restic **fora da VPS**, acessível sem prompts. O primeiro deploy verifica acesso ao repositório, mas não captura um banco inexistente; os seguintes exigem snapshot externo confirmado antes de migrar. Um arquivo de dump no mesmo disco não atende a essa proteção.

Use restic 0.19.1, versão dos ensaios locais, obtido da distribuição oficial. Alternativa com a imagem oficial fixada já usada no projeto:

```bash
RESTIC_IMAGE='restic/restic:0.19.1@sha256:136600b6ff6843d61d355f7f71f460a166429f35de6fd11b568fece3c9a4d510'
docker pull "$RESTIC_IMAGE"
RESTIC_CONTAINER_ID="$(docker create "$RESTIC_IMAGE")"
docker cp "$RESTIC_CONTAINER_ID:/usr/bin/restic" /usr/local/bin/restic
docker rm "$RESTIC_CONTAINER_ID"
chmod 755 /usr/local/bin/restic
restic version
```

Para SFTP, configure uma chave dedicada e Host backup-bibliotheon em ~/.ssh/config com HostName, User, IdentityFile e BatchMode yes; confira a identidade do servidor de backup e teste o acesso antes. O diretório remoto deve ser exclusivo deste projeto. S3/outros backends também são aceitos; inclua as variáveis exigidas pelo backend no JSON privado, nunca no Git.

Gere a chave local sem exibi-la; o comando recusa sobrescrever:

```bash
python3 - <<'PY'
import os, secrets
os.umask(0o077)
with open('/etc/bibliotheon/restic-password', 'x') as out:
    out.write(secrets.token_hex(48)+'\n')
PY
```

Crie /etc/bibliotheon/backup.json, substituindo o destino real:

```json
{
  "RESTIC_BINARY": "/usr/local/bin/restic",
  "RESTIC_REPOSITORY": "sftp:backup-bibliotheon:/caminho/remoto/bibliotheon",
  "RESTIC_PASSWORD_FILE": "/etc/bibliotheon/restic-password"
}
```

```bash
chmod 600 /etc/bibliotheon/backup.json /etc/bibliotheon/restic-password
```

Inicialize **somente um repositório novo**, usando o mesmo JSON. Se já existe, troque ['init'] por ['snapshots'] para verificar acesso sem reinicializar:

```bash
python3 - <<'PY'
import json, os, subprocess
env = os.environ.copy()
env.update(json.load(open('/etc/bibliotheon/backup.json')))
subprocess.run([env['RESTIC_BINARY'], 'init'], env=env, check=True)
PY
```

Guarde a chave e as credenciais de acesso em outro local seguro; perder a chave impede recuperar o backup. Ensaie restauração isolada pelo [procedimento de recuperação](docs/21-pacote-producao.md) antes de operar com dados reais. Fontes: [preparar repositório](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html) e [restore](https://restic.readthedocs.io/en/stable/050_restore.html).

## 6. Executar o primeiro deploy

Na raiz do clone, com configurações privadas prontas e backup acessível:

```bash
./atualizar.sh --inicial
```

O script verifica branch/checkout, faz git pull --ff-only origin main (ou sua branch), valida ambiente/recursos, constrói imagem, inicia apenas o banco, migra e sobe o app. O primeiro deploy verifica saúde **local**; o proxy/HTTPS vem na seção seguinte. Worker só inicia se explicitamente configurado. Não instala Docker, não configura DNS/proxy, não cria usuário do painel e não publica livro automaticamente.

```bash
curl --fail http://127.0.0.1:33001/health/ready
```

Resultado esperado: {"status":"ready"}. Adapte a porta. Logs de operação guardam apenas programa, código de saída e duração; configuração resolvida/segredos ficam em arquivos privados 600 dentro do diretório de release. Não publique compose.json, production.env ou backups desses arquivos.

## 7. Apontar domínio e configurar HTTPS

Configure um registro A de bibliotheon.com.br para o IPv4 da VPS. Só crie AAAA se IPv6 estiver funcionando. Comece sem proxy/CDN para simplificar a conferência de IP/TLS. Libere 80/443 no firewall e painel da hospedagem, preservando SSH e regras dos serviços existentes; não publique 33001, 3000 ou 5432 na internet. Subdomínios futuros precisam de DNS/TLS e origens específicas; não use CORS/CSRF wildcard.

**Se já existe Nginx/Caddy/Traefik:** acrescente somente o host Bibliotheon e seu certificado ao proxy existente, encaminhando para 127.0.0.1:33001. Se o proxy roda em container, esse loopback pertence ao container, não ao host; configure rede dedicada/rota ao host em manutenção própria. Não substitua o proxy para copiar este exemplo. Preserve Host, X-Forwarded-Proto e redirecione HTTP para HTTPS. No Nginx ajuste client_max_body_size 21m; configure certificados com o mecanismo já usado no servidor. Referências: [proxy_pass Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass) e [Certbot](https://certbot.eff.org/instructions).

**Se não existe proxy e 80/443 estão livres:** use Caddy, que gerencia HTTPS automaticamente. Instale pelo [pacote oficial para Ubuntu](https://caddyserver.com/docs/install#debian-ubuntu-raspbian). Edite /etc/caddy/Caddyfile, sem apagar outros hosts:

No host novo, instale o pacote estável assim; depois edite o Caddyfile mostrado abaixo:

```bash
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl --fail --silent --show-error --location https://dl.cloudsmith.io/public/caddy/stable/gpg.key --output /tmp/bibliotheon-caddy-key.asc
gpg --dearmor --output /usr/share/keyrings/caddy-stable-archive-keyring.gpg /tmp/bibliotheon-caddy-key.asc
curl --fail --silent --show-error --location https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt --output /etc/apt/sources.list.d/caddy-stable.list
chmod 644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
```

```caddyfile
bibliotheon.com.br {
    @admin_bloqueado {
        path /admin /admin/* /api/admin-users /api/admin-users/*
        not remote_ip SEU_IP_PUBLICO/32
    }
    respond @admin_bloqueado 403
    request_body {
        max_size 21MB
    }
    reverse_proxy 127.0.0.1:33001
}
```

Substitua SEU_IP_PUBLICO e a porta. A restrição administrativa é por IP de acesso/VPN, não pelo IP da VPS; use um endereço realmente autorizado. Se há CDN/proxy anterior, configure a cadeia de confiança antes de usar IP do cliente; não confie em header arbitrário. Não habilite access log com query strings de links de confirmação/preferência. A mesma proteção administrativa deve existir no proxy alternativo escolhido enquanto não houver MFA homologado.

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy
curl --fail https://bibliotheon.com.br/health/ready
```

Se validação falhar, corrija antes de recarregar. Certificado/DNS/firewall são conferidos no host real, não pelo teste local deste repositório. Fontes: [Caddy reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) e [matchers/IP](https://caddyserver.com/docs/caddyfile/matchers#remote-ip).

## 8. Criar o primeiro administrador

Crie um JSON privado **fora do checkout** com email e password, senha aleatória de pelo menos 16 caracteres. Use seu gerenciador de senhas/editor privado; não coloque senha no comando, Git ou histórico. O e-mail de login administrativo não vira e-mail público do site. Inscrição pública é bloqueada mesmo com banco vazio.

Para ler o Compose da release atual sem imprimir seu ambiente:

```bash
COMPOSE_ATUAL="$(python3 -c 'import json; print(json.load(open("/var/lib/bibliotheon/current.json"))["compose_file"])')"
docker compose -p bibliotheon -f "$COMPOSE_ATUAL" --profile maintenance run --rm --no-deps -T --pull never migrate node cli/create-admin.js < /caminho/privado/primeiro-admin.json
```

O comando recusa criar um segundo owner. Apague o arquivo privado temporário quando concluir, mantendo credencial no gerenciador. Abra https://bibliotheon.com.br/admin pelo IP permitido e entre. Se perder a senha, o mesmo padrão de comando com node cli/recover-admin.js recebe o JSON de recuperação privado; revoga sessões anteriores. Recuperação por e-mail permanece indisponível.

## 9. Conferir antes de abrir tráfego comercial

Confira HTTPS/renovação, acesso administrativo restrito, anônimo negado nas APIs privadas, upload/preview/publicação e preservação dos outros serviços. Cadastre manualmente responsável, contato público, textos institucionais revisados, livro/amostra e ofertas reais após conferir elegibilidade de cada plataforma. Não publique fixtures. E-mail público vazio mantém a captura desativada por legalReady.

Só habilite captura/transporte/worker depois de homologar conta, remetente, DNS de e-mail, supressões, quota e fluxos atuais. Para isso, altere privadamente production.env e worker no deploy.json e execute ./atualizar.sh; mudança de ambiente dispara release mesmo sem commit novo. Worker=false continua sendo o padrão. O calendário local não equivale a envio promocional: agrupamento/claim locais testados, mas sincronização de listas/campanhas e transporte promocional ainda pendentes. O atualizador não elimina esses gates.

## 10. Atualizações após cada push

Envie uma versão previamente testada para a branch configurada. Entre na VPS como o mesmo usuário e execute:

```bash
cd /srv/bibliotheon
./atualizar.sh
```

Não é necessário npm install, build manual ou restart manual. A instalação usa lockfile dentro do Docker. Apenas uma atualização roda por vez, com lock. Alteração local, branch divergente ou pull que exija merge interrompem o fluxo sem descartar arquivos. Se a própria ferramenta muda no pull, ela reinicia antes de alterar produção.

Cada imagem tem tag exclusiva com horário/commit e ID SHA-256 registrado/verificado. Não há sobrescrita de tag nem pull dessa imagem da aplicação. O banco continua por digest e não é recriado numa atualização comum. Imagens/releases anteriores são mantidas; limpeza de disco é manutenção explícita, nunca prune automático.

Com o mesmo commit/ambiente/worker, o script apenas confere imagem/saúde e termina; não remigra nem reinicia. Para reconstruir deliberadamente:

```bash
./atualizar.sh --reconstruir
```

Atualizações normais verificam também o endpoint HTTPS público. O worker só sobe depois de app/imagem/saúde aprovados. Uma mudança na imagem/configuração/volume do banco exige manutenção separada e será recusada; não atualize PostgreSQL ou senha do papel alterando apenas env/Compose. A lógica de reimplantar app com --no-deps segue a [documentação Compose](https://docs.docker.com/compose/how-tos/production/).

## 11. Backup diário

Além do backup pré-atualização, execute:

```bash
./atualizar.sh --backup
```

Ele não faz pull/build/migrations: pausa app/worker, captura banco e mídia para o repositório externo, valida snapshot, executa a limpeza segura de mídia e retoma a versão atual. Falha no backup tenta retomar os serviços e retorna erro. Há indisponibilidade durante a cópia/verificação; escolha janela adequada ao volume. O lock é compartilhado com atualizações.

A limpeza só começa após backup confirmado. Arquivos substituídos/excluídos permanecem no volume até ficarem sem referência e completarem 24 horas desde a primeira observação pela coleta. O índice privado .bibliotheon-media-gc.json faz parte do volume/backup; não o apague para liberar espaço. Apenas arquivos regulares com UUID gerenciado são candidatos. Links simbólicos/nomes desconhecidos são ignorados; índice corrompido interrompe a rotina. A confirmação do backup e as contagens ficam nos arquivos privados last-backup.json e last-media-gc.json do diretório de estado. Falha da coleta mantém o backup confirmado, tenta retomar os serviços e retorna erro para monitoramento.

Para inspecionar sem modificar arquivos, use o manifesto atual privado, sob o lock de manutenção. Execute como operador; o comando não envia e-mails nem inicia carência:

```bash
sudo flock -n /var/lib/bibliotheon/deploy.lock python3 - <<'PYMEDIA'
import json
import subprocess
from pathlib import Path
state = json.loads(Path('/var/lib/bibliotheon/current.json').read_text())
subprocess.run(['docker', 'compose', '-p', 'bibliotheon', '-f', state['compose_file'], 'run', '--rm', '--no-deps', 'app', 'node', 'cli/media-gc.js'], check=True)
PYMEDIA
```

Para aplicar em produção, prefira ./atualizar.sh --backup, que integra parada, backup e limpeza. No desenvolvimento: npm run media:gc simula; npm run media:gc -- --apply aplica. A coleta não substitui a política de retenção de contatos nem a restauração de backup. Se falhar, confira imagem/CLI, permissões do volume e índice antes de repetir; não remova arquivos manualmente por idade.

Para agendar, crie /etc/systemd/system/bibliotheon-backup.service, adaptando usuário/caminho se mudou os exemplos:

```ini
[Unit]
Description=Backup externo do Bibliotheon
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
WorkingDirectory=/srv/bibliotheon
ExecStart=/srv/bibliotheon/atualizar.sh --backup
UMask=0077
TimeoutStartSec=2h
```

Crie /etc/systemd/system/bibliotheon-backup.timer:

```ini
[Unit]
Description=Agendamento do backup Bibliotheon

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true
Unit=bibliotheon-backup.service

[Install]
WantedBy=timers.target
```

```bash
systemctl daemon-reload
systemctl enable --now bibliotheon-backup.timer
systemctl list-timers bibliotheon-backup.timer
```

O horário é o fuso do host; confira com timedatectl, sem alterar silenciosamente o fuso dos outros sistemas. Teste um backup manual e configure um alerta seu para falha/atraso; timer instalado não prova backup válido. Após verificar snapshots/restore, estabeleça retenção exclusiva deste repositório (referência: 7 diários, 4 semanais, 3 mensais). Não há forget/prune automático no atualizador; não elimine snapshots de outros projetos.

## 12. Falhas, diagnóstico e retomada

| Falha | Comportamento |
|---|---|
| Pull, ambiente, recursos ou build | App anterior não é parado |
| Backup antes de iniciar migration | Tenta retomar a versão anterior; não migra |
| Migration já iniciada, app/worker/imagem/saúde falham | App/worker ficam parados; banco/volumes preservados; bloqueia atualização comum |
| Interrupção abrupta após checkpoint | Mantém in-progress.json para diagnóstico |
| Backup diário falha | Retoma app/worker no finally; se retomada falhar/interromper, checkpoint permanece |

Leia /var/lib/bibliotheon/in-progress.json e os manifests da release: contêm fase/caminho, commit, imagem, ID e referência de backup. operations.log contém somente metadados de execução; saídas de ferramentas não são gravadas para evitar credenciais/PII. Portanto um erro de build exige reproduzi-lo em terminal privado ou numa homologação, não procurar stack trace completo nesse arquivo. Não envie ambientes, compose.json, tokens ou logs brutos a issues/chat.

Com COMPOSE_ATUAL obtido como na seção 8, inspecione estado sem despejar ambientes:

```bash
docker compose -p bibliotheon -f "$COMPOSE_ATUAL" --profile relationship ps -a
```

Se a falha foi no primeiro deploy, não haverá current.json: obtenha o caminho de release em in-progress.json e use seu compose.json. Confira também containers de migration ainda executando antes de tentar novamente; não rode duas migrations juntas. Erro de TLS pode ser DNS, certificado, IP/CDN, porta de proxy ou origem; erro de banco pode ser credencial, disco ou migration. Diagnostique sem imprimir docker inspect completo ou docker compose config com segredos.

Depois de corrigir a causa e conferir o backup/schema e que não há migration antiga em execução:

```bash
./atualizar.sh --retomar
```

É uma ação explícita de recuperação: faz pull/build da versão atual, preserva a referência da interrupção, exige backup e reaplica somente migrations pendentes. Pode recuperar também primeiro deploy interrompido. Não significa que uma migration parcialmente aplicada ou incompatível possa ser resolvida sem análise. Não apague in-progress.json para burlar a proteção.

**Rollback:** nunca faz down automático do schema ou restaura banco por cima da produção. Só retorne código se a imagem anterior for compatível com o schema atual, após análise; manifests anteriores são preservados. Se não for, mantenha escrita parada, prefira correção progressiva e restaure numa cópia isolada para avaliar recuperação/perda de eventos. Procedimento detalhado no documento 21; reaplique exclusões/supressões posteriores antes de voltar a enviar e-mail.

Não use docker compose down -v, docker volume prune ou docker system prune -a como parte da atualização. Não apague releases atuais/anteriores ou volumes para resolver erro. Backup de dados não substitui cópia externa das configurações/chaves privadas, protegida separadamente.

## 13. O que foi validado neste repositório

O script possui testes de orquestração com Git/Docker/HTTP simulados, incluindo falhas e retomada. Há ensaios anteriores locais de imagem e restore, com limites em estado atual. A implantação deste guia na sua VPS, seu proxy, backup externo e DNS não foi executada pelo assistente. Antes da produção, faça uma homologação do fluxo completo no host isolado e confira os requisitos de release do projeto.

Verificação local das ferramentas:

```bash
bash -n atualizar.sh altualizar.sh
python3 -m unittest discover -s tests/ops -p 'test_*.py'
python3 scripts/qa-deploy-config.py
python3 scripts/validar_documentacao.py
```

Para configuração em caminho diferente: ./atualizar.sh --config /caminho/privado/deploy.json. Use o mesmo caminho em atualizações, backup e timer. Nunca versionar esse JSON com credenciais.

O ensaio qa-deploy-config usa apenas docker compose config com valores sintéticos, inclusive senha contendo cifrão, sem criar/iniciar serviços. No dotenv, valores com cifrões literais devem estar entre aspas simples; a configuração normalizada da release preserva esses caracteres. O atualizador não grava saídas brutas nos logs.

## Sincronização de bloqueios de marketing

A versão atual persiste pedidos de bloqueio local em fila privada, mesmo com BREVO_CONTACT_SYNC_ENABLED=false e BREVO_CONTACT_REGISTRATION_ENABLED=false e BREVO_LIST_SYNC_ENABLED=false. Não habilite a flag no primeiro deploy. Após homologar chave, permissões e conta, a rotina só faz GET/PUT de contatos para aplicar emailBlacklisted=true e conferir; não envia mensagens, não troca endereço, não cria contato e não reativa bloqueios. Flag de captura e transporte de e-mail continuam independentes.

Worker=true pode operar apenas os bloqueios, com EMAIL_TRANSPORT_ENABLED=false e BREVO_CONTACT_SYNC_ENABLED=true. Nesse modo não há sender/SMTP, mas há comunicação real com a API; homologue antes de ativar. Falha de autenticação fica failed na coleção privada; corrigir configuração antes do retry explícito. CLI empacotado: node cli/sync-brevo-suppressions.js; --retry-failed reabre até 100 recusas e processa no máximo 25 por execução. Use pelo procedimento privado de operações com a imagem/manifesta atual, sem imprimir segredos; ver [operação](docs/11-operacao.md). Claim e envio promocional ainda não estão ligados ao worker.

## Conferência dos destinatários antes da quota

Desde D50, a função interna de claim exige GET autenticado recente de todos os contatos elegíveis. Consulta desativada, ausência ou falha não reservam quota; bloqueio observado cancela marketing e gera auditoria própria. Conferência positiva fica vinculada ao lote e versões locais por até cinco minutos. Claim permanece fora do worker e não envia campanhas. Isso não altera as flags iniciais false nem substitui homologação da conta ou revalidação no transporte futuro.

A décima migração adiciona conferência/action/códigos novos. Downgrade é recusado quando perderia observações/códigos em uso; não remova auditoria para forçar retorno. Prefira correção progressiva conforme [operação](docs/11-operacao.md).

## Cadastro consentido de contatos no Brevo

Mantenha BREVO_CONTACT_REGISTRATION_ENABLED=false no primeiro deploy. A fila local é criada no mesmo commit da confirmação com marketing, mas nenhum contato real é sincronizado com flags desligadas. Ativação futura exige cadastro e bloqueios habilitados, chave API/chave de links privadas e homologação da conta, limites e automações externas.

Worker com cadastro habilitado revalida consentimento, consulta antes/depois e só cria contato ausente sem update/merge ou desbloqueio. Não cria lista/campanha nem envia mensagem. Para execução privada: node cli/sync-brevo-registrations.js; --retry-failed reabre até 100 recusas após correção e processa até 25 registros. Flags inválidas são recusadas antes do worker. Compensações de POST incerto após descadastro persistem como canceling e são drenadas só com GET/PUT pelo canal de bloqueios, mesmo com criação desativada. Não desative esse canal ou remova sua chave enquanto houver compensações. Ver [operação](docs/11-operacao.md).

A décima primeira migração enfileira confirmados já consentidos e recusa downgrade que perderia tentativas/IDs. Cadastro sincronizado é observação pontual, sem prova de campanha/entrega; os gates do produto continuam pendentes.

## Listas de destinatários por lote

Mantenha BREVO_LIST_SYNC_ENABLED=false no primeiro deploy. Pasta dedicada BREVO_LIST_FOLDER_ID, canal de bloqueios/chaves e conta/automações devem ser homologados antes da ativação. Esse recurso é CLI privado por lote, fora do worker, sem criar/disparar campanhas. Runtime: node cli/prepare-brevo-list.js UUID_DO_LOTE. Flags inválidas são recusadas; não exponha execução por endpoint público.

Criação incerta é reconciliada por nome opaco/pasta sem outro POST; --list-id ID usa confirmação revisada do operador e confere metadados. --retry-rejected serve somente para criação explicitamente recusada sem ID conhecido. Composição exige IDs exatos e flags conhecidas; inclusão incerta não é repetida automaticamente. Listas extras/órfãs não são apagadas para resolver conflitos. Ver [operação](docs/11-operacao.md).

A 12a migração preserva intenção/IDs e recusa downgrade destrutivo quando há operações externas registradas. Lista ready é observação pontual, sem equivaler a campanha ou envio; produção continua sujeita aos gates pendentes.


### Preparação de links individuais Brevo

Manter BREVO_PREFERENCE_SYNC_ENABLED=false até homologar o atributo BIBLIOTHEON_PREFERENCES como normal/text, domínio/chave de links e canal de bloqueios. A operação privada equivale a node cli/prepare-brevo-preferences.js UUID_DO_LOTE dentro da imagem; aplica somente o atributo do titular e reconfirma o valor, sem criar campanha ou enviar. Consulte [operação](docs/11-operacao.md) e [contrato Brevo](docs/integracoes/brevo.md). Não publicar URLs com tokens nem saída bruta da API.

A 13a migração adiciona intenção recuperável de links e conferência mínima do lote; recusa downgrade que perderia nonces/intenção. Reconstruir e testar imagem/restore das treze migrações antes da produção. O worker não prepara links individuais nem dispara campanhas; prova local não substitui homologação de renderização e gate de transporte.


### Rascunhos de campanhas Brevo

Manter BREVO_CAMPAIGN_SYNC_ENABLED=false e BREVO_CAMPAIGN_SENDER_ID vazio no primeiro deploy. Homologar remetente, listas/preferências/bloqueios e representação de HTML/placeholder antes de ativar. Runtime privado: node cli/prepare-brevo-campaign.js UUID_DO_LOTE; --campaign-id ID concilia recurso revisado e --retry-rejected vale somente para criação explicitamente recusada sem ID. Não existe agendamento/disparo nessa rotina ou no worker atual.

A 14a migração adiciona manifesto/inventário de IDs com downgrade protegido; reconstruir e testar imagem/restore das quatorze migrações antes da produção. Em resultado incerto não repetir POST por simples ausência: seguir [operação](docs/11-operacao.md) e [contrato Brevo](docs/integracoes/brevo.md). Rascunhos órfãos e conflitos precisam de inventário; ready não significa e-mail aceito ou entregue.
