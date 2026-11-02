import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartaoEbookLink } from "@/components/site/cartao-ebook";
import { getTema, listarDoTema, slugsDosTemas } from "@/lib/catalogo";
import { SITE_NOME, SITE_URL } from "@/lib/site";

export const ensureStatic = "navigation";

export function generateStaticParams() {
  return slugsDosTemas().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/tema/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTema(slug);
  if (!t) return { title: "Tema não encontrado", robots: { index: false } };
  const titulo = `E-books de ${t.nome.toLowerCase()}`;
  return {
    title: titulo,
    description: t.descricao ?? undefined,
    alternates: { canonical: `${SITE_URL}/tema/${t.slug}` },
    openGraph: { type: "website", siteName: SITE_NOME, locale: "pt_BR", title: titulo, description: t.descricao ?? undefined },
  };
}

export default async function PaginaTema({ params }: PageProps<"/tema/[slug]">) {
  const { slug } = await params;
  const t = await getTema(slug);
  if (!t) notFound();
  const ebooks = await listarDoTema(slug);
  return (
    <section>
      <div className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
        <h1 className="font-(family-name:--font-display) text-[clamp(2.2rem,5.5vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.02em] text-balance">{t.nome}</h1>
        {t.descricao && <p className="mt-5 max-w-2xl text-[1.1875rem] text-(--tinta-2) text-pretty">{t.descricao}</p>}
        <ul className="mt-14 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
          {ebooks.map((c) => (
            <li key={c.slug}><CartaoEbookLink c={c} /></li>
          ))}
        </ul>
      </div>
    </section>
  );
}
