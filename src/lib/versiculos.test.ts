import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAXIMO_ESTREITO, VERSICULO_INICIAL, avancar, cabeNaLargura, lerEstado, ordemEmbaralhada, proximoQueCabe, type Versiculo } from "./versiculos";

const semente = () => 42;

describe("ordem dos versículos", () => {
  it("passa por todos sem repetir, e a mesma semente dá a mesma ordem", () => {
    const ordem = ordemEmbaralhada(500, 7);
    expect(new Set(ordem).size).toBe(500);
    expect(ordem).toEqual(ordemEmbaralhada(500, 7));
    expect(ordem).not.toEqual(ordemEmbaralhada(500, 8));
  });

  it("retoma da posição guardada", () => {
    expect(lerEstado(JSON.stringify({ semente: 9, pos: 3, total: 10 }), 10, semente)).toEqual({ semente: 9, pos: 3, total: 10 });
  });

  it.each([[null], ["{quebrado"], ["[]"], [JSON.stringify({ semente: 9, pos: 99, total: 10 })], [JSON.stringify({ semente: 9, pos: 1, total: 5 })], [JSON.stringify({ semente: "x", pos: 1, total: 10 })]])("com guardado inválido (%s) começa do zero", (g) => {
    expect(lerEstado(g, 10, semente)).toEqual({ semente: 42, pos: 0, total: 10 });
  });

  it("ao fim da lista, recomeça em outra ordem", () => {
    expect(avancar({ semente: 1, pos: 8, total: 10 }, semente).pos).toBe(9);
    expect(avancar({ semente: 1, pos: 9, total: 10 }, semente)).toEqual({ semente: 42, pos: 0, total: 10 });
  });

  it("no celular pula o versículo longo, sem repetir nem travar", () => {
    const lista: Versiculo[] = [{ t: "x".repeat(200), r: "A 1:1" }, { t: "curto", r: "B 1:1" }, { t: "breve", r: "C 1:1" }];
    let e = { semente: 3, pos: 0, total: 3 };
    const vistos: string[] = [];
    for (let i = 0; i < 2; i++) {
      const r = proximoQueCabe(lista, e, 360, () => 3)!;
      vistos.push(r.versiculo.r);
      e = r.estado;
    }
    expect(new Set(vistos)).toEqual(new Set(["B 1:1", "C 1:1"]));
    expect(proximoQueCabe(lista.slice(0, 1), { semente: 1, pos: 0, total: 1 }, 360, semente)).toBeNull();
    expect(proximoQueCabe([], { semente: 1, pos: 0, total: 0 }, 1280, semente)).toBeNull();
  });
});

describe("public/versiculos.json", () => {
  const lista = JSON.parse(readFileSync("public/versiculos.json", "utf8")) as Versiculo[];

  it("sem texto nem referência repetidos, e dentro do limite", () => {
    expect(lista.length).toBeGreaterThan(500);
    expect(new Set(lista.map((v) => v.t)).size).toBe(lista.length);
    expect(new Set(lista.map((v) => v.r)).size).toBe(lista.length);
    for (const v of lista) {
      expect(v.t.length).toBeLessThanOrEqual(155);
      expect(v.r).toMatch(/^\S.* \d+:\d+$/);
    }
  });

  it("o versículo inicial é da lista e cabe no celular", () => {
    expect(lista).toContainEqual(VERSICULO_INICIAL);
    expect(cabeNaLargura(VERSICULO_INICIAL, 360)).toBe(true);
  });

  it("sobra bastante para o celular", () => {
    expect(lista.filter((v) => v.t.length + v.r.length <= MAXIMO_ESTREITO).length).toBeGreaterThan(400);
  });
});
