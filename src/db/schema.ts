import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Convenções: ids = UUID em texto; datas = timestamp (ms) em UTC; dinheiro = centavos (inteiro);
// listas = JSON validado por Zod nas bordas (formulário, API, manifesto).
// `ebook.ownerId` aponta para `user.id` sem FK: o SQLite não adiciona FK a uma tabela existente sem recriá-la, e a regra de
// acesso é conferida no servidor (src/lib/acesso.ts).

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const agora = () => integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());
const lista = (nome: string) => text(nome, { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`);

export const PAPEIS = ["owner", "parceiro"] as const;
export type Papel = (typeof PAPEIS)[number];

// Tabelas do Better Auth (user, session, account, verification): os nomes das colunas seguem o que o adaptador espera.
// `role` e `ativo` são campos nossos. Sem cadastro público: só o owner cria usuários.
export const user = sqliteTable("user", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  role: text("role", { enum: PAPEIS }).notNull().default("parceiro"),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  createdAt: agora(),
  updatedAt: agora(),
});

export const session = sqliteTable(
  "session",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: agora(),
    updatedAt: agora(),
  },
  (t) => [index("session_user").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: agora(),
    updatedAt: agora(),
  },
  (t) => [index("account_user").on(t.userId)],
);

export const verification = sqliteTable("verification", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: agora(),
  updatedAt: agora(),
});

export const tema = sqliteTable("tema", {
  id: id(),
  nome: text("nome").notNull(),
  slug: text("slug").notNull().unique(),
  descricao: text("descricao"),
  cor: text("cor"),
  ordem: integer("ordem").notNull().default(0),
  publicado: integer("publicado", { mode: "boolean" }).notNull().default(false),
});

export const ebook = sqliteTable(
  "ebook",
  {
    id: id(),
    ownerId: text("owner_id"),
    temaId: text("tema_id").references(() => tema.id, { onDelete: "set null" }),
    sourceId: text("source_id"),
    idioma: text("idioma").notNull().default("pt-BR"),
    edicao: text("edicao"),
    slug: text("slug").notNull().unique(),
    status: text("status", { enum: ["rascunho", "revisao", "publicado"] }).notNull().default("rascunho"),
    destaque: integer("destaque", { mode: "boolean" }).notNull().default(false),
    publicadoEm: integer("publicado_em", { mode: "timestamp_ms" }),
    criadoEm: agora(),
    atualizadoEm: agora(),

    // Essencial
    titulo: text("titulo").notNull(),
    subtitulo: text("subtitulo"),
    autorExibido: text("autor_exibido"),
    formatos: lista("formatos"),
    capa: text("capa"),
    capaHash: text("capa_hash"),
    capaAlt: text("capa_alt"),
    accent: text("accent"),

    // Página de vendas
    headline: text("headline"),
    resumo: text("resumo"),
    problema: text("problema"),
    descricao: text("descricao"),
    dores: lista("dores"),
    beneficios: lista("beneficios"),
    diferenciais: lista("diferenciais"),
    paraQuem: lista("para_quem"),
    naoEPara: lista("nao_e_para"),
    incluido: lista("incluido"),
    observacoes: text("observacoes"),
    sobreAutor: text("sobre_autor"),
    autorFoto: text("autor_foto"),
    figura: text("figura"),
    figuraAlt: text("figura_alt"),
    figuraLegenda: text("figura_legenda"),

    // Conteúdo
    sumario: lista("sumario"),
    faq: text("faq", { mode: "json" }).$type<{ p: string; r: string }[]>().notNull().default(sql`'[]'`),
    amostraPdf: text("amostra_pdf"),

    // Preço (centavos). `preco` é o preço de lançamento; `precoDe` é o preço normal.
    preco: integer("preco"),
    precoDe: integer("preco_de"),
    ofertaAte: integer("oferta_ate", { mode: "timestamp_ms" }),
    ofertaNome: text("oferta_nome"), // "Black Friday", "Preço de lançamento"; aparece na faixa de urgência
    parcelamento: text("parcelamento"), // ex.: "ou em até 12x no cartão"; só o que o checkout realmente oferece
    garantiaDias: integer("garantia_dias").notNull().default(7),
    emBreve: integer("em_breve", { mode: "boolean" }).notNull().default(false),

    // SEO e medição
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    metaPixelId: text("meta_pixel_id"),
  },
  (t) => [
    uniqueIndex("ebook_source_idioma").on(t.sourceId, t.idioma),
    index("ebook_status").on(t.status),
    index("ebook_tema").on(t.temaId),
  ],
);

export const amostra = sqliteTable(
  "amostra",
  {
    id: id(),
    ebookId: text("ebook_id").notNull().references(() => ebook.id, { onDelete: "cascade" }),
    imagem: text("imagem").notNull(),
    alt: text("alt"),
    ordem: integer("ordem").notNull().default(0),
  },
  (t) => [index("amostra_ebook").on(t.ebookId)],
);

export const PLATAFORMAS = ["hotmart", "kiwify", "cakto", "eduzz", "monetizze", "ticto", "perfectpay", "amazon", "google_play", "outra"] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];

export const oferta = sqliteTable(
  "oferta",
  {
    id: id(),
    ebookId: text("ebook_id").notNull().references(() => ebook.id, { onDelete: "cascade" }),
    plataforma: text("plataforma", { enum: PLATAFORMAS }).notNull(),
    rotulo: text("rotulo"),
    url: text("url").notNull(),
    urlPromo: text("url_promo"), // checkout com o preço da campanha; o /ir só usa enquanto `ofertaAte` não vence
    preco: integer("preco"),
    principal: integer("principal", { mode: "boolean" }).notNull().default(false),
    ativa: integer("ativa", { mode: "boolean" }).notNull().default(true),
    ordem: integer("ordem").notNull().default(0),
  },
  (t) => [index("oferta_ebook").on(t.ebookId)],
);

// Sem IP, sem cookie, sem dado pessoal. `ofertaId` vazio = visita; preenchido = clique.
export const metricaDiaria = sqliteTable(
  "metrica_diaria",
  {
    ebookId: text("ebook_id").notNull().references(() => ebook.id, { onDelete: "cascade" }),
    data: text("data").notNull(), // AAAA-MM-DD (America/Sao_Paulo)
    ofertaId: text("oferta_id").notNull().default(""),
    origem: text("origem").notNull().default("direto"),
    contagem: integer("contagem").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.ebookId, t.data, t.ofertaId, t.origem] })],
);

// Quem pediu a amostra e aceitou receber avisos. Só e-mail e origem; sem IP.
export const lead = sqliteTable(
  "lead",
  {
    id: id(),
    ebookId: text("ebook_id").notNull().references(() => ebook.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    origem: text("origem").notNull().default("direto"),
    criadoEm: agora(),
  },
  (t) => [uniqueIndex("lead_ebook_email").on(t.ebookId, t.email)],
);

export type Usuario = typeof user.$inferSelect;
export type Ebook = typeof ebook.$inferSelect;
export type NovoEbook = typeof ebook.$inferInsert;
export type Tema = typeof tema.$inferSelect;
export type Oferta = typeof oferta.$inferSelect;
export type Amostra = typeof amostra.$inferSelect;
