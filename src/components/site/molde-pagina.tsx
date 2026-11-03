import type { EbookPublico } from "@/lib/catalogo";
import { jsonLdDoEbook, serializarJsonLd } from "@/lib/jsonld";
import { OfertaProvider } from "./oferta";
import { Visita } from "./rastreio";

/** Há o que vender: livro com preço/loja e fora do modo "Em breve". */
export const podeVender = (e: Pick<EbookPublico, "emBreve" | "ofertas">) => !e.emBreve && e.ofertas.length > 0;

/**
 * Molde de toda página de vendas, padrão ou personalizada. Entrega o que nenhuma página pode esquecer:
 * o preço vigente (com a contagem da campanha), os dados estruturados para o Google e a contagem de visita.
 * Quem desenha o corpo da página (src/landings/) só escreve as seções.
 *
 * `previa`: versão do painel (qualquer status): sem dados estruturados, sem contar visita e com os botões de compra desligados.
 */
export function MoldeDaPagina({ e, previa = false, children }: { e: EbookPublico; previa?: boolean; children: React.ReactNode }) {
  const dados = { preco: e.preco, precoDe: e.precoDe, ofertaAte: e.ofertaAte, ofertaNome: e.ofertaNome, emBreve: !podeVender(e), inicial: e.vigente };
  return (
    <OfertaProvider dados={dados}>
      <div className="bg-(--papel) font-(family-name:--font-texto) text-[1.0625rem] leading-[1.65] text-(--tinta)">
        {!previa && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdDoEbook(e)) }} />}
        {!previa && <Visita slug={e.slug} titulo={e.titulo} valor={e.vigente.valor} />}
        {children}
      </div>
    </OfertaProvider>
  );
}
