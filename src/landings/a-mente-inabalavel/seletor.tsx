"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { Problema } from "./conteudo";

/** "O que está pesando em você agora?": abas com a prática real de cada capítulo. Todo o conteúdo fica no HTML, para o Google e sem JavaScript pesado. */
export function SeletorDeProblemas({ problemas }: { problemas: Problema[] }) {
  const [atual, setAtual] = useState(0);
  const abas = useRef<(HTMLButtonElement | null)[]>([]);

  function teclado(ev: KeyboardEvent) {
    const passo = ev.key === "ArrowRight" || ev.key === "ArrowDown" ? 1 : ev.key === "ArrowLeft" || ev.key === "ArrowUp" ? -1 : 0;
    if (!passo) return;
    ev.preventDefault();
    const proxima = (atual + passo + problemas.length) % problemas.length;
    setAtual(proxima);
    abas.current[proxima]?.focus();
  }

  return (
    <div className="mt-10 grid grid-cols-1 gap-8 lg:mt-14 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
      <div role="tablist" aria-label="Escolha o problema" aria-orientation="vertical" onKeyDown={teclado} className="grid grid-cols-3 gap-px bg-(--ouro)/30 p-px lg:grid-cols-1 lg:bg-transparent lg:p-0">
        {problemas.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => { abas.current[i] = el; }}
            id={`aba-${p.id}`}
            role="tab"
            type="button"
            aria-selected={i === atual}
            aria-controls={`painel-${p.id}`}
            tabIndex={i === atual ? 0 : -1}
            onClick={() => setAtual(i)}
            className={`min-h-12 cursor-pointer px-1 text-center text-[0.9375rem] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ouro) lg:min-h-14 lg:border-l-2 lg:px-5 lg:text-left lg:text-[1.1875rem] ${
              i === atual ? "bg-(--ouro) font-semibold text-(--noite) lg:border-(--ouro) lg:bg-transparent lg:text-(--ouro)" : "bg-(--noite) text-(--marmore)/80 hover:text-(--marmore) lg:border-(--marmore)/15 lg:bg-transparent"
            }`}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      {problemas.map((p, i) => (
        <div key={p.id} id={`painel-${p.id}`} role="tabpanel" aria-labelledby={`aba-${p.id}`} hidden={i !== atual} tabIndex={0} className="focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-(--ouro)">
          <p className="max-w-[60ch] text-[1.125rem] text-(--marmore)/80 italic text-pretty">{p.cena}</p>
          <blockquote className="mt-7">
            <p className="max-w-[28ch] font-(family-name:--font-inscricao) text-[clamp(1.5rem,3.6vw,2.5rem)] leading-[1.22] text-(--ouro) text-balance">“{p.citacao}”</p>
            <footer className="mt-3 text-[0.9375rem] text-(--marmore)/70">{p.fonte}</footer>
          </blockquote>
          {p.nota && <p className="mt-6 max-w-[60ch] border-l-2 border-(--ouro)/50 pl-4 text-[1rem] text-(--marmore)/80 text-pretty">{p.nota}</p>}
          <h3 className="mt-9 text-[1.1875rem] font-semibold text-balance">Capítulo {p.capitulo}, exercício: {p.exercicio.charAt(0).toLowerCase() + p.exercicio.slice(1)}</h3>
          <ol className="mt-4 max-w-[60ch] space-y-3">
            {p.passos.map((t, n) => (
              <li key={t} className="flex gap-4 text-pretty">
                <span aria-hidden className="w-5 shrink-0 font-(family-name:--font-inscricao) text-(--ouro)">{n + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
