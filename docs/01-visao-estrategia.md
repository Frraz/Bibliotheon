# 01 — Visão e estratégia

[Índice](../README.md) · [Requisitos](02-requisitos.md)

## Problema e resultado

Publicar e-books em plataformas não garante descoberta. Bibliotheon reúne ofertas, conteúdo e medição para que o proprietário consiga transformar interesse em compras e decidir onde investir seu tempo. O site é infraestrutura de uma operação comercial; crescimento depende da qualidade do produto, demanda, distribuição e oferta.

Públicos: visitantes com problemas específicos; interessados que solicitam amostras; compradores atendidos pela plataforma de venda; parceiros/afiliados; proprietário que opera o painel. O catálogo pode atender nichos diferentes, mas cada LP e campanha atende um público definido.

## O que aprimoramos da conversa

| Ideia original | Decisão adotada | Motivo |
|---|---|---|
| Muitos livros e nichos | Suportar todos; escolher um foco comercial inicial | Evitar diluição de 5–10 horas semanais, hipótese de disponibilidade a confirmar |
| Biblioteca como máquina de vendas | Catálogo + LP + distribuição + medição | Separar infraestrutura de aquisição |
| Vários checkouts | Oferta principal e alternativas; campanha afiliada vinculada ao destino | Clareza de compra e preservação do vínculo comercial |
| Automatizar produção de conteúdo | Cadastro e operação editorial manuais; nenhuma IA | Preferência expressa do usuário |
| Construir recursos poderosos | Stack integrada e entregas por fases | Reduzir manutenção em VPS compartilhada |
| Meta de vender muito | Buscar compras confirmadas e margem conhecida | Evitar métricas de vaidade e promessas de desempenho |

## Escopo e exclusões

Inclui catálogo, LP, CMS, artigos, amostras, contatos, campanhas, tarefas simples de divulgação, e-mail e relatórios próprios. As três plataformas têm links na fase 1 e conectores na fase 2.

Exclui marketplace de terceiros, múltiplos vendedores, SaaS multiempresa, assinatura, leitor, DRM, checkout, emissão fiscal, entrega de livros pagos, compra de tráfego automatizada, geração de conteúdo por IA e publicação automática em redes sociais. Ferramentas gratuitas e testes A/B são expansão, não bloqueiam o primeiro lançamento.

## Estratégia comercial

Cada livro deve apresentar um problema concreto, promessa limitada ao que entrega, público, diferenciação e prova do conteúdo (amostra/páginas reais). Benefícios não podem depender de renda garantida. Depoimentos só com origem e autorização registradas.

Priorizar candidatos com demanda observável, público acessível, qualidade do material, diferenciação e margem plausível. Registrar notas de 1 a 5 e evidências; a soma ajuda a ordenar, não prevê vendas. Escolher o primeiro produto disponível que reúna essas condições, sem inferir título a partir de outros projetos.

Uma campanha ativa tem: livro, público, hipótese, oferta, material gratuito, um canal prioritário, ações semanais e critério de revisão. Recomendar produtos relacionados somente dentro do interesse demonstrado. E-mail segmentado por tema, nunca catálogo inteiro por padrão.

## Orçamento e capacidade

VPS informada: Hostinger KVM 2, 2 vCPU, 8 GB RAM, 100 GB NVMe, compartilhada. Recursos livres e ocupação não foram medidos. Valores promocionais da VPS não entram no orçamento adicional de aproximadamente R$ 50/mês.

| Uso inicial | Política |
|---|---|
| Software do site/banco | Componentes sem mensalidade obrigatória |
| E-mail | Brevo gratuito, revalidar quota ao cadastrar conta |
| Anúncios | R$ 0 inicialmente |
| Backup externo | Primeira prioridade do orçamento; provedor e custo dependem de volume e conta disponíveis |
| Domínio | bibliotheon.com.br informado em 21/10/2026; renovação, DNS e TLS não verificados |
| Novos serviços | Somar recorrências antes de contratar; manter total adicional dentro do teto |

Não iniciar anúncios com dinheiro reservado a backup. Aumentos de investimento dependem de caixa recebido e margem estimada, incluindo reembolsos e custos conhecidos.

## Estados de evidência

- **Definido:** decisão aceita para implementação.
- **Hipótese:** escolha comercial a testar com observações.
- **Dependência externa:** conta, política, domínio, fornecedor ou recurso ainda não verificado.
- **Validado:** teste identificado, data, ambiente e resultado registrados.

Publicação editorial, integração homologada, implantação e vendas confirmadas são estados independentes. Data documental: 20/10/2026, America/Belem.
