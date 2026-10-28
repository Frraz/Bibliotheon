# Qualidade visual e aceite

[Briefing](../../DESIGN-BRIEF.md) · [Testes do produto](../15-qualidade.md)

## Dois níveis de validação

**Documental:** especificação, cores calculadas, links/rastreabilidade e preservação das conversas. **Renderizado:** telas, interação, performance, acessibilidade e revisão visual. O primeiro nível não comprova o segundo nem conversão. Em 28/10/2026 a matriz combinada D121–D126 tem aceite local de lançamento; imagem/API têm evidência D127; contas, P07 e ambiente real continuam separados. Ver [estado e evidências](../23-estado-atual.md).

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

D121: [60 combinações em zoom nativo de 400%](../../artifacts/qa-release-layout/d121-native-results.json), 120 capturas verificadas, layouts de 320px e dois temas. Correções locais no foco da barra do editor e alvo do link de arquivo. Público/admin tiveram capturas representativas inspecionadas. A matriz integral e laboratório final continuam pendentes.

Fechamento D121: o [laboratório público](../../artifacts/qa-release-layout/d121-results.json) passou com 30 livros/3 temas/30 artigos, 12 medições móveis (CPU 4×/150ms/200.000 bytes/s) e 75 requests em concorrência 5/10. INP de campo e capacidade da VPS não foram afirmados. A [inspeção visual](../../artifacts/qa-release-layout/d121-visual-review.json) foi representativa; H05 integral permanece aberto.

## D122 — Cobertura atual e lacunas delimitadas

[Nove suítes/496 capturas](../../artifacts/qa-release-layout/d122-results.json), no build QA D121, passaram. Home 0/1/3/20, catálogo/filtro/vazio, três LPs/afiliado, artigo/institucionais, cinco telas editoriais, login/dashboard, amostra/confirmar/download/descadastro/token inválido, preferências temáticas/globais e calendário possuem evidência renovada. A jornada comercial integrada passou em seis grupos/22 capturas, com sete estados e fallback sem JS. Não houve mudança de estilo nesta rodada. [Crítica visual](../../artifacts/qa-release-layout/d122/visual-review.json) foi amostral, incluindo home de um livro e LP completa nos dois temas.

A lista residual desta revisão D122 foi encerrada localmente em D126, conforme a auditoria combinada ao final deste documento. Novos estados/telas ou falhas exigem somente revalidar o recorte afetado.

Zoom nativo D121 e laboratório público preservam a própria evidência; não foram repetidos sob concorrência das suítes D122. A revisão de fonte/lockfile/estilos e o Build ID estão em cada manifesto. A matriz integral permanece parcial, sem defeito bloqueante conhecido nos recortes que passaram.

Limite identificado em D122: o transporte desligado em D121 fazia a rota de amostra exibir indisponibilidade. As 60 combinações de zoom continuam válidas para os estados realmente capturados, mas não comprovam o formulário ativo dessa rota a 400%. D122 validou o formulário ativo em seis larguras com transporte sintético; o recorte de zoom ativo continua explicitamente pendente.

## D123 — Aceite do recorte de formulários

[250 verificações](../../artifacts/qa-release-layout/d123-results.json), com 284 PNGs e 238 análises axe. São 17 estados por combinação de tema/largura: captura ativa/email inválido, loading/erro/retentativa na captura, confirmação, consulta, cancelamento temático e cancelamento global. Doze combinações regulares (360/390/768/1024/1440/1920px) e duas em zoom nativo 400% (janela 1280px/layout 320px/DPR4). Mais 12 capturas de fallback sem JavaScript em 390/1440px: aviso explícito, HTML/overflow e nenhuma POST ao abrir as três rotas, sem axe nesse modo.

A primeira execução reproduziu foco perdido após erro da captura, corrigido no cliente. Feedback/download/seção recebem foco somente quando o elemento ativo caiu no corpo; mover foco para o aviso de privacidade durante a espera não é desfeito. A retomada nativa corrige somente tolerância numérica do protocolo: o Chromium informou 3,9999999999999996. Os 204 estados regulares anteriores foram auditados e preservados, incluindo hash do protocolo original e identidade de runtime/PNG/Build ID; o relatório original mantém failed.

[Inspeção de três capturas](../../artifacts/qa-release-layout/d123-visual-review.json) confirmou feedback/foco e legibilidade nos recortes vistos. A pendência de formulário ativo a 400% fica atendida por D123. H05 continua parcial para conteúdo adverso, demais componentes/views e carga comercial da tabela; este recorte não homologa conta real ou capacidade da VPS.

## D124 — Carga comercial medida

[180 requisições em 45 jornadas](../../artifacts/qa-release-layout/d124-results.json), com 30 livros publicados, três temas, 30 artigos e mil transações aprovadas sintéticas distribuídas pelos três provedores. Seed passa pelo receptor/processador canônico interno; a carga mede HTTP real do catálogo filtrado, prévia financeira autenticada, inbox com todos os estados e replay de um callback Hotmart sintético. São cinco clientes × três jornadas e depois dez × três, com quatro requests sequenciais por jornada. Cache aquecido; uma única sessão de owner compartilhada em clientes independentes, sem inventar contas adicionais.

| Endpoint | p95 com 5 clientes | p95 com 10 clientes |
|---|---|---|
| Catálogo filtrado | 1.265ms | 2.059ms |
| Prévia financeira | 1.715ms | 2.852ms |
| Inbox comercial | 1.648ms | 3.090ms |
| Replay do callback | 149ms | 238ms |

Sem erro nas requisições medidas. Inbox ficou com 1.001 entradas, mas o ledger manteve mil transações/fatos durante o replay pendente. Após processamento explícito, passou a 1.001 transações/fatos e a repetição não duplicou. A prévia preservou quantidade/valor bruto e null de recebimento; não transformou aprovação em caixa ou lucro. Bancos e mídia descartáveis removidos; nenhum envio ou conta externa.

As latências são observações desse perfil local e finito; o timeout de 30s é do ensaio, não um SLA. Não medem LCP/INP/CLS de campo nem capacidade da VPS. O recorte de carga comercial da tabela foi executado; H05 continua parcial nos demais itens visuais/componentes/views. Os avisos anteriores que dizem carga pendente descrevem a etapa em que foram escritos.

## D125 — Recuperação e adversidades públicas — 28/10/2026

[208 verificações/208 capturas/208 análises axe](../../artifacts/qa-release-layout/d125-results.json) passaram sem overflow, violações detectadas ou requisições externas. Dois temas e seis larguras (360/390/768/1024/1440/1920px): 12 erros reais de consulta no banco descartável e 12 recuperações por teclado, 120 estados de conteúdo extenso/capa indisponível e 36 LPs com oferta inativa. Mais 28 estados em 390/1440px: disclosure hover/focus/active/expandido, fonte bloqueada, JavaScript atrasado e retomado com movimento padrão.

O botão “Tentar novamente” usava `reset` e não recuperava a consulta do servidor após restabelecer o catálogo. Agora usa `retry`, disponível no Next instalado. A falha foi provocada somente em banco exclusivo e a tabela foi restaurada. O caso de capa indisponível usa mídia privada; a obrigatoriedade de capa no livro publicado foi preservada. Ofertas inativas não exibem compra; LPs sem amostra não exibem esse convite.

Foram preservadas 180 verificações da execução integral aprovada e recapturados 28 estados após limpar seleção de texto causada pelo gesto do teste. Identidade do build, dependências/estilos e hashes das 208 imagens conferidos; protocolos e relatórios anteriores preservados. [Inspeção amostral](../../artifacts/qa-release-layout/d125-visual-review.json). As tentativas anteriores identificaram a recuperação defeituosa, uma fixture inválida e uma leitura prematura do título durante a navegação; não foram registradas como aprovação. Bancos/mídias temporários removidos, banco de desenvolvimento preservado.

Build QA e `npm run check` passaram (298 unitários, 62 operacionais, tipos, lint e documentação); o ajuste posterior do protocolo recebe conferência própria de tipos/lint. Sem migration ou dependência nova. A imagem D122 antecede as correções D123/D125 e será renovada no fechamento. H05 permanece parcial para consolidar a operação administrativa de fase 2. P07 ainda depende do prazo/marco de guarda financeira e da conciliação externa aplicável; nenhuma conta, CI remoto, VPS ou produção foi homologada. Backup continua opcional com `--sem-backup`.

## D126 — Fechamento do QA local administrativo — 28/10/2026

[Dez suítes/354 capturas](../../artifacts/qa-release-layout/d126-results.json), 346 análises axe sem violações e oito capturas sem JavaScript passaram. Cobertura: consentimento/medição, supressões, lista/detalhe de contatos e consulta da integração, inbox/retry, prévia e registros financeiros, importações, identidades, decisões, cobertura e detalhamentos. Dois temas/seis larguras e recortes 320px/teclado/texto ampliado conforme os protocolos. Sem overflow da página, erros de runtime registrados ou chamadas externas; os 18 ensaios (dez aprovações e oito tentativas anteriores) removeram seus bancos/mídias exclusivos.

Duas falhas de aplicação corrigidas: feedback de supressão agora recupera foco perdido após envio e preserva foco escolhido durante a espera; setas de paginação nativa receberam nomes acessíveis em módulo e bundle do patch Payload. A repetição de supressões passou em 78 capturas, incluindo loading em 390/1440px, erro/sucesso por teclado e página 2 da lista. Seletores antigos de valores repetidos e colunas de atribuição foram corrigidos nos testes, sem alterar cálculos. Manifestos das tentativas malsucedidas foram preservados; não contam como aceite.

Build QA e `npm run check` passaram: 298 unitários, 62 operacionais, tipos, lint e documentação. Não houve migration ou atualização de versões. Lockfile mudou somente no hash do patch; retirar a adição da paginação reconstrói exatamente os 14 hunks anteriores. Oito suítes do build anterior permanecem válidas por escopo; supressões e prévia financeira foram renovadas no build corrigido. [Inspeção amostral](../../artifacts/qa-release-layout/d126-visual-review.json).

[Auditoria combinada D121–D126](../../artifacts/qa-release-layout/d126-h05-acceptance.json): H05/B19/B20 com aceite **local de lançamento**. Não é certificação WCAG, inspeção manual de cada PNG, métrica de campo, capacidade da VPS ou homologação externa. Próxima ação: concluir P07 após definir prazo/marco de guarda financeira e conciliar cópias externas aplicáveis; então renovar imagem/validação final e preparar contas/host/CI do proprietário. A imagem D122 antecede D123/D125/D126. Backup permanece opcional, inclusive com `--sem-backup`; melhorias evolutivas ficam para atualizações.
