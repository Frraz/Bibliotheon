# 17 — Registro de decisões

[Índice](../README.md)

As decisões iniciais e visuais são de 20/10/2026; a seção de implementação registra a evolução autorizada de 20–21/10/2026. Alterações futuras devem registrar motivo, impacto, migração e evidência; não apagar a decisão anterior. Estado vigente no [mapa de implementação](23-estado-atual.md); o limite documental D16 foi sucedido por D23.

| ID | Decisão | Justificativa / consequência |
|---|---|---|
| D01 | Marca Bibliotheon, pt-BR/BRL | Mercado inicial definido; internacionalização posterior |
| D02 | Next + Payload + PostgreSQL + Tailwind + TypeScript | Painel manual integrado e site no mesmo projeto |
| D03 | Docker Compose em VPS compartilhada | Isolamento por projeto; preservar proxy e sistemas existentes |
| D04 | Nenhuma IA no produto | Solicitação explícita; conteúdo cadastrado manualmente |
| D05 | Hotmart, Kiwify e Cakto | Links na fase 1; três conectores na fase 2, nenhum descartado |
| D06 | Checkout e entrega externos | Evitar duplicar operação de pagamento e acesso ao livro |
| D07 | Uma oferta principal, alternativas secundárias | Clareza de escolha; campanhas afiliadas fixam destino |
| D08 | Aquisição orgânica, sem aparecer | Conteúdo, amostras e distribuição manual; orçamento inicial baixo |
| D09 | Brevo gratuito como transporte; jobs no Payload | Evitar automação paga obrigatória; revalidar quotas |
| D10 | Primeiro livro prioritário, catálogo extensível | Aprender antes de dispersar divulgação |
| D11 | Sem rastreamento por identidade do comprador | Atribuição por referência comprovada ou desconhecida |
| D12 | Contatos com confirmação e marketing separado | Qualidade da lista e escolha explícita do interessado |
| D13 | Inbox durável, idempotência e conciliação | Integridade dos números mesmo com falhas/reenvios |
| D14 | Stack estável compatível, versões fixadas no bootstrap | Modernidade não elimina compatibilidade e patches |
| D15 | Cerca de R$ 50 adicionais/mês | Priorizar backup; anúncios não são dependência |
| D16 | Documentação agora, implementação depois | Escopo desta entrega não altera VPS nem cria aplicação |

## Alternativas adiadas

Astro/arquivos foi considerado, mas o painel e o domínio comercial favorecem Payload. CMS separado, microsserviços, Kubernetes, Redis, busca externa, CRM completo e analytics pago adicionariam custo operacional prematuro. Ferramentas gratuitas e experimentos A/B dependem de problema e tráfego, não de uma data arbitrária.

## Hipóteses que não são decisões comprovadas

Canal com melhor conversão, preço ideal, nicho vencedor, disponibilidade de 5–10h semanais e volume de vendas ainda não foram validados. A faixa de preço R$ 51–100 veio da conversa original e serve apenas como referência; cada oferta terá seu preço real. Domínio e primeiro título foram informados posteriormente em D34; capacidade livre da VPS permanece pendente.

## Evolução visual aprovada — 20/10/2026

| ID | Decisão | Justificativa / consequência |
|---|---|---|
| D17 | Conceito conhecimento em edição, identidade tipográfica e família editorial flexível | Briefing passa a ser fonte central visual; contratos comerciais mantidos |
| D18 | Source Serif 4 + Public Sans locais | Substitui recomendação inicial de fonte de sistema como identidade; sistema permanece fallback |
| D19 | Claro e escuro completos no site e painel | Substitui direção inicial somente clara; preferência sistema por padrão |
| D20 | Motion editorial expressivo com reduced-motion | Feedback funcional no painel; conteúdo/CTA imediatos |
| D21 | Três variantes de LP e três acentos em enums | Flexibilidade editorial sem CSS arbitrário nem checkout diferente |
| D22 | Skills como referências documentais | Sem instalação global, frontend, protótipo ou marca final nesta etapa |

Direção visual especificada não implica aparência validada nem melhoria de conversão comprovada. O [briefing](../DESIGN-BRIEF.md) detalha decisões e fontes.

## Implementação autorizada — 20/10/2026

| ID | Decisão | Justificativa / consequência |
|---|---|---|
| D23 | Desenvolver e validar a aplicação localmente | Pedido atual sucede o limite documental de D16. GitHub e deploy na VPS ficam com o proprietário; sem alterações remotas |
| D24 | Payload 3.91.0 / Next 16.4.2, pacotes exatos e pnpm 10.34.7 | Matriz do pacote oficial mais restritiva que página geral; migrações explícitas, PostgreSQL 17 e testes antes de declarar compatibilidade |
| D25 | CSP com nonce por requisição nas páginas; SSR dinâmico | Next injeta nonce em scripts internos e bootstrap usa o mesmo nonce. Cache será restrito às consultas/projeções públicas; sem cache compartilhado de HTML administrativo |
| D26 | Preferência visual local e cookie funcional nativo Payload | Site espelha escolha explícita em payload-theme para o RootLayout do painel conhecer o tema antes do paint. Sem ID, analytics ou cookie do comprador. Provider Payload continua autoridade no painel |

## Continuidade da implementação — 21/10/2026

| ID | Decisão | Justificativa / consequência |
|---|---|---|
| D27 | Hosts de checkout aprovados separadamente por plataforma | CHECKOUT_ALLOWED_HOSTS_HOTMART/KIWIFY/CAKTO substituem lista genérica; evita aceitar destino de outra plataforma em campanhas afiliadas. Valores vazios desabilitam URLs até revisão do operador |
| D28 | Sitemap dinâmico, sem snapshot do catálogo no build | Teste detectou sitemap vazio persistido no build; consultar projeções publicadas em cada requisição |
| D29 | Executar build standalone também na validação local | Mesmo artefato de runtime previsto para container, com arquivos estáticos copiados e MEDIA_DIR explícito para compartilhar uploads com CLI. Sem deploy |
| D30 | Dashboard operacional pelo ponto views.dashboard do Payload | Contagens editoriais reais e próximos passos substituem organização de widgets desnecessária e seus controles sem rótulo detectados pelo axe. Navegação, autenticação e formulários nativos preservados; CSS usa BEM suportado para áreas de toque e indicador decorativo |
| D31 | Patches locais de acessibilidade em Payload 3.91.0 (ui, next e richtext-lexical) | Axe identificou seleção sem rótulo e falhas nos formulários nativos. Patches pnpm corrigem nomes, semântica e foco; CSS amplia áreas de toque. Mantêm seleção, editor, ordenação e permissões. Nenhuma manipulação do DOM ou regra axe desativada. Revalidar/remover quando houver correção upstream |
| D32 | Atualizações de segurança: Sharp 0.35.5, Sass 1.106.0, DOMPurify 3.4.16 e esbuild 0.28.2 | Auditoria de produção encontrou sete alertas, quatro altos. Overrides exatos removem transitivos afetados; novo lockfile exige revalidar build, uploads, migrations e imagem. Nenhum advisory foi ignorado |
| D33 | Token de confirmação gerado no worker, só hash no banco | Outbox guarda IDs, nunca corpo/email/link em jobs. O worker grava o hash e estado sending antes do transporte. Crash/timeout incerto exige conciliação, sem reenvio cego. Download usa assinatura de finalidade própria/24h; descadastro usa token independente de 32 bytes/180 dias, apenas hash, permitindo links simultâneos válidos |
| D34 | Primeiro lançamento e domínio informados em 21/10/2026 | “Crie Sistemas com IA e Ganhe Dinheiro”, bibliotheon.com.br e Warley Ferraz Almeida registrados. E-mail público ficará vazio até o proprietário preenchê-lo antes da produção; público específico, preço e elegibilidade não são presumidos. Nenhuma mudança na decisão de produto sem IA |
| D35 | Isolamento opcional do build de QA com NEXT_DIST_DIR e TEST_BASE_URL | A prévia gerenciada usa porta 3000/.next e pode reaparecer após encerramento do servidor manual. QA de produção usa .next-qa/porta separada para preservar a prévia e impedir sobrescrita de caches. Docker/CI conservam a pasta padrão em ambiente isolado; testes HTTP aceitam apenas loopback |
| D36 | Apresentação administrativa pt-BR e runtime America/Belem | Rótulos, nomes de opções e arrays são traduzidos sem mudar chaves ou valores persistidos. Datas mostram dd/MM/yyyy HH:mm, com runtime/container em America/Belem e armazenamento ISO UTC preservado. Sent significa aceitação pelo transporte, não prova de chegada à caixa postal. Coleções operacionais são somente leitura no painel e continuam negando mutação por API |
| D37 | Body administrativo sem falso scroll vertical | A ordenação por teclado calculava o destino correto, mas overflow-x:hidden tornava overflow-y:auto no body, que não era o scrollingElement real. O sensor tentava rolar esse elemento sem efeito. overflow-x:clip e overflow-y:visible preservam o corte horizontal existente e deixam a rolagem no documento; não substituem o sensor nem removem a ordenação |
| D38 | Supressão revisada por owner, sem importar consentimento | View e API próprias usam sessão/origem exata; CLI lê stdin privado. ConsentEvent registra motivo, fonte e HMAC da referência; mesma referência conflitante é recusada. Lock de contato compartilhado com captura evita corrida na criação. Complaint não é rebaixado por bounce/descadastro; entregas já iniciadas não são declaradas canceladas. Conferência no Brevo permanece manual até sincronização homologada |
| D39 | Recuperação inicial do owner pelo operador do host | CLI por stdin privado troca senha da conta única, revoga sessões/tokens e limpa bloqueio/cooldown. Sem criar conta ou enviar e-mail. Forgot/reset públicos retornam indisponibilidade genérica, sem gerar tokens, e unlock público é negado. Recuperação por e-mail exige homologação própria antes de habilitar; não reutilizar confirmação de amostra |
| D40 | Snapshot manual e calendário único por material/versão | Novas confirmações com assinatura efetiva criam quatro etapas duráveis; cópia anterior permanece imutável, revisão de conteúdo aumenta explicitamente. Desativação/descadastro cancelam sem reinscrição automática. Preparação local não significa disparo, reserva de quota ou aceite do Brevo |
| D41 | Material vinculado a uma amostra preserva seus bytes | Substituir mídia ou livro exige nova versão; versão já usada não pode ser reaproveitada. Upload em mídia vinculada é recusado: enviar outro arquivo e associá-lo à versão nova. Locks e conferência da revisão evitam troca concorrente sob a mesma versão. Metadados acessíveis continuam editáveis |
| D42 | Geração de tipos Payload por comando explícito | A prévia gerenciada iniciou repetidamente filhos payload generate:types, consumindo CPU/memória durante o build isolado. typescript.autoGenerate=false preserva a prévia e o arquivo versionado; após mudanças de schema, executar npm run generate:types antes de TypeScript/build. Sem desligar checagem de tipos ou encerrar o servidor gerenciado |
| D43 | Leitura do snapshot sem editor de JSON e header limitado à viewport | QA encontrou conteúdo cortado, contraste do editor e overflow com breadcrumbs longos. Campo server suportado apresenta quatro etapas em disclosures somente leitura, com dados de conferência secundários; schema e ACL permanecem. CSS BEM permite encolher/rolar os breadcrumbs, amplia limpar seleção e mantém alvo mínimo do combobox, sem mudar sensor de arraste ou regras axe |
| D44 | Teclado usa a política de rolagem CSS | Sensor nativo permanece; opção scrollBehavior:auto no patch UI evita smooth forçado mesmo com reduced-motion. Diagnóstico descartável confirmou troca real de ordem com rolagem imediata. QA aguarda dois frames após ativação (listener é instalado na próxima task), mantém transformação/ordem/draft e acrescenta estabilidade da rolagem reduzida. Sem sleep fixo ou override de protótipo no produto |
| D45 | Quota compartilhada com reserva transacional conservadora | Uma contabilidade por dia UTC e destinatário; teto inicial até 250, reserva padrão 50. Promoções futuras respeitam total menos reserva, mesmo após consumo transacional. Lote indivisível e claim na mesma transação da reserva; resultado incerto não devolve capacidade. Não presume créditos/reset da conta Brevo nem implementa disparo promocional |
