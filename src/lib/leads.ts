import { z } from "zod";

export const pedidoDeAmostra = z.object({
  slug: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  aceite: z.literal(true),
  site: z.string().max(200).nullish(),
  origem: z.string().max(100).nullish(),
});

const ESPERA = 60_000;
const MAXIMO = 5;
const pedidos = new Map<string, { inicio: number; total: number }>();

/** Limite simples por IP, em memória (há um só processo). O IP não é guardado depois da janela. */
export function dentroDoLimite(ip: string, agora = Date.now()) {
  for (const [k, v] of pedidos) if (agora - v.inicio > ESPERA) pedidos.delete(k);
  const atual = pedidos.get(ip);
  if (!atual) {
    pedidos.set(ip, { inicio: agora, total: 1 });
    return true;
  }
  atual.total += 1;
  return atual.total <= MAXIMO;
}

/** CSV para a ferramenta de e-mail. Valores iniciados por = + - @ viram texto, para a planilha não os executar. */
export function linhaCsv(valores: string[]) {
  return valores.map((v) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`).join(",");
}
