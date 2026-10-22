# 12 — Segurança e privacidade

[Índice](../README.md) · [Interfaces](06-interfaces.md)

Este documento define controles de engenharia e escolhas conservadoras do produto. Não substitui a definição das obrigações concretas do responsável pelo negócio. Políticas públicas precisam de nome do responsável, contato e fornecedores reais antes de publicação.

Estado técnico em 21/10/2026: acesso privado, validação de uploads, tokens, consentimento e supressão possuem testes locais; não é aceite integral de segurança. Retenção, exportação/exclusão, reaplicação pós-restore, proteção administrativa do host e integrações reais ainda pendentes. O e-mail público continuará vazio até produção, por decisão do proprietário. Há risco conhecido de integridade na troca recusada/rollback de mídia não vinculada a amostra; proteger PDF vinculado não cobre esse caso. Ver [estado atual](23-estado-atual.md).

## Acesso e superfície

Administrador único `owner`, sem criação pública de conta. Sessão HttpOnly, Secure em produção e política SameSite apropriada; expiração e recuperação testadas. Rate limit no login e recuperação com mensagens genéricas. Priorizar MFA via mecanismo compatível comprovado; não presumir que esteja incluído no CMS. Enquanto não houver MFA homologado, restringir administração por VPN ou allowlist operacional documentada, mantendo rotas públicas acessíveis.

Permissões deny-by-default em coleções e campos. Público só lê projeções publicadas; ninguém fora de serviços internos escreve transações/inbox. Testar REST, GraphQL se habilitado e Local API. Desabilitar GraphQL se não utilizado. Acesso a jobs via APIs internas autorizadas, nunca endpoint público genérico.

## URLs, conteúdo e uploads

Checkout HTTPS com host exato aprovado por operador; validar hostname real, não substring. Domínio de checkout/afiliado deve ser confirmado por provedor/conta. Não buscar URL arbitrária no servidor. Links editoriais externos abrem com proteção adequada; rich text sanitizado, sem scripts ou HTML executável livre.

Uploads: imagens JPEG/PNG/WebP até 5 MiB; PDF gratuito até 20 MiB, magic bytes e extensão verificados, nome aleatório, sem SVG/HTML executável. Reencodar imagens e remover metadados; PDF servido como download com MIME e nosniff. Rejeitar travessia de diretório e arquivos fora de finalidade. Livros pagos completos e kits internos não entram no bucket/volume público.

CSP e headers ajustados/testados ao Next/Payload, não copiados cegamente; nunca enfraquecer globalmente CSP só para preview. Segredos segregados por ambiente e fornecedor, rotação registrada. HMAC/token verifica autenticidade conforme contrato real; IP allowlist isolada não prova origem.

## Consentimento e minimização

Captura pede só e-mail e material; marketing com checkbox separado desmarcado, finalidade e link de privacidade. Guardar versão do texto e ação. Analytics opcional com aceitar/rejeitar equivalentes e revogação acessível. Sem consentimento analítico, não criar ID persistente nem cookie de atribuição; compra permanece funcional.

Compra externa não autoriza newsletter. Não armazenar CPF, telefone, endereço ou e-mail de comprador vindo do webhook quando não necessários. Informar plataformas de checkout e provedor de e-mail no aviso. Decisão sobre base legal e transparência deve considerar operação concreta, tomando como referência [orientação da ANPD sobre cookies](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais).

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
