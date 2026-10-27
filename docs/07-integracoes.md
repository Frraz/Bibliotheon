# 07 — Integrações comerciais

[Índice](../README.md) · [Hotmart](integracoes/hotmart.md) · [Kiwify](integracoes/kiwify.md) · [Cakto](integracoes/cakto.md)

**Estado em 25/10/2026, D81:** ofertas/campanhas, redirects e medição consentida possuem testes locais. Relacionamento Brevo tem fluxos locais D48–D58; inbox/processador/histórico/auditoria comerciais existem em D60–D61. Hotmart v2 D63, Kiwify D64 e Cakto V1/V2 D65 têm adaptadores/endpoints locais, desligados e sem conta homologada. Conciliação inclui associação/decisão auditadas, CSVs canônicos de snapshot/evidência, ledger de liquidação/custos, prévia financeira, importação e registro/correção de liquidações/custos pelo painel. P03/P04/P05 continuam parciais; atribuição, cobertura/rotina integral e homologação das contas permanecem pendentes. Ver [estado atual](23-estado-atual.md), [contrato canônico](24-conciliacao.md) e [Brevo](integracoes/brevo.md).

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

D82 acrescenta interface local de associação/bloqueio do catálogo para os três namespaces de provedor, sem autenticação/eventos/conectores novos. Atestação owner não autentica relatório externo nem conclui homologação. Resolução financeira visual e cobertura integral permanecem pendentes.

D83 permite resolver por UI fontes já persistidas dos três namespaces e evidências canônicas D75–D77. Não altera autenticação/eventos/adaptadores nem adivinha relatório nativo. Seleção de prova substituta exige exclusão da fonte substituída. Uma decisão aplicada localmente não homologa fornecedor, atribui compra a campanha ou comprova liquidação.

D84 calcula taxa/idade de coorte a partir das provas internas sem adivinhar janelas de reembolso/chargeback dos provedores. windowVerified=false permanece explícito; idade observada não homologa maturidade nem fonte/conta. Nenhuma autenticação/evento/adaptador foi alterado.

D85 mostra processamento a partir de lastSuccessAt já escrito pela inbox e pela aplicação financeira. Não usa data de consulta, evento, recebimento ou custo como prova de sucesso. Dados são da população consultada; não homologam conectores, saúde atual da conta nem atribuição P06. Referência de clique sem validação permanece sem campanha comprovada.

D86 verifica localmente sete estados canônicos para cada provedor, sem interpretar exportação nativa ou autenticar um relatório do fornecedor. CSV complementar registra prova; decisão financeira aplica; liquidação comprovada usa trilha própria. Aceite P03/P05 é local e não ativa flags, envia e-mail ou homologa conta. Atribuição P06 continua exigindo contrato oficial atual e prova suportada, sem inferência.

## Referência de saída consentida — D87

O redirecionador pode anexar `sck=<UUID do registro checkout-clicks>` somente para campanha ativa com consentimento válido e URL sem `sck` preexistente. As centrais atuais dos três provedores aceitam `sck` em links de checkout; Hotmart V2 documenta `purchase.origin.sck`. Kiwify usa `TrackingParameters.sck` nas fixtures locais, mas o documento técnico direto não abriu nesta rodada; Cakto documenta parâmetros no checkout, porém a presença no payload real também depende de H01. Assim, os adaptadores extraem exclusivamente UUID; homologação separada confirma preservação e entrega em cada conta.

No relatório, referência só vale se apontar para saída consentida e coincidir com provedor, conta da oferta, oferta/livro e aprovação dentro da janela de 30 dias, sem revisão. O valor de campanha não é derivado de UTM livre, pessoa, preço ou momento. Referência ausente/inválida não recebe correspondência retrospectiva. [Pesquisa oficial e evidência](16-referencias.md#revalidação-de-rastreamento-de-vendas--25102026-d87) e [auditoria](../artifacts/attribution/p06-audit-d87.json).

## Jornada HTTP local dos callbacks — D88

Os testes loopback ligaram `sck` da saída consentida às rotas Hotmart, Kiwify e Cakto, à projeção financeira e ao relatório. Hotmart incluiu replay, UUID de outro contexto, texto livre e referência ausente; só a referência/contexto correspondente gera atribuição. Kiwify `TrackingParameters.sck` e Cakto `data.sck` passaram em payloads sintéticos construídos a partir dos adaptadores; isso não verifica o payload que as contas reais entregam. Reversões sem cobertura mantêm receita null. [Auditoria e resultados](../artifacts/attribution/p06-audit-d88.json). H01 por provedor segue obrigatório; nenhuma integração foi habilitada em conta.
