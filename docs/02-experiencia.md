# 02 — Experiência (páginas e painel)

Cada seção pública indica de qual campo do banco vem o conteúdo (ver [03-tecnico](03-tecnico.md#modelo-de-dados)). **Se o campo estiver vazio, a seção não aparece.** Não existe seção com texto de preenchimento.

## Mapa do site

| Rota | Página | Indexável |
|---|---|---|
| `/` | Home / catálogo | Sim |
| `/tema/[slug]` | E-books de um tema | Sim |
| `/[slug]` | Landing page do e-book | Sim, quando publicado |
| `/[slug]?previa=1` | Prévia do rascunho (só logado) | Não |
| `/ir/[ofertaId]` | Registra o clique e redireciona ao checkout | Não |
| `/termos`, `/privacidade` | Legal | Sim |
| `/painel/...` | Painel administrativo | Não |

Slugs reservados (não podem ser slug de e-book): `tema`, `ir`, `painel`, `api`, `termos`, `privacidade`, `entrar`.

---

## Landing page do e-book (`/[slug]`)

É a página mais importante do projeto. Mobile-first. Ordem pensada para conversão: promessa → confiança → prova → objeções → compra.

| # | Seção | Conteúdo | Campos |
|---|---|---|---|
| 1 | **Hero** | Capa em mockup 3D (livro com sombra e leve inclinação), headline, subtítulo, preço, CTA principal e linha de confiança: "Acesso imediato · PDF e EPUB · Garantia de 7 dias" | `capa`, `headline` (cai para `titulo`), `subtitulo`, `preco`, `precoDe`, oferta principal, `formatos`, `garantiaDias` |
| 2 | **Faixa de urgência** | "Preço de lançamento até 15/11 — faltam 2d 14h 03m". Some sozinha no fim do prazo, quando o preço passa a `precoDe` | `ofertaAte`, `preco`, `precoDe` |
| 3 | **Sobre o livro** | Abre com o problema do leitor em destaque (1 frase) e segue com 2 a 4 parágrafos curtos de descrição | `problema`, `descricao` |
| 4 | **O que você vai aprender** | 3 a 6 benefícios em cards com ícone | `beneficios[]` |
| 5 | **Para quem é / não é** | Duas colunas: ✓ e ✕ | `paraQuem[]`, `naoEPara[]` |
| 6 | **Folheie o livro** | Carrossel de páginas de amostra; toque abre em tela cheia. Botão "Baixar amostra grátis" se houver PDF | `amostras[]`, `amostraPdf` |
| 7 | **Sumário** | Capítulos em acordeão (fechado mostra só os títulos) | `sumario[]` |
| 8 | **O que está incluído** | Lista do que o comprador recebe (formatos, caderno, modelos). Só itens reais | `incluido[]` |
| 9 | **Sobre o autor** | Foto opcional, nome, 2 a 4 linhas | `autorExibido`, `sobreAutor`, `autorFoto` |
| 10 | **Garantia** | Selo + texto curto sobre os 7 dias e o reembolso pela plataforma | `garantiaDias` |
| 11 | **FAQ** | Perguntas em acordeão (vira schema `FAQPage`) | `faq[]` |
| 12 | **Bloco de compra** (`#comprar`) | Preço grande + **um botão principal** ("Comprar na Kiwify") + linha "Prefere outra plataforma?" com botões secundários (logo + preço). Abaixo, pagamento seguro, garantia e, em letra menor, "Antes de comprar" (requisitos e limites honestos, o que reduz reembolso) | `ofertas[]` (ativas, ordenadas, uma `principal`), `observacoes` |
| 13 | **Mais do tema** | Até 3 outros e-books publicados do mesmo tema | relação por `temaId` |
| — | **Barra fixa no mobile** | Aparece depois do hero: preço + "Comprar". Some quando o bloco de compra está visível | — |
| — | **Compartilhar** | Botão "Enviar para um amigo" (WhatsApp com link + título) no rodapé da landing | — |

**Comportamento do CTA:**

- O CTA do hero e o da barra fixa levam **direto à oferta principal** via `/ir/...`. Menos um clique é mais venda.
- Com 2 ou mais ofertas, a linha de confiança do hero ganha o link "ver outras formas de compra" → `#comprar`.

**Sem oferta ativa:** a página mostra "Em breve", sem botão de compra. É útil para validar interesse antes do checkout existir.

---

## Home (`/`)

1. **Hero da marca:** frase curta ("E-books práticos para resolver problemas reais") + 1 e-book em destaque (o mais recente ou o marcado como destaque) com CTA para a landing.
2. **Temas:** chips/cards com nome e contagem.
3. **Catálogo:** grade de capas (2 colunas no mobile, 4 no desktop), com título, preço e selo "Lançamento" se `ofertaAte` estiver ativo.
4. **Rodapé:** sobre o Bibliotheon (2 linhas), links legais, contato.

Com um único e-book, a Home funciona: o hero mostra esse e-book e a grade some.

## Página de tema (`/tema/[slug]`)

- Título e descrição do tema (texto pensado para SEO: o que o leitor desse tema procura).
- Grade dos e-books do tema.
- Serve como destino de campanhas amplas ("todos os e-books de saúde").

---

## Painel (`/painel`)

### Regras de interface

- Menu lateral (grade de 4 colunas no celular) com **no máximo 4 itens**:
  - E-books;
  - Temas*;
  - Parceiros*;
  - Conta.

  \* só owner.
- **Uma ação principal por tela**, sempre no mesmo lugar (canto superior direito / barra inferior no mobile).
- Linguagem do usuário, nunca técnica: "Página de vendas", não "body"; "Onde comprar", não "offers".
- Toda ação dá retorno visível (toast). Toda ação destrutiva pede confirmação.
- Estado vazio sempre explica o próximo passo com um botão.

### Entrar (`/entrar`)

E-mail + senha. Sem cadastro público. Esqueceu a senha: "Fale com o administrador" no MVP.

### E-books (`/painel`)

- **Owner:** vê todos e filtra por "Em revisão" e por parceiro. **Parceiro:** vê só os próprios.
- Cada e-book é uma linha com:
  - miniatura da capa e título;
  - status (badge: Rascunho / Em revisão / Publicado);
  - visitas, cliques e taxa de clique em 7 dias, com seletor 7d/30d;
  - botões "Ver página" e "Editar".
- Ação principal: **"Novo e-book"**.
- Estado vazio: "Você ainda não tem e-books. Comece pelo título e pela capa — o resto você completa depois." + botão.

### Editor do e-book (`/painel/ebooks/[id]`)

Uma página só, com seções numeradas. A navegação por âncoras ("Nesta página") fica na **coluna lateral direita**, junto com o checklist e as ações (no celular, ela é substituída por um resumo do checklist e uma barra fixa Salvar/Publicar):

1. **Essencial:**
   - título; slug (gerado automaticamente, editável); tema (select + "criar tema", só owner);
   - capa (arrastar e soltar, com recorte guiado em 1600×2560); texto alternativo da capa;
   - autor exibido; formatos (chips: PDF, EPUB, caderno...).
2. **Página de vendas:**
   - headline (com contador de caracteres e dica: "diga o resultado, não o assunto"); subtítulo;
   - problema (1 frase) e descrição (parágrafos);
   - benefícios, para quem é e para quem não é (listas com "+ adicionar" e arrastar para ordenar);
   - incluído;
   - antes de comprar (requisitos e limites);
   - sobre o autor e foto.
3. **Conteúdo:** sumário (lista), FAQ (pares pergunta/resposta), amostras (upload múltiplo de imagens, arrastar para ordenar) e PDF de amostra opcional.
4. **Preço e onde comprar:**
   - preço; preço "de" (com aviso: "só use se for um preço que você realmente pratica"); fim da oferta (data e hora); garantia (padrão 7);
   - ofertas, uma por linha: plataforma (select com logo), URL do checkout, preço, principal (rádio), ativa (toggle);
   - "Testar link" abre a URL numa nova aba.
5. **SEO** (recolhido): título e descrição preenchidos automaticamente (headline/resumo), com prévia de como aparece no Google; Meta Pixel próprio (opcional, para parceiros).

**Barra lateral fixa:**

- **Checklist "Pronto para publicar"** (bloqueia o botão se faltar algo):
  - capa;
  - título;
  - headline;
  - pelo menos 3 benefícios;
  - pelo menos 1 oferta ativa ou o modo "Em breve" marcado.
- **"Ver prévia"** abre `/[slug]?previa=1` numa nova aba.
- **Ação principal:**
  - owner: **"Publicar"** / "Salvar alterações" (se já publicado) / "Despublicar" (no menu ⋯);
  - parceiro: **"Enviar para revisão"**. Depois de publicado, uma edição do parceiro volta o status para "Em revisão" e mantém a versão publicada no ar até a aprovação.

  > Ponto de atenção no MVP: manter duas versões (a publicada e a em revisão) tem custo. Alternativa simples, se ficar pesado: o owner recebe a edição e o parceiro só edita rascunhos. A decisão fica para a Etapa 3 e será registrada em [decisoes](decisoes.md).
- Salvamento: botão "Salvar" + aviso "alterações não salvas" ao sair. Sem autosave no MVP.

### Temas (owner)

Lista simples: nome, slug, nº de e-books, publicado (toggle). Criar/editar num modal: nome, descrição (SEO) e cor.

### Parceiros (owner)

- Lista com nome, e-mail, nº de e-books e ativo (toggle).
- "Novo parceiro": nome + e-mail → gera senha temporária exibida uma vez para o owner repassar.
- "Redefinir senha" faz o mesmo.

### Conta

- Nome e trocar senha.
- **Token de API** (para a CLI): "Gerar token" mostra o valor **uma vez**; listar, com último uso, e revogar.

---

## Textos padrão da interface (tom)

Direto, caloroso e sem jargão. Exemplos:

- Publicar: "Publicado! Sua página já está no ar." + link.
- Enviar para revisão: "Enviado para revisão. O status muda para Publicado assim que for aprovado."
- Erro de upload: "Essa imagem é muito pequena. Use pelo menos 1200 px de largura."
- Checklist: "Falta 1 item para publicar: adicionar uma oferta."
