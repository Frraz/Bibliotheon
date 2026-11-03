import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

/** Grava bytes recebidos (API ou painel) na mídia pública e devolve a chave. */
export function guardarBytes(ebookId: string, bytes: Buffer, ext: ".pdf" | ".jpg" | ".png" | ".webp") {
  const chave = `ebook/${ebookId}/${sha256(bytes).slice(0, 12)}${ext}`;
  const destino = join(/*turbopackIgnore: true*/ MEDIA_DIR(), chave);
  if (!existsSync(destino)) {
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, bytes);
  }
  return chave;
}

export const guardarPdf = (ebookId: string, bytes: Buffer) => guardarBytes(ebookId, bytes, ".pdf");

// PDF completo do livro: pasta irmã da mídia, que o /m nunca serve (data/media → data/privado).
export const PRIVADO_DIR = () => process.env.PRIVADO_DIR ?? join(dirname(MEDIA_DIR()), "privado");

/** Guarda o PDF completo fora da pasta pública. O nome do arquivo é só o hash: o nome original fica no banco. */
export function guardarPdfPrivado(ebookId: string, bytes: Buffer) {
  const chave = `${ebookId}/${sha256(bytes).slice(0, 16)}.pdf`;
  const destino = join(/*turbopackIgnore: true*/ PRIVADO_DIR(), chave);
  if (!existsSync(destino)) {
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, bytes);
  }
  return chave;
}

/** Caminho no disco de um PDF privado, a partir da chave que está no banco (nunca de entrada do usuário). */
export function caminhoDoPdfPrivado(chave: string) {
  const base = resolve(/*turbopackIgnore: true*/ process.cwd(), PRIVADO_DIR());
  const caminho = normalize(join(base, chave));
  return caminho.startsWith(base + sep) ? caminho : null;
}

/** Caminho seguro no disco para uma chave vinda da URL; null se tentar sair da pasta de mídia. */
export function caminhoDaMidia(partes: string[]): { caminho: string; tipo: string } | null {
  const base = resolve(/*turbopackIgnore: true*/ process.cwd(), MEDIA_DIR()); // aceita caminho relativo ou absoluto
  const caminho = normalize(join(base, ...partes));
  const tipo = EXT_PERMITIDAS[extname(caminho).toLowerCase()];
  if (!tipo || !(caminho === base || caminho.startsWith(base + sep))) return null;
  return { caminho, tipo };
}
