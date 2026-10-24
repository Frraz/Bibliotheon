# Conector Hotmart

[Integrações](../07-integracoes.md) · [Referências](../16-referencias.md) · [Estado atual](../23-estado-atual.md)

## Estado e fontes — 24/10/2026 (D63)

Adaptador v2, endpoint, inbox e processamento implementados/testados localmente com fixtures sintéticas. Não configurado/homologado em conta real; HOTMART_WEBHOOK_ENABLED=false por padrão. Elegibilidade do título, checkout, entrega, relatório e comportamento de reenvio precisam de conferência pelo proprietário.

Campos cotejados no conteúdo oficial consultável/indexado de [eventos de pedido v2](https://developers.hotmart.com/docs/pt-BR/2.0.0/webhook/purchase-webhook/), [versão inglesa](https://developers.hotmart.com/docs/en/2.0.0/webhook/purchase-webhook/) e [changelog](https://developers.hotmart.com/docs/en/changelog). A navegação direta do portal devolveu shell dinâmico; a leitura indexada forneceu tabela e exemplo. Isso não substitui payload de teste da conta. Não usamos nomes/campos de bibliotecas de terceiros como contrato.

## Configuração e autenticação

POST /api/v1/webhooks/hotmart. HOTMART_HOTTOK deve ser copiado da conta; não gerar outro segredo para substituí-lo. Comparação segura de X-HOTMART-HOTTOK antes de ler corpo ou chamar a fábrica Payload. Token estático de conta, não assinatura criptográfica do corpo; HTTPS público obrigatório, com proxy existente preservado. Token em query, cookie ou corpo não autentica.

HOTMART_ACCOUNT_KEY é alias local opaco, igual ao accountKey cadastrado nas ofertas. Corpo não escolhe conta. Uma conta configurada por instância/endpoint nesta versão; namespace do domínio continua separando provider/account/transação. HOTMART_PREVIOUS_HOTTOK é opção local de transição explicitamente configurada, diferente do atual. A página oficial orienta procurar suporte para alterar o token; não automatizamos a rotação. Remover o anterior após conferir a transição. Não reutilizar segredo de sessão, links ou Brevo.

Compose entrega esses parâmetros somente ao app. Worker recebe envelopes mínimos já autenticados e não precisa de Hottok. Recepção e COMMERCIAL_EVENTS_ENABLED são independentes: receber com processamento desligado deixa pendências duráveis; não constitui aprovação aplicada no relatório.

## Contrato usado

| Origem v2 | Uso local |
|---|---|
| id, version | Chave de evento e versão exatamente 2.0.0 |
| creation_date | Milissegundos UTC preservados em sourceCreatedAt |
| event | Nome preservado em sourceEvent ou eventType dos ignorados |
| data.product.ucode | externalProductId; não usar o id numérico como fallback |
| data.purchase.transaction | Transação única no escopo da conta |
| data.purchase.offer.code | Oferta explícita; ausente permanece null |
| data.purchase.full_price | Total pago e sua moeda; não substituir pelo preço da oferta |
| data.purchase.approved_date | Aprovação original, quando informada; ausente permanece null |

Dinheiro é lido do texto numérico original do JSON, sem arredondamento binário ou coerção de string. Conversão automática em centavos só para moedas reconhecidas com duas casas, conforme metadados ICU/Intl do runtime fixado; outra precisão fica em revisão com valor desconhecido, sem câmbio. Não usar comissões, conversões ou diferença de preços para deduzir taxas/líquido. Refund e chargeback monetários não estão confirmados neste payload e continuam null. Aprovação nunca cria liquidação.

Para aprovação/COMPLETE com data original, occurredAt usa essa data financeira; sourceCreatedAt conserva a criação da notificação. Demais eventos usam a criação como referência disponível. Datas futuras de qualquer evidência ficam em revisão. Não inventar approvedAt a partir do horário de recebimento/criação quando a data original não veio.

| Evento | Tratamento |
|---|---|
| PURCHASE_APPROVED | approved; data original opcional e explícita |
| PURCHASE_COMPLETE | Evidência da aprovação original quando essa data existe; sem ela, revisão |
| PURCHASE_BILLET_PRINTED / PURCHASE_DELAYED | pending; código/metadado PIX não aprova |
| PURCHASE_CANCELED / PURCHASE_EXPIRED | canceled; regressão após aprovação é divergência |
| PURCHASE_REFUNDED | status PARTIALLY_REFUNDED distingue parcial; REFUNDED identifica total; outro/ausente exige revisão. Quantia devolvida não é inferida |
| PURCHASE_CHARGEBACK | chargeback; quantia desconhecida separada de reembolso |
| PURCHASE_PROTEST | Revisão explícita, sem aplicação financeira automática |
| Outros | Envelope mínimo ignorado/auditado, sem transação; revisar novas adições antes de ampliar suporte |

Assinatura, plano FlexPay/renovação e produto físico são conservados em revisão, sem tratar cobrança recorrente como venda avulsa de e-book. Não extrapolar semântica de outra família de produto. Mapear catálogo por IDs exatos; desconhecido/ambíguo não cria venda. Conta, consentimento ou contatos não são criados a partir de buyer. Origem src/sck/xcod, afiliado, documento, telefone, pagamento/PIX e comissões são descartados nesta versão; atribuição de compra continua pendente de referência homologada.

## HTTP, durabilidade e operação

JSON UTF-8, até 256 KiB, prazo total de leitura de cinco segundos; encoding comprimido rejeitado. 401 token incorreto; 415 conteúdo incompatível; 413 corpo grande; 422 JSON/versão/envelope inválido; 503 + Retry-After para configuração desligada ou indisponibilidade. Resposta privada/no-store, sem IDs recebidos, PII ou credenciais.

200 accepted somente após commit da inbox/auditoria, inclusive duplicata já durável ou colisão inventariada. Colisão preserva projeção e exige revisão, não um retry externo infinito. Falha de persistência não confirma evento. Último sucesso de aplicação é separado de recebimento. Sem guardar corpo integral em DB/logs/Git.

No painel, conferir acompanhamento, falhas/revisões e IDs do catálogo. Retry D61/D62 só reaplica envelope preservado após correção; não normaliza novamente um corpo real nem apaga conflito. Para evento não persistido, usar mecanismos de teste/histórico/reenvio disponíveis na conta e comparar com relatório. Contagem, intervalos, descarte e desativação por falha de entrega não foram homologados; não prometer retry ilimitado ou uma quantidade específica.

## Validação local e homologação pendente

npm run test:hotmart valida contrato/ledger via handler com PostgreSQL loopback; npm run test:hotmart-http valida a rota real no QA. Fixtures contêm apenas dados sintéticos. Pipeline comum e catálogo possuem regressões próprias. Conta/API externa, compra, entrega, relatório real, atribuição e servidor de produção não foram utilizados.

- [ ] Produto, elegibilidade, preço, produtor/afiliado e entrega conferidos.
- [ ] Conta real, v2 e alias local registrados; Hottok correto/incorreto testados sem expor token.
- [ ] Produto ucode/oferta e estados efetivamente entregues comparados com o contrato local.
- [ ] Aprovação, cancelamento, parcial/total, chargeback, desconhecido e replay testados no mecanismo permitido pela conta.
- [ ] Relatório local conciliado com relatório do provedor, incluindo quantias ausentes/divergentes.
- [ ] Campo/parâmetro de atribuição homologado; até lá, sem anexar clickId ao checkout.
- [ ] Reenvio, falha temporária, configuração desativada e transição de token conferidos pelo proprietário.

Estado: **implementado/testado localmente; não homologado no provedor e desligado por padrão**.
