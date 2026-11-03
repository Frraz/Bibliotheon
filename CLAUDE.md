# Bibliotheon — instruções para agentes

Objetivo único: **vender e-books.** Antes de qualquer trabalho, ler `README.md`, a etapa atual em `docs/07-roteiro.md` e `docs/decisoes.md`. Ler os outros docs conforme a tarefa.

## Regras de trabalho

1. **Respeitar a etapa atual** do roteiro. Não adiantar etapas nem construir item do backlog sem pedido explícito.
2. **Não complicar.** Antes de adicionar dependência, tabela, rota, configuração ou opção de painel, perguntar: "isso ajuda a vender agora?". Se não ajuda, vai para o backlog. A lista do que é proibido no MVP está em `docs/03-tecnico.md`.
3. **Ver antes de construir.** Mudança visual relevante começa como protótipo e só é implementada de verdade depois da aprovação do usuário.
4. **Visual impecável.** Seguir `docs/05-design.md`: regras anti-amador, tokens e metas de desempenho. Usar as skills na hora certa:
   - direção: frontend-design, taste;
   - sistema e UX: ui-ux-pro-max;
   - movimento: emilkowalski, gsap;
   - auditoria: impeccable, **antes de todo deploy com mudança visual**.
5. **Honestidade comercial.** Sem timer falso, preço "de" inventado, depoimento inventado ou promessa de renda/cura (ver `docs/04-vendas-e-medicao.md#6-padrão-de-venda`).
6. **Painel simples.** No máximo 4 itens de menu, uma ação principal por tela, linguagem do usuário (`docs/02-experiencia.md`).
7. **Registrar decisões** novas ou alteradas em `docs/decisoes.md` (uma linha). Ideias que surgirem vão para "Ideias recebidas" em `docs/07-roteiro.md`.
8. **Padrão de venda em toda landing, de todo e-book** (`docs/04-vendas-e-medicao.md#6-padrão-de-venda`). O objetivo é um só: vender. Toda página mostra necessidade, resultado, por que este caminho e redução de risco, e toda campanha tem prazo real, com data e preço depois do prazo, valendo na página e no checkout. Sem seção de autor por padrão. Nenhuma tática que exija mentir (regra 5).
9. **Docs curtos.** Atualizar o doc certo quando o comportamento mudar; não criar documento novo sem necessidade.

## Código

- **Next.js 16 tem convenções novas** (Cache Components, `LayoutProps`, etc.). Antes de escrever código de rotas, cache ou metadados, ler o guia correspondente em `node_modules/next/dist/docs/01-app/`. Não confiar na memória.

- TypeScript estrito; Zod para tudo o que entra (formulário, API, manifesto).
- Server Components por padrão; `"use client"` só onde há interação.
- Regra de acesso (dono/owner) sempre conferida no servidor.
- Dinheiro em centavos; datas em UTC; textos da interface em português do Brasil.
- Nomes de domínio em português (`ebook`, `oferta`, `tema`), como no modelo de dados.
- Testes para: preço vigente/urgência, `/ir` e UTMs, permissões de parceiro, API/manifesto. Não escrever testes de enfeite.
- Commits pequenos, mensagem em português no imperativo.

## Lições que custaram caro (não repetir)

- **Testar o que vai ao ar, não o modo de desenvolvimento:** `next build` + pacote `standalone` (ou a imagem Docker). Foi assim que apareceram: página estática com banco vazio, `/api/saude` pré-renderizada (healthcheck que nunca falha), `SITE_URL` diferente entre build e execução, `origin` interno atrás do nginx, `better-sqlite3` sem binário no Docker e `data/` vazando para o pacote.
- **Ler o mapa de rotas do `next build`:** `○` estático, `ƒ` dinâmico. Rota que usa banco e saiu `○` é bug.
- **`ensureStatic` vale para o layout também:** nada de `connection()`, `cookies()` ou consulta sem cache em layout de rota estática.
- **Parar servidor:** `ss -ltnp | grep :PORTA` e `kill <pid>`. **Nunca** `pkill -f`/`pgrep -f` com texto que também aparece no próprio comando (derruba o shell, exit 144) e cuidado para não casar com processos do VS Code.
- **Medir Lighthouse várias vezes** (mediana): oscila ±10 pontos. Servidor frio ≠ aquecido (`deploy/aquecer.sh`).
- **Texto de venda:** ao reaproveitar copy de protótipo, conferir cada frase contra o livro/kit. Já removi afirmações que eu mesmo tinha inventado.
- **Build local:** `npm run build` usa o `data/` da máquina, que pode ter esquema antigo (`no such column`). Use `DATABASE_PATH=:memory: npm run build`, como o `scripts/servir-teste.sh`. Depois de criar uma rota nova, rode `npx next typegen` antes do `tsc` (os tipos `PageProps<"/rota">` vêm daí).
- **Rota nova na raiz:** acrescentar o nome a `SLUGS_RESERVADOS` (`src/lib/editor.ts`), senão um e-book com esse endereço fica encoberto.
- **CSS velho no build local:** depois de mudar só o `globals.css`, o `next build` pode reaproveitar o CSS compilado antes (mesmo arquivo, mesmo hash, regra nova ausente). Antes de conferir o visual, `rm -rf .next`. O build do Docker parte do zero e não sofre disso.
- **Imagem pesada no OG:** nunca embutir o arquivo original no `ImageResponse` (satori recusa ~10 MB e dá 502); reduzir com `sharp`.
- **npm:** `vitest` exige `@types/node` 22+ e, com o npm 10.9, `--legacy-peer-deps` + `vite` instalado à parte (bug do arborist).

## Como ver o resultado (obrigatório em mudança visual)

Subir o build de produção (`npm run build && npm start -- -p 3100`) e capturar com Playwright (já instalado, usa o Chromium em `~/.cache/ms-playwright`): celular 360×740, 390×844 e desktop 1280×800, primeira tela e **rolando a página** (captura de página inteira não renderiza as seções abaixo da dobra). Conferir também: sem rolagem horizontal, sem erro de console, LCP e CLS. Para parar o servidor use `kill $(pgrep -f '[n]ext-server')` (um `pkill -f "next dev"` direto derruba o próprio shell).

## Definição de pronto (qualquer tarefa)

- Funciona no celular em **360, 390 e 430 px** (sem rolagem horizontal; ver "Regras de celular" em `docs/05-design.md`) e no desktop.
- `npm run build`, `npm run lint` e `npm test` passam.
- Mudança visual: Lighthouse da landing ≥ 95 e auditoria impeccable feita.
- Doc correspondente atualizado.

## Fora daqui

- **Projeto `../ebooks`:** só alterar o que a Etapa 4 indica (launcher `bibliotheon`, `docs/19-integracao-bibliotheon.md` e o trecho do `AGENTS.md` sobre publicação) ou o que o titular pedir. Não é repositório git: guardar cópia antes de editar.
- **VPS:** outros sistemas convivem no mesmo servidor. Nunca publicar 80/443 nem mexer em containers, portas ou `.conf` de outros projetos.  Antes de mexer no servidor, backup (`docs/06-deploy.md`).
- **Publicação externa, anúncios, gastos e mensagens a terceiros:** só com pedido explícito do usuário.
