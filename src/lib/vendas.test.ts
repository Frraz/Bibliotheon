import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { autenticar, lerEvento, reaisParaCentavos } from "./vendas";

const pedido = (corpo: string, headers: Record<string, string> = {}, url = "https://x.test/api/v1/vendas/k/livro") => ({ headers: new Headers(headers), url, corpo });

describe("autenticar", () => {
  it("sem segredo configurado, ninguém entra", () => {
    expect(autenticar("hotmart", pedido("{}", { "x-hotmart-hottok": "abc" }), {})).toBe(false);
  });

  it("Hotmart: header igual ao token", () => {
    const env = { HOTMART_HOTTOK: "abc" };
    expect(autenticar("hotmart", pedido("{}", { "x-hotmart-hottok": "abc" }), env)).toBe(true);
    expect(autenticar("hotmart", pedido("{}", { "x-hotmart-hottok": "abd" }), env)).toBe(false);
    expect(autenticar("hotmart", pedido("{}"), env)).toBe(false);
  });

  it("Kiwify: HMAC-SHA1 do corpo cru (vetor da documentação oficial)", () => {
    const corpo = '{"order_id":"9b1c2d3e-0000-4000-8000-000000000001","order_status":"paid","webhook_event_type":"order_approved"}';
    const env = { KIWIFY_WEBHOOK_TOKEN: "kiwify-token-de-teste" };
    const url = "https://x.test/api/v1/vendas/kiwify/livro?signature=bf18f352a4f981b91dfa3f6d8742a81080ab8c86";
    expect(autenticar("kiwify", pedido(corpo, {}, url), env)).toBe(true);
    expect(autenticar("kiwify", pedido(corpo + " ", {}, url), env)).toBe(false); // corpo alterado
    expect(autenticar("kiwify", pedido(corpo), env)).toBe(false); // sem assinatura
  });

  it("Cakto: assinatura v1 com horário recente, ou o secret do corpo quando não há header", () => {
    const env = { CAKTO_WEBHOOK_SECRET: "segredo" };
    const corpo = '{"event":"purchase_approved","data":{"id":"x"}}';
    const agora = 1_800_000_000_000;
    const ts = String(agora / 1000);
    const v1 = `v1=${createHmac("sha256", "segredo").update(`${ts}.${corpo}`).digest("hex")}`;
    expect(autenticar("cakto", pedido(corpo, { "x-cakto-timestamp": ts, "x-cakto-signature": v1 }), env, agora)).toBe(true);
    expect(autenticar("cakto", pedido(corpo, { "x-cakto-timestamp": ts, "x-cakto-signature": v1 }), env, agora + 10 * 60_000)).toBe(false); // repetição antiga
    expect(autenticar("cakto", pedido(corpo, { "x-cakto-timestamp": ts, "x-cakto-signature": "v1=00" }), env, agora)).toBe(false);
    expect(autenticar("cakto", pedido('{"secret":"segredo","event":"purchase_approved"}'), env)).toBe(true);
    expect(autenticar("cakto", pedido('{"secret":"errado"}'), env)).toBe(false);
    expect(autenticar("cakto", pedido("não é json"), env)).toBe(false);
  });
});

describe("lerEvento", () => {
  it("Cakto: compra aprovada em reais, afiliado e origem; `data` em lista (V2)", () => {
    const e = lerEvento("cakto", { event: "purchase_approved", data: [{ id: "b3df", amount: 24.99, currency: "BRL", affiliate: "a@b.c", utm_source: "instagram" }] });
    expect(e).toEqual({ transacao: "b3df", tipo: "aprovada", valor: 2499, afiliado: true, origem: "instagram" });
  });

  it("Cakto: sem afiliado e origem fora da convenção vira 'outro'", () => {
    const e = lerEvento("cakto", { event: "purchase_approved", data: { id: "1", amount: 64.99, affiliate: "", utm_source: "qualquer-coisa" } });
    expect(e).toMatchObject({ afiliado: false, origem: "outro", valor: 6499 });
  });

  it("reembolso e chargeback viram 'reembolsada'; outros eventos são ignorados", () => {
    expect(lerEvento("cakto", { event: "refund", data: { id: "1" } })).toMatchObject({ tipo: "reembolsada", valor: null });
    expect(lerEvento("kiwify", { order_id: "o1", webhook_event_type: "chargeback" })).toMatchObject({ tipo: "reembolsada" });
    expect(lerEvento("kiwify", { order_id: "o1", webhook_event_type: "order_rejected" })).toBe("ignorado");
    expect(lerEvento("cakto", { event: "checkout_abandonment", data: { id: "1" } })).toBe("ignorado");
  });

  it("Kiwify: id e tipo documentados; sem valor lido (a rota usa o preço vigente)", () => {
    expect(lerEvento("kiwify", { order_id: "o1", order_status: "paid", webhook_event_type: "order_approved" })).toEqual({
      transacao: "o1", tipo: "aprovada", valor: null, afiliado: false, origem: "direto",
    });
  });

  it("Hotmart (formato v2 por fonte secundária): valor, afiliado e origem", () => {
    const e = lerEvento("hotmart", {
      event: "PURCHASE_APPROVED",
      data: { purchase: { transaction: "HP1", price: { value: 64.99, currency_value: "BRL" }, origin: { src: "youtube" } }, commissions: [{ source: "PRODUCER" }, { source: "AFFILIATE" }] },
    });
    expect(e).toEqual({ transacao: "HP1", tipo: "aprovada", valor: 6499, afiliado: true, origem: "youtube" });
    expect(lerEvento("hotmart", { event: "PURCHASE_REFUNDED", data: { purchase: { transaction: "HP1" } } })).toMatchObject({ tipo: "reembolsada" });
  });

  it("moeda estrangeira não vira reais; formato desconhecido é 'ilegivel'", () => {
    expect(lerEvento("hotmart", { event: "PURCHASE_APPROVED", data: { purchase: { transaction: "HP2", price: { value: 10, currency_value: "USD" } } } })).toMatchObject({ valor: null });
    expect(lerEvento("hotmart", { evento: "outro" })).toBe("ilegivel");
    expect(lerEvento("cakto", { event: "purchase_approved", data: {} })).toBe("ilegivel");
    expect(lerEvento("kiwify", null)).toBe("ilegivel");
  });
});

describe("reaisParaCentavos", () => {
  it("converte número e texto; recusa zero, negativo e lixo", () => {
    expect(reaisParaCentavos(24.99)).toBe(2499);
    expect(reaisParaCentavos("64,99")).toBe(6499);
    expect(reaisParaCentavos(0)).toBeNull();
    expect(reaisParaCentavos("abc")).toBeNull();
    expect(reaisParaCentavos(-5)).toBeNull();
  });
});
