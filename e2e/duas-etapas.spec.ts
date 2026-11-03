import { expect, test, type Browser, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { createHmac } from "node:crypto";

// Senha curta (a partir de 4 caracteres, mesmo repetida) e verificação em duas etapas opcional: ligar, entrar com o código,
// entrar com um código de reserva (que só vale uma vez) e desligar. O código do aplicativo é calculado aqui (RFC 6238).
test.describe.configure({ mode: "serial" });

const EMAIL = "duasetapas@teste.com";
const SENHA_CURTA = "1111";
let proximoIp = 1;
let chave = "";
let reservas: string[] = [];
let senhaInicial = "";
const alerta = (page: Page) => page.locator("p[role=alert]");

function totp(chaveBase32: string) {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of chaveBase32.replace(/=+$/, "").toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, "0");
  const chaveBytes = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const h = createHmac("sha1", chaveBytes).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

async function abrir(browser: Browser) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-real-ip": `192.0.2.${proximoIp++}` } });
  return ctx.newPage();
}

async function entrarComSenha(page: Page, senha: string) {
  await page.goto("/entrar");
  await page.getByRole("textbox", { name: "E-mail" }).fill(EMAIL);
  await page.locator("#senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("troca a senha por uma curta e repetida (4 caracteres) e entra com ela", async ({ browser }) => {
  const saida = execFileSync("node", ["scripts/criar-owner.mjs", EMAIL, "Duas Etapas"], { env: { ...process.env, DATABASE_PATH: ".e2e/data/bibliotheon.db" }, encoding: "utf8" });
  senhaInicial = /Senha temporária.*: (\S+)/.exec(saida)![1];

  const page = await abrir(browser);
  await entrarComSenha(page, senhaInicial);
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/painel/conta");
  await page.locator("#atual").fill(senhaInicial);
  await page.locator("#nova").fill(SENHA_CURTA);
  await page.locator("#confirmar").fill(SENHA_CURTA);
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Senha trocada" })).toBeVisible();

  const outra = await abrir(browser);
  await entrarComSenha(outra, SENHA_CURTA);
  await expect(outra).toHaveURL(/\/painel$/);
});

test("liga a verificação em duas etapas: senha, QR/chave, código do aplicativo e códigos de reserva", async ({ browser }) => {
  const page = await abrir(browser);
  await entrarComSenha(page, SENHA_CURTA);
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/painel/conta");
  await expect(page.getByText("Desligada.")).toBeVisible();

  await page.getByRole("button", { name: "Ligar a verificação em duas etapas" }).click();
  await page.locator("#senha-2fa").fill("senha-errada");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(alerta(page)).toContainText("não confere");

  await page.locator("#senha-2fa").fill(SENHA_CURTA);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByAltText("QR code para o aplicativo autenticador")).toBeVisible();
  chave = (await page.locator("code").first().innerText()).trim();
  expect(chave).toMatch(/^[A-Z2-7]{16,}$/);

  await page.locator("#codigo-2fa").fill("000000");
  await page.getByRole("button", { name: "Ligar a verificação" }).click();
  await expect(alerta(page)).toContainText("não confere");

  await page.locator("#codigo-2fa").fill(totp(chave));
  await page.getByRole("button", { name: "Ligar a verificação" }).click();
  await expect(page.getByRole("status").filter({ hasText: "ligada" })).toBeVisible();
  reservas = await page.locator("ul li").allInnerTexts();
  expect(reservas).toHaveLength(10);
  await page.getByRole("button", { name: "Já guardei" }).click();
  await expect(page.getByText(/^Ligada\./)).toBeVisible();
});

test("com a verificação ligada, a senha sozinha não abre o painel; o código do aplicativo abre", async ({ browser }) => {
  const page = await abrir(browser);
  await entrarComSenha(page, SENHA_CURTA);
  await expect(page.getByLabel("Código do aplicativo")).toBeVisible();
  await expect(page).toHaveURL(/\/entrar/);
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/entrar/); // ainda sem sessão

  await entrarComSenha(page, SENHA_CURTA);
  await page.locator("#codigo").fill("000000");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(alerta(page)).toContainText("incorreto");
  await page.locator("#codigo").fill(totp(chave));
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page).toHaveURL(/\/painel$/);
});

test("um código de reserva entra uma vez só", async ({ browser }) => {
  const primeira = await abrir(browser);
  await entrarComSenha(primeira, SENHA_CURTA);
  await primeira.getByRole("button", { name: "Usar um código de reserva" }).click();
  await primeira.locator("#codigo").fill(reservas[0]);
  await primeira.getByRole("button", { name: "Confirmar" }).click();
  await expect(primeira).toHaveURL(/\/painel$/);

  const segunda = await abrir(browser);
  await entrarComSenha(segunda, SENHA_CURTA);
  await segunda.getByRole("button", { name: "Usar um código de reserva" }).click();
  await segunda.locator("#codigo").fill(reservas[0]);
  await segunda.getByRole("button", { name: "Confirmar" }).click();
  await expect(alerta(segunda)).toContainText("incorreto");
});

test("desligar pede a senha e volta a entrar só com a senha", async ({ browser }) => {
  const page = await abrir(browser);
  await entrarComSenha(page, SENHA_CURTA);
  await page.locator("#codigo").fill(totp(chave));
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/painel/conta");
  await page.getByRole("button", { name: "Desligar" }).click();
  await page.locator("#senha-2fa").fill(SENHA_CURTA);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Desligada.")).toBeVisible();

  const sem = await abrir(browser);
  await entrarComSenha(sem, SENHA_CURTA);
  await expect(sem).toHaveURL(/\/painel$/);

});

test("celular perdido: criar-owner desliga a verificação junto com a senha nova", async ({ browser }) => {
  const banco = new Database(".e2e/data/bibliotheon.db");
  const id = (banco.prepare("SELECT id FROM user WHERE email = ?").get(EMAIL) as { id: string }).id;
  banco.prepare("UPDATE user SET two_factor_enabled = 1 WHERE id = ?").run(id);
  banco.prepare("INSERT INTO two_factor (id, user_id, secret, backup_codes) VALUES (?, ?, 'x', 'y')").run(crypto.randomUUID(), id);

  const saida = execFileSync("node", ["scripts/criar-owner.mjs", EMAIL], { env: { ...process.env, DATABASE_PATH: ".e2e/data/bibliotheon.db" }, encoding: "utf8" });
  const nova = /Senha temporária.*: (\S+)/.exec(saida)![1];
  expect(banco.prepare("SELECT two_factor_enabled AS n FROM user WHERE id = ?").get(id)).toEqual({ n: 0 });
  expect(banco.prepare("SELECT count(*) AS n FROM two_factor WHERE user_id = ?").get(id)).toEqual({ n: 0 });
  banco.close();

  const page = await abrir(browser);
  await entrarComSenha(page, nova);
  await expect(page).toHaveURL(/\/painel$/);
});
