# 25 — Plano de fechamento para produção

[Estado atual](23-estado-atual.md) · [Pendências](../pendencias.md) · [Progresso](14-progresso.md)

Direção do proprietário em 27/10/2026: finalizar o desenvolvimento necessário ao lançamento e deixar melhorias evolutivas para atualizações. Este plano ordena o encerramento; não transforma um teste local em homologação externa nem remove requisitos já aprovados.

## Escopo do fechamento

Concluir as jornadas existentes das fases 1 e 2: catálogo, páginas e painel; amostra e consentimento; preferências/descadastro; filas e limites; integrações Hotmart, Kiwify, Cakto e Brevo; conciliação/financeiro; privacidade e operação. Preservar os três provedores, cadastro manual e ausência de IA no produto. O primeiro lançamento comercial continua com um livro prioritário.

Durante o fechamento, alterar código para corrigir falha, cumprir requisito de lançamento ou viabilizar operação. Novas funcionalidades e mudanças de arquitetura exigem outra atualização; não ampliar o backlog a cada revisão.

## Lacunas e ordem de resolução

| Ordem | Lacuna concreta | Como encerrar | Responsável / estado |
|---|---|---|---|
| F01 | Dependências com advisories atuais | Versões fixadas/patches e regressões; auditar produção/ferramentas | D120 corrigiu os avisos anteriores. D127 encontrou um aviso low novo em deepmerge sem versão corrigida: mitigação local versionada, 16 regressões e oito provas na imagem, check/HTTP aprovados. Auditoria bruta preservada com um aviso; não ocultado |
| F02 | P07: política comercial e dependências externas | Definir prazo e revisão da trilha comercial; preservar disputa/conciliação; cumprir procedimento executável de exportação/correção/exclusão; registrar decisões na trilha local; manter manifesto externo atual se a capacidade de recuperação for adotada. Não declarar concluído enquanto a dependência persistir | Desenvolvimento + responsável. D119 resolve lotes locais nunca emitidos; cópias no provedor e prazo financeiro continuam pendentes |
| F03 | H05: comprovação das telas e desempenho final | Matriz combinada, correções, capturas e laboratório/carga | Concluído localmente D126: [aceite H05/B19/B20](../artifacts/qa-release-layout/d126-h05-acceptance.json), combinando D121–D126. Dez suítes renovadas/354 capturas administrativas e de medição; nenhuma inferência de capacidade da VPS |
| F04 | H03/H06: release e operação técnica finais | Imagem/banco vazio/upgrade, mídia, permissões, worker e flags; limites/logs/segredos/admin/alertas | D127 aprovou a imagem atual em vazio/upgrade real 32→35, patch de segurança empacotado e 16 HTTP. P07 e proteção/alertas/CI do ambiente real continuam pendentes; renovar somente gates afetados por mudanças posteriores. GitHub/host com o proprietário |
| F05 | H01/H02/O01–O04: dados e ambiente reais | Conferir contas individualmente, remetente/DNS/quota, produto/arquivos/preço/checkout, contato/avisos, inventário da VPS, configuração privada e CI/deploy | Proprietário/operador. Nenhuma evidência local substitui essas conferências |

F01 é uma correção necessária antes de publicar a revisão atual. F02–F04 avançam localmente sem aguardar todas as contas. As verificações de F05 podem ocorrer em paralelo; cada fluxo externo só é ativado depois da sua homologação. Um conector desligado mantém o sistema protegido, mas não comprova o requisito de homologação desse provedor.

## Decisões operacionais de lançamento

- **Backup:** opcional por decisão já tomada. Primeiro deploy: `./atualizar.sh --inicial --sem-backup`; atualização: `./atualizar.sh --sem-backup`. Sem essa flag, segue o fluxo de backup padrão. Dispensar backup não cria ponto de restauração nem conclui H04/R24 como capacidade de recuperação.
- **Domínio:** padrão técnico proposto para reduzir configuração inicial: `bibliotheon.com.br` com o painel existente em `/admin`, mantendo uma origem administrativa exata. Não criar subdomínios adicionais no fechamento. O operador ainda precisa conferir DNS/TLS/proxy e proteção administrativa na VPS; nenhum host foi configurado remotamente.
- **Quota:** manter o padrão conservador já implementado de 50 destinatários/dia, compartilhado entre os transportes, e conferir a quota efetiva da conta antes de ativar. Não aumentar limite para compensar falha ou envio de resultado desconhecido.
- **Retenção já definida:** manter os defaults documentados em [segurança e privacidade](12-seguranca-privacidade.md): analytics identificável por 90 dias; pedidos não confirmados por sete dias; regras de 24 meses para registros encerrados; revisão de marketing ativo após 12 meses; supressão/fatos com seus prazos próprios. Não usar abertura/clique/amostra para renovar opt-in.
- **Ledger e evidências:** o prazo de guarda não está definido nos documentos aprovados. Solicitação desse dado foi enviada ao proprietário. Preservar somente a trilha mínima, com acesso restrito, e manter casos em disputa/conciliação até resolução; definir duração, marco inicial e procedimento de descarte antes de considerar essa lacuna encerrada. Automatizar o descarte sem essa definição não é uma correção segura.
- **Pedidos pendentes:** `pending` não é conclusão nem autorização de envio. Lote comprovadamente local pode ser dissolvido atomicamente conforme D119; registro externo/incerto exige conciliação documentada. Nenhuma confirmação genérica pode substituir a prova da resolução.
- **Flags:** permanecer desligadas até configuração e homologação do respectivo fluxo. Não habilitar tudo no primeiro deploy por conveniência.

## F02 — Como encerrar P07 sem deixar lacunas implícitas

[Auditoria D128](../artifacts/documentation/p07-closure-audit-d128.json): o inventário inclui 14 coleções comerciais; duas têm expurgo parcial de envelope/auditoria e 12 não têm retenção geral. Exportar o contato por e-mail não prova seleção/cobertura financeira. Nenhum vínculo de comprador será presumido.

| Etapa | Evidência necessária para encerrar |
|---|---|
| P07-A — política | Decisão do responsável: duração, marco inicial, finalidade, minimização e exceções de disputa/conciliação. Não há prazo financeiro aprovado atualmente |
| P07-B — implementação | Preview sem mutação; apply revalidado, transacional e paginado; preservar dados em revisão/conciliação, trilha mínima e idempotência. Regressões de duplicata, falha/rollback e relatórios, com fixtures sintéticas |
| P07-C — finalidades/pedidos | Revisão dos dados de relacionamento ativo, campanhas/manifestos e cobertura de exportação/correção/exclusão. Selecionar somente conjunto e identidade comprovados; registrar limites, sem adivinhar associação entre contato e transação |
| P07-D — cópias externas | Resolução individual e auditada no provedor. Pending e resultado incerto não são conclusão nem autorização de reenvio |
| P07-E — rotina real | Ciclos válidos, revisão das exceções, saúde e alertas observados no ambiente. Heartbeat sozinho não comprova retenção. Guarda externa/restore apenas quando recuperação for adotada |

P07-B depende da definição de P07-A e da revisão por finalidade. Não implementar descarte irreversível com prazo presumido. P07-D/E dependem de contas/ambiente do proprietário. F01/F03 e a imagem/API atuais já possuem evidência; não reabrir suítes aprovadas sem mudança ou falha nova.

## Melhorias após o lançamento

Podem ficar para atualizações: novos títulos e canais além do primeiro lançamento, automações novas não previstas na base inicial, refinamentos estéticos sem falha funcional, novos relatórios além dos contratos existentes e otimizações adicionais depois de cumprir o orçamento inicial. Registrar problema/hipótese/evidência antes de implementar.

Não adiar como melhoria: vazamento/perda de dados, acesso indevido, erro de valores/consentimento, duplicação de transação ou envio, falhas bloqueantes de teclado/reflow/contraste, vulnerabilidade conhecida sem tratamento, política de dados indefinida ou homologação exigida para um fluxo ativado.

## Critério de encerramento

Encerrar o desenvolvimento local quando F01–F04 tiverem evidência da revisão final e as decisões de produto necessárias estiverem registradas. Entregar ao proprietário uma lista objetiva de F05, comandos, configuração privada e limitações. Considerar a operação completa pronta somente após a evidência externa aplicável; declarar separadamente código validado, homologação e deploy executado.

Até lá, [pendencias.md](../pendencias.md) continua sendo a lista de aceite. A cada conclusão, atualizar o estado atual, progresso e evidências; não reabrir trabalho encerrado sem falha nova ou mudança que o invalide.

A opção sem backup também dispensa o destino externo de backup, a guarda externa do manifesto para replay e a homologação de restore como condições do deploy. Esses controles pertencem à capacidade opcional H04/R24. As decisões de privacidade continuam na trilha local; exportação/correção/exclusão, consentimento, retenção aplicável e conciliação de cópias no provedor permanecem necessários independentemente de backup. A ausência de cópia externa aceita o risco de perder também essa trilha em uma perda total do banco.
