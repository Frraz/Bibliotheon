# 06 — Deploy (VPS)

O VPS é o mesmo dos outros sistemas: `warley.dev.ferzion.com.br` (147.93.15.214). `bibliotheon.com.br` já aponta para ele, e o **v1 (Next.js) está no ar** lá.

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

Fazer **nesta ordem**, e só leitura até o passo 3:

1. Descobrir o v1: diretório, `docker ps | grep -i biblio`, porta loopback usada, `.conf` do nginx (`grep -rl bibliotheon /etc/nginx/sites-enabled/`) e volumes.
2. Registrar abaixo (seção "Reserva") a porta e os caminhos encontrados. **Reutilizar a mesma porta e o mesmo `.conf`** é o caminho mais simples.
3. Backup completo do v1: `tar czf ~/backups/bibliotheon-v1-AAAAMMDD.tgz <diretório>` + dump do banco/volumes. Conferir com `tar tzf` que o arquivo abre.
4. Parar o v1 (`docker compose down`, **sem `-v`**). Os volumes só são apagados depois de o v2 estar estável por 2 semanas.
5. Subir o v2 (abaixo).

## Reserva

| Recurso | Valor |
|---|---|
| Domínio | `bibliotheon.com.br` (+ `www` → redirect 301) |
| Porta loopback | _preencher após o passo 1_ |
| Diretório | `/var/www/docker-instances/Bibliotheon` (conferir) |
| Dados | `<diretório>/data/` → `bibliotheon.db` + `media/` (bind mount, dono uid 1000) |
| Compose | `docker-compose.prod.yml` |

## Primeiro deploy

```bash
cd /var/www/docker-instances && git clone <repo> Bibliotheon && cd Bibliotheon
cp .env.example .env && nano .env          # SITE_URL, PORTA, contato
mkdir -p data && sudo chown -R 1000:1000 data   # o container roda como "node" (uid 1000)
docker compose -f docker-compose.prod.yml up -d --build
curl -fsS http://127.0.0.1:$PORTA/api/saude     # {"ok":true}
```

Colocar o e-book 001 no ar: a imagem de produção **não inclui `tsx`**, então o seed não roda dentro do container. Para o primeiro deploy, rode o seed **na sua máquina** e envie o resultado:

```bash
# na sua máquina (pasta do projeto)
DATABASE_PATH=/tmp/envio/bibliotheon.db MEDIA_DIR=/tmp/envio/media \
  npm run seed -- ../ebooks/ebooks/001-sistemas-com-ia --extras seeds/001-sistemas-com-ia/extras.json --publicar
rsync -av /tmp/envio/ usuario@servidor:/var/www/docker-instances/Bibliotheon/data/
# no servidor: sudo chown -R 1000:1000 data && docker compose -f docker-compose.prod.yml restart web
```

Sem `--demo`: o e-book entra como **"Em breve"** (sem preço nem checkout), porque preço aprovado e links reais ainda não existem. Para vender, cadastre preço e ofertas (painel, Etapa 3, ou o manifesto com `price` e `offers`, Etapa 4).

> ⚠️ **Só no primeiro deploy.** Depois que houver dados reais em produção (e-books criados pelo painel, métricas), **nunca** envie `data/` por cima: apagaria o que foi feito lá. Depois da Etapa 4 a CLI/API passa a ser o único meio de publicar e este passo some.

nginx e certificado:

```bash
sudo cp deploy/nginx/bibliotheon.com.br.conf /etc/nginx/sites-available/bibliotheon.com.br   # trocar 8013 pela PORTA
sudo ln -sf /etc/nginx/sites-available/bibliotheon.com.br /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d bibliotheon.com.br -d www.bibliotheon.com.br   # ou reaproveitar o certificado do v1
```

Depois: abrir `https://bibliotheon.com.br`, conferir OG colando o link no WhatsApp, cadastrar o domínio no Search Console e enviar o `sitemap.xml`.

## Atualizar (todo deploy)

No servidor: `./deploy/atualizar.sh`. Ele faz git pull, backup, build, sobe e verifica `/api/saude` por 60 s; se não responder, volta sozinho para a imagem anterior.

Antes, localmente: `npm run build && npm test && npm run test:e2e`, e a auditoria impeccable se mudou algo visual.

Mudou `SITE_URL`, pixel ou contato? O `atualizar.sh` já reconstrói a imagem, então vale igual.

## Backup

Cron do host às 03:30: `cd /var/www/docker-instances/Bibliotheon && ./deploy/backup.sh`. Os arquivos ficam em `data/backups/`. **Copie-os para fora do VPS** (destino a definir: outro servidor ou storage S3-compatível); backup no mesmo disco não protege de perda do servidor.

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
