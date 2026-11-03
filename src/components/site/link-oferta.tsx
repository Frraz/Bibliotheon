"use client";

import { useSyncExternalStore } from "react";
import { evento } from "./rastreio";

const semMudanca = () => () => {};

/**
 * Link para a saída rastreada (/ir/<oferta>). Leva junto a origem da visita (utm_*, src, fbclid...) para
 * que o checkout saiba de onde a pessoa veio. É um <a> comum: nada de prefetch, para não contar clique falso.
 */
export function LinkOferta({
  ofertaId,
  titulo,
  valor,
  className,
  previa = false,
  children,
}: {
  ofertaId: string;
  titulo: string;
  valor: number | null;
  className?: string;
  /** Prévia do painel: não leva ao checkout nem conta clique. */
  previa?: boolean;
  children: React.ReactNode;
}) {
  const busca = useSyncExternalStore(semMudanca, () => location.search, () => "");
  if (previa) {
    return (
      <a href="#comprar" className={className} title="Na prévia o botão não leva ao checkout">
        {children}
      </a>
    );
  }
  return (
    <a href={`/ir/${ofertaId}${busca}`} onClick={() => evento("InitiateCheckout", { nome: titulo, valor })} className={className} rel="nofollow">
      {children}
    </a>
  );
}
