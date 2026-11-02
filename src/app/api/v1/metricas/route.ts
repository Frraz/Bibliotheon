import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { autorizado, naoAutorizado } from "@/lib/api";
import { brl, liquidoPorVenda, precoVigente } from "@/lib/preco";

const { ebook, metricaDiaria } = schema;
const META = 150_000;
const inteiro = (v: string | null, padrao = 0) => Math.max(0, Number.parseInt(v ?? "", 10) || padrao);
const taxa = (cliques: number, visitas: number) => (visitas ? `${((cliques / visitas) * 100).toFixed(1).replace(".", ",")}%` : "-");

// Relatório em texto para a rotina semanal. As vendas vêm da plataforma: ?vendas=10&afiliadas=3 faz a conta da meta.
export async function GET(req: Request) {
  if (!autorizado(req)) return naoAutorizado();
  const q = new URL(req.url).searchParams;
  const dias = inteiro(q.get("dias"), 30);
  const vendas = inteiro(q.get("vendas"));
  const afiliadas = Math.min(inteiro(q.get("afiliadas")), vendas);
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);

  const saida = [`Últimos ${dias} dias (desde ${desde})`];
  for (const e of db.select().from(ebook).where(eq(ebook.status, "publicado")).all()) {
    const linhas = db
      .select({
        origem: metricaDiaria.origem,
        visitas: sql<number>`sum(case when ${metricaDiaria.ofertaId} = '' then ${metricaDiaria.contagem} else 0 end)`,
        cliques: sql<number>`sum(case when ${metricaDiaria.ofertaId} <> '' then ${metricaDiaria.contagem} else 0 end)`,
      })
      .from(metricaDiaria)
      .where(and(eq(metricaDiaria.ebookId, e.id), gte(metricaDiaria.data, desde)))
      .groupBy(metricaDiaria.origem)
      .all()
      .sort((a, b) => b.visitas - a.visitas);
    const visitas = linhas.reduce((s, l) => s + l.visitas, 0);
    const cliques = linhas.reduce((s, l) => s + l.cliques, 0);

    saida.push("", e.slug, `  ${"origem".padEnd(26)}${"visitas".padStart(8)}${"cliques".padStart(9)}${"taxa".padStart(8)}`);
    for (const l of linhas) saida.push(`  ${l.origem.padEnd(26)}${String(l.visitas).padStart(8)}${String(l.cliques).padStart(9)}${taxa(l.cliques, l.visitas).padStart(8)}`);
    saida.push(`  ${"total".padEnd(26)}${String(visitas).padStart(8)}${String(cliques).padStart(9)}${taxa(cliques, visitas).padStart(8)}`);

    const valor = precoVigente(e, new Date()).valor;
    if (vendas && valor != null) {
      const bruto = vendas * valor;
      const liquido = (vendas - afiliadas) * liquidoPorVenda(valor) + afiliadas * liquidoPorVenda(valor, true);
      saida.push(
        "",
        `  ${vendas} vendas ao preço atual (${brl(valor)}), ${afiliadas} por afiliado`,
        `  Faturamento: ${brl(bruto)} · falta para a meta: ${brl(Math.max(0, META - bruto))}`,
        `  Sobra estimada após taxas e comissão: ${brl(liquido)}`,
      );
    }
  }
  return new Response(`${saida.join("\n")}\n`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
