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

## Recorte de importação canônica — D80, 25/10/2026

[24 capturas e oito grupos de jornadas](../../artifacts/qa-commercial-imports/results.json): vazio, pronto, confirmado, blocked, stale real, erro/cabeçalho/tamanho, carregamento, dados de linha, paginação e perdas de resposta após gravação. Matriz claro/escuro em 320, 360, 390, 768, 1024, 1440 e 1920 px; texto 200% em 320 px, reduced-motion, confirmação por teclado e leitura sem JavaScript. Foram 23 análises axe sem violações; no fallback sem JS, leitura/ação desabilitada/overflow têm verificações próprias, sem axe. Zero erros de runtime e tentativas de requisição externa. Capturas representativas de mobile, dados financeiros e temas foram inspecionadas diretamente. A captura de texto 200% expôs uma entrelinha fixa herdada, corrigida com alturas proporcionais na view e nova verificação no harness antes da rodada final.

Isso não conclui zoom nativo 400%, todas as telas da fase 2 ou performance de laboratório/campo. A preferência de tema é aguardada no harness para capturar o estado renderizado correto; esta rodada não mede flash inicial nem repete toda a matriz system/storage/OS.

## Recorte de registro financeiro — D81, 25/10/2026

[40 capturas principais](../../artifacts/qa-financial-records/results.json) dos formulários de liquidação/custos em dois temas e 320, 360, 390, 768, 1024, 1440 e 1920px, incluindo vazio, conferência, registro, correção, carregamento, erro, histórico e fallback sem JS. [Oito capturas adicionais](../../artifacts/qa-financial-records/zoom-results.json) verificam os próprios formulários/conferências em texto 200%/320px, dois temas, IDs/aliases longos e valor máximo seguro. Zero overflow da página, erros de runtime ou tentativas externas; 47 análises axe sem violações em 48 capturas, com verificação própria no fallback sem JS. Altura de linha é proporcional e medida também após ampliar o texto; capturas representativas foram inspecionadas diretamente.

Campos nativos de uma linha mantêm rolagem/seleção internas; valores, IDs e instante UTC completos podem ser lidos no resumo antes da confirmação. A rodada não substitui zoom nativo 400%, toda a matriz de componentes/system/storage/OS ou a homologação visual integral do release.

D82: [QA local de identidade](../../artifacts/qa-catalog-resolutions/results.json) aprovada em seis grupos/29 capturas e 28 análises axe, dois temas, formulário em 320–1920px, loading/erro/sucesso, detalhes e texto 200%/320px com IDs longos; sem overflow/runtime/requisições externas. Fallback sem JS tem verificação própria. Alvos pequenos detectados no detalhe foram corrigidos, com repetição integral; capturas representativas foram inspecionadas. Recorte B20 de catálogo, sem certificar zoom nativo 400%, performance ou toda a fase 2.

D83: [QA financeira final](../../artifacts/qa-financial-resolutions/results.json) passou em sete grupos, 34 capturas/33 análises axe, temas/larguras 320–1920px, seleção/conferência com texto 200%/320px, loading/erro/sucesso e fallback sem JS próprio. Não houve overflow da página, runtime ou tentativas externas. Entrelinha dos botões foi corrigida após inspeção e a comparação computada passou na repetição final. Valores assinados/null e histórico de decisões/aplicações permanecem distinguíveis. Capturas representativas foram inspecionadas; não é aceite integral B20, zoom nativo 400% ou performance.

D84: [quatro grupos/21 capturas/20 análises axe](../../artifacts/qa-financial-coverage/results.json) para cobertura/coortes da prévia financeira, sem violações/runtime/overflow da página/tentativas externas. Dois temas, 320–1920px, texto 200% com entrelinha proporcional, tabela com scroll regional por teclado e filtros sem JS. Estados de revisão, origem ausente, taxa zero/desconhecida e soma fora do limite ficam distintos. Captura representativa inspecionada. Não conclui matriz integral, zoom nativo 400%, performance ou release.

D85: [25 capturas distintas/24 análises axe](../../artifacts/qa-financial-dimensions/results.json) para detalhamentos por livro/provedor/campanha e processamento, sem violações/runtime/overflow/tentativas externas. Paginação 20+1 preserva disclosure/filtros, com dois temas/320–1920px, texto 200% com entrelinha proporcional e navegação sem JS. Captura representativa inspecionada. Recorte não conclui matriz integral, zoom nativo 400%, performance ou homologação de fonte/release.

D86: [22 capturas distintas/21 análises axe](../../artifacts/qa-commercial-operation/results.json) da jornada operacional integrada, sem violações/overflow/runtime/tentativas externas. Cinco views, sete estados, catálogo, caixa/custo, relatório e reimportação; resultado nos dois temas e sem JS. Captura representativa inspecionada. Nenhuma mudança visual; fontes do build D85 conferidas. Aceite P05 não encerra B20 integral/zoom nativo 400%/performance ou homologação externa.
