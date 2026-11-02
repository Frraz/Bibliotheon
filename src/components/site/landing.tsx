import Image from "next/image";
import type { CartaoEbook, EbookPublico } from "@/lib/catalogo";
import { jsonLdDoEbook, serializarJsonLd } from "@/lib/jsonld";
import { rotuloOferta } from "@/lib/ofertas";
import { brl } from "@/lib/preco";
import { BarraFixa } from "./barra-fixa";
import { CartaoEbookLink } from "./cartao-ebook";
import { Folhear } from "./folhear";
import { LinkOferta } from "./link-oferta";
import { FaixaUrgencia, OfertaProvider, PrazoOferta, PrecoAtual, PrecoDe } from "./oferta";
import { Visita } from "./rastreio";

// Landing do e-book (direção A · Livraria). Cada seção só aparece se houver conteúdo; nada de texto de enchimento.

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

const BOTAO =
  "inline-flex min-h-14 items-center justify-center bg-(--terracota) px-8 text-[1.0625rem] font-semibold text-(--papel) shadow-[0_1px_0_rgb(0_0_0/.15),0_10px_20px_-12px_rgb(0_0_0/.55)] transition-[background-color,transform] duration-150 hover:bg-(--terracota-escura) active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--terracota)";

// Seções abaixo da dobra: o navegador só calcula estilo e layout delas quando chegam perto da tela (LCP no celular).
const ABAIXO = "[content-visibility:auto] [contain-intrinsic-size:auto_640px]";

const Titulo = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`font-(family-name:--font-display) text-[clamp(1.75rem,4.2vw,2.75rem)] leading-[1.1] font-medium tracking-[-0.01em] text-balance ${className}`}>{children}</h2>
);
const TituloMenor = ({ children }: { children: React.ReactNode }) => <Titulo className="text-[clamp(1.5rem,3vw,2rem)]">{children}</Titulo>;

const paragrafos = (t: string | null) => (t ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

export function Landing({ e, relacionados }: { e: EbookPublico; relacionados: CartaoEbook[] }) {
  const principal = e.ofertas.find((o) => o.principal) ?? e.ofertas[0];
  const outras = e.ofertas.filter((o) => o !== principal);
  const vender = !e.emBreve && !!principal;
  const headline = e.headline?.trim() || e.titulo;
  const dadosOferta = { preco: e.preco, precoDe: e.precoDe, ofertaAte: e.ofertaAte, emBreve: !vender, inicial: e.vigente };
  const cta = (classe: string, texto?: string) =>
    principal && (
      <LinkOferta ofertaId={principal.id} titulo={e.titulo} valor={e.vigente.valor} className={`${BOTAO} ${classe}`}>
        {texto ?? rotuloOferta(principal)}
      </LinkOferta>
    );

  return (
    <OfertaProvider dados={dadosOferta}>
      <div className="bg-(--papel) font-(family-name:--font-texto) text-[1.0625rem] leading-[1.65] text-(--tinta)">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdDoEbook(e)) }} />
        <Visita slug={e.slug} titulo={e.titulo} valor={e.vigente.valor} />

        {vender && e.vigente.emOferta && <FaixaUrgencia className="bg-(--tinta) text-(--papel)" />}

        {/* Hero */}
        <header id="topo" className="mx-auto grid max-w-6xl gap-x-16 gap-y-10 px-5 pt-10 pb-16 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:py-24">
          <div>
            {e.autorExibido && <p className="mb-5 text-sm font-medium text-(--salvia)">E-book · {e.autorExibido}</p>}
            <h1 className="font-(family-name:--font-display) text-[clamp(2.3rem,6.4vw,3.9rem)] leading-[1.04] font-medium tracking-[-0.02em] text-balance">{headline}</h1>
            {e.subtitulo && <p className="mt-6 max-w-[34rem] text-[1.1875rem] text-(--tinta-2) text-pretty">{e.subtitulo}</p>}

            {vender ? (
              <>
                <div className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-5">
                  <div>
                    <PrecoDe className="block text-sm text-(--tinta-2)" />
                    <PrecoAtual className="block font-(family-name:--font-display) text-5xl leading-none font-medium" />
                  </div>
                  {cta("")}
                </div>
                <p className="mt-5 text-sm text-(--tinta-2)">
                  {[`Acesso imediato`, e.formatos.length ? e.formatos.filter((f) => /pdf|epub/i.test(f)).join(" e ") : "", e.garantiaDias ? `Garantia de ${e.garantiaDias} dias` : ""].filter(Boolean).join(" · ")}
                  {outras.length > 0 && (
                    <>
                      {" · "}
                      <a href="#comprar" className="underline underline-offset-4">outras formas de comprar</a>
                    </>
                  )}
                </p>
              </>
            ) : (
              <div className="mt-8 max-w-md border-t-2 border-(--terracota) pt-4">
                <p className="font-(family-name:--font-display) text-2xl font-medium">Em breve</p>
                <p className="mt-1 text-(--tinta-2)">Estamos preparando a abertura das vendas deste livro.</p>
              </div>
            )}
          </div>

          {e.capa && (
            <div className="relative mx-auto w-full max-w-[19rem] lg:max-w-[24rem]">
              <div className="absolute -inset-x-6 bottom-0 h-3/4 bg-(--papel-2)" aria-hidden />
              <Image
                src={e.capa}
                alt={e.capaAlt || `Capa de ${e.titulo}`}
                width={1600}
                height={2560}
                priority
                fetchPriority="high"
                sizes="(min-width:1024px) 384px, 300px"
                className="relative h-auto w-full shadow-[0_2px_3px_rgb(0_0_0/.12),0_24px_50px_-12px_rgb(31_42_41/.45)] [transform:perspective(1400px)_rotateY(-9deg)_rotateX(1deg)] transition-transform duration-500 ease-out hover:[transform:perspective(1400px)_rotateY(-3deg)]"
              />
            </div>
          )}
        </header>

        {/* Sobre o livro */}
        {(e.problema || e.descricao) && (
          <section className={`${ABAIXO} border-t border-(--filete)`}>
            <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-8 px-5 py-16 lg:grid-cols-[1fr_1.1fr] lg:py-24">
              {e.problema ? <Titulo>{e.problema}</Titulo> : <span />}
              <div className="space-y-5 text-pretty">
                {paragrafos(e.descricao).map((p) => (
                  <p key={p.slice(0, 32)}>{p}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* O que você vai aprender */}
        {e.beneficios.length > 0 && (
          <section className={`${ABAIXO} border-t border-(--filete) bg-(--papel-2)`}>
            <div className={`mx-auto grid max-w-6xl gap-x-16 gap-y-12 px-5 py-16 lg:py-24 ${e.figura ? "lg:grid-cols-2 lg:items-start" : ""}`}>
              <div>
                <Titulo>O que você vai saber fazer ao terminar</Titulo>
                <ul className="mt-8 border-b border-(--filete)">
                  {e.beneficios.map((b) => (
                    <li key={b} className="flex gap-3 border-t border-(--filete) py-5 text-[1.125rem] text-pretty">
                      <Marca />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {e.figura && (
                <figure className="lg:pt-3">
                  <Image src={e.figura.src} alt={e.figura.alt} width={1200} height={792} sizes="(min-width:1024px) 560px, 92vw" className="h-auto w-full rounded-lg shadow-[0_1px_2px_rgb(0_0_0/.08),0_16px_32px_-16px_rgb(31_42_41/.35)]" />
                  {e.figura.legenda && <figcaption className="mt-3 text-sm text-(--tinta-2)">{e.figura.legenda}</figcaption>}
                </figure>
              )}
            </div>
          </section>
        )}

        {/* Para quem é / não é */}
        {(e.paraQuem.length > 0 || e.naoEPara.length > 0) && (
          <section className={`${ABAIXO} border-t border-(--filete)`}>
            <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-2 lg:gap-0 lg:py-24">
              {e.paraQuem.length > 0 && (
                <div className="lg:pr-16">
                  <TituloMenor>É para você se</TituloMenor>
                  <ul className="mt-6 space-y-4">
                    {e.paraQuem.map((t) => (
                      <li key={t} className="flex gap-3 text-pretty"><Marca />{t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {e.naoEPara.length > 0 && (
                <div className={e.paraQuem.length > 0 ? "lg:border-l lg:border-(--filete) lg:pl-16" : ""}>
                  <TituloMenor>Talvez não seja para você se</TituloMenor>
                  <ul className="mt-6 space-y-4 text-(--tinta-2)">
                    {e.naoEPara.map((t) => (
                      <li key={t} className="flex gap-3 text-pretty">
                        <span aria-hidden className="mt-[0.7em] block h-px w-3.5 shrink-0 bg-(--tinta-2)" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Folheie o livro */}
        {e.amostras.length > 0 && (
          <section className={`${ABAIXO} bg-(--tinta) text-(--papel)`}>
            <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
              <Titulo>Folheie antes de decidir</Titulo>
              <p className="mt-3 max-w-xl text-(--papel)/70">Páginas reais do livro. Toque para ampliar.</p>
              <Folhear paginas={e.amostras} className="mt-10 -mx-5 px-5" itemClassName="shadow-[0_18px_30px_-14px_rgb(0_0_0/.6)] outline-(--papel)" />
              {e.amostraPdf && (
                <a href={e.amostraPdf} className="mt-6 inline-flex min-h-12 items-center border border-(--papel)/40 px-6 font-medium transition-colors hover:border-(--papel) hover:bg-(--papel)/10">
                  Baixar amostra grátis (PDF)
                </a>
              )}
            </div>
          </section>
        )}

        {/* Sumário */}
        {e.sumario.length > 0 && (
          <section className={`${ABAIXO} border-b border-(--filete)`}>
            <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-8 px-5 py-16 lg:grid-cols-[1fr_1.4fr] lg:py-24">
              <Titulo>{e.sumario.length} capítulos</Titulo>
              <ol className="divide-y divide-(--filete) border-y border-(--filete)">
                {e.sumario.map((c, i) => (
                  <li key={c} className={`flex gap-5 py-3 text-[1.0625rem] ${i > 6 ? "max-lg:hidden" : ""}`}>
                    <span className="w-7 shrink-0 text-right text-(--terracota) [font-variant-numeric:tabular-nums]">{i + 1}</span>
                    <span className="text-pretty">{c}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {/* Incluído + garantia */}
        {(e.incluido.length > 0 || e.garantiaDias > 0) && (
          <section className={`${ABAIXO} mx-auto grid max-w-6xl gap-x-16 gap-y-12 px-5 py-16 lg:grid-cols-2 lg:py-24`}>
            {e.incluido.length > 0 && (
              <div>
                <TituloMenor>O que você recebe</TituloMenor>
                <ul className="mt-6 space-y-4">
                  {e.incluido.map((t) => (
                    <li key={t} className="flex gap-3 text-pretty"><Marca />{t}</li>
                  ))}
                </ul>
              </div>
            )}
            {e.garantiaDias > 0 && (
              <div className="border-t-2 border-(--terracota) pt-6">
                <TituloMenor>Garantia de {e.garantiaDias} dias</TituloMenor>
                <p className="mt-4 text-pretty text-(--tinta-2)">
                  Se o livro não for o que você esperava, você pode pedir o reembolso pelo fluxo da própria plataforma de compra, em até {e.garantiaDias} dias, sem prejuízo dos direitos previstos em lei.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Sobre o autor */}
        {e.sobreAutor && (
          <section className={`${ABAIXO} border-t border-(--filete) bg-(--papel-2)`}>
            <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-4 px-5 py-16 lg:grid-cols-[1fr_1.4fr] lg:py-20">
              <TituloMenor>Quem escreveu</TituloMenor>
              <div>
                {e.autorExibido && <p className="font-(family-name:--font-display) text-2xl">{e.autorExibido}</p>}
                <p className="mt-3 text-pretty text-(--tinta-2)">{e.sobreAutor}</p>
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        {e.faq.length > 0 && (
          <section className={`${ABAIXO} border-t border-(--filete)`}>
            <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-8 px-5 py-16 lg:grid-cols-[1fr_1.4fr] lg:py-24">
              <Titulo>Perguntas frequentes</Titulo>
              <div className="divide-y divide-(--filete) border-y border-(--filete)">
                {e.faq.map((f) => (
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
        )}

        {/* Bloco de compra */}
        <section id="comprar" className={`${ABAIXO} bg-(--tinta) text-(--papel)`}>
          <div className="mx-auto max-w-3xl px-5 py-20 text-center lg:py-28">
            <h2 className="font-(family-name:--font-display) text-[clamp(2rem,5vw,3.25rem)] leading-[1.08] font-medium text-balance">
              {vender ? "Pronto para começar?" : "Em breve"}
            </h2>
            {vender && principal ? (
              <>
                <p className="mt-8 text-sm text-(--papel)/60">
                  <PrecoDe /> <PrazoOferta />
                </p>
                <PrecoAtual className="block font-(family-name:--font-display) text-6xl leading-tight font-medium" />
                <p className="text-sm text-(--papel)/70">Pagamento único · acesso imediato</p>
                {cta("mt-8 w-full max-w-sm")}
                {outras.length > 0 && (
                  <>
                    <p className="mt-8 text-sm text-(--papel)/70">Prefere outra plataforma?</p>
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                      {outras.map((o) => (
                        <LinkOferta key={o.id} ofertaId={o.id} titulo={e.titulo} valor={o.preco ?? e.vigente.valor} className="inline-flex min-h-12 items-center border border-(--papel)/40 px-6 font-medium transition-colors hover:border-(--papel) hover:bg-(--papel)/10">
                          {rotuloOferta(o)}{o.preco != null && o.preco !== e.vigente.valor ? ` · ${brl(o.preco)}` : ""}
                        </LinkOferta>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="mx-auto mt-6 max-w-md text-(--papel)/75 text-pretty">As vendas deste livro ainda não foram abertas. Volte em breve.</p>
            )}
            {paragrafos(e.observacoes).length > 0 && (
              <div className="mx-auto mt-10 max-w-md space-y-2 text-xs text-(--papel)/60 text-pretty">
                <p className="font-medium text-(--papel)/75">Antes de comprar</p>
                {paragrafos(e.observacoes).map((p) => (
                  <p key={p.slice(0, 32)}>{p}</p>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Mais do tema */}
        {relacionados.length > 0 && (
          <section className={`${ABAIXO} border-t border-(--filete)`}>
            <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
              <TituloMenor>Mais sobre {e.tema?.nome.toLowerCase()}</TituloMenor>
              <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
                {relacionados.map((c) => (
                  <li key={c.slug}><CartaoEbookLink c={c} /></li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {vender && principal && (
          <BarraFixa className="border-t border-(--filete) bg-(--papel)">
            <div className="flex items-center gap-4 px-5 py-3">
              <PrecoAtual className="font-(family-name:--font-display) text-2xl leading-none font-medium" />
              {cta("ml-auto min-h-12 px-6", "Comprar")}
            </div>
          </BarraFixa>
        )}
      </div>
    </OfertaProvider>
  );
}
