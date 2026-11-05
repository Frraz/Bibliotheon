import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { erro, naoAutorizado } from "@/lib/api";
import { gravarVenda, logAviso, logIgnorado, logRecusa } from "@/lib/registrar-venda";
import { autenticar, ehPlataformaVenda, lerEvento } from "@/lib/vendas";

const { ebook, oferta } = schema;
const LIMITE_CORPO = 256 * 1024;

// Aviso de venda de uma loja para UM livro (o endereço dele no fim da URL). Continua funcionando, mas o normal é a URL única por
// loja (../route.ts), que descobre o livro pelo produto. Guarda só id da transação, valor, origem e afiliado.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/vendas/[plataforma]/[slug]">) {
  const { plataforma, slug } = await ctx.params;
  if (!ehPlataformaVenda(plataforma)) return erro("Plataforma desconhecida.", 404);

  const corpo = await req.text();
  if (corpo.length > LIMITE_CORPO) return erro("Corpo grande demais.", 413);
  // Autentica antes de procurar o e-book: quem não tem o segredo não descobre quais endereços existem.
  if (!autenticar(plataforma, { headers: req.headers, url: req.url, corpo })) {
    logRecusa(plataforma);
    return naoAutorizado();
  }

  const livro = db.select().from(ebook).where(eq(ebook.slug, slug)).get();
  if (!livro) return erro("E-book não encontrado.", 404);

  let json: unknown = null;
  try {
    json = JSON.parse(corpo);
  } catch {
    // cai em "ilegível" abaixo
  }
  const lido = lerEvento(plataforma, json);
  if (lido === "ignorado") {
    logIgnorado(plataforma, json);
    return Response.json({ ok: true, ignorado: true });
  }
  if (lido === "ilegivel") {
    // Só os nomes dos campos do topo: o log não pode guardar dado do comprador.
    const campos = json && typeof json === "object" ? Object.keys(json).slice(0, 12).join(",") : "nao-json";
    console.warn(`[vendas] ${plataforma}/${slug}: formato não reconhecido (campos: ${campos})`);
    return erro("Formato do aviso não reconhecido.", 422);
  }

  // O endereço diz de qual livro é (quando o produto da loja não puder ser descoberto sozinho); o id do produto fica guardado.
  if (lido.produtoId) {
    db.update(oferta).set({ produtoExterno: lido.produtoId }).where(and(eq(oferta.ebookId, livro.id), eq(oferta.plataforma, plataforma), isNull(oferta.produtoExterno))).run();
  }
  gravarVenda(plataforma, lido, livro);
  logAviso(plataforma, lido, livro);
  return Response.json({ ok: true, tipo: lido.tipo });
}
