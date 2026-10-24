# 11 — Runbooks de operação

[Índice](../README.md) · [Infraestrutura](10-infraestrutura.md) · [Qualidade](15-qualidade.md)

Procedimentos de produção para o proprietário; nenhum deploy foi executado. Provisionamento, recuperação administrativa, supressão e backup/restore já têm ferramentas e testes locais. Inbox/histórico comuns possuem runbook local D61 abaixo; conciliação financeira e rotina comercial permanecem previstas. Estado e limites no [mapa vigente](23-estado-atual.md).

## Primeiro lançamento

1. Inventariar VPS e registrar baseline de serviços/URLs existentes, RAM, disco e latência.
2. Confirmar domínio, DNS e configuração do proxy; preparar somente vhost/rede do Bibliotheon.
3. Criar segredos, conta administrativa por procedimento privado e destino de backup externo.
4. Subir banco isolado, aplicar migrations e subir app/worker com imagem homologada.
5. Testar readiness, login, upload, preview, publicação, catálogo e redirecionamento.
6. Testar HTTPS, cabeçalhos, DNS, SPF/DKIM/DMARC conforme provedor de e-mail; não sobrescrever registros compartilhados sem verificar.
7. Restaurar backup num ambiente isolado, registrar duração e perdas possíveis.
8. Conferir baseline dos sistemas existentes; só então abrir tráfego e ativar campanha.

Não expor criação do primeiro admin na internet. Ambientes de teste protegidos por autenticação e noindex, com e-mail bloqueado por padrão.

## Recuperar acesso administrativo

O operador com acesso autorizado ao host pode executar `npm run admin:recover < /caminho/privado/recuperacao.json` no ambiente de execução local. O JSON privado contém somente email do owner existente e password nova, com pelo menos 16 caracteres e até 1024 bytes. No runtime empacotado, a entrada equivalente é `node cli/recover-admin.js`, com o mesmo stdin privado e DATABASE_URL da aplicação. Usar imagem atual homologada; não passar senha em argumentos, Git, terminal gravado ou documentação.

O procedimento recusa conta inexistente ou banco com configuração diferente do owner único. Troca senha, encerra sessões, invalida links de recuperação anteriores e limpa bloqueio/cooldown de login. Não apaga/recria conta. Registrar a intervenção sem credenciais, entrar com a nova senha e verificar o acesso anterior encerrado. Acesso ao host é requisito deste fallback; a recuperação por e-mail não está habilitada. Endpoints públicos de forgot/reset respondem 503 genérico sem procurar conta ou gerar token; unlock público é negado. Antes de oferecer recuperação por e-mail, homologar remetente, limites, tokens e fluxo correspondente.

## Atualização

Registrar release/digest/schema; verificar capacidade; concluir backup; pausar jobs que escrevam durante migration incompatível; aplicar migration única; atualizar app/worker; executar smoke e comparar sistemas vizinhos. Manter imagem anterior disponível. Falha de readiness, erro crescente, corrupção de conteúdo ou degradação dos serviços existentes interrompe rollout.

Se schema continua compatível, retornar imagem anterior e revalidar. Se incompatível, não restaurar banco automaticamente: pausar escrita, avaliar perda desde backup, preferir correção progressiva e recuperar em cópia isolada. Registrar intervalo de eventos potencialmente perdidos para reenvio/conciliação. Não apagar volumes na recuperação.

## Falhas de integração

Verificar último sucesso, inbox e logs sanitizados; conferir segredo sem exibi-lo; verificar mudança de contrato. Resolver causa e reprocessar IDs selecionados. Se evento não foi persistido, solicitar reenvio pela plataforma e conciliar relatório. Nunca editar contagem manualmente no dashboard.

Se evento antigo reaparece, preservar histórico e impedir regressão. Conflito financeiro vai para revisão. Replay não envia marketing ou altera consentimento.

## Falhas de e-mail

Fila parada: verificar quota, autenticação, DNS e status do fornecedor. Suspender marketing se houver reclamações ou bounce alto, mantendo tratamento do problema. Priorizar confirmações. Em timeout após possível aceitação, consultar provedor antes de reenviar. Descadastro local vale mesmo com falha da API externa; worker checa supressão antes de cada envio.

## Pendências de bloqueio Brevo

A fila privada brevo-suppressions é gravada no mesmo commit do descadastro/supressão local. Conferir estado, próxima tentativa e último resultado pelo painel: pending aguarda/reconcilia; processing tem lease de 30 minutos; synced confirma bloqueio/ausência naquela consulta; failed exige intervenção. Corrigir chave/permissão/configuração sem expor valores; só então executar brevo:suppressions --retry-failed pelo CLI privado conforme [execução](20-execucao-local.md). Não editar estados nem desbloquear contatos no provedor para eliminar pendência.

Timeout/429/5xx têm backoff limitado a 6 horas, sem devolução/consumo de quota de mensagens. Alterações externas posteriores não são cobertas pela observação synced: futuras campanhas exigem preflight e sincronização inbound. Nova inscrição local não reativa automaticamente uma blacklist do Brevo. Bloqueio externo de marketing não equivale a bloqueio transacional. Nenhum envio promocional implementado nesta rotina.

## Cadastro externo e compensações

A fila brevo-registrations nasce no commit do consentimento confirmado; só o owner lê e o processamento altera. pending aguarda; processing usa lease de 30 minutos; synced é conferência de contato, não envio; failed exige correção/retry; canceled encerra criação; canceling mantém proteção contra POST tardio após descadastro. Um 404 não prova que cadastro incerto nunca será aplicado. Manter canal de bloqueios/chave privada de links ativos para drenar compensações, mesmo se desativar novos cadastros.

Revisar recusas definitivas no provedor antes de brevo:contacts --retry-failed pelo CLI privado. Não editar estado para synced ou desbloquear contato para eliminar erro. identity_changed não tem retry automático: troca de endereço não é operação disponível na API do produto; investigar e corrigir identidade/objeto externo sem presumir destinatário. Canceling usa backoff até seis horas e só GET/PUT; registros persistentes exigem revisão da conta, sem apagar tentativas. Homologar automações externas antes de ativar cadastro. Ver [execução](20-execucao-local.md).

## Listas por lote no Brevo

Fila privada brevo-batch-lists: creating/filling são intenções com lease de 30 minutos; uncertain exige reconferência; failed indica conflito/recusa/preferência não resolvida; ready é composição pontual e canceled mantém evidência/ID. Cli opera um lote com configuração privada conforme [execução](20-execucao-local.md). Não incluir campanhas automáticas na pasta dedicada. O worker ainda não prepara listas nem dispara campanhas.

Criação sem resposta/ID: conferir nome exclusivo e pasta na conta; repetir depois da próxima conferência busca o objeto sem outro POST. Se necessário, --list-id com ID revisado confere metadados antes de usar. Somente recusa explícita de criação admite --retry-rejected após corrigir configuração. Inclusões incertas não são repetidas: revisar membros/preferências no provedor; depois de composição reparada pelo operador, o CLI observa e confirma. Campos opcionais de preferência ausentes bloqueiam ready até homologação, sem adivinhar consentimento.

Destinatário extra ou nome/pasta divergente interrompe; não apagar terceiros para fazer o teste passar. Preservar IDs de listas canceladas/órfãs e inventariar para futura retenção B12. Consulta de pasta acima do limite local de 1000 exige revisão/rotação/retenção, sem concluir ausência. Ao trocar pasta, respeitar a pasta original dos manifestos existentes. Nenhum envio é autorizado apenas por ready.

## Restauração

1. Selecionar snapshot/dump e manifesto compatíveis, obter chave fora do servidor.
2. Restaurar em rede/volumes novos, nunca sobre produção na primeira tentativa.
3. Desabilitar envios, webhooks e jobs externos; verificar schema, contagens, arquivos e login.
4. Executar smoke com dados protegidos; registrar tempo e ponto recuperado.
5. Para desastre real, escolher troca de tráfego após avaliar perda, recuperar eventos externos e registrar incidente.

Após restaurar backup antigo, reaplicar exclusões e supressões ocorridas depois dele antes de reativar e-mail.

## Rotina

Diária: saúde, fila, falhas de envio, backup e espaço. Semanal: conciliação, revisão comercial, pendências e atualizações de segurança. Mensal: restauração, revisão de retenção, custos e capacidade. Não instalar uma pilha pesada de observabilidade no início; usar healthchecks, métricas do host e alerta externo por canal do proprietário.

Logs estruturados: requestId, tipo, resultado, duração, código de erro e ID interno não pessoal. Sem corpo completo, e-mail, tokens, URLs de preferência ou headers sensíveis. Alertas identificam problema e ação, não compradores.


### Preparação dos links de preferências Brevo (D54)

Criar/homologar na conta o atributo BIBLIOTHEON_PREFERENCES normal/text antes de habilitar BREVO_PREFERENCE_SYNC_ENABLED, com bloqueios e chave de links válidos. CLI privado prepara um lote já elegível, consulta antes de atualizar e reconfirma por GET. Falha de schema/identidade/valor não autoriza campanha; corrigir origem, atributo, permissões ou bloqueios sem imprimir contatos/links/chaves. Campo não é reativação. O worker não executa esta operação.

Chave alterada ou expiração próxima cria nova intenção; hashes antigos permanecem até a validade original. Backups/retomada devem preservar registros de tokens junto das demais intenções. preferenceCheck é pontual: futuro envio exige revisão fresca e homologação do placeholder no template. Sem disparar teste com destinatário real por meio desta CLI.


### Rascunhos Brevo e resposta de criação incerta (D55)

Habilitar BREVO_CAMPAIGN_SYNC_ENABLED apenas após homologar listas/preferências/bloqueios e BREVO_CAMPAIGN_SENDER_ID. CLI privada prepara rascunho sem disparar. Inspecionar manifesto/estado: resultado incerto reconcilia nome ou --campaign-id revisado e confere cópia/remetente/lista/status, sem recriar por simples ausência. Criação explicitamente recusada sem ID permite --retry-rejected após corrigir configuração; opção não vale para timeout.

ID retido e observedIds preservam referência após descadastro, falha de GET ou colisão entre lotes. Não apagar/editá-los para forçar sucesso. Campanha com cópia/lista/status alterados não é sobrescrita automaticamente. Inventariar órfãos e revisar a consulta ao aproximar o limite local de mil campanhas (B12), que inclui toda a conta; consultas incompletas não provam ausência. Futuro transporte exigirá nova conferência e gate próprio, inclusive bloqueios observados fora da aplicação.


### Disparos promocionais e tentativas incertas (D56)

No primeiro deploy, manter BREVO_CAMPAIGN_SEND_ENABLED=false. Configurar e homologar pipeline/conta/quota/reset UTC/remetente/templates antes da ativação real. A flag é independente de EMAIL_TRANSPORT_ENABLED: worker pode operar marketing e bloqueios com SMTP desligado, usando remetente por ID; isso não libera captura/institucionais sem contato público legalReady.

Runtime privado: node cli/send-brevo-campaign.js UUID_DO_LOTE. Prepara dependências e só emite após reserva+intenção commitadas. Após ativação explícita, worker faz no máximo uma nova campanha por ciclo. submitted/204 significa pedido aceito, sem entrega comprovada; issuing ainda é intenção em voo. Em timeout/falha após emissão, conservar quota/histórico e nunca reexecutar POST por conta própria. Retomada marca emissão abandonada uncertain sem nova requisição. Reconciliação por observação/webhook está pendente.

Apenas recusa 400/402/404 confirmada admite --retry-rejected, após corrigir causa e rever consentimento/lista/cópia/remetente. Nova tentativa consome outra reserva, inclusive no mesmo dia, sem devolução automática da anterior. Incerto não aceita esse retry. Não editar JSON, apagar tentativas ou liberar orçamento para forçar disparo. Descadastro após emissão pode encontrar solicitação em voo; preservar supressão e observar resultado, sem prometer recall.

Histórico privado guarda token de tentativa/dia/contagem/resultado, sem links ou corpos externos. Guard de downgrade da migração 15 impede perder intenções/quota/estados novos. Correção do down remove/recria índice parcial na troca de enum; up aplicado não foi alterado. Antes de release, testar imagem/restore das quinze migrações e proteção dos comandos.


## Consultar atividade de campanhas existentes (D57)

Manter BREVO_CAMPAIGN_OBSERVE_ENABLED=false no primeiro deploy; atualizar.sh preserva o ambiente privado. A flag de observação é independente de BREVO_CAMPAIGN_SEND_ENABLED. Após homologar a consulta e conceder chave privada de API, pode ativar somente observação: não exige habilitar SMTP/cadastro/disparo nem altera consentimento. Para execução periódica na VPS, ativar também o worker na configuração privada do atualizador conforme o procedimento anterior.

CLI local: npm run brevo:observe -- UUID_DO_LOTE; runtime da imagem: node cli/observe-brevo-campaign.js UUID_DO_LOTE. Acrescentar --refresh para consultar novamente um registro ainda não vencido/terminal; lease ativo é respeitado. Sem flag retorna disabled; flag com chave inválida falha. Fila é criada com cada intenção de emissão e preenchida para tentativas anteriores pela migração 16. Worker consulta até uma campanha por ciclo; 15 minutos entre consultas, lease de 30 minutos e parada automática em sent/archive/cancelled.

observed significa atividade da campanha, sem comprovar destinatário/entrega ou autoria exclusiva do POST. Histórico HTTP/código e quota permanecem preservados; nenhum estado de consulta autoriza reenviar pedido incerto. Não ligar envio para investigar timeout. Prova, datas e falhas ficam em brevo-campaign-observations, privada e sem resposta bruta. Consulte [contrato Brevo](integracoes/brevo.md) e o estado atual antes da produção.


## Callback Brevo de marketing e resultados individuais (D58)

No primeiro deploy manter BREVO_WEBHOOK_ENABLED=false. As migrações 17/18 são aditivas; não fabricam identidade histórica para disparos existentes. Atualizar com ./atualizar.sh preserva o ambiente privado e não ativa webhooks/envio automaticamente. Runtime inclui node cli/replay-brevo-webhook.js UUID_DO_EVENTO; localmente npm run brevo:webhook-replay -- UUID_DO_EVENTO. Replay de envelope não reenvia mensagem nem consulta a API.

Para homologação posterior, gerar segredos privados independentes com pelo menos 32 bytes conforme o procedimento de chaves deste projeto. Configurar BREVO_WEBHOOK_TOKEN (32–128 caracteres ASCII alfanuméricos/hífen/sublinhado) e BREVO_WEBHOOK_EVENT_SECRET (HMAC estável), sem copiar sessão/chave de links. BREVO_WEBHOOK_PREVIOUS_TOKEN é opcional para transição de autorização. Nunca trocar o segredo HMAC junto de rotação de token: a deduplicação histórica depende dele. A identidade capturada no disparo depende também da chave privada de links; recuperar esses segredos junto do banco/configuração privada, fora do Git e com permissões restritas.

Na conta Brevo, configurar manualmente webhook type=marketing, channel=email, batched=false, URL HTTPS da aplicação terminada em /api/webhooks/brevo, events delivered/hardBounce/softBounce/spam/unsubscribed e auth.type=bearer com token privado. A API key usada para criar/configurar webhook na conta não é a credencial do callback. Só ativar BREVO_WEBHOOK_ENABLED=true depois de conferir proxy/TLS, autenticação e teste controlado; não precisa ativar SMTP, worker, envio ou cadastro para receber. Homologação real não foi executada nesta etapa. Não usar os tokens sintéticos de CI em produção.

Callback autentica antes de corpo/banco, limita 32 KiB/5 segundos e confirma somente depois do commit. Configuração desativada/indisponibilidade responde 429 com Retry-After; a política pública da Brevo documenta descarte de notificações em 5xx. Corpo/credencial inválidos não são aceitos. Configurar endpoint/canal/eventos incorretos exige correção e revisão na conta; não presumir retry ilimitado. Não colocar chave na URL nem registrar Authorization/corpos no proxy.

Coleções privadas brevo-webhook-events e brevo-delivery-receipts mostram quarentena/resultados mínimos, sem payload bruto. Desconhecidos exigem revisão na conta e, quando necessário, fluxo manual de supressão; replay não associa um email antigo a cadastro criado depois. Legado sem impressão histórica, identidade divergente, campanha/destinatário/tempo incompatíveis não são entregas conciliadas. Notificações negativas válidas de contato conhecido protegem consentimento mesmo sem campanha mapeada. delivered significa relato do provedor e não comprova leitura/compra. Não reenviar pedido incerto para investigar resultados; quota/histórico permanecem preservados. Ver [contrato Brevo](integracoes/brevo.md).


## Medição própria opcional (D59)

ANALYTICS_ENABLED=false no primeiro deploy. A migração 19 cria permissões/sessões/páginas/saídas/limites e termo de campanha. atualizar.sh preserva o ambiente privado e aplica migrations pendentes. Medição também exige institucional legalReady revisado; enquanto responsável/contato/textos não estiverem prontos, não haverá novo aceite/coleta. A autorização de marketing não vale como autorização analítica. Não ativar para operação real antes de retenção/exclusão B12 e revisão do release/políticas.

Em homologação, ativar a flag no ambiente privado e atualizar; não exige Brevo/SMTP/worker/API paga. Verificar aceitar/rejeitar equivalentes no rodapé, cookie __Host/HttpOnly/Secure em HTTPS e revogação com cookie antigo. A recusa só guarda preferência igual para todos. Há formulário nativo de retirada sem JavaScript, com redirecionamento fixo à privacidade. GET de preferência não cria ID/sessão. Revogação já existente permanece acessível se a flag/aviso forem desativados.

Sessões são medidas com 30 minutos inativas; first-touch e último não direto usam janela de 30 dias. Campo de campanha/UTMs deve conter códigos salvos e revisados, sem dados pessoais. Formulário Campaign gera link interno somente com livro/oferta/campanha disponíveis. URLs de checkout/afiliado continuam intactas; nenhum parâmetro de clickId é acrescentado automaticamente. O painel de sete dias separa sessões/páginas consentidas, saídas totais e saídas consentidas. Não ler contagens como pessoas únicas, vendas ou conversão. Falha de medição não interrompe checkout validado.

QA local: npm run test:analytics, npm run test:analytics-http e scripts/qa-analytics.ts, com base sintética/loopback e testes sequenciais. Não copiar hosts/tokens/dados de teste para produção. Nunca persistir query completa, referer, IP, credenciais ou payloads reais em logs; conferir também política do proxy existente, sem alterar os outros serviços da VPS. Retenção de analytics e restauração das 19 migrations permanecem pendentes. Ver [estado atual](23-estado-atual.md).


## Operar a inbox comercial comum — D61

COMMERCIAL_EVENTS_ENABLED=false é o padrão. Não habilita endpoints de Hotmart/Kiwify/Cakto nem prova autenticação nativa. CLI npm run commerce:process -- 1 processa apenas envelopes já persistidos; limite máximo 25. No runtime, node cli/process-commercial.js 1. Desligado retorna disabled antes de abrir banco. Worker comercial pode executar sem SMTP/API Brevo/chave de links; não prepara campanhas quando for sua única função.

Consultar /admin/collections/commercial-inbox por provider/account/state; revisar pending/failed mais antigos, startedAt de processing, attempts/errorCode/lastSuccessAt. Conferir transactions, transaction-events, commercial-conflicts e commercial-audit pelo mesmo escopo. Não contar inbox/fatos/cliques como vendas ou somar valores desconhecidos. Painel consolidado e formulário específico de retry ainda não foram homologados.

Para unknown_product/unknown_offer/ambiguous_product, corrigir cadastro por IDs oficiais; não mudar identidade de oferta com histórico. Para processing_unavailable, corrigir serviço antes de tentar novamente; automação para após cinco tentativas por orçamento. Lease ativo espera até cinco minutos; não trocar tokens no banco. Owner autenticado pode chamar o [retry privado](06-interfaces.md) com catalog_updated, service_restored ou reviewed_envelope. Ação fica auditada e será processada somente com a flag habilitada. Não colocar token/cookie em documentação, script versionado ou histórico do shell.

Conflito de envelope, moeda, tempo, valor ou identidade exige investigar a causa e conservar o histórico. Retry não apaga fato conflitante nem libera colisão; resolução controlada/conciliação continua pendente em B11. Não usar edição SQL/REST de contadores ou envelopes para contornar revisão. O downgrade da migração 20 recusa dados e não deve ser usado como rotina de rollback de produção.


## Acompanhar e reprocessar pelo painel — D62

No painel, abrir “Conferir eventos e reprocessamento”. O resumo dos três provedores abrange todas as contas; lista abaixo segue filtros e paginação. Padrão “Precisam de atenção” inclui colisão em evento aplicado e processamento acima de cinco minutos, além de falha/revisão. Conferir recebido, tentativas acumuladas, próxima tentativa e causa. Datas usam horário de Belém. Não ler esses números como vendas ou somá-los para calcular conversão.

Expandir “Reprocessar evento” apenas após corrigir a causa: selecionar conferência, marcar confirmação e recolocar na fila. Aguarde o retorno. Confirmação permanece visível quando o evento sai do filtro; com worker desligado ele ficará pendente. Falha de rede/503 exige consultar a auditoria antes de repetir; 403 exige rever sessão/origem, 409 exige atualizar e conferir o estado. A ação não libera colisão, troca envelope ou resolve divergência financeira.

Pending/applied/ignored e lease ativo não oferecem novo retry na interface. Para histórico, “Conferir histórico do evento” abre detalhe readonly com últimas dez ações e acesso à coleção de auditoria completa; “Abrir este evento para reprocessamento” volta à consulta por UUID. O formulário do CMS não edita evento/valor nem contém o formulário de ação. Native provider, atribuição, conciliação e resolução de conflitos continuam condicionados aos próximos subsistemas.


## Recepção Hotmart v2 — D63

Manter HOTMART_WEBHOOK_ENABLED=false no primeiro deploy. Para homologar, proprietário confere conta/produto/ucode/oferta, versão 2.0.0, domínio/HTTPS e Hottok no ambiente privado. HOTMART_ACCOUNT_KEY deve coincidir com o identificador local da conta na oferta. Copiar o token real da conta, sem enviar ao agente, Git ou logs; não gerar outro token. HOTMART_PREVIOUS_HOTTOK é opcional e temporário para transição explicitamente conferida. Token fica somente no app.

URL sem query: PUBLIC_SITE_URL + /api/v1/webhooks/hotmart. Autenticação somente por cabeçalho X-HOTMART-HOTTOK, antes do corpo e do banco. Requisição v1, corpo inválido ou token em URL/cookie não funciona. Não expor payloads com buyer/PIX/credenciais ao investigar. Receber confirma apenas persistência; habilitar também COMMERCIAL_EVENTS_ENABLED e o worker no perfil/configuração do deploy para aplicação automática. Desligar o worker não apaga pendências recebidas.

401: conferir token/cabeçalho sem exibir valor. 415/413/422: comparar versão, MIME, encoding e esquema com contrato; pedir reenvio pelo mecanismo disponível na conta após corrigir. 503: conferir flag/configuração/serviço; não interpretar como aceito. Política e contagem de retries externos ainda não homologadas. 200: registro durável, não prova de processamento, liquidação ou entrega do livro.

No acompanhamento, unknown_product/unknown_offer exige ID exato: na Hotmart é product.ucode e purchase.offer.code. Não usar número do produto como fallback. Estado/forma de compra/precisão sem suporte ficam em revisão; data de aprovação ausente é desconhecida e criação da notificação é separada. Reembolso/chargeback sem quantia não recebem o total bruto por aproximação. Colisão ou data/valor divergente preserva a última projeção; resolver com evidência/relatório, sem editar envelope via API. Origem de campanha não é atribuída automaticamente.

Para fila já recebida, node cli/process-commercial.js 1 dentro da imagem (localmente npm run commerce:process -- 1). Corrigido o caminho do guia anterior: Dockerfile copia .release para cli. Não há CLI que aceite corpo real de comprador para contornar autenticação. Operador usa histórico/reenvio do provedor para ausentes e retry privado para envelopes persistidos, conforme o [contrato Hotmart](integracoes/hotmart.md). CSV/conciliação financeira ainda pendentes.

## Kiwify local — D64

Primeiro deploy mantém KIWIFY_WEBHOOK_ENABLED=false e COMMERCIAL_EVENTS_ENABLED=false. Conta/segredo específicos só no ambiente privado do app, seguindo [contrato Kiwify](integracoes/kiwify.md). Conferir política de logs do proxy antes de cadastrar a URL sem segredo; signature chega na query. Não fazer compra/refund real como teste descartável. Revisões unknown_event_time não são falhas de rede e retry não descobre datas: conciliar com evidência externa em B11. Conta/relatório/reenvios e homologação continuam com o proprietário.

## Recepção Cakto — D65

Primeiro deploy mantém CAKTO_WEBHOOK_ENABLED=false. Segredo copiado do webhook da conta, alias igual ao catálogo e transição anterior explícita somente no app. Não registrar corpo no proxy/APM/debug: o JSON nativo contém secret mesmo usando assinatura. Conferir timestamp/relógio e assinatura antes de ativar. [Contrato e limites](integracoes/cakto.md).

Cakto documenta reenvio automático de falha de rede/timeout, mas não de resposta HTTP não 2xx. Após 503/banco indisponível, restabelecer serviço, consultar histórico do fornecedor e reenviar manualmente; não há recibo local de entrega nunca persistida. Nunca responder sucesso para esconder falha. Evento oficial de teste tem subscription/meios de pagamento artificiais e pode ficar em revisão; não tratá-lo como venda real. MED, falta de data e colisões exigem conciliação B11, sem editar envelope.

## Operação de lotes duráveis — D67

Estagiar uma conta/provedor por lote com referência operacional/razão controladas; conferir fonte e linhas privadas antes do commit. Não usar hash da prévia D66 como autorização. queued significa submissão durável; consultar inbox vinculada e processamento comercial, que permanece false por padrão. stale/blocked exige corrigir a causa e novo estágio/conferência; não editar manifesto/linhas ou repetir cegamente conflito.

Migração 21 preserva evidência e recusa downgrade com registros. Não remover lotes/linhas/auditoria para forçar rollback; procedimento de backup/restore e release da imagem atual continua obrigatório. Barreira por conta cobre operação DB, sem espera humana; medir impacto em callbacks sob carga antes de produção. [Contrato e limites](24-conciliacao.md).
