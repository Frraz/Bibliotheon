# 14 — Progresso e retomada

[Índice](../README.md) · [Backlog](13-backlog.md)

Atualização: 21/10/2026, America/Belem.

## Estado real

| Frente | Estado | Evidência |
|---|---|---|
| Ideia e decisões | Definidas para primeira versão | Plano aprovado e documentos 01–17 |
| Documentação | Produzida; validação registrada no documento 18 | [Relatório](18-validacao.md) |
| Base / CI | Aplicação local implementada; CI preparado, sem execução GitHub | [Mapa vigente e evidências](23-estado-atual.md); 29 unitários e build aprovados na última rodada |
| Editorial / vitrine | Catálogo, três LPs, artigos, temas, preview, checkout e slugs implementados/testados localmente | test:catalog/site, 170 telas públicas e 36 de estados |
| Relacionamento | Captura, amostra, consentimento, supressão, recuperação por operador, calendário e quota locais | 11 grupos de marketing, 7 de sequências, 5 de recuperação; transporte real desligado |
| Marketing promocional | Parcial: sem lotes duráveis, sincronização ou transporte de campanhas | Próxima frente B06; política de quota existe, mas não há claim de lote |
| Eventos / financeiro / retenção | Ainda pendentes | B07–B12; campanhas cadastráveis não equivalem a eventos/vendas conciliadas |
| Design / QA | Fundação e rodadas renderizadas locais; B19/B20 parciais | Matriz integral, fase 2, performance e zoom nativo 400% ainda abertos |
| Imagem / backup | Ensaios locais de revisão anterior | Revalidar código/migrations atuais; backup externo e RPO/RTO reais pendentes |
| Livros / primeiro título | Primeiro título selecionado; arquivos, público e oferta pendentes de conferência | [Lançamento](22-lancamento.md) |
| Links e produtos nas plataformas | Não verificados | Nenhuma conta acessada |
| Hotmart / Kiwify / Cakto | Não configurados e não homologados | Checklists individuais vazios |
| E-mail e domínio | bibliotheon.com.br informado; e-mail público ficará vazio até produção por decisão do proprietário | DNS/TLS/remetente não homologados; [lançamento](22-lancamento.md) |
| VPS | Especificação informada; não inspecionada | Nenhum acesso remoto realizado |
| Publicação / vendas | Não confirmadas neste projeto | Sem evidência comercial |

**Projeto completo ainda não pronto para produção.** O [estado atual](23-estado-atual.md) mapeia os 34 requisitos, código existente, sete migrations, relatórios, comandos e riscos. A revisão documental de 21/10 conferiu relatórios e metadados locais; não reexecutou os testes da aplicação nem iniciou agrupamento promocional. Git não está inicializado neste diretório. Na consulta ao banco local, owner/contatos/sequências/inscrições/etapas estavam zerados após as fixtures.

Riscos técnicos abertos: perda do arquivo anterior em troca recusada/rollback de mídia não vinculada ainda exige correção/homologação; aviso pg/Drizzle de queries concorrentes sem causa resolvida; dois avisos de lint na migration de sequências. Imagem atualizada e bateria integral do release continuam necessárias.

## Próxima ação técnica

Pedido de implementação recebido em 20/10/2026. B01 e B02 possuem evidência local. B03/B04/B18 implementados e com primeira rodada de testes; B17/B19/B20 em refinamento. Calendário e conteúdo manual D+2/D+4/D+7/D+10 implementados e testados localmente, incluindo cadastro nativo. Política compartilhada de quota implementada e testada com concorrência/rollback. Próxima frente B06: agrupamento durável por tema/etapa/dia/cópia, uso da reserva no claim promocional e sincronização de supressões/campanhas Brevo, com contratos oficiais e transporte inicialmente desativado. Depois continuar eventos/B07 e conectores/B08–B10, conciliação/relatórios e retenção. Rodada editorial atual passou com teclado, rascunho e movimento reduzido; cobertura de B20 permanece parcial. GitHub e deploy ficam com o proprietário. Retomar por [desenvolvimento](19-desenvolvimento.md) e [execução local](20-execucao-local.md).

## Dependências externas

| Pendência | Responsável | Bloqueia |
|---|---|---|
| Público, amostra, arquivos e preço do título selecionado | Proprietário | Campanha real B14 |
| E-mail público antes da produção e revisão institucional do responsável informado | Proprietário, conforme decisão já registrada | Publicação institucional/captura real; e-mail continua vazio no desenvolvimento |
| Inventário VPS/proxy/recursos livres | Operador autorizado | Deploy B05 |
| Destino externo de backup dentro do orçamento | Proprietário/operador | Produção B05 |
| Cadastro e elegibilidade por produto | Proprietário | Ativação das ofertas |
| Credenciais e eventos oficiais das três contas | Proprietário/implementador | Homologação B08–B10 |
| Contrato atual Kiwify e detalhes de autenticação Cakto | Implementador, fontes oficiais/conta | Ativação segura dos conectores |
| Conta Brevo, quota, remetente e supressões | Proprietário/implementador | Envio real B06 |
| Disponibilidade semanal atual | Proprietário | Ritmo da campanha, não arquitetura |

## Registro de continuidade

Ao concluir trabalho, adicionar data, item Bxx, ambiente, evidência, testes executados, limitações e próxima ação. Marcar separadamente `documentado`, `implementado`, `testado_localmente`, `homologado_externamente` e `publicado`. Não substituir o histórico por uma afirmação genérica de “pronto”.

Os registros a seguir são históricos. Afirmações antigas como “em validação” descrevem aquela rodada; para o estado vigente usar as seções acima e o documento 23.

## Entrega de design — 20/10/2026

**Estado: design especificado.** Criados briefing central, identidade, tokens, componentes, wireframes públicos/painel, comportamento, matriz visual e fontes. Paletas clara/escura têm cálculo reproduzível. Nenhum frontend, protótipo, logotipo final ou skill global foi instalado/criado.

Novos requisitos R27–R34, tarefas B17–B20 e testes T22–T29 estão documentados, não implementados. Próxima ação técnica continua B01; em seguida B17 antes das coleções e telas. Publicação, screenshot renderizado, acessibilidade em browser e conversão permanecem não validados. Evidência documental em [validação](18-validacao.md).

## Implementação autorizada — 20/10/2026

Registro anterior preservado como histórico. Agora existe aplicação local Next/Payload/PostgreSQL; B01 tem migração e testes de API, e B17 está em andamento com screenshots da home vazia, fontes e temas. Evidências, limites e pendências no [documento 19](19-desenvolvimento.md). Nenhuma conta externa, VPS, publicação de livro ou venda foi verificada. Os dois textos históricos continuam íntegros. Não declarar fase 1 ou operação comercial completas.

## Continuidade — 21/10/2026

Coleções editoriais/ofertas e migrações aditivas testadas localmente: drafts, uploads por bytes, três provedores sintéticos, publicação, primária única concorrente. Catálogo, LPs, artigos, temas, institucionais, preview privado, checkout/campanha e histórico de slugs implementados. Teste HTTP integrado passou no runtime standalone, incluindo sitemap após publicação e flatten de redirecionamentos.

Primeira rodada pública: 170 screenshots, dois temas/seis larguras, axe/overflow sem falhas, título longo/capa ausente/teclado. Refinamentos posteriores na apresentação, menu e dashboard requerem rodada atualizada. Dashboard padrão apresentou três falhas de acessibilidade; substituição pelo ponto de extensão suportado está em validação. Não declarar B20 concluído. Sem integrações externas, VPS, livro real ou operação comercial.


## Relacionamento e lançamento — 21/10/2026

Primeiro título, domínio e responsável registrados em [lançamento](22-lancamento.md). Por decisão do proprietário, e-mail público ficará vazio até preparação de produção; público específico ainda pendente. Nenhuma oferta real publicada.

B06 possui serviços e migrações locais de captura/confirmação/descadastro, fila e transporte transacional desativado. `test:marketing` passou com transporte em memória e fixtures; a rodada HTTP/browser passou com 84 screenshots em seis larguras. Supressão manual auditável possui API, CLI e tela com 36 screenshots aprovados; sincronização automática, marketing promocional e homologação externa continuam pendentes. Detalhes e limites no [desenvolvimento](19-desenvolvimento.md). Captura real continua bloqueada por configuração/avisos até revisão. Não declarar fase 2 ou produto completo.

Recuperação administrativa pelo operador implementada/testada localmente: troca privada de senha, revogação das sessões/tokens e limpeza de bloqueio/cooldown. Recuperação por e-mail segue indisponível explicitamente; não confundir com transporte Brevo homologado. E-mail público permanece vazio conforme decisão do proprietário.

Calendário D+2/D+4/D+7/D+10 implementado/testado localmente: migração aditiva, sete grupos de domínio aprovados, arquivo vinculado preservado byte a byte e cadastro pelo formulário nativo. Rodada do calendário com 48 telas e revisão complementar com 12 telas aprovadas. Novo build isolado e regressão editorial com 20 telas passaram, incluindo ordenação por teclado, rascunho separado da publicação e rolagem sob movimento reduzido. Política compartilhada de quota implementada/testada posteriormente; agrupamento por tema/dia/cópia, claim promocional e API de campanhas Brevo continuam pendentes. Nenhuma promoção enviada. Substituição recusada de mídia não vinculada ainda exige cobertura de integridade antes do release.
