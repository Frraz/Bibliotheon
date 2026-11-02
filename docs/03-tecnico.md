# 03 — Técnico

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Runtime | Node 22+ no desenvolvimento; `node:24` (LTS) na imagem Docker | O PC de desenvolvimento tem Node 22; o Next 16 funciona nos dois |
| Framework | **Next.js 16** (App Router, **Cache Components** + Partial Prefetching ligados) + TypeScript estrito | Páginas públicas pré-renderizadas (HTML pronto, ótimo para SEO e mobile). Painel e API no mesmo app, em um container. **A versão 16 tem convenções novas: ler `node_modules/next/dist/docs/` antes de codar** |
| UI | Tailwind CSS v4 + shadcn/ui (Radix) | Painel profissional pronto; é a base em que as skills de design rendem mais |
| Movimento | Motion (painel e microinterações) + GSAP/ScrollTrigger (só na landing) | Ver [05-design](05-design.md#movimento) |
| Banco | SQLite (better-sqlite3, modo WAL) + Drizzle ORM + drizzle-kit migrations | Um arquivo, zero serviço; backup é uma cópia. Migrar para Postgres é simples se um dia for preciso |
| Auth | Better Auth (e-mail/senha, sessão em cookie httpOnly) com campo `role` | Login seguro pronto; sem cadastro público |
| Validação | Zod (formulários, API e manifesto compartilham os schemas) | Uma regra, três usos |
| Formulários | react-hook-form + Zod + Server Actions | — |
| Imagens | sharp → AVIF + WebP em 400/800/1200/1600 px, nome com hash | LCP baixo, cache imutável |
| OG | `next/og` (ImageResponse) por e-book | Prévia bonita em anúncios e WhatsApp |
| Testes | Vitest (regras e API) + Playwright (fluxos críticos) | Só o que protege venda e dados |
| CLI | Python 3, só biblioteca padrão | Roda a partir do `../ebooks` sem instalar nada |

Proibido no MVP (exige decisão registrada para entrar):

- Redis;
- fila;
- microserviço;
- CMS de terceiros;
- GraphQL;
- serviço de e-mail;
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
│   │   ├── entrar/page.tsx
│   │   ├── painel/                 # layout do painel (auth obrigatório)
│   │   ├── api/auth/[...all]/route.ts
│   │   ├── api/v1/ebooks/route.ts  # CLI: upsert
│   │   ├── api/v1/ebooks/[sourceId]/route.ts  # CLI: consultar
│   │   ├── api/v1/v/route.ts       # beacon de visita
│   │   ├── api/saude/route.ts      # healthcheck do container
│   │   ├── sitemap.ts  robots.ts
│   ├── components/
│   │   ├── ui/                     # shadcn
│   │   ├── site/                   # seções da landing, cards
│   │   └── painel/
│   ├── db/schema.ts  db/index.ts
│   ├── lib/                        # auth, imagens, ofertas, utm, métricas, manifesto
│   └── styles/
├── drizzle/                        # migrations geradas
├── ferramentas/publicar.py         # CLI
├── scripts/seed.ts                 # importa um manifest local (Etapa 2)
├── scripts/criar-owner.mjs         # cria o owner na 1ª vez (JS puro: roda na imagem standalone)
├── data/                           # NÃO versionado: bibliotheon.db + media/
├── docker/Dockerfile  docker-compose.prod.yml
└── docs/
```

## Modelo de dados

Convenções:

- IDs são texto (`cuid2`);
- datas em UTC (ISO);
- dinheiro em **centavos** (inteiro);
- listas em coluna JSON validada por Zod.

**user** (tabela do Better Auth) + `role: 'owner' | 'parceiro'`, `ativo: boolean`.

**tema**

| Campo | Tipo | Nota |
|---|---|---|
| id, nome, slug (único), descricao, cor, ordem, publicado | | `descricao` alimenta SEO da página de tema |

**ebook**

| Grupo | Campos |
|---|---|
| Identidade | `id`, `ownerId` → user, `temaId` → tema, `sourceId` (único com `idioma`, nulo se criado no painel), `idioma` (padrão pt-BR), `edicao`, `slug` (único), `status: rascunho \| revisao \| publicado`, `destaque: boolean`, `publicadoEm`, `criadoEm`, `atualizadoEm` |
| Essencial | `titulo`, `subtitulo`, `autorExibido`, `formatos: string[]`, `capa` (chave da mídia), `capaHash`, `capaAlt`, `accent` (hex) |
| Venda | `headline`, `resumo` (1–2 frases), `problema` (1 frase), `descricao` (texto longo, parágrafos), `beneficios: string[]`, `paraQuem: string[]`, `naoEPara: string[]`, `incluido: string[]`, `observacoes` (antes de comprar), `sobreAutor`, `autorFoto` |
| Conteúdo | `sumario: string[]`, `faq: {p, r}[]`, `amostraPdf` (opcional) |
| Preço | `preco`, `precoDe` (opcional), `ofertaAte` (opcional), `garantiaDias` (padrão 7), `emBreve: boolean` |
| SEO/medição | `seoTitle`, `seoDescription` (opcionais; fallback headline/resumo), `metaPixelId` (opcional) |

**amostra**: `id`, `ebookId`, `imagem`, `ordem`.

**oferta**: `id`, `ebookId`, `plataforma` (`hotmart | kiwify | cakto | eduzz | monetizze | ticto | perfectpay | amazon | google_play | outra`), `rotulo` (opcional; padrão "Comprar na <Plataforma>"), `url`, `preco` (opcional, quando difere do preço do e-book), `principal: boolean` (exatamente uma por e-book com ofertas ativas), `ativa`, `ordem`.

Adicionar uma plataforma = um item no enum + logo SVG em `public/plataformas/` + regra de parâmetros em `lib/ofertas.ts`.

**metrica_diaria**: `ebookId`, `data` (AAAA-MM-DD), `ofertaId` (nulo = visita), `origem` (`utm_source` ou "direto"), `contagem`. Chave única pelos quatro primeiros campos; incremento com `ON CONFLICT DO UPDATE`. **Sem IP, sem cookie, sem dado pessoal.**

**api_token**: `id`, `userId`, `nome`, `hash` (SHA-256 do token), `criadoEm`, `ultimoUso`, `revogadoEm`.

## Regras de negócio (testadas)

1. **Preço vigente:**
   - se `ofertaAte` existe e já passou, vigora `precoDe` e a faixa/riscado somem;
   - se `ofertaAte` está no futuro, mostra `preco`, `precoDe` riscado e o countdown.

   A regra roda no servidor e é recalculada no cliente (o HTML pode ter até 5 min de cache). `precoDe` sem `ofertaAte` mostra riscado sem timer.
2. **Publicar exige:** capa, título, headline, ≥3 benefícios, e (≥1 oferta ativa com uma principal) **ou** `emBreve`.
3. **Parceiro:** só lê/edita ebooks com `ownerId` = ele. Não publica, não cria tema, não vê métricas de outros. Ação "Enviar para revisão" → `status = revisao`.
4. **Slug:** gerado do título, minúsculo, sem acento. Não pode colidir com rotas reservadas ([02](02-experiencia.md#mapa-do-site)). Mudar o slug de um publicado cria redirect 301 (tabela `slug_antigo`, se necessário; decidir na Etapa 3).
5. **Visibilidade:** só `status = publicado` com tema publicado aparece em home, tema, sitemap e busca. `?previa=1` funciona apenas com sessão do dono ou do owner e manda `noindex`.

## Renderização e cache

- Com **Cache Components** ligado (padrão do Next 16.4), `revalidate` por rota não existe mais. Home, tema e landing buscam dados em funções com `'use cache'` + `cacheTag('ebook:<slug>')` + `cacheLife` (ex.: 5 min); toda gravação do painel/API chama `updateTag`/`revalidateTag` das tags afetadas, e o conteúdo novo aparece na hora. O que depende da requisição (sessão, `?previa=1`) fica dentro de `<Suspense>`. Detalhes a confirmar na Etapa 2 em `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`.
- Painel: dinâmico, sem cache.
- Mídia em `/m/<ebookId>/<hash>-<largura>.<ext>`: `Cache-Control: public, max-age=31536000, immutable`.
- Visitas: a landing envia `navigator.sendBeacon('/api/v1/v', {ebookId, origem})`, uma vez por e-book por sessão (sessionStorage), ignorando bots por user-agent. Cliques: contados no servidor em `/ir`.

## Saída rastreada `/ir/[ofertaId]`

1. Busca a oferta ativa; se não existir, redireciona para a landing.
2. Incrementa a métrica de clique (`origem` = `utm_source` recebido ou "direto").
3. Monta a URL de destino preservando a query já existente na URL da oferta e repassando os parâmetros da landing: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `src`, `sck`, `fbclid`, `gclid`.
4. Responde `302` com `Cache-Control: no-store` e `X-Robots-Tag: noindex`.

A landing propaga os parâmetros da sua própria URL para os links `/ir/...`. Os nomes aceitos por cada plataforma estão em [04](04-vendas-e-medicao.md#4-parâmetros-por-plataforma).

## API para a CLI

Autenticação: `Authorization: Bearer <token>`. Token gerado em Painel → Conta, guardado só como hash.

### `POST /api/v1/ebooks[?dryRun=1][&publicar=1]`

`multipart/form-data`:

- `manifest` (JSON);
- `capa` (arquivo; opcional se `cover.sha256` = `capaHash` atual);
- `amostras[]` (arquivos, opcional).

Comportamento:

1. Valida o manifesto (Zod). Com `pending` não vazio → `422` com a lista.
2. Procura o e-book por `sourceId + idioma` do mesmo `ownerId`. Se não achar, procura colisão de `slug`: se existir e for de outro `sourceId`, responde `409` com mensagem clara. Sem associação mágica.
3. Calcula `mudancas` (campos que mudam, valor antes → depois, resumido).
4. `dryRun=1`: responde só `mudancas`, sem gravar.
5. Grava. **O manifesto vence nos campos que traz; os campos ausentes ficam como estão no painel.** `offers: []` ou ausente não altera ofertas. `offers` com itens substitui o conjunto de ofertas daquele e-book.
6. Se `book.theme` não existir: cria o tema como não publicado (owner) ou responde `422` (parceiro).
7. Status: novo = `rascunho`. `publicar=1` → `publicado` (só owner; parceiro → `revisao`), aplicando a regra 2.
8. Responde `{ id, slug, status, url, previewUrl, mudancas }`.

### `GET /api/v1/ebooks/[sourceId]?idioma=pt-BR`

Responde `{ id, slug, status, url, atualizadoEm, ofertas }`.

Respostas de erro sempre em `{ erro: "mensagem em português", detalhes? }`.

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
| `book.accentPreset` | `accent` | mapa de presets em `lib/manifesto.ts` (ex.: `mineral`) |
| `book.materialState`, `book.presentationVariant` | — | ignorados (aviso informativo) |
| `cover.file` / `cover.alt` / `cover.sha256` | `capa` / `capaAlt` / `capaHash` | |
| `pending` | — | não vazio bloqueia |
| `offers[]` | `oferta` | ver formato abaixo |

Campos opcionais novos em `book`: `subtitle`, `headline`, `author`, `authorBio`, `formats[]`, `notFor[]`, `included[]`, `toc[]`, `faq[{q,a}]`, `price` (número em reais, ex.: `29.9`), `priceFrom`, `offerEndsAt` (ISO 8601 com fuso), `guaranteeDays`, `comingSoon`. Topo: `samples[]` (arquivos na mesma pasta, em ordem), `samplePdf`.

Formato de oferta:

```json
{ "platform": "kiwify", "url": "https://pay.kiwify.com.br/xxxx", "price": 29.9, "primary": true, "label": "Comprar na Kiwify" }
```

Campos desconhecidos geram aviso, nunca erro. Um exemplo canônico completo fica em `docs/exemplos/manifest.example.json` (criar na Etapa 4).

## CLI `ferramentas/publicar.py`

```
python3 ferramentas/publicar.py publicar <pasta-do-titulo> [--publicar] [--sim]
python3 ferramentas/publicar.py consultar <pasta-do-titulo>
python3 ferramentas/publicar.py login            # pede o token (oculto) e salva
```

- Lê `<pasta>/publicacao/bibliotheon/manifest.json` + arquivos referenciados.
- `publicar`:
  1. faz `dryRun` e imprime as mudanças em português;
  2. pergunta `Enviar? [s/N]` (`--sim` pula a pergunta);
  3. envia;
  4. imprime a URL da prévia ou da página.
- Token em `~/.config/bibliotheon/token` (permissão 600) ou na variável `BIBLIOTHEON_TOKEN`. Destino: `BIBLIOTHEON_URL` (padrão `https://bibliotheon.com.br`).
- Códigos de saída: 0 ok, 1 erro de validação/servidor, 2 uso incorreto.
- Em `../ebooks`, o launcher `bibliotheon` passa a executar `python3 "$CLIENT_DIR/ferramentas/publicar.py" "$@"`. Os comandos antigos `preparar`/`assistir` deixam de existir; `validar` vira alias de `publicar` com dryRun e sem enviar.

## Segurança

- Better Auth: hash de senha forte, rate limit no login, cookie `httpOnly; Secure; SameSite=Lax`.
- Todas as Server Actions e rotas do painel conferem sessão **e** dono do recurso no servidor.
- **Uploads:**
  - limite de 10 MB por imagem;
  - formato validado pelo conteúdo (sharp lê ou rejeita), nunca pela extensão;
  - EXIF removido;
  - PDF de amostra até 15 MB, com conferência da assinatura `%PDF`.
- Cabeçalhos: CSP com nonce (como no v1), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS no nginx. A CSP libera os domínios do Meta Pixel/GA4.
- `/ir` só redireciona para URLs de ofertas cadastradas (sem open redirect).
- Segredos só em `.env` no servidor; `.env.example` versionado.
