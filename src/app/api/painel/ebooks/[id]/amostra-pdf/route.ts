import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db, schema } from "@/db";
import { erro } from "@/lib/api";
import { conferirPdf } from "@/lib/imagens";
import { guardarPdf } from "@/lib/midia";
import { exigirEdicaoPeloId } from "@/lib/painel-api";

type Ctx = RouteContext<"/api/painel/ebooks/[id]/amostra-pdf">;

// PDF de amostra: PÚBLICO (quem pede recebe o link). Só páginas de amostra, nunca o livro inteiro.
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const acesso = await exigirEdicaoPeloId(req, id);
  if (acesso instanceof Response) return acesso;
  const arquivo = (await req.formData().catch(() => null))?.get("arquivo");
  if (!(arquivo instanceof File)) return erro("Escolha o PDF de amostra.", 422);
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const problema = conferirPdf(bytes, 15 * 1024 * 1024);
  if (problema) return erro(problema, 422);
  const chave = guardarPdf(id, bytes);
  db.update(schema.ebook).set({ amostraPdf: chave, atualizadoEm: new Date() }).where(eq(schema.ebook.id, id)).run();
  revalidateTag("ebooks", { expire: 0 });
  return Response.json({ amostraPdf: `/m/${chave}` });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const acesso = await exigirEdicaoPeloId(req, id);
  if (acesso instanceof Response) return acesso;
  db.update(schema.ebook).set({ amostraPdf: null, atualizadoEm: new Date() }).where(eq(schema.ebook.id, id)).run();
  revalidateTag("ebooks", { expire: 0 });
  return Response.json({ ok: true });
}
