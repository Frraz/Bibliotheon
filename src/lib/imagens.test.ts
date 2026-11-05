import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { LIMITE_PNG_PESADO, prepararImagem } from "./imagens";

// "Foto": gradiente com um pouco de ruído, o que deixa o PNG grande e o JPEG pequeno, como arte gerada.
async function arte(largura: number, altura: number, formato: "png" | "jpeg", alfa = false) {
  const canais = alfa ? 4 : 3;
  const ruido = randomBytes(largura * altura * canais);
  const bruto = Buffer.alloc(largura * altura * canais);
  for (let i = 0; i < bruto.length; i++) bruto[i] = ((i / canais) % 251) + (ruido[i] % 6);
  const s = sharp(bruto, { raw: { width: largura, height: altura, channels: canais } });
  return formato === "png" ? s.png({ compressionLevel: 1 }).toBuffer() : s.jpeg().toBuffer();
}

describe("prepararImagem", () => {
  it("PNG pesado e sem transparência vira JPEG, bem menor", async () => {
    const png = await arte(1300, 1700, "png");
    expect(png.length).toBeGreaterThan(LIMITE_PNG_PESADO);
    const r = await prepararImagem(png, { larguraMinima: 1200 });
    if (!r.ok) throw new Error(r.erro);
    expect(r.ext).toBe(".jpg");
    expect(r.bytes.length).toBeLessThan(png.length / 3);
    expect((await sharp(r.bytes).metadata()).format).toBe("jpeg");
  }, 30_000); // gera e comprime um PNG grande: sozinho leva ~1 s, mas passava de 5 s com os outros testes rodando juntos

  it("PNG com transparência segue PNG", async () => {
    const png = await arte(1300, 1300, "png", true);
    const r = await prepararImagem(png, { larguraMinima: 1200 });
    if (!r.ok) throw new Error(r.erro);
    expect(r.ext).toBe(".png");
  });

  it("PNG leve segue PNG", async () => {
    const png = await sharp({ create: { width: 1300, height: 2000, channels: 3, background: "#884422" } }).png().toBuffer();
    const r = await prepararImagem(png, { larguraMinima: 1200 });
    if (!r.ok) throw new Error(r.erro);
    expect(r.ext).toBe(".png");
  });

  it("JPEG segue JPEG; imagem pequena e arquivo estranho são recusados com a mensagem certa", async () => {
    const r = await prepararImagem(await arte(1300, 1300, "jpeg"), { larguraMinima: 1200 });
    if (!r.ok) throw new Error(r.erro);
    expect(r.ext).toBe(".jpg");
    const pequena = await prepararImagem(await arte(500, 500, "jpeg"), { larguraMinima: 1200 });
    expect(pequena).toEqual({ ok: false, erro: "Essa imagem é muito pequena. Use pelo menos 1200 px de largura." });
    const estranho = await prepararImagem(Buffer.from("isto não é imagem"), { larguraMinima: 1200 });
    expect(estranho.ok).toBe(false);
  });
});
