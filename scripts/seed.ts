/**
 * Importa um título do projeto ../ebooks para o banco local (Etapa 2; a Etapa 4 troca isto pela API).
 *
 *   npm run seed -- <pasta-do-titulo> [--extras <extras.json>] [--demo] [--publicar]
 *
 * --demo     preenche preço, prazo e checkouts FICTÍCIOS (só para ver a página completa no banco local)
 * --publicar publica o e-book e o tema (sem isto, entra como rascunho)
 *
 * Regra do manifesto: ele vence nos campos que traz; o que não traz fica como está. `offers: []` não apaga ofertas.
 */
import { and, eq } from "drizzle-orm";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { db, schema } from "../src/db";
import { migrar } from "../src/db/migrar";
import { avisos, camposDoEbook, manifesto } from "../src/lib/manifesto";
import { guardarMidia, sha256 } from "../src/lib/midia";

const { ebook, tema, amostra, oferta } = schema;

function arg(nome: string) {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (nome: string) => process.argv.includes(nome);
function falhar(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const pasta = process.argv[2] && !process.argv[2].startsWith("--") ? resolve(process.argv[2]) : falhar("Uso: npm run seed -- <pasta-do-titulo> [--extras arquivo.json] [--demo] [--publicar]");
const arquivoManifesto = join(pasta, "publicacao", "bibliotheon", "manifest.json");
if (!existsSync(arquivoManifesto)) falhar(`Manifesto não encontrado: ${arquivoManifesto}`);

const bruto = JSON.parse(readFileSync(arquivoManifesto, "utf8"));
const arquivoExtras = arg("--extras");
const extras = arquivoExtras ? JSON.parse(readFileSync(resolve(arquivoExtras), "utf8")) : {};
const dirExtras = arquivoExtras ? dirname(resolve(arquivoExtras)) : dirname(arquivoManifesto); // arquivos ficam ao lado do manifesto

// Extras entram por cima do manifesto, no nível de `book` e no topo (samples, offers).
const lido = manifesto.safeParse({
  ...bruto,
  samples: extras.samples ?? bruto.samples,
  offers: extras.offers ?? bruto.offers,
  book: { ...bruto.book, ...(extras.book ?? {}) },
});
if (!lido.success) falhar(`Manifesto inválido:\n${lido.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")}`);
const m = lido.data;

if (m.pending.length) falhar(`O manifesto tem ${m.pending.length} pendência(s) em "pending": resolva no projeto ../ebooks antes de publicar.`);

migrar(db as never);

// ---- tema
let temaId: string | null = null;
if (m.book.theme) {
  const nome = extras.tema?.nome ?? m.book.theme.replace(/-/g, " ").replace(/^./, (c: string) => c.toUpperCase());
  const existente = db.select().from(tema).where(eq(tema.slug, m.book.theme)).get();
  if (existente) {
    temaId = existente.id;
    if (flag("--publicar") && !existente.publicado) db.update(tema).set({ publicado: true }).where(eq(tema.id, existente.id)).run();
  } else {
    temaId = crypto.randomUUID();
    db.insert(tema).values({ id: temaId, nome, slug: m.book.theme, descricao: extras.tema?.descricao ?? null, publicado: flag("--publicar") }).run();
  }
}

// ---- e-book (upsert por sourceId + idioma)
const campos = camposDoEbook(m);
const atual = db.select().from(ebook).where(and(eq(ebook.sourceId, m.sourceId), eq(ebook.idioma, m.language))).get();
const id = atual?.id ?? crypto.randomUUID();

const capa = join(pasta, "publicacao", "bibliotheon", m.cover.file);
if (!existsSync(capa)) falhar(`Capa não encontrada: ${capa}`);
if (m.cover.sha256 && sha256(readFileSync(capa)) !== m.cover.sha256) falhar("O SHA-256 da capa não confere com o do manifesto.");
const guardada = guardarMidia(id, capa);

const demo = flag("--demo");
const dados = {
  ...campos,
  temaId: temaId ?? atual?.temaId ?? null,
  capa: guardada.chave,
  capaHash: guardada.hash,
  ...(demo ? { preco: 7900, precoDe: 9900, ofertaAte: new Date(Date.now() + 30 * 86_400_000), emBreve: false } : {}),
  ...(flag("--publicar") ? { status: "publicado" as const, publicadoEm: atual?.publicadoEm ?? new Date() } : {}),
  atualizadoEm: new Date(),
};

if (atual) db.update(ebook).set(dados).where(eq(ebook.id, id)).run();
else db.insert(ebook).values({ id, sourceId: m.sourceId, ...dados, titulo: m.book.title, slug: campos.slug! }).run();

// ---- figura de destaque e amostras (substituem o conjunto anterior, se vierem)
const filho = (arquivo: string) => {
  const caminho = join(dirExtras, arquivo);
  return existsSync(caminho) ? caminho : falhar(`Arquivo não encontrado: ${caminho}`);
};
if (m.book.figure) {
  const f = guardarMidia(id, filho(m.book.figure.file));
  db.update(ebook).set({ figura: f.chave, figuraAlt: m.book.figure.alt ?? null, figuraLegenda: m.book.figure.caption ?? null }).where(eq(ebook.id, id)).run();
}
if (m.samples?.length) {
  db.delete(amostra).where(eq(amostra.ebookId, id)).run();
  m.samples.forEach((s, ordem) => db.insert(amostra).values({ ebookId: id, imagem: guardarMidia(id, filho(s.file)).chave, alt: s.alt ?? null, ordem }).run());
}

// ---- ofertas: manifesto com itens substitui; vazio não mexe. --demo cria checkouts fictícios se não houver nenhum.
if (m.offers.length) {
  db.delete(oferta).where(eq(oferta.ebookId, id)).run();
  m.offers.forEach((o, ordem) =>
    db.insert(oferta).values({ ebookId: id, plataforma: o.platform, rotulo: o.label ?? null, url: o.url, preco: o.price ? Math.round(o.price * 100) : null, principal: o.primary ?? ordem === 0, ordem }).run(),
  );
} else if (demo && !db.select().from(oferta).where(eq(oferta.ebookId, id)).get()) {
  db.insert(oferta).values({ ebookId: id, plataforma: "kiwify", url: "https://example.com/checkout-demo-kiwify", principal: true, ordem: 0 }).run();
  db.insert(oferta).values({ ebookId: id, plataforma: "cakto", url: "https://example.com/checkout-demo-cakto", principal: false, ordem: 1 }).run();
}

const final = db.select().from(ebook).where(eq(ebook.id, id)).get()!;
console.log(`${atual ? "✓ Atualizado" : "✓ Criado"}: ${final.titulo}`);
console.log(`  endereço : /${final.slug}  (${final.status})`);
console.log(`  preço    : ${final.emBreve || final.preco == null ? "em breve" : `R$ ${(final.preco / 100).toFixed(2)}${demo ? " (DEMO)" : ""}`}`);
for (const a of avisos(m)) console.log(`  ! ${a}`);
if (!flag("--publicar")) console.log("  Ainda é rascunho: use --publicar para colocá-lo no ar.");
