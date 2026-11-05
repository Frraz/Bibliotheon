# 07 — Roteiro

Cada etapa termina num **portão**: você vê o resultado e aprova antes de seguir. Se não gostar, o ajuste acontece ali, onde é barato. Nenhuma etapa começa com a anterior pendente.

## Etapa 0 — Documentação ✅ (este conjunto)

**Portão:** você leu `01` a `07` e ajustou o que discordar.

## Etapa 1 — Protótipo visual ✅ (aprovada)

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
6. ✅ Deploy no VPS ([06](06-deploy.md)). 001 à venda por R$ 64,99 (Hotmart).

**Critérios de aceite:**

- [x] `https://bibliotheon.com.br/criar-sistemas-com-ia` no ar (200, preço, `/ir` com UTM, sitemap, OG). _(falta a sua aprovação no celular)_
- [x] Acessibilidade 100, Boas práticas 100, SEO 100 na landing; Performance mediana 94–97 (ver [05](05-design.md#medições-das-páginas-reais-etapa-2-02112026-build-standalone-banco-real)). Home: Performance 81–89, abaixo da meta.
- [x] Clique em oferta com `?utm_source=teste` chega ao checkout com o parâmetro (E2E), inclusive quando o clique ocorre antes do JavaScript carregar (recuperação por `Referer`).
- [x] Teste automatizado: com `ofertaAte` no passado o preço muda e a faixa some (E2E com relógio simulado).
- [~] Rich Results Test sem erros; OG aparece no WhatsApp. _(JSON-LD e imagem OG gerados e verificados localmente; a validação no Google e no WhatsApp exige o site público)_
- [x] Outros sistemas do VPS intactos (`docker ps` conferido).

**Testes:** 29 unitários (preço, UTM, manifesto, mídia, JSON-LD) e 12 E2E (`npm test`, `npm run test:e2e`), mais a imagem Docker construída, executada e com backup restaurado.

### Pendências para ir ao ar

| # | O que | Estado |
|---|---|---|
| 1 | Acesso ao VPS | ✅ Autorizado (usuário `deploy`, sem `sudo`). Porta `127.0.0.1:8020`; nginx e certificado do domínio já existem ([06](06-deploy.md)) |
| 2 | E-mail de contato | ✅ `ferzion.dev@gmail.com` (provisório) |
| 3 | Preço e checkout | ✅ R$ 64,99 · Hotmart `pay.hotmart.com/X108114152R` |
| 4 | Headline e endereço | ✅ Aprovados |
| 5 | "O que você recebe" | ✅ 4 itens do kit (PDF + EPUB, caderno, ZIP, guias de SO). **Conferir na Hotmart que o produto entrega os 4** |
| 6 | Meta Pixel / GA4 | Fora do lançamento |
| 7 | Revisar Termos e Privacidade | Pendente (ponto de partida, não é parecer jurídico) |
| 8 | Deploy | ✅ No ar em 02/11/2026 (commit `f8a7044` + correção do backup). nginx com limite de taxa aplicado. Esta máquina não tem credencial do GitHub: o `git push` é feito pelo titular |

**Portão:** site real no ar, você navega no seu celular e aprova.

## Etapa "Vender" 🟡 atual (decisão de 02/11/2026: vem antes das Etapas 3 e 4)

**O que o titular faz na próxima subida (lista única, atualizada a cada etapa): [06 — Checklist da próxima subida](06-deploy.md#checklist-da-próxima-subida).**

**Por quê:** o projeto acaba se não faturar R$ 1.500/mês. O painel não ajuda a vender agora. Estratégia, conta e marcos: [04](04-vendas-e-medicao.md#0-a-conta-e-a-estratégia).

1. ✅ Padrão de venda registrado como regra ([04](04-vendas-e-medicao.md#6-padrão-de-venda), `CLAUDE.md`, `../ebooks`).
2. ✅ Landing nova: necessidade, por que este caminho, CTAs repetidos, consequência do prazo, sem autor. Aprovada pelo titular.
3. ✅ Campanha sincronizada com o checkout (`oferta.urlPromo`, `/ir`), API de operação, relatório e amostra por e-mail, testados no pacote standalone.
4. ✅ Material em `../ebooks/ebooks/001-sistemas-com-ia/oferta/pt-BR/`: kit de parceiros, 10 roteiros de vídeo e e-mail da Black Friday. **Nada foi enviado.**
5. ✅ Aplicar em produção. `API_TOKEN` no servidor, push e deploy (03/11/2026); **2ª edição na página** (201 páginas, conferido no ar em 04/11/2026). ⬜ Só o titular: conferir no painel a capa e as 5 amostras da 2ª edição (`../ebooks/.../publicacao/bibliotheon/capa.png`, `amostra-01..05.png`).
6. ⬜ Conferências na Hotmart: taxa, parcelamento, afiliação ativa, situação do produto, entrega do ZIP e confirmação escrita sobre IA.
7. ⬜ Enviar convites e gravar vídeos (titular; ~5 h/semana assumidas).
8. 🟡 **Promoção de lançamento, R$ 24,99 até 05/11 às 23h59** (decisão do titular, 03/11/2026; no ar). A página e o `/ir` voltam sozinhos ao preço normal depois do prazo; **a oferta precisa acabar também no checkout**, senão a página mostra R$ 64,99 e a loja cobra R$ 24,99. As **três lojas** estão ativas na página (Hotmart, Kiwify e Cakto), então as três.
   - ⬜ Antes de 05/11 23h59: trocar o nome da faixa para "Oferta de lançamento", para não gastar o nome da Black Friday: `deploy/venda.sh aplicar criar-sistemas-com-ia seeds/001-sistemas-com-ia/renomear-promocao.json` (só `offerName`).
   - ⬜ Até 05/11 23h59: encerrar a oferta de R$ 24,99 em Hotmart, Kiwify e Cakto.
   - ⬜ 06/11 de manhã: `deploy/conferir-virada.sh` (preço normal, sem faixa, cada `/ir` no link normal) e abrir um checkout de cada loja para ver o valor.
9. ⬜ **Black Friday, 27 a 30/11** (preço normal de R$ 64,99 de 06/11 a 26/11, com captura datada; atenção: são só 21 dias, e a regra do projeto pede 30 a preço cheio entre promoções — decidir se aceita): em 26/11 criar o link de R$ 47 e testar a compra; em 27/11 aplicar `seeds/001-sistemas-com-ia/black-friday.json` e avisar os leads; em 01/12 conferir a volta e aplicar `fim-da-campanha.json`.
10. 🟡 **Estratégia orgânica (03/11/2026, [04](04-vendas-e-medicao.md#0-a-conta-e-a-estratégia)):** origem do Google no relatório, JSON-LD do autor e avisos de SEO no editor prontos localmente. Falta deploy. O titular faz: ✅ Search Console (configurado em 04/11/2026; falta enviar o sitemap e pedir indexação das 2 landings, se ainda não fez), título e descrição dos 2 livros no painel, Marketplace da Hotmart, teste do link de afiliado, perfis, convites e postagens. Material pronto em `../ebooks`, nada publicado nem enviado: roteiros sem narração e textos do Marketplace dos 2 livros, kit de parceiros do 002 e `operacao/quadro-divulgacao-2026-11.md`.
12. 🟡 **Medir vendas (04/11/2026):** webhooks de compra e reembolso por loja, relatório com vendas por origem e o mês contra a meta; testado (unitário e E2E), sem deploy. Titular, depois do deploy: copiar o segredo de cada loja para o `.env` (não somos nós que geramos: ver [06](06-deploy.md#checklist-da-próxima-subida)) e `./atualizar.sh --forcar`; em cada loja cadastrar `https://bibliotheon.com.br/api/v1/vendas/<hotmart|kiwify|cakto>/criar-sistemas-com-ia` para compra aprovada e reembolso/chargeback; "enviar teste" e conferir em `deploy/venda.sh relatorio`. **A Hotmart é a que mais precisa de conferência** (formato não lido na documentação oficial): colar aqui um exemplo do teste dela, se o relatório não mostrar a venda.
11. ⬜ Janeiro, se houver vendas: order bump com produto real acima de R$ 10 e prova real na landing. Novo título só depois do primeiro sinal de demanda.

**Portão:** os marcos da [estratégia](04-vendas-e-medicao.md#0-a-conta-e-a-estratégia). Em 28/02/2027 o titular decide com dados.

## Etapa 3 — Painel ✅ no ar desde 03/11/2026 (reaberta em 02/11/2026 a pedido do titular)

Quem publica: o titular (administrador) e as pessoas que ele cadastrar. **Usuário ativo publica direto, sem revisão.** O protótipo foi aprovado e removido (histórico do Git).

1. ✅ **Fase 1: login e usuários.** Better Auth, `/entrar`, `/admin` → `/painel`, Usuários (criar, senha temporária, ativar/desativar com "tirar do ar também"), Conta (nome e senha), `scripts/criar-owner.mjs`. 9 testes E2E + 9 unitários novos; imagem Docker testada (criar administrador, login, site de pé sem o segredo).
2. ✅ **Fase 2: cadastro e publicação.** Lista com visitas e cliques de 7 dias, "Novo e-book", editor numa página, capa, amostras e **PDF privado**, lojas e campanha, checklist, prévia por rota, endereço travado, Temas. Pronta localmente: 41 testes E2E (12 novos do editor), 68 unitários; imagem Docker testada (`sharp`, PDF privado fora de `/m`). Falta só: `git push` e deploy, a pedido do titular.
3. ✅ **Fase 3: landing padrão e personalizada** (`src/landings/registro.ts` + `MoldeDaPagina`), **todas as lojas com o mesmo peso**, SEO (Home com metadados e `Organization`/`WebSite`, `lastmod` no sitemap). Pronta localmente: 44 testes E2E (3 novos), 76 unitários; impeccable só aponta o creme (aceito); Lighthouse A/B com o 001 real: mediana 90 (antes 92), A11y/Boas práticas/SEO 100.
4. ✅ **Fase 4: exportação.** "Exportar dados" (`.md` e `.json`) e "Baixar PDF", pasta local `livros/<slug>/` fora do Git. Em `../ebooks`, cada título sai com um guia por plataforma (`publicacao/publicacao-<plataforma>.md`) e só os arquivos usados. Conferido publicando o livro 002 no painel local a partir do guia.

5. ✅ **Fase 5: recuperação de senha por e-mail** (03/11/2026). `/esqueci-a-senha` → link de 1 h e uso único → `/redefinir-senha`, com `nodemailer` e SMTP **opcional** ([03](03-tecnico.md#recuperação-de-senha-por-e-mail)). Pronta localmente e testada (SMTP falso na imagem standalone, 3 testes E2E, 4 unitários). **No ar desde 03/11/2026 (`c02617b`), com `SMTP_*` no `.env` do servidor; envio real testado e funcionando.** Junto foi a correção da imagem de compartilhamento do 002 (502 com capa PNG de 12 MB; capa reduzida a 600 px e PNG pesado vira JPEG no upload).

6. ✅ **Fase 6: senha mínima de 4 caracteres e verificação em duas etapas opcional** (03/11/2026). Em Conta; migração `0004_duas_etapas` (aplicada sozinha ao iniciar); dependência nova `qrcode`. Detalhes em [03](03-tecnico.md#segurança). **No ar desde 03/11/2026; e-mail de recuperação testado pelo titular (funciona).**

Estado dos testes em 03/11/2026: 89 unitários e 70 E2E passando.

Para repetir o deploy do painel (já feito): `git push` → `BETTER_AUTH_SECRET` no `.env` → `./atualizar.sh --forcar` → `docker exec -it bibliotheon_web node scripts/criar-owner.mjs <e-mail>` ([06](06-deploy.md#painel-e-primeiro-acesso)).

**Critérios de aceite:**

- [x] Você cria um e-book pelo painel e publica (os e-books 001 e 002 estão cadastrados e no ar). Em < 10 min e sem ajuda ainda não foi medido.
- [x] Teste: usuário comum só vê o que é dele na lista e não chega a `/painel/usuarios` (Fase 1).
- [x] Teste: usuário desativado perde o acesso na hora, mesmo com a sessão aberta.
- [x] Checklist bloqueia a publicação incompleta com a mensagem certa (rascunho salva e lista o que falta; publicado não é salvo incompleto).
- [x] Teste: usuário comum não vê, não edita, não envia arquivo nem baixa o PDF de e-book de outro (tela, prévia e rotas), e publica o próprio direto.

**Portão:** você usa o painel e diz "isso é simples".

## Etapa 4 — Ponte com `../ebooks` ✅ pronta localmente em 05/11/2026 (falta o deploy)

Reaberta a pedido do titular ("deixar o `../ebooks` completamente compatível"). Contrato em [03](03-tecnico.md#api-de-publicação-pelo-manifesto-etapa-4-feita-em-05112026).

1. ✅ `POST /api/v1/ebooks[?dryRun&publicar&adotar&amostras]` e `GET /api/v1/ebooks/[slug]` (aceita `sourceId`), com o `API_TOKEN` já existente (**sem tokens por usuário**: não foram necessários).
2. ✅ `ferramentas/publicar.py` (`publicar`, `validar`, `consultar`, `login`; stdlib).
3. ✅ No `../ebooks`: launcher `bibliotheon` (repassa `--publicar`, `--sim`, `--adotar`, `--amostras`; `validar` pergunta ao site), gerador do manifesto (SEO, tema, cor, amostra em PDF; recusa data sem hora, loja fora da lista, link sem https, preço inválido), `scripts/painel.py`, docs 19 e 20, `AGENTS.md`, `templates/06-oferta.md`, 7 testes novos. Cópia anterior guardada fora do projeto antes de editar.
4. ✅ `docs/exemplos/manifest.example.json`.
5. **Proteção da produção:** em e-book publicado, o manifesto **não** muda preço, campanha nem "em breve" (o manifesto do 001 traria R$ 64,99 por cima da promoção/Black Friday; os do 002 e 003 trazem "em breve"), e o endereço não muda.

**Critérios de aceite:**

- [x] `./bibliotheon publicar` mostra as mudanças, pede confirmação e atualiza o rascunho (E2E com o cliente real contra o pacote standalone).
- [x] Teste: manifesto com `pending` não vazio é recusado com a lista.
- [x] Teste: `offers: []` não apaga ofertas cadastradas no painel.
- [x] Rodar duas vezes seguidas: na segunda, "Nenhuma mudança".
- [ ] Publicar um título **real** de ponta a ponta: depende de o titular zerar as pendências do título no `../ebooks` (tema confirmado, marcos do `status.md`, preço e oferta confirmados no `comercial.md`) e do deploy.

**Portão:** você publica um e-book novo só pelo terminal.

**Landing personalizada do 001 (03/11/2026):** pronta localmente em `src/landings/criar-sistemas-com-ia/`; Lighthouse com dados reais mediana 93, A11y/Boas práticas/SEO 100, CLS 0. Visual aprovado e no ar. **A Hotmart e o painel precisam estar na 2ª edição** (a página cita os capítulos 1 a 25): conferir.

**Landing personalizada do 002 (03/11/2026):** pronta localmente em `src/landings/a-mente-inabalavel/`; assume `/a-mente-inabalavel`. Lighthouse com dados reais: mediana 95, A11y/Boas práticas/SEO 100, CLS 0. Visual aprovado e no ar.

**Landing personalizada do 003, Natal à Mesa (03/11/2026):** pronta localmente em `src/landings/natal-a-mesa/`; assume `/natal-a-mesa`. Lighthouse com dados do livro (preço de teste): mediana 93, A11y/Boas práticas/SEO 100, CLS 0, LCP 1,1 s; 21 E2E da família de landings passam. **Auditoria impeccable feita em 04/11/2026** (ver [05](05-design.md)); **aguarda aprovação visual do titular; não está no ar nem cadastrada no painel.** Bloqueios do livro (`../ebooks/ebooks/003-natal-a-mesa/status.md`): teste de cozinha, título, preço e checkout, licença da capa.

## Depois do MVP — iteração em produção

Regra: **uma melhoria = uma mudança pequena que vai ao ar no mesmo dia.** Ideias novas entram no backlog abaixo, com a data e o motivo. Prioriza-se pelo impacto em vendas, não pela vontade de construir.

## Pendências abertas (03/11/2026)

Só o titular pode fazer; nada disto bloqueia o desenvolvimento.

| O quê | Detalhe |
|---|---|
| Capa do 002 | Subir de novo no painel depois do deploy: vira JPEG, bem mais leve |
| Produtos de teste | Apagar o `testeTESTE` na Kiwify e o `TESTE` (ativo) na Cakto |
| Hotmart do 001 | Passar para a 2ª edição e decidir o preço da Black Friday (R$ 24,99 na Hotmart contra R$ 47 cadastrado). O titular disse que mexe nos preços depois |
| Textos legais | Termos e Privacidade ainda são ponto de partida, não parecer jurídico |

## Backlog

Ordem atual (reavaliar a cada 2 semanas com os dados da [rotina semanal](04-vendas-e-medicao.md#8-rotina-semanal-15-minutos)):

1. **Depoimentos reais e nº de compradores** com autorização: a escassez de demanda é a que funciona em produto utilitário. Assim que existirem.
2. **Order bump** com produto real (ex.: kit de proposta e contrato), depois das primeiras vendas.
3. ✅ ~~Webhooks de venda~~ (feito em 04/11/2026, pronto localmente; falta deploy e o cadastro nas lojas: ver item 12 da etapa "Vender").
4. **Teste de promessa**: "Coloque no ar um sistema real com IA, sem depender de plataforma" contra a headline atual. Com pouco tráfego, em sequência, não em A/B.
5. ✅ ~~Recuperação de senha por e-mail~~ (feita em 03/11/2026, SMTP opcional; falta o deploy).
6. **Pacotes/combos** (vários e-books de um tema com desconto, se as plataformas suportarem).
7. **Busca** no catálogo (quando houver mais de ~20 e-books).
8. **Multi-idioma** (quando houver um título traduzido).
9. **Backup fora do VPS** (opcional, decisão de 03/11/2026): só se o titular pedir; destino ainda não definido ([06](06-deploy.md#backup)).

### Ideias recebidas

| Data | Ideia | Motivo / origem | Decisão |
|---|---|---|---|
| 03/11/2026 | Artigos por tema no site | Estava no backlog; proposto de novo na estratégia orgânica | **Retirado pelo titular.** Só volta a ser discutido se o Search Console mostrar demanda sem página para atender |
| 03/11/2026 | Vender na Amazon (KDP) e no Google Play Livros | Canal onde já há gente procurando livro | **Não por enquanto**, decisão do titular |
| 03/11/2026 | Importar o guia ou o manifesto no "Novo e-book", em vez de copiar e colar campo a campo | Surgiu ao criar os guias | Backlog; o titular pediu copiar e colar |
| 02/11/2026 | Imagem de compartilhamento (Open Graph) da Home, no mesmo estilo da dos e-books | Achado no SEO da Fase 3: a Home tem título e descrição, mas não imagem própria | **Feita em 05/11/2026** (imagem da marca, sem banco) |
| 02/11/2026 | Página/botão "Seja afiliado" com o link de recrutamento da Hotmart (`affiliate.hotmart.com/affiliate-recruiting/view/1092C108114173`) | Titular, ao passar os links | O link já entra nos convites do kit de parceiros. Página própria só depois da primeira venda |
