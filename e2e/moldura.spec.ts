import { expect, test, type Page } from "@playwright/test";
import { SLUG_MENTE, SLUG_SISTEMAS, semearMente, semearSistemas } from "./semear-landings";

// O Next 16 não desmonta a página anterior: esconde com display:none (Activity). Estes testes navegam de uma landing com moldura
// própria para o Home, no cliente, e conferem que o Home volta inteiro ao desenho padrão (foi um bug: o Home herdava a moldura escura).
test.beforeAll(() => {
  semearMente();
  semearSistemas();
});

const PAPEL = "rgb(243, 236, 221)";
const fundo = (page: Page, seletor: string) => page.evaluate((s) => getComputedStyle(document.querySelector(s)!).backgroundColor, seletor);

const landings = [
  { slug: SLUG_SISTEMAS, raiz: "[data-superficie]", escura: "rgb(14, 11, 10)" },
  { slug: SLUG_MENTE, raiz: "[data-moldura-propria]", escura: "rgb(21, 17, 12)" }, // faixa escura do topo da landing do 002
];

for (const { slug, raiz, escura } of landings) {
  test(`${slug}: o cabeçalho do site some na landing, e o Home volta ao normal depois dela`, async ({ page }) => {
    const erros: string[] = [];
    page.on("pageerror", (e) => erros.push(String(e)));

    await page.goto(`/${slug}`, { waitUntil: "networkidle" });
    await expect(page.locator("[data-cabecalho-site]")).toBeHidden();
    await expect(page.locator("[data-rodape-site]")).toBeHidden();
    const cabecalho = page.locator("[data-moldura-propria]");
    await expect(cabecalho).toBeVisible();
    expect(await fundo(page, raiz === "[data-moldura-propria]" ? "[data-moldura-propria]" : raiz)).toBe(escura);

    // Navegação no cliente (sem recarregar): a landing fica escondida no DOM.
    await cabecalho.getByRole("link", { name: "Todos os e-books" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("E-books práticos");
    await expect(page.locator("[data-cabecalho-site]")).toBeVisible();
    await expect(page.locator("[data-rodape-site]")).toBeVisible();
    expect(await fundo(page, "[data-moldura]")).toBe(PAPEL);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).not.toBe("rgb(14, 11, 10)");
    // Texto legível: nenhum título do catálogo com a mesma cor do fundo.
    const cor = await page.locator("[data-cabecalho-site] a").first().evaluate((el) => getComputedStyle(el).color);
    expect(cor).not.toBe(PAPEL);

    // Voltar: a landing reaparece com a moldura própria e o cabeçalho do site some de novo.
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/${slug}$`));
    await expect(page.locator("[data-cabecalho-site]")).toBeHidden();
    await expect(page.locator("[data-moldura-propria]")).toBeVisible();
    expect(erros).toEqual([]);
  });
}

test("na landing padrão (sem moldura própria), o cabeçalho e o rodapé do site continuam", async ({ page }) => {
  await page.goto("/livro-de-teste", { waitUntil: "networkidle" });
  await expect(page.locator("[data-cabecalho-site]")).toBeVisible();
  await expect(page.locator("[data-rodape-site]")).toBeVisible();
  await expect(page.locator("[data-moldura-propria]")).toHaveCount(0);
});

for (const largura of [360, 390, 430]) {
  test(`celular ${largura} px: cabeçalho e rodapé discretos sem rolagem horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    for (const slug of [SLUG_SISTEMAS, SLUG_MENTE]) {
      await page.goto(`/${slug}`, { waitUntil: "networkidle" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      const alvo = await page.locator("[data-moldura-propria]").getByRole("link", { name: "Todos os e-books" }).boundingBox();
      expect(alvo!.height).toBeGreaterThanOrEqual(44);
    }
  });
}
