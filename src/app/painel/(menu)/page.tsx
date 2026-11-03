import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { exigirUsuario } from "@/lib/acesso";
import { listarEbooks } from "@/lib/ebooks";
import { ehOwner } from "@/lib/permissoes";

const ROTULO = { publicado: "Publicado", revisao: "Rascunho", rascunho: "Rascunho" } as const;
const ESTILO = { publicado: "bg-(--salvia)/15 text-(--salvia)", revisao: "bg-(--tinta)/8 text-(--tinta-2)", rascunho: "bg-(--tinta)/8 text-(--tinta-2)" } as const;

export default async function PainelEbooks() {
  const u = await exigirUsuario();
  const linhas = listarEbooks(u); // já nasce filtrada: o parceiro só recebe o que é dele
  const taxa = (v: number, c: number) => (v ? `${((c / v) * 100).toFixed(1).replace(".", ",")}%` : "–");

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-(family-name:--font-display) text-[2rem] leading-none font-medium tracking-[-0.01em]">E-books</h1>
        <Button size="lg" render={<Link href="/painel/ebooks/novo" />}><Plus /> Novo e-book</Button>
      </div>

      {linhas.length === 0 ? (
        <div className="mt-10 max-w-prose">
          <p className="text-(--tinta-2) text-pretty">Você ainda não tem e-books. Comece pelo título e pela capa: o resto você completa depois.</p>
          <Button size="lg" className="mt-5" render={<Link href="/painel/ebooks/novo" />}><Plus /> Criar o primeiro e-book</Button>
        </div>
      ) : (
        <>
          <p className="mt-8 text-right text-sm text-(--tinta-2)">Visitas e cliques dos últimos 7 dias</p>
          <ul className="mt-4 border-t border-(--filete)">
            {linhas.map((l) => (
              <li key={l.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b border-(--filete) py-5 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto_auto] sm:gap-x-6">
                <div className="w-14">
                  {l.capa ? (
                    <Image src={`/m/${l.capa}`} alt={l.capaAlt ?? ""} width={1600} height={2560} sizes="56px" className="h-auto w-full shadow-[0_1px_2px_rgb(0_0_0/.2)]" />
                  ) : (
                    <div className="grid aspect-[1600/2560] w-full place-items-center bg-(--papel-2) text-[0.625rem] text-(--tinta-2)">Sem capa</div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-(family-name:--font-display) text-[1.1875rem] leading-snug font-medium text-balance">{l.titulo}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-(--tinta-2)">
                    <Badge className={`rounded-sm border-0 px-2 ${ESTILO[l.status]}`}>{ROTULO[l.status]}</Badge>
                    {ehOwner(u) && <span>{l.dono ?? "Sem dono"}</span>}
                  </p>
                </div>
                <dl className="col-span-2 flex gap-8 text-sm sm:col-span-1 sm:col-start-3 sm:row-start-1">
                  {[["Visitas", l.visitas.toLocaleString("pt-BR")], ["Cliques", l.cliques.toLocaleString("pt-BR")], ["Taxa", taxa(l.visitas, l.cliques)]].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-(--tinta-2)">{k}</dt>
                      <dd className="font-(family-name:--font-display) text-xl leading-tight font-medium [font-variant-numeric:tabular-nums]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="col-span-2 flex gap-2 sm:col-span-1 sm:col-start-4 sm:row-start-1">
                  {l.status === "publicado" ? (
                    <Button variant="ghost" render={<Link href={`/${l.slug}`} target="_blank" />}>Ver página</Button>
                  ) : (
                    <Button variant="ghost" render={<Link href={`/painel/ebooks/${l.id}/previa`} target="_blank" />}>Ver prévia</Button>
                  )}
                  <Button variant="outline" render={<Link href={`/painel/ebooks/${l.id}`} />}>Editar</Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
