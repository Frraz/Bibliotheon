# 06 — Deploy (VPS)

O VPS é o mesmo dos outros sistemas: `warley.dev.ferzion.com.br` (147.93.15.214). `bibliotheon.com.br` (sem `www`, que não tem DNS) já aponta para ele. O site está no ar em `127.0.0.1:8020`.

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
| `deploy/nginx/bibliotheon.com.br.conf` | Proxy do host, gzip, limite de taxa em `/ir/`, HSTS. **Sintaxe validada** com `nginx -t` em container descartável (certificados falsos); o `nginx -t` do servidor continua sendo a trava antes do reload |
| `atualizar.sh` (raiz) | git pull, backup, build, troca, verificação por 60 s e **rollback automático** para a imagem anterior. **Testado no servidor** (02/11/2026) |
| `deploy/backup.sh` | Backup consistente do SQLite (`VACUUM INTO`, com o site no ar) + tar da mídia e dos PDFs privados; 14 diários e 8 semanais. **Testado:** gera o arquivo e a **restauração foi verificada** (`integrity_check` ok e dados presentes) |

## Variáveis (`.env`, só no servidor)

| Variável | Quando vale | Observação |
|---|---|---|
| `SITE_URL` | **Build** | Canonical, sitemap, OG, JSON-LD. Mudar exige novo build |
| `PORTA` | Execução | Porta no loopback (a atual é a 8020) |
| `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GA4_ID` | **Build** | Opcionais. Sem eles nada de terceiros carrega e o banner de cookies nem aparece |
| `NEXT_PUBLIC_CONTATO_EMAIL` | **Build** | Aparece em Termos, Privacidade e rodapé. **Preencher antes de divulgar** (LGPD) |
| `API_TOKEN` | Execução | Token do `deploy/venda.sh` (preço, campanha, textos). Sem ele a API fica fechada |
| `HOTMART_HOTTOK`, `KIWIFY_WEBHOOK_TOKEN`, `CAKTO_WEBHOOK_SECRET` | Execução | **Opcionais.** Segredo de cada loja para os avisos de venda (`/api/v1/vendas/<loja>`, [03](03-tecnico.md#api-de-operação-etapa-vender)). Sem o da loja, o aviso dela é recusado (401) e o resto segue. Depois de criar: `./atualizar.sh --forcar` |
| `BETTER_AUTH_SECRET` | Execução | Assina o login do painel. `openssl rand -base64 32`. **Sem ele só o login falha (500); o site público segue no ar.** Trocar o valor derruba as sessões abertas |
| `SMTP_HOST`, `SMTP_PORTA`, `SMTP_USUARIO`, `SMTP_SENHA`, `EMAIL_REMETENTE` | Execução | **Opcionais.** E-mail de recuperação de senha. Sem `SMTP_HOST` tudo funciona e "Esqueci a senha" manda falar com o administrador. Gmail: `smtp.gmail.com`, porta `465`, usuário = o Gmail, senha = **senha de app** (myaccount.google.com/apppasswords; exige verificação em duas etapas). `EMAIL_REMETENTE` vazio = `Bibliotheon <usuário>`; se preencher, **entre aspas** (`EMAIL_REMETENTE="Bibliotheon <a@b.com>"`): o `atualizar.sh` lê o `.env` como shell e valor com espaço ou `<>` sem aspas dá "syntax error" (03/11/2026). Depois de editar o `.env`: `docker compose -f docker-compose.prod.yml up -d` |
| `IMAGE_TAG` | Execução | O `atualizar.sh` preenche com o commit, para rollback |

`DATABASE_PATH` e `MEDIA_DIR` já vêm definidos na imagem (`/app/data/...`).

## Painel e primeiro acesso

O painel está em `https://bibliotheon.com.br/entrar` (`/admin` e `/painel` levam para lá). Não há cadastro público: a conta do administrador nasce por comando e as demais são criadas por ele em **Usuários**.

```bash
# 1. no .env do servidor: BETTER_AUTH_SECRET=$(openssl rand -base64 32), depois ./atualizar.sh --forcar
# 2. cria o administrador (e entrega a ele os e-books que estão sem dono, como o 001); mostra a senha uma vez
docker exec -it bibliotheon_web node scripts/criar-owner.mjs voce@exemplo.com "Seu Nome"
# 3. entre em /entrar e troque a senha em Conta
```

Perdeu a senha do administrador? Rode o mesmo comando com o mesmo e-mail: ele atualiza a conta, derruba as sessões e mostra uma senha nova. Para um usuário comum, use "Redefinir senha" em Usuários.

**E-mail de recuperação não chega?** Peça pela tela `/esqueci-a-senha` com uma conta ativa e olhe `docker logs --tail 30 bibliotheon_web`: a falha de envio aparece como `[e-mail] não foi possível enviar...` (senha de app errada, porta, bloqueio do provedor). A tela nunca mostra o erro, de propósito. Conferir se o container recebeu o `.env`: `docker exec bibliotheon_web sh -c 'test -n "$SMTP_HOST" && echo ok || echo FALTA'`. O link do e-mail usa o `SITE_URL` fixado no build.

**Login não entra?** Confira primeiro `curl -s -o /dev/null -w '%{http_code}' https://bibliotheon.com.br/api/auth/ok`: tem que ser **200**. **500** = o container não recebeu `BETTER_AUTH_SECRET` (falta no `.env` ou o container não foi recriado: `docker exec bibliotheon_web sh -c 'test -n "$BETTER_AUTH_SECRET" && echo ok || echo FALTA'`). Corrija o `.env` e rode `docker compose -f docker-compose.prod.yml up -d`; a conta criada por `criar-owner` continua valendo. A tela de entrada mostra "erro 500" (e não "senha incorreta") nesse caso. Ocorreu em 02/11/2026, no primeiro deploy do painel.

**Arquivos do painel:** capas e amostras ficam em `data/media` (públicas, `/m`), e os PDFs completos em `data/privado` (sem URL pública). O `deploy/backup.sh` guarda os dois (`media-*.tgz` e `privado-*.tgz`, este com permissão só do dono). A migração `0003_pdf_privado` roda sozinha na partida. Uploads de até 25 MB cabem no `client_max_body_size 30m` do nginx: nenhuma mudança de nginx.

Atrás do nginx o limite de tentativas de login usa o `X-Real-IP` (o `deploy/nginx/bibliotheon.com.br.conf` já o envia). Testado na imagem Docker: administrador criado e recuperado, login 200, `/painel` sem sessão → 307 `/entrar`, e site de pé sem o segredo.

## Reserva

| Recurso | Valor |
|---|---|
| Domínio | `bibliotheon.com.br` (sem `www`) |
| Porta loopback | **8020**. Atenção: **8013 é do rebanho360** |
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

**Depois do primeiro deploy, nunca reenviar o banco:** o `rsync` abaixo apaga as métricas e os leads. Para preço, campanha, textos e amostra, use `deploy/venda.sh` ([03](03-tecnico.md#api-de-operação-etapa-vender)), que exige `API_TOKEN` no `.env` do servidor (`openssl rand -hex 32`, e `./atualizar.sh --forcar` depois de criar).

Colocar o e-book 001 no ar (**só no primeiro deploy; hoje os e-books novos entram pelo painel**): a imagem de produção **não inclui `tsx`**, então o seed não roda dentro do container. Para o primeiro deploy, rode o seed **na sua máquina** e envie o resultado:

```bash
# na sua máquina (pasta do projeto)
DATABASE_PATH=/tmp/envio/bibliotheon.db MEDIA_DIR=/tmp/envio/media \
  npm run seed -- ../ebooks/ebooks/001-sistemas-com-ia --extras seeds/001-sistemas-com-ia/extras.json --publicar
rsync -av /tmp/envio/ usuario@servidor:/var/www/docker-instances/Bibliotheon/data/
# no servidor: docker run --rm -v "$PWD/data:/d" alpine chown -R 1000:1000 /d && docker compose -f docker-compose.prod.yml restart web
```

Sem `--demo`. O `extras.json` do 001 já traz o preço (R$ 64,99) e a oferta Hotmart, então ele entra à venda. Se faltassem preço ou oferta, a página ficaria "Em breve".

> ⚠️ **Só no primeiro deploy.** Depois que houver dados reais em produção (e-books criados pelo painel, métricas), **nunca** envie `data/` por cima: apagaria o que foi feito lá. Hoje os e-books novos entram pelo painel (e a CLI da Etapa 4, quando existir, será o outro caminho): este passo não se repete.

nginx: **aplicado em 02/11/2026** (`deploy/nginx/bibliotheon.com.br.conf` em `/etc/nginx/sites-available/bibliotheon`). Conferido: HSTS presente e, numa rajada de 80 pedidos a `/ir/`, 35 receberam 503 (limite de taxa ativo) e a página seguiu em 200. Para mudar o conf: copiar com `sudo cp` e rodar **`sudo nginx -t && sudo systemctl reload nginx`** (o `nginx -t` também precisa de `sudo`, para ler os certificados). Os avisos `protocol options redefined` vêm de outros sites do servidor e são inofensivos. Não é preciso certbot: o certificado existe.

Depois: abrir `https://bibliotheon.com.br`, conferir OG colando o link no WhatsApp, cadastrar o domínio no Search Console e enviar o `sitemap.xml`.

## Atualizar (todo deploy)

Fluxo: commit e **push** na sua máquina → no servidor, `./atualizar.sh` (ou, de qualquer lugar: `ssh deploy@147.93.15.214 'cd /var/www/docker-instances/Bibliotheon && ./atualizar.sh'`).

O script busca o GitHub e diz se o servidor já está na última versão, se há versão nova (faz o `git pull --ff-only`) ou se o servidor está à frente (faltou o push). Se já roda a versão atual, não faz nada. Caso contrário: backup, build, troca, verificação de `/api/saude` por 60 s e **rollback automático** para a imagem anterior se não responder. Recusa rodar se houver alteração local no servidor.

`./atualizar.sh --forcar` reconstrói mesmo sem versão nova: use depois de mudar o `.env` (`SITE_URL`, Pixel, GA4, e-mail), porque esses valores entram no build.

Antes, localmente: `npm run build && npm test && npm run test:e2e`, e a auditoria impeccable se mudou algo visual.

## Checklist da próxima subida

Lista única do que **o titular** faz quando o desenvolvimento em curso for subido (atualizada a cada etapa; marcar `[x]` ao fazer). O desenvolvimento ainda não foi commitado.

**A. Urgente, não espera o deploy** (a API de produção já existe; rode nesta máquina, onde estão os arquivos)

- [ ] Até **05/11 23h59**: `export BIBLIOTHEON_TOKEN=<API_TOKEN>` e `deploy/venda.sh aplicar criar-sistemas-com-ia seeds/001-sistemas-com-ia/renomear-promocao.json` (a faixa passa a "Oferta de lançamento").
- [ ] Até **05/11 23h59**: encerrar a oferta de R$ 24,99 na **Hotmart, Kiwify e Cakto**.
- [ ] **06/11**: `./deploy/conferir-virada.sh` (preço normal, sem faixa, cada `/ir` no link normal) e abrir o checkout das três lojas para ver o valor.

**B. Antes do push**

- [ ] `DATABASE_PATH=:memory: npm run build`, `npm run lint`, `npm test` (148 unitários) e `npm run test:e2e` (103). Em 04/11/2026 tudo passou. Com a máquina muito carregada (load acima de ~10), o E2E do editor pode falhar por tempo e passar na repetição.

**C. Subida**

- [ ] `git commit` e `git push`.
- [ ] No `.env` do servidor, as três variáveis dos webhooks (ver D). Sem elas, a subida funciona e os avisos de venda são recusados.
- [ ] `./atualizar.sh --forcar` no servidor (faz backup, aplica as migrações novas (`0005` e `0006`) sozinho e aquece o cache).
- [ ] Conferir `https://bibliotheon.com.br/api/saude` e `docker ps` (os outros sistemas do VPS intactos).

**D. Webhooks de venda (depois do deploy)**

- [ ] Os segredos **vêm das lojas, não são gerados por nós**: Hotmart, o `hottok` da conta (Ferramentas → Webhook); Kiwify, o token que você define ao criar o webhook; Cakto, o `secret` que a loja gera ao criar o webhook. Vão no `.env` como `HOTMART_HOTTOK`, `KIWIFY_WEBHOOK_TOKEN` e `CAKTO_WEBHOOK_SECRET`, seguidos de `./atualizar.sh --forcar`.
- [ ] Em cada loja, cadastrar **uma única** URL para **todos os produtos**: `https://bibliotheon.com.br/api/v1/vendas/hotmart` (e `/kiwify`, `/cakto`). Eventos: compra aprovada, reembolso e chargeback. **Não precisa de uma configuração por livro**: o site descobre o livro pelo produto (id guardado na oferta, pelo link de checkout que a Cakto manda, ou pelo nome do produto igual ao título do livro, e aprende o id sozinho). **Cakto:** se o campo Produtos não tiver "todos", selecione os produtos que existem e, a cada livro novo na Cakto, lembre de acrescentá-lo a esse webhook. Use "enviar teste" e confira com `deploy/venda.sh relatorio`. Se o relatório mostrar "Vendas SEM LIVRO ASSOCIADO", o produto da loja tem nome diferente do título: informe o id (`offers[].productId`) ou renomeie o produto. Se a venda da Hotmart não aparecer, cole o exemplo do teste dela para ajustar o leitor.
- [ ] Na primeira venda real de cada loja, ver de onde veio a origem e registrar na tabela da seção 4 de [04](04-vendas-e-medicao.md#4-parâmetros-por-plataforma).

**D2. Publicar pelo terminal (Etapa 4, depois do deploy)**

- [ ] No servidor, nada novo no `.env` (usa o `API_TOKEN` que já existe). Na máquina do `../ebooks`: `./bibliotheon login` e colar esse `API_TOKEN` (ou `export BIBLIOTHEON_TOKEN=...`).
- [ ] Testar com um título que **não** esteja no ar (rascunho): `./bibliotheon validar ebooks/<pasta>` e `./bibliotheon publicar ebooks/<pasta>`; na segunda vez deve dizer "Nenhuma mudança".
- [ ] Para publicar 001, 002 ou 003 por manifesto, antes zerar as pendências de cada um no `../ebooks` (hoje: `tema_confirmado`, marcos do `status.md`, preço e oferta confirmados no `comercial.md`). Se o endereço já existe no site (criado pelo painel), use `--adotar` na primeira vez. Preço, campanha e "em breve" de livro no ar **não** mudam por manifesto: continuam com `deploy/venda.sh`.
- [ ] Rodar `./livro manifesto` nos três títulos para gerar os manifestos novos (com SEO, tema, cor e amostra em PDF). Eles trocam os arquivos em `publicacao/bibliotheon/`; a versão anterior fica em `.local/`.

**D3. Home e importação (depois do deploy)**

- [ ] Abrir a Home no celular e no computador: o topo aparece de imediato e o destaque entra logo depois, **sem a página "pular"** (a altura reservada do destaque foi calculada sem capa; se pular com a capa real, avise).
- [ ] Em Painel → Novo e-book, testar "Já tenho o manifesto do livro" com um `manifest.json` de um título que ainda não esteja cadastrado.

**E. Search Console**

- [ ] Enviar `https://bibliotheon.com.br/sitemap.xml` e pedir indexação das duas landings **e da Home**; anotar a data para a revisão de 01/12.
- [ ] Depois do deploy, aplicar os textos do Google que estavam errados no ar (descrição do 002 igual ao título; descrição do 001 com 211 caracteres): `deploy/venda.sh aplicar a-mente-inabalavel seeds/seo/a-mente-inabalavel.json` e `deploy/venda.sh aplicar criar-sistemas-com-ia seeds/seo/criar-sistemas-com-ia.json` (rode daqui, onde estão os arquivos). Ou cole nos campos "Google" do painel. Os textos vêm do `comercial.md` de cada livro; leia antes de aplicar.
- [ ] Conferir a imagem de compartilhamento da Home (cole o endereço no WhatsApp ou no depurador de compartilhamento do Facebook); Termos, Privacidade e temas passam a usá-la.

**F. Decisões pendentes**

- [ ] Black Friday de R$ 47 com só 21 dias a preço cheio (a regra do projeto pede 30): aceitar ou não.
- [ ] Ferramenta do aviso aos leads em 27/11.

**G. Black Friday (datas)**

- [ ] 26/11: criar o link de R$ 47 na Hotmart, testar a compra e trocar `PREENCHER-COM-O-LINK-PROMOCIONAL-DA-HOTMART` por ele em `seeds/001-sistemas-com-ia/black-friday.json` (só no arquivo local; o `promoUrl` das outras duas lojas também, se estiverem ativas).
- [ ] 27/11: `deploy/venda.sh aplicar criar-sistemas-com-ia seeds/001-sistemas-com-ia/black-friday.json`, `./deploy/conferir-virada.sh` e avisar os leads (`deploy/venda.sh leads`).
- [ ] 01/12: `deploy/venda.sh aplicar … seeds/001-sistemas-com-ia/fim-da-campanha.json`, `./deploy/conferir-virada.sh` e a revisão dos canais.

**H. Pendências antigas (só você faz)**

- [ ] Conferir no painel a capa e as 5 amostras da 2ª edição do 001 (`../ebooks/ebooks/001-sistemas-com-ia/publicacao/bibliotheon/`).
- [ ] Subir de novo a capa do 002 depois do deploy (vira JPEG leve).
- [ ] Apagar `testeTESTE` (Kiwify) e `TESTE` (Cakto).
- [ ] Hotmart: taxa, parcelamento, afiliação ativa, situação do produto, entrega do ZIP e confirmação escrita sobre IA.
- [ ] Enviar convites e gravar vídeos.
- [ ] Aprovar (ou pedir ajuste) o visual da landing do 003, Natal à Mesa, em `docs/05-design.md`. Ela segue fora do ar e sem cadastro no painel até o livro liberar título, teste de cozinha, preço e licença da capa.

## Backup

Cron do host às 03:30: `cd /var/www/docker-instances/Bibliotheon && ./deploy/backup.sh`. Os arquivos ficam em `~/backups/bibliotheon/` (fora de `data/`, que pertence ao uid 1000). **Cópia para fora do VPS é opcional** (decisão de 03/11/2026; nenhum destino definido e nenhum código para isso). Sem ela, o backup está no mesmo disco e não protege de perda do servidor: o titular aceita esse risco por ora.

**Testar a restauração uma vez por mês:** abrir o `.db` de backup com o SQLite (ou subir uma cópia local) e conferir `PRAGMA integrity_check` e a contagem de e-books.

Restaurar: parar o container, substituir `data/bibliotheon.db` pelo backup e extrair `media-*.tgz` e `privado-*.tgz` em `data/`, subir de novo.

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
