# Bibliotheon — Design Brief

**Estado em 28/10/2026: direção aprovada e H05/B19/B20 aceitos localmente pela matriz D121–D126.** Este documento governa identidade e apresentação; regras comerciais continuam nos documentos de produto. O [estado atual](docs/23-estado-atual.md) identifica capturas, auditoria do aceite local e gates de produção ainda abertos. A especificação não certifica automaticamente a implementação.

## Conceito: conhecimento em edição

Bibliotheon é uma editora digital de catálogo plural. A qualidade deve aparecer na escolha das palavras, apresentação das obras, legibilidade e cuidado das interações. A assinatura é o encontro entre títulos editoriais, capas íntegras e uma composição com margens precisas: a ideia de uma página bem editada, traduzida para navegação digital.

O visitante precisa reconhecer o livro, entender o que recebe, avaliar uma amostra e escolher uma oferta. O proprietário precisa publicar e interpretar resultados sem esforço desnecessário. Beleza é uma intenção; conversão e qualidade percebida são hipóteses a avaliar.

## Decisões fixadas

| Eixo | Direção |
|---|---|
| Personalidade | Editorial contemporânea, segura, culta sem elitismo, clara e acolhedora |
| Marca | Logotipo tipográfico Bibliotheon; sem símbolo final nesta etapa |
| Fontes | Source Serif 4 para expressão editorial; Public Sans para interface e textos funcionais |
| Paleta | Papel claro, tinta azul profunda e acentos minerais; temas claro e escuro completos |
| Layout | Assimetria com alinhamentos comuns, capas protagonistas, espaço que organiza a leitura |
| LPs | Família flexível com variantes guia prático, leitura e exercícios |
| Motion | Editorial expressiva no site; funcional no painel; redução de movimento completa |
| Imagem | Capas e páginas reais, sem alteração de cor pelo tema |
| Tema | Sistema por padrão; escolhas claro/escuro persistidas localmente |
| Painel | Extensões suportadas pelo Payload, sem reconstruir o CMS |
| Estado atual | Site/painel implementados e QA local de lançamento aceito em D126; novas telas/estados reabrem somente a cobertura afetada, sem certificar ambiente real |

## Fontes de verdade

- [Identidade, imagem e referências](docs/design/01-identidade.md)
- [Tokens e tipografia](docs/design/02-tokens.md)
- [Componentes e estados](docs/design/03-componentes.md)
- [Páginas públicas e LPs](docs/design/04-paginas.md)
- [Painel administrativo](docs/design/05-painel.md)
- [Responsividade, temas e movimento](docs/design/06-comportamento.md)
- [Qualidade e matriz visual](docs/design/07-qualidade.md)
- [Skills e fontes](docs/design/08-skills-referencias.md)
- [Cores canônicas](docs/design/cores.json) e [contrastes calculados](docs/design/09-contrastes.md)

## O que torna a proposta específica

A home adapta sua composição ao tamanho real do catálogo. A LP apresenta evidências do conteúdo antes de ampliar a persuasão. As cores dos livros convivem com a identidade da editora sem tomar conta dos controles. Títulos podem ocupar mais espaço sem virar imagens ou serem cortados. O painel conserva o vocabulário e a assinatura da marca, com menos ornamento e mais informação.

Evitar card em torno de cada parágrafo, falsa lombada física para e-book, brilho metálico, gradiente decorativo, texto cinza fraco, títulos inteiros em caixa alta, contadores artificiais, logos de parceiros sem autorização e depoimentos inexistentes. FAQ é conteúdo útil, não preenchimento obrigatório.

## Procedimento de execução visual

Ler este briefing antes de qualquer trabalho visual. Aplicar tokens e composição; testar estados e temas; revisar screenshots e teclado; corrigir; registrar evidências. Fontes de sistema são fallback, não a identidade tipográfica principal. Não instalar skills ou bibliotecas globalmente como consequência deste documento.

[Índice do projeto](README.md) · [Conversa de inspiração preservada](<ideais para melhora o desing.md>)


## Redesign público editorial — 28/10/2026

Solicitação do proprietário: elevar toda a interface pública na direção **editora contemporânea**, com mais expressão artística e controle de aparência por **ícone com opções Sistema/Claro/Escuro**. Aplicada a skill UI UX Pro Max instalada localmente, com consultas `bookstore editorial artistic --design-system` e `responsive images fonts --stack nextjs`. As sugestões genéricas de substituir fontes/paleta não foram adotadas: o briefing e os tokens canônicos prevalecem.

A implementação mantém Source Serif 4/Public Sans e cores existentes; trabalha abertura assimétrica, arte abstrata CSS sem representar produto à venda, capas íntegras, navegação compacta, filtros, páginas de leitura, ofertas, formulários e estados compartilhados. O controle usa botão com expansão e grupo de rádios nativos, foco, Escape e fechamento ao sair/clicar fora; preserva armazenamento e bootstrap anteriores. Sem mudança de schema, contratos comerciais, IA no produto ou publicação na VPS.

A cobertura pública afetada de B17/B20 foi aceita localmente em 342 capturas no mesmo build; os aceites D126 permanecem históricos para os demais recortes. Evidências desta rodada e limitações: [redesign público](artifacts/qa-public-redesign/README.md).
