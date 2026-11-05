import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { semearMente, semearNatal, semearSistemas } from "./semear-landings";
import { MARINA } from "../src/landings/a-mente-inabalavel/conteudo";
import { CONFERIR, ETAPAS, PRIMEIRO_PEDIDO } from "../src/landings/criar-sistemas-com-ia/conteudo";
import { CARDAPIOS, POR_PESSOA, PONTO_DA_CARNE, RECEITA } from "../src/landings/natal-a-mesa/conteudo";

// Página personalizada de "A Mente Inabalável": o livro entra direto no banco de teste, com os textos do painel.
const SLUG = "a-mente-inabalavel";

test.beforeAll(() => {
  semearMente();
});

test("usa a página própria, com dados estruturados e o botão rastreado do painel", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto(`/${SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Treine uma mente mais firme");
  await expect(page.getByText("Não são as coisas que perturbam as pessoas")).toBeVisible();
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!);
  expect(ld["@graph"].map((x: { "@type": string }) => x["@type"])).toContain("Book");
  await expect(page.getByRole("link", { name: "Comprar na Hotmart" }).first()).toHaveAttribute("href", /^\/ir\//);
  await expect(page.getByText("Em crise, ligue para o CVV: 188.")).toBeAttached();
  await expect(page.getByText("Segundo parágrafo.")).toBeAttached(); // parágrafos separados, mesmo salvos com \\r\\n
  expect(erros).toEqual([]);
});

test("o seletor mostra a prática de cada capítulo, por clique e por teclado", async ({ page }) => {
  await page.goto(`/${SLUG}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("tabpanel")).toContainText("A sessão de dez minutos".toLowerCase());
  await page.getByRole("tab", { name: "Raiva" }).click();
  await expect(page.getByRole("tab", { name: "Raiva" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText("Sobre a ira, II.29");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Perda" })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText("não apressa o luto");
  // todos os capítulos ficam no HTML, para o Google
  const html = await (await page.request.get(`/${SLUG}`)).text();
  for (const t of ["O mapa do necessário", "A auditoria de sete dias", "O filtro de três perguntas"]) expect(html).toContain(t);
});

test("o exercício do capítulo 2 monta a tabela, avisa do engano e não envia nada", async ({ page }) => {
  const pedidos: string[] = [];
  await page.goto(`/${SLUG}`, { waitUntil: "networkidle" });
  page.on("request", (r) => { if (r.method() === "POST") pedidos.push(r.url()); });
  const bloco = page.locator("section", { has: page.getByRole("heading", { name: "Faça agora o exercício do capítulo 2" }) });
  await bloco.getByRole("button", { name: "Depende dela" }).click(); // "A cara do diretor": engano de propósito
  await expect(bloco.getByText("“A cara do diretor” não depende dela.")).toBeVisible();
  // por teclado, até o fim, sempre na coluna certa
  for (const i of MARINA.itens.slice(1)) {
    const botao = bloco.getByRole("button", { name: i.depende ? "Depende dela" : "Não depende" });
    await botao.focus();
    await page.keyboard.press("Enter");
  }
  await expect(bloco.getByText(MARINA.percebe)).toBeVisible();
  await expect(bloco.getByText("Isso não garante que a apresentação vai ser um sucesso.")).toBeVisible();
  await bloco.getByRole("button", { name: "Separar de novo" }).click();
  await expect(bloco.getByText(MARINA.itens[0].texto)).toBeVisible();
  expect(pedidos.filter((u) => !u.endsWith("/api/v1/v"))).toEqual([]);
});

test("a fonte da página própria não pesa nas outras páginas", async ({ request }) => {
  expect(await (await request.get("/livro-de-teste")).text()).not.toContain("font-inscricao");
});

for (const largura of [360, 390, 430]) {
  test(`celular ${largura} px: sem rolagem horizontal, com a compra na primeira tela`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: largura, height: 740 } });
    const page = await ctx.newPage();
    await page.goto(`/${SLUG}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
    await expect(page.getByRole("link", { name: "Comprar na Hotmart" }).first()).toBeInViewport();
    await ctx.close();
  });
}

test("cada citação da página está no manuscrito (quando o projeto irmão está na máquina)", async () => {
  const pasta = "../ebooks/ebooks/002-estoicismo-pratico/manuscrito/pt-BR/";
  let textos: string;
  try {
    textos = ["01-o-que-voce-diz-a-si-mesmo", "04-ansiedade", "05-raiva", "06-perda-e-luto", "08-criticas-e-rejeicao", "09-tempo", "10-dinheiro-e-desejo"].map((f) => readFileSync(`${pasta}${f}.md`, "utf8")).join("\n");
  } catch {
    test.skip();
    return;
  }
  const norm = (t: string) => t.toLowerCase().replace(/[*“”'"]/g, "");
  // A tabela de Marina e as frases em volta dela são as do capítulo 2.
  const cap2 = readFileSync(`${pasta}02-o-que-depende-de-voce.md`, "utf8");
  for (const i of MARINA.itens) expect(cap2).toContain(i.texto);
  for (const f of [MARINA.percebe.replace("Quase", "quase"), MARINA.colunas, MARINA.limite]) expect(cap2).toContain(f);
  expect(cap2).toContain("Marina, 31 anos");
  for (const c of [
    "Não são as coisas que perturbam as pessoas, mas as opiniões que elas têm sobre as coisas",
    "Há mais coisas que nos assustam do que coisas que nos ferem; sofremos mais na imaginação do que na realidade",
    "O maior remédio contra a ira é o adiamento",
    "Nunca diga perdi, mas devolvi",
    "Ele deve desconhecer meus outros defeitos, senão não teria mencionado só esses",
    "Não é que tenhamos pouco tempo; é que desperdiçamos muito dele",
    "não é pobre quem tem pouco, mas quem deseja mais",
  ]) expect(norm(textos)).toContain(norm(c));
});


// ---------- Crie Sistemas com IA e Ganhe Dinheiro ----------
const SLUG1 = "criar-sistemas-com-ia";

test.describe("criar-sistemas-com-ia", () => {
  test.beforeAll(() => semearSistemas());

  test("usa a página própria, com o primeiro pedido à IA e as cinco etapas", async ({ page }) => {
    const erros: string[] = [];
    page.on("pageerror", (e) => erros.push(String(e)));
    await page.goto(`/${SLUG1}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Crie seu primeiro sistema com IA");
    await expect(page.getByRole("heading", { name: "Você não pede código. Pede um plano." })).toBeVisible();
    await expect(page.getByText("Ajude a planejar a Oficina Clara")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cinco etapas, da ideia à venda" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Comprar na Hotmart" }).first()).toHaveAttribute("href", /^\/ir\//);
    await expect(page.getByText("Renda, clientes ou prazo.")).toBeAttached();
    expect(await page.locator('script[type="application/ld+json"]').count()).toBeGreaterThan(0);
    expect(erros).toEqual([]);
  });

  test("as etapas abrem uma de cada vez, e todas ficam no HTML", async ({ page }) => {
    await page.goto(`/${SLUG1}`, { waitUntil: "networkidle" });
    const etapas = page.locator("details[name=etapa]");
    await expect(etapas).toHaveCount(5);
    await expect(etapas.nth(0)).toHaveAttribute("open", "");
    await etapas.nth(3).locator("summary").click();
    await expect(etapas.nth(3)).toHaveAttribute("open", "");
    await expect(etapas.nth(0)).not.toHaveAttribute("open", "");
    await expect(etapas.nth(3)).toContainText("Prepara uma VPS de homologação");
    const html = await (await page.request.get(`/${SLUG1}`)).text();
    for (const et of ETAPAS) expect(html).toContain(et.linhas[0].faz);
  });

  test("a fonte da página própria não pesa nas outras", async ({ request }) => {
    expect(await (await request.get("/livro-de-teste")).text()).not.toContain("font-titulo");
  });

  for (const largura of [360, 390, 430]) {
    test(`celular ${largura} px: sem rolagem horizontal (inclusive no bloco de código)`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: 740 } });
      const page = await ctx.newPage();
      await page.goto(`/${SLUG1}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
      await expect(page.getByRole("link", { name: "Comprar na Hotmart" }).first()).toBeInViewport();
      await ctx.close();
    });
  }

  test("os textos da página são os do manuscrito (quando o projeto irmão está na máquina)", async () => {
    const pasta = "../ebooks/ebooks/001-sistemas-com-ia/manuscrito/pt-BR/";
    const ler = (f: string) => { try { return readFileSync(`${pasta}${f}.md`, "utf8"); } catch { return null; } };
    const etapasMd = ["etapa-1-ideia", "etapa-2-planejamento", "etapa-3-desenvolvimento", "etapa-4-deploy", "etapa-5-venda"].map(ler);
    const planejar = ler("05-planejar-com-ia");
    if (etapasMd.some((t) => !t) || !planejar) { test.skip(); return; }
    const norm = (t: string) => t.replace(/\s+/g, " ").trim();
    ETAPAS.forEach((et, i) => {
      const md = norm(etapasMd[i]!);
      expect(md).toContain(norm(et.terminou.replace(/\.$/, "")));
      for (const l of et.linhas) expect(md).toContain(`| ${l.capitulo} | ${l.faz} | ${l.pronto} |`);
    });
    for (const linha of PRIMEIRO_PEDIDO) expect(planejar).toContain(linha);
    expect(norm(planejar)).toContain("Se a IA acrescentar estoque, recuse ou registre como evolução");
    expect(norm(planejar)).toContain("peça controles e testes específicos");
    expect(CONFERIR.length).toBe(3);
  });
});


// ---------- Natal à Mesa ----------
const SLUG3 = "natal-a-mesa";

test.describe("natal-a-mesa", () => {
  test.beforeAll(() => semearNatal());

  test("usa a página própria, sem contador e sem prova que o livro não tem", async ({ page }) => {
    const erros: string[] = [];
    page.on("pageerror", (e) => erros.push(String(e)));
    await page.goto(`/${SLUG3}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ceia de Natal planejada");
    await expect(page.getByRole("heading", { name: "Quantas pessoas vão à mesa?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Uma receita por dentro" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Comprar na Cakto" }).first()).toHaveAttribute("href", /^\/ir\//);
    // O número de páginas vem do painel, e a página admite que não há fotos.
    await expect(page.getByText("215").first()).toBeAttached();
    await expect(page.getByText("O livro não tem fotografias dos pratos")).toBeAttached();
    const html = await (await page.request.get(`/${SLUG3}`)).text();
    expect(html).not.toMatch(/receitas testadas|testadas em cozinha|depoimento/i);
    expect(await page.locator('script[type="application/ld+json"]').count()).toBeGreaterThan(0);
    expect(erros).toEqual([]);
  });

  test("o seletor troca de cardápio por clique e por teclado, e todos ficam no HTML", async ({ page }) => {
    await page.goto(`/${SLUG3}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("tab", { name: /Para 6 a 8/ })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: /Vegetariana/ }).click();
    await expect(page.getByRole("tabpanel")).toContainText("Moranga recheada com lentilha e cogumelos");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /Para 2/ })).toBeFocused();
    await expect(page.getByRole("tabpanel")).toContainText("Pasta de queijo com nozes e mel");
    expect(await page.getByRole("tab").count()).toBe(CARDAPIOS.length);
    const html = await (await page.request.get(`/${SLUG3}`)).text();
    for (const c of CARDAPIOS) expect(html).toContain(c.titulo);
  });

  test("a fonte da página própria não pesa nas outras páginas", async ({ request }) => {
    expect(await (await request.get("/livro-de-teste")).text()).not.toContain("font-livro");
  });

  for (const largura of [360, 390, 430]) {
    test(`celular ${largura} px: sem rolagem horizontal, com a compra na primeira tela`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: 740 } });
      const page = await ctx.newPage();
      await page.goto(`/${SLUG3}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
      await expect(page.getByRole("link", { name: "Comprar na Cakto" }).first()).toBeInViewport();
      await ctx.close();
    });
  }

  test("pratos, tarefas, receita e tabelas da página estão no manuscrito (quando o projeto irmão está na máquina)", async () => {
    const pasta = "../ebooks/ebooks/003-natal-a-mesa/manuscrito/pt-BR/";
    const ler = (f: string) => { try { return readFileSync(`${pasta}${f}.md`, "utf8"); } catch { return null; } };
    const arquivos = ["10a-cardapio-1-economica", "10b-cardapio-2-para-2", "10c-cardapio-3-para-4", "10d-cardapio-4-para-6-a-8", "10e-cardapio-5-para-10-a-12", "10f-cardapio-6-especial", "10g-cardapio-7-expressa", "10h-cardapio-8-vegetariana"];
    const cardapiosMd = arquivos.map(ler);
    const aves = ler("04-aves-e-carnes");
    const planejar = ler("01-planeje-a-sua-ceia");
    const seguranca = ler("02-seguranca-alimentar");
    if (cardapiosMd.some((t) => !t) || !aves || !planejar || !seguranca) { test.skip(); return; }
    const norm = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();
    for (const c of CARDAPIOS) {
      const md = cardapiosMd.find((t) => t!.includes(`# Cardápio ${c.numero} · ${c.titulo}`));
      expect(md, `cardápio ${c.numero}`).toBeTruthy();
      const n = norm(md!);
      expect(n).toContain(norm(c.perfil));
      expect(n).toContain(norm(c.intro));
      for (const p of c.pratos) expect(md).toContain(`**${p.papel}:** ${p.nome} (cap. ${p.cap})`);
      expect(n).toContain(norm(c.compras.itens));
      const semRemissao = md!.replace(/ \(veja a receita\)/g, "");
      for (const d of c.dia24) expect(semRemissao).toContain(`**${d.quando}.** ${d.texto}`);
    }
    const rec = norm(aves);
    expect(rec).toContain(norm(RECEITA.resumo));
    for (const l of [...RECEITA.ingredientes, ...RECEITA.preparo, ...RECEITA.notas.map((n) => n.texto)]) expect(rec).toContain(norm(l));
    for (const r of POR_PESSOA) expect(norm(planejar)).toContain(norm(`| ${r.item} | ${r.qtd} |`));
    for (const r of PONTO_DA_CARNE) expect(norm(seguranca)).toContain(norm(`| ${r.item === "Tender, para reaquecer" ? "Embutidos já cozidos (tender), para reaquecer" : r.item} |`));
  });
});
