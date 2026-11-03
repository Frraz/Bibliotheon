import { describe, expect, it } from "vitest";
import { campanhaViva, camposDoEditor, checklistDePublicacao, dataLocalParaDate, dateParaDataLocal, lerFormulario, lojasSemLinkDaCampanha, paraCentavos, paraVenderMelhor, problemaNoSlug, reais, slugDoTitulo } from "./editor";

describe("endereço", () => {
  it("recusa reservados, acento, maiúscula e tamanho", () => {
    for (const s of ["painel", "admin", "api", "ir", "tema", "prototipo"]) expect(problemaNoSlug(s)).not.toBeNull();
    expect(problemaNoSlug("Meu-Livro")).not.toBeNull();
    expect(problemaNoSlug("açaí")).not.toBeNull();
    expect(problemaNoSlug("ab")).not.toBeNull();
    expect(problemaNoSlug("meu--livro")).not.toBeNull();
    expect(problemaNoSlug("meu-livro-2")).toBeNull();
  });

  it("gera do título, sem colidir e sem cair em rota do site", () => {
    expect(slugDoTitulo("Crie Sistemas com IA!", () => false)).toBe("crie-sistemas-com-ia");
    expect(slugDoTitulo("Livro", (s) => s === "livro")).toBe("livro-2");
    expect(slugDoTitulo("Livro", (s) => ["livro", "livro-2"].includes(s))).toBe("livro-3");
    expect(slugDoTitulo("Painel", () => false)).toBe("painel-livro");
    expect(slugDoTitulo("!!!", () => false)).toBe("livro");
  });
});

describe("dinheiro e datas", () => {
  it("converte reais em centavos e volta", () => {
    expect(paraCentavos("64,99")).toBe(6499);
    expect(paraCentavos("R$ 1.299,90")).toBe(129990);
    expect(paraCentavos("47")).toBe(4700);
    expect(paraCentavos("64.99")).toBe(6499);
    expect(paraCentavos("")).toBeNull();
    expect(paraCentavos("abc")).toBeNaN();
    expect(paraCentavos("0")).toBeNaN();
    expect(paraCentavos("-5")).toBeNaN();
    expect(reais(6499)).toBe("64,99");
    expect(reais(4700)).toBe("47,00");
    expect(reais(null)).toBe("");
  });

  it("a data do formulário é hora de Brasília e vira UTC no banco", () => {
    const d = dataLocalParaDate("2026-11-30T23:59")!;
    expect(d.toISOString()).toBe("2026-12-01T02:59:00.000Z");
    expect(dateParaDataLocal(d)).toBe("2026-11-30T23:59");
    expect(dataLocalParaDate("amanhã")).toBeNull();
    expect(dateParaDataLocal(null)).toBe("");
  });
});

function formulario(extra: Record<string, string> = {}) {
  const base: Record<string, string> = {
    titulo: "Livro de Teste", slug: "livro-de-teste", temaId: "", capaAlt: "Capa", autorExibido: "", formatos: "PDF, EPUB", headline: "Faça isso", subtitulo: "", resumo: "Resumo",
    problema: "", descricao: "", dores: "[]", beneficios: JSON.stringify(["a", "b", " c "]), diferenciais: "[]", paraQuem: "[]", naoEPara: "[]", incluido: "[]", observacoes: "",
    sumario: "[]", faq: "[]", precoNormal: "64,99", garantiaDias: "7", parcelamento: "", campanhaAtiva: "0", campanhaNome: "", campanhaPreco: "", campanhaFim: "",
    lojas: "[]", seoTitle: "", seoDescription: "",
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...base, ...extra })) fd.set(k, v);
  return fd;
}
const dadosDe = (extra?: Record<string, string>) => {
  const r = lerFormulario(formulario(extra));
  if ("erros" in r) throw new Error(r.erros.join("|"));
  return r.dados;
};
const errosDe = (extra: Record<string, string>) => {
  const r = lerFormulario(formulario(extra));
  return "erros" in r ? r.erros.join(" | ") : "";
};

describe("formulário do editor", () => {
  it("limpa listas e formatos e converte o preço", () => {
    const d = dadosDe();
    expect(d.beneficios).toEqual(["a", "b", "c"]);
    expect(d.formatos).toEqual(["PDF", "EPUB"]);
    expect(d.precoNormal).toBe(6499);
    expect(camposDoEditor(d)).toMatchObject({ preco: 6499, precoDe: null, ofertaAte: null, ofertaNome: null, headline: "Faça isso", subtitulo: null });
  });

  it("campanha: o preço cobrado vira o da campanha e o normal volta depois do prazo", () => {
    const d = dadosDe({ campanhaAtiva: "1", campanhaNome: "Black Friday", campanhaPreco: "47,00", campanhaFim: "2026-11-30T23:59" });
    expect(camposDoEditor(d)).toMatchObject({ preco: 4700, precoDe: 6499, ofertaNome: "Black Friday" });
    expect((camposDoEditor(d).ofertaAte as Date).toISOString()).toBe("2026-12-01T02:59:00.000Z");
  });

  it("campanha: exige nome, prazo, preço menor que o normal", () => {
    expect(errosDe({ campanhaAtiva: "1", campanhaPreco: "47", campanhaFim: "2026-11-30T23:59" })).toContain("dê um nome");
    expect(errosDe({ campanhaAtiva: "1", campanhaNome: "BF", campanhaPreco: "47" })).toContain("quando ela termina");
    expect(errosDe({ campanhaAtiva: "1", campanhaNome: "BF", campanhaPreco: "70", campanhaFim: "2026-11-30T23:59" })).toContain("menor que o preço normal");
    expect(errosDe({ campanhaAtiva: "1", campanhaNome: "BF", campanhaPreco: "47", campanhaFim: "2026-11-30T23:59", precoNormal: "" })).toContain("preço normal");
  });

  it("lojas: só https, e cada problema aponta a loja", () => {
    expect(errosDe({ lojas: JSON.stringify([{ plataforma: "hotmart", url: "http://pay.exemplo.com/x", ativa: true }]) })).toContain("Loja 1");
    expect(errosDe({ lojas: JSON.stringify([{ plataforma: "hotmart", url: "javascript:alert(1)", ativa: true }]) })).toContain("Loja 1");
    expect(errosDe({ lojas: JSON.stringify([{ plataforma: "cakto", url: "https://pay.exemplo.com/x", urlPromo: "ftp://x", ativa: true }]) })).toContain("link da campanha");
    expect(errosDe({ lojas: JSON.stringify([{ plataforma: "nao-existe", url: "https://a.com", ativa: true }]) })).not.toBe("");
    expect(dadosDe({ lojas: JSON.stringify([{ plataforma: "kiwify", url: "https://pay.kiwify.com.br/x", ativa: true }]) }).lojas).toHaveLength(1);
  });

  it("FAQ: pergunta sem resposta é erro; linha vazia some", () => {
    expect(errosDe({ faq: JSON.stringify([{ p: "Como?", r: "" }]) })).toContain("Perguntas frequentes");
    expect(dadosDe({ faq: JSON.stringify([{ p: "", r: "" }, { p: "Como?", r: "Assim." }]) }).faq).toEqual([{ p: "Como?", r: "Assim." }]);
  });

  it("recusa endereço reservado, título vazio, garantia fora da faixa e JSON quebrado", () => {
    expect(errosDe({ slug: "painel" })).toContain("usado pelo site");
    expect(errosDe({ titulo: " " })).toContain("título");
    expect(errosDe({ garantiaDias: "400" })).toContain("Garantia");
    expect(errosDe({ beneficios: "{quebrado" })).not.toBe("");
  });
});

describe("campanha e lojas", () => {
  const agora = new Date("2026-11-10T12:00:00Z");
  const viva = { preco: 4700, precoDe: 6499, ofertaAte: new Date("2026-12-01T02:59:00Z") };
  it("campanha viva exige link promocional em toda loja ativa", () => {
    const lojas = [{ plataforma: "hotmart", urlPromo: null, ativa: true }, { plataforma: "cakto", urlPromo: "https://x.com/y", ativa: true }, { plataforma: "kiwify", urlPromo: null, ativa: false }];
    expect(lojasSemLinkDaCampanha(lojas, viva, agora).map((l) => l.plataforma)).toEqual(["hotmart"]);
    expect(lojasSemLinkDaCampanha(lojas, { ...viva, ofertaAte: null }, agora)).toEqual([]);
  });
  it("só conta como viva a campanha com prazo no futuro e preço normal", () => {
    expect(campanhaViva(viva, agora)).toBe(true);
    expect(campanhaViva({ ...viva, ofertaAte: new Date("2026-11-01T00:00:00Z") }, agora)).toBe(false);
    expect(campanhaViva({ ...viva, precoDe: null }, agora)).toBe(false);
  });
});

describe("checklist e sugestões", () => {
  const ok = { titulo: "T", slug: "meu-livro", capa: "ebook/1/a.jpg", capaAlt: "Capa", headline: "H", resumo: "R", beneficios: ["a", "b", "c"], temaNoAr: null };
  it("completo quando tem o essencial", () => expect(checklistDePublicacao(ok).faltam).toEqual([]));
  it("lista o que falta, na linguagem da pessoa", () => {
    expect(checklistDePublicacao({ ...ok, capa: null, capaAlt: " ", headline: "", beneficios: ["a", " ", "c"] }).faltam).toEqual(["Capa", "Descrição da capa", "Headline", "Pelo menos 3 benefícios"]);
    expect(checklistDePublicacao({ ...ok, slug: "painel" }).faltam).toEqual(["Endereço válido"]);
  });
  it("tema fora do ar bloqueia: a página publicada daria 404", () => {
    expect(checklistDePublicacao({ ...ok, temaNoAr: false, temaNome: "Saúde" }).faltam[0]).toContain("Saúde");
    expect(checklistDePublicacao({ ...ok, temaNoAr: true }).faltam).toEqual([]);
  });
  it("sem loja não bloqueia, mas avisa que sai como Em breve", () => {
    const base = { dores: ["x"], diferenciais: ["x"], naoEPara: ["x"], faq: [1], sumario: ["x"], amostras: 3, amostraPdf: "a.pdf", preco: 6499, lojasAtivas: 1 };
    expect(paraVenderMelhor(base)).toEqual([]);
    expect(paraVenderMelhor({ ...base, lojasAtivas: 0 })[0]).toContain("Em breve");
    expect(paraVenderMelhor({ ...base, preco: null })[0]).toContain("Sem preço");
    expect(paraVenderMelhor({ ...base, amostras: 2, dores: [] })).toHaveLength(2);
  });
});
