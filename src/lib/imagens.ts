import sharp from "sharp";

export const LIMITE_IMAGEM = 10 * 1024 * 1024;
/** PNG sem transparência acima disto vira JPEG. */
export const LIMITE_PNG_PESADO = 1_500_000;

export type ImagemPronta = { ok: true; bytes: Buffer; ext: ".jpg" | ".png" | ".webp"; largura: number; altura: number } | { ok: false; erro: string };

/**
 * Confere e limpa uma imagem enviada: o formato vem do conteúdo (não do nome), tem largura mínima, é endireitada
 * e regravada sem os metadados (EXIF: local, data e câmera de quem fotografou). Largura acima do máximo é reduzida.
 */
export async function prepararImagem(entrada: Buffer, { larguraMinima, larguraMaxima = 2400 }: { larguraMinima: number; larguraMaxima?: number }): Promise<ImagemPronta> {
  if (entrada.length > LIMITE_IMAGEM) return { ok: false, erro: "Essa imagem passa de 10 MB. Reduza o arquivo e tente de novo." };
  try {
    const original = sharp(entrada, { limitInputPixels: 50_000_000 });
    const meta = await original.metadata();
    if (meta.format !== "jpeg" && meta.format !== "png" && meta.format !== "webp") return { ok: false, erro: "Use uma imagem JPG, PNG ou WebP." };
    // A largura "de verdade" considera a rotação do EXIF (fotos de celular).
    const girada = (meta.orientation ?? 1) >= 5;
    const largura = (girada ? meta.height : meta.width) ?? 0;
    if (largura < larguraMinima) return { ok: false, erro: `Essa imagem é muito pequena. Use pelo menos ${larguraMinima} px de largura.` };

    const base = original.rotate().resize({ width: larguraMaxima, withoutEnlargement: true });
    // PNG de ilustração ou arte gerada costuma passar de 5 MB e não tem transparência: em JPEG fica de 5 a 10 vezes menor,
    // sem diferença visível a q88. Com transparência (ou PNG já leve), segue PNG.
    if (meta.format === "png" && !meta.hasAlpha) {
      const png = await base.clone().png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
      if (png.data.length > LIMITE_PNG_PESADO) {
        const jpg = await base.jpeg({ quality: 88, mozjpeg: true }).toBuffer({ resolveWithObject: true });
        return { ok: true, bytes: jpg.data, ext: ".jpg", largura: jpg.info.width, altura: jpg.info.height };
      }
      return { ok: true, bytes: png.data, ext: ".png", largura: png.info.width, altura: png.info.height };
    }
    const { data, info } =
      meta.format === "jpeg" ? await base.jpeg({ quality: 88, mozjpeg: true }).toBuffer({ resolveWithObject: true })
      : meta.format === "png" ? await base.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
      : await base.webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
    return { ok: true, bytes: data, ext: meta.format === "jpeg" ? ".jpg" : meta.format === "png" ? ".png" : ".webp", largura: info.width, altura: info.height };
  } catch {
    return { ok: false, erro: "Não consegui ler essa imagem. Tente salvá-la de novo como JPG ou PNG." };
  }
}

/** Confere a assinatura %PDF- e o tamanho. */
export function conferirPdf(bytes: Buffer, limite: number): string | null {
  if (bytes.length === 0) return "O arquivo está vazio.";
  if (bytes.length > limite) return `O PDF passa de ${Math.round(limite / 1024 / 1024)} MB.`;
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return "O arquivo não é um PDF.";
  return null;
}
