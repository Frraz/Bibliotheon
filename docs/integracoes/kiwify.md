# Kiwify — contrato e operação

[Integrações](../07-integracoes.md) · [Estado atual](../23-estado-atual.md)

## Estado e fontes (D64 — 24/10/2026)

Adaptador nativo e POST /api/v1/webhooks/kiwify implementados localmente; desligados por padrão. Fixtures sintéticas não comprovam conta, webhook autêntico, relatório financeiro ou homologação externa. Nenhuma chamada autenticada à API Kiwify foi feita.

Contrato atual de recepção: [Receiving webhooks](https://docs.kiwify.com.br/api-reference/webhooks/receiving), também disponível em [Markdown oficial](https://docs.kiwify.com.br/api-reference/webhooks/receiving.md). [Eventos de assinatura](https://docs.kiwify.com.br/api-reference/webhooks/subscription-events) documentam as datas raiz em Brasília e a diferença entre cancelamento e devolução. O [índice oficial](https://docs.kiwify.com.br/llms.txt) permite reencontrar essas páginas. A ferramenta web não abriu o Markdown, mas a leitura HTTP pública direta funcionou.

O [artigo da central](https://ajuda.kiwify.com.br/pt-br/article/como-funcionam-os-webhooks-2ydtgl/) aponta o [documento público Notion](https://kiwify.notion.site/Webhooks-pt-br-c77eb84be10c42e6bb97cd391bca9dce), cujo conteúdo foi consultado pelo índice público. A leitura direta atual retornou 403/404; isso não equivale a acesso à conta. Esse documento detalha o envelope e afirma valores financeiros inteiros em centavos. Usar a página atual de recepção para autenticação; o Notion é fonte complementar de campos, sujeito à homologação. Não confundir os contratos da API bancária de outro namespace, OAuth de saída ou schemas REST de vendas com o webhook de pedidos.

## Configuração e autenticação

- KIWIFY_WEBHOOK_ENABLED=false por padrão; ativar apenas após a configuração/homologação pelo proprietário.
- KIWIFY_ACCOUNT_KEY é alias local opaco, igual ao accountKey das ofertas. Não vem do corpo, URL, email ou nome pessoal.
- KIWIFY_WEBHOOK_TOKEN é o segredo privado que o proprietário configura no webhook da Kiwify. Política do projeto: 32–512 caracteres, sem espaço/controle/placeholder, independente dos demais segredos. O fornecedor recomenda um segredo forte; o mínimo de 32 é política do Bibliotheon.
- KIWIFY_WEBHOOK_PREVIOUS_TOKEN é opcional durante rotação. Preparar novo/anterior no servidor, trocar na conta, conferir reenvios e remover anterior depois da janela acordada. A página oficial recomenda acomodar tentativas pendentes por pelo menos um dia; verificar a fila na conta.

O fornecedor acrescenta exatamente um parâmetro signature à URL configurada, contendo HMAC-SHA1 hexadecimal de 40 caracteres sobre os **bytes originais** do corpo, com o token como chave. Não envia o token. O endpoint exige hex minúsculo e compara o resultado em tempo constante com token atual/anterior; reserializar JSON antes da validação invalidaria o contrato. Vetor oficial reproduzido nos testes, sem usar seu token curto como configuração operacional.

Não aceitar segredo em header, query ou campo do JSON como autenticação. Não implementar Hottok da Hotmart nem OAuth da API neste endpoint. A assinatura está na query, mas o segredo nunca deve estar na URL configurada. **Não registrar query/URL completa de callbacks no proxy, APM ou aplicação**: a assinatura permite replay do mesmo corpo. Configure o proxy existente antes da ativação; não substituir sua configuração global. A aplicação não registra corpo, assinatura ou token.

A assinatura não contém timestamp ou delivery ID. Replay é controlado pela identidade documentada order_id + webhook_event_type, com hash SHA-256 e namespace próprio de provedor/conta. Alteração financeira para a mesma identidade é colisão durável em revisão, nunca atualização silenciosa. Mudanças em PII, updated_at ou comissões não utilizadas não alteram o digest.

## Envelope normalizado

| Evidência nativa | Destino/regra |
|---|---|
| order_id | Transação externa; order_ref não substitui |
| Product.product_id | Produto exato cadastrado manualmente |
| Product.product_offer_id | Oferta externa opcional; checkout_link não substitui |
| Commissions.charge_amount/currency | Bruto inteiro em centavos e moeda informada; não multiplicar por cem |
| Commissions.kiwify_fee | Taxa somente quando kiwify_fee_currency igual à moeda do bruto |
| my_commission, fundos, depósito, câmbio | Não inferir líquido, liquidação ou recebimento; null |
| created_at | Criação do pedido em sourceCreatedAt, não criação da notificação |
| approved_date | Aprovação original quando inequívoca; ausência continua null |
| refunded_at | Instante da devolução quando inequívoco; quantia devolvida continua null |
| updated_at | Modificação de snapshot, descartada; não prova instante de chargeback/recusa |
| Customer, TrackingParameters, access_url e demais dados | Descartados; sem cadastro/marketing/correlação por PII |

Números são lidos do lexema JSON com Node 22; aceitam apenas inteiros exatos seguros, nunca strings, fração arredondada ou overflow. Não aplicar automaticamente a conversão decimal da Hotmart. Taxa em outra moeda fica desconhecida; sem conversão de câmbio.

Datas raiz seguem YYYY-MM-DD HH:mm, opcionalmente segundos, em America/Sao_Paulo. O minuto informado é representado no início desse minuto, sem alegar precisão de segundos. Conversão usa o histórico de horário de verão; horário inexistente/ambíguo não é adivinhado. ISO de objetos Subscription não é usado como substituto da data financeira raiz. Criação ausente/inválida recusa envelope financeiro; aprovação/devolução sem instante inequívoco mantém evento autenticado para revisão.

| webhook_event_type / order_status | Tratamento |
|---|---|
| order_approved / paid | approved no instante de approved_date; sem data, revisão |
| billet_created ou pix_created / waiting_payment | pending na criação do pedido, sem aprovação |
| order_refunded / refunded | refunded com refunded_at; valor devolvido desconhecido; sem data, revisão |
| order_rejected / refused | refused preservado para revisão: instante da recusa não confirmado |
| chargeback / chargedback | chargeback preservado para revisão: instante da contestação não confirmado |
| Tipo conhecido com status divergente | Revisão unsupported_native_status |
| Assinatura/recorrência, afiliado/coprodutor, SmartInstallment/ScheduledInstallment, físico/evento/shape fora de digital/payment/membership/club | Revisão unsupported_purchase_shape |
| subscription_canceled/late/renewed e outros tipos não mapeados | Ignorado com registro mínimo; cancelar assinatura não devolve pagamento |
| Carrinho com id e status abandoned, sem tipo de webhook | Ignorado mínimo, sem contato nem transação |

membership/club sem campos de recorrência não implica assinatura: a relação produto–livro continua manual/exata. Datas financeiras anteriores à criação, ou devolução anterior à aprovação conhecida, exigem revisão.

unknown_event_time impede projeção financeira automática. occurredAt usa criação apenas como âncora técnica do envelope **não aplicado**, sem representar o instante desconhecido. O painel exibe o motivo; retry não inventa campos ausentes e não resolve sozinho a conciliação. Em transação existente, conserva a projeção financeira anterior e marca revisão. B11 deve fornecer resolução auditada com evidência externa; não editar o envelope recebido.

## Recepção, persistência e worker

Configuração/forma da assinatura precedem leitura; MIME application/json, encoding identity, limite 256 KiB e prazo de corpo de cinco segundos. HMAC exige os bytes: autenticá-los depois da leitura limitada e antes do parse/fábrica Payload. Conta incorreta/assinatura inválida não abre banco. JSON/schema inválido retorna 422; conteúdo/limite, 415/413; indisponibilidade, 503 com Retry-After: 60.

HTTP 200 somente depois do commit de recebimento, duplicata confirmada, ignorado auditado ou colisão persistida. Falha na auditoria reverte o recebimento e retorna 503. Recepção não depende de COMMERCIAL_EVENTS_ENABLED; processamento automático continua false por padrão. Conferir a inbox em /admin/commercial-inbox antes de ativar o worker. Tokens Kiwify ficam somente no app no Compose, sem repasse ao worker.

A página atual documenta ACK 2xx, timeout de 40 segundos no fornecedor, tentativas crescentes de 1–10 minutos, reenvio manual e ausência de redirecionamento. Documento antigo menciona quantidade de tentativas; confirmar a política efetiva na conta, sem prometer número fixo. O timeout local é menor. Não testar com compra/refund real para substituir fixtures.

## Validação e homologação

Suítes locais: npm test, npm run test:kiwify e npm run test:kiwify-http. Integração exige PostgreSQL loopback vazio de owner/histórico comercial; faz cleanup. HTTP exige QA isolado com KIWIFY_ACCOUNT_KEY=synthetic e token exclusivamente sintético das fixtures; não executar contra produção. Workflow preparado não significa CI executado no GitHub.

Pendente na conta: assinatura autêntica/rotação, oferta e IDs entregues, moeda/taxa comparadas ao relatório, precisão/fuso/datas de reversão, ordem dos eventos, duplicatas/reenvios, produto prioritário, URL afiliada e atribuição suportada. O botão Testar Webhook usa dados fictícios; API não oferece sandbox, segundo a documentação. Não usar conta real como ambiente descartável. Chargeback, recusa e formatos especiais continuam sem projeção automática por insuficiência de evidência confirmada.

## Aditivo P06 — referência de clique consentido (D87)

A central oficial informa que checkout aceita `sck` e que os parâmetros de rastreamento ficam em cookies e são usados nas compras. A integração passa uma UUID aleatória de `checkout-clicks` em `sck`, só para saída de campanha com consentimento vigente, sem substituir um `sck` já presente. O adaptador lê `TrackingParameters.sck`, mas só conserva UUID; texto livre e dados que pareçam pessoais são descartados. O retorno precisa ainda corresponder ao registro consentido, provedor/conta/oferta/livro e janela de 30 dias. O artigo oficial confirma o transporte no checkout, mas a página técnica de Webhooks ligada pela Kiwify não pôde ser aberta nesta consulta; a forma exata do campo no evento e sua entrega real permanecem em H01 e impedem declarar P06 concluída.

Fontes públicas consultadas em 25/10/2026: [parâmetros de rastreamento no checkout](https://ajuda.kiwify.com.br/pt-br/article/como-passar-parametros-de-rastreamento-na-url-do-checkout-src-utm-tags-entre-outros-1spiptc/) e [webhooks Kiwify](https://kiwify.notion.site/Webhooks-pt-br-c77eb84be10c42e6bb97cd391bca9dce). Evidência/auditoria: [P06 D87](../../artifacts/attribution/p06-audit-d87.json).

## Callback atribuído por HTTP sintético — D88

Fixture loopback com `TrackingParameters.sck` passou pela autenticação configurada para teste, inbox, projeção e relatório; repetição não duplicou o fato. O campo teve shape sintético definido pelo adaptador e não foi lido de documentação oficial acessível nem recebido de conta real. Isto confirma apenas o comportamento local do código; H01 deve conferir campo/conta antes de ativação. [Resultado D88](../../artifacts/attribution/kiwify-http-d88.json).

## Continuidade da conciliação local — D80

Os contratos nativos e as datas de fonte acima permanecem os desta integração. Posteriormente, associação/decisão financeira auditadas, evidência complementar/CSV e ledger foram acrescentados localmente; D80 permite a importação canônica no painel. Esses fluxos não autenticam exportação nativa, não inventam dados ausentes e não concluem a homologação desta conta. Casos suportados e limites estão no [contrato de conciliação](../24-conciliacao.md) e no [estado vigente](../23-estado-atual.md); H01 continua necessário.
