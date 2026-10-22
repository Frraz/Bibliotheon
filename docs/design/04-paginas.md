# Wireframes de páginas públicas

[Briefing](../../DESIGN-BRIEF.md) · [Componentes](03-componentes.md)

São wireframes textuais: ordem, proporção e comportamento, não imagens aprovadas. Todas as páginas têm header, main, skip link e rodapé; ambos os temas usam a mesma estrutura e conteúdo. Containers seguem [grids](06-comportamento.md). H1 identifica a obra/assunto; frase de apoio comunica benefício. Somente um H1 por página.

## Home

```text
Desktop, 12 colunas
[Marca | Catálogo | Artigos | Busca | Aparência]
[H1: Bibliotheon / apresentação editorial, 7 col] [obra destacada, 5 col]
[seleção de livros com títulos legíveis, sem carrossel automático]
[temas com conteúdo] [artigo selecionado e conexão ao livro]
[rodapé]
Mobile
[Marca | Menu]
[apresentação curta → livro destacado → ação]
[demais livros em sequência → temas → artigo → rodapé]
```

Obra destacada usa capa e nome reais, sem mockup decorativo. Catálogo de um livro: ampliar apresentação dessa obra e amostra, sem duplicar o mesmo card em várias prateleiras. Dois/três: mostrar todos sem seções vazias. Zero: mensagem de catálogo em preparação e conteúdo existente, sem oferta falsa. Mais livros: até seis selecionados e link ao catálogo. Seleção editorial manual, nunca rótulo “mais vendido” sem evidência.

## Catálogo e tema

```text
[H1 Catálogo + introdução breve]
[Busca_________________ Buscar] [Filtro tema] [contagem]
[livros em grid 1 / 2 / 3 / 4 colunas conforme largura]
[Paginação]
Tema: [nome e texto próprio] → [livros relacionados] → [artigos relacionados]
```

No celular, formulário acima dos resultados e filtros recolhíveis; botão Limpar sempre disponível quando filtro ativo. Card mostra título inteiro e capa em suporte uniforme. Tema vazio não gera página indexável; tema com artigos mas sem livro informa estado naturalmente sem prateleira vazia. Seleção do filtro e retorno da LP preservam contexto pela URL.

## LP — elementos compartilhados

Título, público, identificação digital, prova de conteúdo, oferta, entrega, limites e suporte continuam obrigatórios quando pertinentes. Preço/CTA podem estar na primeira dobra, repetidos ao final da narrativa sem mudar destino. A amostra é ação secundária. Alternativas de checkout permanecem acessíveis em disclosure. Perguntas frequentes dependem de dúvidas reais; o bloco pode ser omitido se vazio, sem omitir condições essenciais.

### Variante `guide` — guia prático (padrão)

```text
[Título da obra + resultado concreto de apoio, 7 col] [capa íntegra, 5 col]
[preço/plataforma/CTA + Ver amostra]
[problema e para quem] → [o que vai aprender: tópicos ligados ao conteúdo]
[páginas reais + aplicação demonstrada] → [sumário + materiais]
[requisitos e limites] → [oferta completa] → [FAQ se existente]
```

Benefícios usam linguagem de aprendizagem/aplicação, sem garantir renda. No mobile: título → apoio → capa → oferta curta, sem hero de 100vh. Título longo pode empurrar CTA além da primeira tela; leitura prevalece sobre forçar tudo a caber.

### Variante `reading` — obra de leitura

```text
[Título e autoria/responsabilidade editorial]
[capa, 4 col] [sinopse e amostra de leitura, 8 col]
[oferta curta]
[trecho real em largura de leitura] → [contexto e temas abordados]
[conteúdo/edição/formato] → [oferta completa e suporte]
```

Sem lista artificial de “resultados em X dias”. Trecho com indicação de origem; autoria real. Mobile preserva sequência título, capa, sinopse, ação e trecho. Obra de leitura continua e-book, sem promessa de edição física.

### Variante `workbook` — material com exercícios

```text
[Título + objetivo e conhecimentos prévios] [capa]
[oferta curta]
[exercício real: enunciado → espaço/resolução exemplar]
[como usar o material: etapas reais] → [conteúdo e complementos]
[limites e formatos] → [oferta completa + FAQ quando houver]
```

Só selecionável para conteúdo com exercícios e material de exemplo cadastrado. Não criar ferramenta interativa ou correção automática: o exemplo é evidência editorial estática. Mobile empilha páginas individualmente, sem reduzir duas folhas até ficarem ilegíveis.

## Artigos e listagem

```text
Listagem: [H1 Artigos] → [temas] → [lista de título/resumo/data real] → [paginação]
Artigo: [título] → [autoria/revisão] → [introdução] → [corpo até 65ch]
        [figuras/legendas] → [próximo passo: amostra ou livro pertinente]
```

Imagem só quando informa; sem banner obrigatório. Sumário para artigos longos com ≥4 seções H2, links âncora com scroll-margin, sem sidebar fixa no celular. Conteúdo principal e condições nunca ficam atrás de acordeão. Bloco relacionado aparece após valor entregue, não anúncio antes de cada parágrafo.

## Captura, confirmação e preferências

Captura em `/amostras/[slug]` (slug do material) ou seção equivalente da LP; usa o POST existente, não novo contrato comercial. Wireframe: `[material solicitado e miniatura] → [email/ajuda] → [marketing opcional] → [Receber amostra] → [privacidade]`. Largura do formulário até 480px. Após 202: mensagem genérica de confirmação enviada; não revelar cadastro prévio.

Confirmação: `[nome do material] → [Confirmar solicitação] → [resultado e acesso]`. GET não consome token. Sucesso mostra “Acessar amostra”; expirado mostra instrução de solicitar novo link; falha conserva contexto. Não confundir confirmação com assinatura de marketing.

Preferências: `[Aparência sistema/claro/escuro, disponível sem login]` no seletor global; `/preferencias` com token continua destinado à assinatura: `[assuntos atuais] → [opções permitidas] → [Salvar / Cancelar marketing]`. Não usar token da lista para armazenar tema. Descadastro concluído tem confirmação permanente, sem tentativa de reverter a escolha por padrão.

## Institucionais, indisponibilidade e erros

Sobre: propósito, responsabilidade editorial e critérios de seleção, sem história inventada. Contato: meio real de atendimento e horário/prazo somente quando definido. Privacidade/termos: texto legível, sumário quando longo, data de revisão; sem acordeão que esconda cláusulas.

404: identificar página ausente e oferecer catálogo/busca. 503: explicar indisponibilidade e tentar novamente, sem checkout desatualizado. Produto sem oferta mantém informações úteis e amostra se ativa. Estados de erro são completos nos dois temas.
