// Conteúdo real do e-book 001, usado pelos protótipos visuais (Etapa 1).
// Fontes: ../ebooks/ebooks/001-sistemas-com-ia (manifest.json, oferta/pt-BR/kit-comercial.md, status.md).
// Preço, "de", prazo e plataformas são DADOS DE DEMONSTRAÇÃO: o preço real ainda não foi aprovado.

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
  problema:
    "Você tem uma ideia de sistema, mas não sabe por onde começar.",
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
  // --- demonstração (não são dados reais) ---
  preco: 79,
  precoDe: 99,
  ofertaAte: "2026-11-30T23:59:00-03:00",
  ofertas: [
    { plataforma: "Kiwify", principal: true },
    { plataforma: "Cakto", principal: false },
  ],
} as const;

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
