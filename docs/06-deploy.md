# 06 — Deploy (VPS)

O VPS é o mesmo dos outros sistemas: `warley.dev.ferzion.com.br` (147.93.15.214). `bibliotheon.com.br` já aponta para ele, e o **v1 (Next.js) está no ar** lá.

Convenções do servidor (`/var/www/docker-instances/README.md`, ver também `../byakugan/DEPLOY.md`):

- **Nenhum container publica 80/443.** Só o nginx do host. O app publica em `127.0.0.1:<porta>`.
- `container_name` com prefixo `bibliotheon_`.
- Diretório: `/var/www/docker-instances/<Projeto>`.

## Antes do primeiro deploy (substituir o v1)

Fazer **nesta ordem** e só leitura até o passo 3:

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
| Dados | `<diretório>/data/` → `bibliotheon.db` + `media/` (bind mount) |
| Compose | `docker-compose.prod.yml` |

## Arquivos

**`docker/Dockerfile`:** multi-stage com Node 24, `next build` com `output: "standalone"`, imagem final só com `.next/standalone`, `.next/static`, `public` e `drizzle/`. Usuário não-root. O `CMD` roda as migrations e depois `node server.js`.

**`docker-compose.prod.yml`:**

```yaml
services:
  web:
    build: { context: ., dockerfile: docker/Dockerfile }
    container_name: bibliotheon_web
    restart: unless-stopped
    env_file: .env
    ports: ["127.0.0.1:${PORTA}:3000"]
    volumes: ["./data:/app/data"]
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/saude"]
      interval: 30s
```

**`.env`** (só no servidor; modelo em `.env.example`):

```
BETTER_AUTH_SECRET=        # python3 -c "import secrets; print(secrets.token_urlsafe(48))"
BETTER_AUTH_URL=https://bibliotheon.com.br
SITE_URL=https://bibliotheon.com.br
DATABASE_PATH=/app/data/bibliotheon.db
MEDIA_DIR=/app/data/media
META_PIXEL_ID=
GA4_ID=
OWNER_EMAIL=               # usado pelo seed para criar o owner na primeira vez
PORTA=
```

**nginx do host** (`deploy/nginx/bibliotheon.com.br.conf`): `proxy_pass http://127.0.0.1:<porta>`, `client_max_body_size 30m` (uploads da CLI), gzip/brotli se disponível, HSTS. O certbot já existe para o domínio: reaproveitar o certificado do v1, ou `sudo certbot --nginx -d bibliotheon.com.br -d www.bibliotheon.com.br`.

## Primeiro deploy

```bash
cd /var/www/docker-instances && git clone <repo> Bibliotheon && cd Bibliotheon
cp .env.example .env && nano .env
mkdir -p data/media
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec web node scripts/criar-owner.mjs   # mostra a senha inicial uma vez
sudo nginx -t && sudo systemctl reload nginx
curl -I https://bibliotheon.com.br
```

Depois:

- entrar no painel e trocar a senha;
- publicar o e-book 001 (seed ou CLI);
- cadastrar no Search Console.

## Atualizar (todo deploy)

O script `atualizar.sh`, rodado no servidor, faz:

1. `git pull`;
2. backup rápido do banco (passo 1 da seção abaixo);
3. `docker compose -f docker-compose.prod.yml up -d --build`;
4. healthcheck por 60 s: se falhar, executa o rollback.

Antes de rodar, localmente:

- `npm run build && npm test`;
- Lighthouse da landing;
- auditoria impeccable se mudou algo visual.

## Backup diário

Cron do host às 03:30:

1. `sqlite3 data/bibliotheon.db ".backup data/backups/db-$(date +%F).db"` (backup consistente com WAL; não copiar o arquivo direto);
2. `tar czf` de `data/media` incremental semanal;
3. manter 14 diários + 8 semanais;
4. copiar para fora do VPS (destino a definir: outro servidor ou storage S3-compatível).

**Testar a restauração uma vez por mês:** subir uma cópia local com o backup e abrir a home.

## Rollback

Toda imagem recebe tag com o commit (`bibliotheon:<sha>`). Rollback:

```bash
git checkout <sha-anterior>
docker compose -f docker-compose.prod.yml up -d --build
```

Se houve migration destrutiva (evitar: migrations no MVP só adicionam colunas/tabelas), restaurar o backup do banco feito no passo 2 do deploy.
