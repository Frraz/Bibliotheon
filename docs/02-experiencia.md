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

É a página mais importante do projeto. Mobile-first. Ordem do [padrão de venda](04-vendas-e-medicao.md#6-padrão-de-venda): promessa → necessidade → resultado → por que este caminho → risco → compra. Sem seção de autor.

| # | Seção | Conteúdo | Campos |
|---|---|---|---|
| 1 | **Faixa de urgência** | "Black Friday até 30/11 · faltam 2 d 14 h 03 min". Só em campanha; some sozinha no fim do prazo | `ofertaAte`, `ofertaNome`, `preco`, `precoDe` |
| 2 | **Hero** | Capa em mockup 3D, headline, subtítulo, preço, CTA e linha de confiança: "Acesso imediato · PDF e EPUB · Garantia de 7 dias". Em campanha: "Até 30/11 às 23h59. Depois, R$ 64,99." | `capa`, `headline` (cai para `titulo`), `subtitulo`, `preco`, `precoDe`, `parcelamento`, oferta principal, `formatos`, `garantiaDias` |
| 3 | **Necessidade** | O problema do leitor em destaque (1 frase), as situações que ele reconhece e a descrição, recolhida | `problema`, `dores[]`, `descricao` |
| 4 | **O que você vai saber fazer** | 3 a 6 benefícios + nova chance de comprar | `beneficios[]` |
| 5 | **Por que este caminho** | Diferenças reais frente às alternativas, sem citar marcas | `diferenciais[]` |
| 6 | **Para quem é / não é** | Duas colunas, incluindo o esforço exigido | `paraQuem[]`, `naoEPara[]` |
| 7 | **Folheie o livro** | Carrossel de páginas de amostra + nova chance de comprar + amostra em PDF em troca do e-mail | `amostras[]`, `amostraPdf` |
| 8 | **Sumário** | Lista de capítulos | `sumario[]` |
| 9 | **O que está incluído + garantia** | O que o comprador recebe (só itens reais) e como pedir reembolso | `incluido[]`, `garantiaDias` |
| 10 | **FAQ** | Perguntas em acordeão (vira schema `FAQPage`) | `faq[]` |
| 11 | **Bloco de compra** (`#comprar`) | Headline de novo, preço grande, consequência do prazo e **as lojas**: com uma, um botão; com várias, "Escolha onde prefere comprar" e um botão por loja, todos iguais. Abaixo, "Antes de comprar" (requisitos e limites honestos, o que reduz reembolso) | `ofertas[]`, `observacoes` |
| 12 | **Mais do tema** | Até 4 outros e-books publicados do mesmo tema | relação por `temaId` |
| — | **Barra fixa no mobile** | Aparece depois do hero: preço + "Comprar". Some quando o bloco de compra está visível | — |
| — | **Compartilhar** | Botão "Enviar para um amigo" (WhatsApp com link + título) no rodapé da landing | — |

**Comportamento do CTA:**

- **Uma loja ativa:** o CTA do topo, o do meio e o da barra fixa vão **direto ao checkout** via `/ir/...`. Menos um clique é mais venda.
- **Duas ou mais lojas ativas** (decisão de 02/11/2026): todas aparecem em `#comprar`, com o mesmo botão e na ordem da lista do painel, e o preço só aparece na loja que cobra outro valor. O CTA do topo ("Escolher onde comprar"), o do meio e o da barra fixa ("Escolher loja") levam até lá. Custo: um clique a mais; medir no relatório (`deploy/venda.sh relatorio`) quando um e-book tiver 2 lojas.
- **Página personalizada:** um e-book pode ter uma landing própria no código (`src/landings/`, [03](03-tecnico.md#landing-personalizada)). Ela assume o endereço do e-book sozinha e continua lendo texto, preço, lojas e campanha do painel.

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

- Menu lateral (grade no celular) com **no máximo 4 itens**:
  - E-books;
  - Temas* (Fase 2);
  - Usuários*;
  - Conta.

  \* só administrador.
- **Uma ação principal por tela**, sempre no mesmo lugar (canto superior direito / barra inferior no mobile).
- Linguagem do usuário, nunca técnica: "Página de vendas", não "body"; "Onde comprar", não "offers".
- Toda ação dá retorno visível (toast). Toda ação destrutiva pede confirmação.
- Estado vazio sempre explica o próximo passo com um botão.

### Entrar (`/entrar`)

E-mail + senha. Sem cadastro público. Esqueceu a senha: "Fale com o administrador" no MVP. `/admin` e `/painel` levam aqui quando não há sessão.

### E-books (`/painel`)

- **Administrador:** vê todos, com o nome do dono. **Usuário comum:** vê só os próprios (a consulta já nasce filtrada).
- Cada e-book é uma linha com:
  - miniatura da capa e título;
  - status (badge: Rascunho / Publicado);
  - visitas, cliques e taxa de clique em 7 dias, com seletor 7d/30d;
  - botões "Ver página" (publicado) ou "Ver prévia" (rascunho) e "Editar".
- Ação principal: **"Novo e-book"**.
- Estado vazio: "Você ainda não tem e-books. Comece pelo título e pela capa — o resto você completa depois." + botão.

### Editor do e-book (`/painel/ebooks/[id]`) ✅ Fase 2

"Novo e-book" pede só o título e abre o editor (rascunho, com o endereço gerado do título). Capa, amostras e PDF valem na hora; o texto vale ao salvar. Aviso ao sair com alterações não salvas.


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
   - lojas, uma por linha: plataforma, link do checkout, link da campanha (só com campanha ligada), ativa (chave). A primeira loja ativa da lista é a do botão principal;
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
  - **todos (administrador e usuário comum): "Publicar"** (rascunho) ou "Salvar alterações" (publicado, vale na hora) e "Despublicar" no fim da página. Não há etapa de revisão (decisão de 02/11/2026).
  - Rascunho com algo faltando: "Publicar" salva como rascunho e mostra o que falta. Publicado: não salva incompleto.
- Salvamento: botão "Salvar" + aviso "alterações não salvas" ao sair. Sem autosave no MVP.

### Temas (owner)

Lista simples: nome, slug, nº de e-books, publicado (toggle). Criar/editar num modal: nome, descrição (SEO) e cor.

### Usuários (administrador) ✅ Fase 1

- Lista com nome, e-mail, nº de e-books e quantos estão no ar, e a chave Ativo.
- "Novo usuário": nome + e-mail → gera senha temporária exibida uma vez para o administrador repassar. E-mail repetido é recusado.
- "Redefinir senha" faz o mesmo e derruba as sessões abertas da pessoa.
- Desativar pede confirmação e oferece "Tirar do ar também os e-books dessa pessoa" (volta para rascunho). A pessoa perde o acesso na hora. O administrador não aparece com chave.
- **Usuário ativo publica direto, sem revisão** (decisão de 02/11/2026): a ação principal do editor é "Publicar", para todos.

### Conta ✅ Fase 1

- Nome e trocar senha (mínimo de 10 caracteres; encerra a sessão dos outros aparelhos).
- **Token de API** (para a CLI, Etapa 4): "Gerar token" mostra o valor **uma vez**; listar, com último uso, e revogar.

---

## Textos padrão da interface (tom)

Direto, caloroso e sem jargão. Exemplos:

- Publicar: "Publicado! Sua página já está no ar." + link.
- Enviar para revisão: "Enviado para revisão. O status muda para Publicado assim que for aprovado."
- Erro de upload: "Essa imagem é muito pequena. Use pelo menos 1200 px de largura."
- Checklist: "Falta 1 item para publicar: adicionar uma oferta."
