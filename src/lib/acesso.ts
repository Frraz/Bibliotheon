import "server-only";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { cache } from "react";
import { PAPEIS, type Papel } from "@/db/schema";
import { auth } from "./auth";
import { ehOwner, type Quem } from "./permissoes";

// Camada de acesso do painel (Data Access Layer): a sessão e o papel são lidos do banco a cada pedido, sem cache,
// para que desativar um usuário valha na hora. O proxy.ts só faz um redirecionamento otimista pelo cookie.

export type UsuarioLogado = Quem & { nome: string; email: string };

export const usuarioAtual = cache(async (): Promise<UsuarioLogado | null> => {
  // headers() primeiro: no build ele adia a página para o pedido, e o auth() (que exige o segredo) nem chega a ser criado.
  const cabecalhos = await headers();
  const sessao = await auth().api.getSession({ headers: cabecalhos });
  if (!sessao) return null;
  const { user } = sessao;
  const papel = (user as { role?: string }).role;
  const ativo = (user as { ativo?: boolean }).ativo;
  if (!ativo || !PAPEIS.includes(papel as Papel)) return null;
  return { id: user.id, nome: user.name, email: user.email, papel: papel as Papel };
});

export async function exigirUsuario() {
  const u = await usuarioAtual();
  if (!u) redirect("/entrar");
  return u;
}

/** Só o owner. Para os demais a página "não existe": não revelamos o que há ali. */
export async function exigirOwner() {
  const u = await exigirUsuario();
  if (!ehOwner(u)) notFound();
  return u;
}
