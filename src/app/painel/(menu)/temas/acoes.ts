"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { exigirOwner } from "@/lib/acesso";
import { slugDoTitulo } from "@/lib/editor";

const { tema } = schema;
export type RetornoTema = { ok: boolean; erro?: string };

const dados = z.object({
  nome: z.string().trim().min(2, "Escreva o nome do tema.").max(60, "O nome pode ter no máximo 60 caracteres."),
  descricao: z.string().trim().max(400, "A descrição pode ter no máximo 400 caracteres."),
});

export async function criarTema(_anterior: RetornoTema | null, form: FormData): Promise<RetornoTema> {
  await exigirOwner();
  const d = dados.safeParse({ nome: form.get("nome"), descricao: form.get("descricao") ?? "" });
  if (!d.success) return { ok: false, erro: d.error.issues[0].message };
  const slug = slugDoTitulo(d.data.nome, (s) => !!db.select({ id: tema.id }).from(tema).where(eq(tema.slug, s)).get());
  db.insert(tema).values({ nome: d.data.nome, slug, descricao: d.data.descricao || null, publicado: false }).run();
  revalidatePath("/painel/temas");
  return { ok: true };
}

export async function salvarTema(id: string, _anterior: RetornoTema | null, form: FormData): Promise<RetornoTema> {
  await exigirOwner();
  const d = dados.safeParse({ nome: form.get("nome"), descricao: form.get("descricao") ?? "" });
  if (!d.success) return { ok: false, erro: d.error.issues[0].message };
  db.update(tema).set({ nome: d.data.nome, descricao: d.data.descricao || null }).where(eq(tema.id, id)).run();
  updateTag("ebooks");
  revalidatePath("/painel/temas");
  return { ok: true };
}

/** Tema fora do ar esconde os e-books dele da vitrine (as páginas dão "não encontrada"). */
export async function alterarTema(id: string, publicado: boolean): Promise<RetornoTema> {
  await exigirOwner();
  db.update(tema).set({ publicado }).where(eq(tema.id, id)).run();
  updateTag("ebooks");
  revalidatePath("/painel/temas");
  return { ok: true };
}
