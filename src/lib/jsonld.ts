import type { EbookPublico } from "./catalogo";
import { CONTATO_EMAIL, SITE_DESCRICAO, SITE_NOME, SITE_URL } from "./site";

const abs = (caminho: string | null) => (caminho ? `${SITE_URL}${caminho}` : undefined);

/** Dados estruturados da landing: Book, Product+Offer (só com preço), FAQPage e BreadcrumbList. */
export function jsonLdDoEbook(e: EbookPublico) {
  const url = `${SITE_URL}/${e.slug}`;
  const imagem = abs(e.capa);
  const grafo: Record<string, unknown>[] = [
    {
      "@type": "Book",
      "@id": `${url}#livro`,
      name: e.titulo,
      ...(e.subtitulo ? { alternativeHeadline: e.subtitulo } : {}),
      ...(e.autorExibido ? { author: e.autorExibido === SITE_NOME ? { "@type": "Organization", name: SITE_NOME, url: SITE_URL } : { "@type": "Person", name: e.autorExibido } } : {}),
      inLanguage: "pt-BR",
      bookFormat: "https://schema.org/EBook",
      ...(imagem ? { image: imagem } : {}),
      ...(e.resumo ? { description: e.resumo } : {}),
      url,
    },
  ];

  if (e.vigente.valor != null) {
    grafo.push({
      "@type": "Product",
      "@id": `${url}#produto`,
      name: e.titulo,
      ...(imagem ? { image: imagem } : {}),
      ...(e.resumo ? { description: e.resumo } : {}),
      brand: { "@type": "Brand", name: SITE_NOME },
      offers: {
        "@type": "Offer",
        url,
        priceCurrency: "BRL",
        price: (e.vigente.valor / 100).toFixed(2),
        availability: "https://schema.org/InStock",
        ...(e.vigente.emOferta && e.vigente.ate ? { priceValidUntil: e.vigente.ate.slice(0, 10) } : {}),
      },
    });
  }

  if (e.faq.length) {
    grafo.push({
      "@type": "FAQPage",
      mainEntity: e.faq.map((f) => ({ "@type": "Question", name: f.p, acceptedAnswer: { "@type": "Answer", text: f.r } })),
    });
  }

  const migalhas = [{ nome: SITE_NOME, url: SITE_URL }, ...(e.tema ? [{ nome: e.tema.nome, url: `${SITE_URL}/tema/${e.tema.slug}` }] : []), { nome: e.titulo, url }];
  grafo.push({
    "@type": "BreadcrumbList",
    itemListElement: migalhas.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: m.nome, item: m.url })),
  });

  return { "@context": "https://schema.org", "@graph": grafo };
}

/** Dados estruturados da Home: a organização (quem vende) e o site. Ajudam o Google a entender a marca e a mostrá-la nos resultados. */
export function jsonLdDoSite() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE_URL}/#organizacao`, name: SITE_NOME, url: SITE_URL, ...(CONTATO_EMAIL ? { email: CONTATO_EMAIL } : {}) },
      { "@type": "WebSite", "@id": `${SITE_URL}/#site`, name: SITE_NOME, url: SITE_URL, description: SITE_DESCRICAO, inLanguage: "pt-BR", publisher: { "@id": `${SITE_URL}/#organizacao` } },
    ],
  };
}

/** Serializa para <script type="application/ld+json"> sem permitir fechar a tag. */
export const serializarJsonLd = (obj: unknown) => JSON.stringify(obj).replace(/</g, "\\u003c");
