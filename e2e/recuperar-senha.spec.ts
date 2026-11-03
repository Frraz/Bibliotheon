import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";

// Os e-mails do servidor de teste viram arquivos JSON (EMAIL_SAIDA_DIR em scripts/servir-teste.sh).
test.describe.configure({ mode: "serial" });

const PASTA = ".e2e/emails";
const EMAIL = "recupera@teste.com";
const NOVA = "senha-nova-bem-longa-42";
let proximoIp = 1;
const alerta = (page: Page) => page.locator("p[role=alert]");
const emails = () => (existsSync(PASTA) ? readdirSync(PASTA).sort() : []);
// O arquivo aparece na pasta antes de o servidor terminar de gravá-lo: lê de novo até o JSON estar completo.
const ler = (arquivo: string) => {
  try {
    return JSON.parse(readFileSync(`${PASTA}/${arquivo}`, "utf8")) as { para: string; assunto: string; texto: string };
  } catch {
    return null;
  }
};

async function pedir(page: Page, email: string) {
  await page.setExtraHTTPHeaders({ "x-real-ip": `203.0.113.${proximoIp++}` });
  await page.goto("/esqueci-a-senha", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByRole("status")).toContainText("Se esse e-mail estiver cadastrado");
}

test("pedir a recuperação manda um e-mail com link; o link cria a senha nova uma única vez", async ({ page }) => {
  const saida = execFileSync("node", ["scripts/criar-owner.mjs", EMAIL, "Recupera Teste"], { env: { ...process.env, DATABASE_PATH: ".e2e/data/bibliotheon.db" }, encoding: "utf8" });
  const antiga = /Senha temporária.*: (\S+)/.exec(saida)![1];

  const antes = emails().length;
  await pedir(page, EMAIL);
  await expect.poll(() => emails().length).toBe(antes + 1);
  await expect.poll(() => ler(emails().at(-1)!)).not.toBeNull();
  const mensagem = ler(emails().at(-1)!)!;
  expect(mensagem.para).toBe(EMAIL);
  expect(mensagem.texto).toContain("Olá, Recupera.");
  const link = /https?:\/\/\S+\/api\/auth\/reset-password\/\S+/.exec(mensagem.texto)?.[0];
  expect(link).toBeTruthy();

  await page.goto(link!, { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/redefinir-senha\?token=/);
  await page.locator("#nova").fill(NOVA);
  await page.locator("#confirmar").fill(NOVA + "x");
  await page.getByRole("button", { name: "Salvar senha" }).click();
  await expect(alerta(page)).toContainText("não é igual");
  await page.locator("#nova").fill(NOVA);
  await page.locator("#confirmar").fill(NOVA);
  await page.getByRole("button", { name: "Salvar senha" }).click();
  await expect(page).toHaveURL(/\/entrar\?senha=nova$/);
  await expect(page.getByRole("status")).toContainText("Senha nova salva");

  // A senha antiga deixa de valer; a nova entra.
  await page.locator("#senha").fill(antiga);
  await page.getByRole("textbox", { name: "E-mail" }).fill(EMAIL);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(alerta(page)).toContainText("incorretos");
  await page.locator("#senha").fill(NOVA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/painel$/);

  // O mesmo link, outra vez, já não serve.
  await page.goto(link!);
  await expect(page).toHaveURL(/\/redefinir-senha/);
  await expect(page.getByText("venceu ou já foi usado")).toBeVisible();
});

test("e-mail desconhecido recebe a mesma resposta e nada é enviado", async ({ page }) => {
  const antes = emails().length;
  await pedir(page, "ninguem@teste.com");
  await page.waitForTimeout(500);
  expect(emails().length).toBe(antes);
});

test("a tela de entrada leva à recuperação", async ({ page }) => {
  await page.goto("/entrar", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Esqueci a senha" }).click();
  await expect(page.getByRole("heading", { name: "Esqueci a senha" })).toBeVisible();
});
