import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlocoDeCompra, BotaoDeCompra } from "@/components/site/compra";
import { MoldeDaPagina } from "@/components/site/molde-pagina";
import type { EbookPublico } from "@/lib/catalogo";
import { PaginaDeVendas } from "./pagina";
import { personalizadas, temPersonalizada, type PropsLanding, type Registro } from "./registro";

function ebook(extra: Partial<EbookPublico> = {}): EbookPublico {
  return {
    id: "1", slug: "meu-livro", titulo: "Meu Livro", subtitulo: null, headline: "Faça o seu primeiro canteiro", resumo: "Resumo", problema: null, descricao: null, dores: [], beneficios: ["a", "b", "c"],
    diferenciais: [], paraQuem: [], naoEPara: [], incluido: [], observacoes: null, autorExibido: null, formatos: ["PDF"], sumario: [], faq: [], capa: null, capaAlt: null, figura: null,
    amostras: [], amostraPdf: null, garantiaDias: 7, emBreve: false, preco: 6499, precoDe: null, ofertaAte: null, ofertaNome: null, parcelamento: null,
    vigente: { valor: 6499, riscado: null, ate: null, emOferta: false },
    ofertas: [{ id: "oferta-1", plataforma: "hotmart", rotulo: null, preco: null, principal: true }],
    tema: null, seoTitle: null, seoDescription: null, metaPixelId: null, publicadoEm: null, atualizadoEm: "2026-11-03T00:00:00.000Z",
    ...extra,
  };
}
const duas = [
  { id: "oferta-1", plataforma: "hotmart" as const, rotulo: null, preco: null, principal: true },
  { id: "oferta-2", plataforma: "kiwify" as const, rotulo: null, preco: 5990, principal: false },
];
const corpo = (p: PropsLanding) => createElement("main", null, `CORPO PERSONALIZADO de ${p.e.titulo}`);
const registro: Registro = new Map([["meu-livro", corpo]]);
const html = (e: EbookPublico, previa = false, r: Registro = registro) => renderToStaticMarkup(createElement(PaginaDeVendas, { e, relacionados: [], previa, registro: r }));

describe("registro de landings personalizadas", () => {
  it("só casa o slug cadastrado; nomes herdados de objeto nunca casam", () => {
    expect(temPersonalizada("meu-livro", registro)).toBe(true);
    expect(temPersonalizada("outro", registro)).toBe(false);
    for (const s of ["constructor", "__proto__", "toString", "hasOwnProperty"]) expect(temPersonalizada(s, registro)).toBe(false);
    expect(temPersonalizada("constructor")).toBe(false);
    expect(personalizadas.size).toBeGreaterThanOrEqual(0);
  });
});

describe("página de vendas personalizada", () => {
  it("usa o corpo do registro dentro do molde: dados estruturados e preço não dependem de quem desenha a página", () => {
    const h = html(ebook());
    expect(h).toContain("CORPO PERSONALIZADO de Meu Livro");
    expect(h).toContain('type="application/ld+json"');
    expect(h).toContain('"@type":"Book"');
    expect(h).toContain('"price":"64.99"');
  });

  it("na prévia do painel não há dados estruturados", () => {
    const h = html(ebook(), true);
    expect(h).toContain("CORPO PERSONALIZADO");
    expect(h).not.toContain("application/ld+json");
  });

  it("sem registro, cai na landing padrão (e nunca no corpo personalizado)", () => {
    const h = html(ebook({ slug: "sem-pagina-propria" }));
    expect(h).not.toContain("CORPO PERSONALIZADO");
    expect(h).toContain("Faça o seu primeiro canteiro"); // a headline do padrão
    expect(h).toContain('type="application/ld+json"');
  });
});

describe("lojas: uma vai direto, várias aparecem juntas", () => {
  const botao = (e: EbookPublico, curto = false) => renderToStaticMarkup(createElement(BotaoDeCompra, { e, curto }));
  // o bloco lê o preço vigente do molde (OfertaProvider)
  const bloco = (e: EbookPublico) => renderToStaticMarkup(createElement(MoldeDaPagina, { e, previa: true } as ComponentProps<typeof MoldeDaPagina>, createElement(BlocoDeCompra, { e })));

  it("com uma loja, o botão leva ao /ir daquela loja", () => {
    expect(botao(ebook())).toContain('href="/ir/oferta-1"');
    expect(botao(ebook())).toContain("Comprar na Hotmart");
    expect(botao(ebook(), true)).toContain(">Comprar<");
    const b = bloco(ebook());
    expect(b).not.toContain("Escolha onde prefere comprar");
    expect((b.match(/href="\/ir\//g) ?? []).length).toBe(1);
  });

  it("com várias, o botão do topo e da barra levam ao bloco de compra", () => {
    const e = ebook({ ofertas: duas });
    expect(botao(e)).toContain('href="#comprar"');
    expect(botao(e)).toContain("Comprar agora");
    expect(botao(e, true)).toContain("Comprar agora");
    expect(botao(e)).not.toContain("/ir/");
  });

  it("o bloco lista todas as lojas com o mesmo botão, na ordem da lista, e mostra o preço só de quem difere", () => {
    const b = bloco(ebook({ ofertas: duas }));
    expect(b).toContain("Escolha onde prefere comprar");
    expect(b.indexOf("Comprar na Hotmart")).toBeLessThan(b.indexOf("Comprar na Kiwify"));
    expect(b).toContain('href="/ir/oferta-1"');
    expect(b).toContain('href="/ir/oferta-2"');
    expect(b).toMatch(/R\$\s59,90/); // a Kiwify cobra outro valor
    expect(b).not.toMatch(/Hotmart[^<]*R\$/); // a Hotmart cobra o preço da página
    const classes = [...b.matchAll(/<a href="\/ir\/[^"]+" class="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(classes).size).toBe(1); // mesmo peso visual
  });

  it("sem loja ou em breve: sem botão de compra", () => {
    expect(botao(ebook({ ofertas: [] }))).toBe("");
    expect(bloco(ebook({ ofertas: [], emBreve: true }))).toContain("Em breve");
  });
});
