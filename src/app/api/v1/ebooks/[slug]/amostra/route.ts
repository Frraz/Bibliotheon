import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db, schema } from "@/db";
import { autorizado, erro, naoAutorizado } from "@/lib/api";
import { guardarPdf } from "@/lib/midia";

const { ebook } = schema;
const LIMITE = 15 * 1024 * 1024;

// Envia o PDF de amostra (corpo = o arquivo). O PDF pago nunca passa por aqui: só a amostra.
export async function PUT(req: Request, ctx: RouteContext<"/api/v1/ebooks/[slug]/amostra">) {
  if (!autorizado(req)) return naoAutorizado();
  const { slug } = await ctx.params;
  const e = db.select({ id: ebook.id }).from(ebook).where(eq(ebook.slug, slug)).get();
  if (!e) return erro("E-book não encontrado.", 404);

  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length > LIMITE) return erro("Amostra acima de 15 MB.", 413);
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return erro("O arquivo não é um PDF.", 422);

  const chave = guardarPdf(e.id, bytes);
  db.update(ebook).set({ amostraPdf: chave, atualizadoEm: new Date() }).where(eq(ebook.id, e.id)).run();
  revalidateTag("ebooks", { expire: 0 });
  return Response.json({ slug, amostraPdf: `/m/${chave}` });
}
