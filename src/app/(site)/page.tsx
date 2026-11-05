import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CartaoEbookLink } from "@/components/site/cartao-ebook";
import type { Metadata } from "next";
import { listarCatalogo, listarTemas } from "@/lib/catalogo";
import { jsonLdDoSite, serializarJsonLd } from "@/lib/jsonld";
import { brl } from "@/lib/preco";
import { SITE_DESCRICAO, SITE_NOME, SITE_URL } from "@/lib/site";

const TITULO = `${SITE_NOME} · E-books práticos para resolver problemas reais`;

// Metadados próprios da Home (antes herdava os do layout): título, descrição, endereço canônico e prévia de compartilhamento.
export const metadata: Metadata = {
  title: { absolute: TITULO },
  description: SITE_DESCRICAO,
  alternates: { canonical: SITE_URL },
  openGraph: { type: "website", siteName: SITE_NOME, locale: "pt_BR", title: TITULO, description: SITE_DESCRICAO, url: SITE_URL },
  twitter: { card: "summary_large_image", title: TITULO, description: SITE_DESCRICAO },
};

// A Home lê o catálogo no pedido (o banco do build está vazio); as consultas são cacheadas por tag.
// O texto do topo (H1 e frase) não depende do banco e fica FORA do que espera o banco: ele entra no HTML estático e é o
// que mede o LCP. Só o botão, o destaque e o catálogo chegam depois, cada um com a altura reservada (sem deslocamento).
async function dados() {
  await connection();
  const [catalogo, temas] = await Promise.all([listarCatalogo(), listarTemas()]);
  return { catalogo, temas };
}

async function BotaoVer() {
  const { catalogo } = await dados();
  if (catalogo.length < 2) return null;
  return (
    <a href="#catalogo" className="mt-8 inline-flex min-h-14 items-center bg-(--terracota) px-8 text-[1.0625rem] font-semibold text-(--papel) shadow-[0_1px_0_rgb(0_0_0/.15),0_10px_20px_-12px_rgb(0_0_0/.55)] transition-[background-color,transform] duration-150 hover:bg-(--terracota-escura) active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--terracota)">
      Ver os e-books
    </a>
  );
}

async function Destaque() {
  const { catalogo } = await dados();
  const destaque = catalogo[0];
  if (!destaque) return null;
  return (
    <Link href={`/${destaque.slug}`} prefetch={false} className="group relative block bg-(--papel-2) p-5 transition-colors hover:bg-[#e4d9c2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--terracota) sm:p-8 lg:p-10">
      <p className="mb-5 text-center text-sm font-medium text-(--salvia) sm:mb-6 sm:text-left">Em destaque</p>
      <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-stretch sm:text-left">
        {destaque.capa && (
          <div className="aspect-[2/3] w-36 shrink-0 overflow-hidden shadow-[0_2px_3px_rgb(0_0_0/.12),0_18px_36px_-12px_rgb(31_42_41/.45)] transition-transform duration-300 ease-out group-hover:-translate-y-1 sm:w-40">
            <Image src={destaque.capa} alt={destaque.capaAlt || `Capa de ${destaque.titulo}`} width={1600} height={2560} priority sizes="160px" className="size-full object-cover" />
          </div>
        )}
        <div className="flex w-full min-w-0 flex-col">
          <h2 className="font-(family-name:--font-display) text-[1.375rem] leading-[1.15] font-medium text-balance">{destaque.titulo}</h2>
          {destaque.subtitulo && <p className="mt-2 text-[0.9375rem] text-(--tinta-2) text-pretty">{destaque.subtitulo}</p>}
          <p className="mt-4 font-(family-name:--font-display) text-3xl leading-none font-medium sm:mt-auto sm:pt-4">
            {destaque.vigente.valor != null ? brl(destaque.vigente.valor) : <span className="text-xl text-(--tinta-2)">Em breve</span>}
          </p>
          <span className="mt-5 inline-flex min-h-12 items-center justify-center bg-(--tinta) px-6 font-semibold text-(--papel) transition-colors group-hover:bg-(--terracota) sm:mt-4 sm:self-start">Conhecer o e-book</span>
        </div>
      </div>
    </Link>
  );
}

async function Catalogo() {
  const { catalogo, temas } = await dados();
  const resto = catalogo.slice(1);
  return (
    <>
      {resto.length > 0 && (
        <section id="catalogo" className="border-t border-(--filete) bg-(--papel-2)">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
              <h2 className="font-(family-name:--font-display) text-[clamp(1.75rem,4.2vw,2.75rem)] leading-[1.1] font-medium tracking-[-0.01em]">Todos os e-books</h2>
              {temas.length > 0 && (
                <ul className="flex flex-wrap gap-2 text-[0.9375rem]" aria-label="Filtrar por tema">
                  <li><span className="inline-flex min-h-10 items-center border border-(--tinta) bg-(--tinta) px-4 text-(--papel)">Todos</span></li>
                  {temas.map((t) => (
                    <li key={t.slug}>
                      <Link href={`/tema/${t.slug}`} prefetch={false} className="inline-flex min-h-10 items-center border border-(--filete) px-4 transition-colors hover:border-(--tinta)">
                        {t.nome} <span className="ml-2 text-(--tinta-2)">{t.total}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:mt-12 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4">
              {catalogo.map((c) => (
                <li key={c.slug}><CartaoEbookLink c={c} /></li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {catalogo.length === 0 && (
        <section className="border-t border-(--filete) bg-(--papel-2)">
          <p className="mx-auto max-w-6xl px-5 py-16 text-(--tinta-2)">Os primeiros e-books estão chegando. Volte em breve.</p>
        </section>
      )}
    </>
  );
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdDoSite()) }} />
      <section>
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-x-16 gap-y-10 px-5 py-10 sm:py-14 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-24">
          <div>
            <h1 className="font-(family-name:--font-display) text-[clamp(2.4rem,6.6vw,4.4rem)] leading-[1.02] font-medium tracking-[-0.02em] text-balance">
              E-books práticos para resolver problemas reais
            </h1>
            <p className="mt-6 max-w-[34rem] text-[1.1875rem] text-(--tinta-2) text-pretty">
              Guias completos, escritos para quem quer sair do zero e fazer acontecer. Folheie uma amostra antes de decidir e compre na plataforma que preferir.
            </p>
            <Suspense fallback={<div className="mt-8 min-h-14" aria-hidden />}>
              <BotaoVer />
            </Suspense>
          </div>
          <Suspense fallback={<div className="min-h-[27rem] sm:min-h-[19rem] lg:min-h-[22rem]" aria-hidden />}>
            <Destaque />
          </Suspense>
        </div>
      </section>
      <Suspense fallback={<div className="min-h-[60svh]" aria-hidden />}>
        <Catalogo />
      </Suspense>
    </>
  );
}
