import { describe, expect, it } from "vitest";
import { hashSenha as hashDoScript } from "../../scripts/criar-owner.mjs";
import { conferirSenha, hashSenha, senhaTemporaria } from "./senha";

describe("senha", () => {
  it("confere a senha certa e recusa a errada", async () => {
    const hash = await hashSenha("uma senha longa 123");
    expect(await conferirSenha({ hash, password: "uma senha longa 123" })).toBe(true);
    expect(await conferirSenha({ hash, password: "uma senha longa 124" })).toBe(false);
  });

  it("nunca repete o hash da mesma senha (sal aleatório)", async () => {
    expect(await hashSenha("igual-igual-1")).not.toBe(await hashSenha("igual-igual-1"));
  });

  it("recusa hash malformado sem lançar erro", async () => {
    expect(await conferirSenha({ hash: "", password: "x" })).toBe(false);
    expect(await conferirSenha({ hash: "sem-dois-pontos", password: "x" })).toBe(false);
  });

  it("o hash do scripts/criar-owner.mjs é aceito pelo login", async () => {
    const hash = await hashDoScript("senha do administrador");
    expect(await conferirSenha({ hash, password: "senha do administrador" })).toBe(true);
  });

  it("a senha temporária tem 14 caracteres legíveis e muda a cada vez", () => {
    const a = senhaTemporaria();
    expect(a).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{14}$/);
    expect(senhaTemporaria()).not.toBe(a);
  });
});
