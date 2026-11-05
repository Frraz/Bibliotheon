import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { origemDaVisita } from "./ofertas";

// Webhooks de venda das lojas. Guarda só o necessário para medir (docs/decisoes.md, 04/11/2026): id da transação, valor,
// origem e se foi afiliado. Nada do comprador. Os formatos abaixo têm níveis de confiança diferentes (ver cada leitor).

export const PLATAFORMAS_VENDA = ["hotmart", "kiwify", "cakto"] as const;
export type PlataformaVenda = (typeof PLATAFORMAS_VENDA)[number];
export const ehPlataformaVenda = (v: string): v is PlataformaVenda => (PLATAFORMAS_VENDA as readonly string[]).includes(v);

/** Variável de ambiente com o segredo de cada loja. Sem ela, ninguém entra. */
export const SEGREDO_DA_LOJA: Record<PlataformaVenda, string> = {
  hotmart: "HOTMART_HOTTOK",
  kiwify: "KIWIFY_WEBHOOK_TOKEN",
  cakto: "CAKTO_WEBHOOK_SECRET",
};

export type EventoVenda = {
  transacao: string;
  tipo: "aprovada" | "reembolsada";
  /** Centavos; null quando a loja não mandou um valor que saibamos ler (a rota usa o preço vigente). */
  valor: number | null;
  afiliado: boolean;
  origem: string;
};

const resumo = (t: string) => createHash("sha256").update(t).digest();
const igual = (a: string, b: string) => timingSafeEqual(resumo(a), resumo(b));

type Pedido = { headers: Headers; url: string; corpo: string };

/**
 * Confere a origem do aviso. Cada loja faz de um jeito:
 * - Hotmart: header `X-HOTMART-HOTTOK` igual ao token da conta;
 * - Kiwify (documentado): query `signature` = HMAC-SHA1 (hex) do corpo cru, com o token do webhook como chave;
 * - Cakto (documentado): `X-Cakto-Signature: v1=<HMAC-SHA256 de "{timestamp}.{corpo}">` com tolerância de 5 minutos;
 *   sem o header, vale o campo `secret` do corpo (também documentado).
 */
export function autenticar(plataforma: PlataformaVenda, pedido: Pedido, env: Record<string, string | undefined> = process.env, agora = Date.now()) {
  const segredo = env[SEGREDO_DA_LOJA[plataforma]];
  if (!segredo) return false;

  if (plataforma === "hotmart") {
    const recebido = pedido.headers.get("x-hotmart-hottok");
    return !!recebido && igual(segredo, recebido);
  }

  if (plataforma === "kiwify") {
    const recebido = new URL(pedido.url, "http://x").searchParams.get("signature");
    if (!recebido) return false;
    return igual(createHmac("sha1", segredo).update(pedido.corpo).digest("hex"), recebido.toLowerCase());
  }

  const assinatura = pedido.headers.get("x-cakto-signature");
  if (assinatura) {
    const ts = pedido.headers.get("x-cakto-timestamp") ?? "";
    if (!/^\d{9,12}$/.test(ts) || Math.abs(agora / 1000 - Number(ts)) > 300) return false;
    const esperado = `v1=${createHmac("sha256", segredo).update(`${ts}.${pedido.corpo}`).digest("hex")}`;
    return igual(esperado, assinatura);
  }
  try {
    const { secret } = JSON.parse(pedido.corpo) as { secret?: unknown };
    return typeof secret === "string" && igual(segredo, secret);
  } catch {
    return false;
  }
}

const eh = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const caminho = (o: unknown, c: string): unknown => c.split(".").reduce<unknown>((x, k) => (eh(x) ? x[k] : undefined), o);
const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : typeof v === "number" ? String(v) : null);
const primeiro = (...v: unknown[]) => v.map(texto).find((t) => t !== null) ?? null;

/** Reais decimais ("49.9" ou 49.9) para centavos; null se não for um número positivo. */
export function reaisParaCentavos(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 && n < 100_000 ? Math.round(n * 100) : null;
}

type Leitura = EventoVenda | "ignorado" | "ilegivel";

/** Hotmart, webhook v2. NÃO conferido na documentação oficial (a página não abriu): campos conforme fonte secundária; testar com o "enviar teste" da Hotmart. */
function lerHotmart(j: unknown): Leitura {
  const evento = texto(caminho(j, "event"));
  if (!evento) return "ilegivel";
  if (evento !== "PURCHASE_APPROVED" && evento !== "PURCHASE_REFUNDED" && evento !== "PURCHASE_CHARGEBACK") return "ignorado";
  const transacao = texto(caminho(j, "data.purchase.transaction"));
  if (!transacao) return "ilegivel";
  const moeda = texto(caminho(j, "data.purchase.price.currency_value"));
  const comissoes = caminho(j, "data.commissions");
  return {
    transacao,
    tipo: evento === "PURCHASE_APPROVED" ? "aprovada" : "reembolsada",
    valor: moeda && moeda !== "BRL" ? null : reaisParaCentavos(caminho(j, "data.purchase.price.value")),
    afiliado: Array.isArray(comissoes) && comissoes.some((c) => eh(c) && c.source === "AFFILIATE"),
    origem: origemDaVisita(primeiro(caminho(j, "data.purchase.origin.src"), caminho(j, "data.purchase.origin.sck"))),
  };
}

/**
 * Kiwify. Documentado: `order_id`, `order_status` e `webhook_event_type` (order_approved, order_refunded, chargeback).
 * NÃO documentado nas páginas lidas: valor, afiliado e origem. O valor fica nulo (a rota usa o preço vigente) e a origem
 * só é lida se o campo `TrackingParameters` existir; senão, "direto".
 */
function lerKiwify(j: unknown): Leitura {
  const evento = texto(caminho(j, "webhook_event_type"));
  const transacao = texto(caminho(j, "order_id"));
  if (!evento || !transacao) return "ilegivel";
  if (evento !== "order_approved" && evento !== "order_refunded" && evento !== "chargeback") return "ignorado";
  return {
    transacao,
    tipo: evento === "order_approved" ? "aprovada" : "reembolsada",
    valor: null,
    afiliado: false,
    origem: origemDaVisita(primeiro(caminho(j, "TrackingParameters.utm_source"), caminho(j, "TrackingParameters.src"))),
  };
}

/** Cakto. Documentado: `event`, `data.id`, `data.amount` (reais), `data.affiliate`, `data.utm_source`, `data.sck`. A V2 manda `data` como lista. */
function lerCakto(j: unknown): Leitura {
  const evento = texto(caminho(j, "event"));
  if (!evento) return "ilegivel";
  if (evento !== "purchase_approved" && evento !== "refund" && evento !== "chargeback") return "ignorado";
  const bruto = caminho(j, "data");
  const data = Array.isArray(bruto) ? bruto[0] : bruto;
  const transacao = texto(caminho(data, "id"));
  if (!transacao) return "ilegivel";
  const moeda = texto(caminho(data, "currency"));
  return {
    transacao,
    tipo: evento === "purchase_approved" ? "aprovada" : "reembolsada",
    valor: moeda && moeda !== "BRL" ? null : reaisParaCentavos(caminho(data, "amount")),
    afiliado: !!texto(caminho(data, "affiliate")),
    origem: origemDaVisita(primeiro(caminho(data, "utm_source"), caminho(data, "src"))),
  };
}

export function lerEvento(plataforma: PlataformaVenda, json: unknown): Leitura {
  if (!eh(json)) return "ilegivel";
  return plataforma === "hotmart" ? lerHotmart(json) : plataforma === "kiwify" ? lerKiwify(json) : lerCakto(json);
}
