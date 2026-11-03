import { describe, expect, it } from "vitest";
import { avisosDeSeo } from "./seo";

describe("avisosDeSeo", () => {
  const bom = "Crie um sistema pequeno com IA, com amostra.";

  it("não avisa quando está tudo bem", () => {
    expect(avisosDeSeo("Como criar sistemas com IA | E-book", bom)).toEqual([]);
  });

  it("avisa sobre campo vazio, texto longo, repetição e preço", () => {
    expect(avisosDeSeo("", "")).toHaveLength(2);
    expect(avisosDeSeo("a".repeat(61), bom)[0]).toMatch(/Título longo/);
    expect(avisosDeSeo("Título", "a".repeat(156))[0]).toMatch(/Descrição longa/);
    expect(avisosDeSeo("Estoicismo | E-book", "estoicismo | e-book ")[0]).toMatch(/repete o título/);
    expect(avisosDeSeo("Título", "Só R$ 47,00 hoje")[0]).toMatch(/preço/);
  });
});
