# Bibliotheon

Site de divulgação de e-books com catálogo, páginas de venda e painel manual, conectado a Hotmart, Kiwify e Cakto. Objetivo: cadastrar uma oferta, alcançar seu público e acompanhar compras confirmadas.

**Estado em 21/10/2026:** vitrine e painel editorial implementados/testados localmente. Relacionamento possui amostras, consentimento, supressão, recuperação por operador, calendário e quota; agrupamento/envio promocional e sincronização Brevo ainda pendentes. Eventos comerciais, três conectores, conciliação/financeiro e retenção ainda não implementados. **Projeto completo ainda não pronto para produção.** Imagem e recuperação exigem revalidação do código atual; GitHub e deploy ficam com o proprietário. Comece pelo [estado atual com requisitos/evidências/lacunas](docs/23-estado-atual.md) e pela [próxima ação](docs/14-progresso.md).

Primeiro título: “Crie Sistemas com IA e Ganhe Dinheiro”; domínio informado: bibliotheon.com.br; responsável: Warley Ferraz Almeida. E-mail público ficará vazio até o proprietário adicioná-lo antes da produção. Nenhuma oferta real ou venda comprovada. Veja [lançamento](docs/22-lancamento.md).

## Design especificado

A identidade **conhecimento em edição** está definida no [DESIGN-BRIEF](DESIGN-BRIEF.md): editorial contemporânea, claro/escuro, três variantes de LP e movimento expressivo. Catálogo e páginas editoriais possuem rodadas locais renderizadas. Formulários administrativos e telas de relacionamento seguem em homologação local. Consulte os [wireframes](docs/design/04-paginas.md), [componentes](docs/design/03-componentes.md) e [contrastes calculados](docs/design/09-contrastes.md).

## Comece por aqui

1. Leia a [visão e estratégia](docs/01-visao-estrategia.md).
2. Consulte [requisitos e aceite](docs/02-requisitos.md) e [arquitetura](docs/04-arquitetura.md).
3. Retome pela [próxima ação](docs/14-progresso.md), conferindo o [estado dos requisitos](docs/23-estado-atual.md) e o [backlog](docs/13-backlog.md). B01/B17 já possuem implementação local; não reiniciar etapas concluídas sem motivo.
4. Antes de operar na VPS, siga [infraestrutura](docs/10-infraestrutura.md) e [operação](docs/11-operacao.md).

## Documentação

| Documento | Finalidade |
|---|---|
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

## Regras estabelecidas

- pt-BR, BRL, marca Bibliotheon; manutenção individual por painel visual.
- TypeScript, Next.js, Payload CMS, PostgreSQL, Tailwind CSS e Docker Compose.
- Sem IA no produto, checkout próprio, área de membros ou leitura de livros pagos no site.
- Até cerca de R$ 50/mês adicionais no início; aquisição principalmente orgânica.
- Uma campanha prioritária por vez; catálogo permite muitos nichos.
- Contratos internos descrevem o produto completo; os endpoints implementados e os limites de validação estão no documento de desenvolvimento.

## Verificação desta documentação

Executar `python3 scripts/validar_documentacao.py` na raiz. O verificador valida caminhos locais, cobertura dos requisitos, cores, contrastes e preservação das duas conversas originais. Não executa a aplicação nem testa serviços externos.

[Instruções para agentes](AGENTS.md) · [Conversa original preservada](reflexoes.md)
