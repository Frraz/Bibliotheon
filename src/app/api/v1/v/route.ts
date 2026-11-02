import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { contar, ehBot } from "@/lib/metricas";
import { origemDaVisita } from "@/lib/ofertas";

const { ebook } = schema;

// Beacon de visita: a landing envia { s: slug, o: utm_source } uma vez por e-book por sessão.
export async function POST(req: Request) {
  if (ehBot(req.headers.get("user-agent"))) return new Response(null, { status: 204 });
  try {
    const corpo = JSON.parse((await req.text()).slice(0, 500)) as { s?: unknown; o?: unknown };
    if (typeof corpo.s !== "string") return new Response(null, { status: 204 });
    const e = db.select({ id: ebook.id }).from(ebook).where(and(eq(ebook.slug, corpo.s), eq(ebook.status, "publicado"))).get();
    if (e) contar(e.id, origemDaVisita(typeof corpo.o === "string" ? corpo.o : null));
  } catch {
    // corpo inválido: ignora
  }
  return new Response(null, { status: 204 });
}
