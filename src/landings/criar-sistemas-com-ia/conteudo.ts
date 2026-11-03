// Textos próprios desta página, copiados do manuscrito da 2ª edição
// (../ebooks/ebooks/001-sistemas-com-ia/manuscrito/pt-BR: etapa-1..5 e 05-planejar-com-ia.md).
// O restante da página vem do painel (e.*). e2e/landing-personalizada.spec.ts confere estes textos contra o manuscrito.

export type Etapa = {
  nome: string;
  resumo: string;
  linhas: { capitulo: string; faz: string; pronto: string }[];
  terminou: string;
};

export const ETAPAS: Etapa[] = [
  {
    nome: "Ideia",
    resumo: "Todo sistema começa numa necessidade, e não numa ferramenta.",
    linhas: [
      { capitulo: "1", faz: "Perde o medo dos termos técnicos", pronto: "Vocabulário para acompanhar o resto" },
      { capitulo: "2", faz: "Prepara Windows 11, Ubuntu ou macOS", pronto: "Ambiente de estudo funcionando" },
      { capitulo: "3", faz: "Usa a IA dentro do editor", pronto: "Primeira conversa guardada em arquivo" },
      { capitulo: "4", faz: "Entende o processo e os limites", pronto: "Objetivo escrito do que vai e do que não vai construir" },
    ],
    terminou: "o editor abre a sua pasta, a IA responde dentro dele e você consegue explicar, em duas frases, o que vai construir e o que ficará de fora.",
  },
  {
    nome: "Planejamento",
    resumo: "Pedir código sem plano é o caminho mais rápido para gastar tempo.",
    linhas: [
      { capitulo: "5", faz: "Escreve regras verificáveis", pronto: "Requisitos ligados a testes" },
      { capitulo: "6", faz: "Planeja com a IA e guarda o resultado", pronto: "Arquivos de ideia, contexto e progresso" },
      { capitulo: "7", faz: "Entende banco, servidor e interface", pronto: "Mapa das peças do sistema" },
      { capitulo: "8", faz: "Aprende o básico para ler o que a IA escreve", pronto: "Capacidade de reconhecer uma resposta ruim" },
    ],
    terminou: "tem, numa pasta, a ideia, os requisitos, o contexto e o plano, e consegue dizer, para cada regra, como ela será conferida.",
  },
  {
    nome: "Desenvolvimento",
    resumo: "Agora o sistema nasce, por fases, com testes e histórico.",
    linhas: [
      { capitulo: "9", faz: "Constrói da pasta vazia à primeira ordem de serviço", pronto: "Primeira função funcionando" },
      { capitulo: "10", faz: "Executa o sistema pequeno do início ao fim", pronto: "Fluxo completo com dados fictícios" },
      { capitulo: "11", faz: "Desenvolve com a IA sem perder o controle", pronto: "Método de trabalho por fases" },
      { capitulo: "12", faz: "Testa regras, acessos e falhas", pronto: "Testes que provam as recusas" },
      { capitulo: "13", faz: "Guarda o histórico e envia ao GitHub", pronto: "Repositório com versões" },
    ],
    terminou: "o sistema roda no seu computador com gerente e técnico, os testes passam, inclusive os que provam que um técnico não vê a ordem de outro, e o histórico está guardado.",
  },
  {
    nome: "Deploy",
    resumo: "Um sistema que só funciona no seu computador não resolve o problema de ninguém.",
    linhas: [
      { capitulo: "14", faz: "Prepara uma VPS de homologação", pronto: "Servidor seguro para testes" },
      { capitulo: "15", faz: "Registra o domínio e configura o endereço", pronto: "Nome apontando para o servidor" },
      { capitulo: "16", faz: "Configura, sobe e valida o ambiente", pronto: "Sistema acessível por HTTPS" },
      { capitulo: "17", faz: "Faz cópia, restauração e atualização", pronto: "Rotina que você já ensaiou" },
      { capitulo: "18", faz: "Passa o sistema para a conta do cliente", pronto: "Entrega com acessos do cliente" },
    ],
    terminou: "o sistema responde por HTTPS em ambiente de teste, a recuperação de senha chega por e-mail, uma cópia foi restaurada com sucesso e uma atualização com retorno foi ensaiada.",
  },
  {
    nome: "Venda",
    resumo: "Construir é metade do caminho. A outra metade é descobrir uma necessidade que merece um sistema.",
    linhas: [
      { capitulo: "19", faz: "Descobre a necessidade", pronto: "Resumo que o responsável confirma" },
      { capitulo: "20", faz: "Calcula preço e monta a proposta", pronto: "Proposta com escopo, aceite e marcos" },
      { capitulo: "21", faz: "Entrega e combina o depois", pronto: "Passagem e suporte acordados" },
      { capitulo: "22", faz: "Aplica o método a outro problema", pronto: "Segundo sistema de estudo" },
      { capitulo: "23", faz: "Monta a oferta", pronto: "Oferta de uma página, em degraus" },
      { capitulo: "24", faz: "Procura os primeiros clientes", pronto: "Lista de contatos, roteiros e funil" },
      { capitulo: "25", faz: "Planeja 30 dias", pronto: "Plano até a primeira proposta" },
    ],
    terminou: "tem uma proposta preenchida com condições reais, uma oferta de uma página e um plano de 30 dias. Nada disso garante contratação; garante que você chegará à conversa preparado.",
  },
];

// Capítulo 6, "Um primeiro pedido útil no ChatGPT". A Oficina Clara é um exemplo fictício do livro.
export const PRIMEIRO_PEDIDO = [
  "Ajude a planejar a Oficina Clara, exemplo fictício de ordens de serviço.",
  "Sou iniciante. Explique termos antes de usá-los.",
  "Gerente cria e vê todas as ordens; técnico só vê as próprias.",
  "Estados: aberta, andamento, concluída, sem pular nem reabrir.",
  "Primeira versão online, uma empresa por instalação, sem pagamentos.",
  "Organize requisitos, dados, permissões, dúvidas e critérios de aceite.",
  "Separe fatos fornecidos de hipóteses. Não escreva código ainda.",
  "Não acrescente integrações, custos ou promessas sem justificar.",
];

export const CONFERIR = [
  "Se a resposta preserva as regras e as exclusões que você pediu.",
  "Se a IA acrescentar estoque, recuse ou registre como evolução.",
  "Se responder “segurança robusta”, peça controles e testes específicos.",
];
