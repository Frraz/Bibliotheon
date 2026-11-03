# 01 — Produto

## Em uma frase

**Bibliotheon vende os e-books que criamos.** Tudo que não ajuda a vender fica fora.

## O que é

Uma biblioteca on-line (bibliotheon.com.br) que reúne os e-books publicados nas plataformas de venda (Hotmart, Kiwify, Cakto e outras). Cada e-book tem uma **landing page de alta conversão**, com dois papéis:

- é o destino do tráfego pago e orgânico daquele e-book;
- leva o visitante ao checkout da plataforma que ele preferir.

O Bibliotheon **não** processa pagamento, **não** entrega arquivos e **não** guarda o PDF/EPUB pago.

## Por que existe

- As páginas das plataformas são genéricas e iguais para todo mundo. Uma landing própria apresenta o livro muito melhor: amostra, sumário, FAQ, autor e design próprio.
- Um único endereço por e-book (`bibliotheon.com.br/<slug>`) serve para anúncios, bio do Instagram, WhatsApp e Google.
- O catálogo cria venda cruzada: quem chega por um e-book descobre outros do mesmo tema.
- Medimos visitas e cliques por plataforma e sabemos qual página e qual origem funcionam.

## Usuários

| Quem | O que precisa |
|---|---|
| **Visitante** (quase sempre no celular, vindo de um anúncio) | Entender em 5 segundos o que o livro resolve, confiar e comprar sem atrito |
| **Owner** (Warley) | Publicar e-books rápido, pelo painel (com o guia gerado no `../ebooks`); cadastrar quem publica; ver o que vende |
| **Parceiro** (na tela, "Publicador") | Cadastrar o próprio e-book pelo painel sem treinamento e acompanhar visitas e cliques |

## Princípios

1. **Vender é o critério de desempate.** Na dúvida entre duas opções, fica a que converte mais com menos complexidade.
2. **Pouco e impecável.** Poucas páginas, poucos campos, poucas opções, todos bem-acabados. É melhor faltar um recurso do que ter um recurso feio.
3. **Ver antes de construir.** Nenhuma tela é implementada de verdade antes de o protótipo visual ser aprovado (ver [07-roteiro](07-roteiro.md)).
4. **No ar cedo, melhora contínua.** O MVP vai para produção com um e-book real; o resto entra em iterações pequenas.
5. **Honestidade que vende.** Urgência real, preço real e prova real. Nada de timer falso, depoimento inventado ou promessa de renda/cura. Isso também protege os anúncios contra reprovação e o negócio contra o CDC/Procon.
6. **Celular primeiro e rápido.** O tráfego pago é móvel; cada segundo de carregamento custa vendas.

## Decisões de produto

| Tema | Decisão |
|---|---|
| Arquivos do e-book | No site ficam apenas os dados de apresentação e **páginas de amostra em imagem** (3 a 8). PDF/EPUB pago, entrega e reembolso ficam nas plataformas. Opcional: PDF de amostra gratuito |
| Várias plataformas | Cada e-book tem **uma plataforma principal** (botão grande) e as demais em "Prefere outra plataforma?". Muitas opções iguais paralisam a escolha |
| Urgência | O timer só aparece se o e-book tiver data real de fim da oferta (`ofertaAte`). O preço "de" riscado só aparece se for um preço realmente praticado. Depois do prazo, o preço volta ao normal sozinho |
| Garantia | Sempre visível: 7 dias (direito de arrependimento, CDC art. 49), conforme a política da plataforma |
| Parceiros | Contas criadas pelo owner (sem cadastro público). O parceiro vê só os próprios e-books e **publica direto, sem revisão** (decisão de 02/11/2026) |
| Plataformas | Nenhuma é obrigatória. Um e-book pode ter só Kiwify, por exemplo. A lista de plataformas é extensível |
| IA no site | Nenhuma. O site é vitrine; a criação acontece em `../ebooks` |

## Escopo do MVP

**Dentro:**

- Home (catálogo), página de tema, landing por e-book.
- Saída rastreada para o checkout, com repasse de UTMs.
- Painel: login com recuperação de senha por e-mail (SMTP opcional), lista de e-books com métricas, editor numa página só, temas, usuários, exportação de dados e PDF privado.
- Fluxo rascunho → publicado, com prévia real do rascunho.
- Landing padrão ou personalizada por e-book.
- API de operação (`deploy/venda.sh`) para preço, campanha e textos. A API + CLI de publicação a partir do `../ebooks` está planejada (Etapa 4, pausada).
- SEO técnico completo, OG automático, Termos, Privacidade, banner de consentimento.
- Deploy no VPS substituindo o v1.

**Fora**, no [backlog](07-roteiro.md#backlog). Só entra quando o uso real pedir:

- blog/artigos;
- captura de leads (só existe o pedido de amostra por e-mail, feito na etapa "Vender");
- webhooks de venda;
- A/B test;
- multi-idioma;
- busca;
- avaliações.

## O que o Bibliotheon NÃO é

- Não é loja: não tem carrinho, pagamento nem área de membros.
- Não é CMS genérico: os campos são os de uma landing de e-book, nada além disso.
- Não é marketplace aberto: parceiros são convidados.
- Não substitui o `../ebooks`: lá se cria o livro, aqui se vende.

## Como saberemos que funciona

- **Técnico:** Lighthouse mobile ≥ 95 e LCP < 2 s em 4G.
- **Operação:** publicar um e-book novo leva < 10 min pelo painel e 1 comando pelo `../ebooks`.
- **Negócio** (acompanhar semanalmente):
  - taxa de clique para o checkout (meta inicial: ≥ 8% das visitas);
  - custo por clique no checkout nos anúncios;
  - vendas por e-book informadas pelas plataformas.
