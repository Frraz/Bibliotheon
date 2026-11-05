import { and, eq } from "drizzle-orm";
import { SITE_URL } from "@/lib/site";
import { revalidateTag } from "next/cache";
import { db, schema } from "@/db";
import { autorizado, erro, naoAutorizado } from "@/lib/api";
import { ajusteDeVenda, camposDeVenda } from "@/lib/manifesto";
import { ofertasSemLinkPromo } from "@/lib/ofertas";
import { aplicarOfertas } from "@/lib/publicar-manifesto";

const { ebook, oferta } = schema;

// Ajusta preço, campanha, textos e links de um e-book em produção sem trocar o banco (as métricas ficam).
// As ofertas são atualizadas por plataforma, e não recriadas, para os links /ir e os contadores continuarem valendo.
export async function PATCH(req: Request, ctx: RouteContext<"/api/v1/ebooks/[slug]">) {
  if (!autorizado(req)) return naoAutorizado();
  const { slug } = await ctx.params;
  const atual = db.select().from(ebook).where(eq(ebook.slug, slug)).get();
  if (!atual) return erro("E-book não encontrado.", 404);

  const lido = ajusteDeVenda.safeParse(await req.json().catch(() => null));
  if (!lido.success) return erro("Ajuste inválido.", 422, lido.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  const { book, offers } = lido.data;
  const campos = book ? camposDeVenda(book) : {};

  try {
    db.transaction((tx) => {
      if (Object.keys(campos).length) tx.update(ebook).set({ ...campos, atualizadoEm: new Date() }).where(eq(ebook.id, atual.id)).run();
      aplicarOfertas(tx, atual.id, offers ?? []);

      // Nunca deixar a página anunciar um preço que o checkout não cobra.
      const novo = tx.select().from(ebook).where(eq(ebook.id, atual.id)).get()!;
      const ativas = tx.select().from(oferta).where(eq(oferta.ebookId, atual.id)).all().filter((o) => o.ativa);
      const faltando = ofertasSemLinkPromo(ativas, novo, new Date());
      if (faltando.length) throw new Error(`Campanha sem link promocional em: ${faltando.map((o) => o.plataforma).join(", ")}. A página mostraria um preço e o checkout cobraria outro.`);
    });
  } catch (e) {
    return erro(e instanceof Error ? e.message : "Não foi possível gravar.", 422);
  }

  revalidateTag("ebooks", { expire: 0 });
  return Response.json({ slug, campos: Object.keys(campos), ofertas: (offers ?? []).map((o) => o.platform) });
}

// Consulta usada por `./bibliotheon consultar`: aceita o endereço ou o sourceId do livro (?idioma=, padrão pt-BR).
export async function GET(req: Request, ctx: RouteContext<"/api/v1/ebooks/[slug]">) {
  if (!autorizado(req)) return naoAutorizado();
  const { slug } = await ctx.params;
  const idioma = new URL(req.url).searchParams.get("idioma") ?? "pt-BR";
  const e =
    db.select().from(ebook).where(eq(ebook.slug, slug)).get() ??
    db.select().from(ebook).where(and(eq(ebook.sourceId, slug), eq(ebook.idioma, idioma))).get();
  if (!e) return erro("E-book não encontrado.", 404);
  const lojas = db.select().from(oferta).where(eq(oferta.ebookId, e.id)).all();
  return Response.json({
    id: e.id, slug: e.slug, status: e.status, url: `${SITE_URL}/${e.slug}`, atualizadoEm: e.atualizadoEm.toISOString(),
    ofertas: lojas.map((o) => ({ plataforma: o.plataforma, ativa: o.ativa, principal: o.principal, temLinkDaCampanha: !!o.urlPromo })),
  });
}
