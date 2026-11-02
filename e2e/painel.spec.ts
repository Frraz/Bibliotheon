import { expect, test, type Browser, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";

// Fluxo em série: o administrador (criado por scripts/criar-owner.mjs) cadastra, redefine e desativa um usuário.
test.describe.configure({ mode: "serial" });

const ORIGEM = "http://127.0.0.1:3101";
const senhaDoOwner = () => readFileSync(".e2e/senha-owner.txt", "utf8").trim();
let senhaDaAna = "";

// Atrás do nginx o limite de tentativas é por IP (X-Real-IP). Cada entrada do teste simula um IP próprio, senão as
// várias entradas seguidas do mesmo "IP" cairiam no limite de propósito (que o último teste confere).
let proximoIp = 1;
// O Next 16 mantém páginas anteriores ocultas no DOM: getByRole ignora o oculto, getByLabel não. Campos de senha não têm role textbox: por id.
const alerta = (page: Page) => page.locator("p[role=alert]"); // o anunciador de rotas do Next também usa role=alert

async function entrar(page: Page, email: string, senha: string) {
  await page.setExtraHTTPHeaders({ "x-real-ip": `198.51.100.${proximoIp++}` });
  await page.goto("/entrar");
  await page.getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.locator("#senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function comoOwner(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await entrar(page, "dono@teste.com", senhaDoOwner());
  await expect(page).toHaveURL(/\/painel$/);
  return { ctx, page };
}

test("sem sessão, /painel e /admin levam ao login", async ({ page }) => {
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto("/painel/usuarios");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("senha errada mostra o erro; senha certa abre o painel com o e-book importado", async ({ page }) => {
  await entrar(page, "dono@teste.com", "senha-errada-123");
  await expect(alerta(page)).toContainText("incorretos");
  await expect(page).toHaveURL(/\/entrar$/);

  await entrar(page, "dono@teste.com", senhaDoOwner());
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole("heading", { name: "E-books" })).toBeVisible();
  // O script de criar o administrador entregou a ele o e-book que veio sem dono.
  await expect(page.getByText("Livro de Teste")).toBeVisible();
  await expect(page.getByText("Dona Teste").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Usuários" })).toBeVisible();
});

test("o administrador cadastra um usuário e recebe a senha temporária uma vez", async ({ browser }) => {
  const { ctx, page } = await comoOwner(browser);
  await page.getByRole("link", { name: "Usuários" }).click();
  await page.getByRole("button", { name: "Novo usuário" }).click();
  await page.getByRole("textbox", { name: "Nome" }).fill("Ana Parceira");
  await page.getByRole("textbox", { name: "E-mail" }).fill("Ana@Teste.com");
  await page.getByRole("button", { name: "Criar e gerar senha" }).click();
  const senha = page.locator("code");
  await expect(senha).toHaveText(/^[A-Za-z0-9]{14}$/);
  senhaDaAna = (await senha.textContent())!;
  await expect(page.getByText("Ana Parceira", { exact: true })).toBeVisible(); // a linha da lista (a senha também cita o nome)

  // E-mail repetido (com outra caixa) é recusado.
  await page.getByRole("textbox", { name: "Nome" }).fill("Outra Ana");
  await page.getByRole("textbox", { name: "E-mail" }).fill("ana@teste.com");
  await page.getByRole("button", { name: "Criar e gerar senha" }).click();
  await expect(alerta(page)).toContainText("Já existe uma conta");
  await ctx.close();
});

test("o usuário comum só vê o que é dele e não chega à gestão de usuários", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await entrar(page, "ana@teste.com", senhaDaAna);
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByText("Nenhum e-book por aqui ainda.")).toBeVisible();
  await expect(page.getByText("Livro de Teste")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);
  // A página de gestão "não existe" para quem não é administrador (o status é 200 porque a resposta já estava em andamento,
  // mas nenhum dado da lista é lido: exigirOwner() roda antes da consulta).
  await page.goto("/painel/usuarios");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await expect(page.getByText("ana@teste.com")).toHaveCount(0);
  await expect(page.getByText("dono@teste.com")).toHaveCount(0);
  await ctx.close();
});

test("o usuário troca o nome e a senha em Conta", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await entrar(page, "ana@teste.com", senhaDaAna);
  await page.getByRole("link", { name: "Conta" }).click();
  await page.getByRole("textbox", { name: "Nome" }).fill("Ana Souza");
  await page.getByRole("button", { name: "Salvar nome" }).click();
  await expect(page.getByText("Nome salvo.")).toBeVisible();

  await page.locator("#atual").fill("a-senha-errada-1");
  await page.locator("#nova").fill("minha-senha-nova-42");
  await page.locator("#confirmar").fill("minha-senha-nova-42");
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(alerta(page)).toContainText("não confere");

  await page.locator("#atual").fill(senhaDaAna);
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page.getByText("Senha trocada.")).toBeVisible();
  senhaDaAna = "minha-senha-nova-42";
  await ctx.close();
});

test("desativar tira o acesso na hora, mesmo com a sessão aberta, e a senha redefinida vale", async ({ browser }) => {
  const dono = await comoOwner(browser);
  const ana = await browser.newContext();
  const paginaAna = await ana.newPage();
  await entrar(paginaAna, "ana@teste.com", senhaDaAna);
  await expect(paginaAna).toHaveURL(/\/painel$/);

  await dono.page.getByRole("link", { name: "Usuários" }).click();
  await dono.page.getByRole("switch", { name: "Ana Souza ativo" }).click();
  await dono.page.getByRole("button", { name: "Desativar", exact: true }).click();
  await expect(dono.page.getByText("Desativado")).toBeVisible();

  await paginaAna.reload();
  await expect(paginaAna).toHaveURL(/\/entrar$/);
  await entrar(paginaAna, "ana@teste.com", senhaDaAna);
  await expect(alerta(paginaAna)).toContainText("incorretos");

  await dono.page.getByRole("switch", { name: "Ana Souza ativo" }).click();
  await expect(dono.page.getByText("Ativo", { exact: true }).first()).toBeVisible();
  await dono.page.getByRole("button", { name: "Redefinir senha" }).click();
  const nova = (await dono.page.locator("code").textContent())!;
  await expect(dono.page.locator("code")).toHaveText(/^[A-Za-z0-9]{14}$/);

  await entrar(paginaAna, "ana@teste.com", senhaDaAna);
  await expect(alerta(paginaAna)).toContainText("incorretos"); // a senha antiga morreu
  await entrar(paginaAna, "ana@teste.com", nova);
  await expect(paginaAna).toHaveURL(/\/painel$/);
  senhaDaAna = nova;
  await ana.close();
  await dono.ctx.close();
});

test("desativar com \"tirar do ar\" tira os livros dela da vitrine; o administrador não se desativa", async ({ browser, request }) => {
  // O painel ainda não cria e-book (Fase 2): o livro da Ana entra direto no banco de teste, com ela como dona.
  const banco = new Database(".e2e/data/bibliotheon.db");
  banco.pragma("busy_timeout = 5000");
  const ana = banco.prepare("SELECT id FROM user WHERE email = 'ana@teste.com'").get() as { id: string };
  const agora = Date.now();
  banco
    .prepare("INSERT INTO ebook (id, owner_id, slug, status, titulo, publicado_em, criadoEm, atualizadoEm) VALUES (?, ?, 'livro-da-ana', 'publicado', 'Livro da Ana', ?, ?, ?)")
    .run(crypto.randomUUID(), ana.id, agora, agora, agora);
  banco.close();
  expect((await request.get("/livro-da-ana")).status()).toBe(200);

  const ctxAna = await browser.newContext();
  const paginaAna = await ctxAna.newPage();
  await entrar(paginaAna, "ana@teste.com", senhaDaAna);
  await expect(paginaAna.getByText("Livro da Ana")).toBeVisible();
  await expect(paginaAna.getByText("Livro de Teste")).toHaveCount(0); // o do administrador não aparece para ela

  const dono = await comoOwner(browser);
  await dono.page.getByRole("link", { name: "Usuários" }).click();
  await expect(dono.page.locator("li", { hasText: "ana@teste.com" }).getByText("1 e-book, 1 no ar")).toBeVisible();
  await expect(dono.page.getByRole("switch", { name: "Dona Teste ativo" })).toHaveCount(0);
  await dono.page.getByRole("switch", { name: "Ana Souza ativo" }).click();
  await dono.page.getByRole("checkbox", { name: /Tirar do ar também o e-book/ }).check();
  await dono.page.getByRole("button", { name: "Desativar", exact: true }).click();
  await expect(dono.page.getByText("Desativado")).toBeVisible();

  await expect.poll(async () => (await request.get("/livro-da-ana")).status()).toBe(404);
  expect((await request.get("/livro-de-teste")).status()).toBe(200); // o resto da vitrine segue no ar
  await dono.page.getByRole("link", { name: "E-books" }).click();
  await expect(dono.page.locator("li", { hasText: "Livro da Ana" }).getByText("Rascunho")).toBeVisible();
  await ctxAna.close();
  await dono.ctx.close();
});

test("tentativas demais de login são barradas pelo limite", async ({ request }) => {
  let ultimo = 0;
  for (let i = 0; i < 8; i++) {
    const r = await request.post("/api/auth/sign-in/email", {
      headers: { origin: ORIGEM, "x-real-ip": "203.0.113.77" },
      data: { email: "dono@teste.com", password: `errada-${i}-xxxxx` },
    });
    ultimo = r.status();
  }
  expect(ultimo).toBe(429);
});

test("cadastro público está desligado", async ({ request }) => {
  const r = await request.post("/api/auth/sign-up/email", {
    headers: { origin: ORIGEM, "x-real-ip": "203.0.113.78" },
    data: { name: "Intruso", email: "intruso@teste.com", password: "senha-do-intruso-1" },
  });
  expect(r.ok()).toBe(false);
});
