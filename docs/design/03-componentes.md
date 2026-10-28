# Componentes e estados

[Briefing](../../DESIGN-BRIEF.md) · [Tokens](02-tokens.md) · [Comportamento](06-comportamento.md)

Cada componente usa os tokens do tema ativo. As regras abaixo valem igualmente em claro e escuro; não criar variante com menos informação no escuro. Estados universais: default, hover quando existe ponteiro preciso, focus-visible, active, disabled e loading quando aplicáveis. Hover nunca é o único meio de descobrir ação.

| Componente | Anatomia e variações | Interação / estados / mobile |
|---|---|---|
| Header público | Marca, Catálogo, Artigos, busca, seletor de tema | Menu colapsa abaixo de 1024px; botão com nome e expanded; drawer modal com Escape e retorno do foco |
| Tema | Controle “Aparência” com Sistema/Claro/Escuro | Grupo de opções acessível; não usar sol/lua sem nome; sem guardar identificação do visitante |
| Botão | Rótulo, ícone opcional, primário/secundário/textual | Link para navegação, button para ação; busy mantém largura e rótulo contextual; não deixa clicar duas vezes |
| Campo | Label, ajuda, input, erro associado | Sem placeholder substituindo label; input email a 16px; erro com aria-describedby e foco após submit |
| Checkbox | Controle, finalidade e ajuda | Marketing separado e desmarcado; hit area ≥44px; disabled não parece aceito |
| Card de livro | Capa, título completo, resumo, disponibilidade, preço quando real | Capa/título linkados à LP; amostra/compra separados sem links aninhados; título não truncado por padrão |
| Busca e filtros | Campo, botão buscar, tema, contagem e limpar | GET compartilhável; mobile painel recolhível; contagem anuncia alteração sem roubar foco |
| Oferta | Valor, moeda, plataforma, materiais, entrega, CTA e alternativas | Um destino principal; alternativas em disclosure; indisponível explica motivo sem fallback comercial silencioso |
| Amostra | Página/trecho, legenda, ação de acesso | Modal só para ampliação opcional; captura em seção/rota dedicada; zoom não corta texto |
| Disclosure / FAQ | Pergunta e resposta, indicador | Preferir details/summary; teclado nativo; sem FAQ vazia |
| Abas | Lista de tabs e painéis relacionados | Setas/Home/End; foco e selected distintos; só usar para conteúdos equivalentes, nunca esconder condição de preço |
| Diálogo | Título, descrição, conteúdo, ações e fechar | Foco contido, Escape, restauro, fundo inert; largura até 640px e altura com scroll interno; nenhum modal de entrada promocional |
| Tabela | Caption, cabeçalhos, linhas, ordenação, ações | Números à direita; aria-sort; no mobile detalhes expandíveis ou scroll local com rótulo, não apagar colunas financeiras |
| Badge | Texto de estado e ícone opcional | Sem interatividade fictícia; published não significa vendido; null financeiro apresentado como “Não informado” |
| Alerta | Título, descrição, ação | Status não urgente polite; erro bloqueante assertive com parcimônia; não anunciar todos os campos repetidamente |
| Toast | Resultado e ação opcional | Não é único lugar para erro importante; sucesso breve, erro permanece até dismiss; respeita leitura/foco |
| Paginação | Anterior, página atual, próxima | Links com aria-current; não carregar infinitamente por padrão; manter busca/filtro |
| Rodapé | Marca, navegação útil, contato, políticas, aparência | Empilha por assunto no mobile; sem selos, números ou parceiros inventados |

## Resiliência de conteúdo

Título de 160 caracteres: quebra natural, sem sobrepor capa/preço; não reduzir fonte abaixo do token. URL longa quebra em locais seguros. Sem preço: “Oferta indisponível”, não R$ 0. Sem vendas: vazio honesto, não gráfico de demonstração em produção. Erro de mídia preserva dimensão e legenda; falha de busca mantém filtros e oferece tentar novamente.

Loading inicial reserva espaço apenas quando dados realmente aguardam; evitar skeleton para conteúdo já renderizado no servidor. Submit conserva campos digitados em falha e associa erros. Ação destrutiva usa confirmação explícita contextual; publicação valida antes de trocar status. Padrões administrativos nativos do Payload prevalecem quando já atendem à regra.

## Contrato de cor e tema

Texto principal e legenda usam text/muted sobre canvas/surface/raised. Ação primária usa o par action/onAction. Acento editorial pode aparecer em título de seção, ícone decorativo ou linha, nunca substituir danger/success ou o botão comercial. Contorno border identifica campo; divider não basta. Todos esses pares são auditados em [contrastes](09-contrastes.md).

No escuro, menus, modais, native inputs e autofill precisam seguir o tema; verificar também tooltips, erros e conteúdo rich text. Capas não recebem filtro. Foco é visível em controles claros e escuros por anel com offset da superfície, sem depender da sombra.


## Redesign público editorial — 28/10/2026

Aparência pública: botão circular de 46px com ícone SVG, nome acessível “Aparência” e estado expandido. Abre fieldset com rádios Sistema/Claro/Escuro e descrição. Teclado nativo entre rádios; Escape fecha e devolve foco, clique externo e saída de foco fecham. Controles do admin permanecem no Payload.

Evidências e limites: [redesign público](../../artifacts/qa-public-redesign/README.md).
