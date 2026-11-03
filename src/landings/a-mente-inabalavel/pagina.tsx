import { Cinzel, Source_Serif_4 } from "next/font/google";
import Image from "next/image";
import { CartaoEbookLink } from "@/components/site/cartao-ebook";
import { ABAIXO, BarraDeCompra, BlocoDeCompra, BotaoDeCompra, CompraNoMeio } from "@/components/site/compra";
import { Folhear } from "@/components/site/folhear";
import { podeVender } from "@/components/site/molde-pagina";
import { AvisoPrazo, FaixaUrgencia, PrecoAtual, PrecoDe } from "@/components/site/oferta";
import { PedirAmostra } from "@/components/site/pedir-amostra";
import { TextoRecolhivel } from "@/components/site/texto-recolhivel";
import type { PropsLanding } from "../registro";
import { PROBLEMAS, SEMANAS } from "./conteudo";
import { SeletorDeProblemas } from "./seletor";

// Landing de "A Mente Inabalável". Identidade tirada do livro: mármore, ouro antigo, Cinzel (só em citações e títulos, como
// inscrição em pedra) e Source Serif 4. O elemento memorável é o seletor de problemas, que mostra a prática real de cada capítulo.
// Ordem do padrão de venda (docs/04, seção 6): resultado, necessidade, prova do conteúdo, por que este caminho, risco, compra.

const inscricao = Cinzel({ subsets: ["latin"], variable: "--font-inscricao", weight: ["500", "600"] });
const livro = Source_Serif_4({ subsets: ["latin"], variable: "--font-livro", axes: ["opsz"] });

// As peças compartilhadas (compra, amostra, faixa) usam os tokens da marca: aqui eles recebem as cores do livro.
const CORES = {
  "--noite": "#15110c",
  "--marmore": "#f6f1e7",
  "--ouro": "#c9962b",
  "--ouro-texto": "#7a5710",
  "--papel": "#f6f1e7",
  "--papel-2": "#eee6d5",
  "--tinta": "#15110c",
  "--tinta-2": "#574c3c",
  "--filete": "#d3c6a8",
  "--terracota": "#c9962b",
  "--terracota-escura": "#b3841f",
  "--botao-texto": "#15110c",
} as React.CSSProperties;

const Titulo = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <h2 id={id} className="max-w-[24ch] font-(family-name:--font-inscricao) text-[clamp(1.625rem,3.8vw,2.625rem)] leading-[1.18] font-medium text-balance">{children}</h2>
);
const Marca = () => (
  <svg viewBox="0 0 20 20" className="mt-[0.4em] size-[1em] shrink-0 text-(--ouro-texto)" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path d="m4 10.5 4 4 8-9" />
  </svg>
);
const paragrafos = (t: string | null) => (t ?? "").split(/(?:\r?\n){2,}/).map((p) => p.trim()).filter(Boolean);

export function PaginaAMenteInabalavel({ e, relacionados, previa }: PropsLanding) {
  const vender = podeVender(e);
  const descricao = paragrafos(e.descricao);
  const garantia = e.garantiaDias ? `Garantia de ${e.garantiaDias} dias` : "";
  const formatos = e.formatos.filter((f) => /pdf|epub/i.test(f)).join(" e ");

  return (
    <div style={CORES} className={`${inscricao.variable} ${livro.variable} bg-(--marmore) font-(family-name:--font-livro) text-[1.125rem] leading-[1.7] text-(--noite)`}>
      {vender && e.vigente.emOferta && <FaixaUrgencia className="border-b border-(--ouro)/40 bg-(--noite) text-(--marmore)" />}

      {/* Topo: resultado, preço e a capa */}
      <header id="topo" className="bg-(--noite) text-(--marmore)">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-x-16 gap-y-10 px-5 pt-10 pb-14 lg:grid-cols-[1.2fr_1fr] lg:py-20">
          <div>
            <h1 className="max-w-[20ch] text-[clamp(2rem,5vw,3.375rem)] leading-[1.1] font-semibold tracking-[-0.01em] text-balance">{e.headline?.trim() || e.titulo}</h1>
            {e.resumo && <p className="mt-6 max-w-[34rem] text-[1.1875rem] text-(--marmore)/80 text-pretty">{e.resumo}</p>}
            {vender ? (
              <>
                <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-8">
                  <div>
                    <PrecoDe className="block text-sm text-(--marmore)/70" />
                    <PrecoAtual className="block font-(family-name:--font-inscricao) text-[2.75rem] leading-none font-medium" />
                    {e.parcelamento && <span className="mt-2 block text-sm text-(--marmore)/70">{e.parcelamento}</span>}
                  </div>
                  <BotaoDeCompra e={e} previa={previa} className="w-full sm:w-auto" />
                </div>
                <AvisoPrazo className="mt-4 font-medium text-(--ouro)" />
              </>
            ) : (
              <div className="mt-8 max-w-md border-t border-(--ouro) pt-4">
                <p className="font-(family-name:--font-inscricao) text-[1.625rem] font-medium">Em breve</p>
                <p className="mt-1 text-(--marmore)/80 text-pretty">As vendas ainda não foram abertas. {e.amostras.length > 0 && <a href="#folhear" className="underline underline-offset-4 hover:text-(--ouro)">Folheie as páginas do livro.</a>}</p>
              </div>
            )}
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-[0.9375rem] text-(--marmore)/75">
              {formatos && <li>{formatos}</li>}
              {vender && <li>Acesso imediato</li>}
              {garantia && <li>{garantia}</li>}
            </ul>
          </div>
          {e.capa && (
            <div className="mx-auto w-full max-w-[17rem] lg:max-w-[24rem]">
              <Image src={e.capa} alt={e.capaAlt || `Capa de ${e.titulo}`} width={1600} height={2562} priority fetchPriority="high" sizes="(min-width:1024px) 384px, 272px" className="h-auto w-full shadow-[0_24px_60px_-18px_rgb(0_0_0/.9)]" />
            </div>
          )}
        </div>
      </header>

      {/* Necessidade: a ideia central do capítulo 1 e as cenas que o leitor reconhece */}
      <section className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
        <blockquote>
          <p className="max-w-[26ch] font-(family-name:--font-inscricao) text-[clamp(1.75rem,4.6vw,3.25rem)] leading-[1.2] font-medium text-balance">“Não são as coisas que perturbam as pessoas, mas as opiniões que elas têm sobre as coisas.”</p>
          <footer className="mt-4 text-(--tinta-2)">Epicteto, Manual 5</footer>
        </blockquote>
        <div className="mt-12 grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-[1fr_1.2fr]">
          <div className="max-w-[60ch]">
            <p className="text-[1.3125rem] leading-[1.5] font-semibold text-pretty">Você não está sofrendo só pelo que aconteceu. Está sofrendo pelo que você está dizendo a si mesmo sobre o que aconteceu.</p>
            <p className="mt-4 text-(--tinta-2) text-pretty">É um mecanismo. Se uma parte enorme da dor mora na história que você conta, e não só no fato, essa parte pode ser mudada.</p>
            {e.problema && <p className="mt-6 border-l-2 border-(--ouro) pl-4 italic text-pretty">“{e.problema}”</p>}
          </div>
          {e.dores.length > 0 && (
            <ul className="divide-y divide-(--filete) border-y border-(--filete)">
              {e.dores.map((d) => <li key={d} className="py-4 text-pretty">{d}</li>)}
            </ul>
          )}
        </div>
      </section>

      {/* O seletor: a prova do conteúdo */}
      <section aria-labelledby="pesando" className="bg-(--noite) text-(--marmore)">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
          <Titulo id="pesando">O que está pesando em você agora?</Titulo>
          <p className="mt-4 max-w-[58ch] text-(--marmore)/80 text-pretty">O livro é organizado por problema da vida, e não por filósofo. Escolha um e veja como o capítulo trabalha: a cena, a ideia clássica com a fonte e o exercício.</p>
          <SeletorDeProblemas problemas={PROBLEMAS} />
          <p className="mt-10 max-w-[60ch] text-[1rem] text-(--marmore)/75 text-pretty">Também há capítulos sobre medo da morte, pessoas difíceis, fracasso e azar, disciplina, caráter, trabalho e amor. As cenas têm personagens fictícios e as citações são paráfrases ou traduções livres, com a referência para conferir no original.</p>
          <CompraNoMeio e={e} previa={previa} sobreEscuro />
        </div>
      </section>

      {/* Resultado */}
      {e.beneficios.length > 0 && (
        <section className={`${ABAIXO} mx-auto max-w-6xl px-5 py-16 lg:py-24`}>
          <Titulo>O que você vai saber fazer</Titulo>
          <ul className="mt-10 grid grid-cols-1 gap-x-16 gap-y-6 lg:grid-cols-2">
            {e.beneficios.map((b) => <li key={b} className="flex gap-3 text-pretty"><Marca />{b}</li>)}
          </ul>
        </section>
      )}

      {/* O plano de 30 dias é uma sequência de verdade: aqui a linha do tempo informa */}
      <section className={`${ABAIXO} bg-(--papel-2)`}>
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
          <Titulo>Trinta dias não fazem de você um estoico</Titulo>
          <p className="mt-4 max-w-[58ch] text-pretty">Fazem de você alguém que experimentou o estoicismo o bastante para saber o que funciona na própria vida. Cada dia pede de 10 a 15 minutos de tarefa e de 3 a 5 minutos de exame à noite.</p>
          <ol className="mt-10 grid grid-cols-1 gap-x-8 gap-y-8 border-(--ouro-texto) sm:grid-cols-2 lg:grid-cols-4 lg:border-t lg:pt-6">
            {SEMANAS.map((s, i) => (
              <li key={s.titulo} className="border-l border-(--ouro-texto) pl-4 lg:border-l-0 lg:pl-0">
                <p className="text-[0.9375rem] text-(--ouro-texto)">Semana {i + 1}</p>
                <h3 className="mt-1 text-[1.25rem] leading-snug font-semibold text-balance">{s.titulo}</h3>
                <p className="mt-2 text-[1rem] text-(--tinta-2) text-pretty">{s.objetivo}</p>
              </li>
            ))}
          </ol>
          <p className="mt-10 max-w-[60ch] text-pretty">Se perder um dia, não recomece: a regra é nunca falhar duas vezes seguidas. O último capítulo se chama <strong className="font-semibold">Quando você falhar (e vai)</strong>, porque quem desiste na primeira falha nunca chega à segunda fase.</p>
        </div>
      </section>

      {/* Por que este caminho */}
      {e.diferenciais.length > 0 && (
        <section className={`${ABAIXO} mx-auto max-w-6xl px-5 py-16 lg:py-24`}>
          <Titulo>Por que este caminho</Titulo>
          <ul className="mt-10 grid grid-cols-1 gap-x-16 gap-y-8 lg:grid-cols-2">
            {e.diferenciais.map((d) => <li key={d} className="border-t border-(--ouro-texto) pt-4 text-pretty">{d}</li>)}
          </ul>
          {descricao.length > 0 && (
            <div className="mt-14 max-w-[64ch]">
              <h3 className="text-[1.3125rem] font-semibold">Sobre o livro</h3>
              <div style={{ "--terracota-escura": "#7a5710" } as React.CSSProperties} className="mt-3 text-(--tinta-2)"><TextoRecolhivel paragrafos={descricao} /></div>
            </div>
          )}
        </section>
      )}

      {/* Risco: para quem é e para quem não é */}
      {(e.paraQuem.length > 0 || e.naoEPara.length > 0) && (
        <section className={`${ABAIXO} border-t border-(--filete)`}>
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-5 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
            {e.paraQuem.length > 0 && (
              <div>
                <Titulo>É para você se</Titulo>
                <ul className="mt-6 space-y-4">{e.paraQuem.map((t) => <li key={t} className="flex gap-3 text-pretty"><Marca />{t}</li>)}</ul>
              </div>
            )}
            {e.naoEPara.length > 0 && (
              <div>
                <Titulo>Não é para você se</Titulo>
                <ul className="mt-6 space-y-4 text-(--tinta-2)">
                  {e.naoEPara.map((t) => (
                    <li key={t} className="flex gap-3 text-pretty"><span aria-hidden className="mt-[0.8em] block h-px w-3.5 shrink-0 bg-(--tinta-2)" />{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mx-auto max-w-6xl px-5 pb-16 lg:pb-24">
            <p className="max-w-[64ch] border-l-2 border-(--ouro-texto) pl-4 text-pretty">Este livro é filosofia prática, não terapia. Quando o tema pede ajuda profissional, o texto diz isso com clareza. Em crise, ligue para o CVV: 188.</p>
          </div>
        </section>
      )}

      {/* Folheie */}
      {e.amostras.length > 0 && (
        <section id="folhear" className={`${ABAIXO} scroll-mt-4 bg-(--noite) text-(--marmore)`}>
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <Titulo>Folheie antes de decidir</Titulo>
            <p className="mt-3 max-w-xl text-(--marmore)/75">Páginas reais do livro. Toque para ampliar.</p>
            <Folhear paginas={e.amostras} className="mt-10 -mx-5 px-5" itemClassName="shadow-[0_18px_30px_-14px_rgb(0_0_0/.6)] outline-(--marmore)" />
            {e.amostraPdf && <PedirAmostra slug={e.slug} />}
          </div>
        </section>
      )}

      {/* Sumário */}
      {e.sumario.length > 0 && (
        <section className={`${ABAIXO} mx-auto max-w-6xl px-5 py-16 lg:py-24`}>
          <Titulo>O que há no livro</Titulo>
          <ul className="mt-10 grid grid-cols-1 gap-x-16 lg:grid-cols-2">
            {e.sumario.slice(0, 8).map((c) => <li key={c} className="border-b border-(--filete) py-3 text-pretty">{c}</li>)}
            {e.sumario.slice(8).map((c) => <li key={c} className="border-b border-(--filete) py-3 text-pretty max-lg:hidden">{c}</li>)}
          </ul>
          {e.sumario.length > 8 && (
            <details className="group lg:hidden">
              <summary className="mt-4 inline-flex min-h-11 cursor-pointer list-none items-center font-medium text-(--ouro-texto) underline underline-offset-4 marker:content-none group-open:hidden [&::-webkit-details-marker]:hidden">Ver todos os {e.sumario.length}</summary>
              <ul>{e.sumario.slice(8).map((c) => <li key={c} className="border-b border-(--filete) py-3 text-pretty">{c}</li>)}</ul>
            </details>
          )}
        </section>
      )}

      {/* Incluído e garantia */}
      {(e.incluido.length > 0 || e.garantiaDias > 0) && (
        <section className={`${ABAIXO} border-t border-(--filete)`}>
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-x-16 gap-y-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
            {e.incluido.length > 0 && (
              <div>
                <Titulo>O que você recebe</Titulo>
                <ul className="mt-6 space-y-4">{e.incluido.map((t) => <li key={t} className="flex gap-3 text-pretty"><Marca />{t}</li>)}</ul>
              </div>
            )}
            {e.garantiaDias > 0 && (
              <div>
                <Titulo>Garantia de {e.garantiaDias} dias</Titulo>
                <p className="mt-6 text-(--tinta-2) text-pretty">Se o livro não for o que você esperava, você pode pedir o reembolso pelo fluxo da própria plataforma de compra, em até {e.garantiaDias} dias, sem prejuízo dos direitos previstos em lei.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Perguntas */}
      {e.faq.length > 0 && (
        <section className={`${ABAIXO} bg-(--papel-2)`}>
          <div className="mx-auto max-w-3xl px-5 py-16 lg:py-24">
            <Titulo>Perguntas frequentes</Titulo>
            <div className="mt-8 border-t border-(--filete)">
              {e.faq.map((f) => (
                <details key={f.p} className="group border-b border-(--filete)">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                    {f.p}
                    <span aria-hidden className="text-[1.5rem] leading-none text-(--ouro-texto) group-open:hidden">+</span>
                    <span aria-hidden className="hidden text-[1.5rem] leading-none text-(--ouro-texto) group-open:inline">−</span>
                  </summary>
                  <p className="pb-5 text-(--tinta-2) text-pretty">{f.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <BlocoDeCompra e={e} previa={previa} />

      {relacionados.length > 0 && (
        <section className={`${ABAIXO} mx-auto max-w-6xl px-5 py-16 lg:py-24`}>
          <Titulo>Mais sobre {e.tema?.nome.toLowerCase()}</Titulo>
          <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
            {relacionados.map((c) => <li key={c.slug}><CartaoEbookLink c={c} /></li>)}
          </ul>
        </section>
      )}

      <BarraDeCompra e={e} previa={previa} />
    </div>
  );
}
