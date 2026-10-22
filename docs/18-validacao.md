# 18 — Validação da entrega documental

[Índice](../README.md) · [Progresso](14-progresso.md)

Histórico inicial: 20/10/2026, documentos e verificador local, então sem aplicação e sem acesso à VPS. As seções iniciais preservam o resultado daquela entrega. A revisão atual está ao final; implementação e evidências de software estão separadas no [estado atual](23-estado-atual.md).

## Verificação inicial — histórico

Executar `python3 scripts/validar_documentacao.py` na raiz.

Na primeira entrega, o script verificou títulos, fechamento de blocos de código, destinos dos links Markdown locais, cobertura de R01–R26 em backlog/testes, presença de B01–B16 e T01–T21, além do SHA-256 de `reflexoes.md`.

SHA-256 original esperado: `e9be41f92ab65d33cfdc5e8f9447d7fb05cf84ad43cb920d7d4906d15d8a262c`.

Resultado inicial: **aprovado** — 30 documentos, 104 links locais válidos, 18 URLs externas distintas catalogadas, 26 requisitos, 16 tarefas e 21 cenários. Nenhum erro estrutural detectado. As URLs externas não são verificadas pelo script; a pesquisa de fontes está registrada separadamente.

Sintaxe do verificador validada com parser Python. Dois controles negativos em cópias temporárias confirmaram que o script retorna falha para link local inexistente e alteração da fonte original. Os arquivos reais não foram modificados por esses controles.

## Revisão semântica

Revisada a consistência entre consentimento, entrega da amostra e marketing; oferta versus venda confirmada; autenticação por provedor; eventos duplicados/fora de ordem; atribuição desconhecida; preço e valores null; VPS compartilhada; backup externo; limites do orçamento e fontes ainda pendentes.

A revisão separou transporte transacional e campanhas de marketing no Brevo e manteve explícitas as dependências de autenticação dos provedores. Todos os requisitos têm fase, dependência e aceite; todos aparecem no backlog e na matriz de cenários. Os seis modelos operacionais estão ligados ao índice.

## Limites

O verificador não testa endpoints externos, domínio, software futuro, desempenho, acessibilidade renderizada, segurança implementada, integrações reais ou capacidade da VPS. Fontes externas foram consultadas e seus limites registrados em [referências](16-referencias.md); uma URL técnica Kiwify retornou 404 e não foi usada para inventar autenticação.

Não houve deploy, publicação de livro, envio de campanha, compra ou confirmação de vendas. Checklists de homologação permanecem pendentes deliberadamente.

## Evolução documental de design

O verificador atual inclui `DESIGN-BRIEF.md`, todos os documentos de design, R01–R34, B01–B20 e T01–T29. Verifica os dois hashes de conversas originais e executa a verificação não mutante dos contrastes. O relatório de cores deve corresponder exatamente à paleta canônica.

Hash da conversa de design: `a78685e178c4453a71f9abfcc30aac0c32a7f114b4081f41790c1a6f7561e122`.

Resultado da evolução: **40 documentos, 161 links locais válidos, 31 URLs externas distintas catalogadas, 34 requisitos, 20 tarefas e 29 cenários**. Os 76 pares autorizados de contraste passaram; o relatório gerado corresponde à paleta JSON. Sintaxe dos dois verificadores válida.

Controles matemáticos confirmaram preto/branco = 21:1 e #777777/branco abaixo de 4,5:1. Quatro controles negativos em cópias temporárias detectaram link quebrado no briefing, alteração da conversa de design, contraste insuficiente e perda de cobertura de requisito no backlog. Nenhuma conversa real foi alterada.

Revisão semântica: substituídas as direções iniciais de fonte de sistema e tema somente claro; preservados os contratos comerciais; enums visuais integrados a dados/interfaces; dependências B17–B20 incorporadas sem renumerar tarefas antigas. A identidade, as três variantes de LP, todas as famílias de páginas, painel e componentes prioritários estão especificados para ambos os temas. Os testes visuais futuros permanecem não executados.

A avaliação de pares sRGB não certifica acessibilidade, aparência ou conversão. Fontes externas não são verificadas pelo script; fontes e falhas de consulta estão registradas nos documentos de referência. Nenhum browser de aplicação, frontend ou infraestrutura foi iniciado.

## Consolidação do estado implementado — 21/10/2026

Revisão documental posterior à implementação autorizada. Conferidos código/rotas, package.json/lockfile, sete migrations, workflow CI e 16 relatórios existentes. Consultados somente nomes/batches de migrations e contagens locais, sem ler contatos/credenciais ou alterar serviços. O [inventário datado](../artifacts/documentation/state-audit-2026-10-21.json) registra o recorte observado; não substitui nova execução dos testes de software.

Criado documento 23 com mapa dos 34 requisitos, componentes existentes, evidências e lacunas, comandos, migrations e ordem de retomada. README, progresso, backlog, contratos HTTP, dados, arquitetura, segurança/operação e direção visual foram alinhados. Backlog mantém 20 IDs e a qualidade mantém os 29 cenários, sem reduzir aceites ou marcar fases incompletas como concluídas. Corrigidas descrições antigas de aplicação inexistente, domínio/título desconhecidos, cache/CI e quota totalmente pendentes; histórico cronológico preservado no documento 19.

O exemplo privado de produção agora explicita BREVO_TRANSACTIONAL_RESERVE=50, já consumido pelo código/Compose; nenhum segredo real ou flag de ativação foi alterado. E-mail público permanece vazio até produção por decisão do proprietário. Nenhuma nova implementação de lote promocional, deploy, integração externa ou teste da aplicação foi realizada nesta revisão. Resultado do validador documental registrado após a conferência final.

Resultado final: **aprovado — 46 documentos, 285 links locais, 58 URLs externas catalogadas, 34 requisitos, 20 itens de backlog, 29 cenários e 76 pares de contraste**. URLs externas não foram reconsultadas nesta revisão. Checagem complementar confirmou os 34 requisitos mapeados uma vez, os estados dos 20 itens, 9 linhas HTTP implementadas/8 previstas e a presença dos 16 relatórios referenciados. Inventário inclui hashes dos arquivos de implementação/configuração pública/scripts para identificar esta revisão; não inclui ambientes privados nem dados de usuários. Fontes históricas permaneceram byte a byte intactas.

## Guia e automação de deploy — 22/10/2026

deploy.md passou a integrar o próprio validador, com links/blocos/hashes verificados. Ferramentas novas: dois launchers Bash, orquestrador Python, 23 testes de orquestração simulada e ensaio de configuração Compose real/JSON privado. Bash, sintaxe Python e --help dos dois nomes passaram. A normalização foi testada inclusive com senha sintética contendo cifrão; nenhum container de aplicação foi iniciado. Caminho/versão do restic conferidos em container temporário não iniciado e removido.

check-local passou com tipos, lint sem erros (dois avisos já conhecidos na migration) e 29 unitários da aplicação; a última execução isolada das ferramentas passou nos 23 testes após os ajustes finais de Git/cifrões. Workflow preparado inclui os testes novos, sem execução comprovada no GitHub. [Resultado e hashes da entrega](../artifacts/deploy/local-results.json). Fontes operacionais oficiais Docker/Caddy/restic/GitHub foram consultadas; o verificador não testa rede nem configurações reais da VPS. Nenhum deploy, pull real, backup externo real, DNS ou proxy foi executado.

## Continuação de 22/10 — mídia e manutenção

D47 com [seis grupos de integridade](../artifacts/media-integrity/local-results.json) e [checagens do release local](../artifacts/media-integrity/release-checks.json). Orquestração passa a ter 24 testes simulados; backup confirmado precede coleta e falha tenta retomar app. Build isolado/CLI/HTTP aprovados. Sem VPS, backup externo, CI GitHub ou nova rodada visual. Relatórios anteriores preservam o estado daquela execução.

## Continuação de 22/10 — lotes locais

D48: [seis grupos de integração](../artifacts/promotion-batches/local-results.json), regressões de sequências/marketing, 31 unitários, 24 testes simulados de deploy e build/CLI/HTTP aprovados. [Resumo e hashes](../artifacts/promotion-batches/release-checks.json). Oitava migration aplicada somente no banco loopback; nenhuma campanha ou lista criada no provedor, sem envio promocional, VPS ou nova homologação visual.

## Continuação de 22/10 — bloqueios outbound

D49: [oito grupos](../artifacts/brevo-suppressions/local-results.json) e [resumo/hashes](../artifacts/brevo-suppressions/release-checks.json). 38 unitários, 25 testes simulados de deploy, regressões, build/CLI/Compose/HTTP aprovados. Nona migração aplicada só no banco loopback; down/up e preenchimento histórico conferidos em transação revertida. Contrato público GET/PUT consultado, nenhuma conta/API real ou mensagem. Sem nova homologação visual, VPS ou imagem/restore.

## Continuação de 22/10 — conferência de destinatários

D50: [sete grupos](../artifacts/provider-preflight/local-results.json) e [resumo/hashes](../artifacts/provider-preflight/release-checks.json). 40 unitários, 25 testes de deploy simulado, regressões, build/CLIs/HTTP/site aprovados. Décima migração aplicada só no PostgreSQL loopback; guard de downgrade preserva registros novos. Consulta oficial GET revalidada; conta real não acessada, sem envio, webhook, listas/campanhas ou nova homologação visual/imagem.

## Continuação de 22/10 — cadastro consentido

D51: [dez grupos](../artifacts/brevo-registrations/local-results.json) e [resumo/hashes](../artifacts/brevo-registrations/release-checks.json). 45 unitários, 26 testes simulados de deploy, regressões, build/empacotamento/Compose/HTTP aprovados. CLI habilitado exercitado com fetch interceptado; nenhum endpoint real. Migração 11 aplicada só no banco local, down/up/backfill e recusa de perda de tentativas conferidos em transações revertidas. Sem nova homologação visual, imagem/restore ou operação real.


## Continuação de 22/10 — listas exclusivas Brevo (D52)

12a migração aplicada somente no PostgreSQL local; down/up vazio revertido e recusa de downgrade com intenções/IDs confirmados. [Dez grupos de integração](../artifacts/brevo-lists/local-results.json): concorrência, reconciliação sem recriação incerta, retenção imediata de ID, composição exata/paginada, resultado parcial, preferências ausentes, descadastro em voo, lease, validade e 200 destinatários sintéticos em inclusões de 150/50. CLI empacotado habilitado exercitado com fetch inteiramente interceptado e persistência conferida; ajuda/desativação/configuração inválida também passaram.

51 unitários e 27 testes simulados de deploy aprovados; regressões de cadastro (10), bloqueios (8), preflight (7), lotes (6), marketing (11) e sequências (7) passaram sequencialmente. TypeScript, lint sem erros (dois avisos anteriores), instalação congelada/import map inalterado, build isolado e runtime final aprovados. Configuração Compose real mantém flags false em app/worker; nenhum container de aplicação iniciado. HTTP na porta 3001 validou coleção privada e páginas públicas; servidor de QA encerrado sem alterar prévia da porta 3000. [Resumo e hashes](../artifacts/brevo-lists/release-checks.json).

Nenhuma API real, lista/campanha externa, mensagem, VPS ou GitHub nesta rodada. Sem nova homologação visual, imagem/restore do release de 12 migrations ou resultado comercial. Aviso pg/Drizzle de queries concorrentes permanece. Campos opcionais do provedor ausentes mantêm estado incerto; homologar conta/pasta/automações antes de ativar. Preferências promocionais completas, campanhas, webhook, conciliação e retenção de listas externas continuam pendentes.

Fechamento documental D52: 47 documentos, 367 links locais, 70 URLs externas catalogadas, 34 requisitos, 20 tarefas, 29 cenários e 76 pares de contraste aprovados. git diff --check, sintaxe dos dois launchers e compilação Python também passaram; URLs externas não são verificadas pelo validador.


## Continuação de 22/10 — preferências por assunto (D53)

[Sete grupos](../artifacts/preferences/local-results.json) aprovados com PostgreSQL loopback: consulta sem mutação/endereço, tokens e escopo entre contatos, contrato POST privado/estrito, retirada concorrente, rollback de auditoria/calendário, preservação de outro assunto, recusa de lote preparado e cancelamento do último tema com fila externa. Confirmação antiga expirada não reativa tema. Primeiro assunto usa pedido/confirmação/calendário; segundo é semeado sinteticamente. Sem alteração de schema.

[36 capturas](../artifacts/qa-preferences/results.json) em claro/escuro e seis larguras (360 a 1920), consulta explícita por teclado, cancelamento temático e global com estado persistido: axe/overflow sem falhas. GET da página não fez consulta privada nem mutação; GET da API retorna 405 no servidor real isolado. Telas móvel clara e desktop escura também inspecionadas visualmente. 51 unitários e 27 testes simulados de deploy, TypeScript/lint, build .next-qa, regressões de marketing (11), sequências (7), lotes (6), acesso HTTP e site aprovados. QA encerrado, prévia 3000 preservada. [Resumo e hashes](../artifacts/preferences/release-checks.json).

Nenhuma API externa, campanha, mensagem real, GitHub/VPS ou nova imagem/restore. Não houve nova instalação congelada: dependências/lockfile permaneceram iguais. Aviso pg/Drizzle e dois avisos de lint anteriores persistem. Rodada visual cobre esta página, sem concluir B20 integral. Personalização das preferências por destinatário em campanhas e webhook/conciliação ainda pendentes.

Fechamento documental D53: 47 documentos, 379 links locais, 70 URLs externas catalogadas, 34 requisitos, 20 tarefas, 29 cenários e 76 pares de contraste aprovados. git diff --check passou; URLs externas não foram reconsultadas por esta rodada.


## Continuação de 22/10 — links individuais Brevo (D54)

[Oito grupos](../artifacts/brevo-preferences/local-results.json) aprovados: intenção antes de HTTP, dois titulares com links distintos e hash sem token bruto, preparação concorrente, timeout aplicado/204 ignorado, descadastro em PUT, bloqueio observado, divergência de ID, expiração/rotação de chave, rollback e CLI empacotado habilitado com HTTP inteiramente interceptado. 13a migração aplicada só no PostgreSQL local; down/up vazio e guard contra perda de intenção/prova em transações revertidas.

58 unitários e 28 testes simulados de deploy passaram. Regressões sequenciais de preferências (7), lotes (6), preflight (7) e listas (10), tipos/lint (dois avisos anteriores), build isolado/runtime e configuração Compose real aprovados; flag de preferências false em app/worker, sem containers de aplicação iniciados. HTTP de privacidade/site passou, incluindo coleção de tokens com leitura/criação anônimas negadas e leitura do owner permitida. QA encerrado; prévia 3000 preservada. [Resumo e hashes](../artifacts/brevo-preferences/release-checks.json).

Sem API real, campanha criada/enviada, quota promocional, GitHub ou VPS. Nenhuma nova UI/homologação visual ou imagem/restore atual; dependências/lockfile inalterados, instalação congelada não repetida. Contrato oficial de atributos/GET/PUT e placeholder reconferido em fontes públicas; conta/schema real/renderização continuam sem homologação. Aviso pg/Drizzle persiste.

Fechamento documental D54: 47 documentos, 389 links locais, 72 URLs externas catalogadas, 34 requisitos, 20 tarefas, 29 cenários e 76 pares de contraste aprovados. Sintaxe Bash/Python e git diff --check passaram. URLs externas não são verificadas pelo validador; fontes de contrato foram consultadas separadamente.


## Continuação de 22/10 — rascunhos de campanha (D55)

[Oito grupos locais](../artifacts/brevo-campaigns/local-results.json) aprovados: concorrência, manifesto sem tokens/endereço, resposta de criação perdida, ausência sem recriação, ID conhecido antes de falha de GET, cópia alterada, colisão de ID entre lotes, retry de recusa explícita, descadastro em POST, lease e expiração. CLI empacotado habilitado reconciliou rascunho existente com HTTP totalmente interceptado; ajuda/desativação/configuração e argumentos inválidos também passaram antes de banco/rede. 14a migração aplicada só no PostgreSQL local; down/up vazio e recusa de perder intenção/IDs testados em transações revertidas.

64 unitários e 29 testes simulados de deploy passaram; renderer com texto literal, placeholders próprios e contexto comercial, requisição sem agendamento e conferência estrita de GET cobertos. Regressões sequenciais de links individuais (8), listas (10) e lotes (6), tipos/lint (dois avisos anteriores), build .next-qa/runtime e Compose real aprovados. HTTP de coleção privada/site passou, com owner autorizado para leitura e mutação negada pela Local API; QA encerrado sem alterar prévia 3000. [Resumo e hashes](../artifacts/brevo-campaigns/release-checks.json).

Sem campanha/conta/API real, mensagem, claim/quota promocional, GitHub ou VPS. Consulta oficial não homologa remetente, HTML/placeholder ou representação real do GET. Sem nova homologação visual/painel, imagem/restore atual ou instalação congelada; dependências/lockfile inalterados. Aviso pg/Drizzle persiste. Adaptador não oferece sendNow, envio de teste, agendamento, PUT ou DELETE. Transporte/webhook/conciliação e retenção continuam pendentes.

Fechamento documental D55: 47 documentos, 399 links locais, 76 URLs externas catalogadas, 34 requisitos, 20 tarefas, 29 cenários e 76 pares de contraste aprovados. Sintaxe Bash/Python, hashes da entrega e git diff --check passaram. URLs externas não são verificadas pelo validador; contratos públicos foram consultados separadamente.
