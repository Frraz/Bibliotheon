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
  pains: textos.optional(),
  benefits: textos.optional(),
  differentiators: textos.optional(),
  accentPreset: z.string().optional(),
  // novos, opcionais (o gerador de ../ebooks já os emite)
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "cor no formato #RRGGBB").optional(),
  seoTitle: z.string().trim().min(1).optional(),
  seoDescription: z.string().trim().min(1).optional(),
  themeName: z.string().trim().min(1).optional(),
  themeDescription: z.string().trim().min(1).optional(),
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
  offerName: z.string().trim().min(1).optional(),
  installments: z.string().trim().min(1).optional(),
  guaranteeDays: z.number().int().min(0).max(90).optional(),
  comingSoon: z.boolean().optional(),
});

const linkCheckout = z.url({ protocol: /^https$/, error: "O link do checkout precisa começar com https://" });

const oferta = z.object({
  platform: z.enum(PLATAFORMAS),
  url: linkCheckout,
  promoUrl: linkCheckout.optional(),
  price: z.number().positive().optional(),
  primary: z.boolean().optional(),
  label: z.string().optional(),
  /** Id do produto na loja: é como os avisos de venda descobrem de qual livro é a venda (opcional; o nome igual ao título também serve). */
  productId: z.union([z.string().trim().min(1), z.number().int().positive().transform(String)]).optional(),
});

export const manifesto = z.looseObject({
  contract: z.string().regex(/^bibliotheon-editorial\/v[12]$/, "contrato desconhecido"),
  sourceId: z.string().trim().min(1),
  language: z.string().default("pt-BR"),
  edition: z.union([z.string(), z.number()]).optional(),
  book,
  cover: z.object({ file: z.string().min(1), sha256: z.string().optional(), alt: z.string().optional() }),
  // O gerador de ../ebooks (v2) manda só os nomes dos arquivos; o v1 e os extras mandam { file, alt }.
  samples: z.array(z.union([z.string().transform((file) => ({ file, alt: undefined as string | undefined })), z.object({ file: z.string(), alt: z.string().optional() })])).optional(),
  samplePdf: z.string().optional(),
  offers: z.array(oferta).default([]),
  pending: z.array(z.unknown()).default([]),
});
export type Manifesto = z.infer<typeof manifesto>;

/** Acento por preset (`book.accent`, em hex, vale mais). */
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

const centavos = (v?: number | null) => (v == null ? null : Math.round(v * 100));
const lista = (v?: string[]) => (v ?? []).map((s) => s.trim()).filter(Boolean);

/** Ajuste de venda em produção (PATCH /api/v1/ebooks/<slug>): os mesmos nomes do manifesto, sem capa nem endereço. `null` limpa a campanha. */
export const ajusteDeVenda = z.looseObject({
  book: book
    .partial()
    .omit({ slug: true })
    .extend({
      priceFrom: z.number().positive().nullable().optional(),
      offerEndsAt: z.iso.datetime({ offset: true }).nullable().optional(),
      offerName: z.string().trim().min(1).nullable().optional(),
      installments: z.string().trim().min(1).nullable().optional(),
    })
    .optional(),
  offers: z
    .array(
      z.object({
        platform: z.enum(PLATAFORMAS),
        url: linkCheckout.optional(),
        promoUrl: linkCheckout.nullable().optional(),
        price: z.number().positive().nullable().optional(),
        primary: z.boolean().optional(),
        label: z.string().optional(),
        productId: z.union([z.string().trim().min(1), z.number().int().positive().transform(String)]).nullable().optional(),
      }),
    )
    .optional(),
});
export type AjusteDeVenda = z.infer<typeof ajusteDeVenda>;

/** Campos de venda presentes em `b`. O que não vier fica como está. */
export function camposDeVenda(b: NonNullable<AjusteDeVenda["book"]>): Partial<NovoEbook> {
  const f: Partial<NovoEbook> = {};
  const set = <K extends keyof NovoEbook>(k: K, v: NovoEbook[K] | undefined) => {
    if (v !== undefined) f[k] = v;
  };
  if (b.title !== undefined) set("titulo", b.title);
  set("subtitulo", b.subtitle);
  set("headline", b.headline);
  set("autorExibido", b.author);
  set("sobreAutor", b.authorBio);
  set("resumo", b.summary);
  set("descricao", b.body);
  set("problema", b.problem);
  if (b.pains) set("dores", lista(b.pains));
  if (b.benefits) set("beneficios", lista(b.benefits));
  if (b.differentiators) set("diferenciais", lista(b.differentiators));
  if (b.audience !== undefined) set("paraQuem", lista(typeof b.audience === "string" ? [b.audience] : b.audience));
  if (b.notFor) set("naoEPara", lista(b.notFor));
  if (b.included) set("incluido", lista(b.included));
  if (b.formats) set("formatos", lista(b.formats));
  if (b.toc) set("sumario", lista(b.toc));
  if (b.faq) set("faq", b.faq.map((x) => ({ p: x.q, r: x.a })));
  const obs = [b.requirements, b.limits].filter(Boolean).join("\n\n");
  if (obs) set("observacoes", obs);
  if (b.accentPreset && ACCENT[b.accentPreset]) set("accent", ACCENT[b.accentPreset]);
  if (b.accent) set("accent", b.accent.toLowerCase()); // o hex explícito vale mais que o preset
  set("seoTitle", b.seoTitle);
  set("seoDescription", b.seoDescription);
  if (b.price !== undefined) set("preco", centavos(b.price));
  if (b.priceFrom !== undefined) set("precoDe", centavos(b.priceFrom));
  if (b.offerEndsAt !== undefined) set("ofertaAte", b.offerEndsAt === null ? null : new Date(b.offerEndsAt));
  set("ofertaNome", b.offerName);
  set("parcelamento", b.installments);
  if (b.guaranteeDays !== undefined) set("garantiaDias", b.guaranteeDays);
  if (b.comingSoon !== undefined) set("emBreve", b.comingSoon);
  return f;
}

/** Campos do manifesto que o upsert deve tocar; o que não vier fica como está no painel. Só inclui chaves presentes. */
export function camposDoEbook(m: Manifesto): Partial<NovoEbook> {
  const f: Partial<NovoEbook> = {
    ...camposDeVenda(m.book),
    titulo: m.book.title,
    slug: m.book.slug ?? slugify(m.book.title),
    idioma: m.language,
  };
  if (m.cover.alt !== undefined) f.capaAlt = m.cover.alt;
  if (m.edition !== undefined) f.edicao = String(m.edition);
  if (m.cover.sha256) f.capaHash = m.cover.sha256;
  return f;
}

/** Avisos (não bloqueiam) para quem publica: o que o manifesto traz mas o site ignora, ou falta para vender bem. */
export function avisos(m: Manifesto): string[] {
  const a: string[] = [];
  const b = m.book;
  if (!b.headline) a.push(b.promise ? "Sem headline: a página usará o título. Escreva uma headline de resultado (docs/04, padrão de venda)." : "Sem headline: a página usará o título.");
  if (!b.faq?.length) a.push("Sem FAQ: ele responde objeções e vira rich result no Google.");
  if (!b.toc?.length) a.push("Sem sumário.");
  if (!m.samples?.length) a.push("Sem páginas de amostra: é a prova mais direta de um e-book.");
  // Padrão de venda (docs/04, seção 6)
  if (!b.pains?.length) a.push("Sem dores: a página não mostra a necessidade. Escreva 3 situações que o leitor reconhece.");
  if (!b.differentiators?.length) a.push("Sem diferenciais: a página não diz por que este caminho e não outro.");
  if (!b.notFor?.length) a.push("Sem “para quem não é”: inclua o esforço exigido. Reduz reembolso.");
  if (b.offerEndsAt && !b.priceFrom) a.push("Prazo sem preço depois do prazo: nada muda quando ele acabar. Preencha priceFrom ou retire o prazo.");
  if (b.price === undefined && !b.comingSoon) a.push("Sem preço: a página ficará como “Em breve”.");
  for (const k of ["materialState", "presentationVariant"]) if (k in b) a.push(`Campo “${k}” ignorado pelo site.`);
  return a;
}
