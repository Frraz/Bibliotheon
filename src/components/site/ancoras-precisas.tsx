"use client";

import { useEffect } from "react";

/**
 * As seções abaixo da dobra usam `content-visibility: auto` (ABAIXO, em compra.tsx), e o navegador calcula o destino de um link #âncora com a
 * altura estimada delas: em página longa, "Comprar agora" parava milhares de pixels antes das lojas. No clique, antes de o navegador rolar,
 * este componente desliga o adiamento (globals.css) e a rolagem usa as alturas reais. Até o primeiro clique, a página segue leve.
 */
export function AncorasPrecisas() {
  useEffect(() => {
    const desligar = () => { document.documentElement.dataset.semAdiamento = ""; };
    const aoClicar = (ev: MouseEvent) => {
      if (ev.target instanceof Element && ev.target.closest('a[href^="#"]')) desligar();
    };
    document.addEventListener("click", aoClicar, true);
    // Quem chega com o endereço já em #comprar (link de fora).
    if (location.hash) {
      desligar();
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    }
    return () => document.removeEventListener("click", aoClicar, true);
  }, []);
  return null;
}
