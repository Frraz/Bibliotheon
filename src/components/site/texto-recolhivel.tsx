"use client";

import { useState } from "react";

/**
 * Descrição longa: no celular mostra só os primeiros parágrafos e um "Continuar lendo"; do desktop em diante mostra tudo.
 * O texto inteiro fica sempre no HTML (escondido só por CSS), então continua indexável.
 */
export function TextoRecolhivel({ paragrafos, visiveis = 2 }: { paragrafos: string[]; visiveis?: number }) {
  const [aberto, setAberto] = useState(false);
  const recolhido = !aberto && paragrafos.length > visiveis;
  return (
    <div className="space-y-5 text-pretty">
      {paragrafos.map((p, i) => (
        <p key={p.slice(0, 32)} className={recolhido && i >= visiveis ? "hidden lg:block" : undefined}>
          {p}
        </p>
      ))}
      {recolhido && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="inline-flex min-h-12 items-center font-medium text-(--terracota-escura) underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--terracota) lg:hidden"
        >
          Continuar lendo
        </button>
      )}
    </div>
  );
}
