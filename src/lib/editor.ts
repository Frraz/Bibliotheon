import { z } from "zod";
import { PLATAFORMAS, type NovoEbook } from "@/db/schema";
import { slugify } from "./manifesto";
import { ofertasSemLinkPromo } from "./ofertas";

// Regras do editor do painel, todas puras (testadas em editor.test.ts): endereço, dinheiro, datas, formulário e checklist.
// Quem grava no banco é src/lib/ebooks.ts; quem confere o acesso é src/lib/acesso.ts.

// ---------- endereço (slug) ----------

/** Endereços que já são rotas do site: um e-book com um deles nunca seria alcançado (ou escondería a rota). */
export const SLUGS_RESERVADOS = ["admin", "painel", "entrar", "api", "ir", "m", "tema", "temas", "termos", "privacidade", "prototipo", "sitemap", "robots", "favicon", "_next", "_"];

/** Devolve a mensagem do problema, ou null se o endereço serve. */
export function problemaNoSlug(slug: string): string | null {
  if (slug.length < 3) return "O endereço precisa ter pelo menos 3 caracteres.";
  if (slug.length > 80) return "O endereço pode ter no máximo 80 caracteres.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "Use só letras minúsculas sem acento, números e hífen (ex.: meu-livro).";
  if (SLUGS_RESERVADOS.includes(slug)) return "Esse endereço é usado pelo site. Escolha outro.";
  return null;
}

/** Endereço livre a partir do título: acrescenta -2, -3… se já existir ou se o título der um endereço reservado. */
export function slugDoTitulo(titulo: string, existe: (slug: string) => boolean): string {
  let base = slugify(titulo) || "livro";
  if (base.length < 3 || SLUGS_RESERVADOS.includes(base)) base = `${base}-livro`;
  let candidato = base;
  for (let n = 2; existe(candidato); n++) candidato = `${base.slice(0, 76)}-${n}`;
  return candidato;
}

// ---------- dinheiro e datas ----------

/** "64,99" → 6499. Vazio → null. Inválido → NaN. Aceita "R$ 1.299,90" e "64.99". */
export function paraCentavos(texto: string | null | undefined): number | null {
  const t = (texto ?? "").replace(/R\$|\s/g, "");
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return NaN;
  const c = Math.round(parseFloat(normal) * 100);
  return c > 0 && c <= 1_000_000 ? c : NaN;
}

export const reais = (centavos: number | null | undefined) => (centavos == null ? "" : (centavos / 100).toFixed(2).replace(".", ","));

// O Brasil não tem horário de verão desde 2019: o fuso do negócio é fixo (-03:00). No banco tudo fica em UTC.
const FUSO = "-03:00";

/** Valor de <input type="datetime-local"> (hora de Brasília) → Date. */
export function dataLocalParaDate(valor: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(valor.trim());
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}:00${FUSO}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → valor de <input type="datetime-local"> em hora de Brasília. */
export function dateParaDataLocal(d: Date | null | undefined): string {
  if (!d) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// ---------- formulário ----------

export type DadosDoEditor = {
  titulo: string;
  slug: string | null;
  temaId: string | null;
  capaAlt: string;
  autorExibido: string;
  formatos: string[];
  headline: string;
  subtitulo: string;
  resumo: string;
  problema: string;
  descricao: string;
  dores: string[];
  beneficios: string[];
  diferenciais: string[];
  paraQuem: string[];
  naoEPara: string[];
  incluido: string[];
  observacoes: string;
  sumario: string[];
  faq: { p: string; r: string }[];
  precoNormal: number | null;
  garantiaDias: number;
  parcelamento: string;
  campanha: { nome: string; preco: number | null; fim: Date | null } | null;
  lojas: { id: string | null; plataforma: (typeof PLATAFORMAS)[number]; url: string; urlPromo: string | null; ativa: boolean }[];
  seoTitle: string;
  seoDescription: string;
};

const texto = (max: number, rotulo: string) => z.string().trim().max(max, `${rotulo}: no máximo ${max} caracteres.`);
const lista = (max: number, rotulo: string, itens = 40) =>
  z.array(z.string()).transform((a) => a.map((s) => s.trim()).filter(Boolean)).pipe(z.array(z.string().max(max, `${rotulo}: cada item pode ter no máximo ${max} caracteres.`)).max(itens, `${rotulo}: no máximo ${itens} itens.`));
const linkHttps = z.url({ protocol: /^https$/, error: "O link precisa começar com https://" });

const bruto = z.object({
  titulo: texto(140, "Título").min(2, "Escreva o título do livro."),
  slug: z.string().trim().toLowerCase().optional(),
  temaId: z.string().trim().optional(),
  capaAlt: texto(200, "Descrição da capa"),
  autorExibido: texto(120, "Autor"),
  formatos: z.string().default("").transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)).pipe(z.array(z.string().max(30)).max(8, "Formatos: no máximo 8.")),
  headline: texto(160, "Headline"),
  subtitulo: texto(300, "Subtítulo"),
  resumo: texto(400, "Resumo"),
  problema: texto(300, "Problema"),
  descricao: texto(8000, "Descrição"),
  dores: lista(500, "Situações"),
  beneficios: lista(300, "Benefícios"),
  diferenciais: lista(500, "Por que este caminho"),
  paraQuem: lista(300, "Para quem é"),
  naoEPara: lista(300, "Para quem não é"),
  incluido: lista(200, "Incluído"),
  observacoes: texto(3000, "Antes de comprar"),
  sumario: lista(200, "Capítulos", 80),
  faq: z.array(z.object({ p: z.string().trim().max(300), r: z.string().trim().max(2000) })).max(30),
  precoNormal: z.string().default(""),
  garantiaDias: z.string().default("7"),
  parcelamento: texto(120, "Parcelamento"),
  campanhaAtiva: z.boolean(),
  campanhaNome: texto(40, "Nome da campanha"),
  campanhaPreco: z.string().default(""),
  campanhaFim: z.string().default(""),
  lojas: z.array(z.object({ id: z.string().nullish(), plataforma: z.enum(PLATAFORMAS), url: z.string().trim(), urlPromo: z.string().trim().nullish(), ativa: z.boolean() })).max(12),
  seoTitle: texto(120, "Título para o Google"),
  seoDescription: texto(300, "Descrição para o Google"),
});

const json = (valor: FormDataEntryValue | null): unknown => {
  try {
    return JSON.parse(String(valor ?? "[]"));
  } catch {
    return null;
  }
};

/** Lê o formulário do editor. Devolve os dados limpos ou a lista de problemas, em português, para mostrar à pessoa. */
export function lerFormulario(fd: FormData): { dados: DadosDoEditor } | { erros: string[] } {
  // O navegador envia as quebras de linha de um <textarea> como \r\n; no banco fica sempre \n (os parágrafos dependem disso).
  const s = (k: string) => String(fd.get(k) ?? "").replace(/\r\n?/g, "\n");
  const lido = bruto.safeParse({
    titulo: s("titulo"), slug: s("slug"), temaId: s("temaId"), capaAlt: s("capaAlt"), autorExibido: s("autorExibido"), formatos: s("formatos"),
    headline: s("headline"), subtitulo: s("subtitulo"), resumo: s("resumo"), problema: s("problema"), descricao: s("descricao"),
    dores: json(fd.get("dores")), beneficios: json(fd.get("beneficios")), diferenciais: json(fd.get("diferenciais")), paraQuem: json(fd.get("paraQuem")),
    naoEPara: json(fd.get("naoEPara")), incluido: json(fd.get("incluido")), observacoes: s("observacoes"), sumario: json(fd.get("sumario")),
    faq: json(fd.get("faq")), precoNormal: s("precoNormal"), garantiaDias: s("garantiaDias"), parcelamento: s("parcelamento"),
    campanhaAtiva: fd.get("campanhaAtiva") === "1", campanhaNome: s("campanhaNome"), campanhaPreco: s("campanhaPreco"), campanhaFim: s("campanhaFim"),
    lojas: json(fd.get("lojas")), seoTitle: s("seoTitle"), seoDescription: s("seoDescription"),
  });
  if (!lido.success) return { erros: [...new Set(lido.error.issues.map((i) => i.message))] };
  const b = lido.data;
  const erros: string[] = [];

  const faq = b.faq.filter((f) => f.p || f.r);
  if (faq.some((f) => !f.p || !f.r)) erros.push("Perguntas frequentes: toda pergunta precisa de resposta, e toda resposta de pergunta.");

  const precoNormal = paraCentavos(b.precoNormal);
  if (Number.isNaN(precoNormal)) erros.push("Preço: use números, como 64,99.");
  const garantia = Number(b.garantiaDias);
  if (!Number.isInteger(garantia) || garantia < 0 || garantia > 90) erros.push("Garantia: informe de 0 a 90 dias.");

  let campanha: DadosDoEditor["campanha"] = null;
  if (b.campanhaAtiva) {
    const preco = paraCentavos(b.campanhaPreco);
    const fim = dataLocalParaDate(b.campanhaFim);
    if (!b.campanhaNome) erros.push("Campanha: dê um nome, como “Black Friday”.");
    if (preco === null || Number.isNaN(preco)) erros.push("Campanha: informe o preço da campanha, como 47,00.");
    if (precoNormal === null || Number.isNaN(precoNormal)) erros.push("Campanha: informe também o preço normal, que volta quando ela acabar.");
    else if (preco && !Number.isNaN(preco) && preco >= precoNormal) erros.push("Campanha: o preço da campanha precisa ser menor que o preço normal.");
    if (!fim) erros.push("Campanha: informe quando ela termina.");
    campanha = { nome: b.campanhaNome, preco: Number.isNaN(preco) ? null : preco, fim };
  }

  const lojas = b.lojas.map((l, n) => {
    const link = linkHttps.safeParse(l.url);
    if (!link.success) erros.push(`Loja ${n + 1}: ${l.url ? "o link precisa começar com https://" : "falta o link de compra."}`);
    if (l.urlPromo && !linkHttps.safeParse(l.urlPromo).success) erros.push(`Loja ${n + 1}: o link da campanha precisa começar com https://`);
    return { id: l.id || null, plataforma: l.plataforma, url: l.url, urlPromo: l.urlPromo || null, ativa: l.ativa };
  });

  const slug = b.slug || null;
  if (slug) {
    const p = problemaNoSlug(slug);
    if (p) erros.push(p);
  }
  if (erros.length) return { erros: [...new Set(erros)] };

  return {
    dados: {
      titulo: b.titulo, slug, temaId: b.temaId || null, capaAlt: b.capaAlt, autorExibido: b.autorExibido, formatos: b.formatos, headline: b.headline,
      subtitulo: b.subtitulo, resumo: b.resumo, problema: b.problema, descricao: b.descricao, dores: b.dores, beneficios: b.beneficios,
      diferenciais: b.diferenciais, paraQuem: b.paraQuem, naoEPara: b.naoEPara, incluido: b.incluido, observacoes: b.observacoes, sumario: b.sumario,
      faq, precoNormal, garantiaDias: garantia, parcelamento: b.parcelamento, campanha, lojas, seoTitle: b.seoTitle, seoDescription: b.seoDescription,
    },
  };
}

/** Campos do e-book gravados a partir do editor. Vazio vira null onde o banco aceita nulo. O endereço é tratado à parte (trava). */
export function camposDoEditor(d: DadosDoEditor): Partial<NovoEbook> {
  const v = (s: string) => s || null;
  return {
    titulo: d.titulo, temaId: d.temaId, capaAlt: v(d.capaAlt), autorExibido: v(d.autorExibido), formatos: d.formatos, headline: v(d.headline),
    subtitulo: v(d.subtitulo), resumo: v(d.resumo), problema: v(d.problema), descricao: v(d.descricao), dores: d.dores, beneficios: d.beneficios,
    diferenciais: d.diferenciais, paraQuem: d.paraQuem, naoEPara: d.naoEPara, incluido: d.incluido, observacoes: v(d.observacoes), sumario: d.sumario,
    faq: d.faq, garantiaDias: d.garantiaDias, parcelamento: v(d.parcelamento), seoTitle: v(d.seoTitle), seoDescription: v(d.seoDescription),
    // `preco` é o que se cobra agora (o da campanha, se houver); `precoDe` é o normal, que volta quando o prazo acaba.
    ...(d.campanha
      ? { preco: d.campanha.preco, precoDe: d.precoNormal, ofertaAte: d.campanha.fim, ofertaNome: d.campanha.nome }
      : { preco: d.precoNormal, precoDe: null, ofertaAte: null, ofertaNome: null }),
  };
}

/** Campanha que ainda não terminou: só ela é mostrada como ligada no editor. */
export const campanhaViva = (e: { ofertaAte: Date | null; precoDe: number | null }, agora = new Date()) => !!e.ofertaAte && e.ofertaAte > agora && e.precoDe != null;

/** Preço e campanha não podem ir ao ar sem o link de checkout da campanha em cada loja ativa (a página mostraria um preço e o checkout cobraria outro). */
export function lojasSemLinkDaCampanha(lojas: { plataforma: string; urlPromo: string | null; ativa: boolean }[], c: { preco: number | null; precoDe: number | null; ofertaAte: Date | null }, agora = new Date()) {
  return ofertasSemLinkPromo(lojas.filter((l) => l.ativa), c, agora);
}

// ---------- checklist ----------

export type EntradaChecklist = {
  titulo: string;
  slug: string;
  capa: string | null;
  capaAlt: string | null;
  headline: string | null;
  resumo: string | null;
  beneficios: string[];
  /** null = sem tema; false = tema escolhido ainda fora do ar (a página daria 404 mesmo "publicada"). */
  temaNoAr: boolean | null;
  temaNome?: string | null;
};

/** O que bloqueia a publicação. Sem loja não bloqueia: a página sai como "Em breve". */
export function checklistDePublicacao(e: EntradaChecklist) {
  const itens = [
    { t: "Capa", ok: !!e.capa },
    { t: "Descrição da capa", ok: !!e.capaAlt?.trim() },
    { t: "Título", ok: !!e.titulo.trim() },
    { t: "Headline", ok: !!e.headline?.trim() },
    { t: "Resumo", ok: !!e.resumo?.trim() },
    { t: "Pelo menos 3 benefícios", ok: e.beneficios.filter((b) => b.trim()).length >= 3 },
    { t: "Endereço válido", ok: problemaNoSlug(e.slug) === null },
    ...(e.temaNoAr === false ? [{ t: `Tema “${e.temaNome ?? ""}” fora do ar (escolha outro ou peça ao administrador)`, ok: false }] : []),
  ];
  return { itens, faltam: itens.filter((i) => !i.ok).map((i) => i.t) };
}

export type EntradaMelhorar = {
  dores: string[];
  diferenciais: string[];
  naoEPara: string[];
  faq: unknown[];
  sumario: string[];
  amostras: number;
  amostraPdf: string | null;
  preco: number | null;
  lojasAtivas: number;
};

/** O que melhora a venda mas não impede de publicar (padrão de venda, docs/04 seção 6). */
export function paraVenderMelhor(e: EntradaMelhorar): string[] {
  const a: string[] = [];
  if (e.lojasAtivas === 0) a.push("Sem loja ativa: a página aparece como “Em breve”, sem botão de compra.");
  else if (e.preco == null) a.push("Sem preço: a página aparece como “Em breve”.");
  if (!e.dores.length) a.push("Sem situações do leitor: a página não mostra a necessidade.");
  if (!e.diferenciais.length) a.push("Sem “por que este caminho”.");
  if (!e.naoEPara.length) a.push("Sem “não é para quem”: inclua o esforço exigido, reduz reembolso.");
  if (e.amostras < 3) a.push("Menos de 3 páginas de amostra: é a prova mais direta do livro.");
  if (!e.amostraPdf) a.push("Sem amostra em PDF.");
  if (!e.faq.length) a.push("Sem perguntas frequentes.");
  if (!e.sumario.length) a.push("Sem lista de capítulos.");
  return a;
}
