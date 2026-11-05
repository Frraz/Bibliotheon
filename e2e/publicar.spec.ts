import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

// Publicar pelo terminal: a API (POST /api/v1/ebooks) e o cliente ferramentas/publicar.py, contra o pacote standalone.
test.describe.configure({ mode: "serial" });

const AUT = { authorization: "Bearer token-de-teste" };
const ORIGEM = "http://127.0.0.1:3101";
let pasta = "";

const manifesto = (extra: Record<string, unknown> = {}, livro: Record<string, unknown> = {}) => ({
  contract: "bibliotheon-editorial/v2",
  sourceId: "livro-cli-teste",
  language: "pt-BR",
  edition: "1ª edição",
  book: { title: "Livro do Terminal", slug: "livro-do-terminal", theme: "tema-do-terminal", themeName: "Tema do Terminal", headline: "Publicado pelo terminal", summary: "Resumo do livro.", benefits: ["Um", "Dois", "Três"], price: 39.9, ...livro },
  cover: { file: "capa.png", sha256: "hash-capa-teste", alt: "Capa do livro do terminal" },
  samples: ["amostra-01.png", "amostra-02.png"],
  offers: [{ platform: "cakto", url: "https://pay.example.com/terminal" }],
  pending: [],
  ...extra,
});

const gravar = (m: object) => writeFileSync(join(pasta, "publicacao", "bibliotheon", "manifest.json"), JSON.stringify(m, null, 2));
const cli = (...args: string[]) =>
  spawnSync("python3", ["ferramentas/publicar.py", ...args], { encoding: "utf-8", env: { ...process.env, BIBLIOTHEON_URL: ORIGEM, BIBLIOTHEON_TOKEN: "token-de-teste" } });

test.beforeAll(async () => {
  pasta = mkdtempSync(join(tmpdir(), "titulo-"));
  const dir = join(pasta, "publicacao", "bibliotheon");
  mkdirSync(dir, { recursive: true });
  const img = (w: number, h: number, cor: string) => sharp({ create: { width: w, height: h, channels: 3, background: cor } }).png().toBuffer();
  writeFileSync(join(dir, "capa.png"), await img(1300, 1700, "#335544"));
  writeFileSync(join(dir, "amostra-01.png"), await img(800, 1100, "#aa5533"));
  writeFileSync(join(dir, "amostra-02.png"), await img(800, 1100, "#5533aa"));
  gravar(manifesto());
});

test("a API exige o token e valida o manifesto", async ({ request }) => {
  expect((await request.post("/api/v1/ebooks", { multipart: { manifest: "{}" } })).status()).toBe(401);
  const ruim = await request.post("/api/v1/ebooks", { headers: AUT, multipart: { manifest: JSON.stringify({ contract: "x" }) } });
  expect(ruim.status()).toBe(422);
  expect((await request.post("/api/v1/ebooks", { headers: AUT, multipart: { manifest: "não é json" } })).status()).toBe(422);
  const pend = await request.post("/api/v1/ebooks?dryRun=1", { headers: AUT, multipart: { manifest: JSON.stringify(manifesto({ pending: ["Falta o preço confirmado"] })) } });
  expect(pend.status()).toBe(422);
  expect((await pend.json()).detalhes).toEqual(["Falta o preço confirmado"]);
});

test("dry-run mostra as mudanças e não grava nada", async ({ request }) => {
  const r = await request.post("/api/v1/ebooks?dryRun=1", { headers: AUT, multipart: { manifest: JSON.stringify(manifesto()) } });
  expect(r.status()).toBe(200);
  const j = await r.json();
  expect(j).toMatchObject({ acao: "criar", gravado: false, capa: "enviar", amostras: "enviar", slug: "livro-do-terminal" });
  expect(j.mudancas.join(" ")).toMatch(/Novo e-book em rascunho/);
  expect((await request.get("/api/v1/ebooks/livro-cli-teste", { headers: AUT })).status()).toBe(404);
});

test("terminal: publica como rascunho e, na segunda vez, não há mudança", async ({ request }) => {
  const a = cli("publicar", pasta, "--sim");
  expect(a.status, a.stderr).toBe(0);
  expect(a.stdout).toMatch(/Salvo como rascunho/);

  const c = await request.get("/api/v1/ebooks/livro-cli-teste", { headers: AUT });
  expect(c.status()).toBe(200);
  expect(await c.json()).toMatchObject({ slug: "livro-do-terminal", status: "rascunho" });
  // o rascunho não aparece para o público
  expect((await request.get("/livro-do-terminal")).status()).toBe(404);

  const b = cli("publicar", pasta, "--sim");
  expect(b.status, b.stderr).toBe(0);
  expect(b.stdout).toMatch(/Nenhuma mudança/);
});

test("terminal: mudança de texto aparece antes de enviar; pendência e endereço de outro livro são recusados", async ({ request }) => {
  gravar(manifesto({}, { headline: "Outra headline do terminal" }));
  const sem = spawnSync("python3", ["ferramentas/publicar.py", "publicar", pasta], { encoding: "utf-8", input: "n\n", env: { ...process.env, BIBLIOTHEON_URL: ORIGEM, BIBLIOTHEON_TOKEN: "token-de-teste" } });
  expect(sem.stdout).toMatch(/Headline: “Publicado pelo terminal” → “Outra headline do terminal”/);
  expect(sem.stdout).toMatch(/Nada foi enviado/);
  const ok = cli("publicar", pasta, "--sim");
  expect(ok.status, ok.stderr).toBe(0);

  gravar(manifesto({ pending: ["Confirmar o tema"] }));
  const pend = cli("publicar", pasta, "--sim");
  expect(pend.status).toBe(1);
  expect(pend.stderr).toMatch(/Confirmar o tema/);

  gravar(manifesto());
  const outro = await request.post("/api/v1/ebooks?dryRun=1", { headers: AUT, multipart: { manifest: JSON.stringify(manifesto({ sourceId: "outro-livro" })) } });
  expect(outro.status()).toBe(409);

  const consulta = cli("consultar", pasta);
  expect(consulta.stdout).toMatch(/livro-do-terminal: rascunho/);
  expect(cli("publicar").status).toBe(2);
});

test("--publicar não publica se o tema ainda está fora do ar, e não grava nada", async () => {
  const r = cli("publicar", pasta, "--sim", "--publicar");
  expect(r.status).toBe(1);
  expect(r.stderr).toMatch(/Tema/);
});
