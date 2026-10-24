# 12 — Segurança e privacidade

[Índice](../README.md) · [Interfaces](06-interfaces.md)

Este documento define controles de engenharia e escolhas conservadoras do produto. Não substitui a definição das obrigações concretas do responsável pelo negócio. Políticas públicas precisam de nome do responsável, contato e fornecedores reais antes de publicação.

Estado técnico revisado em 24/10/2026: acesso privado, validação de uploads, tokens, consentimento e supressão possuem testes locais; não é aceite integral de segurança. Retenção, exportação/exclusão, reaplicação pós-restore, proteção administrativa do host e integrações reais ainda pendentes. O e-mail público continuará vazio até produção, por decisão do proprietário. A preservação de mídia em troca recusada/rollback foi corrigida e testada localmente, com exclusão física diferida; homologação da imagem e do ambiente real permanece pendente. Ver [estado atual](23-estado-atual.md).

## Acesso e superfície

Administrador único `owner`, sem criação pública de conta. Sessão HttpOnly, Secure em produção e política SameSite apropriada; expiração e recuperação testadas. Rate limit no login e recuperação com mensagens genéricas. Priorizar MFA via mecanismo compatível comprovado; não presumir que esteja incluído no CMS. Enquanto não houver MFA homologado, restringir administração por VPN ou allowlist operacional documentada, mantendo rotas públicas acessíveis.

Permissões deny-by-default em coleções e campos. Público só lê projeções publicadas; ninguém fora de serviços internos escreve transações/inbox. Testar REST, GraphQL se habilitado e Local API. Desabilitar GraphQL se não utilizado. Acesso a jobs via APIs internas autorizadas, nunca endpoint público genérico.

## URLs, conteúdo e uploads

Checkout HTTPS com host exato aprovado por operador; validar hostname real, não substring. Domínio de checkout/afiliado deve ser confirmado por provedor/conta. Não buscar URL arbitrária no servidor. Links editoriais externos abrem com proteção adequada; rich text sanitizado, sem scripts ou HTML executável livre.

Uploads: imagens JPEG/PNG/WebP até 5 MiB; PDF gratuito até 20 MiB, magic bytes e extensão verificados, nome aleatório, sem SVG/HTML executável. Reencodar imagens e remover metadados; PDF servido como download com MIME e nosniff. Rejeitar travessia de diretório e arquivos fora de finalidade. Livros pagos completos e kits internos não entram no bucket/volume público.

CSP e headers ajustados/testados ao Next/Payload, não copiados cegamente; nunca enfraquecer globalmente CSP só para preview. Segredos segregados por ambiente e fornecedor, rotação registrada. HMAC/token verifica autenticidade conforme contrato real; IP allowlist isolada não prova origem.

## Preservação e limpeza de mídia

D47: o patch opt-in de Payload 3.91.0 impede a exclusão física antecipada na coleção Media. Substituições usam UUID novo; falha na validação, em hooks ou rollback conserva o arquivo anterior. Mídia vinculada a amostra continua exigindo novo cadastro/versão. Campos técnicos não podem ser alterados sem upload validado.

A coleta de órfãos consulta referências atuais sob o mesmo advisory lock das mutações. Só remove arquivos regulares com nome UUID gerenciado, sem referência, após 24 horas da primeira observação persistida no índice privado do volume. Simulação não grava o índice nem inicia carência; arquivos desconhecidos e links simbólicos são ignorados. Índice inválido interrompe a coleta. Não é a rotina de retenção de dados pessoais de B12.

O backup diário do atualizador confirma o snapshot externo antes de executar a coleta, com app/worker parados; falha retorna erro e tenta retomar a aplicação. Monitorar contagens, falhas e espaço do volume. Procedimento no [guia](../deploy.md). Prova local: [seis grupos de integridade](../artifacts/media-integrity/local-results.json); sem backup externo realizado nesta rodada.

## Consentimento e minimização

Captura pede só e-mail e material; marketing com checkbox separado desmarcado, finalidade e link de privacidade. Guardar versão do texto e ação. Analytics opcional com aceitar/rejeitar equivalentes e revogação acessível. Sem consentimento analítico, não criar ID persistente nem cookie de atribuição; compra permanece funcional.

Compra externa não autoriza newsletter. Não armazenar CPF, telefone, endereço ou e-mail de comprador vindo do webhook quando não necessários. Informar plataformas de checkout e provedor de e-mail no aviso. Decisão sobre base legal e transparência deve considerar operação concreta, tomando como referência [orientação da ANPD sobre cookies](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais).

## Bloqueios do provedor e quota promocional

D50: claim interno exige preflight autenticado recente de todos os destinatários elegíveis, sem HTTP durante locks de banco. Conferência privada de até cinco minutos vincula lote e versões locais; alteração/expiração/ausência/falha impedem reserva de quota. Observação de blacklist gera action própria, sem atribuir causa não documentada, e cancela marketing atomicamente. Não reativa contatos, não cria endereço a partir de payload e mantém amostra solicitada independente quando não há bounce/complaint conhecidos. Entrada pública/manual não pode fabricar observação autenticada.

A conferência é pontual. Revalidação no envio D56 e callback autenticado D58 existem localmente; homologação externa permanece pendente. Nenhum envio promocional real autorizado por teste sintético. Ver [Brevo](integracoes/brevo.md) e [evidência](../artifacts/provider-preflight/local-results.json).

## Retenção inicial de produto

Prazos abaixo são defaults operacionais a validar antes da coleta; não representam prazo legal universal.

| Dado | Política inicial |
|---|---|
| Pedidos não confirmados | Excluir em 7 dias; tokens expiram em 24h |
| Eventos de visitas/cliques identificáveis | 90 dias, depois agregados sem identificadores |
| Inbox mínima processada | 90 dias; preservar ledger normalizado necessário |
| Logs técnicos | 14 dias; sem PII; chaves de rate limit até 24h |
| Contatos ativos | Revisar após 12 meses sem interação útil; renovar interesse ou excluir |
| Descadastrados | Retirar dados de marketing em até 30 dias; conservar supressão pseudonimizada por 12 meses para impedir reimportação |
| Consentimento/auditoria | 24 meses inicialmente, com acesso restrito e revisão de necessidade |
| Transações mínimas | 24 meses operacionais; obrigações contábeis específicas definidas com responsável, fora do marketing |
| Backups | 7 diários, 4 semanais, 3 mensais; exclusões reaplicadas na restauração |

O job diário de retenção deverá produzir relatório de contagens sem dados pessoais; ainda não está implementado. O contato de privacidade e seu procedimento devem permitir verificar identidade proporcionalmente, localizar dados, exportar/corrigir/excluir conforme necessidade e registrar conclusão. Cancelar envios pendentes antes de excluir. Supressão pseudonimizada continua protegida, não é anonimização. Os prazos da tabela ainda não são rotinas executadas pela aplicação.

## Critérios antes de coletar dados reais

Responsável e contato definidos; avisos publicados; consentimento testado; administração protegida; backup/restauração; supressão; retenção; logs sanitizados; contrato de e-mail verificado. Não marcar esses controles como prontos só porque estão documentados.


D58: webhook de marketing autentica com Bearer antes de leitura/banco; token não deve aparecer em URL/logs/Git. Token de entrada, HMAC de eventos e segredos de sessão/links são independentes. HMAC local não é assinatura do provedor. Envelope não duplica email ou corpo; liga somente contato já existente. Comprovação por etapa exige impressão de identidade histórica capturada antes do envio. Endereços alterados/legado sem prova ficam em quarentena. O descadastro nativo é retirada global local; link próprio permite preferências por assunto. Notificação positiva jamais restaura consentimento ou apaga reclamação/devolução. Retenção/exclusão/restore de supressões permanecem B12, sem operação real autorizada por testes.


D59: medição própria depende de flag e aviso institucional revisado, com consentimento separado do marketing. Sem aceite não se cria identificador analítico; recusa usa preferência não identificável. Permissão opaca fica em cookie HttpOnly/Secure, hash no banco, expira em 180 dias, sem renovação silenciosa. Revogação e coleta compartilham lock, e novo aceite não reaproveita cookie revogado. Há formulário nativo de retirada sem JavaScript, com origem validada e retorno fixo à privacidade. Sem JS não há medição de páginas; saída de checkout pode ser operacional ou usar permissão previamente concedida até sua retirada.

Não são armazenados IP, user-agent, referer, query completa, email ou identidade de comprador. Só caminhos públicos reais e códigos cadastrados/revisados; UTMs livres/aparentes dados pessoais não são fonte analítica. Sessão de 30 minutos inativa e janela de 30 dias não provam pessoa única ou compra. Retenção/exclusão de permissões, sessões, eventos e contadores em B12 continuam pendentes; não ativar para operação real antes de rever políticas/contato, retenção e release.

## Assinatura Kiwify em query — D64

Token privado não é transmitido, mas signature permite replay do mesmo corpo: excluir query/URL completa de logs do proxy/APM antes de ativar a recepção. Aplicação nunca registra corpo, assinatura ou token. HMAC é validado em tempo constante nos bytes, com leitura limitada; assinatura sozinha não prova frescor, venda única ou liquidação. Dedupe/colisão/namespace da inbox protegem o histórico. Segredos apenas no app; worker não precisa dos tokens. [Contrato](integracoes/kiwify.md).

## Cakto — D65

Exigir HMAC-SHA256 com timestamp e janela de cinco minutos; não aceitar apenas secret no corpo. Segredo é enviado pelo fornecedor no JSON, portanto excluir corpo e headers de autenticação de logs/APM/debug, usando HTTPS. Verificar bytes antes do parse/Payload; nenhuma credencial/PII fica nos recibos, colisões ou respostas. Corpo/lote limitados; validação integral antes do banco e rollback integral evitam ACK parcial. Abandono não usa email para dedupe, não cria contato e não representa métrica de compradores. [Decisão e contrato](integracoes/cakto.md).

## Arquivo CSV da prévia — D66

Não persistir CSV bruto, filename livre, credenciais, compradores ou valores inválidos. Resposta privada sem cache; somente owner/origem exata antes de ler o corpo. UTF-8/limites/cabeçalho exatos, erros sanitizados e consultas com campos mínimos. Não registrar corpo/Authorization em proxy/APM/debug. Classificações e hash não conferem autorização de escrita; confirmação durável é futura. Helper de planilha neutraliza fórmulas em texto, sem oferecer download nesta etapa. [Contrato](24-conciliacao.md).

## Custódia de importação — D67

Fonte/referência/razão controladas e ator do Payload, nunca de body/header arbitrário. Invalidar CSV com linha pessoal/inválida antes de persistir; normalized é whitelist/hash/manifesto revalidado. Hash do plano é concorrência otimista, não credencial. Owner/origem e confirmed=true em JSON limitado; dados, decisão e ator não são escolhidos pelo cliente. API direta das três coleções nega escrita, preservando trilha. Arquivo bruto/nome original e credenciais não são guardados/logados. [Contrato](24-conciliacao.md).
