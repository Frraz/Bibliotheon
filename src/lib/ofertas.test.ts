import { describe, expect, it } from "vitest";
import { ofertasSemLinkPromo, origemDaVisita, parametrosDeOrigem, urlDestino, urlVigente } from "./ofertas";

const q = (s: string) => new URLSearchParams(s);

describe("urlDestino", () => {
  it("repassa UTMs e ids de clique ao checkout", () => {
    const u = urlDestino("https://pay.kiwify.com.br/abc", q("utm_source=meta&utm_campaign=c1&fbclid=XYZ&outro=1"));
    const url = new URL(u!);
    expect(url.origin + url.pathname).toBe("https://pay.kiwify.com.br/abc");
    expect(url.searchParams.get("utm_source")).toBe("meta");
    expect(url.searchParams.get("utm_campaign")).toBe("c1");
    expect(url.searchParams.get("fbclid")).toBe("XYZ");
    expect(url.searchParams.has("outro")).toBe(false); // só o que está na lista
  });

  it("preserva a query já cadastrada e deixa a origem recebida vencer em caso de conflito", () => {
    const u = new URL(urlDestino("https://pay.hotmart.com/X?off=ab12&src=fixo", q("src=instagram-bio"))!);
    expect(u.searchParams.get("off")).toBe("ab12");
    expect(u.searchParams.get("src")).toBe("instagram-bio");
  });

  it("sem parâmetros recebidos, devolve a URL como está", () => {
    expect(urlDestino("https://pay.cakto.com.br/p1", q(""))).toBe("https://pay.cakto.com.br/p1");
  });

  it("recusa o que não for https (sem open redirect nem esquemas estranhos)", () => {
    expect(urlDestino("http://pay.exemplo.com/x", q(""))).toBeNull();
    expect(urlDestino("javascript:alert(1)", q(""))).toBeNull();
    expect(urlDestino("//evil.com", q(""))).toBeNull();
    expect(urlDestino("isto não é url", q(""))).toBeNull();
  });

  it("limita o tamanho de cada parâmetro repassado", () => {
    const u = new URL(urlDestino("https://pay.kiwify.com.br/a", q("utm_source=" + "a".repeat(500)))!);
    expect(u.searchParams.get("utm_source")!.length).toBe(200);
  });
});

describe("parametrosDeOrigem", () => {
  const site = "https://bibliotheon.com.br";
  it("usa os parâmetros da própria requisição quando existem", () => {
    const p = parametrosDeOrigem(q("utm_source=meta"), `${site}/livro?utm_source=google`, site);
    expect(p.get("utm_source")).toBe("meta");
  });
  it("sem parâmetros (clique antes do JS), recupera os da landing de onde veio", () => {
    const p = parametrosDeOrigem(q(""), `${site}/livro?utm_source=instagram&fbclid=Z`, site);
    expect(p.get("utm_source")).toBe("instagram");
    expect(p.get("fbclid")).toBe("Z");
  });
  it("ignora referer de outro site ou inválido", () => {
    expect(parametrosDeOrigem(q(""), "https://evil.com/?utm_source=meta", site).has("utm_source")).toBe(false);
    expect(parametrosDeOrigem(q(""), "isto não é url", site).has("utm_source")).toBe(false);
    expect(parametrosDeOrigem(q(""), null, site).has("utm_source")).toBe(false);
  });
});

describe("origemDaVisita", () => {
  it("normaliza e protege as métricas de lixo", () => {
    expect(origemDaVisita("Meta")).toBe("meta");
    expect(origemDaVisita(null)).toBe("direto");
    expect(origemDaVisita("")).toBe("direto");
    expect(origemDaVisita("parceiro-marina")).toBe("parceiro-marina");
    expect(origemDaVisita("qualquer-coisa-inventada")).toBe("outro");
    expect(origemDaVisita("<script>")).toBe("outro");
    expect(origemDaVisita("a".repeat(80))).toBe("outro");
  });
});

describe("checkout da campanha", () => {
  const e = { preco: 4700, precoDe: 6499, ofertaAte: "2026-11-30T23:59:00-03:00" };
  const durante = new Date("2026-11-28T12:00:00-03:00");
  const depois = new Date("2026-12-01T00:00:00-03:00");
  const o = { url: "https://pay.hotmart.com/X", urlPromo: "https://pay.hotmart.com/X?off=bf" };

  it("usa o link promocional só enquanto a oferta vale", () => {
    expect(urlVigente(o, e, durante)).toBe(o.urlPromo);
    expect(urlVigente(o, e, depois)).toBe(o.url);
  });

  it("sem link promocional, fica no checkout normal", () => {
    expect(urlVigente({ url: o.url, urlPromo: null }, e, durante)).toBe(o.url);
  });

  it("aponta a campanha que anunciaria um preço e cobraria outro", () => {
    const sem = { url: o.url, urlPromo: null };
    expect(ofertasSemLinkPromo([o, sem], e, durante)).toEqual([sem]);
    expect(ofertasSemLinkPromo([sem], e, depois)).toEqual([]);
    expect(ofertasSemLinkPromo([sem], { ...e, ofertaAte: null }, durante)).toEqual([]);
    expect(ofertasSemLinkPromo([sem], { ...e, precoDe: 4700 }, durante)).toEqual([]); // prazo sem mudança de preço
  });
});
