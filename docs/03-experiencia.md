# 03 — Experiência, páginas e painel

[Índice](../README.md) · [Dados](05-dados.md)

## Mapa de navegação

Mapa do produto completo; rotas existentes e pendentes estão discriminadas no [estado atual](23-estado-atual.md).

| Rota prevista | Comportamento |
|---|---|
| `/` | Proposta da marca, destaques editoriais e temas com conteúdo |
| `/ebooks` | Busca `q`, filtro `tema`, paginação `page`; 12 itens por página |
| `/ebooks/[slug]` | LP canônica; slug não depende da categoria |
| `/temas/[slug]` | Introdução própria, livros e artigos do tema; vazio não entra no sitemap |
| `/artigos` e `/artigos/[slug]` | Conteúdo útil com próximo passo relacionado |
| `/sobre`, `/contato`, `/privacidade`, `/termos` | Identidade responsável, suporte e condições aplicáveis |
| `/amostras/[slug]` | Captura de material ativo; usa contrato existente de solicitação |
| `/amostras/confirmar` e `/preferencias` | Confirmação e gestão de assinatura, noindex |
| `/admin` | Painel Payload autenticado |

Não criar página de ferramenta vazia na primeira versão. Alteração de slug publicado exige redirecionamento permanente de caminho antigo para novo, sem cadeias ou ciclos. Busca/filtros não geram infinitas páginas indexáveis.

## LP reutilizável

Estrutura flexível em três variantes `guide`, `reading` e `workbook`, especificadas nos [wireframes](design/04-paginas.md). Todas preservam identificação, conteúdo real, condições e oferta; a ordem narrativa acompanha a natureza da obra. FAQ só quando houver conteúdo pertinente.

O CTA principal informa ação e plataforma. Preço pertence à oferta selecionada, com moeda, condições e data da última conferência. Sem parcelamento ou desconto inventado. Alternativas ficam em seção expansível “Outras opções de compra”, sem esconder condições.

LP afiliada usa a mesma página com contexto opaco de campanha validado no servidor; todos os CTAs comerciais daquela navegação respeitam sua oferta vinculada. Se indisponível, explicar indisponibilidade e não substituir silenciosamente o destino.

Livro pronto sem oferta ativa pode ter página informativa e amostra, sem botão de compra. Livro em produção fica em rascunho por padrão; página pública de interesse só após ação editorial explícita, com aviso de indisponibilidade e sem preço de pré-venda.

## Direção visual

Direção canônica: [conhecimento em edição](../DESIGN-BRIEF.md). Source Serif 4 e Public Sans locais; fontes de sistema são fallback. Temas claro e escuro completos, com preferência sistema/claro/escuro. Cores, hierarquia, raios e estados definidos no [sistema de tokens](design/02-tokens.md). Variantes e acentos controlados permitem adaptar cada LP sem CSS arbitrário.

Conteúdo de leitura com largura aproximada de 65 caracteres, corpo mínimo de 16px e altura de linha confortável. Componentes: botão, campo com erro, card, badge de disponibilidade, accordion FAQ, tabela de oferta, alerta e vazio. Estados de loading, sucesso, erro e indisponibilidade têm mensagem útil e próxima ação.

Responsividade desde 360px, imagens com dimensões reservadas e formatos otimizados. Foco visível, landmarks, hierarquia de títulos, label em todo campo, texto alternativo e respeito a reduced-motion. CTA fixo mobile segue as regras de viewport, zoom e oferta ativa em [comportamento](design/06-comportamento.md). Movimento editorial expressivo não atrasa conteúdo nem CTA; redução de movimento elimina coreografia.

## Painel

Grupos: Conteúdo (livros, temas, artigos, mídia, amostras); Comercial (ofertas, campanhas e tarefas); Relacionamento (contatos e consentimentos); Resultados (transações, importações e relatórios); Operação (eventos, fila e configurações).

Livro apresenta checklist de publicação e ação “Pré-visualizar”. Publicação valida campos, amostra existente quando anunciada, oferta e referências. Arquivar retira de listagens; preservar página informativa útil ou aplicar redirecionamento editorial, sem redirecionar tudo para home.

Relatório mostra período, fuso, plataforma e qualidade dos dados. Vazio diz “nenhuma venda registrada”, não “ninguém comprou”. Integração atrasada aparece ao lado dos números.

## Busca e SEO

Busca PostgreSQL simples, normalizada para caixa e acentos em coluna de busca, com limite de 120 caracteres. Evitar serviço de busca externo para o catálogo inicial. Página inválida retorna 404; filtro sem resultado oferece remoção de filtros.

Title/description únicos, canonical sem UTMs, sitemap só de URLs publicadas, robots noindex para preview/admin/busca e proteção por autenticação onde necessário. Dados estruturados apenas sobre fatos reais; nunca avaliações fictícias. Noindex não substitui controle de acesso.
