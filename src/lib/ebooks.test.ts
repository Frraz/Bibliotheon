import { describe, expect, it } from "vitest";

// Banco em memória (migrado ao abrir): ver src/db/index.ts. O env precisa existir antes de importar.
process.env.DATABASE_PATH = ":memory:";

describe("listarEbooks: vendas", async () => {
  const { db, schema } = await import("@/db");
  const { listarEbooks } = await import("./ebooks");
  const { hojeSP } = await import("./metricas");

  const novo = (ownerId: string, slug: string) => {
    const id = crypto.randomUUID();
    db.insert(schema.ebook).values({ id, ownerId, titulo: slug, slug, status: "publicado", formatos: ["PDF"] }).run();
    return id;
  };
  const venda = (ebookId: string, transacao: string, extra: Partial<typeof schema.venda.$inferInsert> = {}) =>
    db.insert(schema.venda).values({ ebookId, plataforma: "cakto", transacao, valor: 2499, ...extra }).run();

  const dona = novo("ana", "livro-da-ana");
  const outro = novo("beto", "livro-do-beto");
  const semAviso = novo("ana", "livro-sem-aviso");
  const velha = new Date(Date.now() - 20 * 86_400_000);

  venda(dona, "a1");
  venda(dona, "a2");
  venda(dona, "a3", { status: "reembolsada" }); // reembolsada não conta
  venda(dona, "a4", { criadoEm: velha }); // fora dos 7 dias, mas prova que a loja já avisa
  venda(outro, "b1");
  // Visita e clique do mesmo dia: a venda não pode multiplicar estas linhas
  db.insert(schema.metricaDiaria).values([
    { ebookId: dona, data: hojeSP(), ofertaId: "", origem: "direto", contagem: 10 },
    { ebookId: dona, data: hojeSP(), ofertaId: "x", origem: "direto", contagem: 3 },
  ]).run();

  it("conta só aprovadas dos últimos 7 dias e não mexe em visitas e cliques", () => {
    const l = listarEbooks({ id: "ana", papel: "parceiro" }).find((e) => e.id === dona)!;
    expect(l.vendas).toBe(2);
    expect(l.visitas).toBe(10);
    expect(l.cliques).toBe(3);
  });

  it("quem não é dono não vê o e-book nem as vendas dele", () => {
    const ids = listarEbooks({ id: "ana", papel: "parceiro" }).map((e) => e.id);
    expect(ids).not.toContain(outro);
    expect(listarEbooks({ id: "o", papel: "owner" }).map((e) => e.id)).toContain(outro);
  });

  it("e-book que nunca recebeu aviso de loja tem vendasTotal 0 (a tela mostra '—')", () => {
    const todos = listarEbooks({ id: "o", papel: "owner" });
    expect(todos.find((e) => e.id === semAviso)!.vendasTotal).toBe(0);
    expect(todos.find((e) => e.id === dona)!.vendasTotal).toBe(4);
  });
});
