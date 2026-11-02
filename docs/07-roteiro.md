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

**Estado (02/11/2026):** código, imagem Docker e scripts prontos e **testados localmente** com os dados reais do 001. Falta o deploy no VPS (ver "Pendências para ir ao ar").

1. ✅ Banco (SQLite + Drizzle) + migrações aplicadas ao iniciar.
2. ✅ `scripts/seed.ts` importa o título a partir do `../ebooks` (manifest v1 sem alteração + `seeds/001-sistemas-com-ia/extras.json`).
3. ✅ Landing, Home e Tema lendo do banco; `/ir` com UTMs; beacon de visitas.
4. ✅ SEO (metadata, JSON-LD, sitemap, robots, OG); Termos, Privacidade e consentimento Pixel/GA4.
5. ✅ Dockerfile + compose + nginx + scripts de atualizar, backup e aquecer.
6. ✅ Deploy no VPS, v1 removido ([06](06-deploy.md)). 001 à venda por R$ 64,99 (Hotmart).

**Critérios de aceite:**

- [x] `https://bibliotheon.com.br/criar-sistemas-com-ia` no ar (200, preço, `/ir` com UTM, sitemap, OG). _(falta a sua aprovação no celular)_
- [x] Acessibilidade 100, Boas práticas 100, SEO 100 na landing; Performance mediana 94–97 (ver [05](05-design.md#medições-das-páginas-reais-etapa-2-02112026-build-standalone-banco-real)). Home: Performance 81–89, abaixo da meta.
- [x] Clique em oferta com `?utm_source=teste` chega ao checkout com o parâmetro (E2E), inclusive quando o clique ocorre antes do JavaScript carregar (recuperação por `Referer`).
- [x] Teste automatizado: com `ofertaAte` no passado o preço muda e a faixa some (E2E com relógio simulado).
- [~] Rich Results Test sem erros; OG aparece no WhatsApp. _(JSON-LD e imagem OG gerados e verificados localmente; a validação no Google e no WhatsApp exige o site público)_
- [x] Outros sistemas do VPS intactos (`docker ps` conferido; v1 descartado a pedido, sem backup).

**Testes:** 29 unitários (preço, UTM, manifesto, mídia, JSON-LD) e 12 E2E (`npm test`, `npm run test:e2e`), mais a imagem Docker construída, executada e com backup restaurado.

### Pendências para ir ao ar

| # | O que | Estado |
|---|---|---|
| 1 | Acesso ao VPS | ✅ Autorizado (usuário `deploy`, sem `sudo`). Descoberta feita: v1 em `127.0.0.1:8020`, nginx e certificado já existem ([06](06-deploy.md)) |
| 2 | E-mail de contato | ✅ `ferzion.dev@gmail.com` (provisório) |
| 3 | Preço e checkout | ✅ R$ 64,99 · Hotmart `pay.hotmart.com/X108114152R` |
| 4 | Headline e endereço | ✅ Aprovados |
| 5 | "O que você recebe" | ✅ 4 itens do kit (PDF + EPUB, caderno, ZIP, guias de SO). **Conferir na Hotmart que o produto entrega os 4** |
| 6 | Meta Pixel / GA4 | Fora do lançamento |
| 7 | Revisar Termos e Privacidade | Pendente (ponto de partida, não é parecer jurídico) |
| 8 | Deploy | ✅ No ar em 02/11/2026 (commit `f8a7044` + correção do backup). **Falta o `git push` do titular** (esta máquina não tem credencial do GitHub; o servidor recebeu os commits por `git bundle`) |

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
| 02/11/2026 | Página/botão "Seja afiliado" com o link de recrutamento da Hotmart (`affiliate.hotmart.com/affiliate-recruiting/view/1092C108114173`) | Titular, ao passar os links | Backlog: só depois da primeira venda |
