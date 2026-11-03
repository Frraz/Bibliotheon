import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { camposDoEditor, checklistDePublicacao, lojasSemLinkDaCampanha, problemaNoSlug, slugDoTitulo, type DadosDoEditor } from "./editor";
import { hojeSP } from "./metricas";
import { ehOwner, type Quem } from "./permissoes";

// Leitura e gravação do e-book pelo painel. Quem chama já conferiu a sessão e `podeEditar` (src/lib/acesso.ts, permissoes.ts).

const { ebook, oferta, amostra, tema, user, metricaDiaria } = schema;

export const LIMITE_AMOSTRAS = 8;

export function criarRascunho(ownerId: string, titulo: string) {
  const slug = slugDoTitulo(titulo, (s) => !!db.select({ id: ebook.id }).from(ebook).where(eq(ebook.slug, s)).get());
  const id = crypto.randomUUID();
  db.insert(ebook).values({ id, ownerId, titulo: titulo.trim(), slug, status: "rascunho", formatos: ["PDF"] }).run();
  return { id, slug };
}

export function carregarEbook(id: string) {
  const e = db.select().from(ebook).where(eq(ebook.id, id)).get();
  if (!e) return null;
  return {
    e,
    ofertas: db.select().from(oferta).where(eq(oferta.ebookId, id)).orderBy(asc(oferta.ordem)).all(),
    amostras: db.select().from(amostra).where(eq(amostra.ebookId, id)).orderBy(asc(amostra.ordem)).all(),
    temas: db.select().from(tema).orderBy(asc(tema.ordem), asc(tema.nome)).all(),
    dono: e.ownerId ? (db.select({ nome: user.name }).from(user).where(eq(user.id, e.ownerId)).get()?.nome ?? null) : null,
  };
}

/** Quanto falta para publicar, calculado sobre o que está salvo (ou sobre o que está para ser salvo). */
export function estadoParaPublicar(e: typeof ebook.$inferSelect, temaEscolhido: { nome: string; publicado: boolean } | null) {
  return checklistDePublicacao({ ...e, temaNoAr: temaEscolhido ? temaEscolhido.publicado : null, temaNome: temaEscolhido?.nome });
}

export type ResultadoGravacao = { ok: true; status: "rascunho" | "publicado"; slug: string; faltam: string[]; publicou: boolean } | { ok: false; erro: string };

/**
 * Grava o editor. `acao`: "salvar" mantém o status; "publicar" publica se o checklist estiver completo (se não, salva como
 * está e devolve o que falta). Um e-book já publicado nunca é salvo incompleto: a página no ar não pode piorar por descuido.
 */
export function gravarEbook(id: string, d: DadosDoEditor, acao: "salvar" | "publicar"): ResultadoGravacao {
  const atual = db.select().from(ebook).where(eq(ebook.id, id)).get();
  if (!atual) return { ok: false, erro: "E-book não encontrado." };

  // Endereço: livre até a primeira publicação; depois, travado (protege links, buscas e a landing personalizada).
  const slug = atual.publicadoEm ? atual.slug : (d.slug ?? atual.slug);
  const problema = problemaNoSlug(slug);
  if (problema) return { ok: false, erro: problema };
  if (db.select({ id: ebook.id }).from(ebook).where(and(eq(ebook.slug, slug), ne(ebook.id, id))).get()) return { ok: false, erro: "Esse endereço já está em uso por outro e-book." };

  const temaEscolhido = d.temaId ? db.select().from(tema).where(eq(tema.id, d.temaId)).get() : null;
  if (d.temaId && !temaEscolhido) return { ok: false, erro: "O tema escolhido não existe mais." };

  const campos = camposDoEditor(d);
  const depois = { ...atual, ...campos, slug } as typeof ebook.$inferSelect;
  const lojas = d.lojas.map((l) => ({ plataforma: l.plataforma, urlPromo: l.urlPromo, ativa: l.ativa }));
  const semLink = lojasSemLinkDaCampanha(lojas, depois, new Date());
  if (semLink.length) return { ok: false, erro: `Campanha sem o link do checkout com o preço da campanha em: ${semLink.map((l) => l.plataforma).join(", ")}. Sem ele a página mostraria um preço e o checkout cobraria outro.` };
  if (d.campanha?.fim && d.campanha.fim <= new Date()) return { ok: false, erro: "O prazo da campanha já passou: escolha uma data futura ou desligue a campanha." };

  const checklist = estadoParaPublicar(depois, temaEscolhido ?? null);
  if (atual.status === "publicado" && checklist.faltam.length) return { ok: false, erro: `Não salvei, porque a página está no ar e ficaria incompleta. Falta: ${checklist.faltam.join(", ")}.` };

  const publicar = acao === "publicar" && checklist.faltam.length === 0;
  const agora = new Date();
  db.transaction((tx) => {
    tx.update(ebook)
      .set({ ...campos, slug, atualizadoEm: agora, ...(publicar ? { status: "publicado" as const, publicadoEm: atual.publicadoEm ?? agora } : {}) })
      .where(eq(ebook.id, id))
      .run();

    // Lojas: atualiza por id (o /ir e os contadores continuam valendo), cria as novas e apaga as retiradas.
    const existentes = tx.select().from(oferta).where(eq(oferta.ebookId, id)).all();
    const ids = new Set(existentes.map((o) => o.id));
    const mantidas = new Set<string>();
    const primeiraAtiva = d.lojas.findIndex((l) => l.ativa);
    d.lojas.forEach((l, ordem) => {
      const valores = { plataforma: l.plataforma, url: l.url, urlPromo: l.urlPromo, ativa: l.ativa, ordem, principal: ordem === primeiraAtiva };
      if (l.id && ids.has(l.id)) {
        tx.update(oferta).set(valores).where(eq(oferta.id, l.id)).run();
        mantidas.add(l.id);
      } else {
        tx.insert(oferta).values({ ebookId: id, ...valores }).run();
      }
    });
    for (const o of existentes) if (!mantidas.has(o.id)) tx.delete(oferta).where(eq(oferta.id, o.id)).run();
  });

  const status = publicar ? "publicado" : atual.status === "revisao" ? "rascunho" : atual.status;
  return { ok: true, status, slug, faltam: acao === "publicar" ? checklist.faltam : [], publicou: publicar && atual.status !== "publicado" };
}

export function despublicar(id: string) {
  db.update(ebook).set({ status: "rascunho", atualizadoEm: new Date() }).where(eq(ebook.id, id)).run();
}

/** Data de 6 dias atrás: a janela de "últimos 7 dias" inclui hoje. */
function inicioDaJanela(dias = 7) {
  const d = new Date(`${hojeSP()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (dias - 1));
  return d.toISOString().slice(0, 10);
}

/** Lista do painel. A consulta já nasce filtrada pelo dono quando a pessoa não é administradora. */
export function listarEbooks(quem: Quem) {
  return db
    .select({
      id: ebook.id,
      titulo: ebook.titulo,
      slug: ebook.slug,
      status: ebook.status,
      capa: ebook.capa,
      capaAlt: ebook.capaAlt,
      temPdf: sql<number>`${ebook.pdfPrivado} is not null`,
      dono: user.name,
      visitas: sql<number>`coalesce(sum(case when ${metricaDiaria.ofertaId} = '' then ${metricaDiaria.contagem} end), 0)`,
      cliques: sql<number>`coalesce(sum(case when ${metricaDiaria.ofertaId} <> '' then ${metricaDiaria.contagem} end), 0)`,
    })
    .from(ebook)
    .leftJoin(user, eq(ebook.ownerId, user.id))
    .leftJoin(metricaDiaria, and(eq(metricaDiaria.ebookId, ebook.id), sql`${metricaDiaria.data} >= ${inicioDaJanela()}`))
    .where(ehOwner(quem) ? undefined : eq(ebook.ownerId, quem.id))
    .groupBy(ebook.id)
    .orderBy(desc(ebook.atualizadoEm))
    .all();
}
