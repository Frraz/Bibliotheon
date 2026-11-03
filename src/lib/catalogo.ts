import { and, asc, desc, eq, ne } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema } from "@/db";
import type { Plataforma } from "@/db/schema";
import { precoVigente } from "./preco";

// Leituras públicas. Todas em `use cache` + cacheTag: o painel/API chamam revalidateTag("ebooks") ou
// revalidateTag(`ebook:${slug}`) ao gravar, e a página nova aparece na hora. Nada aqui devolve Date
// (serialização de cache): datas viram ISO. Só entra o que está publicado.

const { ebook, tema, amostra, oferta } = schema;
const publicado = () => eq(ebook.status, "publicado");

export type OfertaPublica = { id: string; plataforma: Plataforma; rotulo: string | null; preco: number | null; principal: boolean };
export type EbookPublico = {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  headline: string | null;
  resumo: string | null;
  problema: string | null;
  descricao: string | null;
  dores: string[];
  beneficios: string[];
  diferenciais: string[];
  paraQuem: string[];
  naoEPara: string[];
  incluido: string[];
  observacoes: string | null;
  autorExibido: string | null;
  formatos: string[];
  sumario: string[];
  faq: { p: string; r: string }[];
  capa: string | null;
  capaAlt: string | null;
  figura: { src: string; alt: string; legenda: string | null } | null;
  amostras: { src: string; alt: string }[];
  amostraPdf: string | null;
  garantiaDias: number;
  emBreve: boolean;
  preco: number | null;
  precoDe: number | null;
  ofertaAte: string | null;
  ofertaNome: string | null;
  parcelamento: string | null;
  /** Preço vigente no momento em que o cache foi preenchido; o navegador recalcula ao abrir. */
  vigente: { valor: number | null; riscado: number | null; ate: string | null; emOferta: boolean };
  ofertas: OfertaPublica[];
  tema: { nome: string; slug: string } | null;
  seoTitle: string | null;
  seoDescription: string | null;
  metaPixelId: string | null;
  publicadoEm: string | null;
  atualizadoEm: string;
};

export type CartaoEbook = {
  slug: string;
  titulo: string;
  subtitulo: string | null;
  capa: string | null;
  capaAlt: string | null;
  tema: string | null;
  vigente: EbookPublico["vigente"];
  emBreve: boolean;
  destaque: boolean;
  /** ISO. Alimenta o `lastmod` do sitemap. */
  atualizadoEm: string;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const midia = (chave: string | null) => (chave ? `/m/${chave}` : null);

function vigenteSerial(e: { preco: number | null; precoDe: number | null; ofertaAte: Date | null; emBreve: boolean }) {
  const v = precoVigente(e, new Date());
  return { ...v, ate: iso(v.ate) };
}

function temaVisivel(t: { publicado: boolean } | null) {
  return t === null || t.publicado;
}

export async function getEbook(slug: string): Promise<EbookPublico | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("ebooks", `ebook:${slug}`);

  const linha = db
    .select({ e: ebook, t: tema })
    .from(ebook)
    .leftJoin(tema, eq(ebook.temaId, tema.id))
    .where(and(eq(ebook.slug, slug), publicado()))
    .get();
  if (!linha || !temaVisivel(linha.t)) return null;
  const { e, t } = linha;

  return montarEbookPublico(e, t);
}

/** Monta o e-book como a landing o consome. Serve ao getEbook (só publicado, em cache) e à prévia do painel (qualquer status, sem cache). */
export function montarEbookPublico(e: typeof ebook.$inferSelect, t: typeof tema.$inferSelect | null): EbookPublico {
  const amostras = db.select().from(amostra).where(eq(amostra.ebookId, e.id)).orderBy(asc(amostra.ordem)).all();
  const ofertas = db
    .select()
    .from(oferta)
    .where(and(eq(oferta.ebookId, e.id), eq(oferta.ativa, true)))
    .orderBy(desc(oferta.principal), asc(oferta.ordem))
    .all();

  return {
    id: e.id,
    slug: e.slug,
    titulo: e.titulo,
    subtitulo: e.subtitulo,
    headline: e.headline,
    resumo: e.resumo,
    problema: e.problema,
    descricao: e.descricao,
    dores: e.dores,
    beneficios: e.beneficios,
    diferenciais: e.diferenciais,
    paraQuem: e.paraQuem,
    naoEPara: e.naoEPara,
    incluido: e.incluido,
    observacoes: e.observacoes,
    autorExibido: e.autorExibido,
    formatos: e.formatos,
    sumario: e.sumario,
    faq: e.faq,
    capa: midia(e.capa),
    capaAlt: e.capaAlt,
    figura: e.figura ? { src: midia(e.figura)!, alt: e.figuraAlt ?? "", legenda: e.figuraLegenda } : null,
    amostras: amostras.map((a) => ({ src: midia(a.imagem)!, alt: a.alt ?? "" })),
    amostraPdf: midia(e.amostraPdf),
    garantiaDias: e.garantiaDias,
    emBreve: e.emBreve || ofertas.length === 0,
    preco: e.preco,
    precoDe: e.precoDe,
    ofertaAte: iso(e.ofertaAte),
    ofertaNome: e.ofertaNome,
    parcelamento: e.parcelamento,
    vigente: vigenteSerial({ ...e, emBreve: e.emBreve || ofertas.length === 0 }),
    ofertas: ofertas.map((o) => ({ id: o.id, plataforma: o.plataforma, rotulo: o.rotulo, preco: o.preco, principal: o.principal })),
    tema: t ? { nome: t.nome, slug: t.slug } : null,
    seoTitle: e.seoTitle,
    seoDescription: e.seoDescription,
    metaPixelId: e.metaPixelId,
    publicadoEm: iso(e.publicadoEm),
    atualizadoEm: e.atualizadoEm.toISOString(),
  };
}

function cartoes(linhas: { e: typeof ebook.$inferSelect; t: typeof tema.$inferSelect | null }[]): CartaoEbook[] {
  return linhas
    .filter(({ t }) => temaVisivel(t))
    .map(({ e, t }) => ({
      slug: e.slug,
      titulo: e.titulo,
      subtitulo: e.subtitulo,
      capa: midia(e.capa),
      capaAlt: e.capaAlt,
      tema: t?.nome ?? null,
      vigente: vigenteSerial(e),
      emBreve: e.emBreve,
      destaque: e.destaque,
      atualizadoEm: e.atualizadoEm.toISOString(),
    }));
}

export async function listarCatalogo(): Promise<CartaoEbook[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("ebooks");
  const linhas = db
    .select({ e: ebook, t: tema })
    .from(ebook)
    .leftJoin(tema, eq(ebook.temaId, tema.id))
    .where(publicado())
    .orderBy(desc(ebook.destaque), desc(ebook.publicadoEm))
    .all();
  return cartoes(linhas);
}

export async function listarDoTema(temaSlug: string, exceto?: string): Promise<CartaoEbook[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("ebooks", `tema:${temaSlug}`);
  const linhas = db
    .select({ e: ebook, t: tema })
    .from(ebook)
    .innerJoin(tema, eq(ebook.temaId, tema.id))
    .where(and(publicado(), eq(tema.slug, temaSlug), eq(tema.publicado, true), exceto ? ne(ebook.slug, exceto) : undefined))
    .orderBy(desc(ebook.publicadoEm))
    .all();
  return cartoes(linhas);
}

export type TemaPublico = { nome: string; slug: string; descricao: string | null; total: number };

export async function listarTemas(): Promise<TemaPublico[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("ebooks", "temas");
  const temas = db.select().from(tema).where(eq(tema.publicado, true)).orderBy(asc(tema.ordem), asc(tema.nome)).all();
  return temas
    .map((t) => ({
      nome: t.nome,
      slug: t.slug,
      descricao: t.descricao,
      total: db.select({ id: ebook.id }).from(ebook).where(and(eq(ebook.temaId, t.id), publicado())).all().length,
    }))
    .filter((t) => t.total > 0);
}

export async function getTema(slug: string): Promise<TemaPublico | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("ebooks", "temas", `tema:${slug}`);
  const t = db.select().from(tema).where(and(eq(tema.slug, slug), eq(tema.publicado, true))).get();
  if (!t) return null;
  const total = db.select({ id: ebook.id }).from(ebook).where(and(eq(ebook.temaId, t.id), publicado())).all().length;
  return total ? { nome: t.nome, slug: t.slug, descricao: t.descricao, total } : null;
}

// --- Parâmetros estáticos (rodam no build; o banco pode não existir ainda, então nunca quebram) ---
// O Next exige ao menos um conjunto de parâmetros para `ensureStatic`: o slug "_" é um sentinela que vira 404.
export const SENTINELA = "_";

export function slugsDosEbooks(): string[] {
  try {
    const s = db.select({ slug: ebook.slug }).from(ebook).where(publicado()).all().map((x) => x.slug);
    return s.length ? s : [SENTINELA];
  } catch {
    return [SENTINELA];
  }
}

export function slugsDosTemas(): string[] {
  try {
    const s = db.select({ slug: tema.slug }).from(tema).where(eq(tema.publicado, true)).all().map((x) => x.slug);
    return s.length ? s : [SENTINELA];
  } catch {
    return [SENTINELA];
  }
}
