# 05 — Design

O v1 parecia "feito por estudante usando IA". Este documento existe para que isso não se repita. **A direção visual final é escolhida na Etapa 1**, com protótipos reais, e registrada aqui (seção "Direção escolhida").

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

## Tokens (preencher na Etapa 1)

Definidos como variáveis CSS no `@theme` do Tailwind v4, em três camadas: primitivos → semânticos → componentes.

| Token | Valor |
|---|---|
| Fonte display | _a definir_ |
| Fonte texto | _a definir_ |
| Escala tipográfica | _a definir_ |
| Neutros (50–950) | _a definir_ |
| `--accent` | por e-book (padrão da marca: _a definir_) |
| Raio | _a definir_ |
| Sombras (2–3 níveis) | _a definir_ |
| Espaçamento base | 4 px |

## Movimento

- **Princípio:** movimento explica e dá sensação de qualidade; nunca atrasa a compra.
- **Landing (GSAP + ScrollTrigger):**
  - entrada do hero (capa com leve rotação 3D e sombra, texto em cascata) em até 600 ms;
  - revelação sutil das seções no scroll;
  - parallax mínimo na capa.
- **Painel e microinterações (Motion):** toasts, abertura de modais/acordeões, reordenação por arrastar, feedback de botão.
- **Proibido:** animar o CTA de forma agressiva, scroll-jacking, animação que bloqueia o conteúdo acima da dobra, loops infinitos chamativos.
- **Desempenho:** só `transform`/`opacity`; GSAP carregado apenas na landing; com `prefers-reduced-motion`, tudo aparece já no estado final.

## Metas de desempenho (bloqueiam deploy)

| Métrica (mobile, 4G simulado) | Meta |
|---|---|
| Lighthouse Performance / SEO / Acessibilidade / Boas práticas | ≥ 95 |
| LCP | < 2,0 s |
| CLS | < 0,05 |
| INP | < 200 ms |
| JS próprio da landing (gzip, além da base do Next) | < 30 KB |

> **Medido na Etapa 1:** a base do Next 16 + React 19 já são **143 KB gzip** em qualquer página (inclusive uma sem nenhum componente nosso). A meta anterior (< 120 KB no total) era irrealista para esta stack; o que controla a velocidade percebida é o LCP, que ficou em 0,7 a 0,85 s com 4G lento e CPU 4× mais lenta. Medir com `scratchpad`/Playwright + Lighthouse a cada deploy.

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

_Preencher ao fim da Etapa 1: nome, justificativa, prints e tokens finais._
