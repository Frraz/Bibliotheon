import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PaginaDeVendas } from "@/landings/pagina";
import { db, schema } from "@/db";
import { exigirUsuario } from "@/lib/acesso";
import { montarEbookPublico } from "@/lib/catalogo";
import { podeEditar } from "@/lib/permissoes";

// Prévia: a própria landing, com os dados salvos (rascunho ou publicado). Só o dono e o administrador veem; fica fora do Google
// (metadados do /painel), não conta visita e os botões de compra não saem do site.
async function Previa({ params }: { params: PageProps<"/painel/ebooks/[id]/previa">["params"] }) {
  const u = await exigirUsuario();
  const { id } = await params;
  const linha = db.select({ e: schema.ebook, t: schema.tema }).from(schema.ebook).leftJoin(schema.tema, eq(schema.ebook.temaId, schema.tema.id)).where(eq(schema.ebook.id, id)).get();
  if (!linha || !podeEditar(u, linha.e)) notFound();
  const ebook = montarEbookPublico(linha.e, linha.t);
  return (
    <>
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-neutral-900 px-4 py-2 text-sm text-neutral-200">
        <span>Prévia: só você vê esta página. {linha.e.status === "publicado" ? "Mostra o que está salvo." : "Ainda é rascunho."}</span>
        <Link href={`/painel/ebooks/${id}`} className="inline-flex min-h-10 items-center gap-1.5 font-medium text-white underline underline-offset-4"><ArrowLeft className="size-4" aria-hidden /> Voltar ao editor</Link>
      </div>
      <PaginaDeVendas e={ebook} relacionados={[]} previa />
    </>
  );
}

export default function PaginaPrevia({ params }: PageProps<"/painel/ebooks/[id]/previa">) {
  return (
    <Suspense fallback={<div aria-hidden className="min-h-dvh bg-(--papel)" />}>
      <Previa params={params} />
    </Suspense>
  );
}
