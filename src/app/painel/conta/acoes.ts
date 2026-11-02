"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { exigirUsuario } from "@/lib/acesso";

export type ResultadoConta = { erro?: string; ok?: boolean };

const nome = z.string().trim().min(2, "Escreva seu nome.").max(80);

export async function salvarNome(_anterior: ResultadoConta | null, form: FormData): Promise<ResultadoConta> {
  const u = await exigirUsuario();
  const dados = nome.safeParse(form.get("nome"));
  if (!dados.success) return { erro: dados.error.issues[0].message };
  db.update(schema.user).set({ name: dados.data, updatedAt: new Date() }).where(eq(schema.user.id, u.id)).run();
  revalidatePath("/painel", "layout");
  return { ok: true };
}
