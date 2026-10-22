# 07 — Integrações comerciais

[Índice](../README.md) · [Hotmart](integracoes/hotmart.md) · [Kiwify](integracoes/kiwify.md) · [Cakto](integracoes/cakto.md)

**Estado em 21/10/2026:** ofertas e campanhas podem ser cadastradas para as três plataformas; redirects foram testados com fixtures. Pipeline comercial, inbox, adaptadores, conciliação e estados de saúde por provedor ainda não implementados. Os procedimentos abaixo são contratos do produto completo. Só há transporte transacional Brevo em código, sem conta homologada; ver [estado atual](23-estado-atual.md) e [contrato Brevo](integracoes/brevo.md).

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
