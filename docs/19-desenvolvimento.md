# 19 — Implementação e evidências locais

[Índice](../README.md) · [Progresso](14-progresso.md)

Este documento é um registro cronológico: resultados posteriores podem concluir pendências de parágrafos anteriores. Para decidir a próxima ação e o que ainda falta, usar o [estado vigente com R01–R34 e evidências](23-estado-atual.md). Textos antigos “em execução”, “não implementado” ou “domínio pendente” não substituem a fotografia atual.

## Autorização e limites

Em 20/10/2026 o proprietário autorizou o desenvolvimento completo, incluindo implementação e testes locais. GitHub e deploy na VPS permanecem com o proprietário. A autorização atual sucede o escopo documental D16; preservam-se todas as invariantes e fontes históricas. Nenhum envio, compra ou campanha externa é necessário para desenvolver localmente.

## Análise documental

Inventariados README, AGENTS, briefing, documentos 01–18, nove documentos de design, cores, modelos, contratos de Hotmart/Kiwify/Cakto e conversas históricas. A sequência de execução permanece B01 → B17 → B02 → B18 → B03/B04 → B19/B20 e fase 2. Sem escolher primeiro título com base em outro projeto.

## B01 — Objetivo e aceite

Implementar monólito Next/Payload/PostgreSQL, autenticação privada, permissões deny-by-default, migração inicial, lockfile, verificação e CI localmente reproduzível. Requisito R01; cenários T01 e controles da R22. Arquivos: configuração raiz, src/access, src/collections/AdminUsers, rotas Payload/health, scripts, migrations e tests.

Critérios: typecheck/lint/unitários/build; migração de banco vazio; REST e Local API negam anônimo; login owner funciona; tentativa de criação pública falha, inclusive antes do primeiro owner. GraphQL desabilitado. Nenhum segredo de teste ou credencial real versionado.

## Versões consultadas

Consulta ao registro oficial npm em 20/10/2026: Payload e pacotes 3.91.0, Next 16.4.2, React 19.3.1. Peer dependency de @payloadcms/next exige Next >=16.3.3 <17, entre outras faixas 15 específicas. Essa declaração do pacote é mais restritiva que a página de instalação consultada (16.2.6+); prevalece o contrato instalado e testes. Node local 22.23.3; pnpm 10.34.7. PostgreSQL 17.9 baseline local.

Fontes: [instalação Payload](https://payloadcms.com/docs/getting-started/installation), [controle de acesso](https://payloadcms.com/docs/access-control/overview), [PostgreSQL](https://payloadcms.com/docs/database/postgres), [pacote oficial](https://www.npmjs.com/package/@payloadcms/next).

## Evidências

### B01 — primeira rodada local

- Instalação concluída com pnpm-lock.yaml; versões exatas e peer esbuild corrigido para a ferramenta de testes.
- PostgreSQL 17.9 em Compose isolado, digest fixado; migração inicial aplicada com sucesso em banco vazio. UUID e schema sem push automático.
- TypeScript strict, lint sem avisos e três unitários passaram na base; build Next de produção passou na primeira rodada (antes de B17).
- T01 executado contra servidor real em loopback: first-register 403 antes/depois do owner; cadastro REST 403; leitura REST/Local API anônima negada; login/leituras owner 200; GraphQL 404; health 200. Owner sintético removido ao terminar.
- O adapter PostgreSQL mantém conexão dedicada de reconexão e destroy não encerra pool; scripts encerram o processo CLI após aguardar limpeza dos dados e destroy, como o CLI do Payload. Não aguardar pool.end, pois essa conexão dedicada não é liberada pela versão instalada.
- Workflow CI preparado como arquivo, sem execução no GitHub. Recuperação de senha pendente do transporte real; nenhuma alegação de MFA ou produção pronta.

### B17 — objetivo, escopo e primeira evidência

Aplicar R27–R29 e preparar R33: gerar CSS da paleta canônica, consumir com Tailwind, fontes WOFF2 locais licenciadas, tema system/light/dark antes do paint e extensão suportada no painel. Sem telas editoriais antes dessa fundação.

Implementados tokens gerados, estilos base, home vazia, fontes via Fontsource, aparência do site e adapter useTheme do Payload. O provider nativo controla o DOM no admin; a extensão não manipula seu atributo de tema diretamente. A API tipada do Payload aceita light/dark; system é resolvido pelo adapter, com listener do SO. Nenhuma instalação global de skill. Referências frontend-design, tokens, animate, a11y e princípios consultadas conforme documento de design, com o briefing prevalecendo.

Rodada local Chromium de desenvolvimento: home vazia × light/dark × 320/360/390/768/1024/1440/1920px, 14 screenshots, sem overflow e sem violações axe nos tags WCAG selecionados. Sem erros JavaScript; tema persiste em reload; system reage ao SO; storage negado não impede escolha; sem JS mantém conteúdo e fallback escuro; skip link recebe foco por Tab. Resultados em [JSON](../artifacts/qa-foundation/results.json); [desktop claro](../artifacts/qa-foundation/home-light-1440.png) e [mobile escuro](../artifacts/qa-foundation/home-dark-390.png) revisados visualmente. Isso não conclui B20 nem certifica WCAG. Painel, componentes editoriais, matriz restante, CSP e build atualizado ainda em validação.

## Pendências de produção

Produto prioritário, domínio e responsável já informados em [lançamento](22-lancamento.md). Permanecem: público/arquivos/preço/ofertas, contato público antes da produção, contas e contratos autenticados de cada provedor, remetente Brevo, inventário e acesso administrativo restrito, backup externo e restauração atualizada. B14–B16 dependem de operação real; código local não comprova lançamento ou resultado comercial.

## B02 / B18 — objetivo e critérios antes da implementação

Coleções privadas de temas, livros, artigos, mídia, amostras e ofertas, com edição/drafts do Payload; projeções públicas serão serviços estreitos em B03. Relações UUID, enums visuais, publicação validada no servidor, busca normalizada, URL HTTPS por host exato e oferta principal única no banco. Upload validado por bytes/tamanho e nome aleatório; mídia privada por padrão. Nenhum livro real será inferido ou publicado.

Arquivos: src/collections, src/modules/catalog, src/modules/commerce, testes e migração aditiva. Requisitos R02/R05/R22/R30, cenários T02/T05/T17/T25. Aceite: invariantes unitárias e integração PostgreSQL/REST, drafts preservam edição pública, índice de oferta primária resiste a concorrência, três provedores representados por fixtures sintéticas. Integrações não serão ativadas nesta etapa.

## B03 / B04 — objetivo e critérios antes da implementação

Implementar projeções públicas explícitas de conteúdo publicado, catálogo com busca normalizada/filtro/paginação, três variantes de LP, artigos/temas, institucionais editáveis, preview autenticado, mídia pública segura, redirecionamento de oferta/campanha e SEO. Coleções operacionais continuam privadas. Nenhum preço, livro, contato ou depoimento real será inventado.

Arquivos: src/modules/catalog/public, src/components, rotas do site, Campaigns/Redirects/configuração institucional, migração e testes de integração/navegador. Requisitos R03/R04/R06/R07/R20/R21/R30, cenários T01/T03/T04/T05/T25. Aceite: rascunhos e PDFs privados ausentes da API/site/sitemap; oferta resolvida no momento da saída; campanha afiliada mantém URL intacta e falha sem fallback; canonical sem query; slug antigo redireciona sem cadeia; telas nos temas aprovados. Dados consultados diretamente no PostgreSQL inicialmente, sem cache compartilhado de HTML; publicação tem efeito na próxima leitura.

## Resultados de 21/10/2026

- B02: `npm run test:catalog` passou em PostgreSQL local. Validação de publicação, revisão pública preservada em draft, uploads inválidos, reencodificação WebP/hash, URLs e enums, oferta em livro pronto e índice único concorrente. Três provedores representados exclusivamente por dados sintéticos.
- Adicionadas campanhas vinculadas à oferta, configuração institucional privada e redirects geridos pelo servidor. Hosts aprovados por provedor. Textos institucionais e responsável não são inventados; sem revisão institucional, páginas não são indexáveis e sitemap fica vazio.
- B03/B04: `npm run test:site` passou com servidor standalone em loopback. Rotas 200, busca sem acento, vazio, paginação inválida 404, draft privado 404, REST privado 403, preview anônimo redirecionado/login owner permitido/noindex, mídia pública, checkout e afiliado com URL intacta, incompatível 400, inativa 410, sitemap publicado, mudança de slug 308 e flatten. Fixture limpa ao terminar.
- Corrigido sitemap inicialmente estático: agora é dinâmico. Migração aplicada do schema anterior para campanhas/globais/redirects. Build standalone passou antes dos refinamentos visuais finais.
- [Rodada visual pública](../artifacts/qa-phase1/results.json): 170 screenshots, home com três livros, catálogo/filtro/vazio, três LPs, artigo/tema, quatro institucionais e afiliado, light/dark × seis larguras; mais 320px/título longo/capa ausente/teclado. Sem overflow, violações axe ou erros JS nessa rodada. Dados, capas e preços são fixtures, nunca produtos anunciados.
- Crítica visual: reduzir altura de cards no celular e incluir oferta no bloco inicial da LP. Implementados após a rodada; revalidação pendente. Menu móvel nativo dialog, fallback sem JS e sumário de artigo longo adicionados.
- Painel nativo mostrou aria-hidden-focus, combobox sem rótulo e botões estreitos. Dashboard customizado pelo ponto suportado views.dashboard apresenta contagens editoriais reais, sem receitas inventadas; áreas de toque ajustadas por CSS BEM. Nova rodada pendente; não ocultar falha alterando tags/escopo do axe.
- Runtime local usa standalone com arquivos estáticos copiados, MEDIA_DIR absoluto e origem 127.0.0.1 consistente para CSRF. Nenhum arquivo de ambiente é incluído no standalone. CI ampliado como arquivo, ainda não executado no GitHub.

Próximo: validar dashboard/refinamentos no build atual, testar estados 0/1/20 livros, CRUD e privacidade de PDF; preparar infraestrutura local e fase 2. Restauração externa, homologação e publicação continuam pendentes.

Refinamento de checkout: a oferta próxima ao título revelou pré-carregamento automático de Link para o redirecionamento, observado como timeout de navegação. CTA passou a usar âncora comum, e QA monitora ausência de requisições a /comprar antes de interação. A segunda rodada interrompida não conta como aprovada; repetir após novo build. O health permaneceu 200 durante o diagnóstico. Login/dashboard customizados já passaram em claro/escuro × 390/1440px, com axe sem violações e tema system reagindo ao SO.

## B05 — escopo local antes de implementar

Preparar imagem imutável, Compose de produção com banco privado/recursos limitados, CLI de migrations e provisionamento, healthcheck e scripts de backup/restauração seguros. Validar build/configuração e restauração em banco/volumes exclusivamente locais com fixtures. Requisitos R23/R24 e cenários T18/T19. Inventário, TLS/proxy real, destino externo, RPO/RTO de produção e deploy ficam pendentes do proprietário; nenhum acesso à VPS será feito. Não atribuir sucesso remoto a cópias locais.

### Evidência local e correções em B05/B19

- [Container local](../artifacts/container/local-results.json): primeira imagem identificada por SHA-256 passou em banco vazio, runtime sem superusuário/DDL, app não root/read-only, saúde, API privada e CLI de owner. Corrigida montagem tmpfs que o YAML havia separado pela vírgula. Secrets de owner não entram no ambiente do app; nenhuma credencial de runtime é embarcada na imagem.
- [Recuperação local](../artifacts/recovery/local-results.json): restic 0.19.1, captura criptografada e restore de PostgreSQL/mídia em projeto isolado; integridade e ponto anterior verificados, sobrescrita recusada, nenhum serviço de envio iniciado. Backup externo e produção seguem pendentes. Procedimentos no [pacote](21-pacote-producao.md).
- [Estados do catálogo](../artifacts/qa-phase1/catalog-states-results.json): 36 screenshots para 0/1/20 livros em dois temas/seis larguras, paginação 12+8, diálogo móvel/Escape/foco e texto 200%. O teste passou a aguardar a navegação antes de contar os itens; zoom nativo 400% ainda pendente.
- Auditoria `pnpm audit --prod` encontrou sete advisories (quatro altos). Sharp atualizado a 0.35.5; overrides exatos para DOMPurify 3.4.16, Sass 1.106.0 e esbuild 0.28.2 removem transitivos afetados. [Nova auditoria](../artifacts/security/audit-2026-10-21.json): zero advisories conhecidos, sem exceções. Isso não é garantia de ausência de vulnerabilidades.
- [Patch pnpm](../patches/@payloadcms__ui@3.91.0.patch): rótulo associado ao checkbox nativo de linha que o axe encontrou sem nome. Contraste e tamanho dos controles ajustados com tokens/CSS. Patch e novo lockfile exigem repetir QA editorial/build/imagem; relatório anterior de edição registra a falha e não é aprovado.
- Provisionamento agora recusa JSON inválido sem incluir a entrada no erro; três testes de privacidade/tipagem adicionados. Magic bytes restringem imagens antes de chamar o decoder. Bootstrap de aparência compartilhado entre servidor/cliente; teste com chunks React bloqueados verifica aplicação anterior à hidratação.

Fontes de correção: [Sharp/libRSVG](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w), [releases DOMPurify](https://github.com/cure53/DOMPurify/releases), [esbuild](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99). O advisory de braces foi identificado pelo registro npm; a tentativa de abertura direta no repositório retornou 404, sem presumir conteúdo ausente. Dependência antiga saiu do grafo de produção ao atualizar Sass/Chokidar.

### Continuidade — painel editorial

O build limpo eliminou o erro de contexto observado após a troca de dependência. A listagem de livros passou em claro/390px sem violações axe. O formulário de edição revelou falhas adicionais do pacote nativo: nomes dos controles de array e mídia, comboboxes sem rótulo, clear-indicator focável oculto, editor sem nome, navegação de abas com semântica de lista incorreta e controles pequenos. Patches locais versionados preservam a funcionalidade nativa; nova rodada ainda necessária. Não atribuir aprovação aos formulários enquanto ela não terminar.

## B06 — critérios antes da implementação

Implementar captura de amostra com confirmação por POST, marketing opcional separado, tokens de finalidade própria e hash persistido, arquivo privado com link temporário, consentimento append-only, supressão imediata e fila durável no PostgreSQL/jobs Payload. Transporte Brevo fica desativado por padrão; confirmação/entrega transacionais e campanhas promocionais permanecem separadas. Revalidar contratos oficiais antes de codificar o transporte. Nenhum e-mail real será enviado nesta execução.

Aceite local: pedido genérico e deduplicado, limites em banco, confirmação idempotente/expiração, amostra sem marketing, arquivo indisponível sem token, revogação bloqueando fila, quota conservadora e timeout incerto sem reenvio cego. Fixtures sintéticas; homologação de conta/remetente/quota continua externa. Requisitos R08–R10 e cenários T06/T07/T17. Registrar evidência separada da mera criação de código.

### B06 — primeira evidência local

Coleções privadas de contatos, assinaturas, pedidos, consentimento append-only, entregas, links de preferências, limites e quota implementadas, com migrações adicionais e constraints no PostgreSQL local. Serviço registra pedido/outbox atomicamente; worker gera token apenas em memória e persiste hash antes de tentar enviar. Jobs Payload não são executáveis nem legíveis por API pública. Rotas de captura/confirmar/download/descadastro e telas iniciais implementadas; revisão HTTP/browser dessas telas ainda pendente.

`npm run test:marketing` passou com transporte exclusivamente em memória: concorrência/deduplicação, envio único, confirmação idempotente/expirada, amostra sem assinatura, opt-in, descadastro repetido, confirmação antiga sem reinscrição, bounce, quota, timeout incerto sem reenvio, retentativa após rejeição explícita, dispatcher repetido e permissões. [Relatório local](../artifacts/marketing/local-results.json). O primeiro PDF de fixture foi recusado pela validação estrutural nativa; substituído por PDF sintético válido, preservando a validação. Aviso de depreciação do pg sobre queries no mesmo cliente observado ao final; investigar antes de atualizar para pg 9.

Quatorze testes unitários passaram antes da última integração. A bateria de acesso no runtime de produção também verificou cookie HttpOnly/Secure/SameSite=Lax e CSRF por origem. Os patches dos formulários permitiram validar livro; oferta apresentou campo de data sem nome e ação de limpar em readonly, corrigidos posteriormente e ainda aguardando rodada final.

**Limites B06:** nenhum e-mail real; conta, remetente, quota e supressões Brevo não homologados. Sequências D+2/D+4/D+7/D+10, campanhas promocionais, administração de supressões externas e recuperação de senha permanecem pendentes; não declarar B06 concluído. Transporte e captura ficam desativados por padrão. Sem e-mail público, `legalReady` continua falso e a captura pública permanece indisponível.

Fontes técnicas consultadas em 21/10/2026: [transação Payload](https://payloadcms.com/docs/database/transactions), [jobs](https://payloadcms.com/docs/jobs-queue/jobs), [tasks](https://payloadcms.com/docs/jobs-queue/tasks), [Brevo transacional](https://developers.brevo.com/reference/send-transac-email). API-key em header; somente confirmação e entrega usam transporte transacional. Marketing não usa esse endpoint. O contrato de criação de campanha ainda precisa de nova consulta: a URL histórica retornou erro nesta ferramenta.

### B06 — rodada HTTP/browser em standalone

Build de produção passou com as novas rotas. [Relacionamento renderizado](../artifacts/qa-relationship/results.json): 28 screenshots (captura, pedido, confirmar, download disponível, preferências, descadastro e link expirado; claro/escuro × 360/1440px). Sem violações axe/overflow. GET de confirmação e preferências não altera estado; botão faz POST; PDF baixado corresponde byte a byte à fixture e arquivo privado direto responde 403. Links sensíveis usam no-store/noindex/no-referrer. Capturas de mobile claro e desktop escuro inspecionadas visualmente, com hierarquia e CTA legíveis.

Dezessete testes unitários passaram, incluindo classificação de timeout, rejeição/rate limit e aceitação do transporte Brevo, sem chamadas externas. Lint/typecheck passaram antes da rodada HTTP/browser. CI local preparado para incluir `test:marketing`, ainda não executado no GitHub.

A primeira tentativa de navegador atingiu servidor antigo ainda na porta 3000 e não conta como QA. Processo confirmado pelo diretório do projeto e encerrado individualmente; launcher ganhou prazo de dez segundos para encerrar seu próprio filho. Rodada acima foi repetida no build atual. Painel editorial passou em livro/oferta/campanha na primeira combinação, mas institucional revelou semântica de grupo inválida; patch corrigido, novo build/rodada ainda necessários.

Brevo promocional: fontes atuais de [criação de campanha](https://developers.brevo.com/reference/create-email-campaign), [envio imediato](https://developers.brevo.com/reference/send-email-campaign-now), [listas](https://developers.brevo.com/reference/create-list), [inclusão em lista](https://developers.brevo.com/reference/add-contact-to-list), [atualização de contato](https://developers.brevo.com/reference/update-contact) e [bloqueios transacionais](https://developers.brevo.com/reference/get-transac-blocked-contacts) consultadas. A campanha é distinta do transporte transacional, usa listas/segmentos e não será agendada com antecedência. Não presumir campos internos não expandidos nem homologação da conta. Nenhuma lista, contato ou campanha foi criada no serviço externo.

Hardening adicional em B06: limites globais em PostgreSQL (250 pedidos/hora, 1.000/dia) contêm tentativas com endereços distintos sem confiar em headers de IP enviados pelo cliente; limite por endereço configurável entre 1 e 20/dia, default 5. Repetição em 15 minutos é genérica e não duplica envio. Quota mal configurada falha fechada. Um pedido repetido pode retirar opt-in ainda pendente; não eleva silenciosamente uma solicitação sem marketing. Confirmação relê o pedido sob o mesmo lock do contato para evitar consentimento desatualizado. Dispatcher não deixa job abandonado em processing prender uma entrega ainda pending; o lock do outbox impede envio duplicado.

A verificação HTTP de acesso foi iniciada uma vez com o servidor já encerrado e recebeu ECONNREFUSED; não conta como aprovação. Repetir depois de subir o novo build. Demais ensaios são identificados separadamente nos relatórios.

### Fechamento da rodada administrativa e isolamento da prévia

[20 telas editoriais](../artifacts/qa-admin-editorial/results.json) passaram em produção local isolada (claro/escuro × 390/1440px), sem violações axe, JS ou overflow. Salvar rascunho pelo formulário preservou a revisão publicada. [Home vazia](../artifacts/qa-foundation/results.json) repetida após limpeza das fixtures: 14 screenshots; preferência antes da hidratação, sem JS/storage, system e teclado aprovados. API de sessão/CSRF e `test:site` também passaram na porta 3001.

A porta 3000 possui prévia de desenvolvimento gerenciada que reaparece. Build e testes agora podem usar `.next-qa`/`TEST_BASE_URL`, sem encerrar a prévia nem misturar arquivos gerados. A rodada que atingiu a prévia e sofreu timeout não conta como QA de produção. Esta distinção explica a necessidade de repetir o ensaio com origem isolada.

[Imagem local atualizada](../artifacts/container/local-results.json), identificada por SHA-256, passou em banco vazio: migrations, conta de runtime sem DDL/superusuário, app não root/read-only, CLI de owner, contatos privados, execução pública de jobs negada, captura desativada por padrão e CLI de worker incluída. Esta imagem precede os últimos ajustes de consentimento, apresentação pt-BR e timezone; reconstruir antes do release. Nenhum registry, GitHub ou VPS foi alterado.

A revisão visual encontrou rótulos técnicos em inglês e datas americanas no painel. Camada de apresentação agora aplica nomes pt-BR, rótulos de arrays/opções e datas de 24 horas, preservando nomes de API/enums. Coleções operacionais ficam readonly também na interface. Lint/typecheck e 17 unitários passaram após correção dos tipos discriminados do Payload; build/browser da apresentação atual aguardam repetição. Runtime/container configurado para America/Belem conforme [Node 22](https://nodejs.org/download/release/v22.23.3/docs/api/cli.html#tz); timestamps persistidos continuam ISO UTC.

### Ordenação por teclado — falha reproduzida e correção

A nova verificação de Space → ArrowDown → Space encontrou falha funcional, apesar de axe e salvamento simples passarem. Reproduzida com pausas entre teclas. Diagnóstico temporário no navegador descartável (não incorporado ao produto) mostrou coordenadas de destino corretas e body com overflow hidden/auto, scrollTop 0 e área maior que a viewport; a rolagem real estava no html. O sensor saía depois de tentar rolar o body sem efeito.

Ajuste de CSS administrativo: overflow-x:clip / overflow-y:visible deixa somente o documento como ancestral de rolagem. O diagnóstico confirmou a inversão das linhas com o sensor nativo; ensaio completo sem instrumentação ainda necessário. O teste agora aguarda o deslocamento renderizado antes de soltar, sem sleep fixo e sem reduzir os critérios. Sem alteração do domínio ou das permissões. Referência técnica: [CSS Overflow](https://www.w3.org/TR/css-overflow-3/#valdef-overflow-clip), especificação em desenvolvimento; resultado funcional depende da evidência no navegador.

A imagem com worker passou em fila sintética vazia: heartbeat, usuário não root e timezone America/Belem confirmados, sem disparo externo. Restauração com as tabelas e perfis atuais também passou. A imagem identificada no relatório precede este ajuste CSS, sem diferença nos scripts de infraestrutura testados.

### Rodada sem instrumentação concluída

Correção de rolagem confirmada no build: 20 telas editoriais sem falhas axe/JS/overflow, ordenação real por teclado e gravação da ordem/título como rascunho, preservando conteúdo e título publicados. Relatório registra `keyboardSorted` e `nativeDraftSaved`. [Relacionamento](../artifacts/qa-relationship/results.json) ampliado para 84 screenshots em dois temas/seis larguras, incluindo confirmação por POST, PDF privado, descadastro e erro. [Site público](../artifacts/qa-phase1/results.json): 170 screenshots novamente aprovados após os refinamentos. A instrumentação temporária de diagnóstico foi removida e não faz parte do produto.

Revisão funcional adicional encontrou perda do código c quando um endereço histórico de livro redirecionava ao slug novo. Isso poderia remover o contexto afiliado. O redirect agora preserva exclusivamente c (inclusive duplicatas, que continuam indisponíveis), sem encaminhar parâmetros arbitrários. Dois testes unitários acrescentados; 19 unitários, lint e TypeScript passaram. Regressão HTTP com renomeação/afiliado está em execução; não confundir com o teste anterior sem esse caso.

A regressão HTTP passou no novo build standalone isolado: endereço antigo mantém campanha e CTA afiliado, descarta parâmetro de destino arbitrário e preserva duplicatas de c para que continuem inválidas, sem fallback para oferta própria.

### B06 — supressão operacional em implementação

Objetivo: aplicar descadastro, bounce permanente e complaint revisados pelo proprietário, com idempotência e auditoria, sem liberar consentimento por importação. Usar as coleções operacionais existentes; impedir entregas pendentes nos dois últimos casos e preservar amostra solicitada no descadastro de marketing. Testar concorrência, repetição, conflito de referência, contato ainda desconhecido, permissões e origem. Esta entrada não significa sincronização com Brevo: o fallback é revisão manual e nenhuma chamada externa está autorizada por este ensaio.

Implementados serviço transacional, endpoint owner/origem exata, CLI stdin e view administrativa pelo ponto suportado de [custom views do Payload](https://payloadcms.com/docs/custom-components/custom-views), consultado nesta data. Sem alteração de schema/migrações. Contato é relido após lock também na captura, para não usar estado de entrega anterior à supressão concorrente.

`test:marketing` passou com nove grupos, incluindo duplicata concorrente, conflito sem mutação, referência bruta ausente da auditoria, complaint preservado, bloqueio de contato desconhecido e amostra após descadastro. Nenhuma chamada externa. [Rodada administrativa de supressões](../artifacts/qa-suppressions/results.json): 36 screenshots (inicial/erro/sucesso × dois temas × seis larguras), sem axe/JS/overflow; falha mantém entrada e referência, repetição por teclado aplica bloqueio e sucesso limpa endereço. API anônima 403, view redireciona ao login, Origin ausente/externa 403, corpo inválido/excessivo 422, repetição idempotente e conflito rejeitado. Capturas mobile claro e escuro inspecionadas visualmente.

A primeira tentativa do ensaio verificou a URL antes do redirect assíncrono do Next e falhou; a versão corrigida aguarda a navegação ao login explicitamente. TypeScript apontou união de headers no novo script e foi corrigido. Build e lint passaram; 21 unitários passaram antes da inclusão da view. Revalidação final de tipos registrada separadamente. O aviso de depreciação do pg permanece observado; nenhuma supressão na conta externa ou envio real foi realizado. Campanhas promocionais e sincronização automática permanecem pendentes.

TypeScript final e empacotamento das CLIs passaram. Entrada inválida na CLI empacotada de supressão retorna erro sem ecoar endereço/referência.

### Recuperação administrativa pelo operador — em implementação

Objetivo: recuperar o único owner por CLI privada, sem depender de e-mail público ou habilitar transporte. Senha nova deve atender aos limites do provisionamento, endereço deve corresponder ao owner existente, sessões e tokens anteriores devem ser revogados, bloqueio de login deve ser limpo. Verificar senha antiga/novo login/token antigo via HTTP e não criar conta nem expor credenciais na saída. Recuperação por e-mail permanece separada e pendente; referência oficial consultada: [operações de autenticação Payload](https://payloadcms.com/docs/authentication/operations).

Implementada CLI e serviço de recuperação pelo operador. O primeiro ensaio encontrou processo ainda aberto após destroy do Payload; somente o filho identificado foi encerrado, permitindo limpeza da fixture. As duas CLIs novas agora encerram explicitamente após fechar recursos; o teste tem timeout limitado e aguarda close dos pipes. Ambas as entradas empacotadas recusaram JSON inválido sem eco de dados e encerraram no prazo.

[Recuperação administrativa](../artifacts/admin-recovery/local-results.json) passou no novo standalone: forgot/reset públicos 503 genérico igual para conta existente/inexistente, sem criar token; unlock público 403. CLI recusou senha curta e contato desconhecido; troca válida removeu sessões, token/expiração de recuperação, cooldown e lockout. JWT anterior retornou sem usuário, senha antiga 401 e senha nova 200; owner único preservado. Nenhuma senha/token/endereço no artefato e nenhuma chamada externa. Build, lint e TypeScript passaram; empacotamento inclui recover-admin/apply-suppression, ainda sem nova imagem homologada. CI preparado para o teste HTTP de recuperação, não executado no GitHub.

`test:marketing` ampliado passou com dez grupos. Inclui confirmação ainda pendente anterior ao descadastro (amostra entregue sem inscrição) e captura/supressão simultâneas (um contato, nenhuma entrega liberada). O trace do aviso pg aponta pg 8.20.0/Drizzle; continua pendente identificar/remover concorrência antes de atualização para pg 9. Não ignorar o aviso nem atribuir causa específica ainda sem evidência.

Fechamento local desta rodada: `bash scripts/check-local.sh` passou com TypeScript, lint, 22 unitários e validação documental (44 documentos/76 pares de contraste; hashes históricos preservados). API de supressão anônima conferida no último build: 403 genérico com requestId. Script de container teve sintaxe Python verificada; isso não substitui reconstrução/teste da imagem com as novas CLIs. Próxima frente: calendário e conteúdo manual revisado das sequências promocionais, supressão no provedor e depois B07–B13. Objetivo completo segue em desenvolvimento, sem deploy, envio externo ou resultado comercial.

### B06 — calendário promocional em implementação

Objetivo R09/R10: cadastrar manualmente quatro mensagens revisadas, matricular somente opt-in efetivamente confirmado e criar calendário durável D+2/D+4/D+7/D+10, único por contato/material/versão. Preservar snapshot do conteúdo, não repetir após cancelamento/conclusão, cancelar ao descadastrar e revalidar material/assinatura/oferta antes de liberar a etapa. Acrescentar migração aditiva e testes com relógio controlado, concorrência e permissões. Esta etapa prepara o domínio; agrupamento por tema/dia, quota promocional e API de campanhas continuam necessários antes de qualquer disparo. Nenhuma promoção usa SMTP transacional.

Migração aditiva `20261021_233105_sequences` aplicada somente no PostgreSQL local. Coleções privadas, snapshot revisado por inscrição, chaves únicas de material/versão e inscrição/etapa, revisão inteira e índice de conferência. Não houve reset do banco ou edição de migrations anteriores. O down gerado foi ajustado antes de aplicar para remover dependências na ordem correta; não foi executado. CLI de preparação e ciclo do worker atualizam elegibilidade local, sem promoção externa. Contexto de campanha fica no snapshot; oferta realocada a outro livro ou campanha afiliada incompatível retém a promoção.

Primeira rodada de domínio passou com sete grupos: consentimento, datas, snapshot, revisão, repetição, oferta/campanha, cancelamento concorrente, versão e permissões. 25 unitários passaram. O primeiro hook precisou distinguir criação por originalDoc.id, pois Payload fornece objeto vazio na criação; os testes negativos agora conferem a mensagem esperada. TypeScript apontou key requerida no input do fixture e import de Where removido por engano; corrigidos. Tipos passaram antes da última mudança de proteção de arquivo. Lint sem erros, com dois avisos de parâmetros não usados na migration gerada.

O ensaio seguinte acrescentou prova byte a byte e encontrou que recusar substituição da mídia em beforeChange ainda permitia ao Payload remover o arquivo anterior. O guard foi movido a beforeOperation, antes de generateFileData. Fonte instalada 3.91.0 inspecionada; locks são compartilhados com a associação da amostra. Essa correção está em novo ensaio; não declarar integridade ou rodada visual atuais aprovadas até os resultados. A fixture sintética da tentativa falha foi limpa. Há também build isolado em execução para validar cadastro nativo, painel e regressão do checkout.

Ensaio final de domínio passou: PDF original preservado byte a byte após troca recusada; metadado continua editável, livro não muda sob a mesma versão e versão já solicitada não pode ser reutilizada. Sete grupos de calendário novamente aprovados, sem chamadas externas; o aviso pg permanece. TypeScript passou antes da movimentação do guard para beforeOperation; build e QA renderizado continuam pendentes. As fixtures foram limpas, com contagens operacionais/owner zeradas e nenhuma espera de lock no banco local.

Regressão `test:marketing` passou novamente, dez grupos. Contratos atuais de contatos, bloqueio e campanha consultados enquanto o build prossegue; achados e lacunas em [Brevo](integracoes/brevo.md). Nenhuma configuração externa criada ou notificação autenticada presumida. Compilação webpack concluiu em 7,8 minutos neste ambiente; TypeScript e conclusão do build ainda estão em execução.

Build passou (TypeScript em 5,5 minutos). Diagnóstico de CPU/processos identificou vários filhos payload/bin.js generate:types iniciados repetidamente pela prévia gerenciada. Geração automática desativada pelo campo suportado; geração explícita passou, prévia respondeu readiness 200 e contagem posterior encontrou zero filhos automáticos vivos. Servidor gerenciado preservado. Geração do import map e TypeScript da apresentação nova também passaram.

Primeira rodada visual completou 48 telas e cadastro nativo real da sequência. Falhou em nove combinações: overflow de sequência/inscrição a 360/390, alvo pequeno do combobox/limpar a 360 e contraste do JSON a 768. Nenhum erro JS. Inspeção visual também mostrou editor JSON cortado/sobrepondo campos. Campo server de leitura estruturada substitui esse editor, com etapas em disclosures e conferência técnica secundária. Chaves internas dessas duas coleções ficam fora do formulário. Schema/snapshot e permissões permanecem iguais.

Diagnóstico descartável com título dos breadcrumbs já carregado mostrou nav/account fora da viewport. CSS temporário no navegador confirmou largura final 360/390 e axe sem violações com min-width dos wrappers, rolagem do breadcrumb e alvos de seleção maiores. Essas regras foram incorporadas ao stylesheet; rodada definitiva sem injeção ainda necessária. O arquivo temporário será removido após o ensaio. Nenhuma regra axe desativada.

Novo build passou com webpack 15,3s/TypeScript 9,2s, depois de estabilizar a geração de tipos. Primeira tentativa seguinte não iniciou fixtures porque PostgreSQL local estava parado (exit 0). Mesmo container/volume reiniciado e pg_isready aprovado. Rodada definitiva de calendário passou: cadastro nativo, 48 telas e leitura por etapa, sem axe/JS/overflow; nenhuma chamada externa. Revisão complementar focada passou em 12 telas, com abertura por teclado e captura a partir do topo para evitar artefato de stitching dos controles sticky. Regressão HTTP test:site também passou.

Regressão editorial: as 20 telas passaram, mas o teste de ordenação falhou na espera de transformação. Diagnóstico posterior confirmou troca real de ordem após a rolagem assentar e revelou smooth forçado pelo KeyboardSensor mesmo sob reduced-motion; também há instalação assíncrona do listener. Patch UI existente ampliado com scrollBehavior:auto nos módulos individual e prebundle, preservando os 13 arquivos já modificados. Teste mantém exigência de transformação, ordem e rascunho publicado separado; aguarda frames de readiness e verifica rolagem reduzida estável. Novo runtime ainda precisa de revalidação. Nenhuma instrumentação será incorporada ao produto.

Pendência específica R22/B12: o helper nativo de atualização remove arquivos anteriores antes dos hooks de validação. A mídia vinculada à amostra já está protegida antes dessa etapa e teve prova byte a byte. Antes do release, homologar também substituição recusada/rollback de mídias não vinculadas a amostra, preservando seus bytes anteriores; não interpretar o ensaio de PDF vinculado como cobertura de todo esse fluxo.

### Fechamento local do calendário e regressão editorial

O primeiro runtime após ampliar o patch UI retornou 500 na listagem (SortColumn/useListQuery). O build isolado foi preservado em pasta local ignorada e reconstruído do zero, mantendo intacta a prévia gerenciada. A causa específica do primeiro runtime não foi confirmada. No novo build, a regressão editorial completa passou: 20 telas sem axe/JS/overflow, troca real da ordem por teclado, salvamento nativo em rascunho e preservação da ordem/título publicados. O relatório registra keyboardSorted, nativeDraftSaved e reducedMotionScrollStable verdadeiros; nenhuma instrumentação foi usada no produto.

Revisão visual das capturas complementares de inscrição a 360px claro e 1440px escuro confirmou leitura das etapas e foco visível, sem o artefato anterior de stitching. A rodada completa do calendário mantém 48 telas aprovadas; a complementar possui 12. CLI promotions:prepare executada na fila local vazia retornou examined/ready/canceled/held iguais a zero, sem transporte externo. B06 permanece parcial: agrupamento, quota promocional, sincronização de supressões e campanhas ainda necessários. Imagem atualizada, homologações externas e produção não comprovadas.

### B06 — quota compartilhada em validação

Objetivo R09/R10: reutilizar a contabilidade existente e seu lock por dia para reservar destinatários de forma indivisível, mantendo capacidade para confirmações/amostras. Serviço transacional passou a usar a política comum; reserva promocional disponível somente como operação interna, sem transporte ou novo job. Sem mudança de schema/migration. Configurações locais/Compose e documentação atualizadas; não altera .env.local existente ou habilita envio. Testes de política e concorrência/rollback/virada UTC em execução. Agrupamento e homologação externa continuam pendentes.

Validação local aprovada: 29 unitários, tipos e lint (dois avisos já registrados na migration), documentação e 11 grupos integrados de relacionamento. Vinte reservas promocionais concorrentes disputaram sete vagas, seguidas de oito transacionais disputando três: contagem final 10, sem exceder o teto. Lote que não cabe é recusado inteiro; rollback desfaz reserva, virada UTC cria orçamento independente, timeout retém uma única reserva e retomada não duplica envio/capacidade. API anônima não lê quota e owner não consegue zerá-la pelo fluxo comum. Nenhum destinatário externo. Compose validado com placeholders sintéticos, sem iniciar serviços. CLIs reempacotadas; build final desta alteração registrado após conclusão.

Build final passou: webpack 18,3s, TypeScript 16,7s e standalone gerado. Conferência HTTP autenticada da listagem de livros retornou 200 nesse build, com owner/livros sintéticos removidos ao final; não reproduziu o 500 da tentativa anterior. CLI empacotada atual de preparação retornou quatro contagens zero na fila vazia. Script descartável de conferência removido, servidor isolado encerrado; nenhuma alteração na VPS ou envio externo. Próxima ação é agrupar etapas elegíveis de forma durável e aplicar a reserva junto ao claim do lote, antes do transporte de campanhas e sincronização externa. O objetivo completo segue aberto; pendência de integridade de mídia não vinculada e B07–B16 permanecem no backlog.

### Consolidação documental solicitada pelo proprietário — 21/10/2026

A continuação de agrupamento fez somente leitura/análise antes do novo pedido: nenhum lote, schema ou job promocional foi criado. Nesta entrega foram conferidos código, contratos, relatórios e metadados locais, e consolidado o [estado atual](23-estado-atual.md), com matriz R01–R34, estado B01–B20, evidências, sete migrations, comandos, limites e sequência de retomada. Corrigidas descrições documentais superadas sem modificar código da aplicação ou migrations. Exemplo de produção alinhado à reserva transacional já existente. E-mail público, GitHub e deploy permanecem conforme decisão do proprietário.

As sete migrations foram encontradas aplicadas; contagens consultadas de owner, contatos, sequências, inscrições e etapas eram zero. Nenhum serviço iniciado/parado nesta revisão, nenhum dado de comprador ou segredo registrado, nenhum teste da aplicação reexecutado. Verificação documental e hashes históricos em [validação](18-validacao.md); inventário em artifacts/documentation. Próxima ação de desenvolvimento continua B06: agrupamento durável e claim junto à quota, seguido de sincronização/campanhas e demais frentes pendentes.
