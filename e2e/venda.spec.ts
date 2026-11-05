import { expect, test } from "@playwright/test";

const AUT = { authorization: "Bearer token-de-teste" };

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

test.describe("várias lojas", () => {
  test("com duas lojas, o topo leva ao bloco de compra, e só lá elas aparecem, com símbolo e o mesmo peso", async ({ page }) => {
    await page.goto("/livro-de-teste");
    const topo = page.getByRole("link", { name: "Comprar agora" }).first();
    await expect(topo).toHaveAttribute("href", "#comprar");
    await expect(topo).toBeInViewport();
    await expect(page.getByText("Prefere outra plataforma?")).toHaveCount(0);
    await expect(page.getByText("outras formas de comprar")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Comprar na / })).toHaveCount(2); // nenhuma loja fora do bloco

    const bloco = page.locator("#comprar");
    await expect(bloco.getByText("Escolha onde prefere comprar")).toBeVisible();
    const kiwify = bloco.getByRole("link", { name: /Comprar na Kiwify/ });
    const cakto = bloco.getByRole("link", { name: /Comprar na Cakto/ });
    await expect(kiwify).toHaveAttribute("href", /^\/ir\/[0-9a-f-]{36}/);
    await expect(cakto).toHaveAttribute("href", /^\/ir\/[0-9a-f-]{36}/);
    await expect(kiwify.locator("img")).toHaveAttribute("src", "/lojas/kiwify.svg");
    expect(await kiwify.getAttribute("class")).toBe(await cakto.getAttribute("class")); // mesmo peso visual
    const [a, b] = await Promise.all([kiwify.boundingBox(), cakto.boundingBox()]);
    expect(a!.y).toBeLessThan(b!.y); // na ordem da lista do painel
    expect(Math.round(a!.width)).toBe(Math.round(b!.width));
    expect(a!.height).toBeGreaterThanOrEqual(44);

    // o botão do topo rola até o bloco
    await topo.click();
    await expect(bloco).toBeInViewport();
    // para no bloco, e não só perto dele: as seções adiadas têm altura estimada até o clique
    await expect.poll(() => bloco.evaluate((el) => Math.abs(el.getBoundingClientRect().top)), { timeout: 5000 }).toBeLessThan(5);
  });

  test("a barra fixa do celular também leva ao bloco, e some quando ele está na tela", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto("/livro-de-teste");
    await page.evaluate(() => window.scrollTo(0, document.getElementById("topo")!.offsetHeight + 200));
    const barra = page.locator(".fixed.bottom-0").getByRole("link", { name: "Comprar agora" });
    await expect(barra).toBeVisible();
    await expect(barra).toHaveAttribute("href", "#comprar");
    await page.locator("#comprar").scrollIntoViewIfNeeded();
    await expect(barra).toBeHidden();
    await ctx.close();
  });
});

test.describe("padrão de venda", () => {
  test("mostra necessidade e diferenciais, sem seção de autor", async ({ page }) => {
    await page.goto("/livro-de-teste");
    await expect(page.getByText("Uma dor do leitor")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Por que este caminho" })).toBeVisible();
    await expect(page.getByText("Um diferencial real")).toBeVisible();
    await expect(page.getByText("Quem escreveu")).toHaveCount(0);
    await expect(page.getByText("Autora de Teste")).toHaveCount(0);
    await expect(page.getByText("Biografia que não deve aparecer.")).toHaveCount(0);
    await expect(page.getByText("Até 01/01 às 12h. Depois, R$ 99,00.").first()).toBeVisible();
  });

  test("descrição recolhida pode ser aberta também no desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/livro-de-teste");
    await expect(page.getByText("Primeiro paragrafo.")).toBeVisible();
    await expect(page.getByText("Segundo paragrafo.")).toBeHidden();
    await page.getByRole("button", { name: "Continuar lendo" }).click();
    await expect(page.getByText("Segundo paragrafo.")).toBeVisible();
  });

  test("amostra: pede e-mail e aceite, entrega o PDF e entra na exportação", async ({ page, request }) => {
    await page.goto("/livro-de-teste?utm_source=instagram");
    const email = `leitor-${Date.now()}@exemplo.com`;
    await page.getByLabel("Seu e-mail").fill(email);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Quero a amostra" }).click();
    const link = page.getByRole("link", { name: "Baixar amostra (PDF)" });
    await expect(link).toBeVisible();
    const pdf = await request.get((await link.getAttribute("href"))!);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");

    expect((await request.get("/api/v1/leads")).status()).toBe(401);
    const csv = await (await request.get("/api/v1/leads", { headers: AUT })).text();
    expect(csv).toContain(`"${email}","livro-de-teste","instagram"`);

    const semAceite = await request.post("/api/v1/leads", { data: { slug: "livro-de-teste", email, aceite: false } });
    expect(semAceite.status()).toBe(422);
  });

  test("API: sem token não entra e campanha sem link promocional é recusada", async ({ request }) => {
    expect((await request.patch("/api/v1/ebooks/livro-de-teste", { data: {} })).status()).toBe(401);
    expect((await request.get("/api/v1/metricas")).status()).toBe(401);
    const invalido = await request.patch("/api/v1/ebooks/livro-de-teste", { headers: AUT, data: { book: { price: -1 } } });
    expect(invalido.status()).toBe(422);
    expect((await request.patch("/api/v1/ebooks/nao-existe", { headers: AUT, data: {} })).status()).toBe(404);
    const sem = await request.patch("/api/v1/ebooks/livro-de-teste", { headers: AUT, data: { book: { price: 47, priceFrom: 64.99, offerEndsAt: "2030-01-01T00:00:00-03:00" } } });
    expect(sem.status()).toBe(422);
    expect((await sem.json()).erro).toMatch(/link promocional/);
  });

  test("webhooks de venda: autentica, não conta em dobro, reembolsa e mostra no relatório por origem", async ({ request }) => {
    const url = (loja: string) => `/api/v1/vendas/${loja}/livro-de-teste`;
    const aprovada = { event: "purchase_approved", data: { id: "e2e-cakto-1", amount: 24.99, currency: "BRL", affiliate: "", utm_source: "whatsapp" } };
    const cakto = (data: object) => request.post(url("cakto"), { data });

    expect((await request.post(url("cakto"), { data: aprovada })).status()).toBe(401); // sem segredo
    expect((await cakto({ ...aprovada, secret: "errado" })).status()).toBe(401);
    expect((await request.post(url("outraloja"), { data: aprovada })).status()).toBe(404);
    expect((await request.post("/api/v1/vendas/cakto/nao-existe", { data: { ...aprovada, secret: "cakto-segredo-de-teste" } })).status()).toBe(404);

    const ok = { ...aprovada, secret: "cakto-segredo-de-teste" };
    expect((await cakto(ok)).status()).toBe(200);
    expect((await cakto(ok)).status()).toBe(200); // reenvio da loja
    expect((await cakto({ secret: "cakto-segredo-de-teste", event: "checkout_abandonment", data: { id: "x" } })).status()).toBe(200);
    expect((await cakto({ secret: "cakto-segredo-de-teste", algo: "novo" })).status()).toBe(422);

    // Hotmart pelo header
    const hot = await request.post(url("hotmart"), {
      headers: { "x-hotmart-hottok": "hottok-de-teste" },
      data: { event: "PURCHASE_APPROVED", data: { purchase: { transaction: "E2E-HP-1", price: { value: 64.99, currency_value: "BRL" }, origin: { src: "youtube" } }, commissions: [{ source: "AFFILIATE" }] } },
    });
    expect(hot.status()).toBe(200);

    // As suítes dividem o mesmo banco (o painel também registra uma venda): confere as linhas das origens deste teste, não os totais.
    const antes = await (await request.get("/api/v1/metricas", { headers: AUT })).text();
    expect(antes).toMatch(/Vendas registradas pelas lojas: \d+ /);
    expect(antes).toMatch(/whatsapp\s+1\s+R\$\s*24,99/);
    expect(antes).toMatch(/youtube\s+1\s+R\$\s*64,99/);

    // Reembolso: sai da conta; reenviar a compra depois não a traz de volta
    expect((await cakto({ secret: "cakto-segredo-de-teste", event: "refund", data: { id: "e2e-cakto-1" } })).status()).toBe(200);
    expect((await cakto(ok)).status()).toBe(200);
    const depois = await (await request.get("/api/v1/metricas", { headers: AUT })).text();
    expect(depois).not.toMatch(/whatsapp\s+\d/);
    expect(depois).toMatch(/youtube\s+1\s+R\$\s*64,99/);
    expect(depois).toMatch(/\d+ reembolsada\(s\) fora da conta/);
  });

  test("campanha pela API: página e checkout mudam juntos, e voltam quando o prazo vence, sem perder as métricas", async ({ page, request }) => {
    const irPara = async () => {
      await page.goto("/livro-de-teste");
      const href = (await page.getByRole("link", { name: /Comprar na Kiwify/ }).first().getAttribute("href"))!.split("?")[0];
      return new URL((await request.get(href, { maxRedirects: 0 })).headers()["location"]);
    };
    const cliquesNoRelatorio = async () => {
      const texto = await (await request.get("/api/v1/metricas?vendas=10&afiliadas=2", { headers: AUT })).text();
      return { texto, cliques: Number(/total\s+\d+\s+(\d+)/.exec(texto)![1]) };
    };
    expect((await irPara()).pathname).toBe("/kiwify");
    const inicio = await cliquesNoRelatorio();
    expect(inicio.cliques).toBeGreaterThan(0);

    const ligar = await request.patch("/api/v1/ebooks/livro-de-teste", {
      headers: AUT,
      data: {
        book: { price: 47, priceFrom: 64.99, offerEndsAt: "2030-01-01T23:59:00-03:00", offerName: "Black Friday" },
        offers: [
          { platform: "kiwify", promoUrl: "https://pay.example.com/kiwify-promo" },
          { platform: "cakto", promoUrl: "https://pay.example.com/cakto-promo" },
        ],
      },
    });
    expect(ligar.status()).toBe(200);
    expect((await irPara()).pathname).toBe("/kiwify-promo");
    await expect(page.getByText("Até 01/01 às 23h59. Depois, R$ 64,99.").first()).toBeVisible();
    await expect(page.getByText(/Black Friday até 01\/01/).first()).toBeVisible();

    // Prazo vencido: o checkout normal volta sem nenhuma outra ação
    await request.patch("/api/v1/ebooks/livro-de-teste", { headers: AUT, data: { book: { offerEndsAt: "2026-01-01T00:00:00-03:00" } } });
    expect((await irPara()).pathname).toBe("/kiwify");
    await expect(page.getByText("R$ 64,99").first()).toBeVisible();

    const fim = await cliquesNoRelatorio();
    expect(fim.texto).toMatch(/10 vendas ao preço atual/);
    expect(fim.cliques).toBe(inicio.cliques + 2); // os ajustes não apagaram nada: só somaram os dois cliques seguintes

    // Restaura o título de teste para os demais testes
    const restaurar = await request.patch("/api/v1/ebooks/livro-de-teste", {
      headers: AUT,
      data: {
        book: { price: 79, priceFrom: 99, offerEndsAt: "2027-01-01T12:00:00-03:00", offerName: "Preço de lançamento" },
        offers: [{ platform: "kiwify", promoUrl: null }, { platform: "cakto", promoUrl: null }],
      },
    });
    expect(restaurar.status()).toBe(422); // com preço diferente, o prazo exige o link: a regra vale para o teste também
    await request.patch("/api/v1/ebooks/livro-de-teste", {
      headers: AUT,
      data: {
        book: { price: 79, priceFrom: 99, offerEndsAt: "2027-01-01T12:00:00-03:00", offerName: "Preço de lançamento" },
        offers: [
          { platform: "kiwify", promoUrl: "https://pay.example.com/kiwify?off=abc" },
          { platform: "cakto", promoUrl: "https://pay.example.com/cakto" },
        ],
      },
    });
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

  test("Home tem título, endereço canônico, prévia de compartilhamento e dados estruturados da marca", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Bibliotheon · E-books práticos para resolver problemas reais");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /E-books práticos/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{40,}/);
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!);
    const tipos = ld["@graph"].map((x: { "@type": string }) => x["@type"]);
    expect(tipos).toEqual(["Organization", "WebSite"]);
    expect(ld["@graph"][1].publisher["@id"]).toBe(ld["@graph"][0]["@id"]);
  });

  test("sitemap e robots", async ({ request }) => {
    const sm = await (await request.get("/sitemap.xml")).text();
    expect(sm).toContain("/livro-de-teste");
    expect(sm).toContain("/tema/tema-de-teste");
    // cada página com a data real da última alteração (nunca inventada); as legais, sem data
    expect(sm).toMatch(/\/livro-de-teste<\/loc>\s*<lastmod>\d{4}-\d{2}-\d{2}T[^<]+<\/lastmod>/);
    expect(sm).toMatch(/\/tema\/tema-de-teste<\/loc>\s*<lastmod>/);
    expect(sm).not.toMatch(/\/termos<\/loc>\s*<lastmod>/);
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

  test("visita vinda do Google conta como google e leva a origem ao checkout", async ({ page }) => {
    const corpos: (string | null)[] = [];
    page.on("request", (r) => { if (r.url().endsWith("/api/v1/v")) corpos.push(r.postData()); });
    await page.goto("/livro-de-teste", { referer: "https://www.google.com/" });
    const link = page.getByRole("link", { name: /Comprar na Kiwify/ }).first();
    await expect(link).toHaveAttribute("href", /^\/ir\/[0-9a-f-]{36}\?utm_source=google&utm_medium=organico$/);
    await expect.poll(() => corpos.length).toBe(1);
    expect(JSON.parse(corpos[0]!)).toMatchObject({ s: "livro-de-teste", o: "google" });
  });

  test("healthcheck responde com o banco", async ({ request }) => {
    const r = await request.get("/api/saude");
    expect(r.status()).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });
});
