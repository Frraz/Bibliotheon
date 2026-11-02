# Decisões

Registro curto. Uma linha por decisão; reversível = pode mudar sem retrabalho grande.

| Data | Decisão | Motivo | Reversível? |
|---|---|---|---|
| 2026-11-02 | Recomeçar do zero (v2), com documentação curta e portões visuais por etapa | O v1 demorou, ficou amador e o painel ficou confuso | — |
| 2026-11-02 | Objetivo único: vender e-books. O site é vitrine + landing; pagamento e entrega ficam nas plataformas | Menos risco, menos código, foco em conversão | Não |
| 2026-11-02 | PDF/EPUB pago nunca fica no Bibliotheon; só capa, textos e **amostras em imagem** (+ PDF de amostra opcional) | A amostra converte; o arquivo pago só traz risco | Sim |
| 2026-11-02 | **Urgência real**: timer só com `ofertaAte` real; preço "de" só se for realmente praticado; o preço sobe sozinho no fim do prazo | CDC/Procon, políticas de anúncio da Meta e confiança | Sim |
| 2026-11-02 | Uma plataforma **principal** por e-book + "Prefere outra plataforma?" | Evitar paralisia de escolha | Sim |
| 2026-11-02 | Parceiros no MVP: contas criadas pelo owner; parceiro envia para revisão, owner publica | Proteger a marca com custo baixo | Sim |
| 2026-11-02 | Stack: Next.js + TS + Tailwind v4 + shadcn/ui + Motion/GSAP + SQLite/Drizzle + Better Auth | Velocidade e SEO das páginas estáticas; melhor ecossistema para design de alto nível com as skills escolhidas; painel profissional pronto | Parcial |
| 2026-11-02 | SQLite em vez de Postgres | Um arquivo, zero serviço; volume baixo de escrita | Sim |
| 2026-11-02 | Integração com `../ebooks`: uma CLI Python stdlib + um endpoint; aceita o manifest v1 existente; o manifesto vence nos campos que traz; sem prévia HTML, resolutions ou recibos | A complexidade da ponte foi uma das causas do atraso do v1 | Sim |
| 2026-11-02 | Prévia = a própria landing em rascunho (`?previa=1`) | Ver exatamente o que vai ao ar | Sim |
| 2026-11-02 | Métricas próprias sem cookie (visitas/cliques) + Pixel/GA4 só após consentimento | LGPD sem perder a noção de conversão | Sim |
| 2026-11-02 | Next.js **16.4** com **Cache Components** (cache por `'use cache'` + tags, não por `revalidate`) | É o padrão do `create-next-app` atual; casa com "página pré-renderizada + dado que muda ao publicar" | Sim |
| 2026-11-02 | Skills de design instaladas **no projeto** (`.claude/skills/`), não globalmente | Versionadas, reversíveis e sem afetar os outros projetos. Do impeccable usamos os princípios (modo *Persuade*) e a auditoria; **não** o fluxo completo de sorteio/geração de imagens, por ser pesado demais para este projeto | Sim |
| 2026-11-02 | Meta de JS trocada para "< 30 KB próprios" (era < 120 KB totais) | Medido: a base do Next 16 + React 19 já é 143 KB gzip em qualquer página. LCP real: 0,7–0,85 s com 4G lento + CPU 4× | Sim |
| 2026-11-02 | Node 22 no desenvolvimento, `node:24` na imagem Docker | O PC local tem Node 22 | Sim |
| 2026-11-02 | Faixa de urgência com altura reservada (2 linhas no celular) e contador que renderiza espaço invisível antes de hidratar | Evitava CLS de 0,05–0,13 (contador e troca de fonte) | Não |
| 2026-11-02 | **Direção visual A · Livraria** escolhida (B e C removidas) | Mais fiel à capa, mais elegante, parece livraria de verdade | Sim, com custo (é a identidade) |
| 2026-11-02 | Fundo **creme** mantido apesar do alerta `cream-palette` do impeccable | O creme é o da capa real do livro (#F7F1E6); a marca estende a capa. É decisão, não reflexo | Sim |
| 2026-11-02 | `--salvia` escurecido de `#55685F` para `#4B5E55` | Contraste 4,2:1 → 4,8:1 no selo "Publicado" (WCAG AA) | Sim |
| 2026-11-02 | shadcn/ui no estilo `base-nova` (Base UI), com `cn` do próprio shadcn | É o que o CLI atual instala; o doc dizia Radix | Sim |
| 2026-11-02 | Cantos quase retos (`--radius: .25rem`), sem modo escuro | Coerência com a capa e a landing; modo escuro não está no escopo | Sim |
| 2026-11-02 | Botão e campo padrão com 44 px de altura | Alvo de toque no celular (tráfego pago é móvel) | Sim |
| 2026-11-02 | Banco: SQLite + Drizzle, UUID v4 (não cuid2), migrações aplicadas ao iniciar o servidor (`instrumentation.ts`) | Zero serviço extra; menos uma dependência | Sim |
| 2026-11-02 | Imagens pelo otimizador do `next/image` sobre `/m/...` (não pipeline próprio com sharp) | Menos código; mesmo resultado (WebP, tamanhos sob demanda) | Sim |
| 2026-11-02 | `ensureStatic = 'navigation'` em landing e tema; Home lê no pedido (`connection()` + `<Suspense>`) | Landing inteira estática para SEO; Home dinâmica porque o banco do build é vazio e não quero que o 1º visitante veja uma Home vazia | Sim |
| 2026-11-02 | Slug sentinela `_` em `generateStaticParams` | O Next exige ≥ 1 parâmetro e o build do Docker não tem banco | Sim |
| 2026-11-02 | Cabeçalhos de segurança sem CSP com nonce | Nonce exige renderização dinâmica e derrubaria as páginas estáticas; o site não renderiza conteúdo de usuário sem escape | Sim |
| 2026-11-02 | `SITE_URL` e IDs de pixel fixados no build | Garante canonical/sitemap iguais no estático e no dinâmico | Sim |
| 2026-11-02 | `/ir` recupera UTM pelo `Referer` (só do próprio site, via `SITE_URL`) quando o clique chega antes do JavaScript | Evita perder a atribuição da venda em celular lento | Sim |
| 2026-11-02 | Métricas só aceitam origens da convenção de UTM; o resto vira `outro`; robôs e pré-visualizadores não contam | Impede encher a tabela e inflar números | Sim |
| 2026-11-02 | Navegação de temas removida do cabeçalho | `ensureStatic` vale para o layout e a lista dependia do banco; os temas aparecem na Home | Sim |
| 2026-11-02 | `npm ci --ignore-scripts` na imagem Docker | `better-sqlite3` já traz o binário; sem compilador na imagem `slim` o `node-gyp` falhava | Sim |
| 2026-11-02 | `content-visibility: auto` nas seções abaixo da dobra | Atraso de renderização da capa 1.150 ms → ~140 ms | Sim |
| 2026-11-02 | Meta de Performance: **mediana** ≥ 93 (não "≥ 95 sempre"); CLS < 0,1 | O Lighthouse mobile oscila ±10 e a base do Next pesa 143 KB | Sim |
| 2026-11-02 | E-book 001 sai à venda por **R$ 64,99**, só na **Hotmart** (`pay.hotmart.com/X108114152R`), sem preço "de" nem timer | Preço e link informados pelo titular; sem prazo real não há urgência. Kiwify/Cakto entram como ofertas extras quando existirem | Sim |
| 2026-11-02 | Risco aceito pelo titular: Hotmart tem impedimento sobre texto gerado por IA (`../ebooks`); o produto pode ser barrado | Manter Kiwify/Cakto prontos para virar oferta principal em um minuto | Sim |
| 2026-11-02 | Sem script/widget da Hotmart no site; o botão vai por `/ir` ao link de checkout | JS de terceiros piora o desempenho e quebraria o rastreio de UTM | Sim |
| 2026-11-02 | Headline "Crie seu primeiro sistema com IA, mesmo sem saber programar" e endereço `/criar-sistemas-com-ia` aprovados | Decisão do titular | Sim |
| 2026-11-02 | Sem e-mail de contato no lançamento; a Privacidade remete ao suporte da plataforma de compra | Titular preferiu deixar para depois; o site não coleta nome nem e-mail. Rever antes de anunciar | Sim |
| 2026-11-02 | Sem Meta Pixel/GA4 no lançamento | Sem anúncios ainda; os contadores próprios já medem visitas e cliques por origem | Sim |
| 2026-11-02 | "O que você recebe" é o que o checkout entrega; padrão de novos títulos: livro PDF + EPUB + 1 complemento leve (ficha/caderno) | O 001 já tem PDF, EPUB, caderno e ZIP. Ver `../ebooks/templates/14-pacote-de-entrega.md` | Sim |
| 2026-11-02 | Alterações em `../ebooks` por pedido explícito do titular (só documentação: doc 19, templates 06 e 14, AGENTS.md); o manifesto aceita `samples` como lista de nomes (formato do gerador v2) | O gerador de `../ebooks` já emitia o v2; só `samples` divergia do schema daqui. Launcher e `publicar.py` seguem na Etapa 4 | Sim |
| 2026-11-02 | Só `bibliotheon.com.br` (sem `www`, não há DNS); porta 8020 e nginx do v1 reaproveitados | Descoberto no VPS | Sim |
| 2026-11-02 | v1 descartado **sem dump** a pedido do titular: containers parados (não removidos), volumes mantidos por 2 semanas | O código já foi apagado; reversível enquanto os volumes existirem | Parcial |

## Em aberto (decidir na etapa indicada)

| Etapa | Questão |
|---|---|
| 3 | Edição de parceiro em e-book já publicado: manter a versão publicada no ar até aprovar, ou parceiro só edita rascunhos |
| 3 | Mudança de slug de e-book publicado: redirect 301 automático? |
| 2 | Destino do backup fora do VPS |
