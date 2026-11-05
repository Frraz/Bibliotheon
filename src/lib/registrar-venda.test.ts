import { describe, expect, it } from "vitest";

process.env.DATABASE_PATH = ":memory:";

const { db, schema } = await import("@/db");
const { acharLivro, chaveDoLink, gravarVenda, normalizarNome, reconciliarVendas } = await import("./registrar-venda");
const { eq } = await import("drizzle-orm");

const ev = (extra = {}) => ({ checkoutUrl: null, transacao: "t1", tipo: "aprovada" as const, valor: 2499, afiliado: false, origem: "direto", produtoId: "P1", produtoNome: "Natal à Mesa", ...extra });

describe("achar o livro pelo produto da loja", () => {
  const natal = db.insert(schema.ebook).values({ titulo: "Natal à Mesa", slug: "natal-a-mesa", formatos: ["PDF"], preco: 3990 }).returning().get();
  db.insert(schema.ebook).values({ titulo: "Outro Livro", slug: "outro-livro", formatos: ["PDF"] }).run();
  db.insert(schema.oferta).values({ ebookId: natal.id, plataforma: "hotmart", url: "https://pay.hotmart.com/x" }).run();

  it("normaliza acento, caixa e pontuação", () => {
    expect(normalizarNome("  Natal à Mesa! ")).toBe("natal a mesa");
  });

  it("sem id guardado, acha pelo nome igual ao título e aprende o id do produto na oferta", () => {
    expect(acharLivro("hotmart", "P1", "NATAL A MESA")?.id).toBe(natal.id);
    expect(db.select().from(schema.oferta).where(eq(schema.oferta.ebookId, natal.id)).get()?.produtoExterno).toBe("P1");
    // da próxima vez o id basta, mesmo que o nome do produto mude na loja
    expect(acharLivro("hotmart", "P1", "Nome totalmente diferente")?.id).toBe(natal.id);
  });

  it("a Cakto manda o link do checkout: casa com a oferta (link normal ou da campanha), mesmo com parâmetros", () => {
    const livro = db.insert(schema.ebook).values({ titulo: "Livro Com Link", slug: "livro-com-link", formatos: ["PDF"] }).returning().get();
    db.insert(schema.oferta).values({ ebookId: livro.id, plataforma: "cakto", url: "https://pay.cakto.com.br/abc123", urlPromo: "https://pay.cakto.com.br/promo9?coupon=BF" }).run();
    expect(chaveDoLink("HTTPS://pay.cakto.com.br/abc123/?utm_source=x#y")).toBe("pay.cakto.com.br/abc123");
    expect(acharLivro("cakto", "uuid-1", "Nome diferente", "https://pay.cakto.com.br/abc123?utm_source=instagram")?.id).toBe(livro.id);
    expect(acharLivro("cakto", "uuid-1", "Outro nome", "https://pay.cakto.com.br/promo9")?.id).toBe(livro.id);
    expect(acharLivro("cakto", null, null, "https://pay.cakto.com.br/desconhecido")).toBeNull();
    // aprendeu o id do produto
    expect(acharLivro("cakto", "uuid-1", null)?.id).toBe(livro.id);
    // o mesmo link em outra loja não vale
    expect(acharLivro("kiwify", null, null, "https://pay.cakto.com.br/abc123")).toBeNull();
  });

  it("o mesmo id em outra loja não vale; nome desconhecido ou sem nada, nulo", () => {
    expect(acharLivro("cakto", "P1", null)).toBeNull();
    expect(acharLivro("hotmart", "P999", "Livro que não existe")).toBeNull();
    expect(acharLivro("hotmart", null, null)).toBeNull();
  });

  it("dois livros com o mesmo título não são adivinhados", () => {
    db.insert(schema.ebook).values({ titulo: "Título Repetido", slug: "repetido-1", formatos: ["PDF"] }).run();
    db.insert(schema.ebook).values({ titulo: "Título Repetido", slug: "repetido-2", formatos: ["PDF"] }).run();
    expect(acharLivro("hotmart", "P5", "Título Repetido")).toBeNull();
  });
});

describe("gravar e reconciliar", () => {
  it("venda sem livro fica guardada e se associa quando o livro passa a ser conhecido", () => {
    gravarVenda("kiwify", ev({ transacao: "k1", produtoId: "KP", produtoNome: "Livro Chegando Depois", valor: null }), null);
    const solta = db.select().from(schema.venda).where(eq(schema.venda.transacao, "k1")).get()!;
    expect(solta).toMatchObject({ ebookId: null, valor: 0, valorInformado: false, produtoExterno: "KP" });
    expect(reconciliarVendas()).toBe(0); // ainda não há livro

    const livro = db.insert(schema.ebook).values({ titulo: "Livro Chegando Depois", slug: "chegando", formatos: ["PDF"], preco: 5000 }).returning().get();
    expect(reconciliarVendas()).toBe(1);
    const depois = db.select().from(schema.venda).where(eq(schema.venda.transacao, "k1")).get()!;
    expect(depois).toMatchObject({ ebookId: livro.id, valor: 5000 }); // valor não informado pela loja: preço vigente
  });

  it("reenvio não duplica; reembolso muda o status", () => {
    gravarVenda("cakto", ev({ transacao: "c1", produtoId: null }), null);
    gravarVenda("cakto", ev({ transacao: "c1", produtoId: null }), null);
    gravarVenda("cakto", ev({ transacao: "c1", tipo: "reembolsada", produtoId: null }), null);
    const linhas = db.select().from(schema.venda).where(eq(schema.venda.transacao, "c1")).all();
    expect(linhas).toHaveLength(1);
    expect(linhas[0].status).toBe("reembolsada");
  });
});
