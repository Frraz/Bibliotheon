# 07 — Integrações comerciais

[Índice](../README.md) · [Hotmart](integracoes/hotmart.md) · [Kiwify](integracoes/kiwify.md) · [Cakto](integracoes/cakto.md)

**Estado em 24/10/2026:** ofertas e campanhas podem ser cadastradas para as três plataformas; redirects/medição consentida possuem testes locais. Relacionamento Brevo tem fluxos locais D48–D58, sem conta homologada. D60 implementa contrato/projeção e D61 acrescenta inbox/processador/histórico/auditoria privados locais. D63 acrescenta adaptador/endpoint Hotmart v2 local, desligado e sem conta homologada. D64 acrescenta adaptador/endpoint Kiwify local com HMAC-SHA1, desligado e sem homologação. D65 acrescenta Cakto V1/V2 local com assinatura e recepção atômica, desligado e sem homologação. Atribuição de compra, liquidação e conciliação financeira seguem pendentes. Ver [estado atual](23-estado-atual.md), [D60](17-decisoes.md) e [contrato Brevo](integracoes/brevo.md).

## Separar oferta de integração

Uma oferta pode encaminhar compradores mesmo antes de existir webhook homologado; nesse caso o painel informa “medição automática indisponível” e exige conciliação manual. Links dos três provedores entram na fase 1. Os três conectores são obrigatórios para concluir a fase 2, com estado individual: `not_configured`, `testing`, `verified`, `degraded`, `disabled`.

Ativar oferta requer produto pronto, cadastro autorizado na conta, identificação externa, preço conferido, URL validada e compra/entrega verificadas pelo operador conforme mecanismos disponíveis. Elegibilidade é por título/plataforma, nunca presumida pelo site. Não inferir autorização de publicação a partir de exemplos de outros produtos.

## Pipeline comum

1. Validar autenticação do provedor com corpo original quando necessário.
2. Validar limite/tipo do corpo e extrair envelope mínimo, sem PII ou segredo.
3. Persistir inbox com restrição única; confirmar 200 só após commit. Duplicata durável recebe 200.
4. Dispatcher agenda pendências; worker mapeia IDs e aplica eventos numa transação.
5. Atualizar projeção e auditoria; liberar relatório após commit.
6. Eventos desconhecidos ficam ignorados ou em revisão; falhas reaparecem na fila limitada.

A chave de evento usa ID oficial quando documentado, incluindo provider/account. Se não houver ID estável, usar hash canônico de transactionId + tipo + timestamp + valores financeiros normalizados, com testes de colisão lógica. Nunca usar só transactionId como chave de evento: isso eliminaria reembolsos legítimos. TransactionId, por sua vez, identifica a venda única no escopo provider/account.

Reenvio não significa nova compra. Histórico é imutável, projeção é reconstruível. A ordenação usa tempo do evento e regras documentadas, não o instante de chegada. Se semântica não for suficiente, preservar estado conhecido e abrir divergência.

## Atribuição e afiliados

UTM é contexto de aquisição, não prova de compra. Só atribuir clique a transação quando referência devolvida pelo provedor for suportada, intacta e testada. Não correlacionar por e-mail, IP, valor aproximado ou proximidade de horário. Venda orgânica na plataforma entra no total e pode ter origem desconhecida.

Afiliado: campanha fixa offerId e URL de divulgação aprovada. Preservar plataforma e parâmetros; não substituir por checkout próprio do produtor. Comissão contratada, atribuição e pagamento pertencem ao provedor. Comissão planejada não é custo realizado sem relatório.

## Conciliação

Semanalmente comparar período e fuso dos relatórios das plataformas com transações locais. Separar pedidos, aprovações, reembolsos e liquidações. Importar formato canônico com prévia, arquivar hash e referência de origem, revisar divergências e auditar commit. Nunca cadastrar e-mails em marketing pela importação.

Não somar linha de importação e webhook como duas vendas. Não deduplicar entre plataformas por valor/cliente: compras independentes podem existir. Arredondamento só na apresentação, não no cálculo monetário.

## Contrato de homologação

Cada conector precisa de: fonte e data; conta/produto de teste identificados sem segredo; versão do adaptador; método de autenticação confirmado; catálogo de eventos; fixtures sintéticas; casos de duplicação, ordem, reembolso e ID desconhecido; verificação dos campos de atribuição; comparação com relatório; evidência de reenvio.

Testes locais não comprovam operação na plataforma. Na ausência de sandbox, usar evento oficial de teste disponível e registrar seus limites. Uma compra real controlada envolve pagamento e deve ser executada pelo proprietário, dentro de orçamento autorizado; a documentação não inicia compras.

Nenhuma dependência externa pendente impede implementar o domínio e testar com fixtures. Impede declarar o conector homologado ou habilitar recepção sem autenticação confirmada.


## Implementação comum local — D61

Receptor recebe bytes originais e adaptador confiável, verifica antes da normalização e persiste apenas envelope mínimo. Mesmo provider/account/eventKey e hash retorna duplicate após conferência do registro durável; hash diferente conserva conflito separado, marca revisão e preserva projeção. Colisão não é resolvida pelo retry. Ignorados autenticados ficam auditados sem inventar transação. Ainda não existe recepção pública dos provedores.

Processador mapeia provider/account/product e offer quando explicitamente informado; não escolhe primária, preço aproximado, email ou horário. Produto desconhecido/ambíguo fica em needs_review sem venda criada. Catálogo inativo pode resolver histórico financeiro. IDs de oferta/livro já usados são preservados. Hash/envelope e tempo futuro são conferidos antes dos efeitos. Eventos aplicáveis recompõem todo o histórico em uma transação; divergência conserva a projeção anterior e o fato para revisão.

Lease de cinco minutos com token impede conclusão por tentativa substituída. Falha de commit reverte fato/projeção/auditoria e agenda backoff de 30 segundos, exponencial até uma hora. Cinco tentativas desde attemptBase suspendem automação; owner pode reabrir após corrigir a causa com motivo controlado e auditoria. Tentativas totais não são zeradas. Fila examina de 1 a 25 itens por chamada, padrão um; worker processa um por ciclo de 30 segundos. Estados/datas/erros/último sucesso são consultáveis nas coleções privadas, sem dashboard financeiro consolidado.

Fixtures D61 usam adaptadores internos sintéticos dos três nomes de provedor, não formatos ou assinaturas nativos. Homologação individual continua obrigatória em B08/B09/B10; não ativar URLs nativas ou atribuição com base nesses testes.

## Kiwify local — D64

[Contrato Kiwify](integracoes/kiwify.md) especifica HMAC-SHA1 bruto/signature, identidade order_id + webhook_event_type, centavos nativos e datas de Brasília. Endpoint usa inbox comum e conta da configuração. Aprovação/reembolso exigem instante confirmado; chargeback/recusa sem tal evidência ficam para conciliação, sem preencher updated_at como instante financeiro. Tokens não são enviados ao worker. Fonte oficial atual, fixtures e teste local não homologam a conta. Próximo adaptador independente: Cakto B10.

## Cakto local — D65

Adaptador/endpoint V1/V2 com HMAC/timestamp próprios e recebimento atômico das listas. Datas financeiras específicas, total/taxa decimais exatos, MED em revisão e Pix pendente; sem capturar secret, comprador ou origem não homologada. Resposta HTTP de erro não é repetida automaticamente pelo fornecedor segundo o guia atual. [Contrato, operação e limites](integracoes/cakto.md). Hotmart/Kiwify/Cakto têm código/testes locais, mas nenhum possui conta homologada; B08–B10 continuam parciais. Próxima implementação: B11 conciliação/CSV/financeiro.

## CSV canônico local — D66

Primeira etapa de B11 implementa prévia owner, provisória e somente de leitura; não altera integração/inbox/histórico. Exportação nativa deve ser convertida explicitamente para o contrato interno, sem adivinhar layout/colunas de Hotmart/Kiwify/Cakto. Linhas são instantâneos candidatos, não compras ou movimentos novos. Confirmação durável, fonte/justificativa, resolução auditada e liquidação/custos seguem pendentes. [Contrato e estado](24-conciliacao.md).

## Confirmação CSV para inbox — D67

Lotes/linhas/fonte/autor/justificativa são duráveis; confirmação auditada revalida catálogo/projeção/inbox sob barreira por conta. Só candidatos permitidos geram recibo csv-owner-snapshot-v1; compatíveis não geram fato. CSV não é HMAC do fornecedor e confirmação não é aplicação/liquidação. Worker existente processa separadamente, desligado por padrão. Conflitos/recebimento/reversão insuficiente permanecem bloqueados. [Contrato](24-conciliacao.md). Sem layout nativo inferido ou conta consultada.
