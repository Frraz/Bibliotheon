# Cakto — contrato e operação

[Integrações](../07-integracoes.md) · [Estado atual](../23-estado-atual.md)

## Estado e fontes — D65, 24/10/2026

Adaptador nativo V1/V2 e POST /api/v1/webhooks/cakto implementados localmente, desligados por padrão e sem conta homologada. Nenhuma compra, entrega, contestação ou API autenticada da Cakto foi executada. Fixtures e evento de teste não comprovam uma venda real.

Fontes primárias consultadas: [guia técnico](https://docs.cakto.com.br/conceitos/webhooks), [Markdown oficial](https://docs.cakto.com.br/conceitos/webhooks.md), [histórico de eventos](https://docs.cakto.com.br/api-reference/webhooks/event-history), [evento de teste](https://docs.cakto.com.br/api-reference/webhooks/test-webhook), [reenvio](https://docs.cakto.com.br/api-reference/webhooks/resend-event) e [changelog](https://docs.cakto.com.br/mudancas). Leitura web e HTTP público direto; sem autenticação. [Método, datas e hashes](../../artifacts/cakto/source-checks.json). O [artigo da central](https://ajuda.cakto.com.br/pt-br/articles/1-como-funcionam-os-webhooks-na-cakto-guia-completo) ajuda na configuração pelo painel; o contrato técnico atual é a fonte de autenticação/campos.

## Configuração e assinatura

CAKTO_WEBHOOK_ENABLED=false e COMMERCIAL_EVENTS_ENABLED=false por padrão. CAKTO_ACCOUNT_KEY é alias local opaco igual ao cadastro de ofertas; não vem do corpo, header ou comprador. CAKTO_WEBHOOK_SECRET é o segredo do webhook criado na conta. Copiar apenas para o ambiente privado; mínimo de 32 e máximo de 512 caracteres, sem espaços/controle/placeholder e independente dos demais segredos. Esse limite é política do Bibliotheon. CAKTO_WEBHOOK_PREVIOUS_SECRET é opcional durante transição conferida pelo proprietário; verificar na conta o procedimento de troca/recriação e reenvios pendentes. Não presumir que o segredo possa ser editado em qualquer conta.

O endpoint exige X-Cakto-Timestamp em segundos Unix e X-Cakto-Signature com uma assinatura v1 hexadecimal minúscula. HMAC-SHA256 usa a chave configurada e a sequência de bytes timestamp + ponto + corpo bruto. Verificação em tempo constante; tolerância de cinco minutos nos dois sentidos. Rejeitar timestamp não inteiro/duplicado, NaN, assinatura ausente/adulterada ou v1 repetida. Aceitar v1 conhecida acompanhada de versão futura, sem usá-la como autenticação. Não autenticar pelo User-Agent.

O fornecedor também envia secret no JSON; **não usar esse campo como alternativa à assinatura**. Header inválido/ausente é rejeitado antes da leitura do corpo. HMAC é conferido depois da leitura limitada e antes de parse/fábrica Payload. O valor no corpo é descartado: não escolhe conta nem é persistido, mesmo quando autenticado. HTTPS obrigatório. Impedir captura de corpo e headers de autenticação em proxy/APM/debug; o corpo contém uma credencial, mesmo quando a aplicação usa assinatura.

## Identidades, valores e datas

| Campo nativo | Regra local |
|---|---|
| data.id | Identidade do pedido; não usar refId, índice do array ou timestamp de envio |
| event | Diferencia fatos da mesma transação; chave interna SHA-256 de id + event, em namespace de provedor/conta |
| data.product.id | Produto exato cadastrado manualmente; short_id não substitui |
| data.offer.id | Oferta opcional exata; checkoutUrl não substitui |
| data.amount | Total cobrado decimal JSON convertido exatamente a centavos; null continua desconhecido |
| data.fees | Taxa decimal na moeda documentada; não somar novamente charged_fees/juros |
| data.currency | Moeda dos valores; sem câmbio automático |
| baseAmount, offer.price, strings de juros/desconto e commissions | Não substituem bruto nem comprovam líquido/recebimento |
| createdAt | Criação do pedido em sourceCreatedAt; não criação da notificação |
| paidAt, refundedAt, chargedbackAt | Instantes financeiros específicos; aprovação original explícita/null |
| Customer/customer, pagamento, acesso, affiliate, UTMs, callback e demais campos | Descartados; sem identificação de comprador, contato ou atribuição inferida |

Dinheiro decimal é lido do lexema JSON com Node 22, sem arredondamento binário, coerção de string ou overflow. Aceitar apenas representação exata em centavos seguros para moeda com duas casas; outra precisão fica em revisão com valor desconhecido. Taxa/líquido não são recebimento; devolução/chargeback monetários permanecem null por ausência de quantia própria confirmada. amount não representa quantia devolvida.

ISO deve trazer offset explícito ou Z e calendário válido. Datas com microssegundos são normalizadas à precisão comum de milissegundos por truncamento, sem arredondamento; não alegar ordenação submilissegundo. A projeção mantém conflitos de estado/valor no mesmo instante em revisão. Não substituir datas ausentes por horário de envio/reprocessamento. Criação inválida recusa envelope financeiro; instante financeiro ausente ou cronologia contraditória usa unknown_event_time. occurredAt fica ancorado na criação apenas para envelope em revisão, sem aplicação financeira automática.

## Eventos e limites

| Evento / status | Tratamento |
|---|---|
| purchase_approved / paid | approved em paidAt; ausência/contradição temporal exige revisão |
| pix_gerado, boleto_gerado, picpay_gerado, openfinance_nubank_gerado / waiting_payment | pending na criação do pedido; bloco de cobrança não comprova pagamento |
| refund / refunded | refunded em refundedAt; quantia devolvida desconhecida |
| chargeback / chargedback | chargeback em chargedbackAt; quantia desconhecida |
| chargeback / MED | Revisão dispute_not_final: MED/pré-chargeback não comprova perda definitiva |
| purchase_refused / refused | Revisão unknown_event_time: instante da recusa não confirmado |
| Tipo conhecido com status divergente | Revisão unsupported_native_status |
| Produto fora de unique, assinatura/período, envio físico ou tipo de oferta desconhecido | Revisão unsupported_purchase_shape |
| refund_requested, dispute_defense_requested, purchase_email_failed, subscription_* e outros tipos | Ignorado/auditado, sem inventar devolução ou alterar consentimento |

Recorrência fica fora da projeção automática inicial. Pedido de reembolso não é reembolso executado; pedido de defesa não confirma uma nova perda. Nenhum fluxo envia defesa, aprova estorno, muda entrega ou contata comprador.

Checkout_abandonment tem forma própria sem id de pedido. Receber apenas como ignorado mínimo: agrupamento técnico por produto, oferta e createdAt nativo, sem email ou outro identificador de comprador. Dois abandonos com esses mesmos dados podem compartilhar registro. **Isso não mede abandonos/compradores**; é uma decisão de minimização para notificações sem efeito financeiro, diferente da chave com email sugerida no guia. Não criar contato ou supor consentimento.

## V1, V2 e persistência

V1 traz data como objeto; V2 do painel traz array com os pedidos da cobrança, incluindo principal/order bump/upsell/downsell. Normalizar cada pedido individualmente; compartilhar uma entrega não significa compartilhar id, livro ou fato financeiro. Checkout abandonado V2 também é tratado em ramo próprio.

Limites locais: corpo 256 KiB, cinco segundos de leitura, uma a 25 entradas por lote. Não confundir esse teto com limite do fornecedor. Excedente/array vazio/aninhado/item malformado recusa a entrega inteira; exige correção/reenvio pelo proprietário, sem fingir processamento parcial. Conta/provedor/versão e todos os envelopes são validados antes de abrir o banco.

Batch autentica uma vez os bytes originais. Recibos, ignorados, duplicatas confirmadas, colisões e auditorias são persistidos em **uma transação**; locks de inbox são ordenados e precedem locks ordenados das transações afetadas. Falha em qualquer item/auditoria reverte o conjunto. Mesma chave com valores diferentes gera colisão durável e preserva projeção anterior. Repetição/ordem invertida usa os mesmos ids e hashes. Digest legado Hotmart/Kiwify é preservado; o caminho individual continua disponível aos adaptadores anteriores.

HTTP 200 exige commit completo. Assinatura inválida: 401; tamanho: 413; MIME/encoding: 415; schema/lista inválida: 422; falha temporária: 503 com Retry-After: 60. Application/json e encoding identity. Recepção independe do worker; processamento segue desligado por padrão. Tokens do webhook apenas no app, nunca worker. Sem nova migração: itens usam as coleções/JSON comerciais existentes.

## Reenvio e operação

A Cakto documenta timeout de oito segundos. Falhas de rede/timeout podem gerar até cinco novas tentativas, com intervalos crescentes; conferir comportamento efetivo na conta. **Uma resposta HTTP não 2xx, inclusive 500/503, não provoca reenvio automático segundo o guia atual. Retry-After local não muda essa política.** Monitorar histórico de entregas no fornecedor e fazer reenvio manual após restabelecimento; inbox local não inventaria o que nunca foi recebido. Nunca devolver sucesso para ocultar falha de persistência.

Rotação, reenvio e replay devem chegar com assinatura/timestamp válidos para a nova entrega. Horário antigo de venda é permitido; timestamp antigo de envio não. Use /admin/commercial-inbox para consulta/retry owner. Retry não resolve sozinho campo ausente, MED, colisão ou catálogo ambíguo com histórico; B11 deve fornecer conciliação auditada sem editar fatos recebidos.

## Validação e homologação

npm test cobre assinatura/janela/versões, números, datas, status, V2 e descarte de PII. npm run test:cakto exige PostgreSQL loopback sem owner/histórico comercial e limpa fixtures. npm run test:cakto-http exige QA isolado com CAKTO_ACCOUNT_KEY=synthetic e segredo sintético das fixtures; nunca rodar em operação real. Workflow preparado não comprova execução GitHub.

Evento oficial de teste tem forma fixa diferente da entrega real: inclui todos os meios de pagamento, subscription mesmo sem recorrência e omite campos. O adaptador preserva a assinatura como requisito, mas pode manter esse shape para revisão. Não afrouxar regras financeiras para fazer teste de conectividade parecer venda. Confirmar assinatura/headers do teste na conta antes de ativar; não enviar dados reais para capturadores públicos.

Pendente na conta: assinatura/timestamp/rotação, V1/V2 entregues, ids/total/taxas/moeda comparados ao relatório, datas e status de reembolso/chargeback/MED, política de falha/reenvio, atribuição por callback e URL afiliada. Campo oficialmente documentado não equivale a atribuição homologada; externalClickReference continua null. Sem homologação e conciliação, R14/B10 permanece parcial e projeto completo não está pronto para produção.
