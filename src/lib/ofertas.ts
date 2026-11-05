import type { Plataforma } from "@/db/schema";
import { precoVigente, type EntradaPreco } from "./preco";

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

/**
 * Símbolo oficial e cor de cada loja no bloco de compra. O símbolo só identifica onde a compra acontece (docs/decisoes.md, 04/11/2026).
 * Só o símbolo, sem o nome desenhado: ele se lê em fundo claro e escuro, e o nome vem em texto, na cor e na fonte da página.
 * Loja fora daqui aparece só com o texto.
 */
export const MARCA_LOJA: Partial<Record<Plataforma, { simbolo: string; cor: string }>> = {
  hotmart: { simbolo: "/lojas/hotmart.svg", cor: "#FF4000" },
  kiwify: { simbolo: "/lojas/kiwify.svg", cor: "#2DB56F" },
  cakto: { simbolo: "/lojas/cakto.svg", cor: "#3FC958" },
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
  // Hotmart e Kiwify guardam `src`; nem todas guardam `utm_source`. Copiar para `src` faz a venda chegar ao relatório com a origem.
  const origem = recebidos.get("utm_source");
  if (origem && !alvo.searchParams.has("src")) alvo.searchParams.set("src", origem.slice(0, 200));
  return alvo.toString();
}

/**
 * Qual checkout abrir agora. O link promocional só vale enquanto a oferta vigora: quando o prazo acaba,
 * a página e o botão voltam juntos ao preço normal, sem ninguém precisar fazer nada.
 */
export function urlVigente(o: { url: string; urlPromo: string | null }, e: EntradaPreco, agora: Date) {
  return o.urlPromo && precoVigente(e, agora).emOferta ? o.urlPromo : o.url;
}

/** Campanha sem link promocional mostraria um preço na página e cobraria outro no checkout. Devolve as ofertas nessa situação. */
export function ofertasSemLinkPromo<O extends { urlPromo: string | null }>(ofertas: O[], e: EntradaPreco, agora: Date): O[] {
  const v = precoVigente(e, agora);
  const mudaOPreco = v.emOferta && e.precoDe != null && e.precoDe !== e.preco;
  return mudaOPreco ? ofertas.filter((o) => !o.urlPromo) : [];
}

const ORIGENS = /^(meta|facebook|instagram|google|bing|tiktok|youtube|pinterest|whatsapp|telegram|email|x|twitter|linkedin|direto)$|^parceiro-[a-z0-9-]{1,30}$/;

/** Origem para as métricas: só valores da convenção (docs/04, seção 3); o resto vira "outro", para ninguém encher a tabela. */
export function origemDaVisita(utmSource: string | null | undefined): string {
  const v = (utmSource ?? "").toLowerCase().trim();
  if (!v) return "direto";
  return ORIGENS.test(v) ? v : "outro";
}

/** Buscador de onde a pessoa veio, pelo `document.referrer`. Só o buscador em si: mail.google.com e afins não são busca. */
export function origemDoReferrer(referrer: string | null | undefined): "google" | "bing" | null {
  let host: string;
  try {
    host = new URL(referrer ?? "").hostname.toLowerCase();
  } catch {
    return null;
  }
  if (/^(www\.)?google(\.[a-z]{2,3}){1,2}$/.test(host)) return "google";
  if (/^(www\.)?bing\.com$/.test(host)) return "bing";
  return null;
}

/**
 * Query da visita com a origem completa. Busca orgânica chega sem UTM: sem isto, a visita e o clique contariam como
 * "direto" e o relatório não mostraria o que veio do Google. Qualquer parâmetro de origem já presente vence (ex.: `gclid` é anúncio).
 */
export function buscaComOrigem(busca: string, referrer: string | null | undefined): string {
  const recebidos = new URLSearchParams(busca);
  const buscador = PARAMETROS_REPASSADOS.some((k) => recebidos.has(k)) ? null : origemDoReferrer(referrer);
  if (!buscador) return busca;
  recebidos.set("utm_source", buscador);
  recebidos.set("utm_medium", "organico");
  return `?${recebidos}`;
}
