import { describe, expect, it } from "vitest";
import type { EbookPublico } from "./catalogo";
import { jsonLdDoEbook, serializarJsonLd } from "./jsonld";
import { SITE_NOME } from "./site";

const base = {
  slug: "meu-livro", titulo: "Meu Livro", subtitulo: null, resumo: "Um resumo.", autorExibido: "Ana", capa: "/m/ebook/x/a.jpg",
  faq: [{ p: "Pergunta?", r: "Resposta." }], tema: { nome: "Saúde", slug: "saude" },
  vigente: { valor: 7900, riscado: 9900, ate: "2026-11-30T23:59:00.000Z", emOferta: true },
} as unknown as EbookPublico;

const tipos = (e: EbookPublico) => (jsonLdDoEbook(e)["@graph"] as { "@type": string }[]).map((x) => x["@type"]);

describe("jsonLdDoEbook", () => {
  it("com preço: Book, Product com Offer, FAQPage e BreadcrumbList", () => {
    expect(tipos(base)).toEqual(["Book", "Product", "FAQPage", "BreadcrumbList"]);
    const produto = (jsonLdDoEbook(base)["@graph"] as { offers?: { price: string; priceValidUntil?: string } }[])[1];
    expect(produto.offers).toMatchObject({ price: "79.00", priceValidUntil: "2026-11-30" });
  });

  it("em breve (sem preço): não declara Offer ao Google", () => {
    const sem = { ...base, vigente: { valor: null, riscado: null, ate: null, emOferta: false } } as EbookPublico;
    expect(tipos(sem)).toEqual(["Book", "FAQPage", "BreadcrumbList"]);
  });

  it("sem FAQ não gera FAQPage; sem tema o caminho tem 2 níveis", () => {
    const e = { ...base, faq: [], tema: null } as unknown as EbookPublico;
    expect(tipos(e)).not.toContain("FAQPage");
    const migalhas = (jsonLdDoEbook(e)["@graph"] as { itemListElement?: unknown[] }[]).at(-1)!.itemListElement!;
    expect(migalhas).toHaveLength(2);
  });

  it("autor é pessoa, ou organização quando é a própria marca", () => {
    const autor = (e: EbookPublico) => (jsonLdDoEbook(e)["@graph"][0] as { author?: { "@type": string } }).author?.["@type"];
    expect(autor(base)).toBe("Person");
    expect(autor({ ...base, autorExibido: SITE_NOME } as EbookPublico)).toBe("Organization");
  });

  it("serializa sem permitir fechar a tag <script>", () => {
    expect(serializarJsonLd({ a: "</script><b>" })).not.toContain("<");
  });
});
