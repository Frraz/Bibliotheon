"use client";

import { useEffect, useState } from "react";

/**
 * Barra de compra fixa no rodapé (celular). Aparece depois que o hero sai da tela
 * e some enquanto o bloco de compra (#comprar) está visível.
 */
export function BarraFixa({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [passouHero, setPassouHero] = useState(false);
  const [noBloco, setNoBloco] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("topo");
    const bloco = document.getElementById("comprar");
    if (!hero || !bloco) return;
    const a = new IntersectionObserver(([e]) => setPassouHero(!e.isIntersecting));
    const b = new IntersectionObserver(([e]) => setNoBloco(e.isIntersecting));
    a.observe(hero);
    b.observe(bloco);
    return () => {
      a.disconnect();
      b.disconnect();
    };
  }, []);

  const visivel = passouHero && !noBloco;
  return (
    <div
      aria-hidden={!visivel}
      inert={!visivel}
      className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-out lg:hidden ${
        visivel ? "translate-y-0" : "translate-y-full"
      } ${className}`}
    >
      {children}
    </div>
  );
}
