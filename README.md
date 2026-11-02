# Bibliotheon

Biblioteca on-line de e-books em **[bibliotheon.com.br](https://bibliotheon.com.br)**. Cada e-book tem uma landing page de alta conversão que leva o leitor ao checkout da plataforma que ele preferir (Kiwify, Cakto, Hotmart...). O objetivo é um só: **vender e-books**.

Os e-books são criados no projeto irmão [`../ebooks`](../ebooks) e publicados aqui com um comando, ou pelo painel (owner e parceiros).

> **Estado:** Etapas 0 e 1 concluídas (documentação e protótipo visual, direção **A · Livraria**). Telas navegáveis em `/prototipo/home`, `/landing`, `/painel` e `/painel/editor` (dados de demonstração). **Próxima: Etapa 2, site público no ar.** Ver [roteiro](docs/07-roteiro.md).

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

Requer Node 22+.

```bash
npm install
npm run dev      # http://localhost:3000 (hoje redireciona para /prototipo/home)
npm run lint
npm run build    # build de produção; conferir sem erros antes de qualquer deploy
npm start        # serve o build
```

Banco, seed, Vitest e testes E2E entram na Etapa 2 (ver [roteiro](docs/07-roteiro.md)).

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
