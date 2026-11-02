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
5. **Honestidade comercial.** Sem timer falso, preço "de" inventado, depoimento inventado ou promessa de renda/cura (ver `docs/04-vendas-e-medicao.md#6-guia-de-copy-da-landing`).
6. **Painel simples.** No máximo 4 itens de menu, uma ação principal por tela, linguagem do usuário (`docs/02-experiencia.md`).
7. **Registrar decisões** novas ou alteradas em `docs/decisoes.md` (uma linha). Ideias que surgirem vão para "Ideias recebidas" em `docs/07-roteiro.md`.
8. **Docs curtos.** Atualizar o doc certo quando o comportamento mudar; não criar documento novo sem necessidade.

## Código

- TypeScript estrito; Zod para tudo o que entra (formulário, API, manifesto).
- Server Components por padrão; `"use client"` só onde há interação.
- Regra de acesso (dono/owner) sempre conferida no servidor.
- Dinheiro em centavos; datas em UTC; textos da interface em português do Brasil.
- Nomes de domínio em português (`ebook`, `oferta`, `tema`), como no modelo de dados.
- Testes para: preço vigente/urgência, `/ir` e UTMs, permissões de parceiro, API/manifesto. Não escrever testes de enfeite.
- Commits pequenos, mensagem em português no imperativo.

## Definição de pronto (qualquer tarefa)

- Funciona no celular (375 px) e no desktop.
- `npm run build`, `npm run lint` e `npm test` passam.
- Mudança visual: Lighthouse da landing ≥ 95 e auditoria impeccable feita.
- Doc correspondente atualizado.

## Fora daqui

- **Projeto `../ebooks`:** só alterar o que a Etapa 4 indica (launcher `bibliotheon`, `docs/19-integracao-bibliotheon.md` e o trecho do `AGENTS.md` sobre publicação).
- **VPS:** outros sistemas convivem no mesmo servidor. Nunca publicar 80/443 nem mexer em containers, portas ou `.conf` de outros projetos. Fazer backup antes de substituir o v1 (`docs/06-deploy.md`).
- **Publicação externa, anúncios, gastos e mensagens a terceiros:** só com pedido explícito do usuário.
