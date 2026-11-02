import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/db";
import { contar, ehBot } from "@/lib/metricas";
import { origemDaVisita, parametrosDeOrigem, urlDestino, urlVigente } from "@/lib/ofertas";
import { SITE_URL } from "@/lib/site";

const { oferta, ebook } = schema;

// Saída rastreada: conta o clique, repassa a origem (UTM etc.) ao checkout e redireciona.
// Só redireciona para a URL de uma oferta cadastrada e ativa, e só em https (sem open redirect).
export async function GET(req: NextRequest, ctx: RouteContext<"/ir/[ofertaId]">) {
  const { ofertaId } = await ctx.params;
  const linha = db
    .select({ o: oferta, e: ebook })
    .from(oferta)
    .innerJoin(ebook, eq(oferta.ebookId, ebook.id))
    .where(and(eq(oferta.id, ofertaId), eq(oferta.ativa, true), eq(ebook.status, "publicado")))
    .get();

  const volta = (destino: string) => {
    // SITE_URL, não req.nextUrl.origin: atrás do nginx a origem interna não é a pública (http, host interno).
    const r = NextResponse.redirect(new URL(destino, SITE_URL), 302);
    r.headers.set("Cache-Control", "no-store");
    r.headers.set("X-Robots-Tag", "noindex");
    return r;
  };
  if (!linha) return volta("/");

  const origem = parametrosDeOrigem(req.nextUrl.searchParams, req.headers.get("referer"), new URL(SITE_URL).origin);
  const destino = urlDestino(urlVigente(linha.o, linha.e, new Date()), origem);
  if (!destino) return volta(`/${linha.e.slug}`);

  if (!ehBot(req.headers.get("user-agent"))) {
    try {
      contar(linha.e.id, origemDaVisita(origem.get("utm_source")), linha.o.id);
    } catch {
      // medir nunca pode impedir a venda
    }
  }
  return volta(destino);
}
