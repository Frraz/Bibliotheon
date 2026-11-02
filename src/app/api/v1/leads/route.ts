import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { autorizado, erro, naoAutorizado } from "@/lib/api";
import { dentroDoLimite, linhaCsv, pedidoDeAmostra } from "@/lib/leads";
import { origemDaVisita } from "@/lib/ofertas";

const { ebook, lead } = schema;

// Pedido de amostra: guarda o e-mail (com aceite) e devolve o link do PDF.
export async function POST(req: Request) {
  const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!dentroDoLimite(ip)) return erro("Muitos pedidos. Tente de novo em um minuto.", 429);

  const lido = pedidoDeAmostra.safeParse(await req.json().catch(() => null));
  if (!lido.success) return erro("Confira o e-mail e o aceite.", 422);
  const { slug, email, site, origem } = lido.data;

  const e = db.select({ id: ebook.id, pdf: ebook.amostraPdf }).from(ebook).where(and(eq(ebook.slug, slug), eq(ebook.status, "publicado"))).get();
  if (!e?.pdf) return erro("Amostra indisponível.", 404);

  // Robô preencheu o campo isca: responde igual, sem guardar nada.
  if (!site) db.insert(lead).values({ ebookId: e.id, email, origem: origemDaVisita(origem) }).onConflictDoNothing().run();
  return Response.json({ pdf: `/m/${e.pdf}` });
}

// Exportação em CSV para a ferramenta de e-mail. Só com token.
export async function GET(req: Request) {
  if (!autorizado(req)) return naoAutorizado();
  const linhas = db
    .select({ email: lead.email, slug: ebook.slug, origem: lead.origem, criadoEm: lead.criadoEm })
    .from(lead)
    .innerJoin(ebook, eq(lead.ebookId, ebook.id))
    .orderBy(asc(lead.criadoEm))
    .all();
  const csv = [linhaCsv(["email", "ebook", "origem", "data"]), ...linhas.map((l) => linhaCsv([l.email, l.slug, l.origem, l.criadoEm.toISOString()]))].join("\n");
  return new Response(`${csv}\n`, { headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store" } });
}
