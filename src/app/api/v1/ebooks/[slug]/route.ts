import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db, schema } from "@/db";
import { autorizado, erro, naoAutorizado } from "@/lib/api";
import { ajusteDeVenda, camposDeVenda } from "@/lib/manifesto";
import { ofertasSemLinkPromo } from "@/lib/ofertas";

const { ebook, oferta } = schema;
const centavos = (v: number) => Math.round(v * 100);

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
      const existentes = tx.select().from(oferta).where(eq(oferta.ebookId, atual.id)).all();
      for (const o of offers ?? []) {
        const existente = existentes.find((x) => x.plataforma === o.platform);
        const dados = {
          ...(o.url !== undefined ? { url: o.url } : {}),
          ...(o.promoUrl !== undefined ? { urlPromo: o.promoUrl } : {}),
          ...(o.price !== undefined ? { preco: o.price === null ? null : centavos(o.price) } : {}),
          ...(o.primary !== undefined ? { principal: o.primary } : {}),
          ...(o.label !== undefined ? { rotulo: o.label } : {}),
        };
        if (o.primary) tx.update(oferta).set({ principal: false }).where(eq(oferta.ebookId, atual.id)).run();
        if (existente) {
          if (Object.keys(dados).length) tx.update(oferta).set(dados).where(eq(oferta.id, existente.id)).run();
        } else if (o.url) {
          tx.insert(oferta).values({ ebookId: atual.id, plataforma: o.platform, ordem: existentes.length, ...dados, url: o.url }).run();
        } else {
          throw new Error(`Não existe oferta em ${o.platform}: informe a url para criá-la.`);
        }
      }

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
