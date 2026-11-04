// Textos próprios desta página, tirados do manuscrito (../ebooks/ebooks/002-estoicismo-pratico/manuscrito/pt-BR).
// Cada item cita o capítulo de origem. O restante da página vem do painel (e.*). Nada aqui promete resultado ou cura.

export type Problema = {
  id: string;
  rotulo: string;
  capitulo: number;
  cena: string;
  citacao: string;
  fonte: string;
  nota?: string;
  exercicio: string;
  passos: string[];
};

export const PROBLEMAS: Problema[] = [
  {
    id: "ansiedade",
    rotulo: "Ansiedade",
    capitulo: 4,
    cena: "São três da manhã e o seu quarto está em silêncio. A cabeça, não.",
    citacao: "Há mais coisas que nos assustam do que coisas que nos ferem; sofremos mais na imaginação do que na realidade.",
    fonte: "Sêneca, Carta 13",
    exercicio: "A sessão de dez minutos",
    passos: [
      "Despeje: escreva, sem filtro, tudo o que está te preocupando. Dois minutos.",
      "Classifique cada item: agora? meu? qual o próximo passo? Cinco minutos.",
      "Premedite o mais pesado: o pior, se sobreviveria, o que faria. Três minutos.",
      "Feche, em voz alta: “Fiz o que posso por agora. O resto é do mundo.”",
    ],
  },
  {
    id: "raiva",
    rotulo: "Raiva",
    capitulo: 5,
    cena: "O motorista da frente freia sem aviso. Dois semáforos depois, você está tremendo, com o dia estragado. O outro motorista nem lembra de você.",
    citacao: "O maior remédio contra a ira é o adiamento.",
    fonte: "Sêneca, Sobre a ira, II.29",
    exercicio: "O protocolo dos cinco passos",
    passos: [
      "Pare: não fale, não envie, não tome decisão.",
      "Nomeie: “Estou com raiva. O corpo está assim.”",
      "Procure a frase escondida: “Ele não tinha o direito.”",
      "Teste a frase: é verdade em todas as circunstâncias? O que eu quero de verdade?",
      "Escolha uma resposta firme, e não furiosa: o que dizer, a quem, quando.",
    ],
  },
  {
    id: "perda",
    rotulo: "Perda",
    capitulo: 6,
    cena: "Um capítulo para quem perdeu alguém, um emprego, um casamento, uma saúde, um sonho.",
    citacao: "Nunca diga “perdi”, mas “devolvi”.",
    fonte: "Epicteto, Manual 11",
    nota: "O próprio livro avisa: a frase é um treino para fazer antes, não um consolo para quem acabou de perder. Se a sua perda é recente e dói demais, feche o livro e volte mais tarde. O estoicismo não apressa o luto de ninguém.",
    exercicio: "O que foi dado",
    passos: [
      "O que perdi? Descreva sem enfeites.",
      "O que recebi enquanto estava na minha vida?",
      "O que ainda tenho? Memórias, hábitos, valores, pessoas ligadas.",
      "O que posso fazer hoje em honra disso? Um gesto, uma ligação, um ritual.",
    ],
  },
  {
    id: "criticas",
    rotulo: "Críticas",
    capitulo: 8,
    cena: "Dez pessoas aprovaram, e uma desaprovou. A sua cabeça ficou com a uma.",
    citacao: "Ele deve desconhecer meus outros defeitos, senão não teria mencionado só esses.",
    fonte: "Epicteto, Manual 33",
    exercicio: "O filtro de três perguntas",
    passos: [
      "O que foi dito ou feito, em linguagem neutra.",
      "É verdade? Sim, em parte, não ou não sei.",
      "Quem falou, e com que interesse?",
      "Que botão foi apertado? Qual medo ou crença isso tocou?",
      "O que eu faço? Ajusto, deixo passar, respondo curto, me afasto ou denuncio.",
    ],
  },
  {
    id: "tempo",
    rotulo: "Tempo",
    capitulo: 9,
    cena: "Domingo, nove da noite. Havia uma lista de coisas que você ia fazer, e a lista está lá, intacta, com outras novas por cima.",
    citacao: "Não é que tenhamos pouco tempo; é que desperdiçamos muito dele.",
    fonte: "Sêneca, Sobre a brevidade da vida, 1.3",
    exercicio: "A auditoria de sete dias",
    passos: [
      "A cada duas ou três horas, anote em uma linha o que fez.",
      "No sétimo dia, some as horas: Meu, Tomado, Furtado, Escoado.",
      "Identifique os três maiores ladrões.",
      "Escolha uma medida concreta para cada um: desligar, limitar, sair, recusar.",
      "Defina um bloco diário, mesmo pequeno, para algo que importa a você.",
    ],
  },
  {
    id: "dinheiro",
    rotulo: "Dinheiro",
    capitulo: 10,
    cena: "O salário aumentou 30%. No sexto mês, a conta bancária está do mesmo jeito de antes, e você, mais cansado.",
    citacao: "Não é pobre quem tem pouco, mas quem deseja mais.",
    fonte: "Sêneca, Carta 2",
    nota: "Este capítulo é de filosofia, e não de consultoria financeira: não ensina investimento nem indica produtos.",
    exercicio: "O mapa do necessário",
    passos: [
      "Pegue os extratos do último mês.",
      "Classifique cada gasto: Necessário, Suficiente ou Supérfluo.",
      "Some as três categorias e veja a proporção.",
      "Escolha um supérfluo para cortar ou reduzir este mês.",
      "Para compras novas acima de um valor seu: espere 30 dias.",
    ],
  },
];

// Capítulo 18.
export const SEMANAS = [
  { titulo: "A fronteira e o juízo", objetivo: "Aprender a separar o que é seu do que não é, e enxergar a história entre o fato e a emoção." },
  { titulo: "Ansiedade, raiva e perda", objetivo: "Ter uma ferramenta pronta para cada uma das três emoções mais pesadas." },
  { titulo: "Tempo, dinheiro e pessoas", objetivo: "Aplicar as ideias ao mundo concreto, onde mora a maior parte do desgaste." },
  { titulo: "Caráter e consolidação", objetivo: "Juntar tudo num modo de viver que você consiga manter depois do plano." },
];

// Capítulo 2, tabela "Voltando a Marina". A ordem das frases é só para intercalar as duas colunas.
export const MARINA = {
  cena: "Marina tem uma apresentação para a diretoria na sexta. Desde segunda, o estômago não assenta.",
  itens: [
    { texto: "A cara do diretor", depende: false },
    { texto: "Ensaiar a abertura", depende: true },
    { texto: "A decisão do orçamento", depende: false },
    { texto: "Dormir 7 horas", depende: true },
    { texto: "Conhecer os números", depende: true },
    { texto: "Quem faz perguntas", depende: false },
    { texto: "Chegar 15 minutos antes", depende: true },
    { texto: "O clima da sala", depende: false },
  ],
  percebe: "Quase tudo o que ela estava remoendo estava na coluna da direita.",
  colunas: "A coluna da esquerda vira a sua lista de ações. A da direita vira a lista de coisas que você aprende a deixar de carregar.",
  limite: "Isso não garante que a apresentação vai ser um sucesso. A diretoria pode cortar o projeto de qualquer jeito.",
};

// Linhas: por onde começa, a hora do aperto, o que fica. Clássicos: Apêndice A. Este livro: descrição, capítulos 18 e 19.
export const LINHAS_COMPARACAO = ["Por onde você começa", "Na hora do aperto", "O que fica depois"];
export const COMPARACAO = [
  { nome: "Frases e vídeos", itens: ["Pela frase do dia.", "Você se lembra de uma frase, quando se lembra.", "Inspiram na hora e somem no dia seguinte."] },
  { nome: "Os clássicos, direto na fonte", itens: ["Pelo autor e pela época dele.", "Você descobre sozinho como aplicar a ideia.", "Continuam sendo a melhor fonte, para quem quer ir mais fundo."] },
  { nome: "A Mente Inabalável", itens: ["Pelo problema que está pesando agora.", "Um exercício de 5 a 15 minutos, com caneta e papel.", "Um plano de 30 dias e um capítulo sobre o que fazer quando você falhar."], destaque: true },
];

// Apêndices do livro (ap-a, ap-b e ap-c). Fazem parte do livro: não são bônus.
export const APENDICES = [
  "Apêndice A: por onde ler os clássicos",
  "Apêndice B: mapa rápido com 18 situações, para achar a prática no meio do problema",
  "Apêndice C: 40 frases-âncora, com a fonte de cada uma",
];
