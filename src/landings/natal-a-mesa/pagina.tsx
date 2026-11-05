import { Playfair_Display, Source_Serif_4 } from "next/font/google";
import Image from "next/image";
import { CartaoEbookLink } from "@/components/site/cartao-ebook";
import { ABAIXO, BarraDeCompra, BlocoDeCompra, BotaoDeCompra, CompraNoMeio } from "@/components/site/compra";
import { Folhear } from "@/components/site/folhear";
import { podeVender } from "@/components/site/molde-pagina";
import { AvisoPrazo, FaixaUrgencia, PrecoAtual, PrecoDe } from "@/components/site/oferta";
import { CabecalhoSite, RodapeSite } from "@/components/site/moldura";
import { PedirAmostra } from "@/components/site/pedir-amostra";
import { TextoRecolhivel } from "@/components/site/texto-recolhivel";
import type { PropsLanding } from "../registro";
import { CARDAPIOS, PLANILHA, PONTO_DA_CARNE, POR_PESSOA, RECEITA } from "./conteudo";
import { SeletorDeCardapios } from "./seletor";

// Landing de "Natal à Mesa". Identidade tirada da capa e do tema do livro: verde-floresta, vinho da toalha, dourado do título e creme
// do papel; Playfair Display (a família do título da capa) e Source Serif 4. O livro não tem fotografia dos pratos, então a página
// também não tem: o que vende é o conteúdo real, mostrado como o leitor vai usá-lo. O elemento memorável é o seletor "Quantas pessoas
// vão à mesa?": cada aba é um cardápio do capítulo 10, com pratos, trecho da lista de compras e o dia 24 hora a hora.
// Ordem do padrão de venda (docs/04, seção 6): resultado, necessidade, prova do conteúdo, resultado, por que este caminho, risco, compra.
// Sem campanha cadastrada, não há prazo nem contador: a página mostra o preço do painel e nada mais.

const titulo = Playfair_Display({ subsets: ["latin"], variable: "--font-titulo", style: ["normal", "italic"] });
const livro = Source_Serif_4({ subsets: ["latin"], variable: "--font-livro", axes: ["opsz"] });

// As peças compartilhadas (compra, amostra, faixa) usam os tokens da marca; aqui eles recebem as cores do livro.
// Botão dourado com texto verde sobre o verde; sobre o creme, o botão vira vinho (ver CLARO).
const CORES = {
  "--noite": "#08240c",
  "--verde": "#0e3a1a",
  "--creme": "#fbf7ee",
  "--creme-2": "#f3ecdc",
  "--vinho": "#7a1017",
  "--ouro": "#c9a24a",
  "--ouro-escuro": "#7a5a12",
  "--texto": "#2a2420",
  "--texto-2": "#5a4e44",
  "--papel": "#fbf7ee",
  "--papel-2": "#f3ecdc",
  "--tinta": "#0e3a1a",
  "--tinta-2": "#5a4e44",
  "--filete": "#dccfae",
  "--terracota": "#c9a24a",
  "--terracota-escura": "#b8912f",
  "--botao-texto": "#08240c",
} as React.CSSProperties;

const CLARO = { "--terracota": "#7a1017", "--terracota-escura": "#5e0c12", "--botao-texto": "#fbf7ee" } as React.CSSProperties;

const Titulo = ({ children, id, className = "" }: { children: React.ReactNode; id?: string; className?: string }) => (
  <h2 id={id} className={`max-w-[22ch] font-(family-name:--font-titulo) text-[clamp(1.75rem,4.2vw,2.75rem)] leading-[1.12] font-semibold text-balance ${className}`}>{children}</h2>
);
const Marca = () => (
  <svg viewBox="0 0 20 20" className="mt-[0.4em] size-[1em] shrink-0 text-(--vinho)" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path d="m4 10.5 4 4 8-9" />
  </svg>
);
/** Ramo dourado do livro (o ornamento das aberturas de capítulo), só como respiro entre o rótulo e o título. */
const Ramo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 64 16" className={`h-4 w-16 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
    <path d="M2 8h60" />
    <path d="M22 8c-2-4-5-5-8-4 1 3 4 5 8 4Zm0 0c-2 4-5 5-8 4 1-3 4-5 8-4Zm20 0c2-4 5-5 8-4-1 3-4 5-8 4Zm0 0c2 4 5 5 8 4-1-3-4-5-8-4Z" />
  </svg>
);
const Rotulo = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-[0.8125rem] font-semibold tracking-[0.14em] uppercase ${className}`}>{children}</p>
);
const paragrafos = (t: string | null) => (t ?? "").split(/(?:\r?\n){2,}/).map((p) => p.trim()).filter(Boolean);

// As quatro perguntas de todo dezembro (a mesma ordem da descrição do livro, no painel).
const PERGUNTAS = ["O que cozinhar?", "Quanto gastar?", "Quanto comprar?", "Como fazer tudo sem passar o dia 24 na cozinha?"];

export function PaginaNatalAMesa({ e, relacionados, previa }: PropsLanding) {
  const vender = podeVender(e);
  const descricao = paragrafos(e.descricao);
  const garantia = e.garantiaDias ? `Garantia de ${e.garantiaDias} dias` : "";
  const planilha = e.incluido.some((i) => /planilha/i.test(i));
  const formatos = [...e.formatos.filter((f) => /pdf|epub/i.test(f)), ...(planilha ? ["planilha de orçamento"] : [])];
  const formatosTexto = formatos.length > 1 ? `${formatos.slice(0, -1).join(", ")} e ${formatos[formatos.length - 1]}` : formatos[0];
  // O número de páginas vem do painel (item "Livro em PDF (N páginas)"): se mudar lá, muda aqui. Sem ele, o número some.
  const paginas = e.incluido.join(" ").match(/(\d{2,4}) páginas/)?.[1];
  const numeros = [
    { n: "60", t: "receitas" },
    { n: "8", t: "cardápios completos" },
    ...(paginas ? [{ n: paginas, t: "páginas" }] : []),
  ];

  return (
    <div data-superficie="escura" style={CORES} className={`${titulo.variable} ${livro.variable} bg-(--noite) font-(family-name:--font-livro) text-[1.0625rem] leading-[1.65] text-(--texto) lining-nums sm:text-[1.125rem]`}>
      <CabecalhoSite discreto className="bg-(--noite) text-(--creme)" />
      {vender && e.vigente.emOferta && <FaixaUrgencia className="border-b border-(--ouro)/40 bg-(--noite) text-(--creme)" />}

      {/* Topo: resultado, preço e a capa */}
      <header id="topo" className="bg-(--noite) text-(--creme)">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-x-16 gap-y-10 px-5 pt-10 pb-12 lg:grid-cols-[1.25fr_1fr] lg:pt-14 lg:pb-14">
          <div>
            <h1 className="max-w-[21ch] font-(family-name:--font-titulo) text-[clamp(2.125rem,5vw,3.25rem)] leading-[1.08] font-semibold tracking-[-0.01em] text-balance">{e.headline?.trim() || e.titulo}</h1>
            {e.resumo && <p className="mt-6 max-w-[36rem] text-[1.1875rem] text-(--creme)/85 text-pretty">{e.resumo}</p>}
            {vender ? (
              <>
                <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-8">
                  <div>
                    <PrecoDe className="block text-sm text-(--creme)/70" />
                    <PrecoAtual className="block font-(family-name:--font-titulo) text-[2.75rem] leading-none font-semibold" />
                    {e.parcelamento && <span className="mt-2 block text-sm text-(--creme)/70">{e.parcelamento}</span>}
                  </div>
                  <BotaoDeCompra e={e} previa={previa} className="w-full sm:w-auto" />
                </div>
                <AvisoPrazo className="mt-4 font-medium text-(--ouro)" />
              </>
            ) : (
              <div className="mt-8 max-w-md border-t border-(--ouro) pt-4">
                <p className="font-(family-name:--font-titulo) text-[1.625rem] font-semibold">Em breve</p>
                <p className="mt-1 text-(--creme)/80 text-pretty">As vendas ainda não foram abertas. {e.amostras.length > 0 && <a href="#folhear" className="underline underline-offset-4 hover:text-(--ouro)">Folheie as páginas do livro.</a>}</p>
              </div>
            )}
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-[0.9375rem] text-(--creme)/75">
              <li>1ª edição, Natal 2026</li>
              {formatosTexto && <li>{formatosTexto}</li>}
              {vender && <li>Acesso imediato</li>}
              {garantia && <li>{garantia}</li>}
            </ul>
          </div>
          {e.capa && (
            <div className="mx-auto w-full max-w-[17rem] lg:max-w-[22rem]">
              <Image src={e.capa} alt={e.capaAlt || `Capa de ${e.titulo}`} width={1600} height={2261} priority fetchPriority="high" sizes="(min-width:1024px) 352px, 272px" className="h-auto w-full shadow-[0_24px_60px_-18px_rgb(0_0_0/.9)]" />
            </div>
          )}
        </div>
        <ul className="mx-auto grid max-w-6xl grid-cols-3 gap-x-4 border-t border-(--ouro)/35 px-5 py-5 sm:flex sm:gap-x-10">
          {numeros.map((s) => (
            <li key={s.t} className="flex flex-col items-center gap-1 text-center sm:flex-row sm:items-baseline sm:gap-2 sm:text-left">
              <span className="font-(family-name:--font-titulo) text-[2rem] leading-none font-semibold text-(--ouro)">{s.n}</span>
              <span className="text-[0.875rem] leading-tight text-(--creme)/80 sm:text-[0.9375rem]">{s.t}</span>
            </li>
          ))}
        </ul>
      </header>

      {/* Necessidade: as quatro perguntas de todo dezembro e as cenas que o leitor reconhece */}
      <section className="bg-(--creme)">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-x-16 gap-y-12 px-5 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <Rotulo className="text-(--vinho)">Todo dezembro</Rotulo>
            <ul className="mt-5 space-y-2 font-(family-name:--font-titulo) text-[clamp(1.75rem,4.4vw,2.875rem)] leading-[1.15] font-semibold text-(--verde)">
              {PERGUNTAS.map((p) => <li key={p} className="max-w-[20ch] text-balance">{p}</li>)}
            </ul>
            {e.problema && <p className="mt-8 max-w-[46ch] border-l-2 border-(--vinho) pl-4 text-[1.1875rem] italic text-pretty">“{e.problema}”</p>}
          </div>
          {e.dores.length > 0 && (
            <ul className="divide-y divide-(--filete) self-center border-y border-(--filete)">
              {e.dores.map((d) => <li key={d} className="py-4 text-pretty">{d}</li>)}
            </ul>
          )}
        </div>
      </section>

      {/* O seletor: a prova do conteúdo (os cardápios do capítulo 10 como o leitor vai usá-los) */}
      <section aria-labelledby="pessoas" className="bg-(--noite) text-(--creme)">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
          <Ramo className="text-(--ouro)" />
          <Titulo id="pessoas" className="mt-4">Quantas pessoas vão à mesa?</Titulo>
          <p className="mt-4 max-w-[60ch] text-(--creme)/85 text-pretty">O capítulo 10 traz oito cardápios prontos. Escolha um e veja o que ele tem por dentro: os pratos, um trecho da lista de compras e o dia 24 hora a hora.</p>
          <SeletorDeCardapios cardapios={CARDAPIOS} inicial={2} />
          <p className="mt-8 max-w-[62ch] text-[1rem] text-(--creme)/75 text-pretty">Os cardápios são sugestões: você pode trocar um prato por outro do mesmo capítulo, e o capítulo 1 ensina a ajustar as porções para outro número de pessoas.</p>
          <CompraNoMeio e={e} previa={previa} sobreEscuro />
        </div>
      </section>

      {/* Uma receita inteira: o formato das 60 */}
      <section aria-labelledby="receita" className={`${ABAIXO} bg-(--creme-2)`}>
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
          <Ramo className="text-(--vinho)" />
          <Titulo id="receita" className="mt-4">Uma receita por dentro</Titulo>
          <p className="mt-4 max-w-[62ch] text-pretty">É assim que cada uma das 60 aparece no livro: ingredientes em gramas e mililitros, passo a passo com temperatura, ponto de verificação e o que fazer se algo der errado. Esta é do capítulo {RECEITA.capitulo}, sem alterar o texto do livro (aqui sem as notas de servir, guardar e alergênicos).</p>
          <article className="mt-10 bg-(--creme) p-1.5 shadow-[0_18px_34px_-22px_rgb(8_36_12/.5)] sm:p-2">
            <div className="border border-(--ouro-escuro)/55 px-5 py-8 sm:px-10 sm:py-10">
              <h3 className="max-w-[24ch] font-(family-name:--font-titulo) text-[clamp(1.5rem,3.4vw,2.25rem)] leading-[1.15] font-semibold text-(--verde) text-balance">{RECEITA.titulo}</h3>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[0.9375rem] font-semibold text-(--vinho)">
                {RECEITA.ficha.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <p className="mt-4 max-w-[62ch] text-(--texto-2) italic text-pretty">{RECEITA.resumo}</p>
              <div className="mt-8 grid grid-cols-1 gap-x-14 gap-y-8 lg:grid-cols-[0.85fr_1.15fr]">
                <div>
                  <Rotulo className="text-(--vinho)">Ingredientes</Rotulo>
                  <ul className="mt-3 border-t border-(--filete)">
                    {RECEITA.ingredientes.map((i) => <li key={i} className="border-b border-(--filete) py-2 text-[1rem] text-pretty">{i}</li>)}
                  </ul>
                </div>
                <div>
                  <Rotulo className="text-(--vinho)">Modo de preparo</Rotulo>
                  <ol className="mt-3 space-y-3">
                    {RECEITA.preparo.map((p, n) => (
                      <li key={p} className="flex gap-4 text-pretty">
                        <span aria-hidden className="w-5 shrink-0 font-(family-name:--font-titulo) text-[1.25rem] leading-[1.4] font-semibold text-(--vinho)">{n + 1}</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              <div className="mt-8 grid grid-cols-1 gap-x-14 gap-y-5 border-t border-(--filete) pt-6 lg:grid-cols-3">
                {RECEITA.notas.map((n) => (
                  <div key={n.rotulo}>
                    <h4 className="font-(family-name:--font-titulo) text-[1.1875rem] font-semibold text-(--verde)">{n.rotulo}</h4>
                    <p className="mt-1 text-[1rem] text-(--texto-2) text-pretty">{n.texto}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
          <p className="mt-6 max-w-[62ch] text-[1rem] text-(--texto-2) text-pretty">O livro não tem fotografias dos pratos: é um guia de planejamento e de receitas, com projeto gráfico, e não um álbum de imagens. Tempos e rendimentos são referências e variam com o forno e os ingredientes.</p>
        </div>
      </section>

      {/* Resultado */}
      {e.beneficios.length > 0 && (
        <section className={`${ABAIXO} bg-(--creme)`}>
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <Titulo>O que você vai conseguir fazer</Titulo>
            <ul className="mt-10 grid grid-cols-1 gap-x-16 gap-y-6 lg:grid-cols-2">
              {e.beneficios.map((b) => <li key={b} className="flex gap-3 text-pretty"><Marca />{b}</li>)}
            </ul>
            {vender && (
              <div style={CLARO}>
                <CompraNoMeio e={e} previa={previa} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Comprar pela conta + planilha */}
      <section aria-labelledby="conta" className={`${ABAIXO} bg-(--verde) text-(--creme)`}>
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-x-16 gap-y-14 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <Ramo className="text-(--ouro)" />
            <Titulo id="conta" className="mt-4">Compre pela conta, não pelo chute</Titulo>
            <p className="mt-4 max-w-[52ch] text-(--creme)/85 text-pretty">O capítulo 1 dá a quantidade por pessoa usada para dimensionar todas as receitas do livro. São referências práticas de ceia, e não uma recomendação nutricional: variam com o apetite do grupo e o número de pratos.</p>
            <table className="mt-8 w-full border-t border-(--ouro)/35 text-left">
              <caption className="sr-only">Quantidade por pessoa, em cru, no preparo</caption>
              <thead className="sr-only"><tr><th scope="col">Item</th><th scope="col">Por pessoa</th></tr></thead>
              <tbody>
                {POR_PESSOA.map((r) => (
                  <tr key={r.item} className="border-b border-(--ouro)/35 align-baseline">
                    <th scope="row" className="py-2.5 pr-4 text-[1rem] font-normal text-pretty">{r.item}</th>
                    <td className="py-2.5 text-right font-(family-name:--font-titulo) text-[1.1875rem] font-semibold whitespace-nowrap text-(--ouro)">{r.qtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[0.9375rem] text-(--creme)/75 text-pretty">Com duas carnes à mesa, o livro manda reduzir cada uma em cerca de um terço por pessoa; com crianças de 3 a 10 anos, contar meia porção.</p>
          </div>
          <div>
            <h3 className="max-w-[22ch] font-(family-name:--font-titulo) text-[clamp(1.5rem,3.4vw,2.25rem)] leading-[1.15] font-semibold text-balance">Planilha de orçamento incluída</h3>
            <p className="mt-4 max-w-[40ch] text-[1.1875rem] text-(--creme)/90 text-pretty">Você digita os preços da sua cidade. Ela faz a conta.</p>
            <ul className="mt-6 space-y-3">
              {PLANILHA.faz.map((t) => (
                <li key={t} className="flex gap-3 text-pretty">
                  <svg viewBox="0 0 20 20" className="mt-[0.4em] size-[1em] shrink-0 text-(--ouro)" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="m4 10.5 4 4 8-9" /></svg>
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-6 border-l-2 border-(--ouro)/60 pl-4">
              <p className="text-[0.9375rem] font-semibold text-(--creme)">O que ela não faz</p>
              <ul className="mt-1 space-y-1 text-[1rem] text-(--creme)/80">
                {PLANILHA.limites.map((t) => <li key={t} className="text-pretty">{t}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Por que este caminho (diferenciais do painel) e segurança alimentar */}
      {e.diferenciais.length > 0 && (
        <section className={`${ABAIXO} bg-(--creme)`}>
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <Titulo>Por que este caminho</Titulo>
            <ul className="mt-10 grid grid-cols-1 gap-x-16 gap-y-8 lg:grid-cols-2">
              {e.diferenciais.map((d) => <li key={d} className="border-t-2 border-(--vinho) pt-4 text-pretty">{d}</li>)}
            </ul>

            <div className="mt-16 grid grid-cols-1 gap-x-16 gap-y-10 bg-(--creme-2) p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr]">
              <div>
                <Rotulo className="text-(--vinho)">Capítulo 2 · Segurança alimentar</Rotulo>
                <h3 className="mt-3 max-w-[20ch] font-(family-name:--font-titulo) text-[clamp(1.5rem,3.2vw,2.125rem)] leading-[1.15] font-semibold text-(--verde) text-balance">As duas temperaturas que importam</h3>
                <p className="mt-4 text-pretty">Quente, acima de 60 °C. Frio, abaixo de 5 °C. E nada de comida pronta por mais de 2 horas na mesa. As duas faixas são as que a Anvisa divulga para as ceias de fim de ano; as 2 horas são o que as vigilâncias sanitárias costumam recomendar.</p>
                <p className="mt-3 text-[1rem] text-(--texto-2) text-pretty">O livro também diz o que não é da Anvisa: ela não indica temperatura numérica de cozimento nas orientações consultadas, então os valores ao lado são os de agências como o USDA, deliberadamente prudentes. O capítulo é orientação geral e não substitui um profissional.</p>
              </div>
              <div>
                <p className="text-[0.9375rem] font-semibold text-(--texto)">Temperatura interna mínima adotada no livro</p>
                <table className="mt-2 w-full border-t border-(--filete) text-left">
                  <caption className="sr-only">Temperatura interna mínima por tipo de carne</caption>
                  <tbody>
                    {PONTO_DA_CARNE.map((r) => (
                      <tr key={r.item} className="border-b border-(--filete) align-baseline">
                        <th scope="row" className="py-2.5 pr-4 text-[1rem] font-normal text-pretty">{r.item}</th>
                        <td className="py-2.5 text-right font-(family-name:--font-titulo) text-[1.0625rem] font-semibold text-(--vinho)">{r.temp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-[0.9375rem] text-(--texto-2) text-pretty">Termômetro culinário recomendado: custa pouco, e a cor da carne não garante que ela está pronta.</p>
              </div>
            </div>

            {descricao.length > 0 && (
              <div className="mt-14 max-w-[64ch]">
                <h3 className="font-(family-name:--font-titulo) text-[1.375rem] font-semibold text-(--verde)">Sobre o livro</h3>
                <div style={{ "--terracota-escura": "#7a1017" } as React.CSSProperties} className="mt-3 text-(--texto-2)"><TextoRecolhivel paragrafos={descricao} /></div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Risco: para quem é e para quem não é */}
      {(e.paraQuem.length > 0 || e.naoEPara.length > 0) && (
        <section className={`${ABAIXO} bg-(--creme-2)`}>
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
                <ul className="mt-6 space-y-4 text-(--texto-2)">
                  {e.naoEPara.map((t) => (
                    <li key={t} className="flex gap-3 text-pretty"><span aria-hidden className="mt-[0.8em] block h-px w-3.5 shrink-0 bg-(--texto-2)" />{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mx-auto max-w-6xl px-5 pb-16 lg:pb-24">
            <p className="max-w-[64ch] border-l-2 border-(--vinho) pl-4 text-pretty">É orientação culinária geral: não substitui nutricionista, médico ou a vigilância sanitária. Quem tem alergia, doença ou dieta especial deve consultar um profissional e ler sempre os rótulos.</p>
          </div>
        </section>
      )}

      {/* Folheie */}
      {e.amostras.length > 0 && (
        <section id="folhear" className={`${ABAIXO} scroll-mt-4 bg-(--noite) text-(--creme)`}>
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <Titulo>Folheie antes de decidir</Titulo>
            <p className="mt-3 max-w-xl text-(--creme)/80">Páginas reais do livro. Toque para ampliar.</p>
            <Folhear paginas={e.amostras} className="mt-10 -mx-5 px-5" itemClassName="shadow-[0_18px_30px_-14px_rgb(0_0_0/.6)] outline-(--creme)" />
            {e.amostraPdf && <PedirAmostra slug={e.slug} />}
          </div>
        </section>
      )}

      {/* Sumário */}
      {e.sumario.length > 0 && (
        <section className={`${ABAIXO} bg-(--creme)`}>
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <Titulo>O que há no livro</Titulo>
            <ul className="mt-10 grid grid-cols-1 gap-x-16 lg:grid-cols-2">
              {e.sumario.slice(0, 8).map((c) => <li key={c} className="border-b border-(--filete) py-3 text-pretty">{c}</li>)}
              {e.sumario.slice(8).map((c) => <li key={c} className="border-b border-(--filete) py-3 text-pretty max-lg:hidden">{c}</li>)}
            </ul>
            {e.sumario.length > 8 && (
              <details className="group lg:hidden">
                <summary className="mt-4 inline-flex min-h-11 cursor-pointer list-none items-center font-medium text-(--vinho) underline underline-offset-4 marker:content-none group-open:hidden [&::-webkit-details-marker]:hidden">Ver todos os {e.sumario.length}</summary>
                <ul>{e.sumario.slice(8).map((c) => <li key={c} className="border-b border-(--filete) py-3 text-pretty">{c}</li>)}</ul>
              </details>
            )}
          </div>
        </section>
      )}

      {/* Incluído e garantia */}
      {(e.incluido.length > 0 || e.garantiaDias > 0) && (
        <section className={`${ABAIXO} bg-(--creme-2)`}>
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
                <p className="mt-6 text-(--texto-2) text-pretty">Se o livro não for o que você esperava, você pode pedir o reembolso pelo fluxo da própria plataforma de compra, em até {e.garantiaDias} dias, sem prejuízo dos direitos previstos em lei.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Perguntas */}
      {e.faq.length > 0 && (
        <section className={`${ABAIXO} bg-(--creme)`}>
          <div className="mx-auto max-w-3xl px-5 py-16 lg:py-24">
            <Titulo>Perguntas frequentes</Titulo>
            <div className="mt-8 border-t border-(--filete)">
              {e.faq.map((f) => (
                <details key={f.p} className="group border-b border-(--filete)">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                    {f.p}
                    <span aria-hidden className="text-[1.5rem] leading-none text-(--vinho) group-open:hidden">+</span>
                    <span aria-hidden className="hidden text-[1.5rem] leading-none text-(--vinho) group-open:inline">−</span>
                  </summary>
                  <p className="pb-5 text-(--texto-2) text-pretty">{f.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <BlocoDeCompra e={e} previa={previa} />

      {relacionados.length > 0 && (
        <section className={`${ABAIXO} bg-(--creme)`}>
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <Titulo>Mais sobre {e.tema?.nome.toLowerCase()}</Titulo>
            <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
              {relacionados.map((c) => <li key={c.slug}><CartaoEbookLink c={c} /></li>)}
            </ul>
          </div>
        </section>
      )}

      <div className="bg-(--noite) text-(--creme)">
        <RodapeSite discreto />
      </div>
      <div style={CLARO}>
        <BarraDeCompra e={e} previa={previa} />
      </div>
    </div>
  );
}
