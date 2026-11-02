# 07 — Roteiro

Cada etapa termina num **portão**: você vê o resultado e aprova antes de seguir. Se não gostar, o ajuste acontece ali, onde é barato. Nenhuma etapa começa com a anterior pendente.

## Etapa 0 — Documentação ✅ (este conjunto)

**Portão:** você leu `01` a `07` e ajustou o que discordar.

## Etapa 1 — Protótipo visual ✅ (aguardando aprovação final)

**Estado (02/11/2026):** concluída. Direção **A · Livraria** escolhida; Home, Landing, Painel e Editor prototipados com o conteúdo real do e-book 001, em `/prototipo/*`; tokens definidos em `globals.css`; shadcn/ui instalado; auditoria impeccable feita; lint e build limpos; LCP 0,8–0,9 s e CLS ≤ 0,026. Detalhes e medições em [05-design](05-design.md#direção-escolhida).

1. ✅ Instalar as skills de design ([README](../README.md#skills-de-design)).
2. ✅ Criar o projeto Next.js + Tailwind v4 + shadcn/ui (sem banco).
3. ✅ Gerar **3 direções visuais** da landing com o conteúdo real do e-book 001.
4. ✅ Escolha: **A · Livraria**.
5. ✅ Aplicar na Home e no Editor do painel (dados fixos, sem salvar).
6. ✅ Auditoria impeccable + medições.

**Portão:** "Eu gosto disso e quero que o site fique assim", visto no celular e no desktop.

## Etapa 2 — Site público 🟡 pronto para o ar; falta a implantação no VPS

**Estado (02/11/2026):** todo o código, a imagem Docker e os scripts estão prontos e **testados localmente**. Falta a parte que só você pode autorizar e informar: mexer no VPS (substituir o v1) e fornecer dados reais (ver "Pendências para ir ao ar").

1. ✅ Banco (SQLite + Drizzle) + migrações aplicadas ao iniciar.
2. ✅ `scripts/seed.ts` importa o título a partir do `../ebooks` (manifest v1 sem alteração + `seeds/001-sistemas-com-ia/extras.json`).
3. ✅ Landing, Home e Tema lendo do banco; `/ir` com UTMs; beacon de visitas.
4. ✅ SEO (metadata, JSON-LD, sitemap, robots, OG); Termos, Privacidade e consentimento Pixel/GA4.
5. ✅ Dockerfile + compose + nginx + scripts de atualizar, backup e aquecer.
6. ⏳ Deploy substituindo o v1 ([06](06-deploy.md)).

**Critérios de aceite:**

- [ ] `https://bibliotheon.com.br/<slug-do-001>` no ar, igual ao protótipo aprovado. _(falta o deploy)_
- [x] Acessibilidade 100, Boas práticas 100, SEO 100 na landing; Performance mediana 94–97 (ver [05](05-design.md#medições-das-páginas-reais-etapa-2-02112026-build-standalone-banco-real)). Home: Performance 81–89, abaixo da meta.
- [x] Clique em oferta com `?utm_source=teste` chega ao checkout com o parâmetro (E2E), inclusive quando o clique ocorre antes do JavaScript carregar (recuperação por `Referer`).
- [x] Teste automatizado: com `ofertaAte` no passado o preço muda e a faixa some (E2E com relógio simulado).
- [~] Rich Results Test sem erros; OG aparece no WhatsApp. _(JSON-LD e imagem OG gerados e verificados localmente; a validação no Google e no WhatsApp exige o site público)_
- [ ] Backup do v1 conferido; outros sistemas do VPS intactos. _(falta acessar o VPS)_

**Testes:** 29 unitários (preço, UTM, manifesto, mídia, JSON-LD) e 12 E2E (`npm test`, `npm run test:e2e`), mais a imagem Docker construída, executada e com backup restaurado.

### Pendências para ir ao ar (precisam de você)

| # | O que | Por que bloqueia |
|---|---|---|
| 1 | **Autorizar o acesso ao VPS** para descobrir e substituir o v1 (começa só com leitura) | É produção; o plano exige backup antes |
| 2 | **E-mail de contato** (`NEXT_PUBLIC_CONTATO_EMAIL`) | Termos e Privacidade (LGPD) saem sem canal de contato |
| 3 | **Preço aprovado e link de checkout** do 001 (Kiwify/Cakto) | Sem isso a página fica "Em breve" (sem botão de compra) |
| 4 | **Aprovar a headline** "Crie seu primeiro sistema com IA, mesmo sem saber programar" e o endereço `/criar-sistemas-com-ia` | São sugestões minhas; a headline do `extras.json` e o slug mudam a página inteira |
| 5 | **Confirmar "O que você recebe"** (PDF + EPUB + caderno + ZIP) | O kit diz que a entrega muda por canal (pacote nos checkouts, só EPUB nas lojas) |
| 6 | **Meta Pixel / GA4** (opcional) | Sem IDs, nada de terceiros carrega |
| 7 | Revisar os textos de **Termos e Privacidade** | São um ponto de partida; não substituem parecer jurídico |

**Portão:** site real no ar, você navega no seu celular e aprova.

## Etapa 3 — Painel (1–2 sessões)

1. Better Auth + papéis; script `criar-owner`.
2. Lista de e-books com métricas; editor numa página ([02](02-experiencia.md#editor-do-e-book-painelebooksid)) com upload/recorte de capa e amostras.
3. Ofertas, checklist de publicação, prévia `?previa=1`, revisão de parceiro.
4. Temas, Parceiros e Conta (token de API).

**Critérios de aceite:**

- [ ] Você cria um e-book do zero pelo painel no celular e no desktop, sem ajuda, em < 10 min.
- [ ] Teste: parceiro não lê nem edita e-book de outro (Server Action e URL direta).
- [ ] Teste: parceiro não consegue publicar.
- [ ] Checklist bloqueia a publicação incompleta com a mensagem certa.

**Portão:** você usa o painel e diz "isso é simples".

## Etapa 4 — Ponte com `../ebooks` (meia sessão)

1. API `POST/GET /api/v1/ebooks` + tokens.
2. `ferramentas/publicar.py` (stdlib).
3. No `../ebooks`: atualizar o launcher `bibliotheon` e reescrever curto `docs/19-integracao-bibliotheon.md` + o trecho do `AGENTS.md` que fala da publicação, apontando para [03](03-tecnico.md#contrato-do-manifesto). Remover as menções a preparar/assistir/resolutions.
4. `docs/exemplos/manifest.example.json`.

**Critérios de aceite:**

- [ ] `./bibliotheon publicar ebooks/001-sistemas-com-ia` mostra as mudanças, pede confirmação e atualiza o rascunho.
- [ ] Teste: manifesto com `pending` não vazio é recusado com a lista.
- [ ] Teste: `offers: []` não apaga ofertas cadastradas no painel.
- [ ] Rodar duas vezes seguidas: na segunda, "nenhuma mudança".

**Portão:** você publica um e-book novo só pelo terminal.

## Depois do MVP — iteração em produção

Regra: **uma melhoria = uma mudança pequena que vai ao ar no mesmo dia.** Ideias novas entram no backlog abaixo, com a data e o motivo. Prioriza-se pelo impacto em vendas, não pela vontade de construir.

## Backlog

Ordem atual (reavaliar a cada 2 semanas com os dados da [rotina semanal](04-vendas-e-medicao.md#8-rotina-semanal-15-minutos)):

1. **Artigos por tema (blog SEO)**: tráfego orgânico cumulativo.
2. **Captura de lead**: "Receba o capítulo 1 grátis" (e-mail) + lista exportável; base para remarketing barato.
3. **Webhooks de venda** (Kiwify/Hotmart/Cakto): vendas e receita por e-book e origem no painel.
4. **A/B de headline** por e-book.
5. **Recuperação de senha por e-mail** (SMTP).
6. **Pacotes/combos** (vários e-books de um tema com desconto, se as plataformas suportarem).
7. **Depoimentos reais** com autorização.
8. **Busca** no catálogo (quando houver mais de ~20 e-books).
9. **Multi-idioma** (quando houver um título traduzido).

### Ideias recebidas

| Data | Ideia | Motivo / origem | Decisão |
|---|---|---|---|
| | | | |
