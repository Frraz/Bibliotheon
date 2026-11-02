import { z } from "zod";
import { PLATAFORMAS, type NovoEbook } from "@/db/schema";

// Contrato `bibliotheon-editorial/v1` (o manifest.json que já existe em ../ebooks) + campos opcionais novos.
// Campos desconhecidos viram aviso, nunca erro (z.looseObject). Ver docs/03-tecnico.md, "Contrato do manifesto".

const textos = z.array(z.string().trim().min(1));

const book = z.looseObject({
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
  theme: z.string().trim().min(1).optional(),
  summary: z.string().optional(),
  body: z.string().optional(),
  problem: z.string().optional(),
  promise: z.string().optional(),
  audience: z.union([z.string(), textos]).optional(),
  requirements: z.string().optional(),
  limits: z.string().optional(),
  benefits: textos.optional(),
  accentPreset: z.string().optional(),
  // novos, opcionais
  subtitle: z.string().optional(),
  headline: z.string().optional(),
  author: z.string().optional(),
  authorBio: z.string().optional(),
  formats: textos.optional(),
  notFor: textos.optional(),
  included: textos.optional(),
  toc: textos.optional(),
  faq: z.array(z.object({ q: z.string().min(1), a: z.string().min(1) })).optional(),
  figure: z.object({ file: z.string(), alt: z.string().optional(), caption: z.string().optional() }).optional(),
  price: z.number().positive().optional(),
  priceFrom: z.number().positive().optional(),
  offerEndsAt: z.iso.datetime({ offset: true }).optional(),
  guaranteeDays: z.number().int().min(0).max(90).optional(),
  comingSoon: z.boolean().optional(),
});

const oferta = z.object({
  platform: z.enum(PLATAFORMAS),
  url: z.url({ protocol: /^https$/, error: "O link do checkout precisa começar com https://" }),
  price: z.number().positive().optional(),
  primary: z.boolean().optional(),
  label: z.string().optional(),
});

export const manifesto = z.looseObject({
  contract: z.string().regex(/^bibliotheon-editorial\/v[12]$/, "contrato desconhecido"),
  sourceId: z.string().trim().min(1),
  language: z.string().default("pt-BR"),
  edition: z.union([z.string(), z.number()]).optional(),
  book,
  cover: z.object({ file: z.string().min(1), sha256: z.string().optional(), alt: z.string().optional() }),
  samples: z.array(z.object({ file: z.string(), alt: z.string().optional() })).optional(),
  samplePdf: z.string().optional(),
  offers: z.array(oferta).default([]),
  pending: z.array(z.unknown()).default([]),
});
export type Manifesto = z.infer<typeof manifesto>;

/** Acento por preset (por enquanto só informativo; a cor por e-book entra depois). */
const ACCENT: Record<string, string> = { mineral: "#4B5E55" };

export function slugify(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const centavos = (v?: number) => (v == null ? null : Math.round(v * 100));
const lista = (v?: string[]) => (v ?? []).map((s) => s.trim()).filter(Boolean);

/** Campos do manifesto que o upsert deve tocar; o que não vier fica como está no painel. Só inclui chaves presentes. */
export function camposDoEbook(m: Manifesto): Partial<NovoEbook> {
  const b = m.book;
  const f: Partial<NovoEbook> = {
    titulo: b.title,
    slug: b.slug ?? slugify(b.title),
    idioma: m.language,
  };
  const set = <K extends keyof NovoEbook>(k: K, v: NovoEbook[K] | undefined) => {
    if (v !== undefined) f[k] = v;
  };
  if (m.edition !== undefined) set("edicao", String(m.edition));
  set("subtitulo", b.subtitle);
  set("headline", b.headline);
  set("autorExibido", b.author);
  set("sobreAutor", b.authorBio);
  set("resumo", b.summary);
  set("descricao", b.body);
  set("problema", b.problem);
  if (b.benefits) set("beneficios", lista(b.benefits));
  if (b.audience !== undefined) set("paraQuem", lista(typeof b.audience === "string" ? [b.audience] : b.audience));
  if (b.notFor) set("naoEPara", lista(b.notFor));
  if (b.included) set("incluido", lista(b.included));
  if (b.formats) set("formatos", lista(b.formats));
  if (b.toc) set("sumario", lista(b.toc));
  if (b.faq) set("faq", b.faq.map((x) => ({ p: x.q, r: x.a })));
  const obs = [b.requirements, b.limits].filter(Boolean).join("\n\n");
  if (obs) set("observacoes", obs);
  if (b.accentPreset && ACCENT[b.accentPreset]) set("accent", ACCENT[b.accentPreset]);
  if (b.price !== undefined) set("preco", centavos(b.price));
  if (b.priceFrom !== undefined) set("precoDe", centavos(b.priceFrom));
  if (b.offerEndsAt !== undefined) set("ofertaAte", new Date(b.offerEndsAt));
  if (b.guaranteeDays !== undefined) set("garantiaDias", b.guaranteeDays);
  if (b.comingSoon !== undefined) set("emBreve", b.comingSoon);
  set("capaAlt", m.cover.alt);
  if (m.cover.sha256) set("capaHash", m.cover.sha256);
  return f;
}

/** Avisos (não bloqueiam) para quem publica: o que o manifesto traz mas o site ignora, ou falta para vender bem. */
export function avisos(m: Manifesto): string[] {
  const a: string[] = [];
  const b = m.book;
  if (!b.headline) a.push(b.promise ? "Sem headline: a página usará o título. Escreva uma headline de resultado (docs/04, guia de copy)." : "Sem headline: a página usará o título.");
  if (!b.faq?.length) a.push("Sem FAQ: ele responde objeções e vira rich result no Google.");
  if (!b.toc?.length) a.push("Sem sumário.");
  if (!m.samples?.length) a.push("Sem páginas de amostra: é o maior gatilho de conversão de um e-book.");
  if (b.price === undefined && !b.comingSoon) a.push("Sem preço: a página ficará como “Em breve”.");
  for (const k of ["materialState", "presentationVariant"]) if (k in b) a.push(`Campo “${k}” ignorado pelo site.`);
  return a;
}
