# 17 — Registro de decisões

[Índice](../README.md)

As decisões iniciais e visuais são de 20/10/2026; a seção de implementação registra a evolução autorizada a partir de 20/10/2026. Alterações futuras devem registrar motivo, impacto, migração e evidência; não apagar a decisão anterior. Estado vigente no [mapa de implementação](23-estado-atual.md); o limite documental D16 foi sucedido por D23.

| ID | Decisão | Justificativa / consequência |
|---|---|---|
| D01 | Marca Bibliotheon, pt-BR/BRL | Mercado inicial definido; internacionalização posterior |
| D02 | Next + Payload + PostgreSQL + Tailwind + TypeScript | Painel manual integrado e site no mesmo projeto |
| D03 | Docker Compose em VPS compartilhada | Isolamento por projeto; preservar proxy e sistemas existentes |
| D04 | Nenhuma IA no produto | Solicitação explícita; conteúdo cadastrado manualmente |
| D05 | Hotmart, Kiwify e Cakto | Links na fase 1; três conectores na fase 2, nenhum descartado |
| D06 | Checkout e entrega externos | Evitar duplicar operação de pagamento e acesso ao livro |
| D07 | Uma oferta principal, alternativas secundárias | Clareza de escolha; campanhas afiliadas fixam destino |
| D08 | Aquisição orgânica, sem aparecer | Conteúdo, amostras e distribuição manual; orçamento inicial baixo |
| D09 | Brevo gratuito como transporte; jobs no Payload | Evitar automação paga obrigatória; revalidar quotas |
| D10 | Primeiro livro prioritário, catálogo extensível | Aprender antes de dispersar divulgação |
| D11 | Sem rastreamento por identidade do comprador | Atribuição por referência comprovada ou desconhecida |
| D12 | Contatos com confirmação e marketing separado | Qualidade da lista e escolha explícita do interessado |
| D13 | Inbox durável, idempotência e conciliação | Integridade dos números mesmo com falhas/reenvios |
| D14 | Stack estável compatível, versões fixadas no bootstrap | Modernidade não elimina compatibilidade e patches |
| D15 | Cerca de R$ 50 adicionais/mês | Priorizar backup; anúncios não são dependência |
| D16 | Documentação agora, implementação depois | Escopo desta entrega não altera VPS nem cria aplicação |

## Alternativas adiadas

Astro/arquivos foi considerado, mas o painel e o domínio comercial favorecem Payload. CMS separado, microsserviços, Kubernetes, Redis, busca externa, CRM completo e analytics pago adicionariam custo operacional prematuro. Ferramentas gratuitas e experimentos A/B dependem de problema e tráfego, não de uma data arbitrária.

## Hipóteses que não são decisões comprovadas

Canal com melhor conversão, preço ideal, nicho vencedor, disponibilidade de 5–10h semanais e volume de vendas ainda não foram validados. A faixa de preço R$ 51–100 veio da conversa original e serve apenas como referência; cada oferta terá seu preço real. Domínio e primeiro título foram informados posteriormente em D34; capacidade livre da VPS permanece pendente.

## Evolução visual aprovada — 20/10/2026

| ID | Decisão | Justificativa / consequência |
|---|---|---|
| D17 | Conceito conhecimento em edição, identidade tipográfica e família editorial flexível | Briefing passa a ser fonte central visual; contratos comerciais mantidos |
| D18 | Source Serif 4 + Public Sans locais | Substitui recomendação inicial de fonte de sistema como identidade; sistema permanece fallback |
| D19 | Claro e escuro completos no site e painel | Substitui direção inicial somente clara; preferência sistema por padrão |
| D20 | Motion editorial expressivo com reduced-motion | Feedback funcional no painel; conteúdo/CTA imediatos |
| D21 | Três variantes de LP e três acentos em enums | Flexibilidade editorial sem CSS arbitrário nem checkout diferente |
| D22 | Skills como referências documentais | Sem instalação global, frontend, protótipo ou marca final nesta etapa |

Direção visual especificada não implica aparência validada nem melhoria de conversão comprovada. O [briefing](../DESIGN-BRIEF.md) detalha decisões e fontes.

## Implementação autorizada — 20/10/2026

| ID | Decisão | Justificativa / consequência |
|---|---|---|
| D23 | Desenvolver e validar a aplicação localmente | Pedido atual sucede o limite documental de D16. GitHub e deploy na VPS ficam com o proprietário; sem alterações remotas |
| D24 | Payload 3.91.0 / Next 16.4.2, pacotes exatos e pnpm 10.34.7 | Matriz do pacote oficial mais restritiva que página geral; migrações explícitas, PostgreSQL 17 e testes antes de declarar compatibilidade |
| D25 | CSP com nonce por requisição nas páginas; SSR dinâmico | Next injeta nonce em scripts internos e bootstrap usa o mesmo nonce. Cache será restrito às consultas/projeções públicas; sem cache compartilhado de HTML administrativo |
| D26 | Preferência visual local e cookie funcional nativo Payload | Site espelha escolha explícita em payload-theme para o RootLayout do painel conhecer o tema antes do paint. Sem ID, analytics ou cookie do comprador. Provider Payload continua autoridade no painel |

## Continuidade da implementação — 21/10/2026

| ID | Decisão | Justificativa / consequência |
|---|---|---|
| D27 | Hosts de checkout aprovados separadamente por plataforma | CHECKOUT_ALLOWED_HOSTS_HOTMART/KIWIFY/CAKTO substituem lista genérica; evita aceitar destino de outra plataforma em campanhas afiliadas. Valores vazios desabilitam URLs até revisão do operador |
| D28 | Sitemap dinâmico, sem snapshot do catálogo no build | Teste detectou sitemap vazio persistido no build; consultar projeções publicadas em cada requisição |
| D29 | Executar build standalone também na validação local | Mesmo artefato de runtime previsto para container, com arquivos estáticos copiados e MEDIA_DIR explícito para compartilhar uploads com CLI. Sem deploy |
| D30 | Dashboard operacional pelo ponto views.dashboard do Payload | Contagens editoriais reais e próximos passos substituem organização de widgets desnecessária e seus controles sem rótulo detectados pelo axe. Navegação, autenticação e formulários nativos preservados; CSS usa BEM suportado para áreas de toque e indicador decorativo |
| D31 | Patches locais de acessibilidade em Payload 3.91.0 (ui, next e richtext-lexical) | Axe identificou seleção sem rótulo e falhas nos formulários nativos. Patches pnpm corrigem nomes, semântica e foco; CSS amplia áreas de toque. Mantêm seleção, editor, ordenação e permissões. Nenhuma manipulação do DOM ou regra axe desativada. Revalidar/remover quando houver correção upstream |
| D32 | Atualizações de segurança: Sharp 0.35.5, Sass 1.106.0, DOMPurify 3.4.16 e esbuild 0.28.2 | Auditoria de produção encontrou sete alertas, quatro altos. Overrides exatos removem transitivos afetados; novo lockfile exige revalidar build, uploads, migrations e imagem. Nenhum advisory foi ignorado |
| D33 | Token de confirmação gerado no worker, só hash no banco | Outbox guarda IDs, nunca corpo/email/link em jobs. O worker grava o hash e estado sending antes do transporte. Crash/timeout incerto exige conciliação, sem reenvio cego. Download usa assinatura de finalidade própria/24h; descadastro usa token independente de 32 bytes/180 dias, apenas hash, permitindo links simultâneos válidos |
| D34 | Primeiro lançamento e domínio informados em 21/10/2026 | “Crie Sistemas com IA e Ganhe Dinheiro”, bibliotheon.com.br e Warley Ferraz Almeida registrados. E-mail público ficará vazio até o proprietário preenchê-lo antes da produção; público específico, preço e elegibilidade não são presumidos. Nenhuma mudança na decisão de produto sem IA |
| D35 | Isolamento opcional do build de QA com NEXT_DIST_DIR e TEST_BASE_URL | A prévia gerenciada usa porta 3000/.next e pode reaparecer após encerramento do servidor manual. QA de produção usa .next-qa/porta separada para preservar a prévia e impedir sobrescrita de caches. Docker/CI conservam a pasta padrão em ambiente isolado; testes HTTP aceitam apenas loopback |
| D36 | Apresentação administrativa pt-BR e runtime America/Belem | Rótulos, nomes de opções e arrays são traduzidos sem mudar chaves ou valores persistidos. Datas mostram dd/MM/yyyy HH:mm, com runtime/container em America/Belem e armazenamento ISO UTC preservado. Sent significa aceitação pelo transporte, não prova de chegada à caixa postal. Coleções operacionais são somente leitura no painel e continuam negando mutação por API |
| D37 | Body administrativo sem falso scroll vertical | A ordenação por teclado calculava o destino correto, mas overflow-x:hidden tornava overflow-y:auto no body, que não era o scrollingElement real. O sensor tentava rolar esse elemento sem efeito. overflow-x:clip e overflow-y:visible preservam o corte horizontal existente e deixam a rolagem no documento; não substituem o sensor nem removem a ordenação |
| D38 | Supressão revisada por owner, sem importar consentimento | View e API próprias usam sessão/origem exata; CLI lê stdin privado. ConsentEvent registra motivo, fonte e HMAC da referência; mesma referência conflitante é recusada. Lock de contato compartilhado com captura evita corrida na criação. Complaint não é rebaixado por bounce/descadastro; entregas já iniciadas não são declaradas canceladas. Conferência no Brevo permanece manual até sincronização homologada |
| D39 | Recuperação inicial do owner pelo operador do host | CLI por stdin privado troca senha da conta única, revoga sessões/tokens e limpa bloqueio/cooldown. Sem criar conta ou enviar e-mail. Forgot/reset públicos retornam indisponibilidade genérica, sem gerar tokens, e unlock público é negado. Recuperação por e-mail exige homologação própria antes de habilitar; não reutilizar confirmação de amostra |
| D40 | Snapshot manual e calendário único por material/versão | Novas confirmações com assinatura efetiva criam quatro etapas duráveis; cópia anterior permanece imutável, revisão de conteúdo aumenta explicitamente. Desativação/descadastro cancelam sem reinscrição automática. Preparação local não significa disparo, reserva de quota ou aceite do Brevo |
| D41 | Material vinculado a uma amostra preserva seus bytes | Substituir mídia ou livro exige nova versão; versão já usada não pode ser reaproveitada. Upload em mídia vinculada é recusado: enviar outro arquivo e associá-lo à versão nova. Locks e conferência da revisão evitam troca concorrente sob a mesma versão. Metadados acessíveis continuam editáveis |
| D42 | Geração de tipos Payload por comando explícito | A prévia gerenciada iniciou repetidamente filhos payload generate:types, consumindo CPU/memória durante o build isolado. typescript.autoGenerate=false preserva a prévia e o arquivo versionado; após mudanças de schema, executar npm run generate:types antes de TypeScript/build. Sem desligar checagem de tipos ou encerrar o servidor gerenciado |
| D43 | Leitura do snapshot sem editor de JSON e header limitado à viewport | QA encontrou conteúdo cortado, contraste do editor e overflow com breadcrumbs longos. Campo server suportado apresenta quatro etapas em disclosures somente leitura, com dados de conferência secundários; schema e ACL permanecem. CSS BEM permite encolher/rolar os breadcrumbs, amplia limpar seleção e mantém alvo mínimo do combobox, sem mudar sensor de arraste ou regras axe |
| D44 | Teclado usa a política de rolagem CSS | Sensor nativo permanece; opção scrollBehavior:auto no patch UI evita smooth forçado mesmo com reduced-motion. Diagnóstico descartável confirmou troca real de ordem com rolagem imediata. QA aguarda dois frames após ativação (listener é instalado na próxima task), mantém transformação/ordem/draft e acrescenta estabilidade da rolagem reduzida. Sem sleep fixo ou override de protótipo no produto |
| D45 | Quota compartilhada com reserva transacional conservadora | Uma contabilidade por dia UTC e destinatário; teto inicial até 250, reserva padrão 50. Promoções futuras respeitam total menos reserva, mesmo após consumo transacional. Lote indivisível e claim na mesma transação da reserva; resultado incerto não devolve capacidade. Não presume créditos/reset da conta Brevo nem implementa disparo promocional |
| D46 | Deploy por clone e atualizador solicitado em 22/10/2026 | Acrescenta build na própria VPS ao fluxo externo anterior, sujeito a inventário/capacidade. atualizar.sh executa pull fast-forward, imagem de tag exclusiva/ID verificado, backup externo, migrations e saúde; altualizar.sh é alias. Lock/checkpoint, configurações privadas fora do Git e banco/volumes preservados. Falha após iniciar migration não retorna código/schema cegamente; retomada explícita. Testes simulados/configuração local não são homologação na VPS |

| D47 | Exclusão física de mídia diferida e coleta com carência | Reprodução local confirmou perda por ENOENT antes de rollback. Patch opt-in em Payload 3.91.0 preserva bytes em Media; uploads usam UUID novo. Coleta compartilha lock transacional, consulta referências e só exclui órfãos regulares após 24h da primeira observação persistida. Backup diário confirmado precede coleta; não confundir com retenção de dados pessoais. Revalidar patch a cada atualização do CMS |

| D48 | Lotes promocionais locais com membros e cópia imutáveis | Agrupa tema/etapa/dia previsto UTC e snapshot de revisão/oferta/contexto afiliado. Locks de montagem/contatos impedem duplicação; referências persistem junto das etapas. Claim interno revalida elegibilidade e reserva destinatários únicos na mesma transação. Lote indivisível sem quota aguarda próximo dia UTC. Cancelamento libera etapas elegíveis para novo lote, preservando histórico. Worker prepara, mas ainda não toma/envia lotes antes da sincronização e conciliação Brevo |

| D49 | Fila durável para reforçar bloqueios de marketing Brevo | Descadastro/supressão e intenção outbound na mesma transação; flag separada desligada por padrão. GET projeta apenas ID/bloqueio, PUT envia só emailBlacklisted=true e GET confirma. Sem criação de contato, troca de endereço ou reativação automática. Revisão/lease protegem contra conclusão antiga; retentativa idempotente e backoff, recusa definitiva exige intervenção. Conta real e sincronização inbound/listas/campanhas ainda pendentes |

| D50 | Conferência recente e importação pontual de bloqueio antes do claim | GET autenticado de cada destinatário único antes da reserva, fora da transação. Prova privada persistida vincula lote/versões locais/IDs do provedor por até cinco minutos; claim revisa elegibilidade/identidade/prova sob locks. Ausência/falha não autoriza quota ou criação de contato. Blacklist observada tem action própria, sem inferir bounce/complaint, e cancela marketing atomicamente. Downgrade recusa perder registros novos. Não envia campanhas nem substitui homologação/webhook |

| D51 | Cadastro de contatos consentidos com reconciliação e compensação duráveis | Fila atômica com confirmação de marketing, flag própria false e dependência do canal de bloqueios. GET antes/depois de POST mínimo, updateEnabled=false e forceMerge=false; nunca atualizar/reativar existente. Revisão/lease e histórico de tentativas evitam conclusão antiga. Descadastro em voo mantém canceling até confirmar bloqueio, sem concluir só por 404 de criação incerta; cleanup continua com criação desativada. Cadastro não é lista/campanha/envio e não dispensa preflight |

| D52 | Lista exclusiva por lote, com composição reconciliada | Manifesto e inclusões tentadas persistidos antes do HTTP; ID retornado preservado mesmo após descadastro. Criação incerta busca nome opaco/pasta, sem POST cego; adoção explícita confere metadados. Inclusões limitadas a 150 IDs, reconciliação por GET e conjunto exato. Não reincluir tentativa incerta, remover terceiros ou presumir flags opcionais. Lease e validade de composição/contatos protegem ready. CLI privado desativado, fora do worker; sem campanhas ou envio |


## D53 — Cancelamento por assunto sem reativação — 22/10/2026

A página de preferências mantém o cancelamento global e acrescenta consulta explícita e cancelamento temático via POST autenticado pelo token opaco existente. GET não consulta dados privados nem altera consentimento. O serviço só apresenta assinaturas do contato; não aceita inclusão/reativação, endereço ou identificação de outro contato. Token válido não permite assinar tema novo. Uma nova assinatura continua exigindo pedido e confirmação.

Cancelamento temático, auditoria e cancelamento das inscrições/etapas daquele tema são atômicos sob o mesmo lock de contato dos demais fluxos. Outros assuntos ativos permanecem elegíveis. Lotes já preparados são revalidados antes do claim. Retirada do último tema cancela cadastro externo pendente e enfileira bloqueio de marketing no Brevo, mesmo com sincronização desligada; não grava supressão global local, pois não é ação de cancelamento global. O provedor nunca é desbloqueado automaticamente numa confirmação posterior. Campos existentes bastam; nenhuma nova migração. Personalização dos links em campanhas Brevo continua pendente.


## D54 — Links individuais de preferências no Brevo — 22/10/2026

Usar somente o atributo normal/text BIBLIOTHEON_PREFERENCES, previamente criado e homologado pelo operador na conta, com placeholder {{ contact.BIBLIOTHEON_PREFERENCES }}. Confirmar schema, ID/endereço, bloqueio e valor antes/depois de PUT exclusivo do atributo; nunca enviar EMAIL, flags de blacklist, listas ou forceMerge nessa operação. Nenhuma criação automática de atributo/contato. 204 não comprova valor e timeout aplicado pode ser reconciliado por GET.

Token opaco derivado por HMAC com finalidade própria, contato e nonce aleatório, recuperável apenas em memória com a chave privada. Persistir hash/nonce/chave de origem antes de HTTP, reutilizar por contato e manter expiração original de 180 dias. Renovar quando restarem sete dias ou quando a chave mudar; preservar registros anteriores até sua validade original, sem renovar links antigos silenciosamente. Uso da mesma intenção por contato evita que lotes concorrentes sobrescrevam o atributo com links de outro titular. A URL contém apenas token e não endereço/ID.

Preparação privada de lote exige preflight, revalida consentimento/identidades/tokens no fim e guarda apenas referências/expiração em preferenceCheck, com validade de cinco minutos da observação mais antiga. Descadastro em voo vence e impede conclusão; PUT já emitido pode terminar apenas atualizando o link de retirada. Nenhuma reserva/quota/campanha/envio; CLI fora do worker, flag BREVO_PREFERENCE_SYNC_ENABLED=false. Intenção de token é durável; repetir PUT do mesmo atributo/valor é idempotente após consulta, sem criar um transporte genérico. 13a migração aditiva; downgrade recusa perder nonces/intenção/conferências. Homologar renderização real e revalidar novamente no futuro transporte.


## D55 — Criação e reconciliação de rascunhos Brevo — 22/10/2026

Criar campanha classic sem scheduledAt/sendAtBestTime, com lista exclusiva e remetente homologado por ID. Sem envio, teste de envio, edição ou exclusão no adaptador. HTML de texto manual escapado, sem executar HTML do conteúdo; delimitadores de template no assunto recusados. Somente placeholders próprios de preferências e cancelamento nativo. Cópia/hash imutáveis no manifesto por lote; GET deve confirmar estado/assunto/HTML/remetente/lista sem destinos adicionais ou agendamento. Não relaxar comparação silenciosamente se a conta normalizar HTML ou retornar campos inesperados; homologar contrato real primeiro.

Intenção commitada antes de POST, ID retornado retido antes de conferir metadados, lease para respostas antigas e reconciliação por nome exato paginado (limite local mil campanhas) ou ID revisado. Não repetir criação incerta por ausência ou timeout; só rejeição explícita sem ID permite retry privado. Conflitos não são resolvidos editando recurso do provedor; observedIds mantém inventário, inclusive colisão de ID entre lotes.

Listas/preferências/preflight frescos e revisão de consentimento/tokens no fim são obrigatórios. Rascunho ready é observação de cinco minutos, sem quota ou aceitação de envio. BREVO_CAMPAIGN_SYNC_ENABLED=false, CLI privado fora do worker e sem chave nova de SMTP. 14a migração aditiva, downgrade protegido; órfãos/limite de consulta ficam sob retenção B12. Homologação real de remetente/HTML/placeholder e controle de disparo continuam pendentes.


## D56 — Intenção de disparo e quota atômicas — 24/10/2026

POST sendNow exige pré-requisitos completos e rascunho conferido. Preparação usa lease por lote; a reserva de quota e a intenção de emitir (tentativa/token/dia/contagem) pertencem ao mesmo commit. HTTP ocorre depois, sem locks de banco em espera de rede. Falha antes do commit não emite; falha de registro após HTTP conserva intenção/quota para reconciliação. Janela entre commit e POST é intenção, não prova de envio; descadastro após emissão pode encontrar pedido em voo e não promete recall.

204 significa solicitação aceita/agendada, não entrega. Somente 400/402/404 documentados são recusas confirmadas; respostas desconhecidas, throttling, falhas/timeout ficam incertas. Não repetir nem devolver quota por incerteza, mesmo se não houver resultado observado. Após 30 minutos, intenção issuing abandonada pode virar uncertain sem rede; resposta tardia do mesmo attemptToken pode confirmar solicitação, sem outro POST.

Retry de rejeição exige opção privada explícita, revisão de consentimento/material/oferta/identidades/listas/preferências/cópia e novo token/reserva. Histórico anterior preservado; não reativar inscrição ou retargetear campanha. Worker não dá retry de recusa/incerteza; flag BREVO_CAMPAIGN_SEND_ENABLED=false por padrão, dependente do pipeline completo. Até 20 candidatos e uma nova campanha por ciclo, recuperando somente estados locais de emissão abandonada.

15a migração conferida no banco local. Corrigido seu down para recriar índice parcial na troca do enum, sem mudar up já aplicado; fixture de migração 14 deve reverter dependência 15 antes. APIs públicas/owner não alteram tentativas. Observação/webhook/conciliação externa e homologação de quota/reset/remetente/templates continuam pendentes.


## D57 — Observação separada do histórico de disparo — 24/10/2026

GET da campanha compara ID/cópia/hash/remetente/lista com o manifesto original. Estados nativos da resposta individual são draft, sent, archive, queued, suspended, in_process, in_review, cancelling e cancelled; os filtros de listagem usam inProcess/inReview. Fontes oficiais revalidadas: [consulta individual](https://developers.brevo.com/reference/get-email-campaign), [enum da resposta no SDK](https://raw.githubusercontent.com/getbrevo/brevo-node/main/src/api/resources/emailCampaigns/types/GetEmailCampaignResponse.ts) e [enum do filtro](https://raw.githubusercontent.com/getbrevo/brevo-node/main/src/api/resources/emailCampaigns/types/GetEmailCampaignsRequestStatus.ts). Não importar convenções de endpoints de processos.

queued/in_process/in_review/sent registram atividade observada da campanha em coleção privada própria, com estado observed no disparo/etapas elegíveis. Não comprovam autoria exclusiva do POST, entrega individual, abertura, compra ou receita. Histórico HTTP e código efetivamente recebidos permanecem separados; GET não inventa 204 nem devolve quota. Atividade positiva nunca é apagada por regressão/erro posterior e bloqueia retry. Outros estados/404/erro/conflito não autorizam reenvio. sent/archive/cancelled encerram polling automático; atualização explícita continua possível.

Fila criada atomicamente com intenção/quota e preenchida para tentativas anteriores na 16a migração. Lease de 30 minutos e attemptToken impedem resposta antiga e retentativa durante consulta; intervalo mínimo automático de 15 minutos. GET fora da transação; gravação local atômica sem alterar contato/consentimento. ACK tardio mantém observed e registra o resultado HTTP real. Downgrade recusa observações consultadas, lease ou prova positiva. Índice parcial é recriado ao reverter enums.

BREVO_CAMPAIGN_OBSERVE_ENABLED=false por padrão. Chave de API é a única dependência externa da observação; worker pode apenas observar, com SMTP/envio/cadastro desligados. Até uma observação por ciclo do worker, independente de nova emissão. Estatísticas, emails e resposta bruta descartados. Homologação real, webhook e conciliação por destinatário continuam pendentes.


## D58 — Webhook de marketing e resultados por destinatário — 24/10/2026

Contrato revalidado nas fontes oficiais: [segurança](https://developers.brevo.com/docs/secured-webhooks), [eventos](https://developers.brevo.com/docs/marketing-webhooks), [criação](https://developers.brevo.com/reference/create-webhook), [retry](https://developers.brevo.com/docs/retry-mechanism) e [batch](https://developers.brevo.com/docs/batch-webhooks). API key autentica a configuração da conta; o callback usa auth.type=bearer com token privado independente. Não inventar assinatura HMAC da Brevo; HMAC local serve apenas para minimizar dados/deduplicar. Seleção hardBounce/unsubscribed difere dos corpos hard_bounce/unsubscribe. Escopo inicial: marketing/email, batched=false; não aceitar arrays sem contrato de envelope homologado.

POST /api/webhooks/brevo autentica antes de ler corpo/abrir banco. Limite 32 KiB/5 segundos para leitura; JSON individual com ID/camp_id inteiros positivos, email canônico, ts_event/ts_sent UTC inteiros coerentes, tolerância futura de cinco minutos. Apenas delivered/hard_bounce/soft_bounce/spam/unsubscribe são processados; demais nomes válidos são ignorados, sem analytics. Campos extras, strings locais de data, ts ambíguo, IP, URLs, razão e corpo bruto não persistem.

BREVO_WEBHOOK_ENABLED=false por padrão, com token atual/anterior para rotação e BREVO_WEBHOOK_EVENT_SECRET estável, independente do token, sessão e chave de links. Flag não depende da API key nem ativa envio/worker. Configuração inválida/desligada, falha de leitura ou banco retorna 429 com Retry-After; a documentação do provedor indica descarte após 5xx e 4xx exceto 429. Autenticação inválida é 401; JSON/envelope inválido 422, corpo grande 413 e MIME/encoding incompatível 415. ACK 200 de evento suportado somente após commit. Falhas não imprimem corpo/segredos.

Migração 17 cria inbox privada brevo-webhook-events e brevo-delivery-receipts. Chave semântica HMAC de evento/campanha/timestamps/destinatário; ID do webhook isolado não identifica evento, e mudança desse ID não duplica a mesma ocorrência. Envelope contém somente relações existentes, impressão HMAC, IDs e datas/tipo/estado mínimos. Contato desconhecido fica em quarentena sem criar cadastro e nunca é reassociado automaticamente ao cadastro futuro. Replay explícito usa envelope normalizado, sem rede; requer revisão na conta para casos sem identidade retida.

Migração 18 registra recipientIdentities no commit da intenção/quota, antes de POST, usando HMAC por email com chave de links e domínio separado. Não alterar up já aplicado da 17 nem inventar backfill com endereço atual para disparos históricos. Retry exige identidade histórica idêntica. Resultado individual exige manifesto/cópia/hash/ID de campanha íntegros, envio temporalmente compatível, contato no conjunto e impressão histórica correspondente. Histórico sem prova ou endereço alterado fica em quarentena, sem atribuir entrega. Downgrade de 17/18 recusa perda de envelopes/resultados/identidades capturadas.

Notificações negativas de contatos conhecidos aplicam supressão mesmo se a campanha não estiver mapeada. unsubscribe nativo é tratado conservadoramente como retirada global local; preferências temáticas continuam no link próprio. Registrar data original no envelope e data de recebimento na supressão impede confirmação pendente antiga de sobrepor retirada recém-chegada. Hard bounce/reclamação restringem deliveryState e cancelam transacionais pendentes; unsubscribe preserva amostra solicitada. Soft bounce não retira consentimento. Nunca há desbloqueio, nova assinatura ou devolução de quota por evento positivo.

Provas de entrega/devoluções/spam/cancelamento ficam em datas separadas por etapa; chegada fora de ordem não apaga outro resultado. Delivered é relato do provedor, sem comprovar leitura ou compra. Atividade correlacionada marca send observed e revoga lease de preparação concorrente; callback de retry não pode rearmar envio. HTTP efetivamente recebido continua no histórico, sem fabricar 204. Supressão, inbox e resultado pertencem à mesma transação; efeitos externos de bloqueio são apenas enfileirados. Homologação da conta, notificações reais, recuperação/retenção e operação externa continuam pendentes.


## D59 — Medição própria consentida e saídas de checkout — 24/10/2026

ANALYTICS_ENABLED=false por padrão; habilitação também exige legalReady institucional. Analytics é separado de consentimento de marketing, login e comprador. GET de preferência não cria permissão/identificador/sessão. Aceite explícito emite 32 bytes opacos em cookie __Host/HttpOnly/Secure/SameSite=Lax em produção; somente SHA256 persiste. Permissão versionada expira em 180 dias sem renovação silenciosa. Recusa usa cookie de preferência com valor igual para todos, sem identificador. Retirada revoga a permissão sob o mesmo lock usado para eventos, limpa cookie e impede reuso; novo aceite cria token novo. Retirada existente permanece disponível quando medição/aviso estão desativados. API não expõe token, grantId, visitId ou clickId em JSON.

Migração 19 aditiva: analytics-grants, visits, page-views, checkout-clicks, analytics-limits e Campaign.utmTerm. Coleções privadas, sem escrita por REST/owner. Não guardar IP, user-agent, referer, URL/query completa, email ou vínculo ao contato/comprador. Limites em banco: 120 novas permissões/minuto global e 60 eventos/minuto por permissão; sem impressão de IP antes de consentimento. Limites agregados têm expiração para futura retenção B12. Não chamar tráfego medido de pessoas únicas. Downgrade recusa registros/códigos históricos, sem remoção automática de provas.

POST /api/v1/events aceita somente page_view com UUID por ocorrência e caminho público existente; páginas com token, admin, preview, API e query não são medidas. Idempotência por permissão/evento, relógio do servidor, origem estrita e corpo até 2 KiB. Nenhum evento de compra do navegador. Sessão é criada apenas no primeiro evento/clique consentido e expira após 30 minutos inativa. Cookies inválidos/revogados/expirados não autorizam evento e não criam substituto silencioso. Falha reverte sessão/contexto/evento na mesma transação.

First-touch inclui entrada direta; último toque não direto só muda por campanha válida e é preservado em navegação direta até fim da janela de 30 dias. Nova janela não prolonga silenciosamente a atribuição anterior. UTMs só vêm de códigos registrados/revisados em campanha ativa/oferta disponível; coincidência com metadata é obrigatória. Formatos de email/URL/número longo são recusados; revisão humana ainda é necessária. Não captar parâmetros livres do referrer ou query. Gerador no formulário Campaign produz URL interna com c/UTMs cadastradas; registros legados fora do limite de códigos não são adivinhados como fonte. Canonical continua sem query.

GET de checkout válido grava saída operacional sem identificador do navegador quando não consentido; com permissão válida pode referenciar sessão/contexto. Ambos são requisições de saída, incluindo possíveis robôs, nunca pessoas únicas ou compra. HEAD/prefetch não são contados. Falha de medição não bloqueia destino já validado. URL externa permanece intacta, sem acrescentar clickId antes de contrato/homologação por provedor. Dashboard exibe sessões iniciadas, páginas, saídas totais e saídas consentidas em sete dias, sem calcular taxa entre populações diferentes.

Controle de consentimento no fluxo normal do rodapé, aceitar/rejeitar com peso equivalente, revogação acessível e foco restaurado; sem modal promocional, dependência paga ou identificador em localStorage. BroadcastChannel comunica mudança de escolha sem IDs. Falha ao confirmar mudança pausa medição nesta página e permite retry. A coleta no navegador depende de JavaScript; compra permanece independente. Retenção/exclusão B12, inbox/adaptadores comerciais B07–B10, atribuição de compra validada e relatórios completos permanecem pendentes. D59 não conclui B07 nem habilita operação real.


## D60 — Contrato comercial mínimo e projeção reconstruível — 24/10/2026

Antes de persistência/rotas comerciais, implementar regras puras em commerce/events.ts e commerce/projection.ts. A projeção usa fatos já autenticados e mapeados, sem buscar fornecedor ou catálogo. Nenhum retorno prepared/projected é ACK de webhook, compra homologada ou prova de recebimento. Hotmart, Kiwify e Cakto continuam no contrato, com escopos independentes de conta/transação/evento. Os adaptadores reais seguem pendentes e precisam de verificação oficial antes da implementação.

O contrato anterior tinha refundedCents sem declarar se era valor acumulado ou de uma operação. Extensão explícita: refundBasis=cumulative|operation e externalRefundId para operações; chargebackCents separado. Não presumir essa semântica do evento nativo. A [documentação Hotmart](https://developers.hotmart.com/docs/en/2.0.0/webhook/purchase-webhook/) foi consultada publicamente, mas nomes de estado não provam quantia, base de refund ou campo de liquidação. Nenhum campo nativo novo foi mapeado nesta etapa.

Validador exige dinheiro inteiro seguro, moeda explícita, UTC válido, IDs opacos e conta/provider iguais à configuração local. Campos de comprador/segredos/extras não entram no envelope. Bruto/devolução/chargeback são não negativos; taxas e líquido explicitamente informados podem ter sinal, sem derivar lucro ou recebimento. Ausências são null, nunca zero inferido. Tipos de assinatura/unknown autenticados podem gerar envelope ignorado mínimo sem inventar transação.

Preparação chama verify sobre cópia dos bytes originais antes de normalize, limita 256 KiB e não expõe exceção/segredo. Snapshot de bytes é independente do caller/adaptador; não se autentica um corpo e normaliza outro por mutação externa. Evento/identidade/digest têm hashes canônicos separados: evento provider/account/eventKey, transação provider/account/transactionId. ID de transação não deduplica todos os eventos. Mudança de conteúdo com mesmo ID é conflito, inclusive em replay com versão distinta.

Projeção é reconstruída por tempo original, preservando histórico do caller. Aprovação antiga recebida depois de refund não reabre o estado; empate conflitante, mudança de produto/moeda/valor, regressão paga/devolução ou quantia excessiva exige needs_review, preservando projeção anterior no futuro writer. IDs de operação impedem somar notificações repetidas; checkpoints acumulados cobrem operações anteriores. Valor tardio da mesma operação preenche lacuna uma vez; operação já coberta não é somada de novo, e incompatibilidade com checkpoint é revisão. Sem base/identidade confirmada não se inventa total.

Chargeback permanece distinto e sinaliza sobreposição com refund; não gerar uma segunda dedução nem um líquido derivado. settledCents continua null nesse domínio de webhook: liquidação será evidência própria de conciliação B11. Recebido, bruto aprovado, líquido informado e lucro permanecem conceitos separados. Moedas diferentes não são combinadas ou convertidas.

D60 ainda não implementa inbox durável, transações em PostgreSQL, ACK, worker comercial, replay administrativo ou conectores. Próxima entrega B07 deve persistir envelopes/colisões e histórico antes de confirmar, mapear catálogo sem fallback indevido, cercar leases e manter auditoria de retry; só depois conectar cada provedor com fixtures de seu contrato real.


## D61 — Inbox e histórico comerciais comuns antes dos adaptadores nativos (24/10/2026)

Implementar persistência comum aproveitando PostgreSQL/worker existentes, sem broker. Receptor interno só retorna received após commit de envelope mínimo e auditoria; adaptador verifica corpo original antes de normalizar. Escopo/chave/hash e versão ficam preservados. Duplicata não cria fato, colisão conserva outro envelope e mantém revisão sem substituir projeção. Nenhuma rota pública recebe o tipo normalizado.

Processamento usa lease/token, locks por evento/transação/produto, catálogo exato e reconstrução integral de fatos no commit. Oferta só é vinculada por ID explícito; desconhecido/ambíguo fica em revisão. Erro financeiro conserva a última projeção válida; fato divergente é preservado. Identidade da oferta com histórico fica congelada; novo cadastro representa outra identidade. Valores conhecidos não viram liquidação.

Cinco tentativas automáticas com backoff de 30 segundos até uma hora; manualmente owner reabre o orçamento por attemptBase, conservando attempts acumuladas. Retry exige autenticação/origem exata e motivo fechado auditável, não substitui envelope ou resolve colisão. Applied/ignored continuam inalterados e registram a ação. COMMERCIAL_EVENTS_ENABLED=false; CLI desligado não abre banco. Worker somente comercial não prepara/envia campanhas nem exige credencial Brevo.

Migração 20 protege dinheiro inteiro seguro, tentativa/lease e unicidade; down recusa histórico existente. Fixtures usam adaptadores internos sintéticos dos três provedores, sem alegar autenticação/eventos nativos. B07 continua parcial: falta observabilidade consolidada/ação visual homologada e compra atribuída. Adaptadores B08–B10, conciliação B11, retenção B12 e validação integral do release permanecem pendentes.


## D62 — Acompanhamento e retry pela administração (24/10/2026)

Manter a administração suportada pelo Payload. Uma view privada /admin/commercial-inbox consulta os três provedores e lista eventos por provider/state/event UUID com paginação de vinte. Default attention reúne failed, needs_review, colisões inclusive em applied e lease de processing vencido. Contagens são eventos, não vendas; fila/processamento/atenção podem se sobrepor. Datas exibidas em America/Belem e sucesso só existe com lastSuccessAt persistido; ignorado não fabrica aplicação. Provedor continua com recepção nativa não homologada.

Resumo e consulta exigem owner antes de acesso ao banco e usam overrideAccess:false. Lista seleciona somente campos operacionais, sem envelope/hash/lease/chave da transação. Filtros são validados; consulta não altera registros. Dashboard mostra fila/processamento/atenção e link de acompanhamento. Falha de consulta tem saída recuperável sem detalhes do banco.

Retry usa o endpoint D61 com motivo controlado e conferência explícita; ação é desabilitada para pending/applied/ignored, colisão e processamento ainda ativo. Disponibilidade visual e worker compartilham o prazo de lease, mas a API continua sendo autoridade contra concorrência. Resposta de sucesso e foco permanecem em área estável quando o evento sai do filtro após refresh. Erro conserva os campos e não simula confirmação.

Não aninhar formulário de retry no formulário nativo de edição do CMS. O detalhe readonly mostra ações recentes e link por UUID ao acompanhamento; envelope e histórico permanecem protegidos. Dois temas, tokens existentes, campos nativos e details/summary reusados, sem cores novas ou animação decorativa. Validação renderizada é local/sintética e registrada separadamente; não conclui autenticação nativa, financeiro, atribuição de compra ou homologação integral do produto.


## D63 — Hotmart v2 autenticado e evidência financeira mínima (24/10/2026)

Implementar primeiro adaptador nativo mantendo a inbox D61/D62. Campos cotejados em fontes oficiais consultáveis/indexadas, sem extrapolar v1/bibliotecas. Hottok estático de conta em cabeçalho, comparação segura, HTTPS público; não é HMAC do corpo. Conta vem do ambiente local, não do JSON. Fábrica Payload só é resolvida depois de autenticação e normalização. Resposta 200 após commit, inclusive duplicata/colisão durável; nenhuma confirmação em falha de persistência. Recepção independente do worker; tokens exclusivos do app.

Money usa lexema numérico original via reviver source do Node fixado, com conversão exata para centavos sem coerção/arredondamento. Só moedas reconhecidas de duas casas são aplicadas automaticamente; outra precisão fica em revisão com valor desconhecido. full_price é bruto pago, preço da oferta não é substituto. Não usar comissões ou diferença de preços para deduzir taxa/líquido, nem usar bruto como devolução/liquidação.

Evidências opcionais sourceEvent/sourceCreatedAt/approvedAt e reviewReason controlado no JSON, sem migração. Preservar exatamente o hash legado sem extensão; presença explícita de approvedAt:null significa desconhecido e participa do digest. Aprovação real vem de approved_date quando conhecida; criação da notificação fica separada. Para APPROVED/COMPLETE, ordenar evidência pela aprovação original quando disponível, evitando uma notificação tardia apagar reversão. COMPLETE sem data original, protesto, formato fora de venda avulsa ou precisão sem suporte ficam em revisão. Refund exige status que distinga parcial/total; valor continua desconhecido quando não confirmado. Cancelamento não pode apagar aprovação conhecida, mesmo sem data. Não backfillar/reescrever histórico.

Buyer, documentos, contato, PIX, origem, afiliados e comissões não entram no envelope. Origem de clique permanece não atribuída até homologar referência suportada. Desconhecidos guardam envelope ignorado mínimo; não deduzir estado de novos eventos sem contrato. Uma conta configurada por instância nesta versão, com namespace do domínio preservando isolamento.

Sem nova UI nesta etapa além de ajuda de cadastro/causas de revisão; telas D62 continuam evidência daquele recorte, não nova homologação visual global. Kiwify/Cakto e homologação externa de Hotmart seguem pendentes; B11/B12 e release completo continuam necessários. Corrigido caminho documentado do CLI de produção para cli, conforme Dockerfile.

## D64 — Kiwify nativa, assinatura de corpo e evidência temporal

24/10/2026. Contrato oficial atual confirma HMAC-SHA1 nos bytes originais e signature na query; token não é transmitido. Configuração/accountKey próprios, rotação explícita e segredo independente, somente no app. SHA-256 de order_id + webhook_event_type forma a identidade local documentada para deduplicação, em namespace de conta/provedor. Não copiar Hottok nem assinatura da API bancária/OAuth.

Leitura lossless de JSON passa a módulo comercial compartilhado, preservando conversão decimal Hotmart e seus hashes legados. Kiwify usa inteiros em centavos já fornecidos; taxa somente na mesma moeda. Sem inferir líquido, liquidação, atribuição ou quantia devolvida. Cadastro de produto/oferta é exato, sem usar checkout_link.

Datas raiz são de Brasília, com histórico DST. Ausência, ambiguidade ou cronologia contraditória exige revisão. updated_at não representa instante financeiro confirmado: chargeback/recusa permanecem unknown_event_time, com criação apenas como âncora de envelope não aplicado. Mesmo motivo cobre aprovação/devolução sem instante suficiente. B11 deve permitir conciliação auditada, sem editar fatos. Novo motivo controlado no JSON não exige migração nem altera digest de envelopes antigos. Cancelamento de assinatura não é reembolso; formatos especiais não viram venda avulsa automaticamente. membership/club sem campos de recorrência não bastam para inferir assinatura.

Fontes e contrato: [Kiwify](integracoes/kiwify.md). Sem alteração da arquitetura aceita, ativação real ou conta homologada.

## D65 — Cakto assinada, lotes atômicos e estados não finais

24/10/2026. O [contrato oficial Cakto](integracoes/cakto.md) confirma assinatura HMAC-SHA256 em header com timestamp e corpo bruto. Exigir essa modalidade, com janela de cinco minutos e comparação em tempo constante, sem fallback pelo secret do corpo. Conta configurada localmente e segredo independente apenas no app. Não registrar corpo/headers: secret continua presente no JSON do fornecedor.

Suportar V1 objeto e V2 array. Estender preparação/receiver comuns com batch explícito: autenticar/normalizar e validar todos os itens antes da fábrica Payload; persistir recibos/ignorados/colisões/auditorias num único commit. Ordenar locks de inbox antes dos locks ordenados de transação. Preservar caminho individual e digest legado dos outros provedores. Limite local de 25 itens/256 KiB; rejeitar conjunto inválido, nunca aceitar apenas parte. Sem nova migração ou infraestrutura.

Identidade financeira combina pedido + tipo de evento, em namespace próprio; data de envio e posição no lote não identificam fato. Dinheiro decimal usa leitor exato compartilhado, preservando unidade Kiwify separada. Datas ISO com offset são truncadas à precisão comum de milissegundos; não inferir ordem submilissegundo. MED/pré-chargeback exige dispute_not_final, sem confirmar perda definitiva. Recusa sem instante permanece unknown_event_time. Líquido, recebimento, quantias de reversão e atribuição não são deduzidos.

Abandono sem id de pedido é ignorado/agrupado por produto/oferta/data, sem email, divergindo conscientemente da sugestão de dedupe por email do guia. Não usar esses registros como número de abandonos/compradores. A escolha minimiza dados em notificação sem efeito financeiro, preservando invariantes de privacidade.

O fornecedor não repete automaticamente resposta HTTP de erro, conforme guia atual: monitorar histórico e reenviar manualmente, mantendo ACK apenas após commit local. Conta, relatório, teste oficial, reenvio e formatos especiais seguem pendentes de homologação. B11 deve resolver conciliação/colisões/catalogação histórica com auditoria, sem editar fatos.

## D66 — Prévia CSV canônica antes da confirmação durável

24/10/2026. Implementar primeiro prévia owner somente de leitura no contrato canônico existente, sem adaptar silenciosamente exportações de fornecedor nem aceitar arquivo como compra comprovada. UTF-8/cabeçalho exato/centavos, limites 5 MiB/dez mil registros e diagnóstico sem conteúdo bruto. Status/datas/IDs validados; desconhecido permanece null, e recebimento informado exige prova independente.

Linhas são instantâneos candidatos, não movimentos financeiros/eventos nativos novos. Repetições exatas apontam original; instantâneos distintos da mesma identidade no mesmo arquivo ficam todos em conflito. Comparar apenas com catálogo/projeção privados existentes, usando provedor/conta exatos e consultas mínimas limitadas. Não substituir histórico nem resolver revisão por aparentar compatibilidade.

Resposta sempre provisional=true e committable=false. Não há lote/linha/auditoria persistidos, confirmação, UI ou relatório nesta etapa. Leituras não têm consistência de snapshot transacional; confirmação futura deve persistir fonte/autor/plano/justificativa, revalidar sob locks e ser idempotente/auditada. Hash do arquivo não é autorização. Helper de planilha neutraliza texto de fórmula; sua saída não é contrato de reimportação canônica.

[Contrato, códigos e limites](24-conciliacao.md). B11/R15 continuam parciais; R16, confirmação durável, custos/liquidação e resolução de colisões/catálogo histórico permanecem pendentes. Sem nova migração/integração/IA/infraestrutura.

## D67 — Lote durável, confirmação para inbox e revalidação por conta

24/10/2026. Acrescentar lotes/linhas/auditoria privados na migração 21, mantendo prévia D66 sem escrita. Cada lote durável cobre uma conta de um provedor, com fonte/referência/justificativa controladas e autor real. Não misturar dados de compradores/arquivo bruto/credenciais. Fonte CSV é declaração auditada do operador sobre relatório conferido, não webhook autenticado do fornecedor.

Estágio tem idempotência vinculada ao autor/UUID e fingerprint de bytes/metadados. Confirmação exige owner/origem, intenção explícita e hash do plano persistido; revalidar manifesto, whitelist e hashes das linhas, catálogo/projeção e inbox pendente. Sem aceitar ator, classificação ou valores do navegador. Mudança produz stale e nenhum recibo parcial. Planos bloqueados/desatualizados exigem novo estágio após conferência, preservando a evidência anterior.

Primeiro contrato só enfileira novos pending/approved/refused/canceled com devolução/recebimento vazios; para approved, occurred_at é aprovação original declarada pelo operador. Reversões, valores devolvidos inclusive zero, liquidação, divergências e evidência pendente ficam bloqueados. Snapshots já compatíveis confirmam sem fato novo. Chave da evidência usa snapshot/namespace, não lote/linha/autor; camada de worker preserva idempotência/projeção.

202/queued é recibo durável, não aplicação. Worker segue independente, false por padrão. Linhas apontam a inbox; lote/linha queued descreve submissão, não estado ao vivo da fila. Auditoria do lote e recibos/vínculos compartilham commit. SQL parametrizado em blocos de 200 após validação evita dez mil chamadas/locks por linha; não é ingestão JSON pública.

Barreira PostgreSQL por provedor/conta precede demais locks no estágio/commit, recepção/processamento/retry e edição de oferta. Evita drift de evidência durante revalidação sem manter lock na conferência humana; outras contas independentes. Homologar latência/carga no release. Índices/checks e downgrade recusado com registros preservam custódia. [Contrato completo](24-conciliacao.md). Resolução auditada de colisões/catalogação histórica, liquidação/custos/financeiro e UI continuam pendentes, sem alterar fatos originais.

## Organização operacional — D69 (24/10/2026)

A pedido do proprietário, retirar o alias altualizar.sh criado em D46 e manter somente atualizar.sh; o fluxo de backup/migrations/saúde permanece no orquestrador existente. start.sh/stop.sh atendem desenvolvimento Linux, com implementação comum e identidade de processo; não controlam produção nem adotam uma prévia existente. Runners de CI reutilizáveis preservam execução sequencial e exigem confirmação de ambiente descartável. Node compartilhado em .nvmrc mantém o patch já aceito. Mudança operacional, sem alteração da arquitetura comercial ou ativação externa.

Referências oficiais consultadas para o workflow: [sintaxe de workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) e [setup-node](https://github.com/actions/setup-node). Ações/dependências existentes não foram atualizadas de versão nesta manutenção.


## Continuidade operacional — D68–D77

As decisões abaixo são conferidas nos serviços/coleções atuais e nas evidências cronológicas de [progresso](14-progresso.md). Implementação/teste local não significa homologação externa.

| ID | Decisão | Justificativa / consequência |
|---|---|---|
| D68 | Separar estado vigente e histórico de execução | Pendências e mapa de requisitos não podem ser concluídos por um relatório antigo |
| D69 | Um atualizador e controle local por identidade de processo | Alias com grafia incorreta retirado; wrappers preservam processos alheios e CI usa fixtures sequenciais |
| D70 | Impedir novas identidades de catálogo duplicadas pela API | Legados ambíguos precisam de correção auditada, sem duplicar cadastro para contornar vínculo incorreto |
| D71 | Reforçar identidade e integridade do catálogo no SQL | Migração 22 protege caminhos que não passam pelo formulário; não elimina ambiguidades históricas por exclusão |
| D72 | Associação histórica imutável por provedor/conta/produto/oferta | Migração 23 e trilha associate/hold; escolha por oferta ou livro, revisão/fonte/autoria, sem reescrever fatos originais |
| D73 | Conferir o componente inteiro de evidências relacionadas | Migração 24 e prévia somente leitura; IDs secundários/colisões não podem ser decididos em componentes independentes |
| D74 | Decisão e aplicação financeira atômicas e imutáveis | Migração 25, projeção efetiva separada e cobertura revisada pelo worker/CSV; fonte nova conflitante reabre revisão |
| D75 | Evidência complementar canônica atestada pelo owner | Migração 26; fonte/linha e substituições explícitas; não autentica relatório do provedor nem fabrica webhook nativo |
| D76 | Lote JSON canônico limitado e atômico | Até 20 evidências, rollback integral, deduplicação por linha; nenhuma inferência de layout de fornecedor |
| D77 | CSV de evidência separado do snapshot | Migração 27; 18 colunas, preview/stage/commit revalidado; snapshot de 13 colunas mantém sua semântica |

## Livro de liquidação, custos e prévia financeira — D78 (25/10/2026)

Liquidação é um movimento de caixa comprovado, com crédito/débito, alocado explicitamente pelo owner a uma transação já aprovada e na mesma moeda. Não se infere a partir do bruto ou do líquido informado, e não se cria evento nativo, webhook ou projeção de venda. Custos têm trilha própria, fonte/linha, categoria, período e classificação confirmada/estimada; custos compartilhados podem permanecer sem campanha. Correções são registros substitutivos append-only.

O relatório expõe separadamente coortes por aprovação, caixa por data de liquidação e custos por data de ocorrência; moedas nunca são convertidas. Ausências permanecem null e vêm com cobertura. Não existe ROAS/atribuição de receita a campanha nesta etapa. Tributos e demais componentes não estão todos registrados: margem completa permanece false e lucro fiscal não é calculado. Migração 28 impõe forma, integridade referencial, imutabilidade SQL e bloqueio de downgrade com dados. [Contrato](24-conciliacao.md).

## Interfaces administrativas — D79–D80

| ID | Decisão | Justificativa / consequência |
|---|---|---|
| D79 | View owner de prévia financeira dentro do Payload | Reutiliza o serviço D78, GET sem mutação, filtros UTC/moeda e ausência explícita; QA local recortado não encerra R16/B20 |
| D80 | View owner dos dois CSVs canônicos reutiliza endpoints existentes | Upload em memória, preview separado de lote/commit, tentativa estável para repetição e retomada de lotes; confirmação perdida não duplica fatos. Sem novo serviço, biblioteca, migração, flag ou segredo |

A documentação de decisões e conciliação foi reconstituída na revisão D80 após identificar cópia indevida de conteúdo de métricas. Decisões originais D01–D67 foram recuperadas da base Git e a seção D78 existente foi preservada; continuidade D68–D80 foi conferida no código/relatórios. A identidade numérica dos documentos passa a ser verificada pelo validador. O [mapa vigente](23-estado-atual.md) continua a autoridade de conclusão por requisito.

## Entrada financeira no painel — D81

D81 acrescenta view owner suportada pelo Payload para os contratos D78, com conferência local antes do POST, valores decimais convertidos exatamente por BigInt, instante UTC sem conversão implícita, repetição por fonte/linha e correção por supersedes. Campos de identidade/fonte são preservados conforme o contrato existente; históricos paginam com desempate por ID e não escrevem por GET. Sem novo schema, biblioteca, segredo, flag ou integração.

A ligação de campaignId do contrato ao relacionamento campaign passa a ser explícita no serviço de custos: o campo recebido antes não era persistido no relacionamento da coleção. A correção é de mapeamento, sem backfill nem alteração dos registros anteriores. O fluxo de decisão financeira auditada pela UI permanece em P05; custo vinculado não implica receita atribuída.

## D82 — Expor resolução do catálogo no painel

Adicionar view suportada pelo Payload para os contratos de identidade D72, sem migrations/endpoints/dependências novos. Manter decisão financeira como fluxo distinto: associar livro/oferta não deve aparentar resolver valores ou aprovar compra. Reusar prévia/hash/revalidação do servidor; congelar escolha e fonte com UUID idempotente até repetição ou retorno explícito. Histórico append-only apresenta revisões do mesmo escopo; ausência de sucessora não certifica validade atual da oferta. Destino UUID não é adivinhado; operador confere o cadastro existente pelo link.

## D83 — Expor escolhas e aplicação financeira

Reutilizar prévia/decisão D73–D75 numa extensão suportada do Payload. Consultar componente por preview hold é somente leitura; bloqueio só existe após confirmação. Exigir escolha explícita para todas as fontes e exclusões, inclusive em páginas diferentes; separar identidade de catálogo, fonte substituta e resolução financeira. Congelar envelope/UUID para repetição, e exigir prévia nova quando stale. Resultado histórico da decisão não deve se confundir com aplicações posteriores ou comprovação de caixa.

Corrigida apresentação monetária compartilhada para sinal negativo: módulo anterior usava resto negativo diretamente e exibia incorretamente valores como -1 centavo. BigInt absoluto e sinal explícito mantêm centavos e limite seguro. Não mudou o domínio/cálculo, schema, contratos de fornecedor ou integrações.

## D84 — Tornar cobertura financeira consistente

Correções: contagem de transações liquidadas deve pertencer à mesma moeda/coorte; candidatas em revisão state=unknown devem continuar visíveis, e nenhuma soma de coorte pode usar valores em quarentena. Manter datas ausentes separadas e resolver substituição antes do filtro temporal. Acrescentar avisos explícitos de soma fora do inteiro seguro.

Coortes passam a apresentar taxa somente com estado de reversão integralmente conhecido e nenhuma revisão, sem contar reembolso/chargeback duas vezes. Idade é observação da população sem revisão, com windowVerified=false; não inventar prazo por fornecedor. observedAt mede a consulta; último processamento é requisito distinto ainda pendente. Não mudou schema, arquitetura, autenticação/eventos ou escopo de plataformas. Critérios restantes P03/P04/P05 ficam discriminados na auditoria D84, sem marcar conclusão apenas por testes verdes.

## D85 — Detalhar sem inferir atribuição e expor sucesso real

Agregar por livro/provedor/moeda e mostrar custos por campanha declarada com receita atribuída desconhecida enquanto P06 não existir. Não usar custo, campanha atual do livro ou referência de clique como prova. Livro efetivo tem precedência quando conferido; revisão e alocação de caixa sem metadado confiável ficam sem livro conferido. Manter caixa de aprovações fora da janela e não reescrever originais.

Expor lastSuccessAt registrado pelos processadores e cobertura de datas, separado de observedAt/lastEventAt. O escopo é a população de aprovação consultada, sem alegar heartbeat global. Usar rótulos atuais do catálogo/campanha, páginas GET de 20 e disclosure aberto por parâmetro validado, sem novo CMS/endpoint/schema/dependência. Aceite P04 é local e não conclui P03/P05/P06 ou homologação de release/fornecedor.

## D86 — Encerrar aceite local P03/P05 por evidência

Verificar em PostgreSQL o percurso completo dos sete estados por provedor, preservando snapshot e prova como contratos distintos. Não tratar parsing ou preview como prova de persistência/aplicação. Acrescentar casos de recusa sem transação, atomicidade tardia, stale e repetição; conectar pelo navegador importação, catálogo, financeiro, caixa/custo e relatório.

Build D85 foi reutilizado após conferência das hashes das fontes da aplicação: nenhuma mudança de comportamento/schema foi necessária para os casos aceitos. Testes/censos e documentação tornam os aceites revisáveis. P03/P05 encerram somente implementação/validação local; R15/R16/B11 ainda dependem de atribuição/fornecedores/release, com P06/P07 e H01–H06 abertos. Não reduzir nem reescrever os requisitos para acompanhar testes verdes.

## D87 — vínculo de venda por referência consentida, 25/10/2026

Usar UUID do registro local `checkout-clicks` em `sck` só após consentimento válido e campanha ativa; preservar `sck` já presente. Hotmart/Kiwify/Cakto aceitam o parâmetro no checkout, mas confirmação do campo retornado em evento Kiwify/Cakto e dos caminhos de compra continua em H01. Adaptadores aceitam apenas UUID, descartando origem livre que poderia conter dados pessoais.

O relatório atribui apenas quando há clique armazenado com consentimento, retorno exato, provedor/conta/oferta/livro compatíveis, aprovação em janela inclusiva de 30 dias e transação fora de revisão. Valor UTM, email, IP, custo e coincidência temporal não são evidência. Receita atribuída continua null se bruto/reversões não tiverem cobertura integral; não calcular ROAS, caixa da campanha ou lucro com esse vínculo. P06 permanece parcial até QA integrado e homologações por conta; P07 é necessário para retenção/exclusão da trilha.

## D89 — Agregar antes de expirar analytics

Para atender à janela inicial de 90 dias sem descartar as contagens agregadas, criar coleção privada com dimensões de negócio controladas e sem grant/sessão/clique. Por fonte antiga, atualizar o grupo diário e excluir o evento na mesma transação sob lock determinístico. Caminho fica limitado à família pública, sem slug. Limpar contexto de atribuição ao vencer 30 dias; retirar sessões apenas sem eventos filhos e grants vencidos só sem sessões dependentes. Preview é o padrão da CLI, apply é explícito, e worker diário fica falso até revisão da política/ambiente. Não tratar os totais agregados como pessoas, conversões ou vendas. Essa decisão cobre somente analytics; retenção comercial e reaplicação pós-restore não podem ser inferidas desse mecanismo.


## D98 — Separar supressão pseudonimizada do contato

Guardar a prevenção de reimportação em coleção própria, sem FK nem endereço, usando HMAC derivado da chave privada de links e expiração de 12 meses. Não reutilizar `privacy-request-audit`: seu prazo/semântica são distintos e a trilha exige ator. Renovar marcador sob lock junto da supressão; removê-lo apenas após opt-in temático explícito confirmado. A CLI de retenção apaga somente tombstones vencidos. Essa decisão cobre o marcador, não autoriza purge de filas/manifests comerciais ou cópias de provedor; a política continua default a ser revisado antes de coleta real.

## D104 — Reaplicar decisões de privacidade de uma fonte posterior ao backup

Um backup antigo contém estado anterior à exclusão/retirada. Acrescentar CLI privada para exportar decisões concluídas/tombstones ativos em manifesto assinado, sem email/IDs, e reaplicar no banco restaurado isolado. Reutilizar `LEAD_TOKEN_SECRET` com domínio criptográfico separado e preservar prazos existentes; sua rotação continua exigindo migração coordenada. Arquivo 600 fora do Git/imagem, sem sobrescrita e guardado criptografado fora do snapshot restaurado. Sem dependência, serviço, segredo ou migration novos.

Manifesto deve ser posterior ao snapshot e atual segundo conferência do operador. Limitar o replay à janela de três meses da política de backups; recusar assinatura/chave/schema/limites inválidos e histórico de opt-in posterior ao manifesto. Exportação repeatable read/somente leitura; replay por contato, reexecutável sob flags falsas. Descarte local elegível reutiliza exclusão; identidade externa/envio incerto fica bloqueado. A exclusão idempotente não pode retornar sucesso só por haver auditoria se o contato reapareceu no restore: revalidar existência e remover/quarentenar a cópia restaurada. Restrições de entrega são preservadas sem inventar causa.

Declaração de isolamento e assinatura não provam que o arquivo é o mais recente da origem perdida. Automatizar/homologar guarda externa após decisões e novo opt-in, preservar pedidos ainda pendentes, conciliar provedores e ensaiar restore físico da imagem atual continuam em P07/H04/H06. O relatório nunca autoriza release. Evidência sintética D104 não altera esse gate.

## D105 — Pedido pending preserva dados e impede novas emissões

A dependência externa que motivou pending pode ter desaparecido do backup antigo. Portanto replay não pode reinterpretar a cópia restaurada como autorização para concluir exclusão/correção. Evoluir o manifesto para v2 com outcome e expiração nula para pending; aceitar v1 como completed, exibindo cobertura de pendências ausente. Preservar auditoria pending até resolução e compartilhar lock do fingerprint no expurgo para não apagar uma conciliação concorrente.

Manter identidade/dados e consentimentos no estado pending, acrescentando verificação de auditoria antes de captura, confirmação, dispatcher, promoção e cadastro novo. Isso reduz novas emissões enquanto o owner concilia; não conclui tentativas já iniciadas. Falha de chave aborta a conferência, sem gravar uma retirada de consentimento presumida. Nenhum campo, serviço, segredo ou migration novo; aproveitar o índice de fingerprint e os locks existentes. Retenção encerrada e tombstones mantêm os prazos aprovados. Guarda externa atual do v2, conciliação do provedor e restore físico continuam requisitos do release.

## D106 — Telemetria automática do Payload desativada — 26/10/2026

A barreira de rede do ensaio de restore detectou tentativa de telemetria habilitada por padrão no framework. `telemetry: false` na configuração Payload elimina essa comunicação automática em todos os modos; não altera os transportes opt-in nem os contratos dos três provedores. O ensaio físico local repetido concluiu com zero tentativa fetch. Sem dependência, migration ou serviço adicional. [Evidência](../artifacts/recovery/d106-results.json).

## D107 — Encerramento de manutenção — 26/10/2026

O ensaio real da imagem detectou a CLI de inventário presa por mais de 180 segundos. A implementação instalada de destroy do adapter limpa referências, mas não fecha o pool. As três CLIs recentes passam a encerrar explicitamente após aguardar a operação e Payload.destroy(), seguindo o padrão das CLIs de migração e recuperação; exceções e validação mantêm códigos não zero. A imagem é reconstruída pelo Dockerfile e o harness comprova conclusão em prazo limitado. [Evidência](../artifacts/container/d107-results.json).

## D109 — Retenção de estado promocional — 26/10/2026

D109 implementa retenção local de estado promocional para contatos globalmente descadastrados há pelo menos 30 dias: remove assinaturas encerradas e calendários cancelados com etapas antigas, sem lote. Preserva identidade, amostras/outbox, consentimento, auditoria e supressão com o prazo original. Não executa exclusão de identidade nem forja pedido owner. Impedimentos de privacidade, provedor, envio incerto, vínculo cruzado e manifestos compartilhados/JSON preservam os registros. Preview é padrão; apply revalida sob locks e é atômico por contato. P07 continua parcial para identidade, demais finalidades e dados compartilhados. A imagem/restore D107–D108 são evidências da revisão anterior, não incluem esta rotina. [Oito grupos PostgreSQL sintéticos](../artifacts/privacy-retention/d109-results.json). Sem migration, chamada externa, dado real, nova imagem, VPS ou deploy.

## D110 — Retenção de identidade e recuperação — 26/10/2026

Retenção automática não representa pedido humano: registrar fato HMAC próprio de 24 meses, distinto de privacy-request-audit. O manifesto só usa v3 quando inclui retention e mantém leitura v1/v2. Nova finalidade posterior ao fato impede apagar o contato; dependências antigas exigem quarentena/conciliação. Reaplicar fato original não reinicia prazo; ausência de supressão ainda exigível bloqueia expurgo, sem inventar/renovar tombstone. Preservar ao faltar chave ou cobertura verificável de relações, incluindo callbacks sem FK e manifests por HMAC. Esta decisão mantém arquitetura/provedores/flags aceitos.

## D111 — Operações em lote e diagnóstico PostgreSQL — 26/10/2026

Manter Payload 3.91.0 e o patch já existente, ampliando-o para aguardar update/delete por documento quando há transação compartilhada, conforme reprodução PostgreSQL. Não silenciar o aviso nem reduzir versão de pg. Preservar caminho sem transação, sem mutex global; manter inalterado o SQL da migration ao limpar somente parâmetros não usados. Reavaliar o patch ao atualizar Payload e repetir rollback/mídia/retenção.

## D112 — Descadastro e retenção por assunto — 26/10/2026

Descadastro temático precisa sobreviver à retirada do estado local e à ausência do contato/tema no snapshot. Registrar HMAC do endereço + UUID textual do assunto em coleção privada, sem FK ou pedido humano; prazo inicial de 24 meses, alinhado às provas encerradas. Manifesto v4 exige theme somente em theme-unsubscribe, enquanto v1/v2/v3 mantêm contrato. Replay aplica retirada, não inventa opt-in perdido após backup nem resolve provedor. Retenção após 30 dias exige fato vigente e relações verificáveis; legado sem prova preservado. Sem mudar flags, arquitetura base ou os três provedores.

A implementação D112 não altera a meta máxima de 30 dias da política. A diferença entre cutoff inclusivo de 30 dias e execução diária foi identificada na D112 e tratada em código na D113; homologação operacional permanece pendente, sem ampliar o prazo aprovado.

## D113 — Margem e acompanhamento do prazo — 26/10/2026

Manter a meta aprovada de retirar marketing em até 30 dias, antecipando elegibilidade para 28 dias em vez de ampliar o prazo máximo. Com execução diária e frescor de sucesso limitado a 25 horas, há margem teórica de 23 horas; comprovação operacional requer ambiente/monitoramento homologados. Preservações por dependência continuam e são explicitadas por contador de assinaturas para revisão. Não usar heartbeat isolado como prova de retenção cumprida, nem descarte inseguro como forma de recuperar saúde. Prazos de identidade, consentimento, supressões e fatos permanecem.

## D114 — Legado temático verificável — 26/10/2026

A fonte para preencher legado é o histórico nativo consistente, não apenas sub.state ou uma data isolada. Exigir chave canônica, contato/assunto/finalidade/ação/data exatos e ausência de conflito. Manter 24 meses desde a retirada original, sem reiniciar prazo na derivação. Prova vencida pode permitir retirar estado local sob os mesmos guards sem criar novo HMAC, pois nenhum snapshot aceito (até três meses) pode anteceder essa retirada de mais de 24 meses. Exportação deve falhar diante de lacuna não coberta; uma decisão automática anterior a nova finalidade não é cobertura válida. Nenhuma prova de provedor ou solicitação humana é inferida.
