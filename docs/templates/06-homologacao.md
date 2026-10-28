# Modelo — Homologação e release

[Modelos](README.md)

Data, responsável, ambiente:
Versões/digest/schema:
Item Bxx e requisitos Rxx:
Provedor/contrato/versão, quando aplicável:

| Cenário Txx | Entrada sintética | Resultado esperado | Resultado observado | Evidência |
|---|---|---|---|---|
| | | | Não executado | |

## Conector

- [ ] Autenticação confirmada na fonte atual e conta.
- [ ] ID/evento/tempo/valores mapeados.
- [ ] Duplicata, ordem invertida, reversão e evento desconhecido.
- [ ] Falha de banco e retomada sem perda silenciosa.
- [ ] Relatório reconciliado e atribuição testada separadamente.
- [ ] Sem comprador, segredo ou corpo real persistido como fixture/log.

## Conciliação e financeiro

- [ ] Contrato canônico/conta/provedor/fonte conferidos, sem dados de comprador.
- [ ] Prévia não grava; alteração de entrada exige nova conferência.
- [ ] Stage e commit com resposta perdida repetem sem duplicar lote ou fatos.
- [ ] Lote pode ser retomado; valores/datas/moeda/desconhecidos/substituições estão visíveis.
- [ ] Blocked/stale impedem confirmação; mudança real no histórico é revalidada.
- [ ] Snapshot queued, prova registrada, aplicação e recebimento têm estados distintos.
- [ ] Casos dos três provedores e limites de cobertura registrados separadamente.
- [ ] Crédito/débito e custos estimados/confirmados por fonte/linha, sem arredondamento monetário.
- [ ] Campanha gravada no relacionamento real e preservada na correção; original e sucessora auditáveis.
- [ ] Repetição após resposta perdida não duplica movimento; zero explícito não se confunde com ausência.

## Revisão visual da aplicação

- [ ] Temas claro/escuro e preferência sistema, inclusive reload/storage indisponível.
- [ ] 360/390/768/1024/1440/1920px e reflow/zoom adicional.
- [ ] Teclado, foco, estados de erro/loading e reduced-motion.
- [ ] Capas íntegras, títulos longos, catálogo pequeno e CTA disponível.
- [ ] Screenshots e limitações por tela, sem dados pessoais reais.

## Infraestrutura

- [ ] Baseline dos serviços existentes registrado e preservado.
- [ ] HTTPS, DNS, portas e acesso administrativo verificados.
- [ ] Se backup for escolhido: destino remoto e restauração com duração registrada. Se dispensado: uso explícito de `--sem-backup`, sem declarar capacidade de recuperação homologada.
- [ ] Rollback e recuperação de eventos definidos.

Conclusão: passou / falhou / bloqueado.
Limitações e dependências:
Próxima ação:

Separar teste local, evento oficial de teste, compra controlada e operação real. Não marcar teste não executado como aprovado.

### Interface de identidade do catálogo (D82)

- [ ] Conferir namespaces de provedor/conta/produto/oferta e destino livro/oferta existente.
- [ ] Validar associação com atestação e hold com evidence_inconclusive/atestação falsa.
- [ ] Prévia sem escrita; mudança de catálogo/histórico bloqueia plano stale.
- [ ] Resposta perdida repete mesma decisão sem duplicação e mantém fonte/motivo.
- [ ] Consultar revisões anterior/sucessora e snapshot integral; fatos originais preservados.
- [ ] Histórico/filtro/paginação sem JS, controles/links com alvo acessível, dois temas e texto ampliado.
- [ ] Registrar separadamente que a UI de identidade não é a UI de resolução financeira nem homologação da conta.

### Resolução financeira no painel (D83)

- [ ] Consulta sem escrita; nenhuma fonte/variante selecionada automaticamente.
- [ ] Cobertura de todo o componente, inclusive fontes em outras páginas; excluir substituídas por relatório.
- [ ] Prévia bloqueada não confirma; conciliação/hold usam fonte/motivo/atestação correspondentes.
- [ ] Repetição após resposta perdida mantém decisão/aplicação únicas; stale exige outra prévia.
- [ ] Valores assinados/null corretos, sem comprovação implícita de caixa/lucro.
- [ ] Fatos originais e revisões anteriores preservados; aplicações worker separadas do resultado registrado.
- [ ] Paginação, sem JS/JSON completo, temas, teclado, texto 200% e entrelinha proporcional nos botões.
- [ ] Registrar o aceite integrado P05 separadamente de B20 integral e homologação externa.

### Cobertura/coortes (D84)

- [ ] Contagem de transações com liquidação restrita à moeda/coorte, com caixa fora da coorte mantido no período próprio.
- [ ] Revisões state=unknown e datas ausentes visíveis, sem somar seus valores nas coortes.
- [ ] Correções resolvidas antes do período; zero conhecido distinto de ausência e overflow explícito.
- [ ] Taxa somente com estado integralmente conhecido e nenhuma revisão; uma compra conta uma vez por reversão.
- [ ] Idade observada sem janela presumida; observedAt não é último processamento.
- [ ] Detalhamentos e cobertura de atribuição conferidos separadamente antes do aceite P04/P05.

### Detalhamentos e processamento (D85)

- [ ] Livro efetivo conferido, namespaces/moedas separados e caixa fora da coorte corretamente alocado.
- [ ] Revisão/vínculo inconsistente sem livro conferido; valores originais preservados.
- [ ] Custos de campanha não atribuem compras/receita; null distinto de zero e parcela sem atribuição visível.
- [ ] lastSuccessAt real, com cobertura/escopo, distinto de consulta/evento e sem datas futuras inferidas.
- [ ] Paginação 20+1, disclosure/filtros preservados, temas/texto ampliado/sem JS e prova JSON privada.
- [ ] Aceite local P04 separado de P03/P05/P06 e da homologação externa/release.

### Estados e operação integrada (D86)

- [ ] Sete estados por provedor persistidos/aplicados com datas/valores/null corretos.
- [ ] Prova insuficiente/incompatível recusada sem transação; lote inválido/misto/futuro sem prefixo gravado.
- [ ] Preview/stage/commit/decisão/caixa distintos, com fonte/auditoria/atestação.
- [ ] Repetição/conflito/stale/rollback integral e snapshot de 13 colunas preservado.
- [ ] Jornada CSV → catálogo → financeiro → caixa/custo → relatório → repetição sem duplicar.
- [ ] Aceite local P03/P05 separado de P06/P07, B20 integral e gates externos/release.

### Retenção e restore de identidade (D110)

- [ ] Revisar 35 migrations e imagem da revisão final, sem usar D107 como aceite do schema novo.
- [ ] Conferir manifesto v3 quando houver fato automático; compatibilidade v1/v2, pending, nova finalidade e quarentena.
- [ ] Verificar supressão com vencimento original e fato automático de 24 meses; não fabricar pedido humano.
- [ ] Provar guarda externa atual, replay isolado e conciliação dos vínculos do provedor antes de liberar transportes.

## D112 — Descadastro e retenção por assunto — 26/10/2026

No release final, conferir 35 migrations, coleção temática privada, retirada idempotente, confirmação antiga após retirar assinatura e novo opt-in explícito. Confirmar também hold das promoções quando opt-in ativo tem 12 meses/está sem data, marcador de saúde v2 e liberação apenas após novo opt-in confirmado. Ensaiar manifesto v4 com tema ausente do snapshot e outro assunto/amostra preservados; nova prova posterior deve impedir revogação indevida. Legado sem fato, envio incerto e provedor devem permanecer para conciliação. Atualizar manifesto privado fora do snapshot e comprovar guarda/chaves antes de liberar transportes.
