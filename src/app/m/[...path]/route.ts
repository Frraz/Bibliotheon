import { readFile } from "node:fs/promises";
import { caminhoDaMidia } from "@/lib/midia";

// Serve capas e amostras do MEDIA_DIR. O nome do arquivo leva o hash do conteúdo, então o cache é eterno.
export async function GET(_req: Request, ctx: RouteContext<"/m/[...path]">) {
  const { path } = await ctx.params;
  const alvo = caminhoDaMidia(path);
  if (!alvo) return new Response("Não encontrado", { status: 404 });
  try {
    const bytes = await readFile(alvo.caminho);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": alvo.tipo,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }
}
