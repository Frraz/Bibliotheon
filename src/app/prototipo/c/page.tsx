import Image from "next/image";
import { Archivo } from "next/font/google";
import { BarraFixa } from "@/components/prototipo/barra-fixa";
import { Contagem } from "@/components/prototipo/contagem";
import { Folhear } from "@/components/prototipo/folhear";
import { brl, livro } from "@/lib/prototipo";

const familia = Archivo({ subsets: ["latin"], variable: "--font-familia", axes: ["wdth"] });

// Direção C — Direta. Fundo claro, um bloco de cor cheio e tipografia larga e pesada.
const tema = {
  "--branco": "#FCFAF5",
  "--creme": "#F3ECDD",
  "--tinta": "#17211F",
  "--tinta-2": "#4B5855",
  "--terracota": "#BA4529",
  "--terracota-escura": "#9C3720",
  "--salvia": "#2F4A40",
  "--salvia-clara": "#DCE6DF",
  "--linha": "#DDD4C1",
} as React.CSSProperties;

const Seta = () => (
  <svg viewBox="0 0 20 20" className="size-5 shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="m5 8 5 5 5-5" />
  </svg>
);
const Ok = ({ className = "", claro = false }: { className?: string; claro?: boolean }) => (
  <span
    className={`grid shrink-0 place-items-center rounded-full ${claro ? "bg-[#FFF6E9] text-(--terracota)" : "bg-(--salvia) text-white"} ${className}`}
    aria-hidden
  >
    <svg viewBox="0 0 20 20" className="size-[58%]" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
  </span>
);
const Nao = () => (
  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-(--tinta)/12 text-(--tinta-2)" aria-hidden>
    <svg viewBox="0 0 20 20" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="m5 5 10 10M15 5 5 15" /></svg>
  </span>
);
const Flecha = () => (
  <svg viewBox="0 0 20 20" className="size-5 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
    <path d="M4 10h12m-5-5 5 5-5 5" />
  </svg>
);

function Botao({ children, className = "", escuro = true }: { children: React.ReactNode; className?: string; escuro?: boolean }) {
  return (
    <a
      href="#comprar"
      className={`group inline-flex min-h-16 items-center justify-center gap-3 rounded-full px-9 text-[1.125rem] font-bold transition-[background-color,transform] duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 ${
        escuro
          ? "bg-(--tinta) text-white hover:bg-black focus-visible:outline-(--tinta)"
          : "bg-(--terracota) text-white hover:bg-(--terracota-escura) focus-visible:outline-(--terracota)"
      } ${className}`}
    >
      {children}
      <Flecha />
    </a>
  );
}

const H2 = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`text-[clamp(1.9rem,5vw,3.25rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance [font-variation-settings:'wdth'_108] ${className}`}>
    {children}
  </h2>
);

export default function DirecaoC() {
  const d = new Date(livro.ofertaAte);
  const fimCurto = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  const numeros = [
    { n: livro.paginas, r: "páginas" },
    { n: livro.capitulos, r: "capítulos" },
    { n: 4, r: "materiais incluídos" },
    { n: livro.garantiaDias, r: "dias de garantia" },
  ];
  return (
    <div
      style={tema}
      className={`${familia.variable} bg-(--branco) font-(family-name:--font-familia) text-[1.0625rem] leading-[1.6] text-(--tinta)`}
    >
      {/* 1 · Hero */}
      <header id="topo" className="relative bg-(--terracota) text-[#FFF6E9]">
        {/* 2 · Faixa de urgência */}
        <div className="flex min-h-[3.75rem] items-center justify-center bg-(--tinta) px-5 py-2.5 text-center text-sm font-medium text-[#FFF6E9] sm:min-h-10">
          Preço de lançamento até <span className="whitespace-nowrap">{fimCurto}</span>
          <span className="mx-2 opacity-40" aria-hidden>|</span>
          faltam <Contagem ate={livro.ofertaAte} className="font-bold whitespace-nowrap" />
        </div>

        <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-10 px-5 pt-10 pb-12 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:pt-12 lg:pb-28">
          <div>
            <p className="mb-4 inline-block rounded-full bg-[#FFF6E9]/15 px-4 py-1.5 text-sm font-semibold">E-book prático · {livro.autor}</p>
            <h1 className="text-[clamp(2.3rem,5.4vw,4.1rem)] leading-[1] font-extrabold tracking-[-0.03em] text-balance [font-variation-settings:'wdth'_106]">
              {livro.headline}
            </h1>
            <p className="mt-6 max-w-xl text-[1.1875rem] text-[#FFF6E9]/90 text-pretty">{livro.subtitulo}</p>

            <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex items-baseline gap-3">
                <span className="text-5xl leading-none font-extrabold tracking-tight [font-variation-settings:'wdth'_108]">{brl(livro.preco)}</span>
                <s className="text-lg opacity-75">{brl(livro.precoDe)}</s>
              </div>
              <Botao className="w-full sm:w-auto">Quero o livro</Botao>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
              {["Acesso imediato", "PDF e EPUB", `Garantia de ${livro.garantiaDias} dias`].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Ok claro className="size-5" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-[14rem] sm:w-[17rem] lg:-mb-52 lg:w-[22rem] lg:justify-self-center">
            <Image
              src={livro.capa}
              alt={livro.capaAlt}
              width={1600}
              height={2560}
              priority
              sizes="(min-width:1024px) 352px, 272px"
              className="h-auto w-full rounded-sm shadow-[0_30px_60px_-18px_rgb(0_0_0/.55)] [transform:rotate(3deg)] transition-transform duration-500 ease-out hover:[transform:rotate(1deg)]"
            />
          </div>
        </div>
      </header>

      {/* Números reais */}
      <section className="mx-auto max-w-6xl px-5 pt-14 lg:pt-20">
        <dl className="grid grid-cols-2 gap-y-8 lg:w-[62%] lg:grid-cols-4">
          {numeros.map((x) => (
            <div key={x.r}>
              <dt className="sr-only">{x.r}</dt>
              <dd>
                <span className="block text-5xl leading-none font-extrabold tracking-tight text-(--terracota) [font-variation-settings:'wdth'_108]">{x.n}</span>
                <span className="mt-1 block text-sm font-medium text-(--tinta-2)">{x.r}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 3 · Sobre o livro */}
      <section className="mx-auto grid max-w-6xl gap-x-16 gap-y-6 px-5 py-16 lg:grid-cols-[1fr_1.1fr] lg:py-24">
        <H2>{livro.problema}</H2>
        <div className="space-y-5 text-(--tinta-2) text-pretty">
          {livro.descricao.map((p) => (<p key={p.slice(0, 20)}>{p}</p>))}
        </div>
      </section>

      {/* 4 · O que você vai aprender */}
      <section className="bg-(--creme)">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
          <H2 className="max-w-3xl">O que você vai saber fazer ao terminar</H2>
          <ul className="mt-10 grid gap-3 lg:grid-cols-2">
            {livro.beneficios.map((b) => (
              <li key={b} className="flex items-start gap-4 rounded-2xl bg-(--branco) p-5 text-[1.125rem] font-semibold text-pretty">
                <Ok className="mt-0.5 size-8" />
                {b}
              </li>
            ))}
          </ul>
          <figure className="mt-3 overflow-hidden rounded-2xl bg-(--branco) p-3 lg:p-5">
            <Image src={livro.percurso} alt="Cinco etapas: ideia, documentação, construção local, demonstração e produção." width={1200} height={792} className="mx-auto h-auto w-full max-w-xl rounded-xl" />
            <figcaption className="mt-3 text-center text-sm text-(--tinta-2)">Uma página do livro: o caminho que você percorre da ideia ao uso.</figcaption>
          </figure>
        </div>
      </section>

      {/* 5 · Para quem é / não é */}
      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-16 lg:grid-cols-2 lg:py-24">
        <div className="rounded-3xl bg-(--salvia-clara) p-7 lg:p-10">
          <H2 className="text-[clamp(1.5rem,3vw,2.1rem)]">É para você se</H2>
          <ul className="mt-6 space-y-4">
            {livro.paraQuem.map((t) => (<li key={t} className="flex gap-3 font-medium text-pretty"><Ok className="mt-0.5 size-6" />{t}</li>))}
          </ul>
        </div>
        <div className="rounded-3xl border-2 border-(--linha) p-7 lg:p-10">
          <H2 className="text-[clamp(1.5rem,3vw,2.1rem)]">Talvez não seja para você se</H2>
          <ul className="mt-6 space-y-4 text-(--tinta-2)">
            {livro.naoEPara.map((t) => (<li key={t} className="flex gap-3 text-pretty"><Nao />{t}</li>))}
          </ul>
        </div>
      </section>

      {/* 6 · Folheie o livro */}
      <section className="bg-(--salvia) text-[#F4EFE3]">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
          <H2>Folheie antes de decidir</H2>
          <p className="mt-3 text-[#F4EFE3]/75">Páginas reais do livro. Toque para ampliar.</p>
          <Folhear paginas={livro.amostras} className="mt-10 -mx-5 px-5" itemClassName="rounded-md shadow-[0_20px_36px_-14px_rgb(0_0_0/.55)] outline-white" />
        </div>
      </section>

      {/* 7 · Sumário */}
      <section className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
        <H2>{livro.capitulos} capítulos, do zero à proposta</H2>
        <ol className="mt-10 grid gap-x-12 border-t-2 border-(--tinta) lg:grid-cols-2">
          {livro.sumario.map((c, i) => (
            <li key={c} className="flex gap-4 border-b border-(--linha) py-3.5 font-medium">
              <span className="w-8 shrink-0 text-right font-extrabold text-(--terracota) [font-variant-numeric:tabular-nums]">{i + 1}</span>
              <span className="text-pretty">{c}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 8 · Incluído + 10 · Garantia + 9 · Autor */}
      <section className="bg-(--creme)">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-16 lg:grid-cols-3 lg:py-24">
          <div className="rounded-3xl bg-(--branco) p-7">
            <p className="text-2xl font-extrabold [font-variation-settings:'wdth'_108]">O que você recebe</p>
            <ul className="mt-5 space-y-3.5">
              {livro.incluido.map((t) => (<li key={t} className="flex gap-3 font-medium text-pretty"><Ok className="mt-0.5 size-6" />{t}</li>))}
            </ul>
          </div>
          <div className="rounded-3xl bg-(--tinta) p-7 text-white">
            <p className="text-2xl font-extrabold [font-variation-settings:'wdth'_108]">Garantia de {livro.garantiaDias} dias</p>
            <p className="mt-4 text-white/80 text-pretty">
              Se o livro não for o que você esperava, peça o reembolso pela própria plataforma em até {livro.garantiaDias} dias, sem abrir mão dos direitos previstos em lei.
            </p>
          </div>
          <div className="rounded-3xl bg-(--branco) p-7">
            <p className="text-2xl font-extrabold [font-variation-settings:'wdth'_108]">{livro.autor}</p>
            <p className="mt-4 text-(--tinta-2) text-pretty">{livro.sobreAutor}</p>
          </div>
        </div>
      </section>

      {/* 11 · FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-16 lg:py-24">
        <H2>Perguntas frequentes</H2>
        <div className="mt-8 border-t-2 border-(--tinta)">
          {livro.faq.map((f) => (
            <details key={f.p} className="group border-b border-(--linha)">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 text-[1.1875rem] font-bold marker:content-none [&::-webkit-details-marker]:hidden">
                {f.p}
                <Seta />
              </summary>
              <p className="pb-6 text-(--tinta-2) text-pretty">{f.r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 12 · Bloco de compra */}
      <section id="comprar" className="bg-(--terracota) px-5 py-16 lg:py-24">
        <div className="mx-auto max-w-xl rounded-[2rem] bg-(--branco) p-8 text-center shadow-[0_30px_60px_-24px_rgb(0_0_0/.5)] lg:p-12">
          <p className="text-sm font-bold text-(--terracota)">Preço de lançamento até {fimCurto}</p>
          <p className="mt-3 text-6xl leading-none font-extrabold tracking-tight [font-variation-settings:'wdth'_108]">{brl(livro.preco)}</p>
          <p className="mt-2 text-(--tinta-2)"><s>{brl(livro.precoDe)}</s> · pagamento único · acesso imediato</p>
          <Botao className="mt-7 w-full" escuro={false}>Comprar na {livro.ofertas[0].plataforma}</Botao>
          <p className="mt-6 text-sm text-(--tinta-2)">Prefere outra plataforma?</p>
          <a href="#comprar" className="mt-2 inline-flex min-h-12 items-center rounded-full border-2 border-(--linha) px-6 font-bold transition-colors hover:border-(--tinta)">
            Comprar na {livro.ofertas[1].plataforma}
          </a>
          <p className="mt-8 border-t border-(--linha) pt-5 text-xs text-(--tinta-2) text-pretty">
            Garantia de {livro.garantiaDias} dias. Antes de comprar: computador e internet. Planos de IA, VPS e domínio são custos externos. Sem promessa de renda ou de prazo.
          </p>
        </div>
      </section>

      <footer className="px-5 py-10 text-center text-sm text-(--tinta-2)">
        <p className="text-lg font-extrabold text-(--tinta) [font-variation-settings:'wdth'_108]">Bibliotheon</p>
        <p className="mt-1">Termos · Privacidade</p>
      </footer>

      <BarraFixa className="border-t border-(--linha) bg-(--branco)">
        <div className="flex items-center gap-4 px-5 py-3">
          <p className="text-2xl leading-none font-extrabold [font-variation-settings:'wdth'_108]">{brl(livro.preco)}</p>
          <Botao className="ml-auto min-h-12 px-6" escuro={false}>Comprar</Botao>
        </div>
      </BarraFixa>
    </div>
  );
}
