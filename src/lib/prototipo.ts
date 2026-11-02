// Conteúdo real do e-book 001, usado pelos protótipos visuais (Etapa 1).
// Fontes: ../ebooks/ebooks/001-sistemas-com-ia (manifest.json, oferta/pt-BR/kit-comercial.md, status.md).
// O preço e o link da Hotmart são os reais; a campanha é a planejada para a Black Friday; a Kiwify é de demonstração.

export const livro = {
  slug: "criar-sistemas-com-ia",
  titulo: "Crie Sistemas com IA e Ganhe Dinheiro",
  headline: "Crie seu primeiro sistema com IA, mesmo sem saber programar",
  subtitulo:
    "Do zero ao sistema no ar: aprenda a resolver problemas reais e organizar uma proposta de serviço que pode ser vendida.",
  autor: "Warley Ferraz Almeida",
  capa: "/prototipo/capa-001.jpg",
  capaAlt:
    "Capa de Crie Sistemas com IA e Ganhe Dinheiro, de Warley Ferraz Almeida.",
  resumo:
    "Aprenda a transformar problemas reais em pequenos sistemas com IA. Comece pelos fundamentos, construa uma aplicação, prepare VPS e domínio e organize sua proposta de serviço, mesmo começando sem saber programar.",
  problema: "Você consegue imaginar a solução, mas não sabe programar.",
  dores: [
    "Uma tarefa repetitiva continua tomando o seu tempo porque o sistema que a resolveria ainda só existe na sua cabeça.",
    "A informação fica espalhada entre mensagens, caderno e memória. Quando alguém pergunta, você procura em três lugares.",
    "A planilha já não acompanha o trabalho, e você não sabe o que colocar no lugar dela.",
    "Você já pediu código a uma IA, mas não sabe dizer se o resultado está certo nem como colocá-lo no ar.",
  ],
  diferenciais: [
    "Não para no protótipo. O percurso segue até VPS, domínio, HTTPS, backup e atualização, dizendo o que conferir em cada etapa.",
    "O projeto é seu. O código fica numa pasta sua e no seu GitHub, e é você quem escolhe e contrata o servidor.",
    "Você aprende a conferir a IA, não só a pedir. Cada etapa termina com algo observável: uma regra escrita, um programa que inicia, uma operação recusada, uma recuperação conferida.",
    "Se quiser transformar isso em serviço, o livro também ensina a descobrir a necessidade, delimitar o escopo, montar a proposta e combinar a entrega. Sem promessa de renda.",
  ],
  descricao: [
    "Crie Sistemas com IA e Ganhe Dinheiro apresenta um percurso prático para quem começa sem programação. Você aprende os fundamentos necessários, organiza requisitos, conduz a IA no editor, constrói por etapas e confere o resultado.",
    "Acompanhe a Oficina Clara, um exemplo fictício de ordens de serviço com gerente, técnicos, permissões e histórico. Depois avance para Git e GitHub, VPS Ubuntu, domínio, DNS, HTTPS, backup, restauração e atualização.",
    "O percurso comercial mostra como entender uma necessidade, delimitar escopo, preparar preço e proposta e combinar entrega e suporte.",
  ],
  beneficios: [
    "Transformar uma ideia em requisitos e critérios de aceite.",
    "Conduzir a IA por fases e retomar o projeto em outra sessão.",
    "Construir e testar uma aplicação com acesso por papel.",
    "Seguir o percurso até uma VPS com domínio e operação documentada.",
    "Preparar uma proposta com escopo, preço e responsabilidades claros.",
  ],
  paraQuem: [
    "Adultos iniciantes, sem programação, que querem resolver uma necessidade própria.",
    "Quem quer aprender a prestar serviço de desenvolvimento de pequenos sistemas.",
    "Quem prefere um percurso guiado a juntar vídeos soltos.",
  ],
  naoEPara: [
    "Quem procura renda, clientes ou prazo garantidos: o livro ensina o método, não promete resultado.",
    "Quem espera mentoria, implantação individual ou suporte de programação.",
    "Quem quer um sistema crítico (cobrança, 2FA, offline) sem desenvolvimento adicional.",
  ],
  incluido: [
    "Livro completo em PDF e EPUB, com 168 páginas",
    "Caderno de prática em PDF",
    "Projeto da Oficina Clara, modelos, prompts e checklists (ZIP)",
    "Instruções para Windows 11/WSL, Ubuntu e macOS",
  ],
  paginas: 168,
  capitulos: 22,
  amostras: [
    { src: "/prototipo/amostra-03.webp", alt: "Página de abertura do livro" },
    { src: "/prototipo/amostra-06.webp", alt: "Capítulo 1: você não precisa saber os nomes" },
    { src: "/prototipo/amostra-11.webp", alt: "Capítulo 2: preparar o ambiente, com comandos" },
    { src: "/prototipo/amostra-24.webp", alt: "Tabela de verificação" },
    { src: "/prototipo/amostra-25.webp", alt: "Capítulo 4: o que você realmente entrega" },
    { src: "/prototipo/amostra-27.webp", alt: "Planejamento com IA e caminho da ideia ao uso" },
  ],
  percurso: "/prototipo/percurso.png",
  sumario: [
    "Antes de começar: você não precisa saber os nomes",
    "Preparar Windows 11, Ubuntu ou macOS",
    "Oficina de início: a IA dentro do editor",
    "O que você realmente entrega",
    "Transformar conversa em regras verificáveis",
    "Planejar com IA e guardar o resultado",
    "Entender as peças antes de gerar código",
    "O básico para compreender o que a IA escreve",
    "Oficina de construção: da pasta vazia à primeira ordem",
    "Executar um sistema pequeno do início ao fim",
    "Desenvolver com IA sem perder o controle",
    "Testar regras, acessos e falhas",
    "Guardar histórico e enviar ao GitHub",
    "Preparar uma VPS de homologação",
    "Registrar seu domínio e configurar o endereço",
    "Configurar, subir e validar o ambiente de teste",
    "Atualizar sem apostar os dados do cliente",
    "Oficina de passagem: da demonstração à VPS do cliente",
    "Descobrir uma necessidade que merece uma proposta",
    "Transformar o trabalho em uma proposta que pode ser vendida",
    "Entregar o serviço e combinar o depois",
    "Seu próximo sistema: aplicar o método a outro problema",
  ],
  faq: [
    {
      p: "Preciso saber programar?",
      r: "Não para começar. O livro ensina o básico durante as práticas. Você precisará executar os exercícios e aprender a conferir as respostas da IA.",
    },
    {
      p: "O que vou construir?",
      r: "Uma aplicação fictícia de ordens de serviço, a Oficina Clara, com gerente, técnicos, acesso por papel e histórico. Depois há uma atividade para adaptar o método a outro problema pequeno.",
    },
    {
      p: "Vou ganhar dinheiro?",
      r: "O livro ensina a construir e a organizar uma oferta de serviço. Contratação, receita e lucro dependem da aplicação, do mercado, dos custos e da entrega; não são garantidos.",
    },
    {
      p: "O que preciso contratar?",
      r: "O estudo local não exige VPS. IA, domínio, servidor, e-mail e armazenamento podem ter custos próprios quando você os usar. Confira os fornecedores antes de contratar.",
    },
    {
      p: "Inclui suporte ou atualização?",
      r: "Atendimento de compra, acesso e integridade dos arquivos pela plataforma. Sem programação individual, sem mentoria e sem compromisso de novas edições.",
    },
    {
      p: "Como recebo o livro?",
      r: "Pela área de entrega da plataforma em que você comprar, logo após a confirmação do pagamento.",
    },
    {
      p: "Como peço reembolso?",
      r: "Pelo fluxo da própria plataforma de compra, dentro do prazo de 7 dias, respeitando também os direitos previstos em lei.",
    },
  ],
  sobreAutor:
    "Warley Ferraz Almeida usa IA no desenvolvimento de sistemas e relata já ter recebido por trabalhos realizados dessa forma. O livro apresenta o método que ele aplica, com instruções para você repetir e conferir cada passo.",
  garantiaDias: 7,
  preco: 64.99,
  antesDeComprar:
    "Computador e internet; disposição para executar exercícios e conferir os resultados. Serviços de IA, VPS e domínio podem ter custos externos.\n\nSem promessa de renda, clientes ou prazo universal. Não inclui mentoria, implantação individual, suporte de programação ou compromisso de novas edições.",
  ofertas: [
    { plataforma: "Hotmart", url: "https://pay.hotmart.com/X108114152R", ativa: true },
    { plataforma: "Kiwify", url: "https://pay.kiwify.com.br/exemplo", ativa: true },
  ],
} as const;

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Capas e temas de EXEMPLO, só para ver como o catálogo cresce. Não são e-books reais.
export const exemplos = [
  { titulo: "Alimentação sem Culpa", tema: "Saúde", preco: 49, cor: "#55685F" },
  { titulo: "Finanças em Dia", tema: "Finanças pessoais", preco: 39, cor: "#8A6A2B" },
  { titulo: "Foco para Estudar", tema: "Estudos", preco: 29, cor: "#3F5B7A" },
] as const;

export const temaReal = { nome: "Desenvolvimento de software", slug: "desenvolvimento-de-software" } as const;
