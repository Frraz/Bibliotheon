import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { erro, naoAutorizado } from "@/lib/api";
import { precoVigente } from "@/lib/preco";
import { autenticar, ehPlataformaVenda, lerEvento } from "@/lib/vendas";

const { ebook, venda } = schema;
const LIMITE_CORPO = 256 * 1024;

// Aviso de venda de uma loja (docs/03-tecnico.md). A loja cadastra uma URL por produto, com o endereço do e-book no fim.
// Guarda só id da transação, valor, origem e afiliado. Reenvio não conta duas vezes; reembolso muda o status.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/vendas/[plataforma]/[slug]">) {
  const { plataforma, slug } = await ctx.params;
  if (!ehPlataformaVenda(plataforma)) return erro("Plataforma desconhecida.", 404);

  const corpo = await req.text();
  if (corpo.length > LIMITE_CORPO) return erro("Corpo grande demais.", 413);
  // Autentica antes de procurar o e-book: quem não tem o segredo não descobre quais endereços existem.
  if (!autenticar(plataforma, { headers: req.headers, url: req.url, corpo })) return naoAutorizado();

  const livro = db.select().from(ebook).where(eq(ebook.slug, slug)).get();
  if (!livro) return erro("E-book não encontrado.", 404);

  let json: unknown = null;
  try {
    json = JSON.parse(corpo);
  } catch {
    // cai em "ilegível" abaixo
  }
  const lido = lerEvento(plataforma, json);
  if (lido === "ignorado") return Response.json({ ok: true, ignorado: true });
  if (lido === "ilegivel") {
    // Só os nomes dos campos do topo: o log não pode guardar dado do comprador.
    const campos = json && typeof json === "object" ? Object.keys(json).slice(0, 12).join(",") : "nao-json";
    console.warn(`[vendas] ${plataforma}/${slug}: formato não reconhecido (campos: ${campos})`);
    return erro("Formato do aviso não reconhecido.", 422);
  }

  const agora = new Date();
  const informado = lido.valor !== null;
  const valor = lido.valor ?? precoVigente(livro, agora).valor ?? 0;
  const base = { ebookId: livro.id, plataforma, transacao: lido.transacao, valor, valorInformado: informado, afiliado: lido.afiliado, origem: lido.origem };

  if (lido.tipo === "aprovada") {
    // Se o reembolso chegou antes (ordem trocada), o status "reembolsada" fica.
    db.insert(venda).values({ ...base, status: "aprovada" }).onConflictDoNothing().run();
  } else {
    db.insert(venda)
      .values({ ...base, status: "reembolsada" })
      .onConflictDoUpdate({ target: [venda.plataforma, venda.transacao], set: { status: "reembolsada", atualizadoEm: agora } })
      .run();
  }
  return Response.json({ ok: true, tipo: lido.tipo });
}
