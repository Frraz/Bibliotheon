# Bibliotheon

Biblioteca on-line de e-books em **[bibliotheon.com.br](https://bibliotheon.com.br)**. Cada e-book tem uma landing page de alta conversão que leva o leitor ao checkout da plataforma que ele preferir (Kiwify, Cakto, Hotmart...). O objetivo é um só: **vender e-books**.

Os e-books são criados no projeto irmão [`../ebooks`](../ebooks) e publicados aqui com um comando, ou pelo painel (owner e parceiros).

> **Estado:** Etapa 0 concluída (documentação). Próxima: Etapa 1, protótipo visual. Ver [roteiro](docs/07-roteiro.md).

## Documentação

| Doc | Para quê |
|---|---|
| [01 — Produto](docs/01-produto.md) | Visão, princípios, decisões e escopo do MVP |
| [02 — Experiência](docs/02-experiencia.md) | Páginas, landing seção a seção, painel tela a tela |
| [03 — Técnico](docs/03-tecnico.md) | Stack, dados, rotas, API, manifesto, CLI, segurança |
| [04 — Vendas e medição](docs/04-vendas-e-medicao.md) | SEO, UTM, pixels, copy, lançamento, rotina semanal |
| [05 — Design](docs/05-design.md) | Direção visual, regras anti-amador, movimento, metas |
| [06 — Deploy](docs/06-deploy.md) | VPS, substituição do v1, backup, rollback |
| [07 — Roteiro](docs/07-roteiro.md) | Etapas com portões, critérios de aceite, backlog |
| [Decisões](docs/decisoes.md) | Registro de decisões e questões em aberto |
| [Origem](docs/origem/) | Áudios transcritos e notas originais do projeto |

## Rodar localmente

_A partir da Etapa 1._

```bash
npm install
npm run db:migrate          # cria data/bibliotheon.db
npm run seed -- ../ebooks/ebooks/001-sistemas-com-ia   # importa o e-book 001
npm run dev                 # http://localhost:3000
npm test                    # Vitest
npm run test:e2e            # Playwright
```

## Publicar um e-book a partir do `../ebooks`

_A partir da Etapa 4._

```bash
cd ../ebooks
./bibliotheon login                                   # uma vez: cola o token gerado em Painel → Conta
./bibliotheon publicar ebooks/001-sistemas-com-ia     # mostra mudanças, pede confirmação, sobe como rascunho
./bibliotheon publicar ebooks/001-sistemas-com-ia --publicar
```

## Skills de design

Instalar no Claude Code **antes da Etapa 1**. A `ui-ux-pro-max` já está instalada.

```
/plugin marketplace add pbakaus/impeccable
/plugin marketplace add emilkowalski/skills
/plugin marketplace add leonxlnx/taste-skill
/plugin marketplace add greensock/gsap-skills
/plugin marketplace add anthropics/claude-code      # contém o plugin frontend-design
/plugin                                             # instalar os plugins de cada marketplace
```

Se algum repositório não for um marketplace de plugins, clonar a pasta da skill em `~/.claude/skills/`. Conferir com `/plugin` e com a lista de skills disponíveis. Quando usar cada uma: [05-design](docs/05-design.md#processo-com-as-skills).
