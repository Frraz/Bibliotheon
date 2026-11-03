import { createElement } from "react";
import { MoldeDaPagina } from "@/components/site/molde-pagina";
import { Landing } from "@/components/site/landing";
import type { CartaoEbook, EbookPublico } from "@/lib/catalogo";
import { personalizadas, type Registro } from "./registro";

/**
 * Página de vendas de um e-book: a personalizada, se existir no registro; senão, a padrão.
 * Usada pela página pública e pela prévia do painel, então o que se vê na prévia é o que vai ao ar.
 */
export function PaginaDeVendas({ e, relacionados, previa = false, registro = personalizadas }: { e: EbookPublico; relacionados: CartaoEbook[]; previa?: boolean; registro?: Registro }) {
  const Corpo = registro.get(e.slug);
  if (!Corpo) return <Landing e={e} relacionados={relacionados} previa={previa} />;
  // createElement: o corpo vem de um registro estável (não é criado a cada render), e o lint não distingue isso de JSX dinâmico.
  return <MoldeDaPagina e={e} previa={previa}>{createElement(Corpo, { e, relacionados, previa })}</MoldeDaPagina>;
}
