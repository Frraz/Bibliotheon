# 02 — Requisitos e jornadas

[Índice](../README.md) · [Backlog](13-backlog.md) · [Testes](15-qualidade.md)

Os aceites abaixo preservam o escopo completo aprovado. O [mapa vigente de implementação e evidências](23-estado-atual.md) distingue o que foi implementado/testado localmente do que ainda exige desenvolvimento ou homologação; a entrega parcial de uma interface não encerra seu requisito.

## Jornadas

1. Visitante chega a artigo ou LP, lê conteúdo, examina amostra e escolhe uma oferta. O checkout externo recebe a navegação; apenas evento validado ou conciliação comprova compra.
2. Interessado solicita amostra por e-mail; recebe confirmação para a solicitação. Marketing é opcional e separado. Após confirmar, recebe material e, se consentiu, sequência temática.
3. Operador cadastra livro, amostra e ofertas; pré-visualiza; publica; prepara campanha e acompanha relatório.
4. Afiliado recebe kit e usa link associado à oferta correta. Bibliotheon não calcula nem paga comissão de afiliados.
5. Operador corrige falha de integração por reprocessamento ou conciliação auditada, sem duplicar transações.

## Requisitos funcionais

| ID | Requisito e aceite observável | Fase | Dependência |
|---|---|---|---|
| R01 | Administração autenticada: anônimo não lê contatos, rascunhos ou transações por nenhuma API | 1 | B01 |
| R02 | Livro possui título, slug, tema, público, conteúdo, capa e estado; rascunhos não aparecem no site | 1 | R01 |
| R03 | Catálogo busca título/resumo e filtra tema; paginação e estado vazio funcionam | 1 | R02 |
| R04 | LP apresenta oferta real, amostra, requisitos e FAQ; preview autenticado não é indexável | 1 | R02 |
| R05 | Hotmart, Kiwify e Cakto cadastráveis; oferta ativa exige URL HTTPS aprovada, preço e identificação externa | 1 | R02 |
| R06 | CTA principal único por livro; destinos afiliados não trocam de plataforma; inativa não redireciona | 1 | R05 |
| R07 | Artigos/temas publicados têm canonical, título e links relevantes; sitemap exclui rascunhos e páginas vazias | 1 | R02 |
| R08 | Formulário solicita amostra sem exigir marketing; confirmação não revela existência do contato | 2 | R01, R04 |
| R09 | Consentimento e revogação registrados; descadastro impede campanhas pendentes antes do próximo envio | 2 | R08 |
| R10 | Sequência temática respeita quota e estado de contato; falha visível e retentativa limitada | 2 | R09 |
| R11 | Campanha, UTMs e cliques registrados com privacidade; clique não é contabilizado como compra | 2 | R06 |
| R12 | Conector Hotmart autentica, deduplica e normaliza eventos; evidência individual de homologação | 2 | R11 |
| R13 | Conector Kiwify autentica, deduplica e normaliza eventos; evidência individual de homologação | 2 | R11 |
| R14 | Conector Cakto autentica, deduplica e normaliza eventos; evidência individual de homologação | 2 | R11 |
| R15 | Conciliação CSV tem prévia, validação, deduplicação, origem e auditoria; não envia e-mail automaticamente | 2 | R12, R13, R14 |
| R16 | Relatório distingue aprovadas, reembolsos, bruto, recebido e margem; desconhecido não vira zero | 2 | R11, R15 |
| R17 | Campanha possui tarefas, prazo, material e hipótese; kit disponibiliza apenas arquivos públicos autorizados | 3 | R04, R16 |
| R18 | Primeiro lançamento inclui amostra, três conteúdos e distribuição registrada; sem meta fictícia de receita | 3 | R10, R17 |
| R19 | Revisão semanal registra decisão, evidência e próxima ação; custos documentados | 4 | R16, R18 |

## Requisitos não funcionais

| ID | Critério de aceite | Fase | Dependência |
|---|---|---|---|
| R20 | Layout 360–1920 px sem rolagem horizontal da página, teclado completo e contraste WCAG AA | 1 | R04 |
| R21 | Metas de campo p75: LCP ≤2,5s, INP ≤200ms e CLS ≤0,1; antes de volume real registrar somente teste de laboratório | 1 | R04 |
| R22 | Uploads limitados e sanitizados; tokens e PII ausentes de logs; proteção de formulário e login | 1 | R01 |
| R23 | Deploy isolado preserva outros serviços; banco sem porta pública; imagens fixadas | 1 | Inventário VPS |
| R24 | Capacidade opcional: backup externo criptografado restaurado em ambiente isolado, com RPO/RTO medidos; deploy pode dispensar backup explicitamente com `--sem-backup` | 1 | R23 |
| R25 | Eventos duráveis antes de ACK; replay não duplica venda; saúde e falhas observáveis | 2 | R12, R13, R14 |
| R26 | Retenção, exclusão e consentimento executáveis e documentados; cookies opcionais respeitam escolha | 2 | R09, R11 |

As fases 1 e 2 são necessárias para considerar a operação comercial inicial completa. Uma vitrine pode ser homologada antes, mas não equivale à homologação da medição. A entrega inicial de 20/10/2026 era documental; a implementação foi autorizada posteriormente. O [mapa R01–R34 vigente](23-estado-atual.md) distingue código, evidência local e aceite ainda pendente, sem reduzir os requisitos desta especificação.

## Requisitos de design

| ID | Critério de aceite | Fase | Dependência |
|---|---|---|---|
| R27 | Identidade editorial e tokens aplicados conforme briefing, com fontes locais e fallback; não depender de imagem para ler título | 1 | B17 |
| R28 | Site e painel completos em claro/escuro; preferência sistema/claro/escuro persiste e funciona sem storage | 1 e 2 | R27 |
| R29 | Componentes têm estados legíveis e pares de contraste autorizados; foco e controles operáveis por teclado/toque | 1 e 2 | R27 |
| R30 | LP aceita guide/reading/workbook e acento em enum; adaptação preserva oferta/afiliado e não permite CSS livre | 1 | R04, R05, R27 |
| R31 | As seis larguras, títulos longos, 320px/reflow e zoom não cortam conteúdo nem sobrepõem ações | 1 e 2 | R20, R29 |
| R32 | Motion expressivo não bloqueia conteúdo; reduced-motion elimina coreografia e painel usa feedback funcional | 1 e 2 | R21, R29 |
| R33 | Painel preserva ergonomia e extensões suportadas Payload com temas completos e estados financeiros honestos | 1 e 2 | R01, R16, R28 |
| R34 | Revisão visual tem screenshots por tela/tema/viewport, cenários adversos e correções; documentação não conta como renderização | 1 e 2 | R27, R28, R29, R30, R31, R32, R33 |

R33 aplica identidade às telas de fase 1 primeiro e completa os relatórios na fase 2, quando R16 existir. R28–R34 são verificados em cada entrega visual, não somente após lançar campanha.

## Aceite visual local D126 — 28/10/2026

R31–R34/B19/B20/H05 têm [auditoria local por família](../artifacts/qa-release-layout/d126-h05-acceptance.json), combinando D121–D126. Nenhum requisito de negócio foi removido. Novas telas/estados ou falhas reabrem a cobertura afetada. Imagem/API atuais têm evidência D127; P07 e homologações do ambiente real continuam pendentes. Código posterior exige renovar apenas os gates afetados; campo será acompanhado após tráfego suficiente.


## Redesign público editorial — 28/10/2026

R03/R04/R20/R21/R27–R30: evolução editorial de todas as famílias públicas, temas e responsividade. Menu de aparência com Sistema/Claro/Escuro; conteúdo e contratos existentes preservados. O aceite desta alteração exige capturas, teclado, axe, reflow e regressões locais.

Evidências e limites: [redesign público](../artifacts/qa-public-redesign/README.md).

## Importação editorial autorizada — 28/10/2026

Complemento ao cadastro editorial: receber pacote versionado do projeto ebooks, prévia sem escrita, confirmação owner, ofertas confirmadas dos três provedores, preservação de edições do painel e recibo idempotente. IA permanece fora do produto e entrega paga externa. [Contrato e critérios](integracoes/editorial.md).
