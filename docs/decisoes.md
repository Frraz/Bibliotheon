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
| 2026-11-02 | E-book 001: plataforma principal Kiwify/Cakto (não Hotmart) até revisão | Impedimento sobre texto gerado por IA registrado em `../ebooks` | Sim |

## Em aberto (decidir na etapa indicada)

| Etapa | Questão |
|---|---|
| 2 | Porta loopback e diretório (reaproveitar os do v1) |
| 3 | Edição de parceiro em e-book já publicado: manter a versão publicada no ar até aprovar, ou parceiro só edita rascunhos |
| 3 | Mudança de slug de e-book publicado: redirect 301 automático? |
| 2 | Destino do backup fora do VPS |
