# Conector Kiwify

[Integrações](../07-integracoes.md) · [Referências](../16-referencias.md)

## Evidência disponível

A central oficial confirma notificações condicionadas a eventos, incluindo compra aprovada. [Como funcionam os webhooks](https://ajuda.kiwify.com.br/pt-br/article/como-funcionam-os-webhooks-2ydtgl/), consulta em 20/10/2026.

Uma página de referência de chaves públicas apareceu na busca, mas retornou 404 ao abrir. Isso não comprova um esquema de assinatura utilizável. Não inventar header, algoritmo, token no corpo ou equivalência com Hotmart.

## Implementação planejada

Endpoint POST `/api/v1/webhooks/kiwify`; adaptador com verificação de autenticidade obrigatória. No trabalho B09, consultar documentação atual vinculada à conta e capturar evento de teste em ambiente controlado. Registrar mecanismo, localização de credenciais/assinatura, canonicalização e política de rotação antes de ativar.

Configuração de autenticação será definida a partir desse contrato, sem chave fictícia com significado ambíguo. Falta de contrato confirmado mantém conector desabilitado e recepção retorna 503; não aceitar qualquer POST como compra.

Mapear eventos de aprovação, recusa/cancelamento, reembolso e chargeback apenas quando efetivamente suportados. Confirmar transactionId, productId, oferta, tempo e unidade monetária; testar centavos versus decimal para impedir receita multiplicada por cem. Retorno de parâmetros de atribuição depende de teste específico.

## Checklist de homologação

- [ ] Esquema atual e autenticação documentados com fonte e fixture sintética.
- [ ] Requisição autêntica aceita; adulterada, inválida e sem autenticação rejeitadas.
- [ ] IDs e unidades financeiras comparados ao relatório.
- [ ] Compra aprovada, reversão e evento desconhecido mapeados.
- [ ] Duplicatas, ordem invertida e falha de banco exercitadas.
- [ ] Política de reenvio verificada na conta; conciliação testada.
- [ ] URL afiliada preservada e atribuição confirmada ou marcada indisponível.

Estado atual: **não configurado, não homologado**. Desenvolvimento do adaptador pode iniciar com interface e testes sintéticos; sua implementação de autenticação exige descoberta externa, registrada como dependência B09.
