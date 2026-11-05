import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { NovoEbook } from "@/db/schema";
import { checklistDePublicacao, lojasSemLinkDaCampanha, problemaNoSlug } from "./editor";
import { conferirPdf, prepararImagem } from "./imagens";
import { avisos as avisosDoManifesto, camposDoEbook, type AjusteDeVenda, type Manifesto } from "./manifesto";
import { guardarBytes, sha256 } from "./midia";
import { reconciliarVendas } from "./registrar-venda";
import { avisosDeSeo } from "./seo";

// Publicar pelo manifesto (POST /api/v1/ebooks, docs/03-tecnico.md). Uma função só para o terminal e para o painel.
// Regras: o manifesto vence nos campos que traz; o que ele não traz fica como está; ofertas são atualizadas por loja,
// nunca recriadas (o /ir e os contadores continuam valendo); e-book JÁ PUBLICADO não tem preço, campanha nem "em breve" mexidos
// por aqui (isso é do deploy/venda.sh): o manifesto do 001 traz R$ 64,99 e desfaria uma promoção em curso.

const { ebook, oferta, amostra, tema, user } = schema;

const LIMITE_AMOSTRA_PDF = 15 * 1024 * 1024;
const MAX_AMOSTRAS = 8;

export type Arquivos = { capa?: Buffer; amostras?: Buffer[]; amostraPdf?: Buffer };
export type Opcoes = {
  ownerId?: string | null;
  dryRun?: boolean;
  /** Publica se o checklist do editor estiver completo; senão não grava nada e devolve o que falta. */
  publicar?: boolean;
  /** Vincula ao manifesto um e-book que já existe com o mesmo endereço mas foi criado no painel (sem sourceId). */
  adotar?: boolean;
  /** Troca as amostras mesmo que a quantidade e as legendas sejam as mesmas. */
  reenviarAmostras?: boolean;
};

export type Estado = "igual" | "enviar" | "recebida";
export type Resposta =
  | { ok: false; status: 409 | 422; erro: string; detalhes?: string[] }
  | {
      ok: true;
      acao: "criar" | "atualizar";
      id: string | null;
      slug: string;
      status: "rascunho" | "publicado" | "revisao";
      mudancas: string[];
      avisos: string[];
      /** "enviar" = o cliente precisa mandar o arquivo; "recebida" = veio agora; "igual" = nada a fazer. */
      capa: Estado;
      amostras: Estado;
      amostraPdf: Estado;
      gravado: boolean;
    };

const ROTULOS: Record<string, string> = {
  titulo: "Título", slug: "Endereço", subtitulo: "Subtítulo", headline: "Headline", autorExibido: "Autor exibido", sobreAutor: "Sobre o autor",
  resumo: "Resumo", descricao: "Descrição", problema: "Problema do leitor", dores: "Situações do leitor", beneficios: "Benefícios",
  diferenciais: "Por que este caminho", paraQuem: "É para quem", naoEPara: "Não é para quem", incluido: "O que está incluído", formatos: "Formatos",
  sumario: "Capítulos", faq: "Perguntas frequentes", observacoes: "Antes de comprar", accent: "Cor de destaque", preco: "Preço", precoDe: "Preço normal",
  ofertaAte: "Prazo da campanha", ofertaNome: "Nome da campanha", parcelamento: "Parcelamento", garantiaDias: "Garantia (dias)", emBreve: "Em breve",
  seoTitle: "Título no Google", seoDescription: "Descrição no Google", idioma: "Idioma", edicao: "Edição", capaAlt: "Descrição da capa",
};
/** Campos de preço e de venda no ar: não mudam por manifesto em e-book publicado. */
const PROTEGIDOS_NO_AR = ["preco", "precoDe", "ofertaAte", "ofertaNome", "emBreve"] as const;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type OfertaEntrada = NonNullable<AjusteDeVenda["offers"]>[number];

const centavos = (v: number) => Math.round(v * 100);

/** Atualiza as lojas por plataforma (a mesma regra do PATCH de produção): nunca recria, para o /ir e as métricas continuarem valendo. */
export function aplicarOfertas(tx: Tx, ebookId: string, offers: OfertaEntrada[], novoEbook = false) {
  const existentes = tx.select().from(oferta).where(eq(oferta.ebookId, ebookId)).all();
  offers.forEach((o, i) => {
    const existente = existentes.find((x) => x.plataforma === o.platform);
    const principal = o.primary ?? (novoEbook && i === 0 && !offers.some((x) => x.primary) ? true : undefined);
    const dados = {
      ...(o.url !== undefined ? { url: o.url } : {}),
      ...(o.promoUrl !== undefined ? { urlPromo: o.promoUrl } : {}),
      ...(o.price !== undefined ? { preco: o.price === null ? null : centavos(o.price) } : {}),
      ...(principal !== undefined ? { principal } : {}),
      ...(o.label !== undefined ? { rotulo: o.label } : {}),
      ...(o.productId !== undefined ? { produtoExterno: o.productId } : {}),
    };
    if (principal) tx.update(oferta).set({ principal: false }).where(eq(oferta.ebookId, ebookId)).run();
    if (existente) {
      if (Object.keys(dados).length) tx.update(oferta).set(dados).where(eq(oferta.id, existente.id)).run();
    } else if (o.url) {
      tx.insert(oferta).values({ ebookId, plataforma: o.platform, ordem: existentes.length + i, ...dados, url: o.url }).run();
    } else {
      throw new Error(`Não existe oferta em ${o.platform}: informe a url para criá-la.`);
    }
  });
}

const normalizar = (v: unknown): string => (v instanceof Date ? v.toISOString() : v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
const curto = (v: unknown) => {
  if (v == null || v === "") return "vazio";
  if (Array.isArray(v)) return `${v.length} item(ns)`;
  if (v instanceof Date) return v.toISOString();
  const t = String(v).replace(/\s+/g, " ");
  return t.length > 50 ? `“${t.slice(0, 47)}…”` : `“${t}”`;
};

function nomeDoTema(slug: string) {
  return slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export async function publicarManifesto(m: Manifesto, arquivos: Arquivos, op: Opcoes = {}): Promise<Resposta> {
  if (m.pending.length) {
    return { ok: false, status: 422, erro: "O manifesto tem pendências e não foi enviado. Resolva no ../ebooks e gere de novo.", detalhes: m.pending.map((p) => String(typeof p === "string" ? p : JSON.stringify(p))) };
  }

  // ---- 1. Quem é este e-book (sourceId + idioma) e o endereço
  const campos: Record<string, unknown> = { ...camposDoEbook(m) };
  let existente = db.select().from(ebook).where(and(eq(ebook.sourceId, m.sourceId), eq(ebook.idioma, m.language))).get();
  const avisos = avisosDoManifesto(m);
  if (m.book.seoTitle || m.book.seoDescription) avisos.push(...avisosDeSeo(m.book.seoTitle ?? "", m.book.seoDescription ?? "").map((a) => `Google: ${a}`));
  const slugPedido = String(campos.slug);
  const dono = db.select().from(ebook).where(eq(ebook.slug, slugPedido)).get();

  if (!existente && dono) {
    if (dono.sourceId == null && op.adotar) existente = dono;
    else if (dono.sourceId == null) return { ok: false, status: 409, erro: `O endereço /${slugPedido} já existe e foi criado no painel, sem vínculo com este livro. Se é o mesmo livro, repita com --adotar.` };
    else return { ok: false, status: 409, erro: `O endereço /${slugPedido} já é de outro livro (${dono.sourceId}). Mude o slug no manifesto.` };
  }
  if (existente && dono && dono.id !== existente.id) return { ok: false, status: 409, erro: `O endereço /${slugPedido} já é de outro e-book.` };

  const noAr = existente?.status === "publicado";
  if (existente?.publicadoEm && slugPedido !== existente.slug) {
    avisos.push(`O endereço de um e-book já publicado não muda: continua /${existente.slug}.`);
    campos.slug = existente.slug;
  }
  const slug = String(campos.slug);
  const problemaSlug = problemaNoSlug(slug);
  if (problemaSlug) return { ok: false, status: 422, erro: problemaSlug };

  // ---- 2. Preço, campanha e "em breve" de e-book no ar não mudam por aqui
  if (noAr) {
    const trazidos = PROTEGIDOS_NO_AR.filter((k) => k in campos && normalizar(campos[k]) !== normalizar(existente![k]));
    for (const k of PROTEGIDOS_NO_AR) delete campos[k];
    if (trazidos.length) avisos.push(`Preço, campanha e “em breve” de um e-book no ar não mudam por manifesto (${trazidos.map((k) => ROTULOS[k]).join(", ")} ficaram como estão). Use deploy/venda.sh.`);
  }

  // ---- 3. Tema
  const slugTema = m.book.theme;
  const temaExistente = slugTema ? db.select().from(tema).where(eq(tema.slug, slugTema)).get() : undefined;
  const temaNovo = !!slugTema && !temaExistente;
  if (temaExistente && temaExistente.id !== existente?.temaId) campos.temaId = temaExistente.id;

  // ---- 4. Arquivos: o que falta enviar
  const hash = m.cover.sha256;
  const capaIgual = !!existente?.capa && !!hash && existente.capaHash === hash;
  const capa: Estado = arquivos.capa ? "recebida" : capaIgual ? "igual" : "enviar";
  delete campos.capaHash; // só muda junto com a capa

  const amostrasDoManifesto = m.samples ?? [];
  const jaTem = existente ? db.select().from(amostra).where(eq(amostra.ebookId, existente.id)).orderBy(amostra.ordem).all() : [];
  const mesmasAmostras = jaTem.length === amostrasDoManifesto.length && jaTem.every((a, i) => (a.alt ?? "") === (amostrasDoManifesto[i].alt ?? ""));
  const amostras: Estado = !amostrasDoManifesto.length ? "igual" : arquivos.amostras?.length ? "recebida" : mesmasAmostras && !op.reenviarAmostras ? "igual" : "enviar";
  const amostraPdf: Estado = !m.samplePdf ? "igual" : arquivos.amostraPdf ? "recebida" : existente?.amostraPdf && !op.reenviarAmostras ? "igual" : "enviar";
  if (amostrasDoManifesto.length > MAX_AMOSTRAS) return { ok: false, status: 422, erro: `No máximo ${MAX_AMOSTRAS} páginas de amostra.` };

  // ---- 5. O que muda (para o dry-run e para a confirmação)
  const mudancas: string[] = [];
  if (!existente) {
    mudancas.push(`Novo e-book em rascunho: “${m.book.title}” (/${slug}).`);
  } else {
    if (existente.id === dono?.id && !existente.sourceId) mudancas.push(`Vincula o e-book já existente (/${slug}) ao livro ${m.sourceId}.`);
    if (campos.temaId) mudancas.push(`Tema: ${temaExistente!.nome}`);
    for (const k of Object.keys(campos)) {
      if (k === "temaId" || (k === "slug" && campos.slug === existente.slug)) continue;
      if (normalizar(campos[k]) !== normalizar((existente as Record<string, unknown>)[k])) mudancas.push(`${ROTULOS[k] ?? k}: ${curto((existente as Record<string, unknown>)[k])} → ${curto(campos[k])}`);
    }
  }
  if (temaNovo) mudancas.push(`Tema novo (fora do ar até você publicar no painel): ${m.book.themeName ?? nomeDoTema(slugTema!)}.`);
  if (capa !== "igual") mudancas.push(existente?.capa ? "Capa: será trocada." : "Capa: será enviada.");
  if (amostras !== "igual") mudancas.push(`Amostras: ${amostrasDoManifesto.length} página(s) ${jaTem.length ? "substituem as atuais" : "serão enviadas"}.`);
  if (amostraPdf !== "igual") mudancas.push("Amostra em PDF: será enviada.");
  const lojasAtuais = existente ? db.select().from(oferta).where(eq(oferta.ebookId, existente.id)).all() : [];
  for (const o of m.offers) {
    const atual = lojasAtuais.find((x) => x.plataforma === o.platform);
    if (!atual) mudancas.push(`Loja ${o.platform}: nova.`);
    else {
      if (atual.url !== o.url) mudancas.push(`Loja ${o.platform}: link de compra mudou.`);
      if (o.promoUrl !== undefined && (atual.urlPromo ?? "") !== o.promoUrl) mudancas.push(`Loja ${o.platform}: link da campanha mudou.`);
      if (o.label !== undefined && (atual.rotulo ?? "") !== o.label) mudancas.push(`Loja ${o.platform}: texto do botão mudou.`);
    }
  }

  const status0 = (existente?.status ?? "rascunho") as "rascunho" | "publicado" | "revisao";
  const resposta = (status: typeof status0, gravado: boolean, id: string | null): Resposta => ({
    ok: true, acao: existente ? "atualizar" : "criar", id, slug, status, mudancas, avisos, capa, amostras, amostraPdf, gravado,
  });
  if (op.dryRun) return resposta(status0, false, existente?.id ?? null);

  // ---- 6. Imagens e PDF conferidos antes de gravar qualquer coisa
  let capaPronta: Awaited<ReturnType<typeof prepararImagem>> | null = null;
  if (arquivos.capa) {
    capaPronta = await prepararImagem(arquivos.capa, { larguraMinima: 1200 });
    if (!capaPronta.ok) return { ok: false, status: 422, erro: `Capa: ${capaPronta.erro}` };
  }
  const amostrasProntas: Extract<Awaited<ReturnType<typeof prepararImagem>>, { ok: true }>[] = [];
  for (const [i, bytes] of (arquivos.amostras ?? []).entries()) {
    const p = await prepararImagem(bytes, { larguraMinima: 600 });
    if (!p.ok) return { ok: false, status: 422, erro: `Amostra ${i + 1}: ${p.erro}` };
    amostrasProntas.push(p);
  }
  if (arquivos.amostras?.length && arquivos.amostras.length !== amostrasDoManifesto.length) return { ok: false, status: 422, erro: `O manifesto lista ${amostrasDoManifesto.length} amostra(s) e vieram ${arquivos.amostras.length}.` };
  if (arquivos.amostraPdf) {
    const erroPdf = conferirPdf(arquivos.amostraPdf, LIMITE_AMOSTRA_PDF);
    if (erroPdf) return { ok: false, status: 422, erro: `Amostra em PDF: ${erroPdf}` };
  }

  // ---- 7. Gravar (tudo ou nada)
  const agora = new Date();
  const id = existente?.id ?? crypto.randomUUID();
  let statusFinal = status0;
  try {
    db.transaction((tx) => {
      let temaId = (campos.temaId as string | undefined) ?? existente?.temaId ?? null;
      let temaLinha = temaId ? tx.select().from(tema).where(eq(tema.id, temaId)).get() : undefined;
      if (temaNovo) {
        temaId = crypto.randomUUID();
        tx.insert(tema).values({ id: temaId, nome: m.book.themeName ?? nomeDoTema(slugTema!), slug: slugTema!, descricao: m.book.themeDescription ?? null, publicado: false }).run();
        temaLinha = tx.select().from(tema).where(eq(tema.id, temaId)).get();
      } else if (temaLinha && !temaLinha.descricao && m.book.themeDescription) {
        tx.update(tema).set({ descricao: m.book.themeDescription }).where(eq(tema.id, temaLinha.id)).run();
      }

      const midia: Partial<NovoEbook> = {};
      if (capaPronta?.ok) {
        midia.capa = guardarBytes(id, capaPronta.bytes, capaPronta.ext);
        midia.capaHash = hash ?? sha256(arquivos.capa!);
      }
      if (arquivos.amostraPdf) midia.amostraPdf = guardarBytes(id, arquivos.amostraPdf, ".pdf");

      const dados = { ...campos, ...midia, temaId, atualizadoEm: agora } as Partial<NovoEbook>;
      if (existente) tx.update(ebook).set(dados).where(eq(ebook.id, id)).run();
      else tx.insert(ebook).values({ ...dados, id, titulo: m.book.title, slug, sourceId: m.sourceId, formatos: ["PDF"], ownerId: op.ownerId ?? null, status: "rascunho" }).run();
      if (existente && !existente.sourceId) tx.update(ebook).set({ sourceId: m.sourceId }).where(eq(ebook.id, id)).run();

      if (amostrasProntas.length) {
        tx.delete(amostra).where(eq(amostra.ebookId, id)).run();
        amostrasProntas.forEach((p, ordem) => tx.insert(amostra).values({ ebookId: id, imagem: guardarBytes(id, p.bytes, p.ext), alt: amostrasDoManifesto[ordem].alt ?? null, ordem }).run());
      }

      if (m.offers.length) aplicarOfertas(tx, id, m.offers, !existente);

      // Nunca deixar a página anunciar um preço que o checkout não cobra, nem um e-book no ar ficar incompleto.
      const depois = tx.select().from(ebook).where(eq(ebook.id, id)).get()!;
      const lojas = tx.select().from(oferta).where(eq(oferta.ebookId, id)).all();
      const semLink = lojasSemLinkDaCampanha(lojas, depois, agora);
      if (semLink.length) throw new Error(`Campanha sem link promocional em: ${semLink.map((l) => l.plataforma).join(", ")}. A página mostraria um preço e o checkout cobraria outro.`);
      const checklist = checklistDePublicacao({ ...depois, temaNoAr: temaLinha ? temaLinha.publicado : null, temaNome: temaLinha?.nome });
      if (depois.status === "publicado" && checklist.faltam.length) throw new Error(`Não gravei: o e-book está no ar e ficaria incompleto. Falta: ${checklist.faltam.join(", ")}.`);
      if (op.publicar) {
        if (checklist.faltam.length) throw new Error(`Não dá para publicar ainda. Falta: ${checklist.faltam.join(", ")}.`);
        tx.update(ebook).set({ status: "publicado", publicadoEm: depois.publicadoEm ?? agora }).where(eq(ebook.id, id)).run();
        statusFinal = "publicado";
      }
    });
  } catch (e) {
    return { ok: false, status: 422, erro: e instanceof Error ? e.message : "Não foi possível gravar." };
  }
  reconciliarVendas();
  return resposta(statusFinal, true, id);
}

/** Primeiro administrador: dono dos e-books criados pela API (o token da API é do servidor, não de uma pessoa). */
export function primeiroOwner() {
  return db.select({ id: user.id }).from(user).where(eq(user.role, "owner")).limit(1).get()?.id ?? null;
}
