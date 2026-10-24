# 13 — Backlog de implementação

[Índice](../README.md) · [Progresso](14-progresso.md) · [Testes](15-qualidade.md)

Prioridade P0 = base do lançamento; P1 = operação/campanha inicial; P2 = expansão condicionada. B01/B02 possuem implementação e testes locais; B03/B04/B18 possuem primeira implementação e testes, com refinamentos em curso. B17/B19/B20 em execução. B05 possui ensaios locais e B06 está em implementação; B07 possui medição consentida e inbox/histórico comerciais locais; observabilidade e retry visuais acrescentados em D62; Hotmart/Kiwify/Cakto locais acrescentados em D63–D65; B11 possui prévia e confirmação durável limitada D66–D67; atribuição, homologação, conclusão de B11 e B12–B16 seguem pendentes. O [plano para produção](../pendencias.md) separa desenvolvimento, homologação e ações do proprietário. Estado e limites em [desenvolvimento](19-desenvolvimento.md). Executor técnico: desenvolvedor/agente; dono de contas, produto e decisões comerciais: proprietário.

## Fase 0 — Preparar

Documentação e aplicação local presentes. Título, domínio e responsável já informados em [lançamento](22-lancamento.md); arquivos/público/preço/contas/elegibilidade ainda precisam de conferência. Preencher [briefing](templates/01-briefing-livro.md) antes da campanha. Estado por requisito, evidências e riscos no [mapa atual](23-estado-atual.md); retomar pela próxima ação, sem reiniciar B01.

## Fase 1 — Publicar

| ID | Prioridade / entrega | Dependências | Aceite / requisitos | Estado atual (24/10/2026) |
|---|---|---|---|---|
| B01 | P0: bootstrap Next/Payload/Postgres; versões fixadas, CI, auth e permissões | Documentação | Build local, migrations e bloqueio de anônimo; R01 | Base/testes locais; CI reorganizado D69 com runners sequenciais e checks sem banco, não executado no GitHub |
| B02 | P0: coleções editoriais, ofertas e uploads | B01, B17 | Validação e drafts, dados sintéticos das três plataformas; R02, R05, R22 | Parcial: domínio e preservação/limpeza de mídia testados localmente; homologação do release pendente |
| B03 | P0: site, LP, catálogo e preview | B02, B17, B18 | Rotas, busca, estados vazios, teclado/mobile e orçamento de desempenho; R03, R04, R20, R21 | Parcial: páginas/QA locais; desempenho e oferta real pendentes |
| B04 | P0: artigos, SEO, redirecionamento e campanha afiliada | B03 | URLs seguras, parâmetros preservados, cache invalidado, sitemap; R06, R07 | Local: SEO, slugs e afiliado testados com fixtures |
| B05 | P0: imagem, Compose, inventário, proxy e backup | B01; VPS/domínio/destino backup para deploy | Isolamento, recuperação comprovada, baseline preservado; R23, R24 | Parcial: guia/atualizador e ensaios locais; release atual/VPS/externo pendentes |

Saída: vitrine e painel homologados, incluindo a rodada de fase 1 de B20; produto real só publicado quando pronto e oferta conferida. Não declarar medição completa.

## Fase 2 — Captar e medir

| ID | Prioridade / entrega | Dependências | Aceite / requisitos | Estado atual (24/10/2026) |
|---|---|---|---|---|
| B06 | P0: amostra, consentimento, Brevo e supressão | B02, conta/remetente para homologar | Confirmação, entrega independente de marketing, fila e quota; R08, R09, R10 | Parcial: amostras/calendário/quota, lotes/claim, bloqueios outbound e preflight/cadastro consentido/listas exclusivas e cancelamento por assunto, links individuais e rascunhos e transporte locais; worker opcional com flag false; observação GET local (D57), worker com flag independente false; callback autenticado/resultados individuais locais (D58); homologação externa e recuperação do release pendentes |
| B07 | P0: eventos, campanhas, atribuição e inbox comum | B04 | Privacidade, eventos duráveis, dashboard operacional, replay; R11, R25 | Parcial: consentimento/sessões/páginas/saídas, UTMs controladas, gerador e resumo locais D59; contrato/projeção D60 e inbox/histórico/retry/worker locais D61; acompanhamento/retry visuais D62; atribuição de compra e homologação pendentes |
| B08 | P0: adaptador Hotmart | B07; contrato e conta | Autenticação e fixtures, replay/reversão, homologação individual; R12 | Parcial: adaptador/endpoint Hotmart v2 locais D63, inbox e HTTP testados; desligado por padrão, conta/atribuição/conciliação/homologação pendentes |
| B09 | P0: adaptador Kiwify | B07; descoberta de autenticação atual e conta | Contrato verificado antes de ativar; bateria completa; R13 | Parcial: adaptador/endpoint local D64, HMAC-SHA1/corpo bruto e centavos confirmados em fontes oficiais; conta, conciliação temporal, atribuição e homologação pendentes |
| B10 | P0: adaptador Cakto | B07; autenticação técnica e conta | Semântica verificada, replay manual e financeiro; R14 | Parcial: adaptador/endpoint Cakto V1/V2 locais D65, assinatura/janela e lote atômico testados; conta, MED/tempos especiais, atribuição, conciliação e homologação pendentes |
| B11 | P0: CSV e dashboard financeiro | B08, B09, B10 | Preview/commit auditado, conflitos, desconhecidos e coortes; R15, R16 | Parcial: prévia D66 e lotes/linhas/confirmação auditada para inbox D67 locais; resolução de conflitos/identidades históricas, liquidação, custos, financeiro e UI pendentes |
| B12 | P0: retenção, exclusão e homologação integral | B05, B06, B11, B20 | Privacidade, recuperação e casos de falha completos; R26 | Pendente, sem rotinas de retenção/exclusão e aceite integral |

B08/B09/B10 já possuem adaptadores e endpoints nativos locais, com fixtures próprias D63–D65. Homologar cada conta separadamente e concluir B11; não reiniciar os adaptadores como se estivessem ausentes. A falta de conta pode impedir homologação externa, mas não elimina o provedor do backlog. Conciliação manual informa limites enquanto o conector estiver pendente. A fase só está completa quando os três forem homologados.

## Fase 3 — Campanha inicial

| ID | Prioridade / entrega | Dependências | Aceite / requisitos | Estado atual (24/10/2026) |
|---|---|---|---|---|
| B13 | P1: tarefas e kit por campanha | B04, B11 | Conteúdo autorizado, hipótese e prazo registráveis; R17 | Pendente; campanha cadastrável, tarefas/kit inexistentes |
| B14 | P1: ativação da primeira campanha | B06, B12, B13; livro pronto | LP, amostra, três conteúdos, um canal e registro de distribuição; R18 | Pendente; título escolhido, sem lançamento real |

## Fase 4 — Otimizar

| ID | Prioridade / entrega | Dependências | Aceite / requisitos | Estado atual (24/10/2026) |
|---|---|---|---|---|
| B15 | P1: revisão semanal e melhoria | B14 | Relatório conciliado, custos, hipótese e próxima ação; R19 | Pendente; sem revisão operacional conciliada |
| B16 | P2: expansão por resultado | B15 e justificativa | Novo livro/canal ou ferramenta com problema definido, orçamento e métrica; sem requisito MVP adicional | Condicionado a resultado futuro |

## Como executar um item

Registrar objetivo, requisitos, arquivos afetados e critérios antes de editar. Implementar domínio e permissões antes da apresentação; testes de invariantes e smoke. Atualizar progresso com commit/artefato quando existir. Não executar deploy, enviar campanhas ou gastar orçamento apenas porque um item documental menciona a ação; respeitar autorização da tarefa futura.

Não há prazo garantido de oito semanas. A ordem é compromisso técnico; duração depende de disponibilidade e dependências externas. Desenvolvimento e divulgação competem pelo mesmo tempo e precisam de capacidade reservada.

## Fundação visual e integração nas fases

IDs B17–B20 preservam B01–B16; ordem numérica não é ordem de execução. Fundação e variantes já foram implementadas localmente; polimento e homologação integral continuam parciais, conforme estado abaixo. A documentação de design está especificada no [briefing](../DESIGN-BRIEF.md).

| ID | Prioridade / entrega | Dependências | Aceite / requisitos | Estado atual (24/10/2026) |
|---|---|---|---|---|
| B17 | P0, fase 1: tokens/fontes/tema, componentes base e adaptação Payload | B01 | Contrastes, fallback, preferência local sem flash e adapter suportado; R27, R28, R29 | Base local aplicada; matriz integral de estados aberta |
| B18 | P0, fase 1: variantes editoriais, acentos e apresentação de mídia | B02 | Enums validados, três narrativas e imagens íntegras; R30 | Local: variantes/acento testados; conteúdo real não publicado |
| B19 | P0, fases 1–2: polimento responsivo, motion e painel | B03 para rodada 1; B06/B11 para rodada 2 | Zoom, seis larguras, reduced-motion e fluxos admin completos; R31, R32, R33 | Parcial: refinamentos locais; fase 2/zoom/performance pendentes |
| B20 | P0, fases 1–2: QA visual renderizado e correções | B19 e telas da fase avaliada | Paridade de tema, teclado, screenshots, estados adversos; R34 | Parcial: rodadas renderizadas; matriz/release final pendentes |

Sequência: B01 → B17 → B02 → B18 → B03/B04 → B19/B20 (rodada fase 1). Depois B06–B11 → B19/B20 (rodada fase 2) → B12. B05 mantém sua dependência de infraestrutura e pode ser preparado independentemente. B20 concluído exige as duas rodadas; a primeira recebe evidência parcial, não “concluído”.


Os registros D63–D67 abaixo descrevem a evolução em cada etapa; a próxima ação vigente está em [pendências](../pendencias.md).

D63: B08 possui execução local, sem concluir homologação. Próxima implementação independente é B09, depois B10. B11 deve incluir resolução auditada de divergências e de catálogo com histórico: impedir novas identidades externas duplicadas e permitir correção sem editar fatos/identidades já referenciados. Hoje duplicidade/ambiguidade fica em revisão, e o guard de ofertas com histórico proíbe troca de identidade; não prometer que retry sozinho resolve esses casos. Testar esses fluxos antes do release.

D64: B09 possui execução local de assinatura HMAC, centavos, datas e recepção durável. Continua parcial: sem conta homologada; chargeback/recusa sem instante confirmado e formatos especiais exigem conciliação auditada B11. Próximo adaptador é B10 Cakto, com descoberta oficial independente. B08/B09 não perdem suas pendências externas. Não ativar conectores/processamento real com base em fixtures.

D65: B10 possui adaptador/endpoint Cakto V1/V2 locais, assinatura/janela e lote atômico testados. Não conclui conta/relatório/reenvio/MED. Próxima implementação é B11, com fixtures e esquema explícito de importação, preview/commit auditado, conciliação e financeiro; não adivinhar exportação nativa. Resolver colisões e identidades duplicadas/ambíguas com histórico sem editar fatos. Desenvolvimento local pode prosseguir enquanto proprietário homologa contas, sem tratar homologação pendente como concluída.

D66: B11 possui parser e prévia owner/somente de leitura, com desconhecidos/conflitos explícitos e nenhuma escrita comercial. Continua parcial: lotes/linhas duráveis, fonte/autor/justificativa, confirmação idempotente/auditada, resolução de divergências/catalogação histórica, liquidação/custos/financeiro e UI pendentes. Prévia é provisória, sempre committable=false; confirmar futuramente exige revalidação sob locks, não aceitar hash/decisão do cliente como autorização. [Contrato](24-conciliacao.md).

D67: B11 possui lotes/linhas/auditoria e confirmação idempotente/revalidada para inbox. Não conclui resolução de conflito/catalogação histórica, reversões/recebimento com prova insuficiente, liquidação/custos, relatório ou UI customizada. Um provedor/conta por lote durável; campos da prévia não autorizam escrita. Próximo: decisões auditadas preservando fatos/identidades originais, depois liquidação/custos/financeiro. [Contrato](24-conciliacao.md).
