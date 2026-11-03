import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { semearNatal } from "./semear-landings";
import { MAXIMO_ESTREITO } from "../src/lib/versiculos";

const FAIXA = "[data-versiculos]";
const texto = (page: import("@playwright/test").Page) => page.locator(`${FAIXA} p`).innerText();

test.beforeAll(() => semearNatal());

test("aparece na Home, troca a cada 10 segundos e a pausa funciona", async ({ page }) => {
  await page.clock.install();
  const arquivo = page.waitForResponse("**/versiculos.json");
  await page.goto("/", { waitUntil: "load" });
  await page.clock.runFor(7000); // o arquivo só é buscado alguns segundos depois de abrir
  await arquivo;
  await page.waitForTimeout(100); // deixa a resposta chegar ao componente
  const inicial = await texto(page);
  expect(inicial).toContain("Salmos 119:105");
  await page.clock.runFor(10_500);
  await expect(page.locator(`${FAIXA} p`)).not.toHaveText(inicial);
  const segundo = await texto(page);

  await page.getByRole("button", { name: "Pausar a troca de versículos" }).click();
  await page.mouse.move(0, 0); // sai de cima da faixa, para valer só o botão
  await page.clock.runFor(30_000);
  await expect(page.locator(`${FAIXA} p`)).toHaveText(segundo);
});

test("não aparece nas landings personalizadas, nem navegando entre elas e a Home", async ({ page }) => {
  await page.goto("/natal-a-mesa");
  await expect(page.locator(FAIXA)).toBeHidden();
  await page.getByRole("link", { name: "Todos os e-books" }).first().click();
  await expect(page).toHaveURL("/");
  await expect(page.locator(FAIXA).first()).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/natal-a-mesa/);
  await expect(page.locator(`${FAIXA}:visible`)).toHaveCount(0);
});

for (const largura of [360, 390, 430]) {
  test(`celular ${largura} px: todo versículo permitido cabe sem mudar a altura da faixa`, async ({ browser }) => {
    const lista = JSON.parse(readFileSync("public/versiculos.json", "utf8")) as { t: string; r: string }[];
    const ctx = await browser.newContext({ viewport: { width: largura, height: 740 } });
    const page = await ctx.newPage();
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
    const estourados = await page.evaluate((v) => {
      const p = document.querySelector("[data-versiculos] p")!;
      const caixa = p.parentElement!;
      const [t, c] = [p.querySelector("span")!, p.querySelector("cite")!];
      return v.filter((x) => { t.textContent = x.t; c.textContent = x.r; return p.getBoundingClientRect().height > caixa.getBoundingClientRect().height; }).map((x) => x.r);
    }, lista.filter((v) => v.t.length + v.r.length <= MAXIMO_ESTREITO));
    expect(estourados).toEqual([]);
    await ctx.close();
  });
}

test("desktop 1280 px: até o versículo mais longo cabe", async ({ page }) => {
  const lista = JSON.parse(readFileSync("public/versiculos.json", "utf8")) as { t: string; r: string }[];
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const estourados = await page.evaluate((v) => {
    const p = document.querySelector("[data-versiculos] p")!;
    const caixa = p.parentElement!;
    const [t, c] = [p.querySelector("span")!, p.querySelector("cite")!];
    return v.filter((x) => { t.textContent = x.t; c.textContent = x.r; return p.getBoundingClientRect().height > caixa.getBoundingClientRect().height; }).map((x) => x.r);
  }, lista);
  expect(estourados).toEqual([]);
});

test("traz o crédito da tradução no rodapé", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Bíblia Livre (BLIVRE)" })).toBeVisible();
});
