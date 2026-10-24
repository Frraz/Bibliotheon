# 08 — Aquisição, conteúdo e relacionamento

[Índice](../README.md) · [Modelos](templates/README.md) · [Métricas](09-metricas.md)

## Lançar uma campanha executável

Escolher um livro pronto e preencher briefing: público, problema específico, linguagem usada pelo leitor, solução atual, diferencial, amostra, oferta e objeções. Enquanto em produção, preparar rascunhos e pesquisar demanda; não anunciar entrega imediata ou iniciar compra sem produto pronto.

Um ciclo inicial tem uma LP, uma amostra, três conteúdos úteis, peças derivadas e um canal principal. Canal é escolhido pelo público do primeiro livro; não presumir que um canal único funcione para todos os nichos.

| Conteúdo | Intenção | Próximo passo |
|---|---|---|
| Tutorial que resolve um problema pequeno | Mostrar utilidade e competência | Amostra relacionada |
| Erros e decisões frequentes | Ajudar a reconhecer obstáculos | Trecho ou checklist |
| Exemplo aplicado com resultado verificável | Demonstrar o material | LP e oferta |

De cada conteúdo derivar duas ou três peças: carrossel, texto curto ou demonstração de tela sem aparecer. Distribuição manual em canal pertinente; respeitar regras de comunidades. Não publicar comentários em massa nem enviar mensagens automaticamente.

## SEO e confiança

Organizar assuntos por intenção do leitor, com links entre artigo, tema e livro. Pesquisar termos usados por pessoas reais e responder com exemplos próprios. Evitar páginas finas ou centenas de variações quase iguais. Incluir autoria/responsabilidade editorial, revisão e fontes quando necessárias. Nenhum volume de artigos garante ranking ou vendas.

Configurar Search Console no domínio confirmado, enviar sitemap e revisar indexação. Search Console é fonte complementar; não precisa de conector próprio no MVP. Conteúdo segue orientação oficial de utilidade ([Google](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)).

## Amostra e sequência

Amostra deve ser útil por si, representar o livro e permitir avaliar qualidade. Marketing é opcional; o visitante pode receber só a amostra. Double opt-in é escolha de produto para confirmação do contato, não afirmação de obrigação universal.

| Momento após confirmação | Conteúdo | Condição |
|---|---|---|
| Imediato | Material solicitado e instrução de acesso | Pedido confirmado, mesmo sem marketing |
| D+2 | Uma aplicação simples do tema | Assinatura temática ativa |
| D+4 | Exemplo e erro frequente | Assinatura ativa |
| D+7 | Oferta do livro, conteúdo e limites | Assinatura ativa, oferta disponível |
| D+10 | Respostas a objeções e convite final | Assinatura ativa, oferta disponível |

Sequência única por contato/material/versão, sem repetição automática após conclusão. Se compra puder ser identificada por vínculo legítimo e confirmado, permitir supressão da oferta; sem vínculo, não prometer exclusão automática de compradores. Descadastro, bounce e complaint suspendem marketing imediatamente no banco local e no provedor.

No calendário local, o proprietário cadastra quatro assuntos/textos e a oferta no Payload, revisa e ativa a sequência. Incompleta pode permanecer inativa. Somente confirmações novas que efetivamente concedem assinatura entram; não importar contatos antigos retroativamente. Cada inscrição preserva sua revisão e seu conteúdo, inclusive oferta e contexto de campanha. Mudança de mensagens/oferta exige aumentar a revisão; mudar amostra/versão exige outra sequência. Uma confirmação sem sequência ativa mantém a entrega da amostra, sem promessa de marketing.

Preparação confere assinatura, supressão, material, tema e versão. D+7/D+10 também verificam oferta e campanha, sem fallback de afiliado; indisponibilidade retém essas etapas para nova conferência. Descadastro ou desativação cancela as etapas pendentes/prontas e preserva histórico, sem reinício automático ao reativar. Datas são intervalos de 24 horas contados da confirmação UTC. Pronta não significa enviada: agrupamento, reserva de quota e transporte por campanhas são etapas distintas, implementadas/testadas localmente em D48–D58. O transporte revalida elegibilidade e supressões imediatamente antes do disparo, além do calendário.

Brevo é transporte; calendário e consentimento ficam no Bibliotheon. Usar templates revisados: API transacional somente para confirmação e entrega solicitada, sem promoção; etapas promocionais por API de campanhas de marketing, com destinatários consentidos agrupados por tema/etapa/dia. Persistir ID da campanha e o conjunto de destinatários; sincronizar supressões antes do disparo e não agendar no provedor com antecedência. Não depender de automação paga. Essa separação segue a [classificação de e-mails do Brevo](https://help.brevo.com/hc/en-us/articles/360021196220-What-are-the-differences-between-marketing-transactional-and-automation-emails). Quota inicial configurada conservadoramente em 250/dia, reservando capacidade para confirmações; confirmar limite real e todos os usos da conta antes de ativar. Integrar eventos de entrega/falha por mecanismo autenticado homologado ou conciliar manualmente supressões até isso ocorrer.

Política local compartilhada: BREVO_DAILY_QUOTA entre 1 e 250, BREVO_TRANSACTIONAL_RESERVE entre 1 e a quota total (padrão 50, limitado ao total quando a variável estiver ausente). Uma reserva promocional só cabe quando o uso total mais destinatários permanece abaixo ou igual ao total menos a reserva transacional; política deliberadamente conservadora mesmo após uso transacional. Lotes são indivisíveis, sem reserva parcial. Claim durável e incremento de quota devem ocorrer na mesma transação; o orçamento não é liberado após timeout ou resultado incerto. O dia local dessa contabilidade vira à meia-noite UTC; não presume o horário de reset ou créditos da conta externa. O transporte promocional D56 utiliza essa política nos testes locais; disparo real permanece desativado e sem homologação da conta.

Se cota esgotar, informar atraso, enfileirar e enviar no próximo período permitido; não disparar repetidamente. Em timeout incerto, reconciliar estado do envio antes de reenviar. Se o provedor não garantir idempotência, registrar possibilidade residual de duplicação e interromper tentativas cegas.

## Afiliados e parcerias

Kit por livro: público, promessa verificável, cinco argumentos, objeções, imagens autorizadas, amostra, ideias de posts e instruções para obter link oficial. Comissão e regras variam por plataforma; nenhum percentual global é presumido. Prospecção manual e personalizada, começando por parceiros com público compatível.

## Rotina e expansão

Referência de 5–10h/semana da conversa original, a confirmar: 1h de análise/pesquisa, 2h de conteúdo, 2h de distribuição e relacionamento, 1h de melhoria da oferta; horas extras para desenvolvimento pontual. Com menos tempo, reduzir volume mantendo distribuição e revisão.

Revisar a cada semana: sem visitas → distribuição/demanda; visitas sem avanço → oferta e adequação; cliques sem compras → checkout/preço/confiança; reembolsos → expectativa e qualidade. Amostras pequenas geram hipóteses, não conclusões estatísticas.

Anúncios são posteriores e exigem teto aprovado, hipótese, rastreamento e regra de parada. Ferramentas gratuitas só entram se resolverem problema do público e houver capacidade de manutenção.
