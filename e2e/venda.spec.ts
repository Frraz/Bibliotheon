import { expect, test } from "@playwright/test";

test.describe("landing do e-book", () => {
  test("mostra o conteúdo do banco e os dados estruturados", async ({ page, request }) => {
    await page.goto("/livro-de-teste");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aprenda o teste completo");
    await expect(page.getByText("Beneficio dois")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Perguntas frequentes" })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/livro-de-teste$/);

    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!);
    const tipos = ld["@graph"].map((x: { "@type": string }) => x["@type"]);
    expect(tipos).toEqual(["Book", "Product", "FAQPage", "BreadcrumbList"]);

    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    const r = await request.get(og!);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/png");
  });

  test("clique em comprar passa pela saída rastreada e leva a origem ao checkout", async ({ page }) => {
    await page.goto("/livro-de-teste?utm_source=instagram&utm_campaign=teste-e2e&fbclid=ABC123");
    const link = page.getByRole("link", { name: /Comprar na Kiwify/ }).first();
    await expect(link).toHaveAttribute("href", /^\/ir\/[0-9a-f-]{36}\?utm_source=instagram&utm_campaign=teste-e2e&fbclid=ABC123$/);
    const href = (await link.getAttribute("href"))!;

    const resp = await page.request.get(href, { maxRedirects: 0 });
    expect(resp.status()).toBe(302);
    const destino = new URL(resp.headers()["location"]);
    expect(destino.origin + destino.pathname).toBe("https://pay.example.com/kiwify");
    expect(destino.searchParams.get("off")).toBe("abc"); // query cadastrada preservada
    expect(destino.searchParams.get("utm_source")).toBe("instagram");
    expect(destino.searchParams.get("fbclid")).toBe("ABC123");
    expect(resp.headers()["cache-control"]).toBe("no-store");
  });

  test("clique antes do JavaScript carregar: a origem é recuperada da página de onde veio", async ({ page, request }) => {
    await page.goto("/livro-de-teste");
    const href = (await page.getByRole("link", { name: /Comprar na Kiwify/ }).first().getAttribute("href"))!.split("?")[0];
    const r = await request.get(href, { maxRedirects: 0, headers: { referer: "http://127.0.0.1:3101/livro-de-teste?utm_source=tiktok&utm_campaign=sem-js" } });
    const destino = new URL(r.headers()["location"]);
    expect(destino.searchParams.get("utm_source")).toBe("tiktok");
    expect(destino.searchParams.get("utm_campaign")).toBe("sem-js");
    const fora = await request.get(href, { maxRedirects: 0, headers: { referer: "https://evil.com/?utm_source=tiktok" } });
    expect(new URL(fora.headers()["location"]).searchParams.has("utm_source")).toBe(false);
  });

  test("oferta inexistente ou inativa volta para a Home, nunca para fora", async ({ request }) => {
    const r = await request.get("/ir/00000000-0000-0000-0000-000000000000", { maxRedirects: 0 });
    expect(r.status()).toBe(302);
    expect(new URL(r.headers()["location"]).pathname).toBe("/");
  });

  test("a oferta vence: a faixa some e o preço sobe sozinho, sem recarregar", async ({ page }) => {
    // Antes do prazo (1º/jan/2027 12:00 BRT)
    await page.clock.install({ time: new Date("2026-12-20T12:00:00-03:00") });
    await page.goto("/livro-de-teste");
    await expect(page.getByText(/Preço de lançamento até 01\/01/).first()).toBeVisible();
    await expect(page.getByText("R$ 79,00").first()).toBeVisible();
    await expect(page.locator("s", { hasText: "R$ 99,00" }).first()).toBeVisible();

    // Passa do prazo: o relógio do navegador avança e a página se corrige sozinha
    await page.clock.fastForward(15 * 24 * 3600 * 1000);
    await expect(page.getByText(/Preço de lançamento/)).toHaveCount(0);
    await expect(page.getByText("R$ 99,00").first()).toBeVisible();
    await expect(page.locator("s")).toHaveCount(0);
  });

  test("folheador abre a amostra, navega e fecha com Esc", async ({ page }) => {
    await page.goto("/livro-de-teste");
    await page.getByRole("button", { name: /Abrir página/ }).first().click();
    const dlg = page.locator("dialog");
    await expect(dlg).toBeVisible();
    await page.getByRole("button", { name: /Próxima/ }).click();
    await expect(dlg.getByText("2 de 2")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dlg).toBeHidden();
  });

  test("sem pixel configurado, não aparece banner de cookies nem script de terceiros", async ({ page }) => {
    const externos: string[] = [];
    page.on("request", (r) => { if (!r.url().startsWith("http://127.0.0.1")) externos.push(r.url()); });
    await page.goto("/livro-de-teste");
    await expect(page.getByRole("dialog", { name: /cookies/i })).toHaveCount(0);
    expect(externos).toEqual([]);
  });
});

test.describe("site", () => {
  test("Home lista o livro; tema e páginas legais existem; sentinela e desconhecidos dão 404", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Livro de Teste" })).toBeVisible();
    expect((await request.get("/tema/tema-de-teste")).status()).toBe(200);
    expect((await request.get("/termos")).status()).toBe(200);
    expect((await request.get("/privacidade")).status()).toBe(200);
    expect((await request.get("/_")).status()).toBe(404);
    expect((await request.get("/nao-existe")).status()).toBe(404);
  });

  // Regressão: em 360 px (Android comum) o cartão da Home alargava a página e o navegador a encolhia.
  for (const largura of [360, 390, 430]) {
    test(`celular ${largura} px: nenhuma página passa da largura da tela`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: 780 }, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      for (const rota of ["/", "/livro-de-teste", "/tema/tema-de-teste", "/termos"]) {
        await page.goto(rota);
        const larguraDaPagina = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(larguraDaPagina, `${rota} em ${largura}px`).toBeLessThanOrEqual(largura);
      }
      await ctx.close();
    });
  }

  test("sitemap e robots", async ({ request }) => {
    const sm = await (await request.get("/sitemap.xml")).text();
    expect(sm).toContain("/livro-de-teste");
    expect(sm).toContain("/tema/tema-de-teste");
    const rb = await (await request.get("/robots.txt")).text();
    expect(rb).toContain("Disallow: /ir/");
    expect(rb).toContain("Sitemap:");
  });

  test("mídia: cache eterno e sem fuga de caminho", async ({ page, request }) => {
    await page.goto("/livro-de-teste");
    const capa = await page.locator('img[alt="Capa do livro de teste"]').first().getAttribute("src");
    expect(capa).toBeTruthy();
    const bruto = new URL(decodeURIComponent(capa!), "http://x").searchParams.get("url") ?? capa!;
    const r = await request.get(bruto);
    expect(r.status()).toBe(200);
    expect(r.headers()["cache-control"]).toContain("immutable");
    expect((await request.get("/m/ebook/x/../../../bibliotheon.db")).status()).toBe(404);
    expect((await request.get("/m/bibliotheon.db")).status()).toBe(404);
  });

  test("visita é contada uma vez por sessão e robô não conta", async ({ page, request }) => {
    const chamadas: string[] = [];
    page.on("request", (r) => { if (r.url().endsWith("/api/v1/v")) chamadas.push(r.url()); });
    await page.goto("/livro-de-teste?utm_source=meta");
    await page.reload();
    await page.waitForTimeout(500);
    expect(chamadas.length).toBe(1);
    const bot = await request.post("/api/v1/v", { data: '{"s":"livro-de-teste"}', headers: { "user-agent": "Googlebot/2.1" } });
    expect(bot.status()).toBe(204);
  });

  test("healthcheck responde com o banco", async ({ request }) => {
    const r = await request.get("/api/saude");
    expect(r.status()).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });
});
