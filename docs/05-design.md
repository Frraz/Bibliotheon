# 05 — Design

Este documento existe para que o site nunca pareça "feito por estudante usando IA". **A direção visual final é escolhida na Etapa 1**, com protótipos reais, e registrada aqui (seção "Direção escolhida").

## Direção (ponto de partida)

**Catálogo:** livraria editorial premium. Calma, tipográfica, com muito respiro. A capa dos livros é a estrela; a interface é a moldura. Referências de sensação, não para copiar: editoras independentes, revistas literárias, páginas de produto da Apple.

**Landing:** a mesma moldura da marca + **cor de destaque (`accent`) do próprio e-book**, tirada da capa. Assim um e-book de saúde e um de tecnologia ficam com personalidades diferentes sem virar dois sites. Mais energia que o catálogo: CTAs fortes, contraste alto no preço e na compra.

**Painel:** neutro, denso na medida e silencioso. shadcn/ui com tokens próprios, sem enfeite. Clareza acima de tudo.

## Regras anti-amador (checadas em todo PR visual)

1. **Tipografia faz o trabalho pesado:** par editorial (serifa de display com personalidade + sans de texto muito legível), escala modular, `text-wrap: balance` em títulos, comprimento de linha de 60 a 75 caracteres.
2. **Uma família de cantos, sombras e espaçamentos** (tokens). Nada de valores soltos.
3. **Paleta curta:** neutros quentes + 1 accent. Gradiente só se fizer parte da direção escolhida, nunca o "roxo-azul de IA".
4. **Sem clichês de template:** nada de emoji como ícone, cards com borda colorida à esquerda, "glassmorphism" gratuito, ícones aleatórios em toda frase ou hero com blob.
5. **Hierarquia óbvia:** em cada tela, dá para apontar em 1 segundo o elemento mais importante.
6. **Estados completos:** hover, foco visível, carregando (skeleton), vazio, erro e desabilitado em todo componente interativo.
7. **Imagem de qualidade:** capas sempre nítidas (AVIF/WebP no tamanho certo) e mockup 3D consistente.
8. **Dark mode:** só no painel, se sair barato. A landing é clara (decidir na Etapa 1).
9. **Acessibilidade:** contraste AA (AAA no texto corrido), alvos de toque ≥ 44 px, navegação por teclado e `prefers-reduced-motion`.

## Tokens

Definidos em **`src/app/globals.css`** (um lugar só): valores de marca em `:root` + nomes semânticos do shadcn (`--primary`, `--border`...) apontando para eles, expostos ao Tailwind v4 via `@theme inline`. Mudar uma cor da marca = mudar uma linha.

| Token | Valor | Uso |
|---|---|---|
| `--papel` | `#F3ECDD` | Fundo da marca (vem da capa do livro) |
| `--papel-2` | `#EAE1CE` | Faixas alternadas, barra lateral do painel |
| `--papel-3` | `#FAF6EC` | Campos e superfícies elevadas do painel |
| `--tinta` | `#1F2A29` | Texto principal |
| `--tinta-2` | `#4A5654` | Texto secundário (6,5:1 sobre o papel) |
| `--terracota` / `-escura` | `#A9422A` / `#8A3320` | Ação principal (CTA), números de seção, foco |
| `--salvia` | `#4B5E55` | Confirmações, selo "Publicado" (≥ 4,8:1 em todos os fundos de texto) |
| `--filete` | `#C9BCA3` | Filetes e bordas (a estrutura da página é feita de filetes, não de cartões) |
| `--perigo` | `#A6261C` | Ações destrutivas |
| Fonte display | **Fraunces** (eixo `opsz`) | Títulos, preços, nome da marca |
| Fonte texto | **Hanken Grotesk** | Texto e interface |
| Raio | `0.25rem` | Cantos quase retos, como a capa. A landing usa cantos retos |
| Alvos de toque | ≥ 44 px | Botão padrão `h-11`, `lg` `h-12`; campo `h-11` |
| Espaçamento base | 4 px | — |

Cor de destaque **por e-book** (`accent`): ainda não implementada; entra na Etapa 2 junto com os dados (a landing de hoje usa a terracota da marca).

## Movimento

> **Estado (03/11/2026):** o que está abaixo é a **direção**, não o que existe. Nem Motion nem GSAP estão instalados; as páginas usam CSS e transições simples, e os visuais foram aprovados assim. Instalar uma biblioteca exige decisão registrada e a regra "isso ajuda a vender agora?".

- **Princípio:** movimento explica e dá sensação de qualidade; nunca atrasa a compra.
- **Landing (GSAP + ScrollTrigger):**
  - entrada do hero (capa com leve rotação 3D e sombra, texto em cascata) em até 600 ms;
  - revelação sutil das seções no scroll;
  - parallax mínimo na capa.
- **Painel e microinterações (Motion):** toasts, abertura de modais/acordeões, reordenação por arrastar, feedback de botão.
- **Proibido:** animar o CTA de forma agressiva, scroll-jacking, animação que bloqueia o conteúdo acima da dobra, loops infinitos chamativos.
- **Desempenho:** só `transform`/`opacity`; GSAP carregado apenas na landing; com `prefers-reduced-motion`, tudo aparece já no estado final.

## Metas de desempenho

| Métrica (mobile, simulação do Lighthouse: celular de entrada, 4G lento, CPU 4× mais lenta) | Meta |
|---|---|
| Lighthouse Acessibilidade / Boas práticas / SEO | ≥ 96 |
| Lighthouse Performance (landing, **mediana de 3 rodadas com o servidor aquecido**) | ≥ 93 |
| CLS | < 0,1 (limite "bom" do Core Web Vitals); alvo interno < 0,05 |
| INP | < 200 ms |
| JS próprio da landing (gzip, além da base do Next) | < 30 KB |

> **Por que não "≥ 95 em tudo":** a base do Next 16 + React 19 já são **143 KB gzip** em qualquer página, e o Lighthouse mobile simula uma CPU 4× mais lenta; o resultado de Performance oscila ±10 pontos entre rodadas (ruído da máquina). A meta honesta é a **mediana** de várias rodadas, não um pico.

### Medições das páginas reais (Etapa 2, 02/11/2026, build standalone, banco real)

| Página | Perf | Acess. | Boas prát. | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| Landing `/criar-sistemas-com-ia` | **94–97** (rodadas: 97, 93, 81\*, 94, 96) | 100 | 100 | 100 | 2,5 s | 0 |
| Home `/` | 81–89 | 100 | 96 | 100 | 3,0 s | 0,065 |
| Landing, depois do ajuste mobile (02/11, 3 rodadas) | **90–99** (mediana 97) | 100 | 100 | 100 | ~1 s | 0 |
| Home, depois do ajuste mobile (02/11, 4 rodadas) | **89–99** (mediana ~94) | 100 | 100 | 100 | 0,8–2,9 s\*\* | **0** |

\* rodadas ruins coincidiram com o PC ocupado ou com o cache de imagens frio (ver abaixo).
\*\* bimodal: ~0,8 s com o cache de imagens quente e ~2,8 s com ele frio. Em produção o `aquecer.sh` mantém quente.

O que **moveu** os números (e o que não):

- **`content-visibility: auto` nas seções abaixo da dobra:** o atraso de renderização da capa caiu de 1.150 ms para ~140 ms (o navegador deixou de calcular estilo e layout da página inteira de uma vez). É a mudança de maior efeito.
- **`fetchPriority="high"` na capa** e o `<link rel=preload>` do Next.
- **Cache de imagens frio:** a primeira imagem otimizada após reiniciar custa ~150 ms (mais num VPS fraco). O `deploy/aquecer.sh` (chamado pelo `atualizar.sh`) gera todas as variantes antes do primeiro visitante.
- **Home: o CLS foi para 0** (02/11) ao trocar o espaço reservado do `<Suspense>` de `min-h-[70vh]` para `min-h-svh`: antes o rodapé aparecia na primeira tela e pulava para baixo quando o catálogo chegava. O texto abaixo é o diagnóstico anterior, mantido para o caso de a Performance voltar a cair.
- **Home abaixo da meta de Performance e com CLS 0,065 (antes do ajuste):** o CLS vem do `h1` crescendo uma linha (+39 px) quando a fonte Fraunces substitui a fonte reserva (o mesmo efeito dá 0,026 na landing). Como a Home lê o banco no pedido (`<Suspense>`), o LCP também sai mais tarde. Opções, se virar prioridade: `font-display: optional` só no Fraunces, ou tornar a Home estática com aquecimento no deploy.

## Processo com as skills

Instalar antes da Etapa 1 (comandos no [README](../README.md#skills-de-design)):

| Momento | Skill | Uso |
|---|---|---|
| Direção visual | **frontend-design** (Anthropic), **taste-skill** | Gerar 3 direções realmente distintas para a landing com conteúdo real do e-book 001 |
| Sistema | **ui-ux-pro-max** | Tokens, par tipográfico, paleta e checklist de UX da direção escolhida |
| Movimento | **emilkowalski/skills**, **gsap-skills** | Microinterações refinadas (Motion) e animações de scroll (GSAP) |
| Auditoria | **impeccable** | Crítica e polimento antes de **todo** deploy com mudança visual |

**Portão visual da Etapa 1:**

1. Três direções da landing, cada uma com nome e justificativa de 2 linhas, vistas no celular e no desktop.
2. Você escolhe uma (ou pede uma mistura).
3. A direção é aplicada na Home e no Editor do painel.
4. Auditoria impeccable.
5. Você aprova.

Só então começa o backend.

## Direção escolhida

**A · Livraria** (escolhida pelo usuário em 02/11/2026, entre três direções testadas com o conteúdo real do e-book 001; B "Oficina" escura e C "Direta" em bloco de cor foram descartadas e removidas).

**Por quê:** é a extensão mais fiel da capa do livro, a mais elegante e a que mais se aproxima de uma livraria de verdade. A estrutura é feita de filetes, espaço e tipografia (serifa de display + sans), sem cartões repetidos. Cada seção usa o formato que o conteúdo pede (lista numerada só para o sumário, que é uma sequência).

**Como se aplica em cada superfície:**

- **Landing**: hero em duas colunas com a capa em leve perspectiva; faixa escura de urgência (só com data real); seções separadas por filetes; "Folheie antes de decidir" em faixa de tinta; bloco de compra em tinta com o preço grande.
- **Home**: frase da marca, e-book em destaque num painel `papel-2`, filtros de tema e grade de capas (2 colunas no celular, 4 no desktop).
- **Painel** (`/painel`): mesma paleta e fontes, silencioso: barra lateral `papel-2`, campos `papel-3`, filetes. Menu de 4 itens (grade de 4 colunas no celular).
- **Editor** (`/painel/ebooks/[id]`): uma página, 5 seções numeradas (a numeração é uma sequência real do formulário); coluna lateral fixa com "Nesta página", checklist e ações; no celular, barra "Salvar / Publicar" fixa e resumo do checklist no topo.

_Os protótipos `/prototipo/*` da Etapa 1 foram removidos na Fase 2; o painel de verdade os substitui (histórico no Git)._

### Auditoria impeccable (02/11/2026)

Detector rodado nas 4 telas, em 1280×800 e 390×844, depois das correções:

| Achado | Decisão |
|---|---|
| `cream-palette`: fundo creme (todas as telas) | **Aceito.** O creme é o da capa real do livro; a marca estende a capa. Registrado em [decisoes](decisoes.md). Se a cor da capa mudar, revisar |
| `first-viewport-column-overflow` (editor) | **Falso positivo.** É a coluna lateral fixa (sticky) ao lado de um formulário longo, por desenho |
| `oversized-h1`, `dark-glow`, `low-contrast`, `straggler` | **Corrigidos** (título menor, sombra neutra no CTA, `--salvia` mais escuro, `text-wrap: pretty` global) |

Antes de cada deploy: repetir `.claude/skills/impeccable/scripts/impeccable detect --viewport 360x740 <url>` (e 1280x800) e conferir que só restam os dois achados acima.

### Medições (build de produção, 4G lento + CPU 4× mais lenta, celular 390 px)

| Tela | LCP | CLS | JS gzip |
|---|---|---|---|
| Landing | 0,91 s | 0,026 | 143 KB (base do Next; sem prefetch do menu do protótipo) |
| Home | 0,78 s | 0,005 | idem |
| Painel / Editor | 0,80 s | 0,000 | idem |

O CLS da landing (0,026, dentro da meta) vem da troca da fonte do título (o Fraunces muda de largura com o tamanho óptico). Se subir, reservar altura do `h1` ou usar `font-display: optional` só nele.

## Regras de celular (aprendidas em 02/11/2026)

Uma Home com cartão de largura fixa passou de 360 px (Android comum) e o navegador encolheu a página: eu só tinha testado 375/390. Por isso:

- **Testar sempre em 360, 390 e 430 px**, rolando a página (as seções abaixo da dobra só renderizam quando entram na tela, então captura de página inteira engana). O e2e `celular N px` falha se `scrollWidth` passar da largura.
- **Todo `grid` com colunas só em `lg:` precisa de `grid-cols-1`** na base. Sem isso a coluna cresce com o conteúdo e alarga a página.
- **Cartão lado a lado só a partir de `sm`.** No celular, empilhar (capa, título, preço, botão).
- **Botão de compra em largura total no celular**; texto de confiança sem quebrar no meio de uma expressão (`whitespace-nowrap` por item).
- **Texto longo recolhido no celular** (`TextoRecolhivel`: 2 parágrafos + "Continuar lendo"; completo no desktop; o HTML tem tudo, então segue indexável).
- **Sem `line-clamp` em frase de venda** (cortou "sabe…" no meio). Texto pequeno: mínimo 14 px.
- Espaço reservado de `<Suspense>` com altura da tela inteira (`min-h-svh`), para o rodapé não pular.

### Medição da landing do 001 (03/11/2026, dados reais, carga ~2,3, cache aquecido)

95, 93, 95, 85, 91 (mediana 93), LCP 1,1 a 1,7 s. A11y, Boas práticas e SEO 100. CLS 0. Impeccable: só o creme do cabeçalho do site (aceito) e um aviso de contraste do vermelho, corrigido depois.

### Medição da landing do 002 (03/11/2026, dados reais, carga ~2,5, cache aquecido)

88, 96, 96, 91, 95 (mediana 95), LCP 1,1 a 1,7 s. A11y, Boas práticas e SEO 100. CLS 0. Impeccable: só o creme do cabeçalho do site (aceito).

### Medição da Fase 3 (02/11/2026): várias lojas no bloco de compra

A/B no pacote standalone com o **001 real**, 5 rodadas cada, máquina com carga ~2,5 e cache de imagens aquecido: **antes** 87, 92, 93, 82, 92 (mediana 92); **depois** 85, 90, 93, 71, 91 (mediana 90). LCP é a capa nas duas (2,4 a 4,0 s na simulação). JS (158 KB), FCP e TBT iguais. A diferença está dentro do ruído e a meta de 93 segue sem ser atingida com a máquina carregada (ver acima). No livro de teste o LCP trocou de um parágrafo para a capa porque o topo ficou ~20 px mais curto sem o link "outras formas de comprar": é efeito de medição, não de código. A11y, Boas práticas e SEO: 100. CLS 0. Impeccable: só o creme (aceito).

### Medição do padrão de venda (02/11/2026, build standalone, dados reais)

Comparação alternada, 5 rodadas cada, nas mesmas condições (máquina com carga 3–4, o que reduz as notas): versão anterior **mediana 85**, nova **mediana 90**, 3 KB a mais. Acessibilidade, Boas práticas e SEO 100, também com a campanha ligada. CLS 0 em 360, 375, 390 e 1280 px. **A meta de 93 ainda precisa ser conferida com a máquina livre.** Auditoria impeccable: detector sem achados.
