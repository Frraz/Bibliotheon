import { erro, naoAutorizado } from "@/lib/api";
import { acharLivro, gravarVenda } from "@/lib/registrar-venda";
import { autenticar, ehPlataformaVenda, lerEvento } from "@/lib/vendas";

const LIMITE_CORPO = 256 * 1024;

// Aviso de venda de uma loja, UMA URL por loja para todos os livros (docs/03-tecnico.md): o livro vem do produto que a loja informa.
// Produto que ainda não sabemos de qual livro é fica guardado e aparece no relatório (`deploy/venda.sh relatorio`).
export async function POST(req: Request, ctx: RouteContext<"/api/v1/vendas/[plataforma]">) {
  const { plataforma } = await ctx.params;
  if (!ehPlataformaVenda(plataforma)) return erro("Plataforma desconhecida.", 404);

  const corpo = await req.text();
  if (corpo.length > LIMITE_CORPO) return erro("Corpo grande demais.", 413);
  if (!autenticar(plataforma, { headers: req.headers, url: req.url, corpo })) return naoAutorizado();

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
    console.warn(`[vendas] ${plataforma}: formato não reconhecido (campos: ${campos})`);
    return erro("Formato do aviso não reconhecido.", 422);
  }

  const livro = acharLivro(plataforma, lido.produtoId, lido.produtoNome, lido.checkoutUrl);
  if (!livro) console.warn(`[vendas] ${plataforma}: produto sem livro associado (id ${lido.produtoId ?? "?"}, nome “${lido.produtoNome ?? "?"}”); venda guardada`);
  gravarVenda(plataforma, lido, livro);
  return Response.json({ ok: true, tipo: lido.tipo, associada: !!livro });
}
