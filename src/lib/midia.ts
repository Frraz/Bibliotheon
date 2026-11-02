import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";

// Mídia (capas, amostras) fica em MEDIA_DIR, fora do código, e é servida por /m/<chave>.
// A chave é ebook/<id>/<sha8>.<ext>: o nome muda quando o arquivo muda, então o cache pode ser eterno.

export const MEDIA_DIR = () => process.env.MEDIA_DIR ?? "data/media";

export const EXT_PERMITIDAS: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
};

export const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Copia um arquivo para a mídia e devolve a chave e o hash completo. */
export function guardarMidia(ebookId: string, arquivo: string) {
  const bytes = readFileSync(arquivo);
  const hash = sha256(bytes);
  const ext = extname(arquivo).toLowerCase();
  if (!EXT_PERMITIDAS[ext]) throw new Error(`Tipo de arquivo não permitido: ${ext}`);
  const chave = `ebook/${ebookId}/${hash.slice(0, 12)}${ext}`;
  const destino = join(/*turbopackIgnore: true*/ MEDIA_DIR(), chave);
  if (!existsSync(destino)) {
    mkdirSync(dirname(destino), { recursive: true });
    copyFileSync(arquivo, destino);
  }
  return { chave, hash };
}

/** Caminho seguro no disco para uma chave vinda da URL; null se tentar sair da pasta de mídia. */
export function caminhoDaMidia(partes: string[]): { caminho: string; tipo: string } | null {
  const base = resolve(/*turbopackIgnore: true*/ process.cwd(), MEDIA_DIR()); // aceita caminho relativo ou absoluto
  const caminho = normalize(join(base, ...partes));
  const tipo = EXT_PERMITIDAS[extname(caminho).toLowerCase()];
  if (!tipo || !(caminho === base || caminho.startsWith(base + sep))) return null;
  return { caminho, tipo };
}
