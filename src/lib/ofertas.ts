import type { Plataforma } from "@/db/schema";

export const NOME_PLATAFORMA: Record<Plataforma, string> = {
  hotmart: "Hotmart",
  kiwify: "Kiwify",
  cakto: "Cakto",
  eduzz: "Eduzz",
  monetizze: "Monetizze",
  ticto: "Ticto",
  perfectpay: "PerfectPay",
  amazon: "Amazon",
  google_play: "Google Play Livros",
  outra: "outra plataforma",
};

export const rotuloOferta = (o: { plataforma: Plataforma; rotulo: string | null }) =>
  o.rotulo?.trim() || `Comprar na ${NOME_PLATAFORMA[o.plataforma]}`;

/** Parâmetros de origem repassados ao checkout (docs/04-vendas-e-medicao.md, seção 4). */
export const PARAMETROS_REPASSADOS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "src",
  "sck",
  "fbclid",
  "gclid",
] as const;

/**
 * Parâmetros de origem de um clique em /ir. Normalmente vêm na própria URL (o link da landing os leva), mas quem
 * clica antes de o JavaScript carregar chega sem eles: nesse caso recuperamos da página de onde a pessoa veio
 * (cabeçalho Referer), e só se for do próprio site, para ninguém injetar parâmetros de fora.
 */
export function parametrosDeOrigem(recebidos: URLSearchParams, referer: string | null, origemDoSite: string): URLSearchParams {
  if (PARAMETROS_REPASSADOS.some((k) => recebidos.has(k)) || !referer) return recebidos;
  try {
    const r = new URL(referer);
    return r.origin === origemDoSite ? r.searchParams : recebidos;
  } catch {
    return recebidos;
  }
}

/**
 * Monta a URL final do checkout: mantém a query da URL cadastrada e acrescenta os parâmetros de origem
 * recebidos. Se o mesmo parâmetro existir nos dois, vale o recebido (é a origem real da visita).
 * Só aceita https; qualquer outra coisa devolve null (nunca redirecionamos para esquemas estranhos).
 */
export function urlDestino(urlOferta: string, recebidos: URLSearchParams): string | null {
  let alvo: URL;
  try {
    alvo = new URL(urlOferta);
  } catch {
    return null;
  }
  if (alvo.protocol !== "https:") return null;
  for (const chave of PARAMETROS_REPASSADOS) {
    const valor = recebidos.get(chave);
    if (valor) alvo.searchParams.set(chave, valor.slice(0, 200));
  }
  return alvo.toString();
}

const ORIGENS = /^(meta|facebook|instagram|google|bing|tiktok|youtube|pinterest|whatsapp|telegram|email|x|twitter|linkedin|direto)$|^parceiro-[a-z0-9-]{1,30}$/;

/** Origem para as métricas: só valores da convenção (docs/04, seção 3); o resto vira "outro", para ninguém encher a tabela. */
export function origemDaVisita(utmSource: string | null | undefined): string {
  const v = (utmSource ?? "").toLowerCase().trim();
  if (!v) return "direto";
  return ORIGENS.test(v) ? v : "outro";
}
