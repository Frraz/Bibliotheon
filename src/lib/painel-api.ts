import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { usuarioAtual, type UsuarioLogado } from "./acesso";
import { erro } from "./api";
import { podeEditar } from "./permissoes";
import { SITE_URL } from "./site";

/**
 * Porta de entrada das rotas de arquivo do painel: sessão, dono do e-book e origem da requisição.
 * Devolve a resposta de erro pronta ou o usuário e o e-book. Rotas, como Server Actions, não confiam na tela.
 */
export async function exigirEdicaoPeloId(req: Request, id: string, { alteraDados = true } = {}): Promise<Response | { usuario: UsuarioLogado; e: typeof schema.ebook.$inferSelect }> {
  const origem = req.headers.get("origin");
  if (alteraDados && origem && origem !== new URL(SITE_URL).origin) return erro("Origem não permitida.", 403);
  const usuario = await usuarioAtual();
  if (!usuario) return erro("Entre no painel para continuar.", 401);
  const e = db.select().from(schema.ebook).where(eq(schema.ebook.id, id)).get();
  // Quem não é dono recebe o mesmo "não encontrado": não confirmamos que o e-book existe.
  if (!e || !podeEditar(usuario, e)) return erro("E-book não encontrado.", 404);
  return { usuario, e };
}
