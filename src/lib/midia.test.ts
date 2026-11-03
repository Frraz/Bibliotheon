import { afterEach, describe, expect, it, vi } from "vitest";
import { caminhoDaMidia, caminhoDoPdfPrivado, PRIVADO_DIR } from "./midia";

afterEach(() => vi.unstubAllEnvs());

describe("caminhoDaMidia", () => {
  it("resolve chave dentro da pasta de mídia (relativa ou absoluta)", () => {
    vi.stubEnv("MEDIA_DIR", "/app/data/media");
    expect(caminhoDaMidia(["ebook", "x", "a.jpg"])).toEqual({ caminho: "/app/data/media/ebook/x/a.jpg", tipo: "image/jpeg" });
    vi.stubEnv("MEDIA_DIR", "data/media");
    expect(caminhoDaMidia(["ebook", "x", "a.webp"])?.caminho).toBe(`${process.cwd()}/data/media/ebook/x/a.webp`);
  });

  it("recusa sair da pasta de mídia", () => {
    vi.stubEnv("MEDIA_DIR", "/app/data/media");
    expect(caminhoDaMidia(["..", "bibliotheon.db"])).toBeNull();
    expect(caminhoDaMidia(["ebook", "..", "..", "..", "etc", "passwd"])).toBeNull();
    expect(caminhoDaMidia(["..%2f..", "a.jpg"])?.caminho.startsWith("/app/data/media/")).toBe(true);
  });

  it("recusa extensões fora da lista (ex.: o próprio banco ou scripts)", () => {
    vi.stubEnv("MEDIA_DIR", "/app/data/media");
    expect(caminhoDaMidia(["ebook", "x", "a.db"])).toBeNull();
    expect(caminhoDaMidia(["ebook", "x", "a.html"])).toBeNull();
    expect(caminhoDaMidia(["ebook", "x", "a.svg"])).toBeNull();
  });
});

describe("PDF privado", () => {
  it("fica numa pasta irmã da mídia, que o /m nunca serve", () => {
    vi.stubEnv("MEDIA_DIR", "/app/data/media");
    expect(PRIVADO_DIR()).toBe("/app/data/privado");
    // o /m só serve o que está dentro de MEDIA_DIR: o PDF privado nunca é alcançado por ele
    expect(caminhoDaMidia(["..", "privado", "x", "a.pdf"])).toBeNull();
  });

  it("resolve só chaves dentro da pasta privada", () => {
    vi.stubEnv("MEDIA_DIR", "/app/data/media");
    expect(caminhoDoPdfPrivado("abc/0123456789abcdef.pdf")).toBe("/app/data/privado/abc/0123456789abcdef.pdf");
    expect(caminhoDoPdfPrivado("../bibliotheon.db")).toBeNull();
    expect(caminhoDoPdfPrivado("abc/../../media/x.pdf")).toBeNull();
  });
});
