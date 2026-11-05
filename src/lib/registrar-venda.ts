import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Ebook, Plataforma } from "@/db/schema";
import { precoVigente } from "./preco";
import type { EventoVenda } from "./vendas";

// Gravar o aviso de venda de uma loja. Uma URL por LOJA serve a todos os livros: o livro é descoberto pelo produto que a loja
// informa (id guardado na oferta, ou o nome igual ao título). Sem livro conhecido a venda fica guardada, sem perder nada, e
// se associa sozinha quando o livro passar a ser conhecido.

const { ebook, oferta, venda } = schema;

/** Minúsculas, sem acento e sem pontuação: "Natal à Mesa!" e "natal a mesa" são o mesmo nome. */
export const normalizarNome = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Endereço sem esquema, parâmetros, âncora e barra final, para comparar links de checkout. */
export const chaveDoLink = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[?#].*$/, "").replace(/\/+$/, "");

/**
 * Qual livro é este produto. 1) o id do produto guardado na oferta daquela loja; 2) o link de checkout da compra, igual ao
 * cadastrado na oferta (a Cakto o manda); 3) o nome do produto igual ao título de um único livro. Achando por 2 ou 3, grava o id
 * do produto na oferta: da próxima vez o caminho 1 resolve. Nenhum dos três = null.
 */
export function acharLivro(plataforma: Plataforma, produtoId: string | null, produtoNome: string | null, checkoutUrl: string | null = null): Ebook | null {
  if (produtoId) {
    const achado = db
      .select({ e: ebook })
      .from(oferta)
      .innerJoin(ebook, eq(oferta.ebookId, ebook.id))
      .where(and(eq(oferta.plataforma, plataforma), eq(oferta.produtoExterno, produtoId)))
      .get();
    if (achado) return achado.e;
  }
  if (checkoutUrl) {
    const chave = chaveDoLink(checkoutUrl);
    const lojas = db.select({ o: oferta, e: ebook }).from(oferta).innerJoin(ebook, eq(oferta.ebookId, ebook.id)).where(eq(oferta.plataforma, plataforma)).all();
    const achada = lojas.find(({ o }) => chaveDoLink(o.url) === chave || (o.urlPromo && chaveDoLink(o.urlPromo) === chave));
    if (achada) {
      if (produtoId && !achada.o.produtoExterno) db.update(oferta).set({ produtoExterno: produtoId }).where(eq(oferta.id, achada.o.id)).run();
      return achada.e;
    }
  }
  if (produtoNome) {
    const alvo = normalizarNome(produtoNome);
    if (!alvo) return null;
    const iguais = db.select().from(ebook).all().filter((e) => normalizarNome(e.titulo) === alvo);
    if (iguais.length === 1) {
      const livro = iguais[0];
      if (produtoId) {
        db.update(oferta).set({ produtoExterno: produtoId }).where(and(eq(oferta.ebookId, livro.id), eq(oferta.plataforma, plataforma), isNull(oferta.produtoExterno))).run();
      }
      return livro;
    }
  }
  return null;
}

/** Grava a venda (idempotente por loja + transação). Reembolso chegando antes da compra também fica registrado. */
export function gravarVenda(plataforma: Plataforma, ev: EventoVenda, livro: Ebook | null, agora = new Date()) {
  const base = {
    ebookId: livro?.id ?? null,
    plataforma,
    produtoExterno: ev.produtoId,
    produtoNome: ev.produtoNome,
    transacao: ev.transacao,
    valor: ev.valor ?? (livro ? (precoVigente(livro, agora).valor ?? 0) : 0),
    valorInformado: ev.valor !== null,
    afiliado: ev.afiliado,
    origem: ev.origem,
  };
  if (ev.tipo === "aprovada") {
    db.insert(venda).values({ ...base, status: "aprovada" }).onConflictDoNothing().run();
  } else {
    db.insert(venda)
      .values({ ...base, status: "reembolsada" })
      .onConflictDoUpdate({ target: [venda.plataforma, venda.transacao], set: { status: "reembolsada", atualizadoEm: agora } })
      .run();
  }
}

/** Associa as vendas que ficaram sem livro, agora que ele pode ser conhecido. Devolve quantas associou. */
export function reconciliarVendas(agora = new Date()) {
  let n = 0;
  for (const v of db.select().from(venda).where(isNull(venda.ebookId)).all()) {
    const livro = acharLivro(v.plataforma, v.produtoExterno, v.produtoNome, null);
    if (!livro) continue;
    const valor = v.valorInformado ? v.valor : (precoVigente(livro, agora).valor ?? 0);
    db.update(venda).set({ ebookId: livro.id, valor }).where(eq(venda.id, v.id)).run();
    n++;
  }
  return n;
}
