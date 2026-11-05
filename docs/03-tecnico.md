# 03 — Técnico

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Runtime | Node 22+ no desenvolvimento; `node:24` (LTS) na imagem Docker | O PC de desenvolvimento tem Node 22; o Next 16 funciona nos dois |
| Framework | **Next.js 16** (App Router, **Cache Components** + Partial Prefetching ligados) + TypeScript estrito | Páginas públicas pré-renderizadas (HTML pronto, ótimo para SEO e mobile). Painel e API no mesmo app, em um container. **A versão 16 tem convenções novas: ler `node_modules/next/dist/docs/` antes de codar** |
| UI | Tailwind CSS v4 + shadcn/ui, estilo `base-nova` (componentes **Base UI**, não Radix) + `lucide-react` | Painel profissional pronto; é a base em que as skills de design rendem mais. `cn()` vem do pacote `cn` (mantido pelo próprio shadcn, substitui clsx + tailwind-merge) |
| Movimento | Hoje só CSS e transições simples (sem biblioteca). **Motion e GSAP não estão instalados** (Motion e GSAP só entram se o design pedir, com decisão registrada) | Ver [05-design](05-design.md#movimento) |
| Banco | SQLite (better-sqlite3, modo WAL) + Drizzle ORM + drizzle-kit migrations | Um arquivo, zero serviço; backup é uma cópia. Migrar para Postgres é simples se um dia for preciso |
| Auth | Better Auth (e-mail/senha, sessão em cookie httpOnly guardada no banco) com `role` e `ativo`; hash de senha scrypt próprio (`src/lib/senha.ts`) | Login seguro pronto; sem cadastro público; recuperação de senha por e-mail com `nodemailer` e SMTP opcional (`src/lib/email.ts`). O hash próprio deixa o `scripts/criar-owner.mjs` rodar na imagem sem `tsx` |
| Validação | Zod (formulários, API e manifesto compartilham os schemas) | Uma regra, três usos |
| Formulários | `<form>` nativo + Zod; Server Actions (painel) e rotas (uploads, login, pedido de amostra). Regras puras em `src/lib/editor.ts` | Sem `react-hook-form`: não está instalado |
| Imagens | `next/image` (otimizador do próprio Next, que usa sharp) sobre a rota `/m/...`; arquivos com hash no nome | LCP baixo, AVIF/WebP e tamanhos sob demanda sem pipeline nosso. Cache imutável em `/m` |
| OG | `next/og` (ImageResponse) por e-book, com a fonte Fraunces embutida em `src/assets/fonts/` (licença OFL ao lado) | Prévia bonita em anúncios e WhatsApp. No runtime Node a fonte é lida com `readFile` (não `fetch`). A capa entra **reduzida** (600 px, JPEG, via `sharp`): o original pesado (PNG de 12 MB) fazia o gerador falhar com 502. Falha na capa só tira a capa da imagem |
| Testes | Vitest (regras e API) + Playwright (fluxos críticos) | Só o que protege venda e dados |
| CLI | Python 3, só biblioteca padrão (`ferramentas/publicar.py`, Etapa 4) | Roda a partir do `../ebooks` sem instalar nada |
| E-mail | `nodemailer` + SMTP qualquer (`src/lib/email.ts`), só para recuperar senha. Opcional | Sem `SMTP_HOST` o resto funciona. Ver "Recuperação de senha" abaixo |

Proibido no MVP (exige decisão registrada para entrar):

- Redis;
- fila;
- microserviço;
- CMS de terceiros;
- GraphQL;
- serviço de e-mail pago ou de marketing (o SMTP próprio para recuperar senha é a exceção, decidida em 03/11/2026);
- serviço externo de analytics além de Meta Pixel/GA4.

## Estrutura de pastas

```
bibliotheon/
├── src/
│   ├── app/
│   │   ├── (site)/                 # público: layout da marca
│   │   │   ├── page.tsx            # home
│   │   │   ├── [slug]/page.tsx     # landing
│   │   │   ├── [slug]/opengraph-image.tsx
│   │   │   ├── tema/[slug]/page.tsx
│   │   │   ├── termos/ privacidade/
│   │   ├── ir/[ofertaId]/route.ts  # clique rastreado → redirect
│   │   ├── m/[...path]/route.ts    # serve mídia do volume, cache imutável
│   │   ├── entrar/  esqueci-a-senha/  redefinir-senha/   # login e recuperação
│   │   ├── painel/                 # (menu)/ = lista, editor, temas, usuários, conta; ebooks/[id]/previa
│   │   ├── api/auth/[...all]/route.ts
│   │   ├── api/painel/ebooks/[id]/{capa,amostras,pdf,amostra-pdf,exportar}/route.ts  # arquivos do painel
│   │   ├── api/v1/ebooks/[slug]/route.ts  # operação: PATCH (preço, campanha, textos)
│   │   ├── api/v1/ebooks/[slug]/amostra/route.ts, api/v1/metricas, api/v1/leads
│   │   ├── api/v1/v/route.ts       # beacon de visita
│   │   ├── api/saude/route.ts      # healthcheck do container
│   │   ├── sitemap.ts  robots.ts
│   ├── components/
│   │   ├── ui/                     # shadcn
│   │   ├── site/                   # seções da landing, cards
│   │   └── painel/
│   ├── db/schema.ts  db/index.ts
│   ├── lib/                        # auth, imagens, ofertas, utm, métricas, manifesto
│   └── landings/                   # landings personalizadas (registro.ts + uma pasta por e-book)
├── drizzle/                        # migrations geradas
├── ferramentas/publicar.py         # CLI de publicação pelo manifesto (Etapa 4)
├── scripts/seed.ts                 # importa um título (manifest + extras) para o banco LOCAL; em produção vale a API (`POST /api/v1/ebooks`)
├── scripts/servir-teste.sh         # sobe o build standalone com banco temporário (usado pelo Playwright)
├── seeds/001-sistemas-com-ia/      # campos de venda do 001 que o manifest v1 ainda não traz + amostras
├── e2e/                            # testes Playwright + título de teste sintético
├── atualizar.sh                    # no servidor: pull, confere versão, backup, build, troca, rollback
├── deploy/                         # backup.sh, aquecer.sh, venda.sh, nginx
├── scripts/criar-owner.mjs         # cria o owner na 1ª vez (JS puro: roda na imagem standalone)
├── data/                           # NÃO versionado: bibliotheon.db + media/
├── docker/Dockerfile  docker-compose.prod.yml
└── docs/
```

## Modelo de dados

Convenções:

- IDs são texto (UUID v4, `crypto.randomUUID()`);
- datas em UTC (ISO);
- dinheiro em **centavos** (inteiro);
- listas em coluna JSON validada por Zod.

**user, session, account, verification** (tabelas do Better Auth, migração `0002_usuarios`). `user` ganha `role: 'owner' | 'parceiro'` (na tela, "Administrador" e "Publicador") e `ativo: boolean`. A senha fica em `account.password` (`providerId = 'credential'`). `ebook.ownerId` aponta para `user.id` sem FK (o SQLite não adiciona FK a tabela existente sem recriá-la).

**Acesso (Fase 1):** `src/lib/acesso.ts` (`usuarioAtual`, `exigirUsuario`, `exigirOwner`) lê a sessão e o `ativo` do banco **a cada pedido, sem cache**, sempre depois de `headers()` (assim o build não cria o Better Auth, que exige o segredo). `src/lib/permissoes.ts` tem a regra pura `podeEditar`. `src/proxy.ts` só redireciona `/painel` para `/entrar` quando falta o cookie (checagem otimista). Não-administrador em página de administrador vê "Página não encontrada". Desativar apaga as sessões da pessoa; o hook de criação de sessão recusa quem está desativado. Entrar, sair e trocar a senha passam por `/api/auth/*` (com o limite de tentativas do Better Auth); criar usuário, redefinir senha e ativar/desativar são Server Actions só do administrador.

**tema**

| Campo | Tipo | Nota |
|---|---|---|
| id, nome, slug (único), descricao, cor, ordem, publicado | | `descricao` alimenta SEO da página de tema |

**ebook**

| Grupo | Campos |
|---|---|
| Identidade | `id`, `ownerId` → user, `temaId` → tema, `sourceId` (único com `idioma`, nulo se criado no painel), `idioma` (padrão pt-BR), `edicao`, `slug` (único), `status: rascunho \| revisao \| publicado`, `destaque: boolean`, `publicadoEm`, `criadoEm`, `atualizadoEm` |
| Essencial | `titulo`, `subtitulo`, `autorExibido`, `formatos: string[]`, `capa` (chave da mídia), `capaHash`, `capaAlt`, `accent` (hex) |
| Venda | `headline`, `resumo` (1–2 frases), `problema` (1 frase), `descricao` (texto longo, parágrafos), `dores: string[]`, `beneficios: string[]`, `diferenciais: string[]`, `paraQuem: string[]`, `naoEPara: string[]`, `incluido: string[]`, `observacoes` (antes de comprar), `sobreAutor`, `autorFoto` |
| Conteúdo | `sumario: string[]`, `faq: {p, r}[]`, `amostraPdf` (opcional) |
| Preço | `preco`, `precoDe` (opcional), `ofertaAte` (opcional), `ofertaNome` (opcional; "Black Friday"), `parcelamento` (opcional), `garantiaDias` (padrão 7), `emBreve: boolean` |
| SEO/medição | `seoTitle`, `seoDescription` (opcionais; fallback headline/resumo), `metaPixelId` (opcional) |

Acrescentados depois: `ebook.pdfPrivado` (chave do PDF completo em `data/privado`) e `ebook.pdfNome` (nome original, só para exibir); `figura`, `figuraAlt` e `figuraLegenda` (imagem da seção de descrição).

**amostra**: `id`, `ebookId`, `imagem`, `alt`, `ordem`.

**oferta**: `id`, `ebookId`, `produtoExterno` (id do produto na loja, para os avisos de venda), `plataforma` (`hotmart | kiwify | cakto | eduzz | monetizze | ticto | perfectpay | amazon | google_play | outra`), `rotulo` (opcional; padrão "Comprar na <Plataforma>"), `url`, `urlPromo` (checkout da campanha), `preco` (opcional, quando difere do preço do e-book), `principal: boolean` (exatamente uma por e-book com ofertas ativas), `ativa`, `ordem`.

Adicionar uma plataforma = um item no enum + logo SVG em `public/plataformas/` + regra de parâmetros em `lib/ofertas.ts`.

**metrica_diaria**: `ebookId`, `data` (AAAA-MM-DD), `ofertaId` (nulo = visita), `origem` (`utm_source` ou "direto"), `contagem`. Chave única pelos quatro primeiros campos; incremento com `ON CONFLICT DO UPDATE`. **Sem IP, sem cookie, sem dado pessoal.**

**venda**: `id`, `ebookId` (nulo = produto sem livro associado), `plataforma`, `produtoExterno`, `produtoNome`, `transacao` (único com a plataforma: reenvio não conta duas vezes), `status` (`aprovada | reembolsada`), `valor` (centavos), `valorInformado` (falso = a loja não mandou o valor e usamos o preço vigente), `afiliado`, `origem` (convenção de UTM), datas. **Sem dado do comprador.** Reembolso que chega antes da compra também fica registrado.

**lead**: `id`, `ebookId`, `email`, `origem`, `criadoEm`; único por e-book + e-mail. Só quem pediu a amostra e aceitou receber avisos.

_`api_token` (tokens por usuário para a CLI) e `slug_antigo` (redirect de endereço) **não existem**: eram planos da Etapa 4. Hoje a API de operação usa um `API_TOKEN` único do servidor, e o endereço trava na primeira publicação._

## Regras de negócio (testadas)

1. **Preço vigente:**
   - se `ofertaAte` existe e já passou, vigora `precoDe` e a faixa/riscado somem;
   - se `ofertaAte` está no futuro, mostra `preco`, `precoDe` riscado e o countdown.

   A regra roda no servidor e é recalculada no cliente (o HTML pode ter até 5 min de cache). `precoDe` sem `ofertaAte` mostra riscado sem timer.
2. **Publicar exige:** capa, descrição da capa, título, headline, resumo, ≥3 benefícios, endereço válido e tema no ar (se houver). Sem loja ativa (ou sem preço) a página sai como "Em breve".
3. **Usuário comum (Publicador):** só lê, edita, publica e baixa o PDF dos e-books com `ownerId` = ele; não cria tema nem vê os de outros. **Publica direto, sem revisão.** O status `revisao` existe no esquema mas nenhuma tela o usa.
4. **Slug:** gerado do título, minúsculo, sem acento. Não pode colidir com rotas reservadas ([02](02-experiencia.md#mapa-do-site)). O endereço é editável até a primeira publicação e depois **fica travado** (por isso não há redirect).
5. **Visibilidade:** só `status = publicado` com tema publicado aparece em home, tema, sitemap e busca. `?previa=1` funciona apenas com sessão do dono ou do owner e manda `noindex`.

## Renderização e cache

Next 16 com **Cache Components**. O que foi implementado e testado na Etapa 2:

| Rota | Estratégia | Por quê |
|---|---|---|
| `/[slug]`, `/tema/[slug]` | `ensureStatic = 'navigation'` + `generateStaticParams` | Página inteira estática. O primeiro acesso a um slug novo **espera a página completa** (não serve esqueleto), o que importa para o Google. Dados via funções `use cache` |
| `/` (Home) | `connection()` dentro de `<Suspense>` | O banco do build é vazio: ler no pedido evita que o primeiro visitante pós-deploy veja uma Home vazia. As consultas continuam em cache |
| `/termos`, `/privacidade` | Estáticas | Sem dados |
| `/entrar` | Estática (○) | Só formulário; o aviso "senha nova salva" lê a URL no navegador |
| `/esqueci-a-senha`, `/redefinir-senha` | Parcialmente pré-renderizadas (◐) | A moldura é estática; o que depende do `.env` (SMTP configurado?) ou do token na URL fica em `<Suspense>` e é lido no pedido |
| `/ir/[ofertaId]`, `/api/*`, `/m/*`, `sitemap.xml` | Dinâmicas | Gravam métrica, leem arquivo/banco por pedido. `/api/saude` e `sitemap` chamam `connection()` para **nunca** serem pré-renderizadas |

- **Dados:** `src/lib/catalogo.ts`, funções `use cache` com `cacheLife("minutes")` e tags `ebooks`, `ebook:<slug>`, `tema:<slug>`, `temas`. Tudo serializável (datas em ISO). Quando o painel (Etapa 3) ou a API (Etapa 4) gravarem, chamam `revalidateTag`/`updateTag` dessas tags e a página nova aparece na hora.
- **Slug sentinela `_`:** o Next exige ao menos um conjunto de parâmetros em `generateStaticParams`, e o build do Docker não tem banco. `slugsDosEbooks()` devolve `["_"]` quando não há dados (a página vira 404). Os slugs reais são gerados no primeiro acesso.
- **Banco em memória no build:** `DATABASE_PATH=:memory:` nasce já migrado (vazio), para as consultas do build não falharem.
- **Restrição do `ensureStatic`:** vale para a rota inteira, **inclusive o layout**. Nada de `connection()`, `cookies()` nem consulta sem cache em layout ou página dessas rotas. Foi por isso que a navegação de temas saiu do cabeçalho.
- **Preço e urgência:** o servidor entrega o estado do momento em que o cache foi preenchido; o navegador recalcula com a hora real (`OfertaProvider`, `useSyncExternalStore`). Quando a oferta vence, a faixa some e o preço sobe sozinho mesmo com a página em cache. Antes de hidratar, a faixa reserva o mesmo espaço (altura e largura) para não gerar CLS.
- **Mídia:** `/m/<chave>` com `Cache-Control: public, max-age=31536000, immutable` (o nome do arquivo leva o hash). Aceita `MEDIA_DIR` relativo ou absoluto.
- **Visitas:** a landing envia `navigator.sendBeacon('/api/v1/v', {s: slug, o: utm_source})` uma vez por e-book por sessão. Robôs e pré-visualizadores (WhatsApp etc.) são ignorados por user-agent.
- **`SITE_URL` fixado no build** (`env` em `next.config.ts`): vale igual para o que é estático e para o dinâmico.

## Saída rastreada `/ir/[ofertaId]`

1. Busca a oferta **ativa** de um e-book **publicado**; se não existir, redireciona para `/` (nunca para fora).
2. Descobre a origem: parâmetros da própria URL; se a requisição chegou **sem** nenhum (clique antes de o JavaScript carregar), recupera os da página de onde veio pelo cabeçalho `Referer`, **só se for do próprio site** (`SITE_URL`). Função pura `parametrosDeOrigem`, testada.
3. Monta a URL de destino: mantém a query já cadastrada na oferta e repassa `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `src`, `sck`, `fbclid`, `gclid` (cada valor limitado a 200 caracteres; em conflito vale o recebido). **Só aceita destino `https`.**
4. Conta o clique (não conta robôs nem pré-visualizadores; `origem` só aceita valores da convenção de UTM, o resto vira `outro`). Falha de métrica **nunca** impede o redirecionamento.
5. Responde `302` com `Cache-Control: no-store` e `X-Robots-Tag: noindex`. Os redirecionamentos internos usam `SITE_URL`, não `req.nextUrl.origin` (atrás do nginx a origem interna não é a pública).

A landing propaga os parâmetros da sua própria URL para os links `/ir/...` (componente `LinkOferta`, um `<a>` comum, sem prefetch). Os nomes aceitos por cada plataforma estão em [04](04-vendas-e-medicao.md#4-parâmetros-por-plataforma).

## API de operação (Etapa "Vender")

Autenticação: `Authorization: Bearer <API_TOKEN>` (variável do servidor; sem ela, tudo responde 401). Uso: `deploy/venda.sh`.

| Rota | O que faz |
|---|---|
| `PATCH /api/v1/ebooks/[slug]` | Textos, preço, campanha e ofertas, com os nomes do manifesto (`book`, `offers`). Ausente não muda; `null` limpa a campanha. Ofertas são atualizadas por plataforma, nunca recriadas, para os links `/ir` e os contadores continuarem valendo. **Recusa (422) campanha que muda o preço sem `promoUrl` em toda oferta ativa.** Grava em transação e invalida o cache |
| `PUT /api/v1/ebooks/[slug]/amostra` | Corpo = o PDF de amostra (até 15 MB, assinatura `%PDF-`) |
| `GET /api/v1/metricas?dias=&vendas=&afiliadas=` | Relatório em texto: visitas, cliques e taxa por origem; vendas registradas pelos webhooks (por origem, faturamento, sobra estimada, clique→venda) e o mês contra a meta; `vendas=`/`afiliadas=` seguem como estimativa |
| `GET /api/v1/leads` | CSV dos pedidos de amostra |

**Webhooks de venda — uma URL por loja, para todos os livros** (`POST /api/v1/vendas/[plataforma]`, `plataforma` = `hotmart | kiwify | cakto`; no cadastro do webhook da loja, "todos os produtos"). O livro vem do **produto que a loja informa**: 1) o id do produto guardado na oferta daquela loja (`oferta.produtoExterno`, vindo de `offers[].productId` do manifesto ou do `PATCH`); 2) senão, o **link de checkout** da compra (a Cakto o manda em `data.checkoutUrl`), igual ao link cadastrado na oferta (normal ou da campanha; parâmetros e barra final ignorados); 3) senão, o nome do produto igual ao título de um único livro (acentos, caixa e pontuação ignorados). Achando por 2 ou 3, o id do produto é **aprendido** e gravado na oferta. Produto desconhecido: a venda fica guardada **sem livro** (`venda.ebookId` nulo, com id e nome do produto) e aparece no relatório em "Vendas SEM LIVRO ASSOCIADO"; ela se associa sozinha quando o livro passar a ser conhecido (`reconciliarVendas`, no relatório e depois de gravar ofertas). A rota antiga por livro (`/api/v1/vendas/[plataforma]/[slug]`) continua valendo, para quem quiser um webhook por produto. Não usa o `API_TOKEN`: cada loja tem o seu segredo (`HOTMART_HOTTOK`, `KIWIFY_WEBHOOK_TOKEN`, `CAKTO_WEBHOOK_SECRET`) e o jeito dela de provar a origem (`src/lib/vendas.ts`): Hotmart, header `X-HOTMART-HOTTOK`; Kiwify, `?signature=` (HMAC-SHA1 do corpo cru, vetor oficial nos testes); Cakto, `X-Cakto-Signature` (HMAC-SHA256 de `timestamp.corpo`, 5 min) ou o `secret` do corpo. Respostas: 401, 404 (loja desconhecida; na rota por livro, também livro desconhecido), 413, 422 (formato não reconhecido, vai ao log só com os nomes dos campos), 200 (gravado, repetido ou evento ignorado; com `associada: true|false`). **Conferência dos formatos:** Cakto **conferido contra o "Modelo" que o painel dela mostra** em 05/11/2026 (`data.id`, `data.amount` em reais já com desconto, `data.affiliate`, `data.product.id/name`, `data.checkoutUrl`, `data.utm_*`; o modelo de reembolso e de chargeback ainda não foi visto); Kiwify só id e evento (valor, origem e produto não documentados: usa o preço vigente e a origem `direto`); Hotmart **não conferido na documentação oficial** (a página não abriu), campos de fonte secundária, inclusive `data.product.id/name`. O produto da Kiwify e da Cakto é tentado por mais de um nome. Validar cada loja com o botão de teste antes de confiar nos números.

`POST /api/v1/leads` é público: guarda o e-mail com aceite (`pedidoDeAmostra`), com limite por IP e campo isca, e devolve o link do PDF. É rota, e não Server Action, porque a landing fica em cache e uma Server Action antiga quebraria depois de um deploy.

**`/ir` e campanha:** enquanto `precoVigente().emOferta`, o `/ir` usa `oferta.urlPromo`; depois do prazo, `oferta.url`. Assim a página e o checkout mudam juntos.

## API de publicação pelo manifesto (Etapa 4, feita em 05/11/2026)

Autenticação: o mesmo `Authorization: Bearer <API_TOKEN>` da API de operação (token único do servidor; **tokens por usuário não existem**: a Etapa 4 não precisou deles). Quem usa: `ferramentas/publicar.py` (`./bibliotheon` em `../ebooks`).

### `POST /api/v1/ebooks[?dryRun=1][&publicar=1][&adotar=1][&amostras=1]`

`multipart/form-data`: `manifest` (JSON), `capa`, `amostras` (vários, na ordem do manifesto) e `amostraPdf`. Núcleo em `src/lib/publicar-manifesto.ts` (o painel usará o mesmo).

1. Valida o manifesto (Zod). `pending` não vazio → `422` com a lista em `detalhes`.
2. Procura o e-book por `sourceId + idioma`. Se não achar e o endereço já existir: `409` (outro livro) ou `409` com o aviso para repetir com `adotar=1` (criado no painel, sem `sourceId`). Sem associação mágica.
3. Calcula `mudancas` em português ("Headline: “antes” → “depois”"). `dryRun=1` responde só isso, sem gravar. A resposta diz, para `capa`, `amostras` e `amostraPdf`, se é `igual`, se o cliente precisa `enviar` o arquivo ou se foi `recebida`: o cliente só manda o que mudou. A capa é igual quando `cover.sha256` é o `capaHash` guardado; as amostras, quando a quantidade e as legendas coincidem (ou `amostras=1` força a troca).
4. Grava em transação. **O manifesto vence nos campos que traz; os ausentes ficam como estão.** `offers` vazio ou ausente não toca nas lojas; as presentes são atualizadas por plataforma (nunca recriadas). Tema inexistente é criado **fora do ar** (`themeName`/`themeDescription` ou o slug).
5. **E-book já publicado:** preço, `priceFrom`, prazo, nome da campanha e "em breve" **não mudam por aqui** (aviso na resposta; use `deploy/venda.sh`), e o endereço não muda. Foi decisão de proteção: o manifesto do 001 traz R$ 64,99 e desfaria uma promoção.
6. Novo = `rascunho`. `publicar=1` publica só se o checklist do editor estiver completo (inclui tema no ar); senão responde `422` com o que falta e **não grava nada**. E-book no ar nunca fica incompleto por manifesto.
7. Responde `{ id, slug, status, url, previewUrl, acao, mudancas, avisos, capa, amostras, amostraPdf, gravado }`. Erros: `{ erro, detalhes? }`.

### `GET /api/v1/ebooks/[slug]`

Aceita o endereço **ou** o `sourceId` (`?idioma=`, padrão `pt-BR`). Responde `{ id, slug, status, url, atualizadoEm, ofertas }`.

## CLI `ferramentas/publicar.py` (Etapa 4)

```
python3 ferramentas/publicar.py publicar <pasta-do-titulo> [--publicar] [--sim] [--adotar] [--amostras]
python3 ferramentas/publicar.py validar|consultar <pasta-do-titulo>
python3 ferramentas/publicar.py login            # pede o token (oculto) e salva
```

- Lê `<pasta>/publicacao/bibliotheon/manifest.json` + os arquivos que ele cita. Só biblioteca padrão.
- `publicar`: faz o `dryRun`, imprime as mudanças, pergunta `Enviar? [s/N]` (`--sim` pula), envia só os arquivos pedidos e mostra a URL (ou a prévia). Sem mudança: "Nenhuma mudança." `validar` para depois do `dryRun`.
- Token em `~/.config/bibliotheon/token` (permissão 600) ou `BIBLIOTHEON_TOKEN`; destino em `BIBLIOTHEON_URL` (padrão `https://bibliotheon.com.br`). Saídas: 0 ok, 1 erro de validação ou servidor, 2 uso incorreto.
- Exemplo canônico do manifesto: [`docs/exemplos/manifest.example.json`](exemplos/manifest.example.json).

## Contrato do manifesto

Aceita **o `bibliotheon-editorial/v1` existente sem mudanças** (ex.: `../ebooks/ebooks/001-sistemas-com-ia/publicacao/bibliotheon/manifest.json`) e campos opcionais novos.

| Manifesto | Campo no Bibliotheon | Nota |
|---|---|---|
| `contract` | — | aceita `bibliotheon-editorial/v1` e `/v2` |
| `sourceId`, `language`, `edition` | `sourceId`, `idioma`, `edicao` | chave do upsert |
| `book.title` / `book.slug` | `titulo` / `slug` | |
| `book.subtitle` *(novo)* | `subtitulo` | v1 não tem: a CLI lê `metadados.json → subtitulo` da pasta do título como fallback |
| `book.theme` | tema por slug | |
| `book.summary` | `resumo` | |
| `book.body` | `descricao` | |
| `book.problem` | `problema` | |
| `book.promise` | sugestão de `headline` **só se** headline estiver vazio | aviso na CLI recomendando escrever headline de verdade |
| `book.audience` | `paraQuem` | string vira lista de 1 item; lista é aceita |
| `book.requirements` + `book.limits` | `observacoes` | unidos em parágrafos |
| `book.benefits` | `beneficios` | |
| `book.accent` (`#RRGGBB`) ou `book.accentPreset` | `accent` | o hex vale mais que o preset (ex.: `mineral`). Só é guardado; as landings têm cores próprias |
| `book.materialState`, `book.presentationVariant` | — | ignorados (aviso informativo) |
| `cover.file` / `cover.alt` / `cover.sha256` | `capa` / `capaAlt` / `capaHash` | |
| `pending` | — | não vazio bloqueia |
| `offers[]` | `oferta` | ver formato abaixo |

Campos opcionais novos em `book`: `seoTitle`, `seoDescription` (Google; o editor só avisa de 60 e 155 caracteres e de preço), `themeName`, `themeDescription` (criam o tema novo), `pains[]` (`dores`), `differentiators[]` (`diferenciais`), `offerName`, `installments`, `subtitle`, `headline`, `author`, `authorBio`, `formats[]`, `notFor[]`, `included[]`, `toc[]`, `faq[{q,a}]`, `price` (número em reais, ex.: `29.9`), `priceFrom`, `offerEndsAt` (ISO 8601 com fuso), `guaranteeDays`, `comingSoon`. Topo: `samples[]` (arquivos na mesma pasta, em ordem), `samplePdf`.

Formato de oferta:

```json
{ "platform": "kiwify", "url": "https://pay.kiwify.com.br/xxxx", "promoUrl": "https://pay.kiwify.com.br/xxxx?coupon=BF", "price": 29.9, "primary": true, "label": "Comprar na Kiwify" }
```

Campos desconhecidos geram aviso, nunca erro. Um exemplo canônico completo fica em `docs/exemplos/manifest.example.json`.

## Landing personalizada

Todo e-book usa a **landing padrão**. Quando o titular desenha uma página própria (mais longa, mais comercial), ela entra no ar pelo deploy e **assume o endereço do e-book sozinha**, sem campo no banco. Texto, preço, campanha e lojas continuam vindo do painel: mudar preço ou link não exige novo deploy.

| Peça | Onde | Função |
|---|---|---|
| Registro | `src/landings/registro.ts` | `Map` slug → componente com o **corpo** da página (só as seções). `Map` e não objeto: "constructor" nunca casa com uma propriedade herdada |
| Escolha | `src/landings/pagina.tsx` (`PaginaDeVendas`) | Usada pela página pública **e pela prévia do painel**: a personalizada se existir; senão a padrão |
| Molde | `src/components/site/molde-pagina.tsx` | Aplicado por fora a toda página: preço vigente e contagem da campanha, dados estruturados (`Book`, `Product`, `FAQPage`, `BreadcrumbList`) e contagem de visita. Nenhuma página personalizada pode esquecê-los |
| Moldura | `src/components/site/moldura.tsx` | `CabecalhoSite` e `RodapeSite`. A landing personalizada põe a versão `discreto` como primeiro e último filho da sua raiz colorida (herdam a cor da faixa, servem a qualquer paleta); o cabeçalho/rodapé do layout somem enquanto ela está na tela (regra em `globals.css`). Sem isso, a landing mostraria duas molduras |
| Peças de compra | `src/components/site/compra.tsx` | `BotaoDeCompra`, `CompraNoMeio`, `BlocoDeCompra` (`#comprar`) e `BarraDeCompra`, com a regra de uma ou várias lojas |

**Receita para uma página nova** (`<slug>` = o endereço do e-book):

1. No painel, use **Exportar dados** e **Baixar PDF** e guarde em `livros/<slug>/` (fora do Git: o repositório é público).
2. Crie `src/landings/<slug>/pagina.tsx` exportando um componente `({ e, relacionados, previa }: PropsLanding)` que devolve **só as seções**. Use `PrecoAtual`, `AvisoPrazo`, `FaixaUrgencia` (de `site/oferta`) e as peças de compra; ponha o `id="topo"` no cabeçalho (a barra fixa o usa) e termine com `<BlocoDeCompra e={e} previa={previa} />` e `<BarraDeCompra ... />`.
3. Ponha `<CabecalhoSite discreto />` como primeiro filho e `<RodapeSite discreto />` como último da raiz da página (`site/moldura`). Se a página for toda escura, marque a raiz com `data-superficie="escura"` (fundo atrás da barra de rolagem). Cadastre no `registro.ts`: `["<slug>", PaginaX]`.
4. Confira cada frase contra o livro (regra 5 do `CLAUDE.md`), veja a prévia no painel, rode a auditoria impeccable e o Lighthouse.
5. Commit, seu `git push`, `./atualizar.sh`. O painel passa a mostrar "Página de vendas: personalizada".

Páginas prontas: `a-mente-inabalavel` (seletor de problemas), `criar-sistemas-com-ia` (primeiro pedido à IA e as cinco etapas) e `natal-a-mesa` (seletor de cardápios por número de pessoas e uma receita inteira; sem foto de prato porque o livro não tem). Cada uma tem os textos próprios em `conteudo.ts`, copiados do manuscrito, e o E2E (`e2e/landing-personalizada.spec.ts`) os confere contra `../ebooks` quando ele está na máquina.

Título, descrição e imagem de compartilhamento continuam vindo do banco (campos de SEO do editor) e do gerador de OG por e-book: a página personalizada não os substitui.

## Painel de e-books (Fase 2)

| Peça | Onde | Observação |
|---|---|---|
| Regras puras (endereço, dinheiro, datas, formulário, checklist) | `src/lib/editor.ts` (+ teste) | Endereços reservados em `SLUGS_RESERVADOS`; data da campanha em hora de Brasília (-03:00), gravada em UTC |
| Gravação | `src/lib/ebooks.ts` (`gravarEbook`) | Valida tudo antes de escrever; escreve em transação; lojas por id |
| Ações | `src/app/painel/(menu)/ebooks/acoes.ts`, `temas/acoes.ts` | Cada uma reconfere sessão e `podeEditar`; `updateTag("ebooks")` ao gravar |
| Arquivos | `/api/painel/ebooks/[id]/{capa,amostras,pdf,amostra-pdf}` | Sessão + dono + `Origin`; imagem conferida e regravada pelo `sharp` (`src/lib/imagens.ts`); PDF por assinatura `%PDF-` |
| Exportação | `/api/painel/ebooks/[id]/exportar?formato=md\|json`, `src/lib/exportar.ts` | Mesmo acesso das outras rotas de arquivo. Lista de campos explícita: o local do PDF privado nunca sai |
| Prévia | `/painel/ebooks/[id]/previa` | `<Landing previa>`: sem dados estruturados, sem visita, botões de compra desligados; `montarEbookPublico` (`src/lib/catalogo.ts`) é o mesmo montador da página pública |

**Publicar:** bloqueiam capa, descrição da capa, título, headline, resumo, ≥ 3 benefícios, endereço válido e tema no ar (se houver tema). Sem loja ou sem preço a página sai como "Em breve" (só avisa). Um e-book já publicado nunca é salvo incompleto. O endereço é editável até a primeira publicação e depois fica travado (mesmo despublicado).

## Recuperação de senha por e-mail

Opcional: só liga com `SMTP_HOST` no `.env` ([06](06-deploy.md#variáveis-env-só-no-servidor)). Sem ele, `/esqueci-a-senha` manda falar com o administrador, que cria uma senha temporária em Usuários.

1. `/esqueci-a-senha` chama `requestPasswordReset` do Better Auth. A resposta é **sempre a mesma**, exista a conta ou não, e o envio não é aguardado (o tempo da resposta não revela quem tem cadastro).
2. `sendResetPassword` (`src/lib/auth.ts`) ignora conta desativada e envia pelo `nodemailer` (`src/lib/email.ts`). Falha de envio vai só ao log do servidor (`[e-mail] não foi possível enviar...`).
3. O link (`/api/auth/reset-password/<token>`, usa o `SITE_URL` do build) vale 1 hora e uma vez; leva a `/redefinir-senha?token=...`, que chama `resetPassword`. A senha nova usa o mesmo hash scrypt do login e derruba as sessões abertas.
4. `EMAIL_SAIDA_DIR` grava cada e-mail em JSON no lugar de enviar: é como os testes E2E leem o link (`scripts/servir-teste.sh`). Não use em produção.

## Segurança

- **Senha:** mínimo de **4 caracteres**, sem regra de composição (decisão do titular, 03/11/2026; `SENHA_MINIMA` em `src/lib/regras-senha.ts`). Como a senha pode ser fraca, o limite de tentativas do login e a verificação em duas etapas (abaixo) é que protegem a conta.
- **Verificação em duas etapas, opcional por usuário:** plugin `twoFactor` do Better Auth, só app autenticador (TOTP de 6 dígitos, 30 s) e 10 códigos de reserva de uso único. Tabela `two_factor` (migração `0004_duas_etapas`) e `user.two_factor_enabled`; segredo e códigos ficam cifrados com o `BETTER_AUTH_SECRET` (**trocar o segredo invalida os códigos já cadastrados**: as pessoas teriam de religar). O login com a verificação ligada passa por `/api/auth/two-factor/*` e a conta trava por 15 min após 10 códigos errados seguidos. O QR é gerado no navegador (`qrcode`, carregado só na tela de ligar). Celular perdido: o administrador usa "Nova senha" em Usuários (desliga a verificação da pessoa) ou, para a conta dele, `node scripts/criar-owner.mjs <e-mail>` no servidor; um código de reserva também entra.
- Better Auth: hash de senha forte, rate limit no login e no pedido de recuperação (3 por minuto por IP), cookie `httpOnly; Secure; SameSite=Lax`.
- Todas as Server Actions e rotas do painel conferem sessão **e** dono do recurso no servidor.
- **Uploads:**
  - limite de 10 MB por imagem;
  - formato validado pelo conteúdo (o `next/image`/sharp recusa o que não for imagem), e `/m` só serve extensões da lista (jpg, png, webp, avif, pdf), nunca o banco nem scripts;
  - EXIF removido;
  - PDF de amostra até 15 MB, com conferência da assinatura `%PDF`.
- Cabeçalhos (em `next.config.ts` e no nginx): `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, HSTS. **Sem CSP com nonce:** o nonce exige renderização dinâmica e derrubaria as páginas estáticas; o site não renderiza conteúdo de usuário sem escape. Reavaliar com CSP por hash se o painel (Etapa 3) pedir.
- `/ir` só redireciona para URLs de ofertas cadastradas (sem open redirect).
- Segredos só em `.env` no servidor; `.env.example` versionado.
