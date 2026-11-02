import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db, schema } from "@/db";
import { exigirUsuario } from "@/lib/acesso";
import { ehOwner } from "@/lib/permissoes";

const { ebook, user } = schema;
const ROTULO = { publicado: "Publicado", revisao: "Em revisão", rascunho: "Rascunho" } as const;
const ESTILO = {
  publicado: "bg-(--salvia)/15 text-(--salvia)",
  revisao: "bg-(--terracota)/12 text-(--terracota-escura)",
  rascunho: "bg-(--tinta)/8 text-(--tinta-2)",
} as const;

export default async function PainelEbooks() {
  const u = await exigirUsuario();
  // O parceiro só enxerga o que é dele (a consulta já nasce filtrada; não é filtro de tela).
  const linhas = db
    .select({ id: ebook.id, titulo: ebook.titulo, slug: ebook.slug, status: ebook.status, dono: user.name })
    .from(ebook)
    .leftJoin(user, eq(ebook.ownerId, user.id))
    .where(ehOwner(u) ? undefined : eq(ebook.ownerId, u.id))
    .orderBy(desc(ebook.atualizadoEm))
    .all();

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-12">
      <h1 className="font-(family-name:--font-display) text-[2rem] leading-none font-medium tracking-[-0.01em]">E-books</h1>
      {linhas.length === 0 ? (
        <p className="mt-8 max-w-prose text-(--tinta-2) text-pretty">Nenhum e-book por aqui ainda.</p>
      ) : (
        <ul className="mt-8 border-t border-(--filete)">
          {linhas.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-(--filete) py-5">
              <div className="min-w-0">
                <p className="font-(family-name:--font-display) text-[1.1875rem] leading-snug font-medium text-balance">{l.titulo}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-(--tinta-2)">
                  <Badge className={`rounded-sm border-0 px-2 ${ESTILO[l.status]}`}>{ROTULO[l.status]}</Badge>
                  {ehOwner(u) && <span>{l.dono ?? "Sem dono"}</span>}
                </p>
              </div>
              {l.status === "publicado" && <Button variant="ghost" render={<Link href={`/${l.slug}`} />}>Ver página</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
