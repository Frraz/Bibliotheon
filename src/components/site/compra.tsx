import { rotuloOferta } from "@/lib/ofertas";
import type { EbookPublico } from "@/lib/catalogo";
import { brl } from "@/lib/preco";
import { BarraFixa } from "./barra-fixa";
import { LinkOferta } from "./link-oferta";
import { podeVender } from "./molde-pagina";
import { AvisoPrazo, PrazoCurto, PrazoOferta, PrecoAtual, PrecoDe } from "./oferta";

// Peças de compra compartilhadas pela landing padrão e pelas personalizadas (src/landings/).
// Regra das lojas (decisão de 02/11/2026): com UMA loja ativa o botão vai direto ao checkout; com DUAS OU MAIS, todas aparecem
// no bloco #comprar com o mesmo peso, e os botões do topo e da barra fixa levam até lá. A ordem é a da lista no painel.

export const BOTAO =
  "inline-flex min-h-14 items-center justify-center bg-(--terracota) px-8 text-[1.0625rem] font-semibold text-(--papel) shadow-[0_1px_0_rgb(0_0_0/.15),0_10px_20px_-12px_rgb(0_0_0/.55)] transition-[background-color,transform] duration-150 hover:bg-(--terracota-escura) active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--terracota)";

// Seções abaixo da dobra: o navegador só calcula estilo e layout delas quando chegam perto da tela (LCP no celular).
export const ABAIXO = "[content-visibility:auto] [contain-intrinsic-size:auto_640px]";

export const temVariasLojas = (e: Pick<EbookPublico, "ofertas">) => e.ofertas.length > 1;

/** O botão de compra do topo, do meio e da barra fixa. */
export function BotaoDeCompra({ e, previa = false, className = "", curto = false }: { e: EbookPublico; previa?: boolean; className?: string; curto?: boolean }) {
  const principal = e.ofertas.find((o) => o.principal) ?? e.ofertas[0];
  if (!principal) return null;
  if (temVariasLojas(e)) {
    return (
      <a href="#comprar" className={`${BOTAO} ${className}`}>
        {curto ? "Escolher loja" : "Escolher onde comprar"}
      </a>
    );
  }
  return (
    <LinkOferta ofertaId={principal.id} titulo={e.titulo} valor={e.vigente.valor} previa={previa} className={`${BOTAO} ${className}`}>
      {curto ? "Comprar" : rotuloOferta(principal)}
    </LinkOferta>
  );
}

/** Nova chance de comprar para quem já se convenceu no meio da página. */
export function CompraNoMeio({ e, previa = false, sobreEscuro = false }: { e: EbookPublico; previa?: boolean; sobreEscuro?: boolean }) {
  if (!podeVender(e)) return null;
  return (
    <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
      <BotaoDeCompra e={e} previa={previa} className="w-full sm:w-auto" />
      <div className={sobreEscuro ? "text-(--papel)" : ""}>
        <PrecoAtual className="block font-(family-name:--font-display) text-2xl leading-none font-medium" />
        <AvisoPrazo className={`mt-1 text-sm ${sobreEscuro ? "text-(--papel)/75" : "text-(--tinta-2)"}`} />
      </div>
    </div>
  );
}

const paragrafos = (t: string | null) => (t ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

/** Bloco de compra (#comprar): preço, prazo, lojas e "Antes de comprar". É o destino dos botões do topo e da barra fixa. */
export function BlocoDeCompra({ e, previa = false }: { e: EbookPublico; previa?: boolean }) {
  const vender = podeVender(e);
  const headline = e.headline?.trim() || e.titulo;
  const varias = temVariasLojas(e);
  return (
    <section id="comprar" className={`${ABAIXO} bg-(--tinta) text-(--papel)`}>
      <div className="mx-auto max-w-3xl px-5 py-20 text-center lg:py-28">
        <h2 className="font-(family-name:--font-display) text-[clamp(2rem,5vw,3.25rem)] leading-[1.08] font-medium text-balance">{vender ? headline : "Em breve"}</h2>
        {vender ? (
          <>
            <p className="mt-8 text-sm text-(--papel)/60">
              <PrecoDe /> <PrazoOferta />
            </p>
            <PrecoAtual className="block font-(family-name:--font-display) text-6xl leading-tight font-medium" />
            <p className="text-sm text-(--papel)/70">Pagamento único · acesso imediato{e.parcelamento ? ` · ${e.parcelamento}` : ""}</p>
            <AvisoPrazo className="mt-3 font-medium" />
            {varias ? (
              <>
                <p className="mt-8 font-medium">Escolha onde prefere comprar</p>
                <ul className="mx-auto mt-3 grid w-full max-w-sm grid-cols-1 gap-3">
                  {e.ofertas.map((o) => (
                    <li key={o.id}>
                      <LinkOferta ofertaId={o.id} titulo={e.titulo} valor={o.preco ?? e.vigente.valor} previa={previa} className={`${BOTAO} w-full`}>
                        {rotuloOferta(o)}
                        {o.preco != null && o.preco !== e.vigente.valor ? ` · ${brl(o.preco)}` : ""}
                      </LinkOferta>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <BotaoDeCompra e={e} previa={previa} className="mt-8 w-full max-w-sm" />
            )}
          </>
        ) : (
          <p className="mx-auto mt-6 max-w-md text-(--papel)/75 text-pretty">As vendas deste livro ainda não foram abertas. Volte em breve.</p>
        )}
        {paragrafos(e.observacoes).length > 0 && (
          <div className="mx-auto mt-10 max-w-md space-y-2 text-sm text-(--papel)/75 text-pretty">
            <p className="font-medium text-(--papel)">Antes de comprar</p>
            {paragrafos(e.observacoes).map((p) => (
              <p key={p.slice(0, 32)}>{p}</p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Barra de compra fixa no celular: aparece depois do topo e some quando o bloco #comprar está na tela. */
export function BarraDeCompra({ e, previa = false }: { e: EbookPublico; previa?: boolean }) {
  if (!podeVender(e)) return null;
  return (
    <BarraFixa className="border-t border-(--filete) bg-(--papel)">
      <div className="flex items-center gap-4 px-5 py-3">
        <div>
          <PrecoAtual className="block font-(family-name:--font-display) text-2xl leading-none font-medium" />
          <PrazoCurto className="mt-1 block text-xs text-(--tinta-2)" />
        </div>
        <BotaoDeCompra e={e} previa={previa} curto className="ml-auto min-h-12 px-6" />
      </div>
    </BarraFixa>
  );
}
