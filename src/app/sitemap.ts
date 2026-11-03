import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { listarCatalogo, listarTemas } from "@/lib/catalogo";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // o banco não existe no build: gerado a cada pedido (a leitura em si é cacheada por tag)
  const [ebooks, temas] = await Promise.all([listarCatalogo(), listarTemas()]);
  // `lastmod` só com data real: a do último e-book alterado (a Home e o tema mudam quando um livro deles muda).
  const maisRecente = (lista: { atualizadoEm: string }[]) => (lista.length ? new Date(lista.map((e) => e.atualizadoEm).sort().at(-1)!) : undefined);
  return [
    { url: SITE_URL, lastModified: maisRecente(ebooks), changeFrequency: "weekly", priority: 1 },
    ...temas.map((t) => ({ url: `${SITE_URL}/tema/${t.slug}`, lastModified: maisRecente(ebooks.filter((e) => e.tema === t.nome)), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...ebooks.map((e) => ({ url: `${SITE_URL}/${e.slug}`, lastModified: new Date(e.atualizadoEm), changeFrequency: "weekly" as const, priority: 0.9 })),
    { url: `${SITE_URL}/termos`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/privacidade`, changeFrequency: "yearly", priority: 0.1 },
  ];
}
