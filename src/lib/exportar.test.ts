import { describe, expect, it } from "vitest";
import type { Ebook } from "@/db/schema";
import { dadosExportados, fichaMd, type EntradaExportacao } from "./exportar";

const data = new Date("2026-11-03T12:00:00Z");
const e = {
  id: "id-1", ownerId: "u", titulo: "Meu Livro", subtitulo: "Sub", slug: "meu-livro", status: "rascunho", idioma: "pt-BR", edicao: null, formatos: ["PDF"], capa: "ebook/1/c.jpg", capaAlt: "Capa",
  headline: "Faça isso", resumo: "r".repeat(120), problema: "P", descricao: "d".repeat(2100), dores: ["dor"], beneficios: ["a", "b"], diferenciais: [], paraQuem: [], naoEPara: [], incluido: [], observacoes: null,
  sobreAutor: null, autorExibido: "Autora", sumario: ["Cap 1"], faq: [{ p: "Como?", r: "Assim." }], amostraPdf: null, pdfPrivado: "segredo/abc123.pdf", pdfNome: "livro.pdf", preco: 4700, precoDe: 6499,
  ofertaAte: data, ofertaNome: "Black Friday", parcelamento: null, garantiaDias: 7, emBreve: false, seoTitle: null, seoDescription: null, publicadoEm: null, criadoEm: data, atualizadoEm: data,
} as unknown as Ebook;
const entrada: EntradaExportacao = {
  e, tema: { nome: "Saúde", slug: "saude" }, dono: "Ana", siteUrl: "https://site.test",
  amostras: [{ id: "a", ebookId: "id-1", imagem: "ebook/1/a.jpg", alt: "pág", ordem: 0 }],
  ofertas: [{ id: "o", ebookId: "id-1", plataforma: "hotmart", rotulo: null, url: "https://pay.test/x", urlPromo: "https://pay.test/p", preco: null, principal: true, ativa: true, ordem: 0 }],
};

describe("exportação", () => {
  it("o local do PDF privado nunca sai, nem no JSON nem no .md", () => {
    for (const texto of [JSON.stringify(dadosExportados(entrada)), fichaMd(entrada)]) {
      expect(texto).not.toContain("segredo");
      expect(texto).not.toContain("abc123");
      expect(texto).toContain("livro.pdf");
    }
  });

  it("traz tudo o que foi cadastrado, em reais e com endereços completos", () => {
    const d = dadosExportados(entrada);
    expect(d).toMatchObject({ titulo: "Meu Livro", status: "rascunho", dono: "Ana", preco: "47.00", precoDe: "64.99", capa: "https://site.test/m/ebook/1/c.jpg", pagina: "https://site.test/meu-livro" });
    expect(d.amostras[0].imagem).toBe("https://site.test/m/ebook/1/a.jpg");
    expect(d.lojas[0]).toMatchObject({ nome: "Hotmart", url: "https://pay.test/x", urlCampanha: "https://pay.test/p" });
    expect(d.campanha?.nome).toBe("Black Friday");
    expect(d.faq).toEqual([{ pergunta: "Como?", resposta: "Assim." }]);
  });

  it("o .md marca o vazio, cita os limites das lojas e avisa o que passou", () => {
    const md = fichaMd(entrada);
    expect(md).toContain("**Título do livro**\n```text\nMeu Livro\n```");
    expect(md).toContain("[vazio]");
    expect(md).toContain("a Hotmart aceita até 2000");
    expect(md).toContain("120/500");
    expect(md).toContain("Tags de busca");
  });

  it("sem PDF enviado, diz isso; sem campanha, não inventa prazo", () => {
    const sem = { ...entrada, e: { ...e, pdfPrivado: null, pdfNome: null, ofertaAte: null } as Ebook };
    expect(dadosExportados(sem).pdfDoLivro).toBeNull();
    expect(dadosExportados(sem).campanha).toBeNull();
    expect(fichaMd(sem)).toContain("[não enviado]");
    expect(fichaMd(sem)).not.toContain("Termina em");
  });
});
