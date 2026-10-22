# Responsividade, tema e movimento

[Briefing](../../DESIGN-BRIEF.md) · [Qualidade](07-qualidade.md)

## Grids e conteúdo

| Largura de teste | Gutter | Grid editorial | Catálogo | Navegação |
|---|---|---|---|---|
| 360px | 16px | 4 colunas; narrativa em uma coluna | 1 coluna com capa/título em composição horizontal se couber | Menu compacto |
| 390px | 16px | 4 colunas; texto e prova empilhados | 1 coluna | Menu compacto |
| 768px | 24px | 8 colunas; seções simples em duas áreas | 2 colunas | Menu compacto |
| 1024px | 32px | 12 colunas; LP 7/5 ou 4/8 | 3 colunas | Navegação completa |
| 1440px | ≥48px | 12 colunas, container ≤1280px | 4 colunas | Completa |
| 1920px | Margens automáticas | Container ≤1280px, sem esticar leitura | 4 colunas | Completa |

Faixas são CSS: <640px uma coluna; 640–1023px duas; 1024–1279px três; ≥1280px quatro. Gaps 16px no mobile, 24px a partir de 768px. Hero não tem altura 100vh. Ordem DOM acompanha ordem de leitura; CSS não deve reorganizar foco incoerentemente.

Zoom 200% de texto e reflow equivalente a 320px precisam funcionar; testar 1280px com zoom 400%. A faixa de 320px é verificação adicional de acessibilidade, mesmo que os screenshots principais comecem em 360px. Título longo expande seção. Imagens reduzem dentro do container. Tabela larga usa scroll regional, nunca o body inteiro.

CTA fixo da LP somente abaixo de 768px, quando CTA original saiu da viewport e oferta está ativa. Mostrar preço/plataforma/ação em até duas linhas com espaço reservado; desativar sticky em altura útil <500px, teclado aberto, modal aberto ou zoom que cause sobreposição. CTA normal permanece acessível. Consentimento não é coberto pela barra; não ativar sticky antes de verificar isso.

## Tema

Tipo de preferência: `system | light | dark`, rótulos Sistema/Claro/Escuro; chave local `bibliotheon:appearance:v1`. Default system; valor inválido ou storage indisponível usa sistema e mantém escolha em memória na sessão. Preferência é funcional, sem identificador ou envio analítico.

No site, CSS media query fornece tema correto para system mesmo sem JS. Pequeno bootstrap antes do primeiro paint aplica escolha persistida a `data-theme`, usa `color-scheme` e segue CSP (hash estável previsto). Conteúdo renderizado no servidor não depende do tema para texto/markup; hidratação não deve recriar árvore. Escutar alteração do sistema somente em system, e evento storage entre abas. Nunca fazer transição de todas as cores durante carregamento.

No admin, usar API/provider de tema suportado pelo Payload, mapear valores e sincronizar escolha explícita com a mesma chave. Não combinar bootstrap independente e provider brigando por `data-theme`. Caso a API da versão escolhida não suporte adaptação, registrar incompatibilidade e resolver em B17 antes de homologar paridade, sem patch frágil no DOM.

## Movimento expressivo

| Uso | Duração | Comportamento |
|---|---|---|
| Hover/foco/pressionado | 120ms | Transição de cor; botão não salta nem muda largura |
| Menu/disclosure | 200ms | Opacity/transform de conteúdo; estado acessível imediato |
| Entrada editorial | 350ms | Uma capa/prova pode deslocar até 12px para sua posição |
| Sequência de destaque | Até 450ms total | No máximo três elementos secundários; título/preço/CTA já visíveis |
| Troca de aba/feedback | 160ms | Estado muda imediatamente; efeito não posterga informação |

Easing de entrada `cubic-bezier(0.2,0.8,0.2,1)`; saída `cubic-bezier(0.4,0,1,1)`; feedback linear quando necessário. Motion não usa layout como animação contínua. Não inserir biblioteca de animação obrigatória: CSS/WAAPI e observação simples bastam para este escopo.

Conteúdo principal nunca nasce opacity 0 aguardando JS. Só elementos secundários decorativos podem ter revelação, habilitada depois do JS, sem ocultar a única evidência do produto. Coreografia uma vez por navegação; nada de replay constante em cada scroll. Sem scroll hijacking, parallax obrigatório, cursor personalizado, vídeo automático ou capa 3D que exija WebGL.

`prefers-reduced-motion: reduce`: remover deslocamento, stagger, reveal e scroll suave; mudanças de estado instantâneas, spinner substituído por texto/progresso estático. A experiência completa deve continuar utilizável. Economia de dados orienta carregamento de mídia; nenhum vídeo é requisito da LP.

## Performance

Preservar R21. Dimensões de imagens explícitas, prioridade somente para imagem LCP real, lazy loading abaixo da dobra, fontes locais com fallback. Alvo inicial de mídia da primeira dobra ≤350 KiB por página, fontes ≤200 KiB; verificar em laboratório e negociar qualquer excesso com evidência. Nenhuma biblioteca de animação, fonte premium paga ou serviço de design obrigatório é introduzido.
