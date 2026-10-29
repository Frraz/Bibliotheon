# Instruções de trabalho — Bibliotheon

## Contexto e continuidade

Leia [README](README.md), [progresso](docs/14-progresso.md), [estado atual](docs/23-estado-atual.md), [backlog](docs/13-backlog.md) e [pendências para produção](pendencias.md), além do documento do subsistema, antes de alterar o projeto. Responda em português do Brasil. Preserve `reflexoes.md`; é fonte histórica, não especificação superior às decisões posteriores do usuário.

O pedido que originou esta entrega autoriza documentação, não implementação da aplicação nem mudanças na VPS. Em tarefas futuras, cumpra o escopo autorizado pelo usuário. Atualize progresso com o que realmente foi executado, evidências, pendências e próxima ação.

## Invariantes

- Nenhuma IA integrada ao produto; cadastro manual ou importação editorial revisada no Payload.
- Checkout e entrega externos: Hotmart, Kiwify e Cakto. Não remover um provedor do escopo por conveniência.
- Catálogo amplo, divulgação segmentada; começar com um livro prioritário.
- Não inventar avaliações, escassez, resultados financeiros ou vendas.
- Nunca confundir clique, pagamento aprovado, recebimento e lucro.
- Sem credenciais, dados de compradores ou payloads reais em Git, documentação ou logs.
- VPS compartilhada: inventariar antes de implantar; preservar serviços e proxy existentes.
- Sem Kubernetes, Redis, microserviços ou SaaS pago obrigatório na base inicial.

## Desenvolvimento futuro

Faça mudanças pequenas e verificáveis. Mantenha contratos e migrações consistentes com os documentos. Fixe versões compatíveis e lockfile; não use imagens `latest` em produção. Teste permissões por API, não só pela interface. Não confie em redirecionamento do cliente como prova de compra.

Use fixtures sintéticas para integrações. Registre separadamente testes locais, homologação do provedor e operação real. Revalide fontes externas antes de codificar autenticação e eventos. Campos não confirmados não devem ser adivinhados. Não altere arquitetura aceita silenciosamente: registre justificativa em decisões.

## Conclusão de tarefas

Atualize requisitos/backlog/progresso e pendencias.md quando necessário; rode verificações proporcionais ao trabalho. Para documentação, execute `python3 scripts/validar_documentacao.py`. Para código, cumpra a [estratégia de qualidade](docs/15-qualidade.md). Só declare concluído o que tiver evidência.

## Direção de design

Antes de trabalho visual leia [DESIGN-BRIEF](DESIGN-BRIEF.md) e documentos vinculados. Claro/escuro, família editorial flexível e motion expressivo são decisões aprovadas. Preservar também `ideais para melhora o desing.md` como fonte histórica. Aplicar as [skills de referência](docs/design/08-skills-referencias.md) sem instalação global automática. Não introduzir IA no produto.

Cores canônicas em `docs/design/cores.json`; alterações exigem recalcular `python3 scripts/validar_contrastes.py --write` após revisar os pares. Validação padrão é não mutante. Não declarar design validado no navegador sem telas e evidência; documentação não substitui screenshots. Antes da implementação visual, executar B17; B20 cobre a homologação visual das telas de fase 1 e 2.
