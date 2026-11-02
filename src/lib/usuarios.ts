import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { user, ebook } = schema;

/** Usuários com a contagem de e-books. Só para páginas que já conferiram o owner (exigirOwner). */
export function listarUsuarios() {
  return db
    .select({
      id: user.id,
      nome: user.name,
      email: user.email,
      papel: user.role,
      ativo: user.ativo,
      ebooks: sql<number>`count(${ebook.id})`,
      publicados: sql<number>`coalesce(sum(${ebook.status} = 'publicado'), 0)`,
    })
    .from(user)
    .leftJoin(ebook, eq(ebook.ownerId, user.id))
    .groupBy(user.id)
    .orderBy(user.role, user.name)
    .all();
}
