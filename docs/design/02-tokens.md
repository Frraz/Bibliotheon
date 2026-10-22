# Tokens, cores e tipografia

[Briefing](../../DESIGN-BRIEF.md) · [Cores canônicas](cores.json) · [Contrastes](09-contrastes.md)

## Três camadas

Primitivos nomeiam valores; semânticos nomeiam função; componentes combinam funções. Exemplo: `palette.ink.800 → color.action → button.primary.background`. Não usar cor do livro como `button.primary.background`. O arquivo JSON é a fonte exata dos valores desta especificação; a implementação futura deve gerar/mapear CSS custom properties e Tailwind a partir desses valores, sem duplicá-los manualmente.

| Função semântica | Uso autorizado |
|---|---|
| canvas / surface / raised | Página / bloco ou campo / superfície elevada ou seleção |
| text / muted | Texto principal / texto secundário, ambos legíveis |
| border / divider | Contorno funcional / separação decorativa, não intercambiáveis |
| action / actionHover / onAction | Botão principal e seu texto |
| focus | Anel externo de foco com afastamento |
| mineral / slate / plum | Acentos editoriais permitidos; nunca significado financeiro |
| success / warning / danger | Ícone + rótulo de estado, não cor isolada |

Base clara: canvas #F6F5F1, texto #162D40 e ação #163C56. Base escura: canvas #101C26, texto #F1F3F2 e ação #B9D9F2. Valores completos estão no JSON e na tabela calculada; não aplicar opacidade a texto para criar níveis de importância.

Todos os textos funcionais, inclusive pequenos, usam pares ≥4,5:1. Contornos funcionais/foco ≥3:1 contra superfícies adjacentes. `divider` é apenas decorativo e não identifica sozinho campos/estados. Acentos/status são texto ou ícones sobre canvas/surface/raised; não inverter para fundo de botão sem novo cálculo. Imagens nunca são fundo de texto funcional sem painel opaco.

## Tipografia

| Papel | Família/peso | Celular | Desktop | Entrelinha |
|---|---|---|---|---|
| Expressão de marca / hero | Source Serif 4 / 600 | 36px | 64px | 1,08 |
| H1 de LP/artigo | Source Serif 4 / 600 | 32px | 48px | 1,15 |
| H2 editorial | Source Serif 4 / 600 | 28px | 36px | 1,2 |
| H3 / título de livro | Source Serif 4 / 600 | 22px | 24px | 1,3 |
| Texto de leitura | Source Serif 4 / 400 | 18px | 20px | 1,65 |
| Corpo/controle | Public Sans / 400 ou 600 | 16px | 16px | 1,5 |
| Título do painel | Public Sans / 600 | 24px | 28px | 1,25 |
| Legenda/metadado | Public Sans / 400 | 14px | 14px | 1,5 |

Tamanhos implementados em rem; interpolação limitada com rem + viewport, sem bloquear zoom. Nada de título em altura fixa ou redução automática até caber. Alinhamento à esquerda; linha de leitura até 65ch. Tracking de títulos -0,015em, corpo normal; não usar caixa alta como sistema de navegação. Numerais tabulares só em tabelas/valores financeiros.

WOFF2 local das fontes oficiais, pesos 400/600, cobertura de acentos portugueses e licença junto aos arquivos. Evitar família extra de ícones/fontes. Fallback Source Serif: Georgia, serif; Public Sans: system-ui, sans-serif. `font-display: swap`, ajuste de métricas após medição; preload apenas do arquivo necessário à primeira dobra. Orçamento planejado: fontes inicialmente transferidas ≤200 KiB comprimidos; medir e reduzir subset/pesos antes de flexibilizar. Licenças e arquivos não foram baixados nesta etapa.

## Ritmo e dimensões

Escala de espaço em px de referência: 4, 8, 12, 16, 24, 32, 48, 64, 96. Campos e botões públicos ≥48px de altura; controles compactos do painel com área acionável ≥44×44px. Distância entre controles independentes ≥8px. Não compactar texto de aviso para resolver falta de espaço.

Container site 1280px máximo; painel área de trabalho 1440px máximo além da navegação, com tabelas em scroll local quando indispensável. Artigo 65ch. Gutter e grids em [comportamento](06-comportamento.md). Raios: 4px campos/botões, 8px painéis/diálogos; pill apenas tags pequenas/controles de seleção. Cards de livro não exigem caixa arredondada.

Borda funcional 1px; foco 3px com offset 3px preenchido pela superfície adjacente. Separador 1px decorativo. Elevação: e0 sem sombra; e1 `0 4px 16px rgb(16 28 38 / 0.10)` no claro, no escuro borda + `0 4px 16px rgb(0 0 0 / 0.24)`; e2 reservado a diálogo `0 16px 48px rgb(0 0 0 / 0.24)`. Não sombrear cada card.

Camadas: base 0, header 10, CTA mobile 20, popover 30, overlay 40, dialog 50, toast 60. Diálogo modal e foco prevalecem sobre CTA. Scroll-margin-top respeita header e zoom. Tokens de duração/easing em [movimento](06-comportamento.md).

## Contratos de componente

Botão primário: action/onAction, hover actionHover/onAction, foco externo focus. Campo: surface/text, placeholder muted, borda border; erro danger com texto explícito. Card: canvas ou surface, título text e descrição muted; seleção raised com borda border + rótulo. Estado financeiro: texto/ícone de status sobre surface; nunca depender só do tom.

Estados disabled conservam texto muted e superfície raised, sem reduzir opacidade de todo o controle; borda funcional e motivo próximo quando necessário. Skeleton usa raised, sem shimmer no reduced-motion. Toast/alerta usa surface e borda/status apropriados. Temas escuros não são inversão automática de CSS.
