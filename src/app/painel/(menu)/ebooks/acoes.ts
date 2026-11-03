"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { exigirUsuario } from "@/lib/acesso";
import { lerFormulario } from "@/lib/editor";
import { criarRascunho, despublicar, gravarEbook } from "@/lib/ebooks";
import { podeEditar } from "@/lib/permissoes";

export type Retorno = { ok: boolean; mensagem?: string; erros?: string[]; url?: string; aviso?: string[] };

const titulo = z.string().trim().min(2, "Escreva o título do livro.").max(140, "O título pode ter no máximo 140 caracteres.");

export async function criarEbook(_anterior: Retorno | null, form: FormData): Promise<Retorno> {
  const u = await exigirUsuario();
  const t = titulo.safeParse(form.get("titulo"));
  if (!t.success) return { ok: false, erros: [t.error.issues[0].message] };
  const { id } = criarRascunho(u.id, t.data);
  redirect(`/painel/ebooks/${id}`);
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
