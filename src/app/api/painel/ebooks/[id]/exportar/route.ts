import { carregarEbook } from "@/lib/ebooks";
import { dadosExportados, fichaMd } from "@/lib/exportar";
import { exigirEdicaoPeloId } from "@/lib/painel-api";
import { SITE_URL } from "@/lib/site";

// Baixa todos os dados de um e-book, rascunho ou publicado. O administrador exporta qualquer um; o usuário, só os dele.
export async function GET(req: Request, ctx: RouteContext<"/api/painel/ebooks/[id]/exportar">) {
  const { id } = await ctx.params;
  const acesso = await exigirEdicaoPeloId(req, id, { alteraDados: false });
  if (acesso instanceof Response) return acesso;
  const d = carregarEbook(id)!;
  const tema = d.temas.find((t) => t.id === d.e.temaId) ?? null;
  const entrada = { e: d.e, ofertas: d.ofertas, amostras: d.amostras, tema, dono: d.dono, siteUrl: SITE_URL };
  const json = new URL(req.url).searchParams.get("formato") === "json";
  return new Response(json ? JSON.stringify(dadosExportados(entrada), null, 2) : fichaMd(entrada), {
    headers: {
      "Content-Type": json ? "application/json; charset=utf-8" : "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${d.e.slug}.${json ? "json" : "md"}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
