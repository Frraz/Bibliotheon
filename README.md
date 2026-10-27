# Bibliotheon

Catálogo e páginas de venda de e-books, com painel manual Payload. Checkout e entrega externos por **Hotmart, Kiwify e Cakto**; nenhuma IA integrada ao produto.

**Estado em 26/10/2026 (D114):** D114 reconstrói fatos temáticos legados somente com evento nativo coincidente, sem renovar prazo nem inventar consentimento. A exportação recusa lacunas sem cobertura verificável e preserva finalidades posteriores. Schema mantém 34 migrations; P07 e gates finais continuam abertos. Flags desligadas e produção não alterada. GitHub e deploy ficam com o proprietário. Veja [estado atual](docs/23-estado-atual.md) e [pendências](pendencias.md).

Comece pelo [estado atual](docs/23-estado-atual.md), consulte [pendencias.md](pendencias.md) para prioridades e retome por [progresso](docs/14-progresso.md). Histórico e testes anteriores estão no [registro técnico](docs/19-desenvolvimento.md).

## Desenvolvimento local

Linux, Python 3, Docker Compose e Node na faixa `>=22.23.0 <23`. [.nvmrc](.nvmrc) fixa 22.23.3 para o CI e uso com nvm; pnpm 10.34.7 está fixado em [package.json](package.json). Com nvm instalado, execute `nvm use` antes da instalação.

```bash
python3 scripts/setup-local.py
corepack pnpm install --frozen-lockfile
./start.sh
```

O setup cria somente configuração local e preserva um arquivo existente. O start inicia o PostgreSQL local, aplica migrations e aguarda `/health/ready` do Next em **http://127.0.0.1:3000**. Não instala dependências, cria administrador ou habilita envios. O primeiro owner é provisionado por entrada privada conforme [execução local](docs/20-execucao-local.md).

```bash
./stop.sh            # encerra a instância gerenciada e para o banco, sem remover volumes
./stop.sh --keep-db  # encerra a instância gerenciada e mantém o banco ativo
```

Os scripts funcionam a partir de outro diretório, identificam o processo por PID/início/sessão/checkout e recusam adotar um servidor já existente. Uma prévia gerenciada ou outro serviço na porta 3000 é preservado. Registros antigos em `.local-run/next.pid` exigem conferência manual da instância antiga antes da migração para o novo controle; não apague um registro ativo para forçar início.

## Comandos principais

| Comando | Uso |
|---|---|
| `npm run dev` | Next em primeiro plano; exige banco/configuração preparados |
| `npm run check` | Sintaxe Bash, tipos, lint, unitários, testes de operação e documentação; sem banco/Docker |
| `npm run check:integration` | Suítes de domínio sequenciais; banco sintético exclusivo já migrado |
| `npm run build` | Build da aplicação; CLIs via `node scripts/build-runtime.mjs`; não equivale a deploy |
| `npm run check:http` | Inicia build na porta 3000, confirma saúde, testa HTTP sequencialmente e encerra seu grupo de processos |
| `npm start` | Runtime standalone já construído; não faz pull, backup ou migrations |
| `./atualizar.sh --help` | Opções do atualizador de produção |
| `python3 scripts/validar_documentacao.py` | Links, rastreabilidade, contrastes e fontes históricas |

`check:integration` e `check:http` exigem confirmação explícita `BIBLIOTHEON_SYNTHETIC_TESTS=true`, ambiente descartável e configuração de teste. **Não executar em produção.** O roteiro completo está em [execução local](docs/20-execucao-local.md). QA pode usar `.next-qa`/outra porta em rodadas específicas; o harness HTTP do CI reserva 3000 e recusa porta ocupada.

O [workflow de qualidade](.github/workflows/quality.yml) separa checks sem banco de migrations/integrações/build/HTTP sobre PostgreSQL descartável, com fixtures sequenciais. Execuções supersedidas são canceladas. O workflow foi preparado e conferido localmente; execução no GitHub permanece pendente. QA visual, container/restore e contas de fornecedores têm gates próprios.

## Produção na VPS

Siga [deploy.md](deploy.md) para inventário da VPS compartilhada, configuração privada, backup externo e primeiro deploy. Depois dessa preparação:

```bash
./atualizar.sh --inicial  # primeira implantação
./atualizar.sh           # próximas versões: pull/build/backup/migrations/saúde
```

Existe apenas **atualizar.sh**; o alias com grafia incorreta foi removido. `start.sh` e `stop.sh` controlam desenvolvimento local. Homologue a versão e as contas antes de ativar flags reais; o script não conclui as [pendências de produção](pendencias.md).

## Organização do repositório

| Caminho | Conteúdo |
|---|---|
| `README.md`, `pendencias.md`, `deploy.md` | Entrada, plano restante e implantação |
| `start.sh`, `stop.sh`, `atualizar.sh` | Comandos públicos; implementação em `scripts/` e `ops/` |
| `src/`, `public/`, `migrations/`, `patches/` | Aplicação, arquivos públicos, schema e patches versionados |
| `scripts/`, `ops/`, `tests/` | Ferramentas, operação de produção e testes |
| `docs/`, `artifacts/` | Especificação/histórico e evidências revisadas; evidências não são descartadas pelo ignore |
| `.github/` | Workflow de qualidade, sem deploy automático |
| `Dockerfile`, `compose.*.yaml` | Imagem e ambientes local/produção separados |
| `.env.example`, `.env.production.example` | Exemplos sem credenciais reais |
| `.nvmrc`, `.editorconfig`, `.gitattributes` | Node fixado, edição e finais de linha LF |
| `.local*`, `.next*`, `.release/`, `uploads/` | Estado local, logs, builds e mídia; ignorados por Git/fora da imagem conforme contexto |

Configurações exigidas pelas ferramentas continuam na raiz. Preserve [reflexoes.md](reflexoes.md) e [ideais para melhora o desing.md](<ideais para melhora o desing.md>) como fontes históricas. Não versionar `.env.local`, credenciais, dados de compradores ou logs brutos. Adicionar um ignore não remove automaticamente arquivos já versionados.

## Documentação

| Documento | Finalidade |
|---|---|
| [Pendências para produção](pendencias.md) | Desenvolvimento restante, homologação, responsáveis e ordem de execução |
| [01 — Visão e estratégia](docs/01-visao-estrategia.md) | Decisões comerciais, melhorias da ideia, orçamento |
| [02 — Requisitos](docs/02-requisitos.md) | Jornadas e requisitos rastreáveis |
| [03 — Experiência](docs/03-experiencia.md) | Site, LPs, painel e design |
| [04 — Arquitetura](docs/04-arquitetura.md) | Stack, limites e decisões técnicas |
| [05 — Dados](docs/05-dados.md) | Entidades, relacionamentos e estados |
| [06 — Interfaces](docs/06-interfaces.md) | Contratos HTTP e permissões |
| [07 — Integrações](docs/07-integracoes.md) | Pipeline comercial e conciliação |
| [Hotmart](docs/integracoes/hotmart.md) · [Kiwify](docs/integracoes/kiwify.md) · [Cakto](docs/integracoes/cakto.md) | Contrato e homologação por provedor |
| [Brevo](docs/integracoes/brevo.md) | Calendário, contrato de campanhas e supressão; homologação pendente |
| [08 — Aquisição](docs/08-aquisicao.md) | Conteúdo, e-mail, SEO e parcerias |
| [09 — Métricas](docs/09-metricas.md) | Definições, atribuição e decisões |
| [10 — Infraestrutura](docs/10-infraestrutura.md) | Docker e VPS compartilhada |
| [11 — Operação](docs/11-operacao.md) | Deploy, recuperação e incidentes |
| [12 — Segurança e privacidade](docs/12-seguranca-privacidade.md) | Acesso, dados, retenção e proteção |
| [13 — Backlog](docs/13-backlog.md) | Fases e tarefas implementáveis |
| [14 — Progresso](docs/14-progresso.md) | Estado real, bloqueios e próxima ação |
| [15 — Qualidade](docs/15-qualidade.md) | Cenários de teste e homologação |
| [16 — Referências](docs/16-referencias.md) | Fontes oficiais e limitações |
| [17 — Decisões](docs/17-decisoes.md) | Registro de arquitetura e escopo |
| [18 — Validação documental](docs/18-validacao.md) | Evidências desta entrega |
| [19 — Desenvolvimento](docs/19-desenvolvimento.md) | Implementação e evidências locais |
| [20 — Execução local](docs/20-execucao-local.md) | Instalação, administrador e verificações |
| [21 — Pacote de produção](docs/21-pacote-producao.md) | Imagem, Compose e recuperação; deploy com o proprietário |
| [22 — Primeiro lançamento](docs/22-lancamento.md) | Dados fornecidos pelo proprietário e pendências comerciais |
| [23 — Estado atual](docs/23-estado-atual.md) | Inventário da implementação, R01–R34, testes, migrações, comandos, riscos e retomada |
| [Modelos operacionais](docs/templates/README.md) | Briefings, LP, campanha e revisão |

| [24 — Conciliação](docs/24-conciliacao.md) | CSV, lotes duráveis, confirmação e limites |

## Produto e design

Primeiro título: “Crie Sistemas com IA e Ganhe Dinheiro”. Domínio: bibliotheon.com.br; responsável: Warley Ferraz Almeida. E-mail público fica vazio até você adicioná-lo antes da produção. Público, material e ofertas reais ainda exigem conferência no [lançamento](docs/22-lancamento.md).

Design editorial, claro/escuro, três variantes de LP e movimento definidos no [DESIGN-BRIEF](DESIGN-BRIEF.md). Rodadas visuais existentes são recortes locais; a matriz integral permanece em aberto. Cadastro manual, catálogo amplo e divulgação segmentada; clique, aprovação, recebimento e lucro são medidas distintas. Nunca inventar vendas, avaliações, escassez ou resultados financeiros.

[Instruções de trabalho](AGENTS.md) · [Qualidade](docs/15-qualidade.md) · [Backlog](docs/13-backlog.md)

## D110 — Retenção de identidade e recuperação — 26/10/2026

Retenção de identidades encerradas validada em 12 grupos PostgreSQL sintéticos e restore físico local com manifesto v3. [Testes](artifacts/privacy-retention/d110-results.json), [restore](artifacts/recovery/d110-results.json) e [revisão documental](artifacts/documentation/documentation-review-d110.json). Próximo: ampliar P07 para finalidades remanescentes/compartilhadas e concluir os gates do release em pendencias.md.

## D111 — Operações em lote e diagnóstico PostgreSQL — 26/10/2026

A atualização D111 trata o aviso pg/Drizzle e lint em H06; o produto completo continua em desenvolvimento. Retenção e restauração mantêm os contratos D110. [Suíte de lote](artifacts/database-bulk/d111-results.json) e [checks](artifacts/database-bulk/d111-checks.json).

## D112 — Descadastro e retenção por assunto — 26/10/2026

O descadastro por assunto é preservado mesmo após retirar a assinatura local; uma confirmação antiga não recria marketing, enquanto amostras e novo opt-in explícito continuam independentes. [Testes](artifacts/privacy-retention/d112-results.json), [recuperação](artifacts/recovery/d112-results.json) e [checks](artifacts/privacy-retention/d112-checks.json).

## D113 — Margem e acompanhamento do prazo — 26/10/2026

A execução diária ganha margem antes dos 30 dias; vínculos pendentes continuam preservados e passam a aparecer no relatório de prazo/saúde. [Teste de prazo](artifacts/privacy-retention/d113-results.json), [CLIs de saúde](artifacts/worker-health/d113-results.json), [checks](artifacts/privacy-retention/d113-checks.json). Operação contínua e monitoramento externo ainda exigem homologação.

## D114 — Legado temático verificável — 26/10/2026

O legado verificável participa da retenção e do manifesto v4; histórico ausente/conflitante exige revisão. [Oito grupos PostgreSQL](artifacts/privacy-retention/d114-results.json), [restore físico](artifacts/recovery/d114-results.json) e [checks](artifacts/privacy-retention/d114-checks.json). A homologação da imagem, contas e ambiente final continua pendente.
