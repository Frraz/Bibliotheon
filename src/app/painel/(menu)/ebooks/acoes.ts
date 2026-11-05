"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { exigirUsuario } from "@/lib/acesso";
import { lerFormulario } from "@/lib/editor";
import { criarRascunho, despublicar, gravarEbook } from "@/lib/ebooks";
import { manifesto } from "@/lib/manifesto";
import { ehOwner, podeEditar } from "@/lib/permissoes";
import { publicarManifesto } from "@/lib/publicar-manifesto";

export type Retorno = { ok: boolean; mensagem?: string; erros?: string[]; url?: string; aviso?: string[] };

const titulo = z.string().trim().min(2, "Escreva o título do livro.").max(140, "O título pode ter no máximo 140 caracteres.");

export async function criarEbook(_anterior: Retorno | null, form: FormData): Promise<Retorno> {
  const u = await exigirUsuario();
  const t = titulo.safeParse(form.get("titulo"));
  if (!t.success) return { ok: false, erros: [t.error.issues[0].message] };
  const { id } = criarRascunho(u.id, t.data);
  redirect(`/painel/ebooks/${id}`);
}

/**
 * "Novo e-book" a partir do manifesto.json do ../ebooks: cria um RASCUNHO preenchido e abre o editor. Só cria: se o livro já
 * existe (mesmo sourceId), a pessoa abre o que já tem em vez de sobrescrever o que editou. A capa e as amostras se enviam no editor.
 */
export async function importarManifesto(_anterior: Retorno | null, form: FormData): Promise<Retorno> {
  const u = await exigirUsuario();
  const arquivo = form.get("arquivo");
  const colado = form.get("manifest");
  const texto = arquivo instanceof File && arquivo.size > 0 ? await arquivo.text() : typeof colado === "string" ? colado : "";
  if (!texto.trim()) return { ok: false, erros: ["Cole o conteúdo do manifest.json ou escolha o arquivo."] };

  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return { ok: false, erros: ["Isso não é um manifest.json válido. Copie o arquivo inteiro, de { até }."] };
  }
  const lido = manifesto.safeParse(json);
  if (!lido.success) return { ok: false, erros: [`O manifesto não está no formato esperado: ${lido.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "raiz"} (${i.message})`).join("; ")}.`] };
  const m = lido.data;

  const { ebook, tema } = schema;
  if (db.select({ id: ebook.id }).from(ebook).where(and(eq(ebook.sourceId, m.sourceId), eq(ebook.idioma, m.language))).get()) {
    return { ok: false, erros: ["Este livro já está cadastrado. Abra-o na lista de e-books para editar."] };
  }
  // Tema novo só o administrador cria (o site não deixa um usuário comum criar categoria).
  if (m.book.theme && !ehOwner(u) && !db.select({ id: tema.id }).from(tema).where(eq(tema.slug, m.book.theme)).get()) {
    return { ok: false, erros: [`O tema “${m.book.theme}” ainda não existe. Peça ao administrador para criá-lo em Temas e tente de novo.`] };
  }

  const r = await publicarManifesto(m, {}, { ownerId: u.id });
  if (!r.ok) return { ok: false, erros: [r.erro, ...(r.detalhes ?? [])] };
  updateTag("ebooks");
  revalidatePath("/painel");
  redirect(`/painel/ebooks/${r.id}`);
}

/** A cada ação, o servidor confere de novo quem é a pessoa e se o e-book é dela: a tela não é uma barreira. */
async function ebookDaPessoa(id: string) {
  const u = await exigirUsuario();
  const e = db.select().from(schema.ebook).where(eq(schema.ebook.id, id)).get();
  return e && podeEditar(u, e) ? e : null;
}

export async function salvarEbook(id: string, _anterior: Retorno | null, form: FormData): Promise<Retorno> {
  if (!(await ebookDaPessoa(id))) return { ok: false, erros: ["E-book não encontrado."] };
  const lido = lerFormulario(form);
  if ("erros" in lido) return { ok: false, erros: lido.erros };

  const acao = form.get("acao") === "publicar" ? "publicar" : "salvar";
  const r = gravarEbook(id, lido.dados, acao);
  if (!r.ok) return { ok: false, erros: [r.erro] };

  updateTag("ebooks"); // a página, a Home e o sitemap passam a mostrar o que foi gravado
  revalidatePath(`/painel/ebooks/${id}`);
  if (r.publicou) return { ok: true, mensagem: "Publicado! Sua página já está no ar.", url: `/${r.slug}` };
  if (acao === "publicar" && r.faltam.length) return { ok: true, mensagem: "Salvei como rascunho, mas ainda não dá para publicar.", aviso: [`Falta: ${r.faltam.join(", ")}.`] };
  return { ok: true, mensagem: r.status === "publicado" ? "Alterações salvas. A página já mostra a versão nova." : "Rascunho salvo.", url: r.status === "publicado" ? `/${r.slug}` : undefined };
}

export async function despublicarEbook(id: string): Promise<Retorno> {
  if (!(await ebookDaPessoa(id))) return { ok: false, erros: ["E-book não encontrado."] };
  despublicar(id);
  updateTag("ebooks");
  revalidatePath(`/painel/ebooks/${id}`);
  return { ok: true, mensagem: "A página saiu do ar. O e-book voltou a ser rascunho." };
}
