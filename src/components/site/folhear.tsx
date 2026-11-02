"use client";

import Image from "next/image";
import { useRef, useState } from "react";

type Pagina = { src: string; alt: string };

/**
 * "Folheie o livro": faixa horizontal de páginas; toque abre uma página em tela cheia
 * com setas e teclado. Usa <dialog> nativo (foco e Esc já resolvidos pelo navegador).
 */
export function Folhear({
  paginas,
  className = "",
  itemClassName = "",
}: {
  paginas: readonly Pagina[];
  className?: string;
  itemClassName?: string;
}) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(0);

  const abrir = (n: number) => {
    setI(n);
    dlg.current?.showModal();
  };
  const ir = (d: number) => setI((x) => (x + d + paginas.length) % paginas.length);

  return (
    <>
      <ul
        className={`flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:thin] ${className}`}
      >
        {paginas.map((p, n) => (
          <li key={p.src} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => abrir(n)}
              aria-label={`Abrir página: ${p.alt}`}
              className={`group block cursor-zoom-in overflow-hidden transition-transform duration-200 ease-out hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 ${itemClassName}`}
            >
              <Image
                src={p.src}
                alt={p.alt}
                width={800}
                height={1280}
                sizes="(min-width:1024px) 240px, 60vw"
                className="h-auto w-[56vw] max-w-[240px] sm:w-[240px]"
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dlg}
        onClick={(e) => e.target === dlg.current && dlg.current?.close()}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") ir(1);
          if (e.key === "ArrowLeft") ir(-1);
        }}
        className="m-auto max-h-[94dvh] max-w-[min(94vw,640px)] bg-transparent p-0 backdrop:bg-black/80"
      >
        <div className="relative">
          <Image
            src={paginas[i].src}
            alt={paginas[i].alt}
            width={800}
            height={1280}
            className="max-h-[88dvh] w-auto bg-white"
          />
          <div className="mt-3 flex items-center justify-between text-sm text-white">
            <button type="button" onClick={() => ir(-1)} className="px-4 py-3">
              ← Anterior
            </button>
            <span>
              {i + 1} de {paginas.length}
            </span>
            <button type="button" onClick={() => ir(1)} className="px-4 py-3">
              Próxima →
            </button>
          </div>
          <button
            type="button"
            onClick={() => dlg.current?.close()}
            aria-label="Fechar"
            className="absolute -top-3 -right-3 grid size-11 place-items-center rounded-full bg-white text-xl text-black shadow-lg"
          >
            ×
          </button>
        </div>
      </dialog>
    </>
  );
}
