import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db, schema } from "@/db";
import { erro } from "@/lib/api";
import { prepararImagem } from "@/lib/imagens";
import { guardarBytes, sha256 } from "@/lib/midia";
import { exigirEdicaoPeloId } from "@/lib/painel-api";

// Troca a capa. A imagem é conferida, limpa de metadados e guardada com o hash no nome (o cache pode ser eterno).
export async function POST(req: Request, ctx: RouteContext<"/api/painel/ebooks/[id]/capa">) {
  const { id } = await ctx.params;
  const acesso = await exigirEdicaoPeloId(req, id);
  if (acesso instanceof Response) return acesso;

  const arquivo = (await req.formData().catch(() => null))?.get("arquivo");
  if (!(arquivo instanceof File)) return erro("Escolha uma imagem.", 422);
  const imagem = await prepararImagem(Buffer.from(await arquivo.arrayBuffer()), { larguraMinima: 1200 });
  if (!imagem.ok) return erro(imagem.erro, 422);

  const chave = guardarBytes(id, imagem.bytes, imagem.ext);
  db.update(schema.ebook).set({ capa: chave, capaHash: sha256(imagem.bytes), atualizadoEm: new Date() }).where(eq(schema.ebook.id, id)).run();
  revalidateTag("ebooks", { expire: 0 });
  return Response.json({ capa: `/m/${chave}`, largura: imagem.largura, altura: imagem.altura, kb: Math.round(imagem.bytes.length / 1024) });
}
