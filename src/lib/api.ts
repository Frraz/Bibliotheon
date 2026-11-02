import { createHash, timingSafeEqual } from "node:crypto";

const resumo = (t: string) => createHash("sha256").update(t).digest();

/** Confere `Authorization: Bearer <token>` com API_TOKEN. Sem API_TOKEN configurado, ninguém entra. */
export function autorizado(req: Request) {
  const esperado = process.env.API_TOKEN;
  const recebido = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return !!esperado && !!recebido && timingSafeEqual(resumo(esperado), resumo(recebido));
}

export const erro = (mensagem: string, status: number, detalhes?: unknown) => Response.json({ erro: mensagem, detalhes }, { status });
export const naoAutorizado = () => erro("Token ausente ou inválido.", 401);
