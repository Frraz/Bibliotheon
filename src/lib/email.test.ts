import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emailConfigurado, emailDeRedefinicao, enviarEmail } from "./email";

afterEach(() => vi.unstubAllEnvs());

describe("e-mail", () => {
  it("só está configurado com SMTP_HOST ou pasta de saída", () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("EMAIL_SAIDA_DIR", "");
    expect(emailConfigurado()).toBe(false);
    vi.stubEnv("SMTP_HOST", "smtp.gmail.com");
    expect(emailConfigurado()).toBe(true);
  });

  it("sem SMTP, enviar falha com a instrução em vez de fingir que enviou", async () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("EMAIL_SAIDA_DIR", "");
    await expect(enviarEmail({ para: "a@b.com", assunto: "x", texto: "x", html: "x" })).rejects.toThrow(/SMTP_HOST/);
  });

  it("com pasta de saída, grava a mensagem e o remetente padrão", async () => {
    const dir = mkdtempSync(join(tmpdir(), "emails-"));
    vi.stubEnv("EMAIL_SAIDA_DIR", dir);
    vi.stubEnv("SMTP_USUARIO", "loja@gmail.com");
    vi.stubEnv("EMAIL_REMETENTE", "");
    await enviarEmail({ para: "a@b.com", assunto: "Oi", texto: "t", html: "h" });
    const [arquivo] = readdirSync(dir);
    expect(JSON.parse(readFileSync(join(dir, arquivo), "utf8"))).toMatchObject({ de: "Bibliotheon <loja@gmail.com>", para: "a@b.com", assunto: "Oi" });
  });

  it("o e-mail de redefinição traz o link inteiro e escapa o nome no HTML", () => {
    const link = "https://bibliotheon.com.br/api/auth/reset-password/abc?callbackURL=%2Fredefinir-senha";
    const m = emailDeRedefinicao('<b>Ana</b> Souza', link);
    expect(m.texto).toContain(link);
    expect(m.texto).toContain("Olá, <b>Ana</b>.");
    expect(m.html).toContain("Olá, &lt;b&gt;Ana&lt;/b&gt;.");
    expect(m.html).not.toContain("<b>Ana");
    expect(emailDeRedefinicao("", link).texto.startsWith("Olá.")).toBe(true);
  });
});
