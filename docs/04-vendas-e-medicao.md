# 04 — Vendas e medição

Meta: vender o máximo **por real investido**. O orçamento de anúncios é pequeno, então cada e-book precisa:

1. ser encontrado de graça (SEO e compartilhamento);
2. converter bem quem chega (landing);
3. ter a origem de cada venda medida, para investir só no que funciona.

## 1. SEO (tráfego grátis e cumulativo)

**Por e-book:**

- **Slug e `<title>` com a busca do público**, não com o nome criativo do livro. Ex.: `/criar-sistemas-com-ia` e título "Como criar sistemas com IA sem saber programar — e-book". O nome do livro fica no H1/hero.
- `seoDescription` com ~150 caracteres: benefício + formato + preço ("E-book prático: ... PDF e EPUB por R$ 29,90.").
- **JSON-LD** em toda landing:
  - `Book` (nome, autor, idioma, formato, imagem);
  - `Product` + `Offer` (preço vigente, `BRL`, `availability`, `priceValidUntil` = `ofertaAte`);
  - `FAQPage` (perguntas do FAQ);
  - `BreadcrumbList` (Home › Tema › Livro).

  Validar no Rich Results Test a cada novo e-book.
- Texto real na página (descrição, sumário, FAQ) indexável, sem esconder em imagem.
- Imagens com `alt` descritivo.

**Por tema:** a descrição do tema responde "o que procura quem lê sobre X". A página de tema é a porta para buscas amplas.

**Site:**

- `sitemap.xml` automático (home, temas, e-books publicados);
- `robots.txt`; canonical em tudo; prévias e painel com `noindex`.
- Cadastrar o domínio no **Google Search Console** e enviar o sitemap no dia do deploy.

**Próximo passo de SEO (backlog nº 1):** artigos por tema (ex.: "5 erros ao usar IA para programar"), cada um apontando para o e-book. É a maior alavanca orgânica de longo prazo e entra depois do MVP validado.

## 2. Compartilhamento e canais orgânicos

- OG automático por e-book (capa + título + preço) para WhatsApp, Instagram, Facebook e X.
- Botão "Enviar para um amigo" (WhatsApp).
- Link curto e limpo `bibliotheon.com.br/<slug>` para bio, stories e descrição de vídeos.
- Cada e-book já sai do `../ebooks` com um `plano-de-divulgacao.md`. Usar esses roteiros:
  - 3 a 5 vídeos curtos por e-book (um insight por capítulo), Reels/TikTok/Shorts apontando para a landing com UTM;
  - Pinterest para temas visuais/de saúde;
  - parceiros divulgam os próprios e-books com `utm_source=parceiro-<nome>`.

## 3. Convenção de UTM

Formato fixo, sempre minúsculo e sem acento:

| Parâmetro | Valores |
|---|---|
| `utm_source` | `meta`, `google`, `instagram`, `tiktok`, `youtube`, `pinterest`, `whatsapp`, `email`, `parceiro-<nome>` |
| `utm_medium` | `pago`, `organico`, `bio`, `stories`, `video`, `indicacao` |
| `utm_campaign` | `<slug-do-ebook>-<objetivo>-<aaaamm>` (ex.: `criar-sistemas-com-ia-vendas-202611`) |
| `utm_content` | identificador do criativo (ex.: `video-erro-1`, `carrossel-a`) |

Exemplo de anúncio:

```
https://bibliotheon.com.br/criar-sistemas-com-ia?utm_source=meta&utm_medium=pago&utm_campaign=criar-sistemas-com-ia-vendas-202611&utm_content=video-erro-1
```

Na Meta, usar os parâmetros dinâmicos de URL (`{{ad.name}}` em `utm_content`) para não digitar à mão.

## 4. Parâmetros por plataforma

O `/ir` repassa `utm_*`, `src`, `sck`, `fbclid` e `gclid` para a URL do checkout (ver [03](03-tecnico.md#saída-rastreada-irofertaid)). Assim a origem aparece no relatório de vendas da plataforma.

| Plataforma | Onde a origem aparece | Observação |
|---|---|---|
| Hotmart | `src`/`sck` e UTMs nos relatórios de vendas | Conferir no painel o campo de origem do relatório |
| Kiwify | UTMs e `src`/`sck` nos detalhes da venda | Conferir |
| Cakto | UTMs | Conferir |
| Outras | Variável | Testar antes de anunciar |

> Os nomes e locais exatos mudam com o tempo. **Antes do primeiro anúncio de cada plataforma**, fazer o teste: clicar na landing com UTMs de teste, chegar ao checkout, conferir que os parâmetros estão na URL e, após uma venda de teste ou real, conferir onde a origem aparece no relatório. Registrar o resultado nesta tabela.

**Hotmart e IA:** o e-book 001 tem impedimento registrado em `../ebooks` sobre texto gerado por IA na Hotmart. O titular decidiu lançar **só na Hotmart** (02/11/2026) e aceitou o risco. Se a Hotmart barrar o produto, cadastre Kiwify/Cakto como oferta principal (a página troca o botão sozinha). Não usar o script/widget da Hotmart: o botão passa pelo `/ir`.

## 5. Pixel e eventos

**No site** (carregados **só após o consentimento** do banner):

- **Meta Pixel** (ID global no `.env`; um e-book pode ter um pixel extra de parceiro em `metaPixelId`):
  - `PageView` em todas as páginas;
  - `ViewContent` na landing (`content_name`, `value`, `currency=BRL`);
  - `InitiateCheckout` no clique em qualquer oferta.
- **GA4:** `page_view`, `view_item` e `begin_checkout` com os mesmos dados.

**Quando ligar (decisão de 02/11/2026: lançar sem nenhum).** GA4: ao começar a divulgar de forma orgânica (é gratuito e mostra visitas e origens além dos contadores próprios). Meta Pixel: só ao anunciar na Meta, para o anúncio aprender quem compra e permitir remarketing. Ao ligar um deles o banner de cookies passa a aparecer.

**Configuração:** `NEXT_PUBLIC_META_PIXEL_ID` e `NEXT_PUBLIC_GA4_ID` são fixados **no build** (mudar exige novo build; o `./atualizar.sh --forcar` reconstrói). Sem eles, nada de terceiros carrega e o banner de cookies nem aparece.

**Nas plataformas:** configurar **o mesmo Meta Pixel** (e, se a plataforma oferecer, o token da API de Conversões) no produto em cada plataforma. É lá que acontece o evento `Purchase`, que a Meta usa para otimizar o anúncio para vendas.

**Contadores próprios** (sem cookie, sempre ativos): visitas por e-book/origem e cliques por oferta/origem, mostrados no painel. Mesmo quem recusa cookies é contado de forma anônima.

## 6. Guia de copy da landing

Escrever (ou revisar o que vem do `../ebooks`) com estas regras:

- **Headline = resultado para o leitor**, não assunto. ✕ "Sistemas com IA". ✓ "Crie seu primeiro sistema com IA — mesmo sem saber programar".
- **Subtítulo** explica como (método/formato) e para quem.
- **Problema** em uma frase que o leitor diria sobre si mesmo.
- **Benefícios** começam com verbo e são concretos ("Montar uma proposta com preço e escopo"), de 3 a 6.
- **Para quem não é** aumenta a confiança e reduz reembolso. Sempre preencher.
- **FAQ responde objeções reais:** "Preciso de experiência?", "Como recebo?", "E se eu não gostar?", "Quanto tempo leva?", "Tem suporte?". O kit comercial do `../ebooks` já traz um FAQ bom; reaproveitar.
- **Prova honesta:** amostra real, sumário real, autor real. Depoimentos **só reais e com autorização**; até existirem, a prova é a amostra.
- **Proibido:** prometer renda/cura/resultado garantido, timer falso, preço "de" nunca praticado, "últimas unidades" (e-book não acaba), logos ou selos de terceiros sem autorização.
- **Preço:** e-books de entrada costumam converter melhor em faixa baixa. O preço é decisão do titular, registrada no painel, e deve ser testada com dados (ver a rotina abaixo).

## 7. Checklist de lançamento de um e-book

1. Produto criado e **entrega testada** em cada plataforma (compra de teste ou acesso de produtor).
2. Pixel configurado no produto em cada plataforma.
3. E-book cadastrado (CLI ou painel) com capa, headline, ≥3 benefícios, sumário, FAQ, amostras e ofertas.
4. Prévia revisada no celular: hero, preço, botões, amostra e FAQ.
5. Clicar em cada oferta pela prévia e conferir checkout, preço e UTMs.
6. Publicar → testar a URL pública → conferir OG (colar o link no WhatsApp) e o Rich Results Test.
7. Confirmar no Search Console que a página entrou no sitemap.
8. Postar o primeiro conteúdo orgânico com UTM.
9. Só então ligar anúncio pago, com orçamento de teste pequeno e prazo definido.

## 8. Rotina semanal (15 minutos)

Para cada e-book publicado, olhar no painel e nas plataformas:

| Métrica | Onde | Sinal |
|---|---|---|
| Visitas por origem | Painel | De onde vem o público |
| Taxa de clique (cliques ÷ visitas) | Painel | < 5%: o problema é a landing (headline, preço, prova). Meta inicial ≥ 8% |
| Vendas ÷ cliques | Plataforma ÷ painel | Baixa: o problema é checkout/preço/plataforma |
| Custo por clique de checkout | Meta Ads ÷ painel | Decide onde colocar o próximo real |

Mudar **uma coisa por vez** (headline, preço, ordem das ofertas, criativo) e anotar a data em `docs/decisoes.md`, para comparar a semana seguinte.
