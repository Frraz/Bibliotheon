# Conector Cakto

[Integrações](../07-integracoes.md) · [Referências](../16-referencias.md)

## Evidência disponível

A central oficial descreve configuração com chave secreta e eventos `purchase_approved`, `purchase_refused`, `refund` e `chargeback`. Também distingue geração de Pix de compra aprovada. Há disparo de teste e reenvio pelo painel. Consulta em 20/10/2026. [Guia oficial](https://ajuda.cakto.com.br/pt-br/articles/1-como-funcionam-os-webhooks-na-cakto-guia-completo).

O guia não basta para afirmar onde a chave chega ou como uma assinatura deve ser validada. Confirmar o contrato técnico vinculado à conta; não presumir HMAC, header ou tolerância de timestamp.

## Implementação planejada

Endpoint POST `/api/v1/webhooks/cakto`; segredo lógico `CAKTO_WEBHOOK_SECRET`, consumido pelo verificador conforme contrato confirmado. Mapas iniciais de semântica: purchase_approved → approved; purchase_refused → refused; refund → refunded ou partially_refunded conforme valor/contrato; chargeback → chargeback. Assinatura cancelada e checkout abandonado não anulam compra avulsa nem geram receita.

Persistência mínima antes de 200. A central descreve casos em que resposta de erro exige reenvio manual; por isso registrar falha operacional e reconciliar, sem depender somente de retentativa externa. Não devolver sucesso ao perder evento.

## Checklist de homologação

- [ ] Localização e validação do segredo confirmadas; corpo adulterado testado conforme mecanismo real.
- [ ] IDs, unidades monetárias e timestamp confirmados por fixture.
- [ ] Eventos financeiros mapeados; Pix gerado não vira venda.
- [ ] Repetição, reembolso antecipado e evento desconhecido testados.
- [ ] Evento oficial de teste e reenvio exercitados na conta.
- [ ] Relatório reconciliado; atribuição e URL afiliada verificadas separadamente.

Estado atual: **não configurado, não homologado**. Não enviar dados de compradores para capturadores públicos durante homologação; usar endpoint próprio e fixtures sanitizadas.
