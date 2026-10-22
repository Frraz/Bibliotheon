# 18 — Validação da entrega documental

[Índice](../README.md) · [Progresso](14-progresso.md)

Histórico inicial: 20/10/2026, documentos e verificador local, então sem aplicação e sem acesso à VPS. As seções iniciais preservam o resultado daquela entrega. A revisão atual está ao final; implementação e evidências de software estão separadas no [estado atual](23-estado-atual.md).

## Verificação inicial — histórico

Executar `python3 scripts/validar_documentacao.py` na raiz.

Na primeira entrega, o script verificou títulos, fechamento de blocos de código, destinos dos links Markdown locais, cobertura de R01–R26 em backlog/testes, presença de B01–B16 e T01–T21, além do SHA-256 de `reflexoes.md`.

SHA-256 original esperado: `e9be41f92ab65d33cfdc5e8f9447d7fb05cf84ad43cb920d7d4906d15d8a262c`.

Resultado inicial: **aprovado** — 30 documentos, 104 links locais válidos, 18 URLs externas distintas catalogadas, 26 requisitos, 16 tarefas e 21 cenários. Nenhum erro estrutural detectado. As URLs externas não são verificadas pelo script; a pesquisa de fontes está registrada separadamente.

Sintaxe do verificador validada com parser Python. Dois controles negativos em cópias temporárias confirmaram que o script retorna falha para link local inexistente e alteração da fonte original. Os arquivos reais não foram modificados por esses controles.

## Revisão semântica

Revisada a consistência entre consentimento, entrega da amostra e marketing; oferta versus venda confirmada; autenticação por provedor; eventos duplicados/fora de ordem; atribuição desconhecida; preço e valores null; VPS compartilhada; backup externo; limites do orçamento e fontes ainda pendentes.

A revisão separou transporte transacional e campanhas de marketing no Brevo e manteve explícitas as dependências de autenticação dos provedores. Todos os requisitos têm fase, dependência e aceite; todos aparecem no backlog e na matriz de cenários. Os seis modelos operacionais estão ligados ao índice.

## Limites

O verificador não testa endpoints externos, domínio, software futuro, desempenho, acessibilidade renderizada, segurança implementada, integrações reais ou capacidade da VPS. Fontes externas foram consultadas e seus limites registrados em [referências](16-referencias.md); uma URL técnica Kiwify retornou 404 e não foi usada para inventar autenticação.

Não houve deploy, publicação de livro, envio de campanha, compra ou confirmação de vendas. Checklists de homologação permanecem pendentes deliberadamente.

## Evolução documental de design

O verificador atual inclui `DESIGN-BRIEF.md`, todos os documentos de design, R01–R34, B01–B20 e T01–T29. Verifica os dois hashes de conversas originais e executa a verificação não mutante dos contrastes. O relatório de cores deve corresponder exatamente à paleta canônica.

Hash da conversa de design: `a78685e178c4453a71f9abfcc30aac0c32a7f114b4081f41790c1a6f7561e122`.

Resultado da evolução: **40 documentos, 161 links locais válidos, 31 URLs externas distintas catalogadas, 34 requisitos, 20 tarefas e 29 cenários**. Os 76 pares autorizados de contraste passaram; o relatório gerado corresponde à paleta JSON. Sintaxe dos dois verificadores válida.

Controles matemáticos confirmaram preto/branco = 21:1 e #777777/branco abaixo de 4,5:1. Quatro controles negativos em cópias temporárias detectaram link quebrado no briefing, alteração da conversa de design, contraste insuficiente e perda de cobertura de requisito no backlog. Nenhuma conversa real foi alterada.

Revisão semântica: substituídas as direções iniciais de fonte de sistema e tema somente claro; preservados os contratos comerciais; enums visuais integrados a dados/interfaces; dependências B17–B20 incorporadas sem renumerar tarefas antigas. A identidade, as três variantes de LP, todas as famílias de páginas, painel e componentes prioritários estão especificados para ambos os temas. Os testes visuais futuros permanecem não executados.

A avaliação de pares sRGB não certifica acessibilidade, aparência ou conversão. Fontes externas não são verificadas pelo script; fontes e falhas de consulta estão registradas nos documentos de referência. Nenhum browser de aplicação, frontend ou infraestrutura foi iniciado.

## Consolidação do estado implementado — 21/10/2026

Revisão documental posterior à implementação autorizada. Conferidos código/rotas, package.json/lockfile, sete migrations, workflow CI e 16 relatórios existentes. Consultados somente nomes/batches de migrations e contagens locais, sem ler contatos/credenciais ou alterar serviços. O [inventário datado](../artifacts/documentation/state-audit-2026-10-21.json) registra o recorte observado; não substitui nova execução dos testes de software.

Criado documento 23 com mapa dos 34 requisitos, componentes existentes, evidências e lacunas, comandos, migrations e ordem de retomada. README, progresso, backlog, contratos HTTP, dados, arquitetura, segurança/operação e direção visual foram alinhados. Backlog mantém 20 IDs e a qualidade mantém os 29 cenários, sem reduzir aceites ou marcar fases incompletas como concluídas. Corrigidas descrições antigas de aplicação inexistente, domínio/título desconhecidos, cache/CI e quota totalmente pendentes; histórico cronológico preservado no documento 19.

O exemplo privado de produção agora explicita BREVO_TRANSACTIONAL_RESERVE=50, já consumido pelo código/Compose; nenhum segredo real ou flag de ativação foi alterado. E-mail público permanece vazio até produção por decisão do proprietário. Nenhuma nova implementação de lote promocional, deploy, integração externa ou teste da aplicação foi realizada nesta revisão. Resultado do validador documental registrado após a conferência final.

Resultado final: **aprovado — 46 documentos, 285 links locais, 58 URLs externas catalogadas, 34 requisitos, 20 itens de backlog, 29 cenários e 76 pares de contraste**. URLs externas não foram reconsultadas nesta revisão. Checagem complementar confirmou os 34 requisitos mapeados uma vez, os estados dos 20 itens, 9 linhas HTTP implementadas/8 previstas e a presença dos 16 relatórios referenciados. Inventário inclui hashes dos arquivos de implementação/configuração pública/scripts para identificar esta revisão; não inclui ambientes privados nem dados de usuários. Fontes históricas permaneceram byte a byte intactas.
