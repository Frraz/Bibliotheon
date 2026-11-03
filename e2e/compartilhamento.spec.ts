import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

// Regressão de 03/11/2026: a imagem de compartilhamento de um livro com capa PNG de vários MB respondia 502 em produção
// (a rota embutia a capa original, e o container tem 512 MB). A capa agora é reduzida antes de entrar na imagem.
const SLUG = "livro-com-capa-pesada";

test.beforeAll(async () => {
  const banco = new Database(".e2e/data/bibliotheon.db");
  banco.pragma("busy_timeout = 5000");
  if (!banco.prepare("SELECT 1 FROM ebook WHERE slug = ?").get(SLUG)) {
    const id = crypto.randomUUID();
    // ruído: não comprime, como uma ilustração cheia de detalhe. ~1600×2560, vários MB.
    const bruto = randomBytes(1600 * 2560 * 3);
    const png = await sharp(bruto, { raw: { width: 1600, height: 2560, channels: 3 } }).png({ compressionLevel: 1 }).toBuffer();
    expect(png.length).toBeGreaterThan(5_000_000);
    const chave = `ebook/${id}/pesada.png`;
    mkdirSync(`.e2e/data/media/ebook/${id}`, { recursive: true });
    writeFileSync(`.e2e/data/media/${chave}`, png);
    const agora = Date.now();
    banco
      .prepare(`INSERT INTO ebook (id, slug, status, titulo, capa, preco, publicado_em, criadoEm, atualizadoEm) VALUES (?, ?, 'publicado', 'Livro com capa pesada', ?, 4799, ?, ?, ?)`)
      .run(id, SLUG, chave, agora, agora, agora);
  }
  banco.close();
});

test("imagem de compartilhamento de livro com capa PNG pesada responde e é leve", async ({ page, request }) => {
  await page.goto(`/${SLUG}`);
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  const caminho = new URL(og!).pathname + new URL(og!).search;
  const r = await request.get(caminho, { timeout: 25_000 });
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toBe("image/png");
  expect((await r.body()).length).toBeLessThan(600_000);
  // o servidor segue de pé depois do pedido
  expect((await request.get("/api/saude")).status()).toBe(200);
});
