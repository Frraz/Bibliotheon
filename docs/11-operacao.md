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

## Pendências de bloqueio Brevo

A fila privada brevo-suppressions é gravada no mesmo commit do descadastro/supressão local. Conferir estado, próxima tentativa e último resultado pelo painel: pending aguarda/reconcilia; processing tem lease de 30 minutos; synced confirma bloqueio/ausência naquela consulta; failed exige intervenção. Corrigir chave/permissão/configuração sem expor valores; só então executar brevo:suppressions --retry-failed pelo CLI privado conforme [execução](20-execucao-local.md). Não editar estados nem desbloquear contatos no provedor para eliminar pendência.

Timeout/429/5xx têm backoff limitado a 6 horas, sem devolução/consumo de quota de mensagens. Alterações externas posteriores não são cobertas pela observação synced: futuras campanhas exigem preflight e sincronização inbound. Nova inscrição local não reativa automaticamente uma blacklist do Brevo. Bloqueio externo de marketing não equivale a bloqueio transacional. Nenhum envio promocional implementado nesta rotina.

## Cadastro externo e compensações

A fila brevo-registrations nasce no commit do consentimento confirmado; só o owner lê e o processamento altera. pending aguarda; processing usa lease de 30 minutos; synced é conferência de contato, não envio; failed exige correção/retry; canceled encerra criação; canceling mantém proteção contra POST tardio após descadastro. Um 404 não prova que cadastro incerto nunca será aplicado. Manter canal de bloqueios/chave privada de links ativos para drenar compensações, mesmo se desativar novos cadastros.

Revisar recusas definitivas no provedor antes de brevo:contacts --retry-failed pelo CLI privado. Não editar estado para synced ou desbloquear contato para eliminar erro. identity_changed não tem retry automático: troca de endereço não é operação disponível na API do produto; investigar e corrigir identidade/objeto externo sem presumir destinatário. Canceling usa backoff até seis horas e só GET/PUT; registros persistentes exigem revisão da conta, sem apagar tentativas. Homologar automações externas antes de ativar cadastro. Ver [execução](20-execucao-local.md).

## Listas por lote no Brevo

Fila privada brevo-batch-lists: creating/filling são intenções com lease de 30 minutos; uncertain exige reconferência; failed indica conflito/recusa/preferência não resolvida; ready é composição pontual e canceled mantém evidência/ID. Cli opera um lote com configuração privada conforme [execução](20-execucao-local.md). Não incluir campanhas automáticas na pasta dedicada. O worker ainda não prepara listas nem dispara campanhas.

Criação sem resposta/ID: conferir nome exclusivo e pasta na conta; repetir depois da próxima conferência busca o objeto sem outro POST. Se necessário, --list-id com ID revisado confere metadados antes de usar. Somente recusa explícita de criação admite --retry-rejected após corrigir configuração. Inclusões incertas não são repetidas: revisar membros/preferências no provedor; depois de composição reparada pelo operador, o CLI observa e confirma. Campos opcionais de preferência ausentes bloqueiam ready até homologação, sem adivinhar consentimento.

Destinatário extra ou nome/pasta divergente interrompe; não apagar terceiros para fazer o teste passar. Preservar IDs de listas canceladas/órfãs e inventariar para futura retenção B12. Consulta de pasta acima do limite local de 1000 exige revisão/rotação/retenção, sem concluir ausência. Ao trocar pasta, respeitar a pasta original dos manifestos existentes. Nenhum envio é autorizado apenas por ready.

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


### Preparação dos links de preferências Brevo (D54)

Criar/homologar na conta o atributo BIBLIOTHEON_PREFERENCES normal/text antes de habilitar BREVO_PREFERENCE_SYNC_ENABLED, com bloqueios e chave de links válidos. CLI privado prepara um lote já elegível, consulta antes de atualizar e reconfirma por GET. Falha de schema/identidade/valor não autoriza campanha; corrigir origem, atributo, permissões ou bloqueios sem imprimir contatos/links/chaves. Campo não é reativação. O worker não executa esta operação.

Chave alterada ou expiração próxima cria nova intenção; hashes antigos permanecem até a validade original. Backups/retomada devem preservar registros de tokens junto das demais intenções. preferenceCheck é pontual: futuro envio exige revisão fresca e homologação do placeholder no template. Sem disparar teste com destinatário real por meio desta CLI.


### Rascunhos Brevo e resposta de criação incerta (D55)

Habilitar BREVO_CAMPAIGN_SYNC_ENABLED apenas após homologar listas/preferências/bloqueios e BREVO_CAMPAIGN_SENDER_ID. CLI privada prepara rascunho sem disparar. Inspecionar manifesto/estado: resultado incerto reconcilia nome ou --campaign-id revisado e confere cópia/remetente/lista/status, sem recriar por simples ausência. Criação explicitamente recusada sem ID permite --retry-rejected após corrigir configuração; opção não vale para timeout.

ID retido e observedIds preservam referência após descadastro, falha de GET ou colisão entre lotes. Não apagar/editá-los para forçar sucesso. Campanha com cópia/lista/status alterados não é sobrescrita automaticamente. Inventariar órfãos e revisar a consulta ao aproximar o limite local de mil campanhas (B12), que inclui toda a conta; consultas incompletas não provam ausência. Futuro transporte exigirá nova conferência e gate próprio, inclusive bloqueios observados fora da aplicação.
