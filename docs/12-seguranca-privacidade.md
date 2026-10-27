# 12 — Segurança e privacidade

[Índice](../README.md) · [Interfaces](06-interfaces.md)

Este documento define controles de engenharia e escolhas conservadoras do produto. Não substitui a definição das obrigações concretas do responsável pelo negócio. Políticas públicas precisam de nome do responsável, contato e fornecedores reais antes de publicação.

Estado técnico documentado em 26/10/2026 (D114): acesso privado, validação de uploads, tokens, consentimento e supressão possuem testes locais; não é aceite integral de segurança. P07 cobre retenção analítica/auditoria, expiração de pedidos de amostra e links de preferências, envelope da inbox comercial resolvido, expiração de amostras confirmadas antigas, exportação/exclusão, correção owner que preserva relações/consentimentos locais, inventário agregado e tombstone HMAC de supressão. Retenção ampla de relacionamento/comércio, conciliação de identidade já vinculada a serviço externo e homologação externa da recuperação permanecem pendentes. D108 validou replay v2 e retomada HTTP limitada após restore físico na imagem D107. D106 validou replay v2 após pg_restore físico local em banco isolado; telemetria automática do Payload desativada na configuração. A flag diária `DATA_RETENTION_ENABLED` é falsa por padrão. Proteção administrativa do host e integrações reais também estão pendentes. O e-mail público continuará vazio até produção, por decisão do proprietário. A preservação de mídia em troca recusada/rollback foi corrigida e testada localmente, com exclusão física diferida; homologação da imagem e do ambiente real permanece pendente. Ver [estado atual](23-estado-atual.md).

## Acesso e superfície

Administrador único `owner`, sem criação pública de conta. Sessão HttpOnly, Secure em produção e política SameSite apropriada; expiração e recuperação testadas. Rate limit no login e recuperação com mensagens genéricas. Priorizar MFA via mecanismo compatível comprovado; não presumir que esteja incluído no CMS. Enquanto não houver MFA homologado, restringir administração por VPN ou allowlist operacional documentada, mantendo rotas públicas acessíveis.

Permissões deny-by-default em coleções e campos. Público só lê projeções publicadas; ninguém fora de serviços internos escreve transações/inbox. Testar REST, GraphQL se habilitado e Local API. Desabilitar GraphQL se não utilizado. Acesso a jobs via APIs internas autorizadas, nunca endpoint público genérico.

## URLs, conteúdo e uploads

Checkout HTTPS com host exato aprovado por operador; validar hostname real, não substring. Domínio de checkout/afiliado deve ser confirmado por provedor/conta. Não buscar URL arbitrária no servidor. Links editoriais externos abrem com proteção adequada; rich text sanitizado, sem scripts ou HTML executável livre.

Uploads: imagens JPEG/PNG/WebP até 5 MiB; PDF gratuito até 20 MiB, magic bytes e extensão verificados, nome aleatório, sem SVG/HTML executável. Reencodar imagens e remover metadados; PDF servido como download com MIME e nosniff. Rejeitar travessia de diretório e arquivos fora de finalidade. Livros pagos completos e kits internos não entram no bucket/volume público.

CSP e headers ajustados/testados ao Next/Payload, não copiados cegamente; nunca enfraquecer globalmente CSP só para preview. Segredos segregados por ambiente e fornecedor, rotação registrada. HMAC/token verifica autenticidade conforme contrato real; IP allowlist isolada não prova origem.

## Preservação e limpeza de mídia

D47: o patch opt-in de Payload 3.91.0 impede a exclusão física antecipada na coleção Media. Substituições usam UUID novo; falha na validação, em hooks ou rollback conserva o arquivo anterior. Mídia vinculada a amostra continua exigindo novo cadastro/versão. Campos técnicos não podem ser alterados sem upload validado.

A coleta de órfãos consulta referências atuais sob o mesmo advisory lock das mutações. Só remove arquivos regulares com nome UUID gerenciado, sem referência, após 24 horas da primeira observação persistida no índice privado do volume. Simulação não grava o índice nem inicia carência; arquivos desconhecidos e links simbólicos são ignorados. Índice inválido interrompe a coleta. Não é a rotina de retenção de dados pessoais de B12.

O backup diário do atualizador confirma o snapshot externo antes de executar a coleta, com app/worker parados; falha retorna erro e tenta retomar a aplicação. Monitorar contagens, falhas e espaço do volume. Procedimento no [guia](../deploy.md). Prova local: [seis grupos de integridade](../artifacts/media-integrity/local-results.json); sem backup externo realizado nesta rodada.

## Consentimento e minimização

Captura pede só e-mail e material; marketing com checkbox separado desmarcado, finalidade e link de privacidade. Guardar versão do texto e ação. Analytics opcional com aceitar/rejeitar equivalentes e revogação acessível. Sem consentimento analítico, não criar ID persistente nem cookie de atribuição; compra permanece funcional.

Compra externa não autoriza newsletter. Não armazenar CPF, telefone, endereço ou e-mail de comprador vindo do webhook quando não necessários. Informar plataformas de checkout e provedor de e-mail no aviso. Decisão sobre base legal e transparência deve considerar operação concreta, tomando como referência [orientação da ANPD sobre cookies](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais).

## Bloqueios do provedor e quota promocional

D50: claim interno exige preflight autenticado recente de todos os destinatários elegíveis, sem HTTP durante locks de banco. Conferência privada de até cinco minutos vincula lote e versões locais; alteração/expiração/ausência/falha impedem reserva de quota. Observação de blacklist gera action própria, sem atribuir causa não documentada, e cancela marketing atomicamente. Não reativa contatos, não cria endereço a partir de payload e mantém amostra solicitada independente quando não há bounce/complaint conhecidos. Entrada pública/manual não pode fabricar observação autenticada.

A conferência é pontual. Revalidação no envio D56 e callback autenticado D58 existem localmente; homologação externa permanece pendente. Nenhum envio promocional real autorizado por teste sintético. Ver [Brevo](integracoes/brevo.md) e [evidência](../artifacts/provider-preflight/local-results.json).

## Retenção inicial de produto

Prazos abaixo são defaults operacionais a validar antes da coleta; não representam prazo legal universal.

| Dado | Política inicial |
|---|---|
| Pedidos não confirmados | Excluir em 7 dias; tokens expiram em 24h |
| Pedidos confirmados | Expirar após 24 meses sem alteração recente; preservar prova de opt-in ativo, sequência dependente e envio pendente/incerto |
| Eventos de visitas/cliques identificáveis | 90 dias, depois agregados sem identificadores |
| Inbox mínima processada | 90 dias; preservar ledger normalizado necessário |
| Logs técnicos | 14 dias; sem PII; chaves de rate limit até 24h |
| Contatos ativos | Revisar após 12 meses sem interação útil; renovar interesse ou excluir |
| Descadastrados | Retirar dados de marketing em até 30 dias; conservar supressão global pseudonimizada por 12 meses e fato temático por 24 meses para impedir reativação automática. Dependências pendentes exigem conciliação documentada |
| Consentimento/auditoria | 24 meses inicialmente para registros encerrados; pedidos pending preservados até resolução, com revisão operacional e acesso restrito |
| Transações mínimas | 24 meses operacionais; obrigações contábeis específicas definidas com responsável, fora do marketing |
| Backups | 7 diários, 4 semanais, 3 mensais; exclusões reaplicadas na restauração |

O worker pode executar diariamente retenção analítica, auditoria de pedidos e expiração de amostras não confirmadas quando `DATA_RETENTION_ENABLED=true`; a flag permanece falsa até revisão da política/ambiente. `npm run analytics:retention` apresenta prévia sem escrita; `npm run analytics:retention -- --apply` agrega page views/saídas com mais de 90 dias por dia UTC e dimensões de negócio controladas, na mesma transação em que apaga cada evento-fonte. Caminho agrega somente a família pública (`/ebooks`, `/artigos`, `/temas`, `/amostras`), sem slug. Contextos de atribuição são limpos após a janela de 30 dias. Depois remove visitas expiradas sem eventos vinculados, apaga permissões expiradas sem visitas e limites vencidos. `npm run privacy:retention` apresenta prévia; `--apply` remove auditorias de pedidos/comerciais anteriores a 24 meses, envelopes elegíveis da inbox após 90 dias, pedidos de amostra não confirmados há mais de sete dias, tombstones vencidos e tokens de preferências expirados após 24 horas. A expiração de tokens revalida o vínculo sob o lock do contato compartilhado com preferências/descadastro e roda antes da avaliação de contatos sem outras referências. A auditoria comercial só expira quando o inbox está resolvido, não conflitado e a transação não exige revisão; pendências e referências incompletas são preservadas sob lock da conta. O cleanup trava o contato compartilhando o lock com confirmação/envio, remove outbox pendente e evento de solicitação atomicamente, mas retém pedido se houver envio `sending/uncertain`; contato só é removido se não houver outras referências nem estado de supressão. Relatórios contêm apenas cutoff/contagens. Os agregados analíticos não guardam UUID de visitante, permissão ou clique. D98 acrescenta tombstones HMAC de supressão com expiração de 12 meses, em coleção sem FK para contato; descadastro global e bloqueios os criam, e novo opt-in confirmado os remove. As impressões dependem da estabilidade de `LEAD_TOKEN_SECRET`; rotação exige migração coordenada enquanto houver tombstones válidos. Fora a expiração seletiva dos envelopes da inbox D101, continuam pendentes a retenção ampla de relacionamento/comércio, fatos/evidências/decisões e a reaplicação após restore.

O contato de privacidade e seu procedimento devem permitir verificar identidade proporcionalmente, localizar dados, exportar/corrigir/excluir conforme necessidade e registrar conclusão. D93 implementa exclusão owner local, estrita e transacional, após declaração operacional de identidade e confirmação explícita; D94 verifica o endpoint HTTP no build standalone, inclusive cabeçalhos `no-store`/`no-referrer`. Exclusão retorna `pending` sem apagar dados quando há envio ou dependência externa a conciliar. D95–D96 implementam correção owner que preserva relações e consentimentos locais, invalida confirmações pendentes e retorna `pending` quando existe envio incerto, identidade Brevo ou manifesto externo. A auditoria HMAC por 24 meses bloqueia recriação pelo endereço anterior. Exclusão/correção locais não removem cópias no provedor nem reaplicam decisões após restore. Supressão pseudonimizada continua protegida, não é anonimização. Retenção abrangente de contatos, consentimento, mensagens/inbox, evidências e decisões comerciais permanece pendente. Os prazos são defaults operacionais e precisam de revisão do responsável antes de coleta real; não são prazo legal universal.

## Critérios antes de coletar dados reais

Responsável e contato definidos; avisos publicados; consentimento testado; administração protegida; backup/restauração; supressão; retenção; logs sanitizados; contrato de e-mail verificado. Não marcar esses controles como prontos só porque estão documentados.


D58: webhook de marketing autentica com Bearer antes de leitura/banco; token não deve aparecer em URL/logs/Git. Token de entrada, HMAC de eventos e segredos de sessão/links são independentes. HMAC local não é assinatura do provedor. Envelope não duplica email ou corpo; liga somente contato já existente. Comprovação por etapa exige impressão de identidade histórica capturada antes do envio. Endereços alterados/legado sem prova ficam em quarentena. O descadastro nativo é retirada global local; link próprio permite preferências por assunto. Notificação positiva jamais restaura consentimento ou apaga reclamação/devolução. Retenção/exclusão/restore de supressões permanecem B12, sem operação real autorizada por testes.


D59: medição própria depende de flag e aviso institucional revisado, com consentimento separado do marketing. Sem aceite não se cria identificador analítico; recusa usa preferência não identificável. Permissão opaca fica em cookie HttpOnly/Secure, hash no banco, expira em 180 dias, sem renovação silenciosa. Revogação e coleta compartilham lock, e novo aceite não reaproveita cookie revogado. Há formulário nativo de retirada sem JavaScript, com origem validada e retorno fixo à privacidade. Sem JS não há medição de páginas; saída de checkout pode ser operacional ou usar permissão previamente concedida até sua retirada.

Não são armazenados IP, user-agent, referer, query completa, email ou identidade de comprador. Só caminhos públicos reais e códigos cadastrados/revisados; UTMs livres/aparentes dados pessoais não são fonte analítica. Sessão de 30 minutos inativa e janela de 30 dias não provam pessoa única ou compra. Retenção/exclusão de permissões, sessões, eventos e contadores em B12 continuam pendentes; não ativar para operação real antes de rever políticas/contato, retenção e release.

## Assinatura Kiwify em query — D64

Token privado não é transmitido, mas signature permite replay do mesmo corpo: excluir query/URL completa de logs do proxy/APM antes de ativar a recepção. Aplicação nunca registra corpo, assinatura ou token. HMAC é validado em tempo constante nos bytes, com leitura limitada; assinatura sozinha não prova frescor, venda única ou liquidação. Dedupe/colisão/namespace da inbox protegem o histórico. Segredos apenas no app; worker não precisa dos tokens. [Contrato](integracoes/kiwify.md).

## Cakto — D65

Exigir HMAC-SHA256 com timestamp e janela de cinco minutos; não aceitar apenas secret no corpo. Segredo é enviado pelo fornecedor no JSON, portanto excluir corpo e headers de autenticação de logs/APM/debug, usando HTTPS. Verificar bytes antes do parse/Payload; nenhuma credencial/PII fica nos recibos, colisões ou respostas. Corpo/lote limitados; validação integral antes do banco e rollback integral evitam ACK parcial. Abandono não usa email para dedupe, não cria contato e não representa métrica de compradores. [Decisão e contrato](integracoes/cakto.md).

## Arquivo CSV da prévia — D66

Não persistir CSV bruto, filename livre, credenciais, compradores ou valores inválidos. Resposta privada sem cache; somente owner/origem exata antes de ler o corpo. UTF-8/limites/cabeçalho exatos, erros sanitizados e consultas com campos mínimos. Não registrar corpo/Authorization em proxy/APM/debug. Classificações e hash não conferem autorização de escrita; confirmação durável é futura. Helper de planilha neutraliza fórmulas em texto, sem oferecer download nesta etapa. [Contrato](24-conciliacao.md).

## Custódia de importação — D67

Fonte/referência/razão controladas e ator do Payload, nunca de body/header arbitrário. Invalidar CSV com linha pessoal/inválida antes de persistir; normalized é whitelist/hash/manifesto revalidado. Hash do plano é concorrência otimista, não credencial. Owner/origem e confirmed=true em JSON limitado; dados, decisão e ator não são escolhidos pelo cliente. API direta das três coleções nega escrita, preservando trilha. Arquivo bruto/nome original e credenciais não são guardados/logados. [Contrato](24-conciliacao.md).

## Provas de resolução financeira — D74

Decisões/aplicações financeiras são privadas, somente leitura para owner, sem escrita nativa e com origem exata no endpoint de confirmação. Referências de fonte são aliases controlados: nunca anexar CSV, dado de comprador ou credencial à decisão. Logs/APM/proxy não devem registrar corpo/Authorization. Snapshots contêm apenas evidência interna normalizada e referências operacionais já presentes; não representam autorização para ampliar a captura.

A imutabilidade técnica preserva a trilha, mas não define prazo jurídico de retenção. P07 deve incluir cobertura/snapshots, autoria e referências dessas duas coleções ao implementar retenção, minimização e pedidos de dados, com política revisada e ensaio de restore. Não remover provas por helper de fixture fora do banco sintético exclusivo. Homologação de segurança/privacidade do release segue aberta.

## Evidência complementar — D75

Coleção commercial-report-evidence entra no escopo da retenção/P07: autoria, aliases da fonte/linha, IDs operacionais, entrada canônica e vínculos de substituição. API exige owner/origem exata; nega conteúdo extra/dados pessoais nos aliases e não guarda documento externo bruto. Imutabilidade técnica não define prazo jurídico nem substitui política revisada. Prova/decisão não deve incluir endereço de documento, token ou comprador. Aplicam-se os limites de logs/APM e restore sem reativação descritos acima.

## Interfaces de conciliação e financeiro — D79–D81

As views owner usam a sessão Payload e leituras com acesso das coleções; GET não confirma lotes. Mutações continuam nas APIs existentes com origem exata, chaves estritas e revalidação em servidor. planHash é controle de concorrência e não autorização. Arquivo e nome livre permanecem apenas no formulário em memória; a aplicação não os coloca em localStorage, Media ou logs. Lotes preservam somente dados normalizados permitidos, fonte/autoria e auditoria. O cabeçalho para download não contém registros de comprador.

A tentativa de preparação conserva a Idempotency-Key em memória enquanto entrada não muda. Abort/timeout do navegador não implica rollback no servidor; a interface avisa resultado incerto e permite retomar o lote, sem confirmar aplicação ou dinheiro. Não inserir arquivo/Authorization em proxy/APM/debug. Capturas da QA usam apenas fixtures e bloqueiam requisições externas.

P07 inclui também evidências de liquidação e custos D78, autoria, referências e vínculos de substituição. A trilha imutável não define prazo de retenção e não encerra política, exclusão/exportação ou restore. H06 e o aceite integral de privacidade permanecem abertos.

D81: o formulário de liquidação/custo mantém a entrada somente em memória, não grava por GET/conferência e usa os endpoints owner/origem exata D78. Referências de fonte/linha permanecem estáveis em timeout; o ator vem da sessão. Campos fixados na correção são também revalidados no servidor, e a coleção/SQL preserva originais. O histórico não expõe token, comprador ou documento externo. campanha do custo é relacionamento interno explícito, sem atribuição de receita inferida. Nenhum segredo, cookie ou integração externa novo foi acrescentado.

## Interface de decisão do catálogo — D82

A view exige owner antes de consultar os dados e usa overrideAccess=false/req. POSTs mantêm sessão/origem, validação e revalidação D72. Entrada, prévia, fonte e UUID idempotente ficam apenas na memória do formulário; não há armazenamento local ou escrita por GET. Hold não atesta evidência, e nenhum controle permite editar fatos ou a trilha imutável. Falha de rede mantém o envelope para repetição exata, sem criar chave silenciosamente. Fonte é alias controlado; não colar dados pessoais. As capturas usam somente fixtures sintéticas.

## Decisão financeira visual — D83

View owner verifica sessão antes de ler coleções privadas ou cabeças financeiras. Dados e escolhas ficam somente na memória do formulário; nenhum armazenamento local ou GET aplica decisão. POSTs existentes exigem owner/origem, escolhas estritas, atestação, fonte/motivo, idempotência e revalidação transacional. Formulário exige cobertura explícita e não preseleciona variantes. Hold não confirma fatos; reaproveitar uma chave após perda de resposta não altera a entrada. Prova/aplicação completas em JSON usam endpoints privados do Payload com depth=0, sem ampliar acesso. Fixtures e capturas permanecem sintéticas.

D84 preserva autorização owner/origem e snapshot financeiro somente leitura. Quarentena não é removida por filtragem de estado ou coorte; ausência de data não é inferida. Contas/moedas não são combinadas em cobertura e aritmética usa BigInt com limite explícito, sem emitir números arredondados. Taxa só é publicada com cobertura integral; nenhuma janela externa ou identidade de comprador foi introduzida.

D85 mantém owner/origem e snapshot somente leitura. Busca de metadados é limitada/em blocos; títulos/códigos são somente rótulos privados. Nenhuma referência de clique, custo, e-mail/IP ou coincidência temporal vira atribuição. Revisão não concede livro efetivo/campanha confirmados, e lastSuccessAt histórico não limpa revisão. Paginação GET não grava nem muda prova. Sem novos campos persistidos, segredo ou flag.

D86 reforça evidência dos guards existentes: anônimo é recusado nas cinco views; origem/fonte/ator e chaves continuam nos contratos protegidos. Lote inválido/misto/futuro/nativo não suportado é recusado sem persistir prefixo válido; prova incompatível não gera transação por simples atestação. Falha após gravação das provas reverte a confirmação inteira; reimportação não duplica valores. Fixtures/arquivos/capturas sintéticos são limpos. Nenhuma capacidade, segredo, campo persistido ou permissão nova.

D87 usa somente UUID aleatória de saída consentida no parâmetro `sck`; não envia token de consentimento, sessão, UTM livre ou identificador pessoal. Callback persiste a referência apenas se ela for UUID; relatório exige o registro interno e contexto compatível. Nenhum dado de comprador é lido para essa associação. Os registros continuam sujeitos à retenção/exclusão integrada de P07, ainda não implementada; consentimento não autoriza retenção indefinida.

## Exportação administrativa de titular — D90

A rota privada `/api/v1/admin/privacy/export` exige owner, origem exata e `identityVerified: true`. Essa flag é uma declaração operacional explícita; o operador deve verificar a identidade fora do sistema antes da chamada. A resposta usa `private, no-store` e `no-referrer`, pagina relações do titular (incluindo recibos ligados às etapas) e seleciona campos permitidos. Não exporta hashes de tokens, HMACs de destinatários, chaves internas ou payloads do provedor. A auditoria conserva impressão HMAC do email, ação, resultado, contagens, owner e instante, sem email nem conteúdo exportado. Analytics não possui vínculo de email e não pode ser localizado por endereço. A função é local e restrita; não substitui revisão jurídica, política de retenção da trilha ou fluxo de correção/exclusão.

D95–D96 adicionam `POST /api/v1/admin/privacy/correct`, com owner, Origin exata, declaração operacional `identityVerified: true` e confirmação `CORRIGIR`. A troca preserva relações locais e consentimentos. Pedidos ainda não confirmados são revogados e tokens invalidados; envios de confirmação só são cancelados quando ainda estão pendentes. Tokens antigos de preferência são removidos. Jobs Brevo pendentes sem tentativas acompanham o contato atualizado; um novo cadastro local é enfileirado somente para opt-in ativo e elegível. Envio `sending/uncertain`, job Brevo já tentado/concluído, webhook ou manifesto promocional externo bloqueia em `pending`, sem alteração parcial. Colisão e tombstone no destino também bloqueiam. Auditoria registra somente HMAC do endereço anterior, contagens, resultado, owner e instante, impedindo recaptura pelo fluxo de captura. O teste sintético verifica consentimento preservado, invalidação de confirmação, job reemitido com nova revisão, replay e bloqueio de entrega incerta. Contatos com identidade já conhecida pelo provedor requerem conciliação antes da correção.

D97 adiciona `npm run privacy:inventory`, que lê somente contagens por coleção e grupo; não inclui campos pessoais nem conteúdo. Não substitui retenção, resposta individual a titular ou restore. A integração foi exercitada em PostgreSQL sintético; ver [evidência](../artifacts/privacy-inventory/local-results.json).

## D102 — Expiração de amostras com prova preservada

O expurgo de amostras confirmadas aplica o default de 24 meses ao pedido, seu outbox encerrado e eventos vinculados antigos. Revalida datas, identidade e dependências sob o mesmo lock usado por confirmação/envio. Mantém pedido que prova consentimento vigente; uma assinatura posterior só libera o pedido anterior se existir evento de consentimento correspondente. Chaves de supressão não são apagadas, pois também deduplicam bloqueios e sua remoção poderia reaplicar evento antigo após um novo opt-in. Contatos e assinaturas atuais permanecem sujeitos às próximas regras de retenção P07. A rotina não consulta provedores, não envia mensagens e não implementa o manifesto pós-restore.

## D103 — Varredura da retenção sem bloqueio da primeira página

A paginação por ID avança inclusive sobre pedidos não confirmados que ficam retidos por envio em andamento/incerto. Todo o outbox do pedido é consultado antes de decidir pela remoção. Permanecem o cutoff de sete dias, os locks, a transação por pedido e a preservação dos estados incertos; não há nova política de retenção, migration ou ativação de flag. O teste com 100 pedidos retidos na primeira página confirmou expurgo posterior e repetição segura.

## D104 — Decisões de privacidade após restore

Manifesto privado assinado com HMAC de finalidade separada usa a chave de links estável do ambiente. Contém somente fingerprints, tipos de decisão, datas e restrições de entrega; exporta exclusões/correções concluídas e supressões ainda válidas. Precisa de proteção 600, cópia externa criptografada e atualização depois de alterações de privacidade ou novo opt-in. Não versionar nem incluir no diretório público; `.local/privacy` é ignorado por Git e pela imagem.

Replay exige owner restaurado, isolamento declarado, flags falsas, assinatura íntegra e janela do backup compatível com os três meses de retenção. Preview não escreve. Reaplicação não renova prazos, não reativa consentimento, não emite HTTP e não conclui envios incertos. Exclusões/correções elegíveis apagam cópias locais; dependências mantêm quarentena. Estados bounce/complaint são preservados e causa desconhecida fica para conciliação, sem inventar causa. Fonte do snapshot, guarda durável do manifesto atual, pedidos ainda pendentes e restore físico não são comprovados pelo ensaio local D104.

## D105 — Não esquecer pendências nem autorizar processamento novo

O manifesto v2 exporta pending sem prazo automático, preserva estado e data e não o converte em conclusão no restore. Auditoria pending não expira junto da trilha encerrada. O bloqueio é consultado antes da captura, confirmação, envio transacional, promoção e cadastro novo; uma entrada pending não concede consentimento nem autorização de transporte. Dados/identidade ficam disponíveis para a conciliação do owner. V1 mantém compatibilidade para completed e indica ausência de cobertura de pending no relatório.

O ensaio D105 confirmou recusa antes de transporte/quota, preservação de pendência com três anos e importação sem duplicação ou conclusão inventada. Chave indisponível interrompe a conferência sem modificar estado por uma supressão presumida. Registros sem FK para contato também bloqueiam recaptura. O responsável continua obrigado a revisar pendências, conciliar o provedor, guardar manifesto v2 atual fora do snapshot e homologar o restore físico.

## D106 — Restore físico local e privacidade — 26/10/2026

D106 validou backup criptografado e restore físico local das 32 migrations, com mídia íntegra e replay do manifesto v2 separado do snapshot; completed é reaplicado e pending permanece pendente. A telemetria automática do Payload foi desativada após a barreira de rede detectar sua tentativa. Imagem atual, guarda externa do manifesto/backup, RPO/RTO reais e release continuam pendentes. [Evidência D106](../artifacts/recovery/d106-results.json) Fonte, dump e destino usam somente fixtures sintéticas. Preview não escreve; repetição mantém prazos; amostra independente é preservada, bounce cancela pendência e identidade sem decisão não é alterada. Flags seguem falsas; sem conta real, VPS ou deploy.

## D107 — Imagem atual e upgrade local — 26/10/2026

D107 construiu a imagem local atual e verificou 32 migrations em banco vazio e upgrade real de 6 para 32, preservando contato e owner sintéticos. Saúde, HTTP interno, ACL, runtime sem root/read-only/DDL, CLIs de privacidade e worker de retenção passaram em rede Docker internal, sem saída para provedores. Corrigidos o encerramento das CLIs de inventário/retenção após a limpeza do Payload e a renovação do heartbeat no ciclo ocioso do worker de retenção. A imagem não foi publicada. Bateria funcional integral do release, restore físico nesta imagem, destino externo/RPO/RTO, contas e VPS continuam pendentes. [Evidência D107](../artifacts/container/d107-results.json). As sondagens HTTP rodam no loopback do container; não homologam proxy, TLS ou acesso da VPS. Replay v2 na imagem usa manifesto vazio; decisões reais de fixtures pós-snapshot ainda exigem o ensaio físico nessa imagem.

## D108 — Restore físico com a imagem atual — 26/10/2026

D108 aprovou restore físico com a imagem D107: 32 migrations, mídia íntegra, seis decisões de privacidade posteriores ao snapshot e replay v2 dentro da imagem. Preview, exclusão/correção, pending, supressão/bounce e repetição sem renovar prazos foram verificados. A aplicação só iniciou depois do replay, com credencial de banco separada e limitada: saúde/catálogo/capa responderam 200, contatos privados 403 e amostra privada na rota pública 404. Rede interna sem portas publicadas; transportes e worker desligados. Destino externo, guarda atual do manifesto, RPO/RTO reais, bateria integral e homologações continuam pendentes. [Evidência D108](../artifacts/recovery/d108-results.json). Não houve nova migration, rebuild, dado real, conta externa, VPS ou deploy; identidade sem decisão e entregas incertas foram preservadas.

## D109 — Retenção de estado promocional — 26/10/2026

D109 implementa retenção local de estado promocional para contatos globalmente descadastrados há pelo menos 30 dias: remove assinaturas encerradas e calendários cancelados com etapas antigas, sem lote. Preserva identidade, amostras/outbox, consentimento, auditoria e supressão com o prazo original. Não executa exclusão de identidade nem forja pedido owner. Impedimentos de privacidade, provedor, envio incerto, vínculo cruzado e manifestos compartilhados/JSON preservam os registros. Preview é padrão; apply revalida sob locks e é atômico por contato. P07 continua parcial para identidade, demais finalidades e dados compartilhados. A imagem/restore D107–D108 são evidências da revisão anterior, não incluem esta rotina. [Oito grupos PostgreSQL sintéticos](../artifacts/privacy-retention/d109-results.json). Sem migration, chamada externa, dado real, nova imagem, VPS ou deploy.

## D110 — Retenção de identidade e recuperação — 26/10/2026

Identidade exige descadastro global ≥30 dias e ausência de amostra/outbox, token, assinatura, calendário, promoção, provedor, pedido manual ou referência compartilhada. Provas encerradas exigem occurredAt e updatedAt ≤ cutoff de 24 meses; prova recente protege identidade. A rotina reconhece referências por UUID, email legado e HMAC, inclusive callback órfão. Ausência de chave/evidência ou limite de inventário alcançado preserva os dados. Expurgo é transacional sob locks de identidade/lotes/contato e não cria pedido owner. Um fato HMAC próprio por 24 meses evita ressuscitar cópia antiga; nova finalidade é preservada, dependência restaurada fica em quarentena. A supressão mantém seu vencimento original: nenhum tombstone é criado/renovado por esta rotina. Políticas e retenção ampla continuam sujeitas ao aceite operacional.

## D111 — Operações em lote e diagnóstico PostgreSQL — 26/10/2026

Operações em lote com transactionID compartilhado agora processam cada documento sequencialmente no patch do Payload. Teste de rollback verifica que exclusão completa revertida pelo chamador preserva todas as linhas; teste verifica limpeza sem aviso do driver e nenhuma rede externa. Isso não amplia permissões nem altera retenção/consentimento ou comprova auditoria integral de segurança.

## D112 — Descadastro e retenção por assunto — 26/10/2026

A retirada temática gera fato pseudônimo de 24 meses separado de pedidos owner e supressão global. Pode retirar estado local encerrado após 30 dias somente com fato vigente e sem consentimento posterior/dependências. Preserva contato, amostra, consentimentos, outro assunto ativo e prazos originais. Callback órfão é conferido por impressão/chave; ausência de chave ou prova preserva. Replay aceita tema ausente sem criar tema/contato, importa fato original e não altera globalSuppressedAt. Não apaga envios incertos nem resolve provedor; indica pendência. Confirmação anterior ao descadastro pode entregar amostra, mas não autoriza marketing após expurgo da assinatura. Repetição não renova o fato ou updatedAt de assinatura já igual.

A meta documental de retirar marketing em até 30 dias permanece. D113 antecipa a elegibilidade para 28 dias e sinaliza atraso/exceções na saúde. Homologar continuidade, duração, monitoramento e revisão das exceções antes do aceite integral de P07; nenhuma produção foi certificada.

## D113 — Margem e acompanhamento do prazo — 26/10/2026

Meta máxima de 30 dias preservada. Estado promocional/temático encerrado pode expirar após 28 dias para reservar margem ao job diário; todos os bloqueios, locks, prova e dependências permanecem. Não reduz prazos das provas/fatos (24 meses), supressão global (12 meses) ou identidade encerrada (carência de 30 dias). Datas recentes/alterações e vínculos pendentes continuam protegidos. marketingDeadline sinaliza assinaturas antigas sem divulgar titulares; saúde vermelha exige conciliação, sem exclusão insegura. A prova local não garante SLA em produção nem conclui a política de contatos ativos ou retenção integral.

## D114 — Legado temático verificável — 26/10/2026

Reconstrução do legado exige consistência exata do registro privado nativo: mesmo contato, assunto, data, finalidade e chaves. Dados ausentes, futuros, ambíguos ou conflito posterior permanecem para revisão. Não autentica relatório/conta externa nem fabrica pedido humano. Fato vigente é criado com vencimento original; prova expirada pode encerrar estado promocional elegível sem novo fato, pois a janela de restore é de três meses e não aceita snapshot anterior à retirada já vencida há 24 meses. Todos os guards de dependência, locks, rollback e outros propósitos permanecem. Exportação recusa lacuna sem cobertura real; não usa expurgo antigo para suprimir nova finalidade.
