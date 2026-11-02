import Image from "next/image";
import Link from "next/link";
import { CapaExemplo } from "@/components/site/capa-exemplo";
import { Marca } from "@/components/site/marca";
import { brl, exemplos, livro, temaReal } from "@/lib/prototipo";

const temas = [
  { nome: temaReal.nome, n: 1 },
  ...exemplos.map((e) => ({ nome: e.tema, n: 1 })),
];

export default function Home() {
  return (
    <div className="bg-(--papel) font-(family-name:--font-texto) text-[1.0625rem] leading-[1.65] text-(--tinta)">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Marca />
        <nav aria-label="Temas" className="hidden gap-7 text-[0.9375rem] text-(--tinta-2) md:flex">
          {temas.slice(0, 3).map((t) => (
            <a key={t.nome} href="#catalogo" className="underline-offset-4 transition-colors hover:text-(--tinta) hover:underline">{t.nome}</a>
          ))}
        </nav>
      </header>

      {/* Hero da marca + destaque */}
      <section className="border-t border-(--filete)">
        <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-12 px-5 py-14 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-24">
          <div>
            <h1 className="font-(family-name:--font-display) text-[clamp(2.4rem,6.6vw,4.4rem)] leading-[1.02] font-medium tracking-[-0.02em] text-balance">
              E-books práticos para resolver problemas reais
            </h1>
            <p className="mt-6 max-w-[34rem] text-[1.1875rem] text-(--tinta-2) text-pretty">
              Guias completos, escritos para quem quer sair do zero e fazer acontecer. Folheie uma amostra antes de decidir e compre na plataforma que preferir.
            </p>
            <a href="#catalogo" className="mt-8 inline-flex min-h-14 items-center bg-(--terracota) px-8 text-[1.0625rem] font-semibold text-(--papel) shadow-[0_1px_0_rgb(0_0_0/.15),0_10px_20px_-12px_rgb(0_0_0/.55)] transition-[background-color,transform] duration-150 hover:bg-(--terracota-escura) active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--terracota)">
              Ver os e-books
            </a>
          </div>

          <Link href="/prototipo/landing" className="group relative block bg-(--papel-2) p-8 transition-colors hover:bg-[#e4d9c2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--terracota) lg:p-10">
            <p className="mb-6 text-sm font-medium text-(--salvia)">Em destaque</p>
            <div className="flex gap-6">
              <Image src={livro.capa} alt={livro.capaAlt} width={1600} height={2560} priority sizes="160px" className="h-auto w-32 shrink-0 shadow-[0_2px_3px_rgb(0_0_0/.12),0_18px_36px_-12px_rgb(31_42_41/.45)] transition-transform duration-300 ease-out group-hover:-translate-y-1 sm:w-40" />
              <div className="flex min-w-0 flex-col">
                <h2 className="font-(family-name:--font-display) text-[1.375rem] leading-[1.15] font-medium text-balance">{livro.titulo}</h2>
                <p className="mt-2 text-[0.9375rem] text-(--tinta-2) text-pretty">Do zero ao sistema no ar, mesmo sem saber programar.</p>
                <p className="mt-auto pt-4 font-(family-name:--font-display) text-3xl leading-none font-medium">{brl(livro.preco)}</p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Catálogo */}
      <section id="catalogo" className="border-t border-(--filete) bg-(--papel-2)">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
            <h2 className="font-(family-name:--font-display) text-[clamp(1.75rem,4.2vw,2.75rem)] leading-[1.1] font-medium tracking-[-0.01em]">Todos os e-books</h2>
            <ul className="flex flex-wrap gap-2 text-[0.9375rem]" aria-label="Filtrar por tema">
              <li><span className="inline-flex min-h-10 items-center border border-(--tinta) bg-(--tinta) px-4 text-(--papel)">Todos</span></li>
              {temas.map((t) => (
                <li key={t.nome}>
                  <a href="#catalogo" className="inline-flex min-h-10 items-center border border-(--filete) px-4 transition-colors hover:border-(--tinta)">
                    {t.nome} <span className="ml-2 text-(--tinta-2)">{t.n}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
            <li>
              <Link href="/prototipo/landing" className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--terracota)">
                <div className="relative">
                  <Image src={livro.capa} alt={livro.capaAlt} width={1600} height={2560} sizes="(min-width:1024px) 280px, 45vw" className="h-auto w-full shadow-[0_2px_3px_rgb(0_0_0/.12),0_18px_36px_-14px_rgb(31_42_41/.45)] transition-transform duration-300 ease-out group-hover:-translate-y-1.5" />
                  <span className="absolute top-3 left-0 bg-(--terracota) px-2.5 py-1 text-xs font-semibold text-(--papel)">Lançamento</span>
                </div>
                <p className="mt-5 text-sm text-(--salvia)">{temaReal.nome}</p>
                <h3 className="mt-1 font-(family-name:--font-display) text-lg leading-snug font-medium text-balance">{livro.titulo}</h3>
                <p className="mt-2 font-medium">{brl(livro.preco)}</p>
              </Link>
            </li>
            {exemplos.map((e) => (
              <li key={e.titulo}>
                <div className="group block">
                  <div className="relative transition-transform duration-300 ease-out group-hover:-translate-y-1.5"><CapaExemplo titulo={e.titulo} cor={e.cor} /></div>
                  <p className="mt-5 text-sm text-(--salvia)">{e.tema}</p>
                  <h3 className="mt-1 font-(family-name:--font-display) text-lg leading-snug font-medium text-balance">{e.titulo}</h3>
                  <p className="mt-2 font-medium">{brl(e.preco)}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-12 text-sm text-(--tinta-2)">Protótipo: as capas 2 a 4 são ilustrativas, só para mostrar como o catálogo cresce.</p>
        </div>
      </section>

      <footer className="px-5 py-12 text-center text-sm text-(--tinta-2)">
        <Marca />
        <p className="mt-3 max-w-md mx-auto text-pretty">Biblioteca de e-books práticos. Pagamento, entrega e reembolso são feitos pela plataforma onde você comprar.</p>
        <p className="mt-3">Termos · Privacidade</p>
      </footer>
    </div>
  );
}
