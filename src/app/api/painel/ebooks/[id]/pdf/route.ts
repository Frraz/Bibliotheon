import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { erro } from "@/lib/api";
import { conferirPdf } from "@/lib/imagens";
import { caminhoDoPdfPrivado, guardarPdfPrivado } from "@/lib/midia";
import { exigirEdicaoPeloId } from "@/lib/painel-api";

type Ctx = RouteContext<"/api/painel/ebooks/[id]/pdf">;
const LIMITE = 25 * 1024 * 1024;

// PDF completo do livro: fica em data/privado (o /m nunca o serve) e só o dono e o administrador baixam, com login.
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const acesso = await exigirEdicaoPeloId(req, id);
  if (acesso instanceof Response) return acesso;

  const arquivo = (await req.formData().catch(() => null))?.get("arquivo");
  if (!(arquivo instanceof File)) return erro("Escolha o PDF do livro.", 422);
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const problema = conferirPdf(bytes, LIMITE);
  if (problema) return erro(problema, 422);

  const chave = guardarPdfPrivado(id, bytes);
  const nome = arquivo.name.replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "livro.pdf";
  db.update(schema.ebook).set({ pdfPrivado: chave, pdfNome: nome, atualizadoEm: new Date() }).where(eq(schema.ebook.id, id)).run();
  return Response.json({ nome, kb: Math.round(bytes.length / 1024) });
}

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const acesso = await exigirEdicaoPeloId(req, id, { alteraDados: false });
  if (acesso instanceof Response) return acesso;
  const caminho = acesso.e.pdfPrivado ? caminhoDoPdfPrivado(acesso.e.pdfPrivado) : null;
  if (!caminho) return erro("Este e-book ainda não tem o PDF do livro.", 404);
  try {
    const bytes = await readFile(caminho);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${(acesso.e.pdfNome ?? "livro.pdf").replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return erro("O arquivo não está mais no servidor. Envie o PDF de novo.", 404);
  }
}
