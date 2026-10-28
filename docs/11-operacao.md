# 11 — Runbooks de operação

[Índice](../README.md) · [Infraestrutura](10-infraestrutura.md) · [Qualidade](15-qualidade.md)

Procedimentos de produção para o proprietário; nenhum deploy foi executado. Provisionamento, recuperação administrativa, supressão e backup/restore têm ferramentas e testes locais. Inbox/histórico, conciliação auditada/CSV, ledger/prévia financeira e interfaces operacionais possuem aceite local P01–P05 D86; atribuição por conta, retenção integral, homologações e operação real permanecem pendentes. Estado e limites no [mapa vigente](23-estado-atual.md).

Estado documental D129 (28/10/2026): imagem/API D127 e QA local H05 estão aprovados; P07-A–E, contas e ambiente real permanecem pendentes. Recuperação externa é opcional para `--sem-backup`; se adotada, cumprir os controles abaixo. Evidência local não autoriza ativar flags reais sem homologação.

## Primeiro lançamento

1. Inventariar VPS e registrar baseline de serviços/URLs existentes, RAM, disco e latência.
2. Confirmar domínio, DNS e configuração do proxy; preparar somente vhost/rede do Bibliotheon.
3. Criar segredos e conta administrativa por procedimento privado. Backup externo é opcional: o atualizador exige por padrão, mas o proprietário pode optar por não fazê-lo com `--sem-backup`.
4. Subir banco isolado, aplicar migrations e iniciar app com imagem homologada; worker somente no perfil e flags do fluxo homologado.
5. Testar readiness, login, upload, preview, publicação, catálogo e redirecionamento.
6. Testar HTTPS, cabeçalhos, DNS, SPF/DKIM/DMARC conforme provedor de e-mail; não sobrescrever registros compartilhados sem verificar.
7. Se houver backup, restaurá-lo num ambiente isolado e registrar duração/perdas possíveis. Sem backup, reconhecer que não há ponto de restauração recente e que falha de migration pode exigir recuperação manual ou reconstrução.
8. Conferir baseline dos sistemas existentes; só então abrir tráfego e ativar campanha.

Não expor criação do primeiro admin na internet. Ambientes de teste protegidos por autenticação e noindex, com e-mail bloqueado por padrão.

## Recuperar acesso administrativo

O operador com acesso autorizado ao host pode executar `npm run admin:recover < /caminho/privado/recuperacao.json` no ambiente de execução local. O JSON privado contém somente email do owner existente e password nova, com pelo menos 5 caracteres e até 1024 bytes. No runtime empacotado, a entrada equivalente é `node cli/recover-admin.js`, com o mesmo stdin privado e DATABASE_URL da aplicação. Usar imagem atual homologada; não passar senha em argumentos, Git, terminal gravado ou documentação.

O procedimento recusa conta inexistente ou banco com configuração diferente do owner único. Troca senha, encerra sessões, invalida links de recuperação anteriores e limpa bloqueio/cooldown de login. Não apaga/recria conta. Registrar a intervenção sem credenciais, entrar com a nova senha e verificar o acesso anterior encerrado. Acesso ao host é requisito deste fallback; a recuperação por e-mail não está habilitada. Endpoints públicos de forgot/reset respondem 503 genérico sem procurar conta ou gerar token; unlock público é negado. Antes de oferecer recuperação por e-mail, homologar remetente, limites, tokens e fluxo correspondente.

## Atualização

Registrar release/digest/schema; verificar capacidade; decidir se fará backup (o padrão é fazer e confirmar); pausar jobs que escrevam durante migration incompatível; aplicar migration única; atualizar app/worker; executar smoke e comparar sistemas vizinhos. `--sem-backup` pula a captura, não as migrations, verificações ou proteções do atualizador, e não oferece ponto de restauração recente. Manter imagem anterior disponível. Falha de readiness, erro crescente, corrupção de conteúdo ou degradação dos serviços existentes interrompe rollout.

Se schema continua compatível, retornar imagem anterior e revalidar. Se incompatível, não restaurar banco automaticamente: pausar escrita, avaliar perda desde backup quando existir, preferir correção progressiva e recuperar em cópia isolada. Sem backup recente, a imagem anterior não reverte mudanças de schema nem dados. Registrar intervalo de eventos potencialmente perdidos para reenvio/conciliação. Não apagar volumes na recuperação.

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
4. Conferir o `capturedAt` emitido pelo restore e reaplicar o manifesto privado atual conforme D104 abaixo, mantendo app/worker e flags desligados.
5. Executar smoke com dados protegidos; registrar tempo e ponto recuperado e conciliar pendências externas.
6. Para desastre real, escolher troca de tráfego após avaliar perda, recuperar eventos externos e registrar incidente.

Após restaurar backup antigo, reaplicar exclusões e supressões ocorridas depois dele antes de reativar e-mail.

## Rotina

Diária: saúde, fila, falhas de envio e espaço; backup se adotado. Semanal: conciliação, revisão comercial, pendências e atualizações de segurança. Mensal: revisão de retenção, custos e capacidade; restauração se a capacidade de recuperação for adotada. Não instalar uma pilha pesada de observabilidade no início; usar healthchecks, métricas do host e alerta externo por canal do proprietário.

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

Sessões são medidas com 30 minutos inativas; first-touch e último não direto usam janela de 30 dias. Campo de campanha/UTMs deve conter códigos salvos e revisados, sem dados pessoais. Formulário Campaign gera link interno somente com livro/oferta/campanha disponíveis. D87/D88 podem acrescentar `sck` somente à saída com consentimento vigente e quando a URL ainda não contém esse parâmetro; a referência é UUID local, nunca token/sessão. O painel de sete dias separa sessões/páginas consentidas, saídas totais e saídas consentidas. Não ler contagens como pessoas únicas, vendas ou conversão. Falha de medição não interrompe checkout validado.

QA local: npm run test:analytics, npm run test:analytics-http, npm run test:analytics-retention e scripts/qa-analytics.ts, com base sintética/loopback e testes sequenciais. `npm run analytics:retention` só apresenta prévia; `npm run analytics:retention -- --apply` executa o agregado/expurgo analítico. Para o worker diário, defina `DATA_RETENTION_ENABLED=true` explicitamente; padrão falso. Não copiar hosts/tokens/dados de teste para produção. Nunca persistir query completa, referer, IP, credenciais ou payloads reais em logs; conferir também política do proxy existente, sem alterar os outros serviços da VPS. A retenção analítica local cobre apenas eventos com mais de 90 dias; demais retenções, pedidos de dados e reaplicação após restore continuam pendentes. Migration atual: 29. Ver [estado atual](23-estado-atual.md).


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

Migração 21 preserva evidência e recusa downgrade com registros. Não remover lotes/linhas/auditoria para forçar rollback; backup/restore permanece disponível e recomendado, mas pode ser dispensado para o deploy com `--sem-backup`, aceitando a ausência de ponto recente de recuperação. Barreira por conta cobre operação DB, sem espera humana; medir impacto em callbacks sob carga antes de produção. [Contrato e limites](24-conciliacao.md).

## Conciliação pelo painel — D80–D81

Fluxo disponível localmente para owner em `/admin/commercial-imports`, reutilizando as APIs privadas existentes:

1. Conferir fonte, período, provedor/conta e contrato canônico; adaptar o relatório sem compradores, credenciais ou colunas extras. Cabeçalho nativo do provedor não é reconhecido automaticamente.
2. Escolher snapshot (13 colunas) ou evidência complementar (18), referência controlada e motivo; consultar a prévia. A consulta não grava lote/fato.
3. Preparar lote e abrir suas linhas persistidas. Conferir valores em centavos, desconhecidos, datas UTC, moeda, IDs e substituições nos detalhes; resolver bloqueios antes de outra tentativa.
4. Marcar a conferência e confirmar. O servidor revalida o plano; se mudou, o lote fica stale e exige nova preparação após resolver a causa.
5. Se a resposta se perder, manter os dados e repetir a mesma tentativa. Após navegar/recarregar, retomar pelo histórico recente ou coleção de lotes; confirmar o mesmo lote não duplica fatos.
6. Snapshot queued exige acompanhar a inbox/processamento; prova complementar confirmed exige decisão financeira para aplicar valores. A prévia financeira fica em `/admin/financial-ledger`. Recebimento/custos usam trilhas independentes em `/admin/financial-records` (D81), com conferência e correções por substituição.

Não editar fatos, normalized, hashes ou estado pelas coleções nativas. Preservar a trilha bloqueada; as telas de decisão auditada continuam em P05. Este roteiro é local, sem homologação de relatório/conta comercial ou operação real. [Contratos e limites](24-conciliacao.md).

## Registrar liquidação/custo e corrigir — D81

1. Abrir `/admin/financial-records` pelo dashboard/prévia e escolher Liquidações ou Custos.
2. Para caixa, conferir provedor, alias da conta, ID da transação aprovada, moeda e sentido crédito/débito. Para custo, escolher categoria/classificação e campanha opcional; a ausência de campanha mantém custo compartilhado.
3. Informar valor sem milhar, instante UTC da fonte e aliases conferidos de fonte/linha. Não usar data atual, zero ou identificador do comprador para preencher o desconhecido.
4. Usar Conferir registro e revisar o resumo. Essa etapa não grava nem valida previamente a aprovação da transação.
5. Marcar a conferência e registrar. Em resposta incerta, preservar fonte/linha e repetir ou consultar o histórico; não mudar a referência apenas para fazer a tentativa passar.
6. Para corrigir, abrir a linha vigente e escolher Preparar correção deste registro. Preservar os campos fixados, fornecer nova linha e conferir a substituição. O original permanece consultável; uma linha já substituída aponta para a sucessora.
7. Conferir a versão vigente, a campanha persistida e o efeito na prévia `/admin/financial-ledger`, mantendo períodos/moedas distintos. Uma evidência de caixa não confirma nova compra, fonte homologada ou lucro.

O histórico pagina 20 registros por tipo/moeda e inclui substituídos. As coleções nativas continuam somente leitura. Decisão auditada de divergências, cobertura completa e homologação externa não são concluídas por este fluxo local.

## Conferir uma identidade do catálogo — D82

1. Abrir Resolver identidades do catálogo no dashboard. Conferir provedor, conta, produto e oferta externa na fonte; omitir oferta externa significa escopo de produto, sem remover decisões específicas de outra oferta.
2. Escolher associação a livro/oferta conferida, ou bloqueio quando a evidência for inconclusiva. Copiar o UUID do cadastro existente; oferta deve pertencer ao mesmo namespace. Informar alias privado da fonte, sem compradores/credenciais, e motivo.
3. Preparar a prévia. Conferir destino pelo link do cadastro, revisão/hash e snapshot do produto (que pode incluir outras ofertas). Nenhuma decisão foi gravada nessa etapa.
4. Atestar a associação ou confirmar o bloqueio e registrar. Não tratar a decisão como compra, recebimento ou resolução financeira. Se a resposta se perder, repetir a mesma confirmação antes de preparar outra prévia.
5. Em stale, consultar o histórico e preparar nova prévia para outra conferência. Após registrar, consultar autoria/fonte, anterior/sucessora e snapshot imutável. Revisão mais recente não comprova validade atual do destino; revalidar em nova prévia.
6. Sem JS há leitura/filtro/paginação; não se registra decisão. A interface financeira de seleção/aplicação de fontes continua pendente.

## Resolver componente financeiro — D83

1. Abrir Resolver conflitos financeiros no dashboard. Informar provedor, conta e transação exatos. Consultar fontes não grava decisão; o componente pode incluir outras transações relacionadas.
2. Conferir cada fonte e suas variantes (hash, identidade, moeda/valores/datas e relatório/substituições). Escolher uma variante ou excluir explicitamente cada fonte. Não aceitar substituto e fonte substituída juntos. Páginas de fontes conservam escolhas; cobertura incompleta não prepara a prévia.
3. Informar alias da conferência e motivo; não colar comprador, relatório bruto ou segredo. Para evidência inconclusiva, escolher manter todo o componente em revisão, sem atestar fontes ou zerar valores.
4. Preparar a prévia e conferir bloqueios, efeitos por transação, destinos, valores conhecidos/desconhecidos e decisões anteriores. Plano bloqueado não oferece confirmação. Catálogo exige a resolução de identidade própria; prova incompleta exige obter evidência canônica, não editar fatos.
5. Atestar a conciliação ou confirmar hold e registrar. Se a resposta se perder, repetir a mesma confirmação antes de sair ou voltar; preserva envelope e chave. Em stale, conferir novamente as fontes e preparar outra prévia.
6. Consultar decisão, provas completas, revisões anteriores/mais recentes e aplicações. As aplicações posteriores não são novas vendas; resultado na decisão e resultado após worker são históricos diferentes. Revisão mais recente não certifica vigência das fontes.
7. Sem JS, leitura/filtro/histórico funcionam, listas mostram seus primeiros 20 itens e JSON contém a prova completa; consulta de fontes/registro exigem JS. Não há homologação externa pelo simples registro no painel.

## Interpretar cobertura e coortes — D84

Conferir sempre moeda e dimensões temporais: aprovação, liquidação e custo usam seus próprios instantes. Uma transação em revisão conserva o aviso, mesmo se o estado derivado for unknown; valores/coortes a excluem. Candidatas sem data são contadas fora das coortes, sem atribuição por suposição.

Na taxa da coorte, conferir cobertura do estado e revisões. Não informado difere de 0%; reembolso/chargeback na mesma compra contam uma vez. Idade observada não certifica encerramento da janela do fornecedor. Um total com origem conhecida, mas fora do limite monetário seguro, aparece Não informado com aviso de limite, preservando a cobertura. A prévia não altera registros; correções de caixa/custos devem passar pelas trilhas de substituição.

O horário observedAt registra consulta, não último processamento bem-sucedido. Detalhamentos e informação de processamento continuam pendentes; não usar a prévia para declarar campanha vencedora, receita atribuída ou lucro.

## Consultar livro, provedor e campanha — D85

Abrir os detalhamentos da prévia financeira e conferir moeda, janela e população. Tabelas paginam 20 grupos; navegação preserva filtros e seção aberta, com ou sem JS. Livro é o efetivo conferido; caixa sem vínculo confiável fica sem livro conferido e mantém seu valor. Custos só são ligados à campanha explicitamente registrada; a receita sem prova fica sem atribuição. Não interpretar provenTransactions=0 como zero vendas de uma campanha.

Conferir lastSuccessfulProcessingAt e quantidade sem data válida de sucesso. São transações com aprovação na janela; um sucesso histórico não libera revisão atual. Horário da consulta/evento não substitui processamento; ausência permanece Não informado. Detalhamentos não rateiam custos entre livro/provedor nem calculam sua margem. Para fonte/correção, consultar trilhas operacionais e decisões preservadas.

## Operação integrada canônica — D86

1. Converter explicitamente a fonte conferida ao contrato adequado: snapshot de 13 colunas ou prova complementar de 18, um provedor/conta por lote. Não usar exportação nativa sem conversão/validação e não preencher desconhecidos como zero.
2. Conferir a prévia, preparar o lote e verificar linhas/fonte antes de confirmar. Confirmar prova não aplica transação; snapshot queued exige processamento. Reabrir lote confirmado não deve oferecer nova confirmação como se fosse uma compra nova.
3. Se o catálogo bloquear, registrar associação/bloqueio auditado e preparar nova prévia financeira. Selecionar/excluir todas as fontes e conferir os efeitos, sem editar envelopes. Prova sem aprovação, reembolso/chargeback sem valor ou estado incompatível permanece bloqueada.
4. Registrar decisão explícita. Somente uma transação aprovada/conferida permite alocar liquidação; pendente não permite receber por suposição. Custos têm fonte própria e campanha opcional, sem atribuir receita.
5. Consultar relatório por moeda/coorte/livro/provedor/campanha, revisão, cobertura e processamento. Reimportação idêntica conserva dados; mudança exige nova conferência e pode invalidar lote antigo. Em falha tardia, a transação integral preserva o estágio sem prefixo gravado.

Aceite D86 é sintético local. Antes de operar em conta real, concluir P06/P07 e H01–H06, conferir produto/contas e autorização de ativação/deploy. Sem scripts ou comandos novos de mutação da aplicação nesta etapa.

### Exportação de dados de titular — D90

O operador verifica a identidade fora da aplicação e, autenticado como owner, chama `POST /api/v1/admin/privacy/export` com `email` e `identityVerified: true`, origem pública exata e corpo JSON. A flag registra a declaração do operador; não verifica identidade por si só. A resposta é privada/no-store e deve ser entregue por canal controlado, sem colá-la em tickets, logs ou repositório. Cada chamada registra auditoria HMAC pseudônima, sem email/conteúdo. Fluxo local testado com fixture; ainda não é UI de atendimento nem substitui aprovação da política antes da coleta real.

### Retenção de privacidade — D91–D92

`npm run privacy:retention` mostra preview; `npm run privacy:retention -- --apply` remove auditorias com mais de 24 meses e solicitações de amostra não confirmadas após sete dias. A rotina exclui o outbox pendente sob lock do contato; pedidos com envio `sending/uncertain` ficam retidos para conciliação. O contato só é excluído quando não há vínculos restantes nem supressão. Relatório inclui contagens/cutoffs, nunca email. O worker executa a retenção diariamente somente quando `DATA_RETENTION_ENABLED=true`, falso por padrão. [D92](../artifacts/privacy-retention/d92-results.json) valida o fluxo com fixtures. A evidência sintética não substitui a revisão dos prazos pelo responsável antes de ativar a flag.

## Inventário agregado de privacidade (D97)

`npm run privacy:inventory` é leitura somente de contagens por coleção; sua saída não contém PII nem conteúdo. Use para dimensionar o conjunto de registros por área, não para localizar titulares nem confirmar exclusões. A imagem ainda precisa ser reconstruída e homologada antes de uso em produção.

## D98 — Retenção da supressão pseudonimizada

A rotina `npm run privacy:retention` inclui `expiredSuppressionTombstones` no preview. `--apply` remove somente impressões HMAC cujo prazo de 12 meses terminou; não retorna endereços. Descadastro global e bloqueios criam/renovam o tombstone. Novo cadastro promocional só o remove após confirmação explícita. As impressões dependem da estabilidade de `LEAD_TOKEN_SECRET`; sua rotação exige migração coordenada das impressões ainda válidas, pois a chave nova não as reconhecerá. Confira preview e backup antes de aplicar; `DATA_RETENTION_ENABLED` continua falso por padrão. A migração 31 é aditiva; release/restore da imagem atual seguem pendentes.

## D99 — Expiração de links de preferências

`npm run privacy:retention` inclui `expiredPreferenceTokens` no preview. `--apply` remove tokens cujo `expiresAt` já passou (validade contratual de 24 horas), revalidando estado e expiração sob o lock do contato para não disputar com leitura/descadastro. Essa limpeza vem antes de avaliar referências de contatos abandonados. Tokens ativos são preservados; nenhum consentimento, envio ou registro de provedor é apagado por esta regra. Não há migration. A flag diária permanece desligada por padrão.

## D100 — Retenção da auditoria comercial

`npm run privacy:retention` informa `commercialAudit` com candidatas, elegíveis, processadas e preservadas para conciliação. `-- --apply` remove auditorias comerciais com mais de 24 meses apenas se o inbox relacionado está resolvido (`applied`/`ignored`), não conflitado e sem transação em revisão. Estados pendentes/falhos, referências ausentes e inconsistências permanecem retidos. Preview não escreve; apply revalida sob locks da conta/inbox. Não apaga inbox, fatos ou projeções. Evidência sintética: [D100](../artifacts/privacy-retention/d100-results.json). Flag diária segue falsa até revisão do responsável.

## D101 — Expiração do envelope da inbox

`npm run privacy:retention` informa `commercialInboxEnvelopes`; use `-- --apply` para expirar o envelope após 90 dias do processamento. Só são elegíveis eventos terminais sem conflito e com integridade comprovada; para `applied`, o fato correspondente em `transaction-events` precisa reconstruir o evento e corresponder ao hash. O marcador de inbox e o ledger permanecem. Processamento, revisão transacional e referência de evidência recuperam o evento pelo ledger e validam chave/hash. Preview é somente leitura, apply revalida sob locks da conta/inbox; a rotina diária continua desligada por padrão. [Evidência D101](../artifacts/privacy-retention/d101-results.json).

## D102 — Retenção de amostras confirmadas

`npm run privacy:retention` agora inclui `confirmedSamples`: candidatas, elegíveis, removidas, outbox/eventos removidos e preservadas para conciliação. `-- --apply` remove pedido/outbox/eventos vinculados após 24 meses apenas quando não houve alteração recente, o envio está encerrado e não há sequência dependente ou prova ativa a preservar. A unidade transacional é cada pedido; uma falha reverte suas exclusões e aborta a execução, sem desfazer pedidos já concluídos. Repetir é seguro. Contatos, assinaturas atuais e eventos de supressão permanecem. A flag diária continua falsa. [Evidência D102](../artifacts/privacy-retention/d102-results.json).

## D103 — Expurgo sem bloqueio da primeira página

A retenção de pedidos não confirmados percorre IDs em ordem com cursor, avançando também quando um pedido precisa ser retido para conciliação. Um lote de 100 envios `sending`/`uncertain` não impede a limpeza de pedidos elegíveis posteriores. O cutoff permanece em sete dias; cada pedido é revalidado sob lock do contato e transação. A leitura do outbox não é truncada ao tamanho da página de pedidos. Preview continua sem escrita; relatório e flag opt-in são os mesmos. [18 verificações PostgreSQL sintéticas](../artifacts/privacy-retention/d103-results.json), incluindo 102 candidatos e repetição sem nova exclusão.

## D104 — Reaplicar decisões antes de retomar operação

No banco de origem, exporte após exclusão, correção, supressão e confirmação de novo opt-in; um arquivo anterior ao novo opt-in pode conservar bloqueio obsoleto. A cópia atual deve estar criptografada e disponível fora do snapshot que será restaurado. `privacy:recovery export` grava arquivo novo em modo 600 e recusa sobrescrita. O manifesto contém pseudônimos protegidos, não dados anônimos. A rotina não contrata/transfere armazenamento externo; automatizar e homologar essa guarda continua pendente.

No banco restaurado isolado, use a configuração privada/chave original e um owner restaurado. Todas as flags de coleta, envio, webhooks, processamento e retenção devem estar falsas, com app/worker parados. Copie o `capturedAt` real retornado por `ops/recovery.py`; o comando aceita UTC com Z ou +00:00, inclusive microssegundos do backup antigo. Preview exige declaração `--isolated` e não escreve. Apply por contato pode deixar passos anteriores concluídos se uma etapa posterior falhar; mantenha isolamento, corrija a causa e repita o mesmo arquivo. Não há rollback automático da recuperação.

```bash
install -d -m 700 .local/privacy
npm run privacy:recovery -- export --output .local/privacy/manifesto-2026-10-25.json
npm run privacy:recovery -- preview --input .local/privacy/manifesto-2026-10-25.json --snapshot-at 2026-10-25T12:00:00.000Z --owner UUID_DO_OWNER --isolated
npm run privacy:recovery -- apply --input .local/privacy/manifesto-2026-10-25.json --snapshot-at 2026-10-25T12:00:00.000Z --owner UUID_DO_OWNER --isolated
```

No runtime da imagem, usar `node cli/privacy-recovery.js` com os mesmos argumentos após o modo, apontando `DATABASE_URL` exclusivamente para o banco restaurado. O caminho/data e UUID acima são exemplos a substituir pelo arquivo atual e metadados reais; segredos não entram nos argumentos. O relatório traz contagens, `pendingContacts`, `providerReconciliationPerformed=false` e `releaseAuthorized=false`. Arquivos inválidos, permissões amplas, limites excedidos, chave errada, snapshot anterior aos três meses de retenção ou manifesto anterior ao snapshot abortam.

Decisões concluídas são reaplicadas ao email antigo por fingerprint. Dependência externa/envio incerto fica bloqueado para conciliação; nenhum estado incerto é transformado em sucesso. Marcadores são repostos mesmo sem contato correspondente, para impedir recaptura. A retirada de marketing mantém amostra transacional quando entrega era permitida; bounce/complaint cancela outbox pendente e restaura a restrição. Causa desconhecida exige revisão. A ferramenta não comprova atualidade do arquivo em relação à origem perdida, não concilia conta externa e não autoriza liberar tráfego. [Seis grupos sintéticos e CLI](../artifacts/privacy-recovery/d104-results.json); restore físico da imagem atual permanece H04.

## D105 — Recuperar e conciliar pedidos pending

Atualizar a cópia externa do manifesto também ao registrar pending e ao resolver a pendência. Novas exportações são v2: pending de exclusão/correção não expira enquanto a conciliação estiver aberta; não confundir essa preservação operacional com prazo legal universal. O responsável deve revisar as pendências e comprovar a resolução.

Os comandos de D104 são os mesmos. Preview/apply exibem `manifestVersion`, `pendingCoverage` e `pendingDecisions`. Um v1 continua válido para decisões concluídas, mas não prova recuperação de pedidos pendentes; para o gate atual, usar v2 atualizado e conferir os contadores. Replay mantém pending mesmo quando a cópia restaurada parecer localmente removível, pois o backup pode ter perdido a dependência externa que motivou a pendência. Sem contato local, o marcador pending ainda impede recaptura/recriação pelo fluxo público ou supressão manual.

Enquanto pending existir, captura/confirmação e nova emissão/cadastro ficam bloqueados. O dispatcher cancela o outbox ainda pendente e a elegibilidade cancela etapas ainda não emitidas; não presume retirada de consentimento nem muda identidade. Trabalho já iniciado/incerto fica para conciliação; nenhuma tentativa incerta é reenviada para testar o resultado. Compensações/observações de provedor continuam condicionadas às flags e contratos próprios. Somente uma resolução owner explícita muda o estado da auditoria. [Sete grupos sintéticos D105](../artifacts/privacy-recovery/d105-results.json).

## D106 — Restore físico local e privacidade — 26/10/2026

D106 validou backup criptografado e restore físico local das 32 migrations, com mídia íntegra e replay do manifesto v2 separado do snapshot; completed é reaplicado e pending permanece pendente. A telemetria automática do Payload foi desativada após a barreira de rede detectar sua tentativa. Imagem atual, guarda externa do manifesto/backup, RPO/RTO reais e release continuam pendentes. [Evidência D106](../artifacts/recovery/d106-results.json) Fonte, dump e destino usam somente fixtures sintéticas. Preview não escreve; repetição mantém prazos; amostra independente é preservada, bounce cancela pendência e identidade sem decisão não é alterada. Flags seguem falsas; sem conta real, VPS ou deploy.

## D107 — Imagem atual e upgrade local — 26/10/2026

D107 construiu a imagem local atual e verificou 32 migrations em banco vazio e upgrade real de 6 para 32, preservando contato e owner sintéticos. Saúde, HTTP interno, ACL, runtime sem root/read-only/DDL, CLIs de privacidade e worker de retenção passaram em rede Docker internal, sem saída para provedores. Corrigidos o encerramento das CLIs de inventário/retenção após a limpeza do Payload e a renovação do heartbeat no ciclo ocioso do worker de retenção. A imagem não foi publicada. Bateria funcional integral do release, restore físico nesta imagem, destino externo/RPO/RTO, contas e VPS continuam pendentes. [Evidência D107](../artifacts/container/d107-results.json). As sondagens HTTP rodam no loopback do container; não homologam proxy, TLS ou acesso da VPS. Replay v2 na imagem usa manifesto vazio; decisões reais de fixtures pós-snapshot ainda exigem o ensaio físico nessa imagem.

## D108 — Restore físico com a imagem atual — 26/10/2026

D108 aprovou restore físico com a imagem D107: 32 migrations, mídia íntegra, seis decisões de privacidade posteriores ao snapshot e replay v2 dentro da imagem. Preview, exclusão/correção, pending, supressão/bounce e repetição sem renovar prazos foram verificados. A aplicação só iniciou depois do replay, com credencial de banco separada e limitada: saúde/catálogo/capa responderam 200, contatos privados 403 e amostra privada na rota pública 404. Rede interna sem portas publicadas; transportes e worker desligados. Destino externo, guarda atual do manifesto, RPO/RTO reais, bateria integral e homologações continuam pendentes. [Evidência D108](../artifacts/recovery/d108-results.json). Não houve nova migration, rebuild, dado real, conta externa, VPS ou deploy; identidade sem decisão e entregas incertas foram preservadas.

## D109 — Retenção de estado promocional — 26/10/2026

D109 implementa retenção local de estado promocional para contatos globalmente descadastrados há pelo menos 30 dias: remove assinaturas encerradas e calendários cancelados com etapas antigas, sem lote. Preserva identidade, amostras/outbox, consentimento, auditoria e supressão com o prazo original. Não executa exclusão de identidade nem forja pedido owner. Impedimentos de privacidade, provedor, envio incerto, vínculo cruzado e manifestos compartilhados/JSON preservam os registros. Preview é padrão; apply revalida sob locks e é atômico por contato. P07 continua parcial para identidade, demais finalidades e dados compartilhados. A imagem/restore D107–D108 são evidências da revisão anterior, não incluem esta rotina. [Oito grupos PostgreSQL sintéticos](../artifacts/privacy-retention/d109-results.json). Sem migration, chamada externa, dado real, nova imagem, VPS ou deploy.

## D109 — Operar retenção promocional — 26/10/2026

`npm run privacy:retention` continua como preview; `-- --apply` aplica categorias elegíveis. O worker usa DATA_RETENTION_ENABLED=true, falso por padrão, e registra suppressedMarketing sem IDs/emails. Exige chave estável LEAD_TOKEN_SECRET para conferir decisões de privacidade; falta de chave não autoriza apagar a categoria. Conferir preservações e conciliar pendências pelos fluxos existentes, sem editar manifestos ou remover cópias externas arbitrariamente. O processo é atômico por contato; erro posterior não reverte contatos já concluídos no job. Orçamentos excedidos interrompem a avaliação sem truncar referências.

## D110 — Retenção de identidade e recuperação — 26/10/2026

privacy-retention/worker incluem closedIdentities; preview é padrão e DATA_RETENTION_ENABLED segue falso. Conferir pendências e dependências antes de aplicar. Ausência de LEAD_TOKEN_SECRET válido preserva identidades/provas; ausência de BREVO_WEBHOOK_EVENT_SECRET válido diante de callbacks sem FK impede inferir ausência de vínculo. Preservar LEAD_TOKEN_SECRET durante a vigência dos fatos/auditorias de até 24 meses e a chave de callbacks para conciliar referências pseudônimas. Não recriar tombstone ausente nem renovar prazo de supressão por inferência. Guardar manifesto atualizado fora do snapshot, em canal privado; restaurar isolado, reaplicar e conciliar antes de liberar transportes.

## D111 — Operações em lote e diagnóstico PostgreSQL — 26/10/2026

O aviso pg/Drizzle foi reproduzido e corrigido no lote compartilhado por transação; não foi silenciado nem exigiu flag. O caminho corrigido preserva commit/rollback e aguarda cada documento. Instalar o lockfile atualizado é necessário; repetir testes afetados ao atualizar Payload/pg. Gates de segurança/homologação continuam abertos.

## D112 — Descadastro e retenção por assunto — 26/10/2026

Descadastro temático exige LEAD_TOKEN_SECRET válido para registrar o fato na mesma transação; falha não confirma retirada parcial. Guardar chave estável durante a vigência de fatos/auditorias (24 meses). O worker/CLI incluem withdrawnThemes, desligados por padrão. Conferir preservações antes de apply: ausência de fato, prova posterior, vínculo de provedor/manifesto, envio incerto ou orçamento excedido exigem conciliação. Não fabricar/backfill de prazo a partir de estado isolado. Exportar manifesto atual fora do snapshot; replay v4 isola apenas o assunto e preserva amostra/outros assuntos. Não recupera um opt-in perdido após o backup; liberar operação só após conciliação.

## D113 — Margem e acompanhamento do prazo — 26/10/2026

DATA_RETENTION_ENABLED continua false. Ao habilitar, worker exige LEAD_TOKEN_SECRET válido/estável antes de abrir o banco. Preview/apply incluem marketingDeadline; reviewRequired=true exige revisar dependências, sem remover incerteza ou dado externo arbitrariamente. A checagem de saúde falha por heartbeat ausente/antigo, sucesso ausente/corrompido/futuro/>25h, assinatura retirada há ≥30 dias ainda presente ou revisão ativa de opt-in pendente no marcador v2. Correlacionar com os contadores dos logs/CLI e estado privado; o heartbeat isolado não libera o gate. Após resolver exceções, executar novo ciclo controlado/reiniciar o worker autorizado para atualizar o registro; mero reinício sem resolução não apaga o problema. CLI de retenção não publica a marca do worker. Garantia operacional ainda exige continuidade, tempo de execução, alertas e recuperação do ambiente.

## D114 — Legado temático verificável — 26/10/2026

Rodar preview antes de apply e conferir legacyThemeWithdrawals.unverified/expired. Sem prova exata, não preencher data nem aplicar bloqueio global apenas para fazer o exportador passar. Erro de descadastro sem prova verificável exige conciliar histórico ou cobertura real existente; não liberar retorno/transportes com manifesto incompleto. Um fato automático antigo não cobre contato com nova finalidade. Exportação é read-only; backfill aplica data/vencimento originais. Provas nativas vencidas não renovam HMAC: backups aceitos têm até três meses, muito posteriores à retirada já encerrada há 24 meses. Vínculos de provedor/envio incerto e pedidos de dados continuam protegidos.

## D116 — Revisão de contatos ativos — 27/10/2026

Promoções com opt-in de marketing vencido (12 meses ou mais), ausente, inválido ou futuro ficam agendadas e retidas com `marketing_review_due`. O fluxo de envio reavalia o opt-in; não libera por entrega de amostra, abertura ou clique. Apenas novo opt-in explicitamente confirmado pelo titular atualiza a data e pode liberar etapas. Relatório privado apresenta apenas contagens agregadas de vencidos/sem data/futuros. O marcador de saúde v2 exige zero revisões pendentes e ciclo válido. `DATA_RETENTION_ENABLED` segue falso; antes de habilitar em produção, revisar a política e homologar imagem/alertas. Isso não exclui contato nem altera consentimento automaticamente.

D122 — imagem atual aprovada em banco vazio e upgrade 32→35, incluindo mídia/ACL/CLIs/worker em rede Docker interna. [Evidência da imagem](../artifacts/container/d122-results.json). [16 suítes HTTP](../artifacts/container/h03-http-d122-results.json) passaram no standalone QA atual com banco descartável removido; não foram executadas integralmente dentro do container. [Checks e limites](../artifacts/qa-release-layout/d122-checks.json). Sem publicação, conta externa, GitHub ou VPS. H05/P07 e gates externos continuam conforme pendências. Restore desta imagem/guarda externa só são exigidos se a capacidade opcional de recuperação for adotada; `--sem-backup` segue disponível.
