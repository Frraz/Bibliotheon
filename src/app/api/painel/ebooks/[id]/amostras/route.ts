import { and, asc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { erro } from "@/lib/api";
import { LIMITE_AMOSTRAS } from "@/lib/ebooks";
import { prepararImagem } from "@/lib/imagens";
import { guardarBytes } from "@/lib/midia";
import { exigirEdicaoPeloId } from "@/lib/painel-api";

const { amostra } = schema;
type Ctx = RouteContext<"/api/painel/ebooks/[id]/amostras">;

// Páginas de amostra (imagens públicas). Cada operação vale na hora, sem esperar o "Salvar" do texto.
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const acesso = await exigirEdicaoPeloId(req, id);
  if (acesso instanceof Response) return acesso;

  const arquivos = ((await req.formData().catch(() => null))?.getAll("arquivo") ?? []).filter((a): a is File => a instanceof File);
  if (!arquivos.length) return erro("Escolha pelo menos uma imagem.", 422);
  const existentes = db.select().from(amostra).where(eq(amostra.ebookId, id)).orderBy(asc(amostra.ordem)).all();
  if (existentes.length + arquivos.length > LIMITE_AMOSTRAS) return erro(`O limite é de ${LIMITE_AMOSTRAS} páginas de amostra. Já há ${existentes.length}.`, 422);

  const prontas = [];
  for (const [n, a] of arquivos.entries()) {
    const img = await prepararImagem(Buffer.from(await a.arrayBuffer()), { larguraMinima: 600 });
    if (!img.ok) return erro(arquivos.length > 1 ? `Imagem ${n + 1}: ${img.erro}` : img.erro, 422);
    prontas.push(img);
  }
  const base = existentes.length;
  prontas.forEach((img, n) =>
    db.insert(amostra).values({ ebookId: id, imagem: guardarBytes(id, img.bytes, img.ext), alt: `Página de amostra de ${acesso.e.titulo}`, ordem: base + n }).run(),
  );
  revalidateTag("ebooks", { expire: 0 });
  return Response.json({ total: base + prontas.length });
}

/** Reordena: recebe a lista completa de ids, na nova ordem. */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const acesso = await exigirEdicaoPeloId(req, id);
  if (acesso instanceof Response) return acesso;
  const corpo = z.object({ ordem: z.array(z.string()) }).safeParse(await req.json().catch(() => null));
  if (!corpo.success) return erro("Ordem inválida.", 422);
  const atuais = db.select({ id: amostra.id }).from(amostra).where(eq(amostra.ebookId, id)).all().map((a) => a.id);
  if (corpo.data.ordem.length !== atuais.length || !corpo.data.ordem.every((x) => atuais.includes(x))) return erro("A lista não confere com as páginas do e-book.", 422);
  db.transaction((tx) => corpo.data.ordem.forEach((aid, n) => tx.update(amostra).set({ ordem: n }).where(and(eq(amostra.id, aid), eq(amostra.ebookId, id))).run()));
  revalidateTag("ebooks", { expire: 0 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const acesso = await exigirEdicaoPeloId(req, id);
  if (acesso instanceof Response) return acesso;
  const aid = new URL(req.url).searchParams.get("amostra");
  if (!aid) return erro("Informe a página.", 422);
  db.delete(amostra).where(and(eq(amostra.id, aid), eq(amostra.ebookId, id))).run();
  // Fecha o buraco na numeração.
  const restantes = db.select({ id: amostra.id }).from(amostra).where(eq(amostra.ebookId, id)).orderBy(asc(amostra.ordem)).all();
  db.transaction((tx) => restantes.forEach((a, n) => tx.update(amostra).set({ ordem: n }).where(eq(amostra.id, a.id)).run()));
  revalidateTag("ebooks", { expire: 0 });
  return Response.json({ total: restantes.length });
}
