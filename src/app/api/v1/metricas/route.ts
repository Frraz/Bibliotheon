import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { autorizado, naoAutorizado } from "@/lib/api";
import { hojeSP } from "@/lib/metricas";
import { brl, liquidoPorVenda, precoVigente } from "@/lib/preco";

const { ebook, metricaDiaria, venda } = schema;
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

    // Vendas avisadas pelas lojas (webhook). A estimativa digitada em ?vendas= continua valendo, por baixo, como antes.
    const registradas = db.select().from(venda).where(and(eq(venda.ebookId, e.id), gte(venda.criadoEm, new Date(`${desde}T00:00:00-03:00`)))).all();
    const aprovadas = registradas.filter((v) => v.status === "aprovada");
    if (registradas.length) {
      const porOrigem = new Map<string, { n: number; bruto: number }>();
      for (const v of aprovadas) {
        const o = porOrigem.get(v.origem) ?? { n: 0, bruto: 0 };
        porOrigem.set(v.origem, { n: o.n + 1, bruto: o.bruto + v.valor });
      }
      const bruto = aprovadas.reduce((t, v) => t + v.valor, 0);
      const liquido = aprovadas.reduce((t, v) => t + liquidoPorVenda(v.valor, v.afiliado), 0);
      saida.push("", `  Vendas registradas pelas lojas: ${aprovadas.length} (${registradas.length - aprovadas.length} reembolsada(s) fora da conta), taxa clique→venda ${taxa(aprovadas.length, cliques)}`);
      for (const [o, x] of [...porOrigem].sort((a, b) => b[1].n - a[1].n)) saida.push(`  ${o.padEnd(26)}${String(x.n).padStart(8)}  ${brl(x.bruto)}`);
      saida.push(`  Faturamento: ${brl(bruto)} · sobra estimada após taxas e comissão: ${brl(liquido)}`);
      const semValor = aprovadas.filter((v) => !v.valorInformado).length;
      if (semValor) saida.push(`  Atenção: em ${semValor} venda(s) a loja não informou o valor; foi usado o preço vigente na hora do aviso.`);
    }

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
  // Meta do mês (data de São Paulo): bruto das vendas aprovadas de todos os e-books.
  const mes = hojeSP().slice(0, 7);
  const doMes = db.select().from(venda).where(and(eq(venda.status, "aprovada"), gte(venda.criadoEm, new Date(`${mes}-01T00:00:00-03:00`)))).all();
  if (doMes.length) {
    const bruto = doMes.reduce((t, v) => t + v.valor, 0);
    saida.push("", `Mês ${mes}: ${brl(bruto)} de ${brl(META)} (${doMes.length} venda(s) aprovada(s) registrada(s) pelas lojas)`);
  }
  return new Response(`${saida.join("\n")}\n`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
