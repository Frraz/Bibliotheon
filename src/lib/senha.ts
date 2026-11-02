import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Hash de senha com scrypt do Node (sem dependência nativa). Formato: <sal hex>:<hash hex>.
// scripts/criar-owner.mjs repete este algoritmo (roda na imagem Docker, que não tem tsx): senha.test.ts garante que os dois conferem.

const derivar = promisify(scrypt) as (senha: string, sal: Buffer, tamanho: number) => Promise<Buffer>;
const TAMANHO = 64;

export async function hashSenha(senha: string) {
  const sal = randomBytes(16);
  const hash = await derivar(senha.normalize("NFKC"), sal, TAMANHO);
  return `${sal.toString("hex")}:${hash.toString("hex")}`;
}

export async function conferirSenha({ hash, password }: { hash: string; password: string }) {
  const [sal, esperado] = hash.split(":");
  if (!sal || !esperado) return false;
  const calculado = await derivar(password.normalize("NFKC"), Buffer.from(sal, "hex"), TAMANHO);
  const guardado = Buffer.from(esperado, "hex");
  return guardado.length === calculado.length && timingSafeEqual(guardado, calculado);
}

// Sem 0/O, 1/l/I: a senha vai ser lida e digitada por uma pessoa.
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Senha temporária de 14 caracteres (~80 bits), mostrada uma vez ao administrador. */
export function senhaTemporaria() {
  return Array.from({ length: 14 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
}
