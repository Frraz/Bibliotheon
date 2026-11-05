import sharp from "sharp";
import { describe, expect, it } from "vitest";

process.env.DATABASE_PATH = ":memory:";
process.env.MEDIA_DIR = `${process.env.TMPDIR ?? "/tmp"}/bibliotheon-teste-${process.pid}/media`;

const { db, schema } = await import("@/db");
const { manifesto } = await import("./manifesto");
const { publicarManifesto } = await import("./publicar-manifesto");
const { eq } = await import("drizzle-orm");

const jpeg = (w = 1300, h = 1700) => sharp({ create: { width: w, height: h, channels: 3, background: "#884433" } }).jpeg().toBuffer();

const base = (extra: Record<string, unknown> = {}, livro: Record<string, unknown> = {}) =>
  manifesto.parse({
    contract: "bibliotheon-editorial/v2",
    sourceId: "livro-a",
    language: "pt-BR",
    book: { title: "Livro A", slug: "livro-a", theme: "tema-a", headline: "Uma headline", summary: "Resumo", benefits: ["um", "dois", "três"], price: 49.9, ...livro },
    cover: { file: "capa.png", sha256: "hash-da-capa", alt: "Capa do livro A" },
    offers: [{ platform: "kiwify", url: "https://pay.kiwify.com.br/aaa" }],
    pending: [],
    ...extra,
  });

describe("publicarManifesto", () => {
  it("pendência bloqueia e lista o motivo", async () => {
    const r = await publicarManifesto(base({ pending: ["Falta o tema"] }), {});
    expect(r).toMatchObject({ ok: false, status: 422, detalhes: ["Falta o tema"] });
  });

  it("cria em rascunho, com tema novo fora do ar; o dry-run não grava nada", async () => {
    const seco = await publicarManifesto(base(), {}, { dryRun: true });
    expect(seco).toMatchObject({ ok: true, acao: "criar", gravado: false, capa: "enviar" });
    expect(db.select().from(schema.ebook).where(eq(schema.ebook.slug, "livro-a")).get()).toBeUndefined();

    const r = await publicarManifesto(base(), { capa: await jpeg() });
    expect(r).toMatchObject({ ok: true, acao: "criar", status: "rascunho", gravado: true, capa: "recebida" });
    const e = db.select().from(schema.ebook).where(eq(schema.ebook.slug, "livro-a")).get()!;
    expect(e).toMatchObject({ sourceId: "livro-a", status: "rascunho", preco: 4990, capaHash: "hash-da-capa" });
    const t = db.select().from(schema.tema).where(eq(schema.tema.slug, "tema-a")).get()!;
    expect(t.publicado).toBe(false);
    expect(db.select().from(schema.oferta).where(eq(schema.oferta.ebookId, e.id)).all()).toHaveLength(1);
  });

  it("repetir não muda nada, e offers vazio não apaga as lojas", async () => {
    const r = await publicarManifesto(base({ offers: [] }), {}, { dryRun: true });
    expect(r).toMatchObject({ ok: true, acao: "atualizar", mudancas: [], capa: "igual" });
    await publicarManifesto(base({ offers: [] }), {});
    const e = db.select().from(schema.ebook).where(eq(schema.ebook.slug, "livro-a")).get()!;
    expect(db.select().from(schema.oferta).where(eq(schema.oferta.ebookId, e.id)).all()).toHaveLength(1);
  });

  it("mostra o que muda e atualiza a loja existente sem recriá-la", async () => {
    const antes = db.select().from(schema.oferta).all()[0];
    const m = base({ offers: [{ platform: "kiwify", url: "https://pay.kiwify.com.br/novo" }] }, { headline: "Outra headline" });
    const r = await publicarManifesto(m, {}, { dryRun: true });
    expect(r.ok && r.mudancas.join("|")).toMatch(/Headline: “Uma headline” → “Outra headline”.*Loja kiwify: link de compra mudou/);
    await publicarManifesto(m, {});
    const depois = db.select().from(schema.oferta).where(eq(schema.oferta.id, antes.id)).get()!;
    expect(depois.url).toBe("https://pay.kiwify.com.br/novo");
  });

  it("endereço de outro livro é 409; e-book do painel (sem sourceId) só é vinculado com --adotar", async () => {
    const outro = await publicarManifesto(base({ sourceId: "outro" }), {});
    expect(outro).toMatchObject({ ok: false, status: 409 });

    db.insert(schema.ebook).values({ titulo: "Do painel", slug: "do-painel", formatos: ["PDF"] }).run();
    const m = base({ sourceId: "do-painel-fonte" }, { title: "Do painel", slug: "do-painel" });
    expect(await publicarManifesto(m, {})).toMatchObject({ ok: false, status: 409 });
    const ok = await publicarManifesto(m, {}, { adotar: true });
    expect(ok).toMatchObject({ ok: true, acao: "atualizar" });
    expect(db.select().from(schema.ebook).where(eq(schema.ebook.slug, "do-painel")).get()?.sourceId).toBe("do-painel-fonte");
  });

  it("e-book no ar: preço, campanha e 'em breve' do manifesto são ignorados, com aviso, e o endereço não muda", async () => {
    const e = db.select().from(schema.ebook).where(eq(schema.ebook.slug, "livro-a")).get()!;
    db.update(schema.tema).set({ publicado: true }).where(eq(schema.tema.slug, "tema-a")).run();
    db.update(schema.ebook).set({ status: "publicado", publicadoEm: new Date(), preco: 2499, precoDe: 6499, ofertaAte: new Date(Date.now() + 86_400_000) }).where(eq(schema.ebook.id, e.id)).run();
    db.update(schema.oferta).set({ urlPromo: "https://pay.kiwify.com.br/promo" }).where(eq(schema.oferta.ebookId, e.id)).run();
    const m = base({}, { price: 64.99, comingSoon: true, slug: "outro-endereco", headline: "Outra headline" });
    const r = await publicarManifesto(m, {});
    expect(r.ok && r.avisos.join(" ")).toMatch(/não mudam por manifesto/);
    expect(r.ok && r.avisos.join(" ")).toMatch(/endereço de um e-book já publicado não muda/);
    const depois = db.select().from(schema.ebook).where(eq(schema.ebook.id, e.id)).get()!;
    expect(depois).toMatchObject({ preco: 2499, precoDe: 6499, emBreve: false, slug: "livro-a" });
  });

  it("publicar sem tema no ar não grava nada e diz o que falta", async () => {
    const m = base({ sourceId: "livro-b" }, { title: "Livro B", slug: "livro-b", theme: "tema-b" });
    const r = await publicarManifesto(m, { capa: await jpeg() }, { publicar: true });
    expect(r).toMatchObject({ ok: false, status: 422 });
    expect(!r.ok && r.erro).toMatch(/Tema/);
    expect(db.select().from(schema.ebook).where(eq(schema.ebook.slug, "livro-b")).get()).toBeUndefined();

    db.update(schema.tema).set({ publicado: true }).where(eq(schema.tema.slug, "tema-b")).run(); // o tema só existe depois de uma gravação
    expect(db.select().from(schema.tema).where(eq(schema.tema.slug, "tema-b")).get()).toBeUndefined();
    db.insert(schema.tema).values({ nome: "Tema B", slug: "tema-b", publicado: true }).run();
    const ok = await publicarManifesto(m, { capa: await jpeg() }, { publicar: true });
    expect(ok).toMatchObject({ ok: true, status: "publicado" });
  });
});
