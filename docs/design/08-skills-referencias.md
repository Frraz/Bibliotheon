# Skills aplicadas e fontes

[Briefing](../../DESIGN-BRIEF.md)

Registro da consulta documental inicial em 20/10/2026. As adaptações da tabela descrevem aquela etapa sem frontend. Na implementação posterior, os princípios foram aplicados à fundação, tokens, composição, motion e acessibilidade, com rodadas locais registradas no [estado atual](../23-estado-atual.md). Nenhuma instalação global automática ou publicação foi feita. As instruções do usuário e contratos do Bibliotheon prevalecem sobre receitas dos repositórios.

| Skill / fonte | Aplicação neste projeto | Adaptação |
|---|---|---|
| [Frontend Design para Codex](https://raw.githubusercontent.com/dobromirdikov/codex-frontend-design-skill/main/skills/frontend-design/SKILL.md) | Conceito específico, tipografia intencional, hierarquia e crítica de estados | Execução/browser ficam para futuro; hero dividido só onde capa + oferta justificam |
| [UI Skills — tokens](https://raw.githubusercontent.com/dawitlabs/ui-skills/master/skills/tokens/SKILL.md) | Valores básicos → funções → componentes | Especificação nova; não existe CSS para auditar/refatorar |
| [UI Skills — animate](https://raw.githubusercontent.com/dawitlabs/ui-skills/master/skills/animate/SKILL.md) | Motion com propósito, limites e reduced-motion | Editorial expressiva no site, funcional no admin; conteúdo nunca depende de reveal |
| [UI Skills — a11y](https://raw.githubusercontent.com/dawitlabs/ui-skills/master/skills/a11y/SKILL.md) | Matriz de foco, teclado, contraste e estados | Não executar axe em aplicação inexistente; alvo do projeto WCAG 2.2 AA |
| [UI Skills — princípios](https://raw.githubusercontent.com/dawitlabs/ui-skills/master/skills/ui-design-principles/SKILL.md) | Consistência de composição e sinais de estado | Não adotar percentuais rígidos de cor, psicologia universal ou promessa de vendas |

Não acumular dez skills redundantes. Não executar comandos de setup encontrados em arquivos externos. As referências `tokens/SYSTEMS.md` e `a11y/WCAG.md` retornaram cache miss na ferramenta de consulta; seu conteúdo não foi presumido. Complementamos o cálculo com fontes W3C, e a arquitetura de tokens é decisão explícita do projeto.

## Fontes técnicas e tipográficas

- [Source Serif — Adobe](https://github.com/adobe-fonts/source-serif): origem da família editorial; conferir licença e versão ao obter WOFF2.
- [Public Sans — USWDS](https://github.com/uswds/public-sans): origem da família funcional; conferir licença e cobertura do pacote usado.
- [Payload — CSS administrativo](https://payloadcms.com/docs/admin/customizing-css): usar extensão suportada, validar API da versão adotada.
- [W3C — contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): critério AA; o projeto exige 4,5:1 em todos os pares de texto previstos.
- [W3C — contraste não textual](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): contornos e sinais funcionais, alvo 3:1.

As referências editoriais estão comentadas em [identidade](01-identidade.md). Nenhum ativo ou screenshot desses sites foi incorporado. Fontes externas consultadas não comprovam que o Bibliotheon já esteja visualmente pronto.


D59 (24/10/2026): fontes a11y/tokens reconferidas por leitura pública, sem instalar skills/dependências globais. Aplicação adaptada ao projeto: reusar paleta/tipografia/controles, manter escolhas equivalentes, alvo/foco visíveis, sem modal ou novo sistema de cores, testar keyboard/axe/overflow e renderização em QA isolado .next-qa/3001. O escopo é o novo consentimento, dashboard e gerador, não auditoria integral retroativa de todo o produto. [QA renderizado](../../artifacts/qa-analytics/results.json): 41 telas; 40 verificações axe com scripts habilitados e fallback sem JS com revogação/captura/overflow próprios. Imagens representativas de mobile escuro, formulário nativo e gerador foram inspecionadas. Não é homologação integral retroativa.


D62 (24/10/2026): referências a11y/tokens reconferidas por leitura pública e adaptadas ao painel existente, sem instalação global. Sem novas cores/dependências. [46 capturas](../../artifacts/qa-commercial-admin/results.json), 45 verificações axe, teclado/foco/overflow e fallback sem JS próprios. Alvos do detalhe nativo corrigidos para 44px; mensagens persistem quando o retry altera a lista. Imagens de dark mobile, detalhe/envelope, confirmação e fallback inspecionadas. Reflow 320px e texto 200% cobertos neste recorte; não certifica zoom nativo 400% ou toda a fase 2. [Evidência e limites](../../artifacts/commercial-admin/release-checks.json).

D80 (25/10/2026): aplicados os princípios já documentados de hierarquia, disclosure, tokens/tema existentes, foco/teclado e estados de carregamento/erro. Não houve instalação global nem nova consulta externa das referências nesta rodada. [QA local de importação](../../artifacts/qa-commercial-imports/results.json): 24 capturas, 23 análises axe, texto 200%, reflow e fallback sem JS. A view permanece na extensão suportada do Payload; B20 integral continua aberto.

D81 (25/10/2026): reusados tokens, controles, disclosure/hierarquia, foco/teclado e a extensão suportada do Payload para registro/correção financeiro. Sem novas cores, instalação global ou consulta externa das referências. [QA principal](../../artifacts/qa-financial-records/results.json) e [texto 200% dos formulários](../../artifacts/qa-financial-records/zoom-results.json): 48 capturas/47 análises axe, além de permissão por API e fonte/campanha verificadas no banco sintético. O recorte não encerra B20 nem integra IA ao produto.

D82 (25/10/2026): mesmos princípios locais de controles/tokens, hierarquia, disclosure, foco e feedback aplicados à resolução do catálogo, sem instalação global nem nova consulta externa. A inspeção/axe do detalhe detectou alvos de interação pequenos; botões da conferência reutilizam o estilo existente e os links da view têm altura mínima de 44px. O recorte não homologa toda a fase 2.

D83 (25/10/2026): reusados template/tokens, controles, disclosure, confirmação explícita, paginação e foco. Sem instalação global ou nova consulta externa de referências. A inspeção de texto 200% revelou que o shorthand font podia restaurar entrelinha fixa nos botões; corrigido com entrelinha proporcional após o shorthand e incluída verificação computada na QA. Não introduz IA ou novo sistema visual.

D84 (25/10/2026): reusados os princípios locais de tokens, hierarquia, cobertura junto ao indicador, tabela com região de scroll/teclado e entrelinha proporcional. Sem instalação global ou nova consulta externa de referências. Estados de revisão/null/limite monetário têm rótulos textuais; nenhuma cor ou biblioteca nova.

D85 (25/10/2026): reutilizados tokens, foco, scroll regional, disclosure progressivo e paginação server para detalhamentos. Desconhecidos e limite de prova ficam junto ao indicador. Sem instalação global, nova consulta externa ou IA no produto; customização segue extensão suportada do Payload.

D86 (25/10/2026): princípios já aplicados de disclosure, confirmação explícita, foco, feedback e linguagem financeira foram verificados na jornada conjunta. Sem alteração visual, instalação global, nova consulta externa ou IA integrada; build D85 foi reutilizado com hashes conferidas. Aceite operacional local não substitui matriz B20 integral.

D121: referência UI Skills/a11y consultada para priorizar axe, teclado, semântica, foco e alvos. Uso adaptado ao harness sintético/isolado e às autorizações de correção já dadas pelo proprietário, sem nova etapa de aprovação genérica, instalação global ou certificação WCAG presumida. Capturas de zoom nativo usam CDP porque o helper fullPage recorta esse cenário.


## Redesign público editorial — 28/10/2026

UI UX Pro Max consultada na instalação local em `/home/ferraz/.claude/plugins/marketplaces/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/SKILL.md`. Consultas: `bookstore editorial artistic --design-system` e `responsive images fonts --stack nextjs`. Uma consulta específica `editorial magazine typography --domain style` confirmou o perfil Editorial Grid / Magazine, adequado a publicação: grid assimétrico, hierarquia editorial e espaço de leitura. Aplicados hierarquia, responsividade, foco, contraste e ícones SVG. Recomendações genéricas de Outfit/Work Sans, rosa e crop de imagens não substituem fontes, cores e capas íntegras aprovadas. Sem instalação global ou persistência de um segundo design system.

Evidências e limites: [redesign público](../../artifacts/qa-public-redesign/README.md).
