# Bibliotheon

Biblioteca on-line de e-books em **[bibliotheon.com.br](https://bibliotheon.com.br)**. Cada e-book tem uma landing page de alta conversão que leva o leitor ao checkout da plataforma que ele preferir (Kiwify, Cakto, Hotmart...). O objetivo é um só: **vender e-books**.

Os e-books são criados no projeto irmão [`../ebooks`](../ebooks) e publicados aqui com um comando, ou pelo painel (owner e parceiros).

> **Estado (02/11/2026):** site no ar, 001 à venda por R$ 64,99 na Hotmart. **Etapa atual: "Vender"**: meta de R$ 1.500/mês de faturamento. O painel (login, e-books, temas e usuários, Etapa 3, Fases 1 e 2) está pronto localmente e aguarda deploy. Ver [estratégia](docs/04-vendas-e-medicao.md#0-a-conta-e-a-estratégia) e [roteiro](docs/07-roteiro.md).

## Documentação

| Doc | Para quê |
|---|---|
| [01 — Produto](docs/01-produto.md) | Visão, princípios, decisões e escopo do MVP |
| [02 — Experiência](docs/02-experiencia.md) | Páginas, landing seção a seção, painel tela a tela |
| [03 — Técnico](docs/03-tecnico.md) | Stack, dados, rotas, API, manifesto, CLI, segurança |
| [04 — Vendas e medição](docs/04-vendas-e-medicao.md) | **Estratégia e padrão de venda**, SEO, UTM, pixels, campanha, rotina semanal |
| [05 — Design](docs/05-design.md) | Direção visual, regras anti-amador, movimento, metas |
| [06 — Deploy](docs/06-deploy.md) | VPS, substituição do v1, backup, rollback |
| [07 — Roteiro](docs/07-roteiro.md) | Etapas com portões, critérios de aceite, backlog |
| [Decisões](docs/decisoes.md) | Registro de decisões e questões em aberto |
| [Origem](docs/origem/) | Áudios transcritos e notas originais do projeto |

## Rodar localmente

Requer Node 22+.

```bash
npm install
# Importa o e-book 001 para o banco local (data/). --demo = preço e checkouts FICTÍCIOS, só para ver a página completa.
npm run seed -- ../ebooks/ebooks/001-sistemas-com-ia --extras seeds/001-sistemas-com-ia/extras.json --publicar --demo
npm run dev            # http://localhost:3000
```

Sem `--demo`, o 001 entra como **"Em breve"** (é o que vai ao ar, enquanto não há preço nem checkout reais).

| Comando | O que faz |
|---|---|
| `npm test` | 41 testes unitários (preço, campanha, UTM, manifesto, mídia, leads, JSON-LD) |
| `npm run test:e2e` | 20 testes E2E: builda, sobe o pacote standalone com banco temporário e exercita os fluxos de venda |
| `npm run lint` · `npm run build` | Conferências antes de qualquer deploy |
| `npm run db:generate` | Gera migração após mudar `src/db/schema.ts` |
| `deploy/venda.sh` | Em produção: preço, campanha, textos, amostra, relatório e leads, sem perder métricas |

Deploy e backup: [06 — Deploy](docs/06-deploy.md).

## Publicar um e-book a partir do `../ebooks`

_A partir da Etapa 4._

```bash
cd ../ebooks
./bibliotheon login                                   # uma vez: cola o token gerado em Painel → Conta
./bibliotheon publicar ebooks/001-sistemas-com-ia     # mostra mudanças, pede confirmação, sobe como rascunho
./bibliotheon publicar ebooks/001-sistemas-com-ia --publicar
```

## Skills de design

Já instaladas **no projeto**, em `.claude/skills/` (versionadas): `impeccable`, `taste-skill`, `frontend-design`, `emil-*` (animação) e `gsap-*`. A `ui-ux-pro-max` está instalada no Claude Code do usuário. Podem exigir reiniciar a sessão do Claude Code para aparecerem na lista de skills. Quando usar cada uma: [05-design](docs/05-design.md#processo-com-as-skills).

Origem (para atualizar): `pbakaus/impeccable`, `leonxlnx/taste-skill`, `emilkowalski/skills`, `greensock/gsap-skills`, `anthropics/skills` (frontend-design).
