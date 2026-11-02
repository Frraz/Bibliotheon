# 06 — Deploy (VPS)

O VPS é o mesmo dos outros sistemas: `warley.dev.ferzion.com.br` (147.93.15.214). `bibliotheon.com.br` (sem `www`, que não tem DNS) já aponta para ele, e o **v1 (Next.js + Postgres) está no ar** lá, em `127.0.0.1:8020`.

Acesso: usuário `deploy`, no grupo `docker`, **sem `sudo` sem senha**. Tudo abaixo roda como `deploy`; só a troca do `.conf` do nginx exige `sudo` (e é opcional, ver adiante).

Regras do servidor (`/var/www/docker-instances/README.md`, ver também `../byakugan/DEPLOY.md`):

- **Nenhum container publica 80/443.** Só o nginx do host. O app publica em `127.0.0.1:<porta>`.
- `container_name` com prefixo (`bibliotheon_web`).
- Diretório: `/var/www/docker-instances/<Projeto>`.

## O que já existe no repositório (testado localmente)

| Arquivo | Função |
|---|---|
| `docker/Dockerfile` | 3 estágios (deps, build, run), Node 24, usuário não-root `node`, healthcheck em `/api/saude`. **Testado:** imagem constrói, sobe "healthy", aplica migrações ao iniciar e mantém os dados ao recriar o container |
| `docker-compose.prod.yml` | Porta só em loopback, volume `./data`, limite de 512 MB, logs rotacionados. Exige `SITE_URL` e `PORTA` no `.env` (falha antes de subir se faltar) |
| `.env.example` | Variáveis (abaixo) |
| `deploy/nginx/bibliotheon.com.br.conf` | Proxy do host, gzip, limite de taxa em `/ir/`, HSTS. **Não testado** (não há nginx na máquina de desenvolvimento) |
| `deploy/atualizar.sh` | git pull, backup, build, troca, verificação por 60 s e **rollback automático** para a imagem anterior. **Não testado de ponta a ponta** (precisa do servidor); sintaxe verificada |
| `deploy/backup.sh` | Backup consistente do SQLite (`VACUUM INTO`, com o site no ar) + tar da mídia; 14 diários e 8 semanais. **Testado:** gera o arquivo e a **restauração foi verificada** (`integrity_check` ok e dados presentes) |

## Variáveis (`.env`, só no servidor)

| Variável | Quando vale | Observação |
|---|---|---|
| `SITE_URL` | **Build** | Canonical, sitemap, OG, JSON-LD. Mudar exige novo build |
| `PORTA` | Execução | Porta no loopback. Reaproveite a do v1 |
| `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GA4_ID` | **Build** | Opcionais. Sem eles nada de terceiros carrega e o banner de cookies nem aparece |
| `NEXT_PUBLIC_CONTATO_EMAIL` | **Build** | Aparece em Termos, Privacidade e rodapé. **Preencher antes de divulgar** (LGPD) |
| `IMAGE_TAG` | Execução | O `atualizar.sh` preenche com o commit, para rollback |

`DATABASE_PATH` e `MEDIA_DIR` já vêm definidos na imagem (`/app/data/...`).

## Antes do primeiro deploy: substituir o v1

Descoberto em 02/11/2026 (somente leitura):

- Containers `bibliotheon-app-1` (`127.0.0.1:8020`) e `bibliotheon-db-1` (Postgres), volumes `bibliotheon_database`, `bibliotheon_media`, `bibliotheon_cache`.
- nginx: `/etc/nginx/sites-available/bibliotheon` (link em `sites-enabled/`), `proxy_pass` para `127.0.0.1:8020`, certificado Let's Encrypt do `bibliotheon.com.br` já emitido.
- O código do v1 foi apagado pelo titular, que optou por **descartar os dados sem dump**.

Decisão do titular (02/11/2026): o v1 foi um desastre e foi **apagado por completo, sem dump nem registros** (containers `bibliotheon-app-1` e `bibliotheon-db-1`, os 3 volumes, a imagem e a rede `bibliotheon_private`). Não há v1 para voltar. O que sobrou fora do alcance do `deploy`: uma cópia antiga do `.conf` do nginx (`bibliotheon.before-admin-…`) e a pasta vazia `/var/lib/bibliotheon`, ambas de root.

O v2 usa `COMPOSE_PROJECT_NAME=bibliotheon_v2` no `.env` (o v1 usava `bibliotheon`).

**Rollback do v2:** `atualizar.sh` volta sozinho para a imagem anterior; manual na seção "Rollback".

## Reserva

| Recurso | Valor |
|---|---|
| Domínio | `bibliotheon.com.br` (sem `www`) |
| Porta loopback | **8020** (a do v1). Atenção: **8013 é do rebanho360** |
| Diretório | `/var/www/docker-instances/Bibliotheon` |
| Dados | `<diretório>/data/` → `bibliotheon.db` + `media/` (bind mount, dono uid 1000) |
| Compose | `docker-compose.prod.yml` |
| nginx | `/etc/nginx/sites-available/bibliotheon` (já existe) |

## Primeiro deploy

```bash
cd /var/www/docker-instances && git clone <repo> Bibliotheon && cd Bibliotheon
cp .env.example .env && nano .env          # SITE_URL, PORTA, contato
mkdir -p data && docker run --rm -v "$PWD/data:/d" alpine chown -R 1000:1000 /d   # o container roda como "node" (uid 1000); sem sudo
docker compose -f docker-compose.prod.yml up -d --build
curl -fsS http://127.0.0.1:$PORTA/api/saude     # {"ok":true}
```

Colocar o e-book 001 no ar: a imagem de produção **não inclui `tsx`**, então o seed não roda dentro do container. Para o primeiro deploy, rode o seed **na sua máquina** e envie o resultado:

```bash
# na sua máquina (pasta do projeto)
DATABASE_PATH=/tmp/envio/bibliotheon.db MEDIA_DIR=/tmp/envio/media \
  npm run seed -- ../ebooks/ebooks/001-sistemas-com-ia --extras seeds/001-sistemas-com-ia/extras.json --publicar
rsync -av /tmp/envio/ usuario@servidor:/var/www/docker-instances/Bibliotheon/data/
# no servidor: docker run --rm -v "$PWD/data:/d" alpine chown -R 1000:1000 /d && docker compose -f docker-compose.prod.yml restart web
```

Sem `--demo`. O `extras.json` do 001 já traz o preço (R$ 64,99) e a oferta Hotmart, então ele entra à venda. Se faltassem preço ou oferta, a página ficaria "Em breve".

> ⚠️ **Só no primeiro deploy.** Depois que houver dados reais em produção (e-books criados pelo painel, métricas), **nunca** envie `data/` por cima: apagaria o que foi feito lá. Depois da Etapa 4 a CLI/API passa a ser o único meio de publicar e este passo some.

nginx: o `.conf` atual (só proxy para 8020) já serve o v2. Para ganhar o limite de taxa em `/ir/` e o HSTS, **o titular** (precisa de `sudo`) troca o conteúdo pelo de `deploy/nginx/bibliotheon.com.br.conf` (guarda uma cópia `.v1.bak`) e roda `sudo nginx -t && sudo systemctl reload nginx`. Não é preciso certbot: o certificado existe.

Depois: abrir `https://bibliotheon.com.br`, conferir OG colando o link no WhatsApp, cadastrar o domínio no Search Console e enviar o `sitemap.xml`.

## Atualizar (todo deploy)

No servidor: `./deploy/atualizar.sh`. Ele faz git pull, backup, build, sobe e verifica `/api/saude` por 60 s; se não responder, volta sozinho para a imagem anterior.

Antes, localmente: `npm run build && npm test && npm run test:e2e`, e a auditoria impeccable se mudou algo visual.

Mudou `SITE_URL`, pixel ou contato? O `atualizar.sh` já reconstrói a imagem, então vale igual.

## Backup

Cron do host às 03:30: `cd /var/www/docker-instances/Bibliotheon && ./deploy/backup.sh`. Os arquivos ficam em `~/backups/bibliotheon/` (fora de `data/`, que pertence ao uid 1000). **Copie-os para fora do VPS** (destino a definir: outro servidor ou storage S3-compatível); backup no mesmo disco não protege de perda do servidor.

**Testar a restauração uma vez por mês:** abrir o `.db` de backup com o SQLite (ou subir uma cópia local) e conferir `PRAGMA integrity_check` e a contagem de e-books.

Restaurar: parar o container, substituir `data/bibliotheon.db` pelo backup (e extrair `media-*.tgz` em `data/`), subir de novo.

## Rollback

Toda imagem recebe a tag do commit. O `atualizar.sh` faz o rollback automático se a nova versão não responde. Manual:

```bash
git checkout <sha-anterior>
IMAGE_TAG=<sha-anterior> docker compose -f docker-compose.prod.yml up -d --build
```

Migrations no MVP só **adicionam** colunas/tabelas; se algum dia houver uma destrutiva, restaurar o backup feito pelo `atualizar.sh` antes da troca.

## Armadilhas já encontradas (não repetir)

- **`npm ci` na imagem precisa de `--ignore-scripts`.** O `better-sqlite3` já traz o binário pronto em `prebuilds/`; sem a flag o npm tenta compilar e falha (a imagem `slim` não tem compilador).
- **`SITE_URL` é fixado no build.** Se faltar no build, canonical e sitemap saem com `localhost`.
- **Atrás do nginx, `req.nextUrl.origin` não é a origem pública.** O código usa `SITE_URL` para redirecionamentos e para validar o `Referer`.
- **A pasta `data/` pertence ao uid 1000.** Sem o `chown`, o container não consegue gravar o banco.
