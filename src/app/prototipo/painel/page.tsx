import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CapaExemplo } from "@/components/site/capa-exemplo";
import { livro } from "@/lib/prototipo";

// Linhas de demonstração: só o 001 é real; os outros mostram os demais estados.
const linhas = [
  { id: "001", titulo: livro.titulo, status: "publicado", dono: "Warley", visitas: 412, cliques: 38, capa: "real" },
  { id: "002", titulo: "Alimentação sem Culpa", status: "revisao", dono: "Marina (parceira)", visitas: 0, cliques: 0, capa: "#55685F" },
  { id: "003", titulo: "Finanças em Dia", status: "rascunho", dono: "Warley", visitas: 0, cliques: 0, capa: "#8A6A2B" },
] as const;

const rotuloStatus = { publicado: "Publicado", revisao: "Em revisão", rascunho: "Rascunho" } as const;
const estiloStatus = {
  publicado: "bg-(--salvia)/15 text-(--salvia)",
  revisao: "bg-(--terracota)/12 text-(--terracota-escura)",
  rascunho: "bg-(--tinta)/8 text-(--tinta-2)",
} as const;

export default function Lista() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-(family-name:--font-display) text-[2rem] leading-none font-medium tracking-[-0.01em]">E-books</h1>
        <Button size="lg" render={<Link href="/prototipo/painel/editor" />}><Plus /> Novo e-book</Button>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Filtrar">
        <span className="inline-flex min-h-10 items-center bg-(--tinta) px-4 text-(--papel)">Todos 3</span>
        <span className="inline-flex min-h-10 items-center border border-(--filete) px-4">Em revisão 1</span>
        <span className="ml-auto text-(--tinta-2)">Últimos 7 dias</span>
      </div>

      <ul className="mt-4 border-t border-(--filete)">
        {linhas.map((l) => (
          <li key={l.id} className="grid grid-cols-[3.5rem_1fr] items-center gap-x-4 gap-y-3 border-b border-(--filete) py-5 sm:grid-cols-[3.5rem_1fr_auto_auto] sm:gap-x-6">
            <div className="w-14">
              {l.capa === "real" ? (
                <Image src={livro.capa} alt="" width={1600} height={2560} sizes="56px" className="h-auto w-full shadow-[0_1px_2px_rgb(0_0_0/.2)]" />
              ) : (
                <CapaExemplo titulo={l.titulo} cor={l.capa} />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-(family-name:--font-display) text-[1.1875rem] leading-snug font-medium text-balance">{l.titulo}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-(--tinta-2)">
                <Badge className={`rounded-sm border-0 px-2 ${estiloStatus[l.status]}`}>{rotuloStatus[l.status]}</Badge>
                {l.dono}
              </p>
            </div>
            <dl className="col-span-2 flex gap-8 text-sm sm:col-span-1 sm:col-start-3 sm:row-start-1">
              {[
                ["Visitas", l.visitas.toLocaleString("pt-BR")],
                ["Cliques", l.cliques.toLocaleString("pt-BR")],
                ["Taxa", l.visitas ? `${((l.cliques / l.visitas) * 100).toFixed(1).replace(".", ",")}%` : "–"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-(--tinta-2)">{k}</dt>
                  <dd className="font-(family-name:--font-display) text-xl leading-tight font-medium [font-variant-numeric:tabular-nums]">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="col-span-2 flex gap-2 sm:col-span-1 sm:col-start-4 sm:row-start-1">
              {l.status === "publicado" && <Button variant="ghost" render={<Link href="/criar-sistemas-com-ia" />}>Ver página</Button>}
              <Button variant="outline" render={<Link href="/prototipo/painel/editor" />}>Editar</Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-(--tinta-2)">Protótipo: números e os e-books 002 e 003 são de demonstração.</p>
    </div>
  );
}
