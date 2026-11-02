import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { listarCatalogo, listarTemas } from "@/lib/catalogo";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // o banco não existe no build: gerado a cada pedido (a leitura em si é cacheada por tag)
  const [ebooks, temas] = await Promise.all([listarCatalogo(), listarTemas()]);
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...temas.map((t) => ({ url: `${SITE_URL}/tema/${t.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...ebooks.map((e) => ({ url: `${SITE_URL}/${e.slug}`, changeFrequency: "weekly" as const, priority: 0.9 })),
    { url: `${SITE_URL}/termos`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/privacidade`, changeFrequency: "yearly", priority: 0.1 },
  ];
}
