import { expect, test, type Browser, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import sharp from "sharp";

// Fluxo em série do editor: o administrador e um usuário comum criam, completam, publicam e editam e-books pelo painel.
test.describe.configure({ mode: "serial" });

const ORIGEM = "http://127.0.0.1:3101";
const TITULO = "Guia Prático de Horta Urbana";
const SLUG = "guia-pratico-de-horta-urbana";
const senhaDoOwner = () => readFileSync(".e2e/senha-owner.txt", "utf8").trim();
let id = "";
let senhaDoBeto = "";

// IPs próprios (X-Real-IP): o limite de tentativas de login é por IP, e painel.spec.ts usa a faixa 1–99 em paralelo.
let proximoIp = 150;
async function entrar(page: Page, email: string, senha: string) {
  await page.setExtraHTTPHeaders({ "x-real-ip": `198.51.100.${proximoIp++}` });
  await page.goto("/entrar");
  await page.getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.locator("#senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/painel$/);
}
async function comoOwner(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await entrar(page, "dono@teste.com", senhaDoOwner());
  return { ctx, page };
}
const imagem = (largura: number, altura: number, cor: string, exif = false) => {
  const s = sharp({ create: { width: largura, height: altura, channels: 3, background: cor } }).jpeg();
  return (exif ? s.withExif({ IFD0: { Copyright: "Fotografo Secreto", Artist: "Fulano de Tal" } }) : s).toBuffer();
};
const arquivo = (name: string, mimeType: string, buffer: Buffer) => ({ name, mimeType, buffer });
const pdfDeTeste = () => readFileSync("e2e/fixtures/titulo-teste/publicacao/bibliotheon/amostra.pdf");
// Espera a página hidratar: um arquivo escolhido ou um clique antes disso se perde (só acontece em teste, sem humano).
const abrir = (page: Page, url: string) => page.goto(url, { waitUntil: "networkidle" });
const noAr = (request: Page["request"], slug: string) => request.get(`/${slug}`).then((r) => r.status());

async function preencherBasico(page: Page) {
  await page.getByRole("textbox", { name: "Descrição da capa", exact: true }).fill("Capa do Guia Prático de Horta Urbana");
  await page.getByRole("textbox", { name: "Headline", exact: true }).fill("Plante o seu primeiro canteiro em casa, sem quintal");
  await page.getByRole("textbox", { name: "Resumo", exact: true }).fill("Um passo a passo para começar uma horta num apartamento, com o que você já tem.");
  for (let n = 1; n <= 3; n++) {
    await page.getByRole("button", { name: "Adicionar benefício" }).click();
    await page.getByRole("textbox", { name: `Benefício ${n}`, exact: true }).fill(`Aprender a fazer o passo ${n} da horta`);
  }
}

test("criar um e-book: nasce rascunho com endereço do título e não vai ao ar sem o essencial", async ({ browser, request }) => {
  const { ctx, page } = await comoOwner(browser);
  await page.getByRole("link", { name: "Novo e-book" }).first().click();
  await page.getByRole("textbox", { name: "Título do livro" }).fill(TITULO);
  await page.getByRole("button", { name: "Criar e continuar" }).click();
  await expect(page).toHaveURL(/\/painel\/ebooks\/[0-9a-f-]{36}$/);
  id = page.url().split("/").pop()!;
  await expect(page.getByRole("textbox", { name: "Endereço da página" })).toHaveValue(SLUG);

  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByText("Salvei como rascunho, mas ainda não dá para publicar.")).toBeVisible();
  await expect(page.getByText(/Falta: Capa, Descrição da capa, Headline, Resumo, Pelo menos 3 benefícios/)).toBeVisible();
  expect(await noAr(request, SLUG)).toBe(404);
  await ctx.close();
});

test("capa e amostras: rejeita imagem pequena, tira os metadados e guarda com hash", async ({ browser, request }) => {
  const { ctx, page } = await comoOwner(browser);
  await abrir(page, `/painel/ebooks/${id}`);

  await page.locator('input[aria-label="Arquivo da capa"]').setInputFiles(arquivo("pequena.jpg", "image/jpeg", await imagem(500, 800, "#335577")));
  await expect(page.getByText("Essa imagem é muito pequena. Use pelo menos 1200 px de largura.")).toBeVisible();

  await page.locator('input[aria-label="Arquivo da capa"]').setInputFiles(arquivo("capa.jpg", "image/jpeg", await imagem(1300, 2080, "#884422", true)));
  await expect(page.getByText(/Capa enviada \(1300×2080 px/)).toBeVisible();
  const src = await page.locator("img[alt='Capa do Guia Prático de Horta Urbana'], img[alt='Capa atual']").first().getAttribute("src");
  expect(src).toContain("/_next/image");
  const bruto = decodeURIComponent(new URL(src!, ORIGEM).searchParams.get("url")!);
  expect(bruto).toMatch(/^\/m\/ebook\/[0-9a-f-]{36}\/[0-9a-f]{12}\.jpg$/);
  const arq = await request.get(bruto);
  expect(arq.status()).toBe(200);
  const bytes = await arq.body();
  expect(bytes.includes(Buffer.from("Exif"))).toBe(false); // metadados removidos
  expect(bytes.includes(Buffer.from("Fulano"))).toBe(false);

  const tres = [await imagem(900, 1400, "#112233"), await imagem(900, 1400, "#223344"), await imagem(900, 1400, "#334455")];
  await page.locator('input[aria-label="Arquivos das páginas de amostra"]').setInputFiles(tres.map((b, n) => arquivo(`p${n}.jpg`, "image/jpeg", b)));
  await expect(page.getByText("3 páginas enviadas.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remover página 3" })).toBeVisible();

  // reordenar: a página 1 vai para a frente
  await page.getByRole("button", { name: "Mover página 1 para a frente" }).click();
  await expect(page.getByRole("button", { name: "Mover página 1 para trás" })).toBeDisabled();
  // remover a 3 e conferir a renumeração; depois repor
  await page.getByRole("button", { name: "Remover página 3" }).click();
  await expect(page.getByRole("button", { name: "Remover página 3" })).toHaveCount(0);
  await page.locator('input[aria-label="Arquivos das páginas de amostra"]').setInputFiles(arquivo("p3.jpg", "image/jpeg", tres[2]));
  await expect(page.getByRole("button", { name: "Remover página 3" })).toBeVisible();
  await ctx.close();
});

test("PDF do livro (privado) e PDF de amostra (público)", async ({ browser, request }) => {
  const { ctx, page } = await comoOwner(browser);
  await abrir(page, `/painel/ebooks/${id}`);
  await page.locator('input[aria-label="Arquivo PDF do livro"]').setInputFiles(arquivo("meu livro (final).pdf", "application/pdf", pdfDeTeste()));
  await expect(page.getByText(/PDF enviado/)).toBeVisible();
  await expect(page.getByText("meu livro (final).pdf")).toBeVisible();
  await expect(page.getByText(/Privado: não aparece na página de vendas/)).toBeVisible();

  // arquivo que não é PDF é recusado
  await page.locator('input[aria-label="Arquivo PDF do livro"]').setInputFiles(arquivo("falso.pdf", "application/pdf", Buffer.from("isto não é um pdf")));
  await expect(page.getByText("O arquivo não é um PDF.")).toBeVisible();

  await page.locator('input[aria-label="Arquivo PDF da amostra"]').setInputFiles(arquivo("amostra.pdf", "application/pdf", pdfDeTeste()));
  await expect(page.getByText("Amostra enviada.")).toBeVisible();

  // download: o administrador baixa; sem login, não
  const r = await page.request.get(`/api/painel/ebooks/${id}/pdf`);
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toBe("application/pdf");
  expect(r.headers()["cache-control"]).toContain("no-store");
  expect((await r.body()).subarray(0, 5).toString()).toBe("%PDF-");
  expect((await request.get(`/api/painel/ebooks/${id}/pdf`)).status()).toBe(401);
  await ctx.close();
});

test("preencher, salvar rascunho e ver a prévia (sem dados estruturados nem visita)", async ({ browser, request }) => {
  const { ctx, page } = await comoOwner(browser);
  await abrir(page, `/painel/ebooks/${id}`);
  await preencherBasico(page);
  await page.getByRole("button", { name: "Adicionar loja" }).click();
  await page.getByRole("textbox", { name: "Link de compra 1" }).fill("https://pay.hotmart.com/HORTA123");
  await page.getByRole("textbox", { name: "Preço (R$)" }).fill("39,90");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Rascunho salvo.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Headline", exact: true })).toHaveValue("Plante o seu primeiro canteiro em casa, sem quintal");
  await expect(page.getByRole("textbox", { name: "Benefício 3", exact: true })).toHaveValue("Aprender a fazer o passo 3 da horta");
  await expect(page.getByRole("textbox", { name: "Link de compra 1" })).toHaveValue("https://pay.hotmart.com/HORTA123");
  await expect(page.getByText("Pronto para publicar?")).toBeVisible();

  const previa = await ctx.newPage();
  await previa.goto(`/painel/ebooks/${id}/previa`);
  await expect(previa.getByRole("heading", { level: 1 })).toHaveText("Plante o seu primeiro canteiro em casa, sem quintal");
  await expect(previa.getByText("Prévia: só você vê esta página. Ainda é rascunho.")).toBeVisible();
  await expect(previa.locator('script[type="application/ld+json"]')).toHaveCount(0);
  await expect(previa.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(previa.getByRole("link", { name: /Comprar na Hotmart/ }).first()).toHaveAttribute("href", "#comprar"); // não sai do site
  expect(await noAr(request, SLUG)).toBe(404); // continua rascunho
  await ctx.close();
});

test("publicar: a página entra no ar na hora, com o botão rastreado e na Home", async ({ browser, request }) => {
  const { ctx, page } = await comoOwner(browser);
  await abrir(page, `/painel/ebooks/${id}`);
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByText("Publicado! Sua página já está no ar.")).toBeVisible();

  await expect.poll(() => noAr(request, SLUG)).toBe(200);
  const pub = await ctx.newPage();
  await pub.goto(`/${SLUG}`);
  await expect(pub.getByRole("heading", { level: 1 })).toHaveText("Plante o seu primeiro canteiro em casa, sem quintal");
  const botao = pub.getByRole("link", { name: /Comprar na Hotmart/ }).first();
  await expect(botao).toHaveAttribute("href", /^\/ir\/[0-9a-f-]{36}/);
  const ir = await pub.request.get((await botao.getAttribute("href"))!, { maxRedirects: 0 });
  expect(ir.status()).toBe(302);
  expect(ir.headers()["location"]).toContain("pay.hotmart.com/HORTA123");
  await expect(pub.locator('script[type="application/ld+json"]').first()).toBeAttached();
  await pub.goto("/");
  await expect(pub.getByText(TITULO).first()).toBeVisible();
  expect((await request.get("/sitemap.xml").then((r) => r.text()))).toContain(`/${SLUG}`);

  // o endereço trava depois de publicado
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Endereço da página" })).toHaveAttribute("readonly", "");
  await expect(page.getByRole("button", { name: "Salvar alterações" }).first()).toBeVisible();
  await ctx.close();
});

test("editar um e-book publicado: a página muda na hora, e salvar incompleto é barrado", async ({ browser, request }) => {
  const { ctx, page } = await comoOwner(browser);
  await abrir(page, `/painel/ebooks/${id}`);
  await page.getByRole("textbox", { name: "Headline", exact: true }).fill("Tenha uma horta em casa em um fim de semana");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alterações salvas. A página já mostra a versão nova.")).toBeVisible();
  await expect.poll(async () => (await request.get(`/${SLUG}`).then((r) => r.text())).includes("Tenha uma horta em casa em um fim de semana")).toBe(true);

  // apagar a headline de uma página no ar: não salva
  await page.getByRole("textbox", { name: "Headline", exact: true }).fill("");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText(/Não salvei, porque a página está no ar e ficaria incompleta\. Falta: Headline/)).toBeVisible();
  expect((await request.get(`/${SLUG}`).then((r) => r.text()))).toContain("Tenha uma horta em casa em um fim de semana");

  // o erro não apaga o que a pessoa digitou nos outros campos
  await expect(page.getByRole("textbox", { name: "Resumo", exact: true })).toHaveValue(/passo a passo para começar uma horta/);
  await page.getByRole("textbox", { name: "Headline", exact: true }).fill("Tenha uma horta em casa em um fim de semana");
  await ctx.close();
});

test("campanha com prazo: exige o link da campanha em cada loja e o /ir troca de checkout", async ({ browser, request }) => {
  const { ctx, page } = await comoOwner(browser);
  await abrir(page, `/painel/ebooks/${id}`);
  await page.getByRole("switch", { name: "Campanha com prazo" }).click();
  await page.getByRole("textbox", { name: "Nome", exact: true }).fill("Semana da Horta");
  await page.getByRole("textbox", { name: "Preço na campanha (R$)" }).fill("29,90");
  const fim = new Date(Date.now() + 10 * 86_400_000);
  await page.getByLabel("Termina em (horário de Brasília)").fill(`${fim.toISOString().slice(0, 10)}T20:00`);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText(/Campanha sem o link do checkout com o preço da campanha em: hotmart/)).toBeVisible();

  await page.getByRole("textbox", { name: "Link com o preço da campanha" }).fill("https://pay.hotmart.com/HORTA123?off=promo");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alterações salvas.")).toBeVisible();

  await expect.poll(async () => (await request.get(`/${SLUG}`).then((r) => r.text())).includes("Semana da Horta")).toBe(true);
  const html = await request.get(`/${SLUG}`).then((r) => r.text());
  const id1 = /href="\/ir\/([0-9a-f-]{36})/.exec(html)![1];
  const ir = await request.get(`/ir/${id1}`, { maxRedirects: 0 });
  expect(ir.headers()["location"]).toContain("off=promo");

  // desligar a campanha limpa preço "de", prazo e nome; o /ir volta ao link normal
  await page.getByRole("switch", { name: "Campanha com prazo" }).click();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alterações salvas.")).toBeVisible();
  await expect.poll(async () => (await request.get(`/ir/${id1}`, { maxRedirects: 0 })).headers()["location"]).not.toContain("off=promo");
  await expect.poll(async () => (await request.get(`/${SLUG}`).then((r) => r.text())).includes("Semana da Horta")).toBe(false);

  // prazo no passado é recusado
  await page.getByRole("switch", { name: "Campanha com prazo" }).click();
  await page.getByRole("textbox", { name: "Nome", exact: true }).fill("Velha");
  await page.getByRole("textbox", { name: "Preço na campanha (R$)" }).fill("20,00");
  await page.getByLabel("Termina em (horário de Brasília)").fill("2020-01-01T10:00");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText(/prazo da campanha já passou/)).toBeVisible();
  await ctx.close();
});

test("várias lojas: todas aparecem na página; link que não é https é recusado; retirar uma loja apaga só ela", async ({ browser, request }) => {
  const { ctx, page } = await comoOwner(browser);
  await abrir(page, `/painel/ebooks/${id}`);
  await page.getByRole("button", { name: "Adicionar loja" }).click();
  await page.getByLabel("Loja 2", { exact: true }).selectOption("kiwify");
  await page.getByRole("textbox", { name: "Link de compra 2" }).fill("http://pay.kiwify.com.br/inseguro");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText(/Loja 2: o link precisa começar com https:\/\//)).toBeVisible();

  await page.getByRole("textbox", { name: "Link de compra 2" }).fill("https://pay.kiwify.com.br/HORTA456");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alterações salvas.")).toBeVisible();
  await expect.poll(async () => (await request.get(`/${SLUG}`).then((r) => r.text())).includes("Comprar na Kiwify")).toBe(true);
  const html = await request.get(`/${SLUG}`).then((r) => r.text());
  expect(html).toContain("Comprar na Hotmart");
  // com duas lojas o botão do topo leva ao bloco de compra; com uma, vai direto ao checkout
  expect(html).toContain('href="#comprar"');
  expect(html).toContain("Escolher onde comprar");

  await page.getByRole("button", { name: "Remover loja 2" }).click();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alterações salvas.")).toBeVisible();
  await expect.poll(async () => (await request.get(`/${SLUG}`).then((r) => r.text())).includes("Comprar na Kiwify")).toBe(false);
  const depois = await request.get(`/${SLUG}`).then((r) => r.text());
  expect(depois).toContain("Comprar na Hotmart");
  expect(depois).not.toContain("Escolher onde comprar");
  await ctx.close();
});

test("endereços: reservado e repetido são recusados; título 'Painel' não vira rota do site", async ({ browser }) => {
  const { ctx, page } = await comoOwner(browser);
  await page.getByRole("link", { name: "Novo e-book" }).first().click();
  await page.getByRole("textbox", { name: "Título do livro" }).fill("Painel");
  await page.getByRole("button", { name: "Criar e continuar" }).click();
  await expect(page.getByRole("textbox", { name: "Endereço da página" })).toHaveValue("painel-livro");

  await page.getByRole("textbox", { name: "Endereço da página" }).fill("admin");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Esse endereço é usado pelo site. Escolha outro.")).toBeVisible();
  await page.getByRole("textbox", { name: "Endereço da página" }).fill(SLUG);
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Esse endereço já está em uso por outro e-book.")).toBeVisible();
  await page.getByRole("textbox", { name: "Endereço da página" }).fill("Com Acento Ã");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText(/Use só letras minúsculas sem acento/)).toBeVisible();
  await ctx.close();
});

test("usuário comum: cria e publica o próprio e-book direto, e não alcança o dos outros", async ({ browser, request }) => {
  const dono = await comoOwner(browser);
  await dono.page.getByRole("link", { name: "Usuários" }).click();
  await dono.page.getByRole("button", { name: "Novo usuário" }).click();
  await dono.page.getByRole("textbox", { name: "Nome" }).fill("Beto Editor");
  await dono.page.getByRole("textbox", { name: "E-mail" }).fill("beto@teste.com");
  await dono.page.getByRole("button", { name: "Criar e gerar senha" }).click();
  senhaDoBeto = (await dono.page.locator("code").textContent())!;
  await dono.ctx.close();

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await entrar(page, "beto@teste.com", senhaDoBeto);
  await expect(page.getByText("Você ainda não tem e-books.")).toBeVisible();
  await expect(page.getByText(TITULO)).toHaveCount(0);

  // não alcança o e-book do administrador: tela, prévia, upload e download
  await abrir(page, `/painel/ebooks/${id}`);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await page.goto(`/painel/ebooks/${id}/previa`);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  expect((await page.request.get(`/api/painel/ebooks/${id}/pdf`)).status()).toBe(404);
  const envio = await page.request.post(`/api/painel/ebooks/${id}/capa`, { headers: { origin: ORIGEM }, multipart: { arquivo: arquivo("x.jpg", "image/jpeg", await imagem(1300, 2000, "#000000")) } });
  expect(envio.status()).toBe(404);
  const apaga = await page.request.delete(`/api/painel/ebooks/${id}/amostras?amostra=qualquer`, { headers: { origin: ORIGEM } });
  expect(apaga.status()).toBe(404);
  // origem de outro site é recusada mesmo com a sessão certa (cookie enviado por página de terceiros)
  expect((await page.request.post(`/api/painel/ebooks/${id}/capa`, { headers: { origin: "https://site-malicioso.example" }, multipart: { arquivo: arquivo("x.jpg", "image/jpeg", await imagem(1300, 2000, "#000000")) } })).status()).toBe(403);

  // o dele: cria, completa, publica direto
  await page.goto("/painel/ebooks/novo");
  await page.getByRole("textbox", { name: "Título do livro" }).fill("Receitas de Pão Caseiro");
  await page.getByRole("button", { name: "Criar e continuar" }).click();
  await expect(page).toHaveURL(/\/painel\/ebooks\/[0-9a-f-]{36}$/);
  await page.locator('input[aria-label="Arquivo da capa"]').setInputFiles(arquivo("capa.jpg", "image/jpeg", await imagem(1300, 2080, "#aa7733")));
  await expect(page.getByText(/Capa enviada/)).toBeVisible();
  await preencherBasico(page);
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByText("Publicado! Sua página já está no ar.")).toBeVisible();
  await expect.poll(() => noAr(request, "receitas-de-pao-caseiro")).toBe(200);

  await page.goto("/painel");
  await expect(page.getByText("Receitas de Pão Caseiro")).toBeVisible();
  await expect(page.getByText(TITULO)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Temas" })).toHaveCount(0);
  await ctx.close();
});

test("temas: tema fora do ar bloqueia a publicação; no ar, publica; desligar esconde a página", async ({ browser, request }) => {
  const { ctx, page } = await comoOwner(browser);
  await page.getByRole("link", { name: "Temas" }).click();
  await page.getByRole("button", { name: "Novo tema" }).click();
  await page.getByRole("textbox", { name: "Nome", exact: true }).fill("Jardinagem");
  await page.getByRole("textbox", { name: /Descrição/ }).fill("Para quem quer cultivar plantas em casa.");
  await page.getByRole("button", { name: "Criar tema" }).click();
  await expect(page.getByText("/tema/jardinagem · 0 e-books")).toBeVisible();

  // despublica o guia, escolhe o tema (fora do ar) e tenta publicar de novo
  await abrir(page, `/painel/ebooks/${id}`);
  await page.getByRole("button", { name: "Despublicar" }).click();
  await page.getByRole("button", { name: "Sim, tirar do ar" }).click();
  await expect(page.getByText("A página saiu do ar. O e-book voltou a ser rascunho.")).toBeVisible();
  await expect.poll(() => noAr(request, SLUG)).toBe(404);
  await expect(page.getByRole("textbox", { name: "Endereço da página" })).toHaveAttribute("readonly", ""); // continua travado

  await page.getByLabel("Tema", { exact: true }).selectOption({ label: "Jardinagem (fora do ar)" });
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByText(/Falta: Tema “Jardinagem” fora do ar/)).toBeVisible();
  expect(await noAr(request, SLUG)).toBe(404);

  await page.getByRole("link", { name: "Temas" }).click();
  await page.getByRole("switch", { name: "Jardinagem no ar" }).click();
  await expect(page.getByText("No ar", { exact: true })).toBeVisible();
  await abrir(page, `/painel/ebooks/${id}`);
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByText("Publicado! Sua página já está no ar.")).toBeVisible();
  await expect.poll(() => noAr(request, SLUG)).toBe(200);
  expect((await request.get("/tema/jardinagem")).status()).toBe(200);

  // tema fora do ar esconde as páginas dos e-books dele
  await page.getByRole("link", { name: "Temas" }).click();
  await page.getByRole("switch", { name: "Jardinagem no ar" }).click();
  await expect.poll(() => noAr(request, SLUG)).toBe(404);
  await ctx.close();
});

test("alterações não salvas avisam ao sair; ao salvar, o aviso some", async ({ browser }) => {
  const { ctx, page } = await comoOwner(browser);
  await abrir(page, `/painel/ebooks/${id}`);
  await expect(page.getByText("Há alterações não salvas.")).toHaveCount(0);
  // o tema do teste anterior ficou fora do ar: sem ele o livro publicado pode ser salvo
  await page.getByLabel("Tema", { exact: true }).selectOption({ label: "Sem tema" });
  await page.getByRole("textbox", { name: "Subtítulo", exact: true }).fill("Um subtítulo novo");
  await expect(page.getByText("Há alterações não salvas.")).toBeVisible();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alterações salvas.")).toBeVisible();
  await expect(page.getByText("Há alterações não salvas.")).toHaveCount(0);
  await ctx.close();
});
