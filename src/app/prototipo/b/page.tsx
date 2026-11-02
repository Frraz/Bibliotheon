import Image from "next/image";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { BarraFixa } from "@/components/prototipo/barra-fixa";
import { Contagem } from "@/components/prototipo/contagem";
import { Folhear } from "@/components/prototipo/folhear";
import { brl, livro } from "@/lib/prototipo";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", axes: ["opsz", "wdth"] });
const texto = Figtree({ subsets: ["latin"], variable: "--font-texto" });

// Direção B — Oficina. As três cores da capa invertidas sobre fundo escuro.
const tema = {
  "--fundo": "#0F1918",
  "--superficie": "#172524",
  "--superficie-2": "#1E302E",
  "--texto": "#F1EADB",
  "--texto-2": "#A4B5AD",
  "--terracota": "#E2683F",
  "--terracota-escura": "#C9552F",
  "--salvia": "#86AB9B",
  "--linha": "rgb(241 234 219 / 0.11)",
} as React.CSSProperties;

const grade =
  "[background-image:linear-gradient(var(--linha)_1px,transparent_1px),linear-gradient(90deg,var(--linha)_1px,transparent_1px)] [background-size:56px_56px]";

const Seta = () => (
  <svg viewBox="0 0 20 20" className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-45" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <path d="M10 4v12M4 10h12" />
  </svg>
);
const Ok = () => (
  <span className="mt-[0.2em] grid size-5 shrink-0 place-items-center rounded-full bg-(--salvia)/20 text-(--salvia)" aria-hidden>
    <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
  </span>
);
const Nao = () => (
  <span className="mt-[0.2em] grid size-5 shrink-0 place-items-center rounded-full bg-(--texto)/10 text-(--texto-2)" aria-hidden>
    <svg viewBox="0 0 20 20" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m5 5 10 10M15 5 5 15" /></svg>
  </span>
);

function Botao({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <a
      href="#comprar"
      className={`inline-flex min-h-14 items-center justify-center rounded-xl bg-(--terracota) px-8 text-[1.0625rem] font-bold text-[#1a0d08] shadow-[0_0_0_1px_rgb(255_255_255/.12)_inset,0_14px_30px_-12px_var(--terracota)] transition-[background-color,transform] duration-150 hover:bg-[#f07a52] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--terracota) ${className}`}
    >
      {children}
    </a>
  );
}

const H2 = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`font-(family-name:--font-display) text-[clamp(1.9rem,4.6vw,3rem)] leading-[1.05] font-bold tracking-[-0.025em] text-balance ${className}`}>
    {children}
  </h2>
);

const fases = [
  { nome: "Começar", faixa: [0, 4] },
  { nome: "Construir", faixa: [4, 12] },
  { nome: "Publicar", faixa: [12, 18] },
  { nome: "Vender", faixa: [18, 22] },
] as const;

export default function DirecaoB() {
  const d = new Date(livro.ofertaAte);
  const fimCurto = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  return (
    <div
      style={tema}
      className={`${display.variable} ${texto.variable} bg-(--fundo) font-(family-name:--font-texto) text-[1.0625rem] leading-[1.6] text-(--texto)`}
    >
      {/* 1 · Hero */}
      <header id="topo" className="relative isolate overflow-hidden">
        <div aria-hidden className={`absolute inset-0 -z-10 ${grade} [mask-image:linear-gradient(to_bottom,black,transparent_85%)]`} />

        {/* 2 · Faixa de urgência */}
        <div className="mx-auto mt-5 flex w-fit max-w-[calc(100%-2.5rem)] items-center gap-3 rounded-full border border-(--linha) bg-(--superficie) py-1.5 pr-4 pl-3 text-sm">
          <span className="size-2 rounded-full bg-(--terracota)" aria-hidden />
          <span className="text-(--texto-2)">
            Lançamento até <span className="whitespace-nowrap text-(--texto)">{fimCurto}</span>
            <span className="mx-2 opacity-40" aria-hidden>|</span>
            <Contagem ate={livro.ofertaAte} className="whitespace-nowrap font-semibold text-(--texto)" />
          </span>
        </div>

        <div className="mx-auto max-w-5xl px-5 pt-10 text-center lg:pt-16">
          <h1 className="font-(family-name:--font-display) text-[clamp(2.5rem,8vw,5.5rem)] leading-[0.98] font-extrabold tracking-[-0.035em] text-balance [font-variation-settings:'wdth'_92]">
            {livro.headline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[1.1875rem] text-(--texto-2) text-pretty">{livro.subtitulo}</p>

          <div className="mt-9 flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
            <Botao className="w-full sm:w-auto">Quero o livro na {livro.ofertas[0].plataforma}</Botao>
            <p className="flex items-baseline gap-3">
              <span className="font-(family-name:--font-display) text-4xl font-bold">{brl(livro.preco)}</span>
              <s className="text-(--texto-2)">{brl(livro.precoDe)}</s>
            </p>
          </div>
          <p className="mt-4 text-sm text-(--texto-2)">Acesso imediato · PDF e EPUB · Garantia de {livro.garantiaDias} dias</p>
        </div>

        <div className="relative mx-auto mt-14 mb-[-3.5rem] w-[15rem] sm:w-[18rem] lg:w-[21rem]">
          <Image
            src={livro.capa}
            alt={livro.capaAlt}
            width={1600}
            height={2560}
            priority
            sizes="(min-width:1024px) 336px, 288px"
            className="h-auto w-full rounded-[3px] shadow-[0_0_0_1px_rgb(255_255_255/.1),0_40px_80px_-20px_rgb(0_0_0/.8)] [transform:perspective(1500px)_rotateX(6deg)]"
          />
          <ul className="absolute top-8 -left-6 hidden flex-col gap-3 text-sm lg:flex lg:-left-44">
            <li className="rounded-lg border border-(--linha) bg-(--superficie)/90 px-4 py-2.5"><b className="font-(family-name:--font-display) text-xl">{livro.paginas}</b> páginas</li>
            <li className="rounded-lg border border-(--linha) bg-(--superficie)/90 px-4 py-2.5"><b className="font-(family-name:--font-display) text-xl">{livro.capitulos}</b> capítulos</li>
          </ul>
          <ul className="absolute top-8 -right-6 hidden flex-col gap-3 text-sm lg:flex lg:-right-44">
            <li className="rounded-lg border border-(--linha) bg-(--superficie)/90 px-4 py-2.5">PDF e EPUB</li>
            <li className="rounded-lg border border-(--linha) bg-(--superficie)/90 px-4 py-2.5">Caderno de prática</li>
          </ul>
        </div>
      </header>

      {/* 3 · Sobre o livro */}
      <section className="bg-(--superficie) pt-24 lg:pt-32">
        <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-8 px-5 pb-16 lg:grid-cols-2 lg:pb-24">
          <H2>{livro.problema}</H2>
          <div className="space-y-5 text-(--texto-2) text-pretty">
            {livro.descricao.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* 4 · O que você vai aprender */}
      <section className="bg-(--superficie)">
        <div className="mx-auto max-w-6xl px-5 pb-16 lg:pb-24">
          <div className="grid gap-4 lg:grid-cols-3 lg:grid-rows-[repeat(2,minmax(0,1fr))_auto]">
            <div className="rounded-2xl border border-(--linha) bg-(--fundo) p-6 lg:col-span-2 lg:row-span-2 lg:p-8">
              <p className="text-sm font-semibold text-(--salvia)">O percurso do livro</p>
              <Image src={livro.percurso} alt="Cinco etapas: ideia, documentação, construção local, demonstração e produção." width={1200} height={792} className="mt-5 h-auto w-full max-w-xl rounded-lg" />
            </div>
            {livro.beneficios.map((b, i) => (
              <div key={b} className={`rounded-2xl border p-6 ${i === 4 ? "border-(--terracota)/50 bg-(--terracota)/10" : "border-(--linha) bg-(--fundo)"}`}>
                <Ok />
                <p className="mt-4 text-[1.0625rem] font-medium text-pretty">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 · Para quem é / não é */}
      <section>
        <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <H2 className="text-[clamp(1.5rem,3vw,2.1rem)]">É para você se</H2>
            <ul className="mt-6 space-y-4">
              {livro.paraQuem.map((t) => (<li key={t} className="flex gap-3 text-pretty"><Ok />{t}</li>))}
            </ul>
          </div>
          <div>
            <H2 className="text-[clamp(1.5rem,3vw,2.1rem)]">Talvez não seja para você se</H2>
            <ul className="mt-6 space-y-4 text-(--texto-2)">
              {livro.naoEPara.map((t) => (<li key={t} className="flex gap-3 text-pretty"><Nao />{t}</li>))}
            </ul>
          </div>
        </div>
      </section>

      {/* 6 · Folheie o livro */}
      <section className="border-y border-(--linha) bg-(--superficie)">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
          <H2>Folheie antes de decidir</H2>
          <p className="mt-3 text-(--texto-2)">Páginas reais do livro. Toque para ampliar.</p>
          <Folhear paginas={livro.amostras} className="mt-10 -mx-5 px-5" itemClassName="rounded-sm ring-1 ring-white/10 shadow-[0_24px_40px_-18px_rgb(0_0_0/.8)] outline-(--terracota)" />
        </div>
      </section>

      {/* 7 · Sumário */}
      <section>
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
          <H2>{livro.capitulos} capítulos em quatro fases</H2>
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {fases.map((f) => (
              <div key={f.nome}>
                <p className="border-b border-(--terracota) pb-2 font-(family-name:--font-display) text-xl font-bold">{f.nome}</p>
                <ol className="mt-3 space-y-2.5 text-[0.9375rem] text-(--texto-2)">
                  {livro.sumario.slice(f.faixa[0], f.faixa[1]).map((c, i) => (
                    <li key={c} className="flex gap-3">
                      <span className="w-5 shrink-0 text-right font-semibold text-(--salvia) [font-variant-numeric:tabular-nums]">{f.faixa[0] + i + 1}</span>
                      <span className="text-pretty">{c}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8 · Incluído + 10 · Garantia + 9 · Autor */}
      <section className="bg-(--superficie)">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-16 lg:grid-cols-3 lg:py-24">
          <div className="rounded-2xl border border-(--linha) bg-(--fundo) p-7">
            <p className="font-(family-name:--font-display) text-2xl font-bold">O que você recebe</p>
            <ul className="mt-5 space-y-3.5">
              {livro.incluido.map((t) => (<li key={t} className="flex gap-3 text-pretty"><Ok />{t}</li>))}
            </ul>
          </div>
          <div className="rounded-2xl border border-(--linha) bg-(--fundo) p-7">
            <p className="font-(family-name:--font-display) text-2xl font-bold">Garantia de {livro.garantiaDias} dias</p>
            <p className="mt-4 text-(--texto-2) text-pretty">
              Se o livro não for o que você esperava, peça o reembolso pela própria plataforma em até {livro.garantiaDias} dias, sem abrir mão dos direitos previstos em lei.
            </p>
          </div>
          <div className="rounded-2xl border border-(--linha) bg-(--fundo) p-7">
            <p className="font-(family-name:--font-display) text-2xl font-bold">{livro.autor}</p>
            <p className="mt-4 text-(--texto-2) text-pretty">{livro.sobreAutor}</p>
          </div>
        </div>
      </section>

      {/* 11 · FAQ */}
      <section>
        <div className="mx-auto max-w-3xl px-5 py-16 lg:py-24">
          <H2>Perguntas frequentes</H2>
          <div className="mt-8 divide-y divide-(--linha) border-y border-(--linha)">
            {livro.faq.map((f) => (
              <details key={f.p} className="group">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 text-[1.125rem] font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                  {f.p}
                  <Seta />
                </summary>
                <p className="pb-6 text-(--texto-2) text-pretty">{f.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 12 · Bloco de compra */}
      <section id="comprar" className={`relative isolate overflow-hidden border-t border-(--linha) bg-(--superficie)`}>
        <div aria-hidden className={`absolute inset-0 -z-10 ${grade} [mask-image:linear-gradient(to_top,black,transparent_80%)]`} />
        <div className="mx-auto max-w-3xl px-5 py-20 text-center lg:py-28">
          <H2 className="text-[clamp(2.1rem,5.5vw,3.5rem)]">Seu primeiro sistema começa aqui</H2>
          <p className="mt-8 flex items-baseline justify-center gap-3">
            <span className="font-(family-name:--font-display) text-6xl font-extrabold tracking-tight">{brl(livro.preco)}</span>
            <s className="text-(--texto-2)">{brl(livro.precoDe)}</s>
          </p>
          <p className="mt-1 text-sm text-(--texto-2)">Pagamento único · acesso imediato · até {fimCurto}</p>
          <Botao className="mt-8 w-full max-w-sm">Comprar na {livro.ofertas[0].plataforma}</Botao>
          <p className="mt-7 text-sm text-(--texto-2)">Prefere outra plataforma?</p>
          <a href="#comprar" className="mt-2 inline-flex min-h-12 items-center rounded-xl border border-(--linha) px-6 font-semibold transition-colors hover:bg-(--superficie-2)">
            Comprar na {livro.ofertas[1].plataforma}
          </a>
          <p className="mx-auto mt-10 max-w-md text-xs text-(--texto-2)/80 text-pretty">
            Antes de comprar: computador e internet. Planos de IA, VPS e domínio são custos externos. Sem promessa de renda ou de prazo.
          </p>
        </div>
      </section>

      <footer className="px-5 py-10 text-center text-sm text-(--texto-2)">
        <p className="font-(family-name:--font-display) text-lg font-bold text-(--texto)">Bibliotheon</p>
        <p className="mt-1">Termos · Privacidade</p>
      </footer>

      <BarraFixa className="border-t border-(--linha) bg-(--superficie)/95 backdrop-blur">
        <div className="flex items-center gap-4 px-5 py-3">
          <p className="font-(family-name:--font-display) text-2xl leading-none font-bold">{brl(livro.preco)}</p>
          <Botao className="ml-auto min-h-12 px-6">Comprar</Botao>
        </div>
      </BarraFixa>
    </div>
  );
}
