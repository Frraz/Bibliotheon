# Redesign público editorial — 28/10/2026

Implementação e aceite local da apresentação pública afetada, com **342 capturas** no mesmo build standalone. Direção aprovada: editora contemporânea; controle de aparência por ícone com opções Sistema/Claro/Escuro. Sem alteração de schema, checkout, provedores ou painel Payload. Nenhuma implantação na VPS.

## Entrega

Home assimétrica, arte abstrata CSS decorativa, tipografia editorial e hierarquia refinada. Navegação compacta, indicação de página atual no desktop, menu móvel e novo controle de tema. Acabamento compartilhado do catálogo, assuntos, LPs nas três variantes, artigos, institucionais, amostras, preferências, erros e 404. Cores e fontes canônicas preservadas. O fundo de feedback só aparece quando há mensagem.

UI UX Pro Max aplicada da instalação local, sem instalar dependências. A consulta específica `editorial magazine typography --domain style` confirmou Editorial Grid / Magazine; recomendações genéricas de substituir fontes/paleta não foram adotadas. A arte decorativa não representa um produto físico à venda.

## Evidências

| Rodada | Resultado | Evidência |
|---|---|---|
| Fundação | 14 telas nos dois temas, mais menu de aparência e landscape: 16 capturas; foco, teclado, Escape, clique externo, persistência, sistema, abas, storage negado, sem JS e bootstrap antes da hidratação | [Resultados](foundation/results.json), [manifesto](../qa-release-layout/d130/foundation.json) |
| Páginas públicas | 238 capturas; 320/390/768/1024/1440/1920px, ambos os temas, busca/filtros, LPs, artigos, institucionais, amostras, confirmação, preferências, título longo, capa ausente, home com um livro, 404, texto 200%, teclado e oito capturas com zoom nativo 400% | [Resultados](site/results.json), [manifesto](../qa-release-layout/d130/public-site.json) |
| Estados alternativos | 88 capturas; erro real de tabela e recuperação somente no banco descartável, conteúdo longo, links/listas, capas ausentes, ofertas inativas, foco/hover/ativo/expandido, fontes bloqueadas, sem JS e hidratação atrasada | [Resultados](states/results.json), [manifesto](../qa-release-layout/d130/public-states.json) |
| Checks | Tipos, lint, build final, 62 testes operacionais, contrastes, documentação e diff aprovados. Unitários: 314 aprovados e um timeout inicial; os 16 testes do arquivo afetado passaram na repetição isolada | [Resumo e hashes](checks.json) |

Inspeção visual pelo agente: home clara desktop e escura mobile, home tablet com catálogo, menu de aparência com foco a 320px, formulário de amostra após correção, LP guia, catálogo/artigo escuros mobile, erro, home com um livro/título longo, 404 e captura física do zoom nativo. axe/overflow acompanham as rotas; as oito capturas nativas têm zoom real e largura CSS de 320px verificados, sem declarar que receberam nova análise axe separada.

O teste de clique externo foi corrigido para clicar fora da área coberta pelo menu; a comparação do zoom usa tolerância para o retorno fracionário `3.9999999999999996`. As rodadas finais passaram, mantendo as checagens de overflow e violações.

## Reprodução

Com PostgreSQL local disponível, dependências e Chromium já preparados:

```bash
NEXT_DIST_DIR=.next-qa npm run build
BIBLIOTHEON_SYNTHETIC_TESTS=true BIBLIOTHEON_BROWSER_QA_PHASE=D130 node --env-file-if-exists=.env.local scripts/qa-browser-isolated.mjs foundation
BIBLIOTHEON_SYNTHETIC_TESTS=true BIBLIOTHEON_BROWSER_QA_PHASE=D130 node --env-file-if-exists=.env.local scripts/qa-browser-isolated.mjs public-site
BIBLIOTHEON_SYNTHETIC_TESTS=true BIBLIOTHEON_BROWSER_QA_PHASE=D130 BIBLIOTHEON_PUBLIC_STATES_MODE=redesign node --env-file-if-exists=.env.local scripts/qa-browser-isolated.mjs public-states
```

O harness cria/remove bancos e mídia exclusivos, preserva o banco configurado, verifica hashes/build e encerra os servidores que iniciou. Evidências D121–D126 preservadas; a rodada nova fica separada em D130.

## Limites e próxima ação

Aceite local do recorte público alterado de B17/B20. Não é certificação WCAG, teste em todos os navegadores/dispositivos físicos, nova homologação do admin, desempenho de campo, integração de fornecedor, envio ou deploy. Não houve nova medição de orçamento de desempenho. As telas usam conteúdo sintético; revisão com conteúdo real e validação do ambiente publicado seguem com o proprietário. A imagem D127 não contém este redesign; publicação exige novo build/atualização do ambiente. P07 e demais pendências de produção continuam independentes.
