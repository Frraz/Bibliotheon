import { IBM_Plex_Mono, IBM_Plex_Sans, Playfair_Display } from "next/font/google";
import Image from "next/image";
import { CartaoEbookLink } from "@/components/site/cartao-ebook";
import { ABAIXO, BarraDeCompra, BlocoDeCompra, BotaoDeCompra, CompraNoMeio } from "@/components/site/compra";
import { Folhear } from "@/components/site/folhear";
import { podeVender } from "@/components/site/molde-pagina";
import { AvisoPrazo, FaixaUrgencia, PrecoAtual, PrecoDe } from "@/components/site/oferta";
import { PedirAmostra } from "@/components/site/pedir-amostra";
import type { PropsLanding } from "../registro";
import { CONFERIR, ETAPAS, PRIMEIRO_PEDIDO } from "./conteudo";

// Landing de "Crie Sistemas com IA e Ganhe Dinheiro". Identidade da capa: mesa à noite, vermelho, serifa de alto contraste.
// O elemento memorável é o primeiro pedido real à IA (capítulo 6), seguido das cinco etapas como a pilha de livros da capa.
// Cada etapa é um <details> nativo: sem JavaScript, e o conteúdo inteiro fica no HTML. Ordem do padrão de venda (docs/04, seção 6).

const titulo = Playfair_Display({ subsets: ["latin"], variable: "--font-titulo", style: ["normal", "italic"] });
const texto = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-texto-001", weight: ["400", "500", "600"] });
const codigo = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-codigo", weight: ["400", "500"] });

// As peças compartilhadas (compra, amostra, faixa) usam os tokens da marca; aqui eles recebem as cores da capa.
const CORES = {
  "--noite": "#0e0b0a",
  "--noite-2": "#17120f",
  "--papel": "#f1e8d8",
  "--papel-2": "#17120f",
  "--tinta": "#080606",
  "--tinta-2": "#c9bfae",
  "--filete": "#3a2f28",
  "--vermelho": "#f0575c",
  "--terracota": "#d6202a",
  "--terracota-escura": "#b51c24",
  "--botao-texto": "#ffffff",
} as React.CSSProperties;

const H2 = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <h2 id={id} className="max-w-[22ch] font-(family-name:--font-titulo) text-[clamp(1.75rem,4.2vw,2.875rem)] leading-[1.12] font-semibold text-balance">{children}</h2>
);
const Marca = () => (
  <svg viewBox="0 0 20 20" className="mt-[0.4em] size-[1em] shrink-0 text-(--vermelho)" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path d="m4 10.5 4 4 8-9" />
  </svg>
);

export function PaginaCriarSistemas({ e, relacionados, previa }: PropsLanding) {
  const vender = podeVender(e);
  const formatos = e.formatos.filter((f) => /pdf|epub/i.test(f)).join(" e ");
  const garantia = e.garantiaDias ? `Garantia de ${e.garantiaDias} dias` : "";

  return (
    <div style={CORES} className={`${titulo.variable} ${texto.variable} ${codigo.variable} bg-(--noite) font-(family-name:--font-texto-001) text-[1.0625rem] leading-[1.65] text-(--papel)`}>
      {vender && e.vigente.emOferta && <FaixaUrgencia className="border-b border-(--vermelho)/40 bg-(--tinta) text-(--papel)" />}

      {/* Topo */}
      <header id="topo">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-x-16 gap-y-10 px-5 pt-10 pb-14 lg:grid-cols-[1.2fr_1fr] lg:py-20">
          <div>
            <h1 className="max-w-[18ch] font-(family-name:--font-titulo) text-[clamp(2.125rem,5.4vw,3.75rem)] leading-[1.08] font-semibold text-balance">{e.headline?.trim() || e.titulo}</h1>
            {e.subtitulo && <p className="mt-6 max-w-[34rem] text-[1.1875rem] text-(--tinta-2) text-pretty">{e.subtitulo}</p>}
            {vender ? (
              <>
                <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-8">
                  <div>
                    <PrecoDe className="block text-sm text-(--tinta-2)" />
                    <PrecoAtual className="block font-(family-name:--font-titulo) text-[3rem] leading-none font-semibold" />
                    {e.parcelamento && <span className="mt-2 block text-sm text-(--tinta-2)">{e.parcelamento}</span>}
                  </div>
                  <BotaoDeCompra e={e} previa={previa} className="w-full sm:w-auto" />
                </div>
                <AvisoPrazo className="mt-4 font-medium text-(--vermelho)" />
              </>
            ) : (
              <div className="mt-8 max-w-md border-t border-(--vermelho) pt-4">
                <p className="font-(family-name:--font-titulo) text-[1.625rem] font-semibold">Em breve</p>
                <p className="mt-1 text-(--tinta-2) text-pretty">As vendas ainda não foram abertas.</p>
              </div>
            )}
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-[0.9375rem] text-(--tinta-2)">
              {formatos && <li>{formatos}</li>}
              {vender && <li>Acesso imediato</li>}
              {garantia && <li>{garantia}</li>}
            </ul>
          </div>
          {e.capa && (
            <div className="mx-auto w-full max-w-[17rem] lg:max-w-[24rem]">
              <Image src={e.capa} alt={e.capaAlt || `Capa de ${e.titulo}`} width={1600} height={2560} priority fetchPriority="high" sizes="(min-width:1024px) 384px, 272px" className="h-auto w-full shadow-[0_24px_60px_-18px_rgb(0_0_0/.9)]" />
            </div>
          )}
        </div>
      </header>

      {/* Necessidade */}
      <section className="border-t border-(--filete) bg-(--noite-2)">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
          {e.problema && <p className="max-w-[22ch] font-(family-name:--font-titulo) text-[clamp(1.75rem,4.6vw,3.25rem)] leading-[1.15] font-medium italic text-balance">“{e.problema}”</p>}
          {e.dores.length > 0 && (
            <ul className="mt-12 grid grid-cols-1 gap-x-16 border-t border-(--filete) lg:grid-cols-2">
              {e.dores.map((d) => <li key={d} className="border-b border-(--filete) py-5 text-pretty">{d}</li>)}
            </ul>
          )}
        </div>
      </section>

      {/* O primeiro pedido: a prova do método */}
      <section aria-labelledby="pedido" className="border-t border-(--filete)">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-x-16 gap-y-10 px-5 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <H2 id="pedido">Você não pede código. Pede um plano.</H2>
            <p className="mt-5 max-w-[52ch] text-(--tinta-2) text-pretty">Este é o primeiro pedido que o capítulo 6 ensina a fazer à IA, para um sistema de exemplo, a Oficina Clara, um sistema fictício de ordens de serviço. Cada linha fecha uma porta: o que entra, o que não entra e o que a IA não pode inventar.</p>
            <h3 className="mt-8 text-[1.125rem] font-semibold">Depois do pedido, você confere</h3>
            <ul className="mt-3 space-y-3">
              {CONFERIR.map((t) => <li key={t} className="flex gap-3 text-pretty"><Marca />{t}</li>)}
            </ul>
          </div>
          <figure className="min-w-0 self-start border border-(--filete) bg-(--tinta)">
            <figcaption className="flex items-center justify-between border-b border-(--filete) px-4 py-2.5 text-[0.875rem] text-(--tinta-2)">
              <span>Primeiro pedido à IA</span>
              <span aria-hidden className="size-2 rounded-full bg-(--vermelho)" />
            </figcaption>
            <pre className="overflow-x-auto px-4 py-5 font-(family-name:--font-codigo) text-[0.9375rem] leading-[1.7] whitespace-pre-wrap text-(--papel)">{PRIMEIRO_PEDIDO.join("\n")}</pre>
          </figure>
        </div>
      </section>

      {/* As cinco etapas: uma sequência de verdade */}
      <section aria-labelledby="etapas" className="border-t border-(--filete) bg-(--noite-2)">
        <div className="mx-auto max-w-4xl px-5 py-16 lg:py-24">
          <H2 id="etapas">Cinco etapas, da ideia à venda</H2>
          <p className="mt-4 max-w-[56ch] text-(--tinta-2) text-pretty">Cada etapa termina com um teste de que você terminou. Abra uma para ver o que se faz e o que fica pronto, capítulo a capítulo.</p>
          <div className="mt-10 border-t border-(--vermelho)">
            {ETAPAS.map((et, i) => (
              <details key={et.nome} name="etapa" open={i === 0} className="group border-b border-(--filete)">
                <summary className="flex min-h-[4.5rem] cursor-pointer list-none items-center gap-5 py-4 marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--vermelho) [&::-webkit-details-marker]:hidden">
                  <span aria-hidden className="w-9 shrink-0 font-(family-name:--font-titulo) text-[2rem] leading-none text-(--vermelho) [font-variant-numeric:lining-nums]">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-(family-name:--font-titulo) text-[1.5rem] leading-tight font-semibold">{et.nome}</span>
                    <span className="mt-0.5 block text-[0.9375rem] text-(--tinta-2) text-pretty">{et.resumo}</span>
                  </span>
                  <span aria-hidden className="text-[1.5rem] leading-none text-(--vermelho) group-open:hidden">+</span>
                  <span aria-hidden className="hidden text-[1.5rem] leading-none text-(--vermelho) group-open:inline">−</span>
                </summary>
                <div className="pb-8 sm:pl-14">
                  <ul className="divide-y divide-(--filete) border-y border-(--filete)">
                    {et.linhas.map((l) => (
                      <li key={l.capitulo} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-1 py-3 sm:grid-cols-[2.25rem_1fr_1fr] sm:gap-x-6">
                        <span className="text-(--vermelho) [font-variant-numeric:tabular-nums]"><span className="sr-only">Capítulo </span>{l.capitulo}</span>
                        <span className="text-pretty">{l.faz}</span>
                        <span className="col-start-2 text-(--tinta-2) text-pretty sm:col-start-3"><span className="sr-only">Fica pronto: </span>{l.pronto}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 max-w-[60ch] text-pretty"><strong className="font-semibold">Você terminou a etapa quando</strong> {et.terminou}</p>
                </div>
              </details>
            ))}
          </div>
          <CompraNoMeio e={e} previa={previa} sobreEscuro />
        </div>
      </section>

      {/* Resultado */}
      {e.beneficios.length > 0 && (
        <section className={`${ABAIXO} mx-auto max-w-6xl px-5 py-16 lg:py-24`}>
          <H2>O que você vai saber fazer</H2>
          <ul className="mt-10 grid grid-cols-1 gap-x-16 gap-y-6 lg:grid-cols-2">
            {e.beneficios.map((b) => <li key={b} className="flex gap-3 text-pretty"><Marca />{b}</li>)}
          </ul>
        </section>
      )}

      {/* Por que este caminho */}
      {e.diferenciais.length > 0 && (
        <section className={`${ABAIXO} border-t border-(--filete) bg-(--noite-2)`}>
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <H2>Por que este caminho</H2>
            <ul className="mt-10 grid grid-cols-1 gap-x-16 gap-y-8 lg:grid-cols-2">
              {e.diferenciais.map((d) => <li key={d} className="border-t border-(--vermelho) pt-4 text-pretty">{d}</li>)}
            </ul>
          </div>
        </section>
      )}

      {/* Risco: o que o livro não promete, para quem é e para quem não é */}
      <section className={`${ABAIXO} border-t border-(--filete)`}>
        <div className="mx-auto max-w-6xl px-5 pt-16 lg:pt-24">
          <H2>O que este livro não promete</H2>
          <p className="mt-5 max-w-[60ch] text-pretty">Renda, clientes ou prazo. Ganhar dinheiro depende de encontrar uma necessidade, negociar e entregar um serviço útil, e a leitura não garante contratação. O escopo é uma aplicação web pequena: sistemas clínicos, financeiros críticos, de alta escala ou com operação offline exigem conhecimento além do que o livro ensina.</p>
        </div>
        {(e.paraQuem.length > 0 || e.naoEPara.length > 0) && (
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-5 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
            {e.paraQuem.length > 0 && (
              <div>
                <h3 className="font-(family-name:--font-titulo) text-[1.75rem] font-semibold">É para você se</h3>
                <ul className="mt-6 space-y-4">{e.paraQuem.map((t) => <li key={t} className="flex gap-3 text-pretty"><Marca />{t}</li>)}</ul>
              </div>
            )}
            {e.naoEPara.length > 0 && (
              <div>
                <h3 className="font-(family-name:--font-titulo) text-[1.75rem] font-semibold">Não é para você se</h3>
                <ul className="mt-6 space-y-4 text-(--tinta-2)">
                  {e.naoEPara.map((t) => <li key={t} className="flex gap-3 text-pretty"><span aria-hidden className="mt-[0.85em] block h-px w-3.5 shrink-0 bg-(--tinta-2)" />{t}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Folheie */}
      {e.amostras.length > 0 && (
        <section id="folhear" className={`${ABAIXO} scroll-mt-4 border-t border-(--filete) bg-(--noite-2)`}>
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <H2>Folheie antes de decidir</H2>
            <p className="mt-3 max-w-xl text-(--tinta-2)">Páginas reais do livro. Toque para ampliar.</p>
            <Folhear paginas={e.amostras} className="mt-10 -mx-5 px-5" itemClassName="shadow-[0_18px_30px_-14px_rgb(0_0_0/.8)] outline-(--papel)" />
            {e.amostraPdf && <PedirAmostra slug={e.slug} />}
          </div>
        </section>
      )}

      {/* Capítulos (inteiros no HTML, recolhidos) */}
      {e.sumario.length > 0 && (
        <section className={`${ABAIXO} mx-auto max-w-4xl px-5 py-16 lg:py-24`}>
          <details className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 border-y border-(--filete) py-3 font-(family-name:--font-titulo) text-[1.5rem] font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
              Todos os capítulos
              <span aria-hidden className="text-[1.5rem] leading-none text-(--vermelho) group-open:hidden">+</span>
              <span aria-hidden className="hidden text-[1.5rem] leading-none text-(--vermelho) group-open:inline">−</span>
            </summary>
            <ol className="divide-y divide-(--filete) border-b border-(--filete)">
              {e.sumario.map((c, i) => (
                <li key={c} className="flex gap-4 py-3"><span className="w-7 shrink-0 text-right text-(--vermelho) [font-variant-numeric:tabular-nums]">{i + 1}</span><span className="text-pretty">{c}</span></li>
              ))}
            </ol>
          </details>
        </section>
      )}

      {/* Incluído e garantia */}
      {(e.incluido.length > 0 || e.garantiaDias > 0) && (
        <section className={`${ABAIXO} border-t border-(--filete)`}>
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-x-16 gap-y-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
            {e.incluido.length > 0 && (
              <div>
                <H2>O que você recebe</H2>
                <ul className="mt-6 space-y-4">{e.incluido.map((t) => <li key={t} className="flex gap-3 text-pretty"><Marca />{t}</li>)}</ul>
              </div>
            )}
            {e.garantiaDias > 0 && (
              <div>
                <H2>Garantia de {e.garantiaDias} dias</H2>
                <p className="mt-6 text-(--tinta-2) text-pretty">Se o livro não for o que você esperava, você pode pedir o reembolso pelo fluxo da própria plataforma de compra, em até {e.garantiaDias} dias, sem prejuízo dos direitos previstos em lei.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Perguntas */}
      {e.faq.length > 0 && (
        <section className={`${ABAIXO} border-t border-(--filete) bg-(--noite-2)`}>
          <div className="mx-auto max-w-3xl px-5 py-16 lg:py-24">
            <H2>Perguntas frequentes</H2>
            <div className="mt-8 border-t border-(--filete)">
              {e.faq.map((f) => (
                <details key={f.p} className="group border-b border-(--filete)">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                    {f.p}
                    <span aria-hidden className="text-[1.5rem] leading-none text-(--vermelho) group-open:hidden">+</span>
                    <span aria-hidden className="hidden text-[1.5rem] leading-none text-(--vermelho) group-open:inline">−</span>
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
          <H2>Mais sobre {e.tema?.nome.toLowerCase()}</H2>
          <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
            {relacionados.map((c) => <li key={c.slug}><CartaoEbookLink c={c} /></li>)}
          </ul>
        </section>
      )}

      <BarraDeCompra e={e} previa={previa} />
    </div>
  );
}
