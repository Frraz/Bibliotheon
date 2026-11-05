import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { camposDeVenda, ajusteDeVenda } from "./manifesto";
import { avisosDeSeo } from "./seo";

// Os arquivos de seeds/001-sistemas-com-ia/*.json são aplicados UMA vez em produção (deploy/venda.sh aplicar), em datas
// marcadas. Um erro de digitação só apareceria no dia. Aqui conferimos que cada um passa pelo mesmo esquema da API.
const ler = (nome: string) => JSON.parse(readFileSync(`seeds/001-sistemas-com-ia/${nome}.json`, "utf8")) as { book?: Record<string, unknown>; offers?: Record<string, unknown>[] };
const comLink = <T extends { offers?: Record<string, unknown>[] }>(j: T): T => ({ ...j, offers: j.offers?.map((o) => (o.promoUrl ? { ...o, promoUrl: "https://pay.hotmart.com/PROMO-DE-TESTE" } : o)) });

describe("arquivos de campanha do 001", () => {
  it("todos passam pelo esquema da API (com o link promocional preenchido)", () => {
    for (const nome of ["black-friday", "fim-da-campanha", "renomear-promocao", "segunda-edicao"]) {
      const r = ajusteDeVenda.safeParse(comLink(ler(nome)));
      expect(r.success, `${nome}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
    }
  });

  it("black-friday.json sem o link real da Hotmart é recusado (não vai ao ar com o texto-guia)", () => {
    expect(ajusteDeVenda.safeParse(ler("black-friday")).success).toBe(false);
  });

  it("Black Friday: R$ 47, de R$ 64,99, até 30/11 às 23h59 de Brasília", () => {
    const c = camposDeVenda(ajusteDeVenda.parse(comLink(ler("black-friday"))).book!);
    expect(c.preco).toBe(4700);
    expect(c.precoDe).toBe(6499);
    expect(c.ofertaAte?.toISOString()).toBe("2026-12-01T02:59:00.000Z");
    expect(c.ofertaNome).toBe("Black Friday");
  });

  it("fim da campanha volta a R$ 64,99 e limpa o preço de, o prazo e o nome", () => {
    const c = camposDeVenda(ajusteDeVenda.parse(ler("fim-da-campanha")).book!);
    expect(c).toMatchObject({ preco: 6499, precoDe: null, ofertaAte: null, ofertaNome: null });
  });

  it("renomear a promoção mexe só no nome da faixa, e a 2ª edição só em textos", () => {
    expect(Object.keys(camposDeVenda(ajusteDeVenda.parse(ler("renomear-promocao")).book!))).toEqual(["ofertaNome"]);
    const textos = Object.keys(camposDeVenda(ajusteDeVenda.parse(ler("segunda-edicao")).book!));
    for (const proibido of ["preco", "precoDe", "ofertaAte", "ofertaNome"]) expect(textos).not.toContain(proibido);
    expect(ajusteDeVenda.parse(ler("segunda-edicao")).offers).toBeUndefined();
  });
});

describe("textos de SEO do 001 e do 002 (seeds/seo)", () => {
  for (const slug of ["criar-sistemas-com-ia", "a-mente-inabalavel"]) {
    it(`${slug}: passa pela API, cabe no Google e não tem preço`, () => {
      const j = JSON.parse(readFileSync(`seeds/seo/${slug}.json`, "utf8"));
      const r = ajusteDeVenda.safeParse(j);
      expect(r.success).toBe(true);
      const { seoTitle, seoDescription } = camposDeVenda(r.data!.book!);
      expect(avisosDeSeo(seoTitle ?? "", seoDescription ?? "")).toEqual([]);
    });
  }
});
