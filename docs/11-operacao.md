# 11 — Runbooks de operação

[Índice](../README.md) · [Infraestrutura](10-infraestrutura.md) · [Qualidade](15-qualidade.md)

Procedimentos de produção para o proprietário; nenhum deploy foi executado. Provisionamento, recuperação administrativa, supressão e backup/restore já têm ferramentas e testes locais. Runbooks de inbox/conciliação/rotina comercial continuam previstos, pois esses subsistemas não existem ainda. Estado e limites no [mapa vigente](23-estado-atual.md).

## Primeiro lançamento

1. Inventariar VPS e registrar baseline de serviços/URLs existentes, RAM, disco e latência.
2. Confirmar domínio, DNS e configuração do proxy; preparar somente vhost/rede do Bibliotheon.
3. Criar segredos, conta administrativa por procedimento privado e destino de backup externo.
4. Subir banco isolado, aplicar migrations e subir app/worker com imagem homologada.
5. Testar readiness, login, upload, preview, publicação, catálogo e redirecionamento.
6. Testar HTTPS, cabeçalhos, DNS, SPF/DKIM/DMARC conforme provedor de e-mail; não sobrescrever registros compartilhados sem verificar.
7. Restaurar backup num ambiente isolado, registrar duração e perdas possíveis.
8. Conferir baseline dos sistemas existentes; só então abrir tráfego e ativar campanha.

Não expor criação do primeiro admin na internet. Ambientes de teste protegidos por autenticação e noindex, com e-mail bloqueado por padrão.

## Recuperar acesso administrativo

O operador com acesso autorizado ao host pode executar `npm run admin:recover < /caminho/privado/recuperacao.json` no ambiente de execução local. O JSON privado contém somente email do owner existente e password nova, com pelo menos 16 caracteres e até 1024 bytes. No runtime empacotado, a entrada equivalente é `node cli/recover-admin.js`, com o mesmo stdin privado e DATABASE_URL da aplicação. Usar imagem atual homologada; não passar senha em argumentos, Git, terminal gravado ou documentação.

O procedimento recusa conta inexistente ou banco com configuração diferente do owner único. Troca senha, encerra sessões, invalida links de recuperação anteriores e limpa bloqueio/cooldown de login. Não apaga/recria conta. Registrar a intervenção sem credenciais, entrar com a nova senha e verificar o acesso anterior encerrado. Acesso ao host é requisito deste fallback; a recuperação por e-mail não está habilitada. Endpoints públicos de forgot/reset respondem 503 genérico sem procurar conta ou gerar token; unlock público é negado. Antes de oferecer recuperação por e-mail, homologar remetente, limites, tokens e fluxo correspondente.

## Atualização

Registrar release/digest/schema; verificar capacidade; concluir backup; pausar jobs que escrevam durante migration incompatível; aplicar migration única; atualizar app/worker; executar smoke e comparar sistemas vizinhos. Manter imagem anterior disponível. Falha de readiness, erro crescente, corrupção de conteúdo ou degradação dos serviços existentes interrompe rollout.

Se schema continua compatível, retornar imagem anterior e revalidar. Se incompatível, não restaurar banco automaticamente: pausar escrita, avaliar perda desde backup, preferir correção progressiva e recuperar em cópia isolada. Registrar intervalo de eventos potencialmente perdidos para reenvio/conciliação. Não apagar volumes na recuperação.

## Falhas de integração

Verificar último sucesso, inbox e logs sanitizados; conferir segredo sem exibi-lo; verificar mudança de contrato. Resolver causa e reprocessar IDs selecionados. Se evento não foi persistido, solicitar reenvio pela plataforma e conciliar relatório. Nunca editar contagem manualmente no dashboard.

Se evento antigo reaparece, preservar histórico e impedir regressão. Conflito financeiro vai para revisão. Replay não envia marketing ou altera consentimento.

## Falhas de e-mail

Fila parada: verificar quota, autenticação, DNS e status do fornecedor. Suspender marketing se houver reclamações ou bounce alto, mantendo tratamento do problema. Priorizar confirmações. Em timeout após possível aceitação, consultar provedor antes de reenviar. Descadastro local vale mesmo com falha da API externa; worker checa supressão antes de cada envio.

## Restauração

1. Selecionar snapshot/dump e manifesto compatíveis, obter chave fora do servidor.
2. Restaurar em rede/volumes novos, nunca sobre produção na primeira tentativa.
3. Desabilitar envios, webhooks e jobs externos; verificar schema, contagens, arquivos e login.
4. Executar smoke com dados protegidos; registrar tempo e ponto recuperado.
5. Para desastre real, escolher troca de tráfego após avaliar perda, recuperar eventos externos e registrar incidente.

Após restaurar backup antigo, reaplicar exclusões e supressões ocorridas depois dele antes de reativar e-mail.

## Rotina

Diária: saúde, fila, falhas de envio, backup e espaço. Semanal: conciliação, revisão comercial, pendências e atualizações de segurança. Mensal: restauração, revisão de retenção, custos e capacidade. Não instalar uma pilha pesada de observabilidade no início; usar healthchecks, métricas do host e alerta externo por canal do proprietário.

Logs estruturados: requestId, tipo, resultado, duração, código de erro e ID interno não pessoal. Sem corpo completo, e-mail, tokens, URLs de preferência ou headers sensíveis. Alertas identificam problema e ação, não compradores.
