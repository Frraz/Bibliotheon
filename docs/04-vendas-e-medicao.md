# 04 — Vendas e medição

Meta do titular: **R$ 1.500 de faturamento bruto por mês**, ou o projeto acaba. Orçamento de anúncios atual: **R$ 0**.

## 0. A conta e a estratégia

| Preço | Vendas por mês para R$ 1.500 brutos | Sobra por venda (Hotmart 9,9% + R$ 2,49) |
|---|---|---|
| R$ 64,99 | 24 | R$ 56,07 |
| R$ 47,00 | 32 | R$ 39,86 |

Na hipótese de 1–2% de visitas virando venda (não há dado brasileiro confiável), são **1.200–2.400 visitas por mês**. Nenhuma mudança na página resolve falta de visitas: **o gargalo é tráfego e conversão juntos.** Nada aqui garante o resultado.

**Canais, nesta ordem (sem anúncios):**

1. **Parcerias diretas:** ~30 criadores e comunidades de IA/no-code, com afiliação de 40–50% e convite individual. Único canal que só custa quando vende. Afiliado conta inteiro no faturamento, mas sobram cerca de R$ 30 por venda.
2. **Vídeo curto real:** tela gravada construindo o sistema do livro, um erro ou lição por vídeo. Sem prova medida de conversão.
3. **Amostra por e-mail:** quem não compra na hora deixa o e-mail e recebe o aviso da próxima campanha.
4. **Lojas (a partir de dezembro):** KDP a 35% sem Select e Google Play. Pouco esforço, volume desconhecido.

Meta Ads, Pixel e GA4 ficam desligados até haver verba. Como referência, só com anúncios o lucro de R$ 1.500 exigiria cerca de R$ 2.080/mês de verba com retorno de 2×. Blog/SEO fica no backlog (só 1,74% das URLs chegam ao top 10 em um ano, [Ahrefs](https://ahrefs.com/blog/how-long-does-it-take-to-rank/)).

**Marcos (critério do projeto, não previsão):**

| Data | Sinal | Se falhar |
|---|---|---|
| 30/11/2026 | Primeira venda de um desconhecido | Revisar oferta e promessa |
| 31/12/2026 | ≥ 500 visitas e ≥ 10 vendas no mês | Poucas visitas: canal. Clique < 5%: página. Clique sem venda: preço/checkout |
| 28/02/2027 | R$ 1.500 em um mês | O titular decide continuar, mudar de tema ou encerrar, com dados |

**Limite da evidência:** não foi encontrado dado público confiável de conversão de e-book no Brasil, nem relato verificável de quem chegou a essa meta. O estudo FGV/Hotmart só inclui quem já vende.

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

**Próximo passo de SEO (backlog):** artigos por tema (ex.: "5 erros ao usar IA para programar"), cada um apontando para o e-book. Alavanca de longo prazo; entra depois das primeiras vendas.

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

**Plano B:** se a Hotmart barrar o produto, cadastre Kiwify/Cakto como oferta principal (a página troca o botão sozinha; `deploy/venda.sh aplicar`). Não usar o script/widget da Hotmart: o botão passa pelo `/ir`. Regra atual da Hotmart sobre IA: seção 6.

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

## 6. Padrão de venda

Regra de **toda** landing de **todo** e-book (`CLAUDE.md`, regra 8). O `npm run seed` e o `./livro manifesto` avisam o que falta.

**O que a pesquisa mostrou:** a escassez aumenta a intenção de compra (δ=0,31), mas em produto utilitário a de **tempo** fica perto de zero (δ=0,02; k=6) e a de **demanda** é a que funciona (δ=0,41); em marca pouco conhecida a de tempo não foi significativa. Só 15 de 193 efeitos vêm de manipulação real ([Barton et al., 2022](https://pure.bond.edu.au/ws/portalfiles/portal/182976505/Scarcity_tactics_in_marketing.pdf)). Num teste, um cronômetro de 60 s não mudou a aceitação: 14,3% contra 14,8% ([Luguri & Strahilevitz](https://academic.oup.com/jla/article/13/1/43/6180579)). Logo: **primeiro necessidade e confiança; o prazo real serve para tirar da indecisão quem já quer comprar.** Cronômetro sozinho não vende.

| # | Item | Campo | Como |
|---|---|---|---|
| 1 | **Necessidade** | `problema`, `dores[]` | Uma frase que o leitor diria e 3–4 situações que ele reconhece, cada uma com o que ela custa |
| 2 | **Resultado concreto** | `headline`, `beneficios[]` | Resultado, não assunto. Verbo + o que a pessoa terá em mãos, ancorado em capítulo real |
| 3 | **Por que este caminho** | `diferenciais[]` | Diferença real frente às alternativas, sem citar marcas |
| 4 | **Redução de risco** | `amostras`, `garantiaDias`, `naoEPara[]` | Amostra real, garantia e "para quem não é", **incluindo o esforço exigido**. Reembolso alto pode tirar o produto do ar (Hotmart, Política, item 5.1) |
| 5 | **Prazo real em campanha** | `ofertaAte`, `precoDe`, `ofertaNome`, `oferta.urlPromo` | Data absoluta + preço depois do prazo. A página e o checkout trocam sozinhos. Sem campanha, sem timer |
| 6 | **Prova de demanda** | a construir quando existir | Nº real de compradores e depoimentos reais autorizados, assim que houver |
| 7 | **Compra sem fricção** | `parcelamento` | CTA repetido (hero, benefícios, amostra, fim, barra fixa); preço e condições juntos; parcelas só se o checkout oferecer |
| 8 | **Sem seção de autor** | — | Fica no livro e nos dados estruturados, não na página |
| 9 | **Medir** | `deploy/venda.sh relatorio` | Visitas → cliques → vendas por origem, uma mudança por vez |

**Regras de campanha:**

- Lançamento de título novo: preço de lançamento com data, voltando ao preço normal.
- O preço "de" tem de ter sido cobrado de verdade: manter o preço sem alteração antes da campanha, guardar captura datada e voltar a ele depois.
- Pelo menos **30 dias a preço cheio** entre promoções (critério do projeto, para o "de" continuar verdadeiro). Promoção permanente não é promoção.
- Não anunciar a promoção antes da hora: quem compra hoje não pode se sentir enganado amanhã.
- Bônus com prazo só se for real e retirado de fato depois da data.

**Copy:**

- **Headline = resultado para o leitor**, não assunto. ✕ "Sistemas com IA". ✓ "Crie seu primeiro sistema com IA, mesmo sem saber programar".
- **Conferir cada frase contra o livro.** Se o livro não sustenta, não entra. Se o livro tem um limite, ele aparece ("Antes de comprar" e FAQ).
- **FAQ responde objeções reais:** "Preciso de experiência?", "Como recebo?", "E se eu não gostar?", "Quanto tempo leva?", "Tem suporte?".
- **A garantia de 7 dias coincide com o direito legal (CDC, art. 49):** explicar com clareza, sem vender como benefício extraordinário.

**Proibido, sempre:** cronômetro que reinicia, "últimas unidades" de arquivo digital, preço "de" nunca cobrado, subir o preço antes da promoção, contador ou notificação inventados, depoimento inventado (simular com IA pode dar banimento imediato na Hotmart), bônus com "valor" fictício, promessa de renda/cura/resultado garantido, logos sem autorização.

**Preço:** decisão do titular. Comparar faturamento e sobra por visitante, não só conversão. Concorrentes observados em 02/11/2026: cursos de R$ 28–30 em promoção até R$ 197–697 (amostra pequena); nenhum e-book brasileiro comparável com preço encontrado.

**Hotmart e IA (conferido em 02/11/2026):** o [artigo atualizado em 30/10/2026](https://suportehotmart.zendesk.com/hc/pt-br/articles/215828518-Como-cadastrar-meu-produto-na-Hotmart) diz que "o uso de IA, por si só, não é motivo para recusar um produto"; avalia-se o conteúdo final e a divulgação, e "e-books curtos sem aprofundamento" não são aceitos. Pedir confirmação por escrito ao suporte.

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

**Ligar uma campanha (`deploy/venda.sh aplicar <slug> <arquivo.json>`):**

1. Criar na plataforma o cupom com data de fim ou a oferta com link próprio, no preço da campanha.
2. Abrir o link: conferir o preço no checkout. Só então pôr em `promoUrl`. **A API recusa campanha que muda o preço sem esse link** (a página mostraria um preço e o checkout cobraria outro).
3. Aplicar, abrir a página, clicar no botão e conferir valor e UTM no checkout.
4. Depois do prazo, conferir que a página e o botão voltaram ao preço normal. Desativar a oferta extra na plataforma, se houver, e aplicar o arquivo de fim de campanha.

## 8. Rotina semanal (15 minutos)

`deploy/venda.sh relatorio 7 <vendas> <vendas-por-afiliado>` mostra visitas, cliques e taxa por origem, e a distância até a meta. As vendas vêm do relatório da plataforma. Para cada e-book publicado:

| Métrica | Onde | Sinal |
|---|---|---|
| Visitas por origem | Relatório | De onde vem o público |
| Taxa de clique (cliques ÷ visitas) | Relatório | < 5%: o problema é a landing (headline, preço, prova). Meta inicial ≥ 8% |
| Vendas ÷ cliques | Plataforma ÷ relatório | Baixa: o problema é checkout/preço/plataforma |
| Custo por clique de checkout (quando houver anúncio) | Meta Ads ÷ relatório | Decide onde colocar o próximo real |

Mudar **uma coisa por vez** (headline, preço, ordem das ofertas, criativo) e anotar a data em `docs/decisoes.md`, para comparar a semana seguinte.
