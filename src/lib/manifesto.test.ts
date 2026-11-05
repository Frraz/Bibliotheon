import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ajusteDeVenda, avisos, camposDeVenda, camposDoEbook, manifesto, slugify } from "./manifesto";

// Manifesto real do primeiro e-book (se o projeto irmão estiver na máquina): o contrato tem de aceitar o que ../ebooks gera.
const REAL = "../ebooks/ebooks/001-sistemas-com-ia/publicacao/bibliotheon/manifest.json";

describe("manifesto real", () => {
  it.skipIf(!existsSync(REAL))("é aceito sem alteração e mapeia os campos", () => {
    const m = manifesto.parse(JSON.parse(readFileSync(REAL, "utf8")));
    const f = camposDoEbook(m);
    expect(f.titulo).toBe("Crie Sistemas com IA e Ganhe Dinheiro");
    expect(f.slug).toBe("criar-sistemas-com-ia");
    expect(f.beneficios?.length).toBeGreaterThanOrEqual(3);
    expect(f.descricao).toContain("Oficina Clara");
    expect(f.preco).toBe(6499);
    expect(f.capaHash).toMatch(/^[0-9a-f]{64}$/);
    expect(m.offers[0].platform).toBe("hotmart");
  });
});

// Os três títulos: o que o gerador de ../ebooks emite hoje (v2, com SEO, tema e cor) tem de passar pelo esquema daqui.
describe.each(["001-sistemas-com-ia", "002-estoicismo-pratico", "003-natal-a-mesa"])("manifesto real de %s", (titulo) => {
  const arq = `../ebooks/ebooks/${titulo}/publicacao/bibliotheon/manifest.json`;
  it.skipIf(!existsSync(arq))("é aceito e o SEO, o tema e a cor chegam ao banco", () => {
    const m = manifesto.parse(JSON.parse(readFileSync(arq, "utf8")));
    const f = camposDoEbook(m);
    expect(f.slug).toMatch(/^[a-z0-9-]+$/);
    expect(f.headline).toBeTruthy();
    if (m.book.accent) expect(f.accent).toMatch(/^#[0-9a-f]{6}$/);
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

  it("aceita o formato v2 de ../ebooks: amostras só com o nome do arquivo e pendências em texto", () => {
    const v2 = { ...minimo, contract: "bibliotheon-editorial/v2", samples: ["amostra-01.png", { file: "amostra-02.png", alt: "Capítulo 1" }], pending: ["Confirmar o tema"] };
    const m = manifesto.parse(v2);
    expect(m.samples).toEqual([{ file: "amostra-01.png", alt: undefined }, { file: "amostra-02.png", alt: "Capítulo 1" }]);
    expect(m.pending).toHaveLength(1);
  });

  it("slugify tira acentos e símbolos", () => {
    expect(slugify("Crie Sistemas com IA — e Ganhe $$ Dinheiro!")).toBe("crie-sistemas-com-ia-e-ganhe-dinheiro");
  });
});

describe("ajuste de venda", () => {
  it("liga a campanha com os nomes do manifesto", () => {
    const a = ajusteDeVenda.parse({ book: { price: 47, priceFrom: 64.99, offerEndsAt: "2026-11-30T23:59:00-03:00", offerName: "Black Friday" } });
    expect(camposDeVenda(a.book!)).toEqual({ preco: 4700, precoDe: 6499, ofertaAte: new Date("2026-12-01T02:59:00Z"), ofertaNome: "Black Friday" });
  });

  it("null limpa a campanha; o que não vem não é tocado", () => {
    const a = ajusteDeVenda.parse({ book: { priceFrom: null, offerEndsAt: null } });
    expect(camposDeVenda(a.book!)).toEqual({ precoDe: null, ofertaAte: null });
  });

  it("recusa link promocional que não seja https", () => {
    expect(ajusteDeVenda.safeParse({ offers: [{ platform: "hotmart", promoUrl: "PREENCHER" }] }).success).toBe(false);
    expect(ajusteDeVenda.safeParse({ offers: [{ platform: "hotmart", promoUrl: "http://x.com" }] }).success).toBe(false);
  });
});

describe("campos que o ../ebooks emite", () => {
  it("SEO e cor entram nos campos; cor fora do #RRGGBB é recusada", () => {
    const m = manifesto.parse({ contract: "bibliotheon-editorial/v2", sourceId: "x", book: { title: "Livro", seoTitle: "Título para o Google", seoDescription: "Descrição", accent: "#C9962B", themeName: "Tema", themeDescription: "D" }, cover: { file: "capa.png" } });
    expect(camposDoEbook(m)).toMatchObject({ seoTitle: "Título para o Google", seoDescription: "Descrição", accent: "#c9962b" });
    expect(manifesto.safeParse({ contract: "bibliotheon-editorial/v2", sourceId: "x", book: { title: "L", accent: "dourado" }, cover: { file: "c.png" } }).success).toBe(false);
  });

  it("o ajuste de venda (PATCH) também aceita SEO, para trocar título e descrição sem o painel", () => {
    const r = ajusteDeVenda.parse({ book: { seoTitle: "Novo título", seoDescription: "Nova descrição" } });
    expect(camposDeVenda(r.book!)).toEqual({ seoTitle: "Novo título", seoDescription: "Nova descrição" });
  });
});
