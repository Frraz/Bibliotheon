# Design do painel administrativo

[Briefing](../../DESIGN-BRIEF.md) · [Componentes](03-componentes.md)

## Extensão do Payload

Manter autenticação, formulário, controle de acesso, listagens e navegação nativos. Aplicar identidade por stylesheet administrativo, variáveis suportadas, marca e componentes registrados nos pontos de extensão da versão adotada. Consultar [customização CSS oficial](https://payloadcms.com/docs/admin/customizing-css) e validar no bootstrap. Não copiar DOM interno, sobrescrever seletores frágeis ou criar fork do CMS para igualar screenshots.

Public Sans domina o painel; Source Serif restrita à assinatura da marca e preview editorial. Superfícies, foco, estados e raios compartilham tokens do site. O theme provider suportado do Payload deve ser a autoridade dentro do admin; um adaptador traduz a preferência global, sem dois controladores concorrentes. Ambos os temas precisam ser homologados em componentes nativos e personalizados.

## Estrutura e telas

```text
Desktop >=1024px
[Marca / navegação 240px] [caminho / título / ação primária / aparência]
                        [filtros ou contexto]
                        [área principal e feedback]
Mobile
[Menu / título curto / ações] → [conteúdo] → [ações secundárias em menu]
```

| Tela | Wireframe e hierarquia | Casos essenciais |
|---|---|---|
| Dashboard | período/freshness → resumo financeiro com limites → pendências de publicação/conciliação → atividade recente | Sem dados mostra próximas ações; nenhuma série fictícia; discrepância junto ao total |
| Livros | título + Cadastrar → busca/estado/tema → tabela capa/título/estado/oferta → paginação | Título longo quebra; preview separado de publicação; linha não vira link aninhado |
| Edição do livro | título/estado + Salvar/Preview/Publicar → grupos Conteúdo, Apresentação, Ofertas, SEO | Validação no grupo e resumo de erros; preservar texto em falha; aviso de saída se alterações |
| Apresentação | variante com descrição + acento com rótulo e swatch duplo → mídias/legendas → preview | Escolha em enum; sem editor CSS/HEX livre; workbook exige evidência de exercícios |
| Ofertas | livro → três provedores e respectivos estados → preço/destino/última conferência | Primária e ativa distintas; desconhecido não vira “integrado”; indisponibilidade explícita |
| Campanhas | objetivo/estado → tarefas e prazos → ativos/links → resultados disponíveis | Ação comercial manual; links afiliados identificados sem revelar segredos |
| Contatos | filtros tema/estado → lista mínima → detalhe de consentimento e supressão | Sem PII em screenshots; opt-in não pode ser inventado em edição administrativa |
| Relatórios | período/fuso → cobertura e última conciliação → tabela por livro/plataforma/campanha → divergências | Null como não informado; valores à direita; cores acompanhadas de rótulos |
| Integrações | provedor/estado/último sucesso → pendências → histórico sanitizado → reprocessar | Erro descreve saída; reprocessamento não permite editar valor da venda |

Cada tela cobre loading, vazio, erro, sucesso e acesso negado. Admin anônimo não recebe detalhes de integração. Tabelas têm versão mobile por detalhe da linha; em relatório largo, scroll horizontal restrito à região com rótulo e foco, mantendo total acessível. Sem truncar identificadores necessários à conciliação sem permitir leitura completa.

## Ações e estados

Uma ação principal por contexto; salvar rascunho não se confunde com publicar. “Publicado” editorial não recebe o mesmo rótulo de “Pagamento aprovado”. Estados: integração pendente usa warning + texto; falha danger + texto; sucesso success + texto; unknown neutro + texto. Não colorir receita inteira de verde apenas por ser positiva.

Confirmação destrutiva descreve objeto e consequência; foco inicial em opção segura, retorno ao acionador. Tarefa longa informa processamento e pode ser reencontrada após navegar; toast não substitui linha de estado. Campo inválido tem mensagem próxima e associação acessível.

## Tema e motion

Painel segue sistema/claro/escuro; conteúdo e permissões idênticos. Skeleton e overlay adaptados ao tema; gráficos opcionais também têm tabela equivalente e padrões/rótulos. No painel só transições funcionais de 120–200ms; não executar a coreografia editorial em cada abertura de formulário. Preview usa o tema selecionado sem alterar dados do livro.

## Views operacionais implementadas localmente — D79–D81

Prévia financeira usa `/admin/financial-ledger`; importação usa `/admin/commercial-imports`. Ambas preservam o template, navegação, autenticação e tema suportados do Payload. Importação coloca o lote selecionado antes do novo upload, com consequência da confirmação próxima à ação; dados completos por linha e auditoria ficam em disclosures. Os 20 lotes recentes e paginação de 50 linhas permitem retomar trabalho sem novo CMS. Registro/correção de liquidação/custos usa `/admin/financial-records` em D81: formulário → conferência → registro, com dados preservados em erro, referências estáveis e histórico vigente/substituído. Decisão/resolução permanece pendente; o QA atual é um recorte da matriz completa.

## Resolução de identidades — D82

`/admin/catalog-resolutions` reutiliza template, autenticação e tema do Payload, controles/tokens existentes e disclosure nativo. Fluxo: dados → prévia de escopo/destino/snapshot → atestação → decisão. Histórico por provedor em páginas de 20; detalhe mostra fonte/autoria/revisões. Bloqueio e associação têm rótulos distintos; associação não indica venda. IDs completos quebram linha, campos ficam preservados em erro, ação em curso bloqueia repetição simultânea, e o foco retorna ao feedback. Fonte/UUID idempotente não são persistidos no navegador. Resolução financeira visual permanece pendente.

## Resolução financeira — D83

`/admin/financial-resolutions` preserva template/tema e tokens existentes. Fluxo: identidade → fontes e variantes → escolhas/exclusões explícitas → prévia dos efeitos/bloqueios → atestação → decisão/aplicação. Paginação mantém escolhas e não omite fontes da exigência de cobertura. Foco segue título da seleção/prévia ou feedback de erro/sucesso; requisição em curso desabilita controles. Histórico/detalhe distingue resultado registrado de aplicações posteriores; originais ficam acessíveis, e a prova JSON dá leitura integral. Sem seleção automática, modal ou biblioteca nova. Cobertura visual integral permanece em B20.

## Cobertura financeira — D84

A view de prévia financeira acrescenta contagens de quarentena/data ausente, cobertura de estado/valor, taxa condicional, idade observada e aviso de limite aritmético. Tabela larga usa a região de scroll com rótulo/foco; o documento não deve ganhar scroll horizontal. Tema e controles seguem os tokens existentes, com entrelinha proporcional também em texto ampliado. Idade observada é acompanhada do limite de homologação da janela. Escopo financeiro integral segue pendente.

## Detalhamentos financeiros — D85

Detalhamentos ficam em disclosures nativos de livro/provedor/campanha, com grupos de 20 e links GET que preservam filtros/seção aberta. Rótulos de livro/campanha linkam o cadastro; revisão e alocação desconhecida têm texto próprio. Tabela larga conserva região de scroll, foco e entrelinha proporcional. Sucesso registrado tem cobertura e limite de população, distinto do horário da consulta; custo e receita não atribuída não se confundem. Sem modal, cor, biblioteca ou sistema visual novo.

## Aceite operacional conjunto — D86

As cinco views existentes foram percorridas na mesma jornada: upload/prévia/lote, catálogo bloqueado e associado, prévia dos sete estados, decisões, recusa de caixa pendente, caixa/custo, relatório e repetição. Confirmar fonte, confirmar decisão e confirmar recebimento continuam ações separadas com consequências visíveis. Temas/sem JS foram conferidos no resultado integrado; matrizes anteriores de cada view permanecem recortes. D86 não encerra B20 integral, zoom nativo 400% ou performance.
