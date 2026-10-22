# 15 — Qualidade e homologação

[Índice](../README.md) · [Requisitos](02-requisitos.md)

## Camadas

Documentação: verificador Python sem dependências. Código existente: TypeScript strict, lint sem autofix, Vitest para regras, PostgreSQL de teste para constraints/transações e Playwright para jornadas. axe como apoio à acessibilidade, complementado por teclado e leitura visual. Fixtures sintéticas e relógio controlado para cronologia, expiração e coortes. Estado/evidência de cada requisito no [mapa atual](23-estado-atual.md); a matriz abaixo continua sendo o aceite do produto completo, não uma lista de testes todos aprovados.

CI alvo: instalar com lockfile → lint/typecheck → testes unitários/integração → build → testes de navegador → imagem. O workflow existente prepara geração/diff de tipos/import map, documentação, estáticos/unitários, migrations, catálogo/marketing/sequências, build e testes HTTP de acesso/site/recuperação. Ainda não executa QA browser nem build/homologação de imagem; nenhuma execução no GitHub comprovada. Nenhuma credencial de produção em PR. Antes do release, testar migrations atuais de banco vazio e versão anterior. Revisão só documental roda o verificador, sem exigir subir aplicação ou Docker para isso.

## Matriz de cenários

| Teste | Requisitos | Cenário e resultado esperado |
|---|---|---|
| T01 | R01 | Anônimo tenta REST/GraphQL/preview/admin: sem acesso privado; owner autorizado |
| T02 | R02, R05 | Rascunho, livro em produção e oferta incompleta não habilitam compra; única primária no banco |
| T03 | R03, R07 | Busca com acentos, filtro vazio, paginação, canonical e sitemap de publicados |
| T04 | R04, R20 | LP 360/768/1280/1920px, teclado, foco, contraste e FAQ; preço legível e amostra real |
| T05 | R06 | Oferta inativa retorna indisponível; URL arbitrária rejeitada; afiliado mantém destino/parâmetros |
| T06 | R08, R09 | Pedido sem marketing entrega amostra após confirmação; duplicata não revela contato; token expirado falha |
| T07 | R09, R10 | Descadastro com envio na fila bloqueia marketing; amostra solicitada permanece independente; bounce/complaint cancelam pendentes; referência de supressão idempotente/conflitante, quota, timeout e retentativa tratados |
| T08 | R11, R26 | Recusa de analytics impede ID/cookie; compra funciona; revogação interrompe coleta |
| T09 | R12 | Hotmart válido/inválido, replay, reembolso antecipado e produto desconhecido |
| T10 | R13 | Kiwify válido/adulterado, dinheiro/unidade, replay e ordem invertida |
| T11 | R14 | Cakto válido/inválido; Pix não é aprovação; reversão e reenvio |
| T12 | R15 | CSV repetido não duplica; conflito exige decisão; fórmula exportada neutralizada |
| T13 | R16 | Receita com custos null fica incompleta; liquidação não é aprovação; coortes e fuso consistentes |
| T14 | R17, R18 | Campanha com kit e conteúdo público autorizado; sem conteúdo pago exposto |
| T15 | R19 | Revisão contém decisão baseada em evidência e próxima ação, mesmo com zero vendas |
| T16 | R21 | Build de produção medido em ambiente identificado; laboratório não é resultado de campo |
| T17 | R22 | Upload inválido/oversized/path traversal rejeitado; substituição recusada preserva arquivo anterior, incluindo mídia não vinculada a amostra; logs sem email/token/corpo |
| T18 | R23 | Apenas proxy acessível publicamente; DB privado; baseline de sistemas existentes preservado |
| T19 | R24 | Restaurar banco/mídia fora da produção; medir RPO/RTO; impedir envio de e-mails no restore |
| T20 | R25 | Queda após persistir inbox e antes de job recupera pendência; ACK sem commit impossível |
| T21 | R26 | Retenção/exclusão removem dados previstos e reaplicam supressão após restore |

## Critérios de release

Sem falha crítica de autenticação, exposição de dados, duplicação financeira ou perda de eventos conhecida. Fluxo ponta a ponta do conteúdo ao checkout testado. Cada provedor tem evidência externa própria; teste sintético não a substitui. Backup restaurado, monitoramento e rollback documentados.

Metas de desempenho dos requisitos são objetivos. Medir com dataset inicial de 30 livros/3 temas, 30 artigos e volume sintético de eventos suficiente para identificar queries lentas; não interpretar isso como capacidade de produção. Fazer teste de carga somente em ambiente isolado, começando com 5 usuários simultâneos e incrementando com medição, sem pressionar outros sistemas da VPS.

## Evidência

Registrar data, ambiente, versões, cenário, entrada sintética, resultado e artefato. Screenshots sem PII. Resultado pode ser passou/falhou/bloqueado; bloqueado nunca vira passou por ausência de acesso. Relatório documental fica separado em [validação](18-validacao.md).

## Cenários de design

| Teste | Requisitos | Cenário e resultado esperado |
|---|---|---|
| T22 | R27 | Fontes carregadas/falhas, títulos longos e identidade consistente; fallback sem quebra |
| T23 | R28 | Claro/escuro/system, reload, troca SO, storage negado; sem flash e sem alterar conteúdo |
| T24 | R29 | Matriz de componentes com foco/hover/disabled/erro/loading em dois temas; contraste funcional |
| T25 | R30 | Três variantes, acentos válidos/inválidos, capa ausente e campanha afiliada; destino intacto |
| T26 | R31 | 360/390/768/1024/1440/1920px, 320px/reflow, zoom e teclado mobile; sem sobreposição |
| T27 | R32 | Motion padrão e reduzido, JS lento/desligado; texto e CTA sempre disponíveis |
| T28 | R33 | CRUD, contatos, relatórios e integrações no Payload nos dois temas; null financeiro honesto |
| T29 | R34 | Home 0/1/3/20 livros, LP completa e demais telas com screenshots e crítica documentada |

Ver [matriz detalhada](design/07-qualidade.md). Alvo de acessibilidade WCAG 2.2 AA; axe apoia, não certifica. Cálculos sRGB são evidência documental, não resultado de teste renderizado. As rodadas B20 são registradas por fase e não bloqueiam a escrita de documentos enquanto não existir aplicação.
