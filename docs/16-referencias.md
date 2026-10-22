# 16 — Referências e limites da pesquisa

[Índice](../README.md)

Consulta realizada em **20/10/2026**. Fontes externas podem mudar; revalidar no bootstrap, na homologação e antes de contratar. Não houve acesso a contas, credenciais ou painel da VPS. Fontes sustentam capacidades gerais; decisões de implementação próprias estão nos documentos, não são recomendações universais dos fornecedores.

| Fonte oficial | Uso | Resultado / limite |
|---|---|---|
| [Payload — Installation](https://payloadcms.com/docs/getting-started/installation) | CMS integrado, PostgreSQL e compatibilidade com Next | Página consultada; versões exatas serão fixadas em B01 |
| [Payload — Jobs Queue](https://payloadcms.com/docs/jobs-queue/overview) | Processamento assíncrono | API de jobs existe; código e concorrência devem ser testados na versão adotada |
| [Payload — Local API](https://payloadcms.com/docs/local-api/overview) | Acesso interno | Informar política explicitamente, não presumir defaults de versões |
| [Next — Self-hosting](https://nextjs.org/docs/app/guides/self-hosting) | Hospedagem própria e proxy | Página consultada; não prova capacidade livre da VPS |
| [Docker — Compose em produção](https://docs.docker.com/compose/how-tos/production/) | Separação de configuração e operação | Referência de implantação futura |
| [Caddy — Automatic HTTPS](https://caddyserver.com/docs/automatic-https) | TLS caso não exista proxy | DNS/portas reais ainda pendentes |
| [PostgreSQL 17 — SQL dump](https://www.postgresql.org/docs/17/backup-dump.html) | Backup lógico | Restore real será validado em B05 |
| [Restic — Introdução](https://restic.readthedocs.io/en/stable/010_introduction.html) | Backup criptografado externo | Destino e custo ainda não escolhidos |
| [Hotmart — Eventos de compra v2](https://developers.hotmart.com/docs/es/2.0.0/webhook/purchase-webhook/) | Verificação e contrato comercial | Busca oficial expôs Hottok; página dinâmica não revelou esquema integral na leitura |
| [Kiwify — Webhooks](https://ajuda.kiwify.com.br/pt-br/article/como-funcionam-os-webhooks-2ydtgl/) | Eventos, teste e reenvio | Confirmados conceitualmente; assinatura e payload atual ainda dependem de documentação técnica/conta |
| [Cakto — Guia de webhooks](https://ajuda.cakto.com.br/pt-br/articles/1-como-funcionam-os-webhooks-na-cakto-guia-completo) | Eventos, segredo e reenvio | Não confirma sozinho transporte/algoritmo do segredo |
| [Brevo — Planos](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans) | Plano gratuito | Consulta informa 300 envios/dia; quota/aceitação real da conta devem ser confirmadas |
| [Brevo — Envio transacional](https://developers.brevo.com/docs/send-a-transactional-email) | Transporte de mensagens | Integração e remetente ainda não homologados |
| [Brevo — Campanhas por API](https://developers.brevo.com/reference/create-email-campaign) | Etapas promocionais | Contrato a homologar com supressões e quotas |
| [Brevo — Tipos de e-mail](https://help.brevo.com/hc/en-us/articles/360021196220-What-are-the-differences-between-marketing-transactional-and-automation-emails) | Separar solicitação e promoção | Promoção exige classificação e consentimento adequados |
| [Google — Conteúdo útil](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Estratégia editorial | Não garante indexação ou ranking |
| [Web.dev — Web Vitals](https://web.dev/articles/vitals) | Metas de experiência | Diferenciar laboratório e dados de campo |
| [ANPD — Cookies e proteção de dados](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais) | Referência de privacidade | Guia orientativo; aplicação e políticas precisam refletir a operação real |

## Referência inacessível e descoberta pendente

A URL de referência Kiwify `https://docs.kiwify.com.br/api-reference/webhooks/listar-chaves-p%C3%BAblicas-de-webhook` apareceu em busca, mas retornou 404 na abertura. Não é fonte válida para definir algoritmo ou autenticação. B09 deve localizar contrato atual por canal oficial/conta. Não usar biblioteca não oficial como substituto silencioso da especificação.

## Origem das decisões do produto

A [conversa original](../reflexoes.md) é insumo histórico. As respostas posteriores do usuário definiram catálogo ainda em produção, painel visual, nenhuma IA integrada, divulgação sem aparecer, três plataformas, VPS compartilhada e orçamento de aproximadamente R$ 50 adicionais. Essas decisões prevalecem sobre sugestões alternativas da conversa.

Regras de elegibilidade, taxas, reembolsos e exclusividade precisam ser verificadas por título e plataforma no cadastro; não foram declaradas aprovadas aqui. Nenhum produto foi presumido publicado com base em outro projeto.

## Design editorial

O [registro de skills e fontes](design/08-skills-referencias.md) identifica instruções aplicadas, limites e referências tipográficas/técnicas. As [referências editoriais comentadas](design/01-identidade.md) distinguem observação documental e interpretação. O arquivo [de inspiração](<../ideais para melhora o desing.md>) permanece íntegro; suas listas não são tratadas como ranking verificado.
