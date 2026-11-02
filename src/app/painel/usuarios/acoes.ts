"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { exigirOwner } from "@/lib/acesso";
import { hashSenha, senhaTemporaria } from "@/lib/senha";

const { user, account, session, ebook } = schema;

export type Resultado = { erro?: string; senha?: string; nome?: string };

const novoUsuario = z.object({
  nome: z.string().trim().min(2, "Escreva o nome da pessoa.").max(80),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Esse e-mail não parece certo.")),
});

export async function criarUsuario(_anterior: Resultado | null, form: FormData): Promise<Resultado> {
  await exigirOwner();
  const dados = novoUsuario.safeParse({ nome: form.get("nome"), email: form.get("email") });
  if (!dados.success) return { erro: dados.error.issues[0].message };
  const { nome, email } = dados.data;
  if (db.select({ id: user.id }).from(user).where(eq(user.email, email)).get()) return { erro: "Já existe uma conta com esse e-mail." };

  const senha = senhaTemporaria();
  const hash = await hashSenha(senha);
  const id = crypto.randomUUID();
  db.transaction((tx) => {
    tx.insert(user).values({ id, name: nome, email, role: "parceiro", ativo: true }).run();
    tx.insert(account).values({ userId: id, accountId: id, providerId: "credential", password: hash }).run();
  });
  revalidatePath("/painel/usuarios");
  return { nome, senha };
}

/** Só usuários comuns: o administrador não é desativado nem tem a senha trocada por aqui. */
function alvo(id: string) {
  return db.select().from(user).where(and(eq(user.id, id), eq(user.role, "parceiro"))).get();
}

export async function redefinirSenha(id: string): Promise<Resultado> {
  await exigirOwner();
  const u = alvo(id);
  if (!u) return { erro: "Usuário não encontrado." };
  const senha = senhaTemporaria();
  const hash = await hashSenha(senha);
  db.transaction((tx) => {
    tx.update(account).set({ password: hash, updatedAt: new Date() }).where(and(eq(account.userId, id), eq(account.providerId, "credential"))).run();
    tx.delete(session).where(eq(session.userId, id)).run(); // quem estava logado precisa entrar com a senha nova
  });
  return { nome: u.name, senha };
}

export async function alterarAtivo(id: string, ativo: boolean, tirarDoAr = false): Promise<Resultado> {
  await exigirOwner();
  const u = alvo(id);
  if (!u) return { erro: "Usuário não encontrado." };
  db.transaction((tx) => {
    tx.update(user).set({ ativo, updatedAt: new Date() }).where(eq(user.id, id)).run();
    if (!ativo) {
      tx.delete(session).where(eq(session.userId, id)).run(); // perde o acesso na hora
      if (tirarDoAr) tx.update(ebook).set({ status: "rascunho", atualizadoEm: new Date() }).where(and(eq(ebook.ownerId, id), eq(ebook.status, "publicado"))).run();
    }
  });
  if (!ativo && tirarDoAr) updateTag("ebooks"); // a landing, a Home e o sitemap deixam de mostrar esses livros
  revalidatePath("/painel/usuarios");
  return { nome: u.name };
}
