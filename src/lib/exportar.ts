import type { Amostra, Ebook, Oferta, Tema } from "@/db/schema";
import { NOME_PLATAFORMA } from "./ofertas";

// Exportação de um e-book cadastrado (rascunho ou publicado): base para criar a landing personalizada e cadastrar nas lojas.
// Função pura; a lista de campos é explícita para o local do PDF privado nunca sair daqui. O layout do .md acompanha
// o guia do Bibliotheon gerado em ../ebooks (motor/nucleo/guias.py). Limites das lojas: ../ebooks/docs/22-campos-das-plataformas.md.

export type EntradaExportacao = { e: Ebook; ofertas: Oferta[]; amostras: Amostra[]; tema: Pick<Tema, "nome" | "slug"> | null; dono: string | null; siteUrl: string };

const reais = (c: number | null) => (c == null ? null : (c / 100).toFixed(2));
const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function dadosExportados({ e, ofertas, amostras, tema, dono, siteUrl }: EntradaExportacao) {
  const url = (chave: string | null) => (chave ? `${siteUrl}/m/${chave}` : null);
  return {
    titulo: e.titulo,
    subtitulo: e.subtitulo,
    endereco: e.slug,
    pagina: `${siteUrl}/${e.slug}`,
    status: e.status,
    dono,
    tema: tema ? { nome: tema.nome, slug: tema.slug } : null,
    autorExibido: e.autorExibido,
    idioma: e.idioma,
    edicao: e.edicao,
    formatos: e.formatos,
    capa: url(e.capa),
    capaAlt: e.capaAlt,
    headline: e.headline,
    resumo: e.resumo,
    problema: e.problema,
    dores: e.dores,
    descricao: e.descricao,
    beneficios: e.beneficios,
    diferenciais: e.diferenciais,
    paraQuem: e.paraQuem,
    naoEPara: e.naoEPara,
    incluido: e.incluido,
    antesDeComprar: e.observacoes,
    sobreAutor: e.sobreAutor,
    sumario: e.sumario,
    faq: e.faq.map((f) => ({ pergunta: f.p, resposta: f.r })),
    amostras: amostras.map((a) => ({ imagem: url(a.imagem), alt: a.alt })),
    amostraPdf: url(e.amostraPdf),
    pdfDoLivro: e.pdfPrivado ? { nome: e.pdfNome, comoBaixar: "Painel: botão Baixar PDF" } : null,
    preco: reais(e.preco),
    precoDe: reais(e.precoDe),
    campanha: e.ofertaAte ? { nome: e.ofertaNome, termina: iso(e.ofertaAte) } : null,
    parcelamento: e.parcelamento,
    garantiaDias: e.garantiaDias,
    emBreve: e.emBreve,
    lojas: ofertas.map((o) => ({ plataforma: o.plataforma, nome: NOME_PLATAFORMA[o.plataforma], url: o.url, urlCampanha: o.urlPromo, preco: reais(o.preco), ativa: o.ativa, ordem: o.ordem })),
    seo: { titulo: e.seoTitle, descricao: e.seoDescription },
    publicadoEm: iso(e.publicadoEm),
    criadoEm: iso(e.criadoEm),
    atualizadoEm: iso(e.atualizadoEm),
  };
}

const campo = (rotulo: string, valor: string | number | string[] | null | undefined, nota = "") => {
  const texto = Array.isArray(valor) ? valor.join("\n") : valor == null ? "" : String(valor).trim();
  return `**${rotulo}**${nota ? ` — ${nota}` : ""}\n\`\`\`text\n${texto || "[vazio]"}\n\`\`\`\n`;
};

/** Cada valor num bloco copiável, na ordem do editor; depois, o que as lojas pedem, com o limite de cada uma. */
export function fichaMd(entrada: EntradaExportacao) {
  const d = dadosExportados(entrada);
  const descricao = d.descricao ?? "";
  const resumo = d.resumo ?? "";
  const notaKiwify = resumo.length >= 100 && resumo.length <= 500 ? `${resumo.length}/500` : `o resumo tem ${resumo.length} caracteres; a Kiwify pede de 100 a 500`;
  const notaHotmart = descricao.length > 2000 ? `tem ${descricao.length} caracteres; a Hotmart aceita até 2000: reduza` : `${descricao.length}/2000`;
  const l: string[] = [
    `# ${d.titulo}\n`,
    `Exportado do Bibliotheon. Status: **${d.status === "publicado" ? "publicado" : "rascunho"}**${d.dono ? ` · dono: ${d.dono}` : ""} · atualizado em ${d.atualizadoEm}\n`,
    "## Arquivos\n",
    `- Capa: ${d.capa ?? "[sem capa]"}`,
    ...d.amostras.map((a, n) => `- Amostra ${n + 1}: ${a.imagem}`),
    `- Amostra em PDF: ${d.amostraPdf ?? "[sem amostra]"}`,
    `- PDF do livro: ${d.pdfDoLivro ? `${d.pdfDoLivro.nome} (baixe pelo painel: Baixar PDF)` : "[não enviado]"}\n`,
    "## Essencial\n",
    campo("Título do livro", d.titulo),
    campo("Endereço da página", d.endereco, d.pagina),
    campo("Tema", d.tema?.nome),
    campo("Descrição da capa", d.capaAlt),
    campo("Autor exibido", d.autorExibido),
    campo("Formatos", d.formatos.join(", ")),
    "## Página de vendas\n",
    campo("Headline", d.headline),
    campo("Subtítulo", d.subtitulo),
    campo("Resumo", d.resumo),
    campo("O problema do leitor, em uma frase", d.problema),
    campo("Situações que ele reconhece", d.dores),
    campo("Descrição", d.descricao),
    campo("O que a pessoa vai aprender", d.beneficios),
    campo("Por que este caminho", d.diferenciais),
    campo("É para quem", d.paraQuem),
    campo("Não é para quem", d.naoEPara),
    campo("O que está incluído", d.incluido),
    campo("Antes de comprar", d.antesDeComprar),
    "## Conteúdo\n",
    campo("Capítulos", d.sumario),
    ...d.faq.flatMap((f, n) => [campo(`Pergunta ${n + 1}`, f.pergunta), campo(`Resposta ${n + 1}`, f.resposta)]),
    "## Preço e onde comprar\n",
    campo("Preço cobrado agora (R$)", d.preco),
    ...(d.campanha ? [campo("Preço normal, depois do prazo (R$)", d.precoDe), campo("Campanha", d.campanha.nome), campo("Termina em (UTC)", d.campanha.termina)] : []),
    campo("Parcelamento", d.parcelamento),
    campo("Garantia (dias)", d.garantiaDias),
    ...d.lojas.flatMap((o) => [campo(`Loja: ${o.nome}${o.ativa ? "" : " (inativa)"}`, o.url), ...(o.urlCampanha ? [campo(`Link da campanha: ${o.nome}`, o.urlCampanha)] : [])]),
    "## Google (SEO)\n",
    campo("Título para o Google", d.seo.titulo || `${d.titulo} | E-book`),
    campo("Descrição para o Google", d.seo.descricao || d.resumo),
    "## Para cadastrar nas lojas\n",
    "Campos vistos na tela em 03/11/2026. Imagem: Hotmart 600×600 (JPG ou PNG, até 5 MB); Kiwify e Cakto 300×250.\n",
    campo("Hotmart: Nome do produto", d.titulo),
    campo("Hotmart: Descrição", d.descricao, notaHotmart),
    campo("Hotmart: Página externa", d.pagina),
    campo("Kiwify: Nome do produto", d.titulo),
    campo("Kiwify: Descrição", d.resumo, notaKiwify),
    campo("Kiwify: Página de vendas", d.pagina),
    campo("Cakto: Nome do produto", d.titulo),
    campo("Cakto: Descrição", d.descricao, "mínimo de 100 caracteres"),
    campo("Cakto: Link da página de vendas", d.pagina),
    "Para ser encontrado: preencha a categoria em todas, as **Tags de busca** e a **Exibição no mercado** na Hotmart, e ligue o programa de afiliados nas três.\n",
  ];
  return l.join("\n");
}
