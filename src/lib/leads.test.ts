import { describe, expect, it } from "vitest";
import { dentroDoLimite, linhaCsv, pedidoDeAmostra } from "./leads";

describe("pedido de amostra", () => {
  const ok = { slug: "livro", email: "Ana@Exemplo.com ", aceite: true };

  it("normaliza o e-mail", () => {
    expect(pedidoDeAmostra.parse(ok).email).toBe("ana@exemplo.com");
  });

  it("exige aceite e e-mail válido", () => {
    expect(pedidoDeAmostra.safeParse({ ...ok, aceite: false }).success).toBe(false);
    expect(pedidoDeAmostra.safeParse({ ...ok, email: "isto não é e-mail" }).success).toBe(false);
  });
});

describe("limite por IP", () => {
  it("barra depois de 5 pedidos e libera na janela seguinte", () => {
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) expect(dentroDoLimite("1.1.1.1", t)).toBe(true);
    expect(dentroDoLimite("1.1.1.1", t)).toBe(false);
    expect(dentroDoLimite("2.2.2.2", t)).toBe(true);
    expect(dentroDoLimite("1.1.1.1", t + 61_000)).toBe(true);
  });
});

describe("CSV", () => {
  it("não deixa a planilha executar fórmula nem quebrar a aspa", () => {
    expect(linhaCsv(["=1+1", 'a"b'])).toBe('"\'=1+1","a""b"');
  });
});
