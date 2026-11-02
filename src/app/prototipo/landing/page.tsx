import Image from "next/image";
import { BarraFixa } from "@/components/prototipo/barra-fixa";
import { Contagem } from "@/components/prototipo/contagem";
import { Folhear } from "@/components/prototipo/folhear";
import { brl, livro } from "@/lib/prototipo";

const Seta = () => (
  <svg viewBox="0 0 20 20" className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <path d="m5 8 5 5 5-5" />
  </svg>
);
const Marca = () => (
  <svg viewBox="0 0 20 20" className="mt-[0.35em] size-[1.05em] shrink-0 text-(--terracota)" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path d="m4 10.5 4 4 8-9" />
  </svg>
);

function Botao({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <a
      href="#comprar"
      className={`inline-flex min-h-14 items-center justify-center bg-(--terracota) px-8 text-[1.0625rem] font-semibold text-(--papel) shadow-[0_1px_0_rgb(0_0_0/.15),0_10px_20px_-12px_rgb(0_0_0/.55)] transition-[background-color,transform] duration-150 hover:bg-(--terracota-escura) active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--terracota) ${className}`}
    >
      {children}
    </a>
  );
}

const Titulo = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`font-(family-name:--font-display) text-[clamp(1.75rem,4.2vw,2.75rem)] leading-[1.1] font-medium tracking-[-0.01em] text-balance ${className}`}>
    {children}
  </h2>
);

export default function DirecaoA() {
  const d = new Date(livro.ofertaAte);
  const fim = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
  const fimCurto = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  return (
    <div className="bg-(--papel) font-(family-name:--font-texto) text-[1.0625rem] leading-[1.65] text-(--tinta)">
      {/* 2 · Faixa de urgência (só existe com data real) */}
      <div className="flex min-h-[3.75rem] items-center justify-center bg-(--tinta) px-5 py-2.5 text-center text-sm text-(--papel) sm:min-h-10">
        <p>
          Preço de lançamento até <span className="whitespace-nowrap">{fimCurto}</span>
          <span className="mx-2 opacity-40" aria-hidden>|</span>
          faltam <Contagem ate={livro.ofertaAte} className="font-semibold whitespace-nowrap" />
        </p>
      </div>

      {/* 1 · Hero */}
      <header id="topo" className="mx-auto grid max-w-6xl gap-x-16 gap-y-10 px-5 pt-10 pb-16 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:py-24">
        <div className="lg:order-1">
          <p className="mb-5 text-sm font-medium text-(--salvia)">E-book · {livro.autor}</p>
          <h1 className="font-(family-name:--font-display) text-[clamp(2.3rem,6.4vw,3.9rem)] leading-[1.04] font-medium tracking-[-0.02em] text-balance">
            {livro.headline}
          </h1>
          <p className="mt-6 max-w-[34rem] text-[1.1875rem] text-(--tinta-2) text-pretty">{livro.subtitulo}</p>

          <div className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-5">
            <div>
              <p className="text-sm text-(--tinta-2)">
                <s>{brl(livro.precoDe)}</s>
              </p>
              <p className="font-(family-name:--font-display) text-5xl leading-none font-medium">{brl(livro.preco)}</p>
            </div>
            <Botao>Quero o livro na {livro.ofertas[0].plataforma}</Botao>
          </div>
          <p className="mt-5 text-sm text-(--tinta-2)">
            Acesso imediato · PDF e EPUB · Garantia de {livro.garantiaDias} dias
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[19rem] lg:order-2 lg:max-w-[24rem]">
          <div className="absolute -inset-x-6 bottom-0 h-3/4 bg-(--papel-2)" aria-hidden />
          <Image
            src={livro.capa}
            alt={livro.capaAlt}
            width={1600}
            height={2560}
            priority
            sizes="(min-width:1024px) 384px, 300px"
            className="relative h-auto w-full shadow-[0_2px_3px_rgb(0_0_0/.12),0_24px_50px_-12px_rgb(31_42_41/.45)] [transform:perspective(1400px)_rotateY(-9deg)_rotateX(1deg)] transition-transform duration-500 ease-out hover:[transform:perspective(1400px)_rotateY(-3deg)]"
          />
        </div>
      </header>

      {/* 3 · Sobre o livro */}
      <section className="border-t border-(--filete)">
        <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-8 px-5 py-16 lg:grid-cols-[1fr_1.1fr] lg:py-24">
          <Titulo>{livro.problema}</Titulo>
          <div className="space-y-5 text-pretty">
            {livro.descricao.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* 4 · O que você vai aprender */}
      <section className="border-t border-(--filete) bg-(--papel-2)">
        <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-12 px-5 py-16 lg:grid-cols-2 lg:items-start lg:py-24">
          <div>
            <Titulo>O que você vai saber fazer ao terminar</Titulo>
            <ul className="mt-8 border-b border-(--filete)">
              {livro.beneficios.map((b) => (
                <li key={b} className="flex gap-3 border-t border-(--filete) py-5 text-[1.125rem] text-pretty">
                  <Marca />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <figure className="lg:pt-3">
            <Image src={livro.percurso} alt="Cinco etapas: ideia, documentação, construção local, demonstração e produção." width={1200} height={792} className="h-auto w-full rounded-lg shadow-[0_1px_2px_rgb(0_0_0/.08),0_16px_32px_-16px_rgb(31_42_41/.35)]" />
            <figcaption className="mt-3 text-sm text-(--tinta-2)">Uma página do livro: o caminho que você percorre da ideia ao uso.</figcaption>
          </figure>
        </div>
      </section>

      {/* 5 · Para quem é / não é */}
      <section className="border-t border-(--filete)">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-2 lg:gap-0 lg:py-24">
          <div className="lg:pr-16">
            <Titulo className="text-[clamp(1.5rem,3vw,2rem)]">É para você se</Titulo>
            <ul className="mt-6 space-y-4">
              {livro.paraQuem.map((t) => (
                <li key={t} className="flex gap-3 text-pretty"><Marca />{t}</li>
              ))}
            </ul>
          </div>
          <div className="lg:border-l lg:border-(--filete) lg:pl-16">
            <Titulo className="text-[clamp(1.5rem,3vw,2rem)]">Talvez não seja para você se</Titulo>
            <ul className="mt-6 space-y-4 text-(--tinta-2)">
              {livro.naoEPara.map((t) => (
                <li key={t} className="flex gap-3 text-pretty">
                  <span aria-hidden className="mt-[0.7em] block h-px w-3.5 shrink-0 bg-(--tinta-2)" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 6 · Folheie o livro */}
      <section className="bg-(--tinta) text-(--papel)">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
          <Titulo>Folheie antes de decidir</Titulo>
          <p className="mt-3 max-w-xl text-(--papel)/70">Páginas reais do livro. Toque para ampliar.</p>
          <Folhear paginas={livro.amostras} className="mt-10 -mx-5 px-5" itemClassName="shadow-[0_18px_30px_-14px_rgb(0_0_0/.6)] outline-(--papel)" />
        </div>
      </section>

      {/* 7 · Sumário */}
      <section className="border-b border-(--filete)">
        <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-8 px-5 py-16 lg:grid-cols-[1fr_1.4fr] lg:py-24">
          <div>
            <Titulo>{livro.capitulos} capítulos, {livro.paginas} páginas</Titulo>
            <p className="mt-4 text-(--tinta-2)">Cada capítulo termina em algo que você consegue conferir.</p>
          </div>
          <ol className="divide-y divide-(--filete) border-y border-(--filete)">
            {livro.sumario.map((c, i) => (
              <li key={c} className={`flex gap-5 py-3 text-[1.0625rem] ${i > 6 ? "max-lg:hidden" : ""}`}>
                <span className="w-7 shrink-0 text-right text-(--terracota) [font-variant-numeric:tabular-nums]">{i + 1}</span>
                <span className="text-pretty">{c}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 8 · Incluído + 10 · Garantia */}
      <section className="mx-auto grid max-w-6xl gap-x-16 gap-y-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <Titulo className="text-[clamp(1.5rem,3vw,2rem)]">O que você recebe</Titulo>
          <ul className="mt-6 space-y-4">
            {livro.incluido.map((t) => (
              <li key={t} className="flex gap-3 text-pretty"><Marca />{t}</li>
            ))}
          </ul>
        </div>
        <div className="border-t-2 border-(--terracota) pt-6">
          <Titulo className="text-[clamp(1.5rem,3vw,2rem)]">Garantia de {livro.garantiaDias} dias</Titulo>
          <p className="mt-4 text-pretty text-(--tinta-2)">
            Se o livro não for o que você esperava, peça o reembolso pela própria plataforma em até {livro.garantiaDias} dias. Sem
            perguntas complicadas, e sem abrir mão dos direitos previstos em lei.
          </p>
        </div>
      </section>

      {/* 9 · Sobre o autor */}
      <section className="border-t border-(--filete) bg-(--papel-2)">
        <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-4 px-5 py-16 lg:grid-cols-[1fr_1.4fr] lg:py-20">
          <Titulo className="text-[clamp(1.5rem,3vw,2rem)]">Quem escreveu</Titulo>
          <div>
            <p className="font-(family-name:--font-display) text-2xl">{livro.autor}</p>
            <p className="mt-3 text-pretty text-(--tinta-2)">{livro.sobreAutor}</p>
          </div>
        </div>
      </section>

      {/* 11 · FAQ */}
      <section className="border-t border-(--filete)">
        <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-8 px-5 py-16 lg:grid-cols-[1fr_1.4fr] lg:py-24">
          <Titulo>Perguntas frequentes</Titulo>
          <div className="divide-y divide-(--filete) border-y border-(--filete)">
            {livro.faq.map((f) => (
              <details key={f.p} className="group py-1">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-[1.125rem] font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                  {f.p}
                  <Seta />
                </summary>
                <p className="pb-5 text-pretty text-(--tinta-2)">{f.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 12 · Bloco de compra */}
      <section id="comprar" className="bg-(--tinta) text-(--papel)">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center lg:py-28">
          <h2 className="font-(family-name:--font-display) text-[clamp(2rem,5vw,3.25rem)] leading-[1.08] font-medium text-balance">
            Comece hoje o seu primeiro sistema
          </h2>
          <p className="mt-8 text-sm text-(--papel)/60"><s>{brl(livro.precoDe)}</s> · até {fim}</p>
          <p className="font-(family-name:--font-display) text-6xl leading-tight font-medium">{brl(livro.preco)}</p>
          <p className="text-sm text-(--papel)/70">Pagamento único · acesso imediato</p>
          <Botao className="mt-8 w-full max-w-sm">Comprar na {livro.ofertas[0].plataforma}</Botao>
          <p className="mt-8 text-sm text-(--papel)/70">Prefere outra plataforma?</p>
          <a href="#comprar" className="mt-2 inline-flex min-h-12 items-center border border-(--papel)/40 px-6 font-medium transition-colors hover:border-(--papel) hover:bg-(--papel)/10">
            Comprar na {livro.ofertas[1].plataforma}
          </a>
          <p className="mx-auto mt-10 max-w-md text-xs text-(--papel)/55 text-pretty">
            Antes de comprar: computador e internet. Planos de IA, VPS e domínio são custos externos. Sem promessa de renda ou de prazo.
          </p>
        </div>
      </section>

      <footer className="px-5 py-10 text-center text-sm text-(--tinta-2)">
        <p className="font-(family-name:--font-display) text-lg text-(--tinta)">Bibliotheon</p>
        <p className="mt-1">Termos · Privacidade</p>
      </footer>

      <BarraFixa className="border-t border-(--filete) bg-(--papel)">
        <div className="flex items-center gap-4 px-5 py-3">
          <p className="font-(family-name:--font-display) text-2xl leading-none font-medium">{brl(livro.preco)}</p>
          <Botao className="ml-auto min-h-12 px-6">Comprar</Botao>
        </div>
      </BarraFixa>
    </div>
  );
}
