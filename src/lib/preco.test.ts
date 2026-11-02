import { describe, expect, it } from "vitest";
import { precoVigente } from "./preco";

const agora = new Date("2026-11-10T12:00:00Z");
const base = { preco: 7900, precoDe: 9900, emBreve: false };

describe("precoVigente", () => {
  it("durante a oferta: preço de lançamento, 'de' riscado e prazo", () => {
    const r = precoVigente({ ...base, ofertaAte: "2026-11-30T23:59:00Z" }, agora);
    expect(r).toMatchObject({ valor: 7900, riscado: 9900, emOferta: true });
    expect(r.ate?.toISOString()).toBe("2026-11-30T23:59:00.000Z");
  });

  it("depois do prazo: o preço sobe sozinho e some o riscado e a faixa", () => {
    const r = precoVigente({ ...base, ofertaAte: "2026-11-09T23:59:00Z" }, agora);
    expect(r).toEqual({ valor: 9900, riscado: null, ate: null, emOferta: false });
  });

  it("prazo vencido sem preço normal: mantém o preço, sem faixa", () => {
    const r = precoVigente({ preco: 7900, precoDe: null, ofertaAte: "2026-11-01T00:00:00Z" }, agora);
    expect(r).toEqual({ valor: 7900, riscado: null, ate: null, emOferta: false });
  });

  it("exatamente no instante do prazo, a oferta já acabou", () => {
    const r = precoVigente({ ...base, ofertaAte: agora }, agora);
    expect(r.emOferta).toBe(false);
    expect(r.valor).toBe(9900);
  });

  it("sem prazo: preço fixo, sem contagem", () => {
    expect(precoVigente({ ...base, ofertaAte: null }, agora)).toEqual({ valor: 7900, riscado: 9900, ate: null, emOferta: false });
    expect(precoVigente({ preco: 7900, precoDe: null, ofertaAte: null }, agora).riscado).toBeNull();
  });

  it("em breve ou sem preço: nada para cobrar", () => {
    const vazio = { valor: null, riscado: null, ate: null, emOferta: false };
    expect(precoVigente({ ...base, ofertaAte: null, emBreve: true }, agora)).toEqual(vazio);
    expect(precoVigente({ preco: null, precoDe: 9900, ofertaAte: "2030-01-01T00:00:00Z" }, agora)).toEqual(vazio);
  });

  it("data inválida é tratada como sem prazo", () => {
    expect(precoVigente({ ...base, ofertaAte: "isto não é data" }, agora).emOferta).toBe(false);
  });
});
