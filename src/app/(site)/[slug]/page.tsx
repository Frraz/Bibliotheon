import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Landing } from "@/components/site/landing";
import { getEbook, listarDoTema, slugsDosEbooks } from "@/lib/catalogo";
import { SITE_NOME, SITE_URL } from "@/lib/site";

// Landing do e-book. Estática (a primeira visita a um slug novo espera a página completa, não um esqueleto),
// com dados em cache invalidados por tag quando o painel ou a API gravam.
export const ensureStatic = "navigation";

export function generateStaticParams() {
  return slugsDosEbooks().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const e = await getEbook(slug);
  if (!e) return { title: "Página não encontrada", robots: { index: false } };
  const titulo = e.seoTitle?.trim() || `${e.titulo} | E-book`;
  const descricao = e.seoDescription?.trim() || e.resumo || e.subtitulo || undefined;
  return {
    title: { absolute: titulo },
    description: descricao,
    alternates: { canonical: `${SITE_URL}/${e.slug}` },
    openGraph: { type: "website", siteName: SITE_NOME, locale: "pt_BR", title: titulo, description: descricao, url: `${SITE_URL}/${e.slug}` },
    twitter: { card: "summary_large_image", title: titulo, description: descricao },
  };
}

export default async function PaginaEbook({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const e = await getEbook(slug);
  if (!e) notFound();
  const relacionados = e.tema ? (await listarDoTema(e.tema.slug, e.slug)).slice(0, 4) : [];
  return <Landing e={e} relacionados={relacionados} />;
}
