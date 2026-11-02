# 07 — Roteiro

Cada etapa termina num **portão**: você vê o resultado e aprova antes de seguir. Se não gostar, o ajuste acontece ali, onde é barato. Nenhuma etapa começa com a anterior pendente.

## Etapa 0 — Documentação ✅ (este conjunto)

**Portão:** você leu `01` a `07` e ajustou o que discordar.

## Etapa 1 — Protótipo visual (1 sessão) 🟡 em andamento

**Estado (02/11/2026):** passos 1 a 3 concluídos. Skills instaladas em `.claude/skills/`; projeto Next 16 criado; as 3 direções estão em `/prototipo/a` (Livraria), `/b` (Oficina) e `/c` (Direta), com conteúdo real do e-book 001, lint e build limpos, LCP 0,7–0,85 s e CLS < 0,05. **Falta você escolher a direção (passo 4).** Depois: passos 5 e 6.

1. ✅ Instalar as skills de design ([README](../README.md#skills-de-design)).
2. ✅ Criar o projeto Next.js + Tailwind v4 (shadcn/ui entra junto com o Editor do painel, passo 5; sem banco).
3. ✅ Com o **conteúdo real do e-book 001** (manifest + kit comercial do `../ebooks`), gerar **3 direções visuais** da landing em rotas `/prototipo/a`, `/b`, `/c`.
4. Você escolhe a direção.
5. Aplicar na Home e no Editor do painel (dados fixos, sem salvar).
6. Auditoria impeccable + Lighthouse.
7. Preencher "Direção escolhida" e os tokens em [05-design](05-design.md).

**Portão:** "Eu gosto disso e quero que o site fique assim", visto no celular e no desktop.

## Etapa 2 — Site público no ar (1–2 sessões)

1. Banco (schema completo de [03](03-tecnico.md#modelo-de-dados)) + migrations.
2. `scripts/seed.ts` importa o `manifest.json` do 001 a partir da pasta local.
3. Landing, Home e Tema dinâmicos; `/ir` com UTMs; beacon de visitas.
4. SEO (metadata, JSON-LD, sitemap, robots, OG); Termos, Privacidade e banner de consentimento com Pixel/GA4.
5. Dockerfile + compose + nginx; deploy substituindo o v1 ([06](06-deploy.md)).

**Critérios de aceite:**

- [ ] `https://bibliotheon.com.br/<slug-do-001>` no ar, igual ao protótipo aprovado.
- [ ] Lighthouse mobile ≥ 95 nas quatro categorias da landing.
- [ ] Clique em oferta com `?utm_source=teste` chega ao checkout com o parâmetro.
- [ ] Teste automatizado: com `ofertaAte` no passado o preço muda e a faixa some.
- [ ] Rich Results Test sem erros; OG aparece no WhatsApp.
- [ ] Backup do v1 conferido; outros sistemas do VPS intactos (`docker ps`, `ss -tlnp`).

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
