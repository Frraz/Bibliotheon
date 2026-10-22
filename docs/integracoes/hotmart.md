# Conector Hotmart

[Integrações](../07-integracoes.md) · [Referências](../16-referencias.md)

## Evidência disponível

A documentação oficial de eventos de compra v2 descreve `X-HOTMART-HOTTOK` como cabeçalho de verificação. Consulta em 20/10/2026; o portal é dinâmico e a leitura integral do esquema não ficou disponível nesta pesquisa. [Eventos de compra](https://developers.hotmart.com/docs/es/2.0.0/webhook/purchase-webhook/).

## Implementação planejada

Endpoint POST `/api/v1/webhooks/hotmart`; segredo exclusivamente em `HOTMART_HOTTOK`. Validar token com comparação segura; não tratá-lo como assinatura criptográfica do corpo. HTTPS obrigatório. `accountKey` vem da configuração local, nunca é escolhido livremente pelo corpo.

Mapear explicitamente eventos de aprovação, cancelamento, reembolso e chargeback da versão configurada para estados internos. Confirmar nomes e caminhos exatos no portal e em evento de teste antes de codificar fixtures de contrato. Não extrapolar dados de assinatura para venda avulsa.

Identidade: transação externa dentro da conta; resolver produto/oferta usando IDs cadastrados. Determinar ID do evento, timestamp, moeda, valores e referência de campanha na versão homologada. Taxas e recebimento ausentes continuam null.

## Checklist de homologação

- [ ] Produto, preço, URL de produtor e URL afiliada conferidos.
- [ ] Conta e versão do webhook registradas; Hottok correto aceita e incorreto rejeita.
- [ ] Fixtures aprovadas, reembolso, chargeback, evento desconhecido e produto desconhecido.
- [ ] Replay e ordem invertida sem duplicação/regressão.
- [ ] Relatório local reconciliado ao relatório do provedor.
- [ ] Campo de atribuição testado; até lá, não anexar parâmetros próprios ao checkout.
- [ ] Procedimento de reenvio e rotação de segredo documentado com evidência.

Estado atual: **não configurado, não homologado**. Elegibilidade de livros e conta não verificada. Não assumir aprovação nem impedimento universal com base na origem do conteúdo; consultar política aplicável e cadastro específico no lançamento.
