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
