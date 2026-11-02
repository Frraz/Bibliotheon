import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avisos, camposDoEbook, manifesto, slugify } from "./manifesto";

// Manifest v1 real do primeiro e-book (se o projeto irmão estiver na máquina).
const REAL = "../ebooks/ebooks/001-sistemas-com-ia/publicacao/bibliotheon/manifest.json";

describe("manifesto v1 real", () => {
  it.skipIf(!existsSync(REAL))("é aceito sem alteração e mapeia os campos existentes", () => {
    const m = manifesto.parse(JSON.parse(readFileSync(REAL, "utf8")));
    const f = camposDoEbook(m);
    expect(f.titulo).toBe("Crie Sistemas com IA e Ganhe Dinheiro");
    expect(f.slug).toBe("crie-sistemas-com-ia-e-ganhe-dinheiro");
    expect(f.beneficios).toHaveLength(4);
    expect(f.descricao).toContain("Oficina Clara");
    expect(f.observacoes).toContain("Sem promessa de renda");
    expect(f.paraQuem).toHaveLength(1);
    expect(f.accent).toBe("#4B5E55");
    expect(f.capaHash).toMatch(/^[0-9a-f]{64}$/);
    expect(m.offers).toEqual([]);
    expect(m.pending).toEqual([]);
  });
});

const minimo = { contract: "bibliotheon-editorial/v1", sourceId: "x", book: { title: "Meu Livro Ótimo" }, cover: { file: "capa.jpg" } };

describe("manifesto", () => {
  it("campos novos: preço em reais vira centavos; prazo vira data", () => {
    const m = manifesto.parse({ ...minimo, book: { ...minimo.book, price: 29.9, priceFrom: 49.9, offerEndsAt: "2026-12-01T23:59:00-03:00", faq: [{ q: "a?", a: "b" }] } });
    const f = camposDoEbook(m);
    expect(f.preco).toBe(2990);
    expect(f.precoDe).toBe(4990);
    expect(f.ofertaAte).toEqual(new Date("2026-12-02T02:59:00Z"));
    expect(f.faq).toEqual([{ p: "a?", r: "b" }]);
  });

  it("só toca no que o manifesto traz (o resto fica como está no painel)", () => {
    const f = camposDoEbook(manifesto.parse(minimo));
    expect(Object.keys(f).sort()).toEqual(["idioma", "slug", "titulo"]);
  });

  it("recusa contrato desconhecido, oferta sem https e plataforma desconhecida", () => {
    expect(() => manifesto.parse({ ...minimo, contract: "outro/v9" })).toThrow();
    expect(() => manifesto.parse({ ...minimo, offers: [{ platform: "kiwify", url: "http://pay.x/1" }] })).toThrow();
    expect(() => manifesto.parse({ ...minimo, offers: [{ platform: "xpto", url: "https://pay.x/1" }] })).toThrow();
  });

  it("campos desconhecidos geram aviso, não erro", () => {
    const m = manifesto.parse({ ...minimo, book: { ...minimo.book, materialState: "ready", novidade: 1 } });
    expect(avisos(m).some((a) => a.includes("materialState"))).toBe(true);
  });

  it("slugify tira acentos e símbolos", () => {
    expect(slugify("Crie Sistemas com IA — e Ganhe $$ Dinheiro!")).toBe("crie-sistemas-com-ia-e-ganhe-dinheiro");
  });
});
