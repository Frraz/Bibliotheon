# Qualidade visual e aceite

[Briefing](../../DESIGN-BRIEF.md) · [Testes do produto](../15-qualidade.md)

## Dois níveis de validação

**Documental:** especificação, cores calculadas, links/rastreabilidade e preservação das conversas. **Renderizado:** telas, interação, performance, acessibilidade e revisão visual. O primeiro nível não comprova o segundo nem conversão. Em 21/10/2026 existem rodadas renderizadas locais aprovadas para recortes públicos/editoriais/relacionamento; a matriz integral abaixo permanece parcialmente pendente. Ver [estado e evidências](../23-estado-atual.md).

## Matriz obrigatória do produto completo

| Família | Dados/estados | Cobertura |
|---|---|---|
| Home | 0, 1, 3 e 20 livros; capa ausente | Dois temas × seis larguras |
| Catálogo/tema | Filtro ativo, vazio, erro, título 160 caracteres | Dois temas × seis larguras |
| LP | guide/reading/workbook; oferta ativa/inativa; afiliado | Dois temas × seis larguras |
| Artigo/institucionais | Texto longo, links extensos, listas, amostra ausente | Dois temas × seis larguras |
| Captura/confirmar/preferências | Erro de campo, loading, sucesso, token expirado, descadastro | Dois temas × seis larguras |
| Painel | Listar/editar/relatórios/campanhas/contatos/integrações | Dois temas × seis larguras; dados sintéticos |
| Componentes isolados | Hover, focus, active, disabled, erro e loading | Dois temas em 390/1440px; demais larguras conforme uso |

Larguras: 360, 390, 768, 1024, 1440 e 1920px. Adicionar 320px/reflow, zoom 200% de texto, zoom 400% em 1280px, teclado e reduced-motion. Exercitar preferência sistema, troca manual, reload, storage negado e mudança do SO. Nenhum screenshot usa dados pessoais reais.

## Critério de crítica visual

1. Identidade: título, capa e ações têm hierarquia reconhecível; marca não depende de ornamento.
2. Composição: margens e alinhamentos coerentes, densidade adequada, nenhum bloco vazio para completar template.
3. Conteúdo: títulos completos, preço/condições claros, amostra legível, imagens íntegras.
4. Interação: teclado e toque, feedback, erros recuperáveis, nenhuma ação só em hover.
5. Temas: overlays, tabelas, inputs, autofill, skeletons e foco completos em ambos.
6. Performance: conteúdo visível imediatamente, estabilidade e ausência de console errors relevantes.

Defeitos bloqueantes: CTA inacessível, contraste abaixo dos pares autorizados, conteúdo cortado, overflow do body, foco preso/perdido, erro não recuperável, tema piscando, dados fictícios apresentados como reais. Refinamento estético sem falha funcional é registrado com exemplo e ação, não nota subjetiva “10/10”.

## Processo de inspeção

Renderizar → capturar → criticar com evidência → corrigir → recapturar áreas afetadas. Playwright e axe apoiam, mas não substituem teclado e avaliação humana de leitura. Revisão final deve incluir a home com um livro e uma LP completa nos dois temas. Manter baseline por rota/estado/viewport/tema; controlar fontes e animações nas comparações. Não atualizar snapshots automaticamente para esconder regressão.

Registrar versão, navegador, viewport, tema, cenário Txx, resultado, screenshots e limites. Critério final: sem defeito bloqueante conhecido; requisitos com evidência; pendências estéticas explicitadas. Validação automatizada de cores não é certificação WCAG.
