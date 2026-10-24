# Pendências para colocar o Bibliotheon em produção

[README](README.md) · [Estado atual](docs/23-estado-atual.md) · [Backlog](docs/13-backlog.md) · [Progresso](docs/14-progresso.md) · [Deploy](deploy.md)

Atualizado em 24/10/2026, America/Belem. Revisão documental D68, com código e evidências funcionais locais até D67; manutenção operacional D69 de raiz/CI registrada sem concluir novos gates do produto. **O sistema completo ainda não está pronto para produção.** Este documento organiza o que falta; não autoriza publicação ou ativação externa. GitHub e deploy na VPS ficam com o proprietário.

## O que já existe

Não é necessário começar o sistema novamente. Há implementação local de catálogo, três variantes de página de livro, artigos, painel manual Payload, amostras/consentimento, filas e calendário de e-mail, quota, clientes/callback Brevo, medição consentida, inbox/histórico/retry comerciais e adaptadores nativos dos três provedores. Hotmart D63, Kiwify D64 e Cakto D65 possuem endpoints locais e fixtures; nenhum foi homologado em conta real.

A conciliação possui prévia CSV D66 e lotes/linhas/auditoria com confirmação limitada D67. A prévia é provisória e não autoriza escrita. Confirmar um lote pode enfileirar fatos: `202 queued` **não significa venda aplicada, recebimento ou lucro**. Casos bloqueados e divergentes continuam exigindo desenvolvimento. As coleções de importação são privadas e somente de leitura; falta interface customizada.

Existem [deploy.md](deploy.md) e [atualizar.sh](atualizar.sh), único atualizador (alias antigo retirado em D69). Foram preparados e testados localmente; isso não comprova deploy real, recursos livres na VPS ou recuperação do release atual.

São **21 migrations declaradas**. A [última bateria da aplicação, D67](artifacts/commercial-imports/release-checks.json), registrou 192 testes unitários, dez grupos de importação e quatro grupos HTTP, regressões e build aprovados; o censo daquela rodada registrou 21 migrations aplicadas localmente. Esta revisão documental não reexecutou testes da aplicação nem consultou banco, contas ou VPS. Imagem/restore antigos não validam a versão atual.

## Como usar esta lista

Itens desmarcados continuam pendentes. P0 cobre desenvolvimento e validação necessários ao escopo inicial; P1 cobre operação/campanha; P2 é expansão condicionada. Uma tarefa só muda para concluída com evidência vinculada e atualização do estado/backlog. Implementado, testado localmente, homologado externamente e publicado são estados distintos.

“Desenvolvimento” é trabalho de código do desenvolvedor/agente. “Homologação” exige desenvolvedor/operador e acesso autorizado à conta ou ambiente correspondente. “Proprietário” identifica decisões comerciais, GitHub e VPS que ficaram com você. Não enviar senhas, tokens, CSVs de compradores ou payloads reais para Git/documentação/logs.

## P0 — Desenvolvimento restante

- [ ] **P01 — Identidades externas do catálogo e correção histórica auditada.** Hoje o guard impede trocar a identidade de oferta com histórico, mas não impede toda nova identidade externa duplicada. Prevenir novas duplicidades e permitir associação/correção controlada de identidades ambíguas já referenciadas, sem editar fatos originais. Conclui com permissões por API, auditoria, concorrência/rollback e idempotência testadas com fixtures. Responsável: desenvolvimento. Referências: B11/R15 e [conciliação](docs/24-conciliacao.md).
- [ ] **P02 — Resolver divergências e colisões com auditoria.** Criar decisões explícitas para conflitos de identidade, valores, moeda, datas e estados; distinguir evidência suficiente de casos que devem permanecer em revisão, inclusive formatos/reversões sem suporte. Preservar recepção/fatos originais e autoria/justificativa da decisão. Retry sozinho não resolve colisão ou ausência de evidência. Conclui com contratos, testes de permissão, deduplicação e aplicação concorrente coerente. Responsável: desenvolvimento. B07/B11, R12–R15/R25.
- [ ] **P03 — Completar os casos de conciliação além da confirmação D67.** Hoje novos snapshots confirmáveis se limitam a pending/approved/refused/canceled sem valores de reembolso/recebimento; snapshots compatíveis podem ser reconhecidos sem novos fatos. Desenvolver reconciliação dos casos restantes com prova de origem, aprovação, reversões e recebimento; não transformar desconhecido em zero nem adivinhar exportações nativas. Conclui com esquema/contratos atualizados, bloqueio de evidência insuficiente e testes de revalidação, idempotência e rollback. Responsável: desenvolvimento. B11/R15; [contrato e limites](docs/24-conciliacao.md).
- [ ] **P04 — Liquidação, custos e relatório financeiro.** Implementar prova independente de liquidação, cadastro de custos e agregados por moeda, período/coorte e cobertura da fonte. Separar bruto aprovado, reversão, taxas, líquido informado, recebido e margem operacional; sem comprovação, mostrar desconhecido, sem declarar lucro fiscal. Conclui com cálculos reconciliáveis, estados de ausência/conflito e permissões testadas; endpoint/relatório previstos ainda precisam ser implementados. Responsável: desenvolvimento. B11/R16 e [métricas](docs/09-metricas.md).
- [ ] **P05 — Interface operacional de importação, resolução e financeiro.** Implementar envio/conferência do CSV, lote/plano durável, confirmação explícita, motivos, estados de bloqueio e resultados, sem permitir editar fatos pelas coleções nativas. Reutilizar autorização/origem e revalidação no servidor. Conclui com testes de API e navegador dos fluxos/erros, claro/escuro, teclado e confirmação idempotente. Responsável: desenvolvimento, após os contratos de P01–P04. B11/B19/B20, R15/R16/R33.
- [ ] **P06 — Atribuição comercial comprovável.** A medição de visitas/saídas existe; vínculo de compra ainda não. Confirmar por provedor se há referência externa suportada, implementar somente o que tiver contrato/evidência e consentimento/janela válidos. Quando não houver suporte, registrar sem atribuição e mostrar cobertura; não inferir por e-mail, IP ou coincidência de valores/horários. Conclui com provas por provedor e casos sem referência/consentimento testados. Responsável: desenvolvimento + homologação de contas. B07/R11.
- [ ] **P07 — Retenção, pedidos de dados e recuperação com privacidade.** Implementar rotinas de retenção, localização/exportação/exclusão ou anonimização conforme política revisada, cancelamento de envios pendentes e reaplicação de exclusões/supressões depois de restore. Incluir analytics, relacionamento, inbox e importações, preservando somente a evidência necessária. Conclui com execução verificável, relatório sem dados pessoais e ensaio de recuperação sem reativar consentimento/envios. Responsável: desenvolvimento + proprietário para revisão da política. B12/R26; [segurança e privacidade](docs/12-seguranca-privacidade.md).

## P0 — Homologação e validação do release

Estas tarefas não significam que os componentes abaixo estejam ausentes. Comprovam se o código atual pode operar no ambiente e nas contas reais.

- [ ] **H01 — Hotmart, Kiwify e Cakto, separadamente.** Conferir contrato vigente e configuração da própria conta; autenticação/rotação, IDs de produto/oferta/conta, eventos, valores/moedas/datas, duplicatas/reenvio, relatório e casos não suportados. Comprovar recepção durável antes do ACK e conciliação, sem publicar dados reais. Registrar limites de cada provedor; não concluir os três com teste de apenas um. Responsáveis: proprietário + desenvolvimento/operador autorizado. B08–B10/R12–R14; [Hotmart](docs/integracoes/hotmart.md), [Kiwify](docs/integracoes/kiwify.md), [Cakto](docs/integracoes/cakto.md).
- [ ] **H02 — Conta e fluxos Brevo.** Conferir remetente/DNS, quota e demais usos da conta, opt-in/descadastro/supressão, amostra, listas, campanhas, callback e conciliação de envio incerto. Validar recuperação administrativa disponível; recuperação por e-mail permanece indisponível até fluxo próprio homologado. Ativar cada flag intencionalmente; não repetir envio de resultado desconhecido. Responsáveis: proprietário + desenvolvimento/operador. B06/R08–R10; [Brevo](docs/integracoes/brevo.md).
- [ ] **H03 — Imagem e banco do release final.** Reconstruir a versão final e testar as 21 migrations atuais em banco vazio e upgrade, ou todas as adicionais quando houver. Verificar runtime sem root/read-only/DDL, permissões reais por API, CLIs empacotadas, filas/callbacks e worker por modo/flag, uploads/patches e ausência de envios externos involuntários. Registrar versão/hash e evidências. Não usar a imagem antiga como aceite. Responsável: desenvolvimento/operador. B05/R22–R25; [pacote de produção](docs/21-pacote-producao.md).
- [ ] **H04 — Backup e restauração da versão atual.** Restaurar banco, mídia e configuração/chaves privadas necessárias com isolamento e sem disparos; validar integridade e P07. Definir e testar destino externo criptografado, retenção e acesso de recuperação. Comprovar metas de RPO ≤24h e RTO ≤4h ou registrar ajuste aceito. Volume/snapshot na mesma VPS não basta. Responsáveis: desenvolvimento/operador + proprietário para destino/custo. B05/R24; [operação](docs/11-operacao.md).
- [ ] **H05 — QA visual, acessibilidade e desempenho.** Completar B19/B20 para telas/estados finais das fases 1 e 2: dois temas, seis larguras, reflow 320px, zoom nativo 400%, teclado, movimento reduzido, erros e fallbacks sem JavaScript pertinentes. Executar orçamento de laboratório e carga representativa conforme R21/estratégia, incluindo dataset e concorrência definidos; não confundir teste local com capacidade da VPS. Capturas antigas são recortes, e D63–D67 não tiveram nova rodada visual. Responsável: desenvolvimento. [Qualidade](docs/15-qualidade.md) e [matriz visual](docs/design/07-qualidade.md).
- [ ] **H06 — Segurança e operação do release.** Revalidar dependências, autenticação, uploads, limites, origem, logs minimizados, proteção administrativa por MFA suportado ou restrição homologada de IP/VPN, rotação/recuperação de segredos e alertas. Investigar o aviso pg/Drizzle registrado e revisar os dois avisos históricos de lint; registrar impacto e decisão, sem chamar a auditoria antiga de consulta atual. Executar o workflow preparado no GitHub e corrigir falhas pertinentes. Responsáveis: desenvolvimento/operador; GitHub com o proprietário. R01/R22–R25.

## P0 — Preparação com o proprietário

- [ ] **O01 — Material e oferta reais do primeiro livro.** Conferir público específico, versão final e direitos de PDF/EPUB, capa/amostra e demais arquivos aplicáveis, texto de venda, preço e elegibilidade/IDs/URLs por plataforma. O título já é “Crie Sistemas com IA e Ganhe Dinheiro”; não se presume aqui que os arquivos não existam em outro projeto. Cadastrar manualmente no Payload e conferir acesso/checkout/entrega de cada oferta. Responsável: proprietário. [Lançamento](docs/22-lancamento.md).
- [ ] **O02 — Contato e páginas institucionais.** Manter e-mail público vazio durante desenvolvimento, conforme sua decisão. Antes de produção, você adiciona o contato real, revisa identificação de Warley Ferraz Almeida, privacidade/termos/avisos e só então libera `legalReady` e coleta pertinente. Não inventar endereço de e-mail. Responsável: proprietário, com ajuste técnico se necessário. R08/R26.
- [ ] **O03 — Inventário e configuração da VPS compartilhada.** Conferir serviços/proxy existentes, recursos/disco/portas, usuários/permissões, volumes, armazenamento externo e rede antes de implantar. Preparar segredos privados fora do Git, papéis do banco, firewall, domínio `bibliotheon.com.br`, TLS e subdomínios que você escolher; origens administrativas exatas. Preservar outros serviços e não usar wildcard como autorização de origem. Responsável: proprietário/operador. B05/R23.
- [ ] **O04 — GitHub e deploy inicial.** Após os gates técnicos, versionar/enviar a revisão, conferir CI, fazer clone/configuração privada e seguir [deploy.md](deploy.md), inclusive backup, saúde, acesso administrativo e procedimento de falha. O primeiro deploy usa `./atualizar.sh --inicial`; os seguintes usam `./atualizar.sh`. Domínio/conta reais e flags ficam sob controle do proprietário. Testar o fluxo no ambiente de destino e registrar o que foi realmente implantado. Responsável: proprietário. O script não substitui as pendências de produto ou inventário.

## P1 — Operação e primeiro lançamento

- [ ] **L01 — Tarefas e kit de campanha.** Concluir B13/R17: tarefas/prazos, hipótese/campanha, materiais autorizados e kit para produção/distribuição. Cadastro de campanha existente não conclui o fluxo operacional.
- [ ] **L02 — Primeiro lançamento acompanhado.** Executar B14/R18 com material/oferta aprovados, três conteúdos e um canal inicial, sem avaliações, escassez ou renda inventadas. Responsável: proprietário, com suporte técnico.
- [ ] **L03 — Revisão semanal com dados reais.** Executar B15/R19: relatório conciliado, cobertura/desconhecidos, custos, ações e decisão da semana. Medir p75 de campo quando houver tráfego suficiente; não fabricar evidência de venda ou desempenho para liberar o primeiro deploy. Responsáveis: proprietário/operação.

## P2 — Depois de validar a operação inicial

- [ ] **E01 — Expansão condicionada B16.** Mais títulos, canais ou automações somente conforme resultados, orçamento e capacidade comprovados. Não é bloqueador do primeiro deploy técnico. Hotmart, Kiwify e Cakto permanecem no escopo inicial de integração; esta prioridade não autoriza remover um deles.

## Ordem prática de execução

1. P01/P02: catálogo histórico e decisões auditadas; depois P03/P04: conciliação completa e financeiro.
2. P05/P06/P07: interface operacional, atribuição comprovável e privacidade, conforme dependências.
3. Preparar O01/O02 e homologar contas H01/H02 em paralelo ao desenvolvimento que não depender dessas respostas.
4. Fechar H03–H06 sobre a versão final e preparar O03. Repetir verificações afetadas por mudanças posteriores, sem reutilizar resultados de outra versão como aceite.
5. O04: você executa o deploy; depois L01–L03: operação/campanha e acompanhamento. E01 permanece condicionado.

## Conferência para liberar produção

- [ ] Desenvolvimento do escopo inicial concluído com evidências e sem divergências críticas de autorização, identidade ou valores.
- [ ] Contas e fluxos que serão ativados homologados; pendências dos três provedores registradas sem declarar conclusão parcial como integral.
- [ ] Imagem final, banco vazio/upgrade, backup externo/restore e privacidade aprovados sobre a mesma revisão.
- [ ] Matriz visual, laboratório de desempenho e segurança aprovados; limitações explicitadas nos documentos de qualidade.
- [ ] Material/ofertas e páginas institucionais revisados; contato real adicionado pelo proprietário antes da coleta/operação.
- [ ] VPS inventariada, demais serviços preservados e configuração privada/proxy/alertas conferidos pelo operador.
- [ ] Registro do deploy e saúde após ativação produzido; métricas operacionais futuras continuam sendo verificadas depois do lançamento.

Ao encerrar cada entrega, atualizar esta lista, [estado atual](docs/23-estado-atual.md), [progresso](docs/14-progresso.md) e backlog quando necessário. Evidência nova deve indicar ambiente, revisão, testes e limitações. Os registros históricos Dxx continuam válidos como retrato da sua etapa, sem substituir esta lista vigente.
