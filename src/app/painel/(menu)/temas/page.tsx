import { asc, eq, sql } from "drizzle-orm";
import { TemasGestao } from "@/components/painel/temas-gestao";
import { db, schema } from "@/db";
import { exigirOwner } from "@/lib/acesso";

export default async function Temas() {
  await exigirOwner();
  const { tema, ebook } = schema;
  const linhas = db
    .select({ id: tema.id, nome: tema.nome, slug: tema.slug, descricao: tema.descricao, publicado: tema.publicado, ebooks: sql<number>`count(${ebook.id})` })
    .from(tema)
    .leftJoin(ebook, eq(ebook.temaId, tema.id))
    .groupBy(tema.id)
    .orderBy(asc(tema.ordem), asc(tema.nome))
    .all();
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-12">
      <TemasGestao temas={linhas.map((t) => ({ ...t, descricao: t.descricao ?? "" }))} />
    </div>
  );
}
