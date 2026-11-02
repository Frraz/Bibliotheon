import { describe, expect, it } from "vitest";
import { podeBaixarPdf, podeEditar } from "./permissoes";

const owner = { id: "o", papel: "owner" as const };
const ana = { id: "a", papel: "parceiro" as const };
const beto = { id: "b", papel: "parceiro" as const };

describe("podeEditar", () => {
  it("o owner edita qualquer e-book, inclusive sem dono", () => {
    expect(podeEditar(owner, { ownerId: "a" })).toBe(true);
    expect(podeEditar(owner, { ownerId: null })).toBe(true);
  });

  it("o parceiro edita só o que é dele", () => {
    expect(podeEditar(ana, { ownerId: "a" })).toBe(true);
    expect(podeEditar(ana, { ownerId: "b" })).toBe(false);
    expect(podeEditar(beto, { ownerId: "a" })).toBe(false);
  });

  it("e-book sem dono (importado) não é de nenhum parceiro", () => {
    expect(podeEditar(ana, { ownerId: null })).toBe(false);
  });

  it("o PDF do livro segue a mesma regra", () => {
    expect(podeBaixarPdf(ana, { ownerId: "b" })).toBe(false);
    expect(podeBaixarPdf(ana, { ownerId: "a" })).toBe(true);
  });
});
