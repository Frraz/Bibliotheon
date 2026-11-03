"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { Cardapio, Prato } from "./conteudo";

/** "Quantas pessoas vão à mesa?": os oito cardápios do capítulo 10, como abas. Todo o conteúdo fica no HTML (painéis só ocultos), para o Google e para quem lê sem JavaScript. */

/** Junta pratos vizinhos do mesmo papel ("Acompanhamentos" com três pratos vira um só rótulo). */
function agrupar(pratos: Prato[]) {
  const grupos: { papel: string; pratos: Prato[] }[] = [];
  for (const p of pratos) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.papel === p.papel) ultimo.pratos.push(p);
    else grupos.push({ papel: p.papel, pratos: [p] });
  }
  return grupos;
}

const Rotulo = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[0.8125rem] font-semibold tracking-[0.14em] text-(--vinho) uppercase">{children}</p>
);

export function SeletorDeCardapios({ cardapios, inicial = 0 }: { cardapios: Cardapio[]; inicial?: number }) {
  const [atual, setAtual] = useState(inicial);
  const abas = useRef<(HTMLButtonElement | null)[]>([]);

  function teclado(ev: KeyboardEvent) {
    const passo = ev.key === "ArrowRight" || ev.key === "ArrowDown" ? 1 : ev.key === "ArrowLeft" || ev.key === "ArrowUp" ? -1 : 0;
    if (ev.key === "Home" || ev.key === "End") {
      ev.preventDefault();
      const alvo = ev.key === "Home" ? 0 : cardapios.length - 1;
      setAtual(alvo);
      abas.current[alvo]?.focus();
      return;
    }
    if (!passo) return;
    ev.preventDefault();
    const proxima = (atual + passo + cardapios.length) % cardapios.length;
    setAtual(proxima);
    abas.current[proxima]?.focus();
  }

  return (
    <div className="mt-10 grid grid-cols-1 gap-6 lg:mt-14 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-10">
      <div role="tablist" aria-label="Escolha o cardápio" onKeyDown={teclado} className="grid grid-cols-2 gap-2 lg:sticky lg:top-6 lg:grid-cols-1 lg:self-start">
        {cardapios.map((c, i) => (
          <button
            key={c.id}
            ref={(el) => { abas.current[i] = el; }}
            id={`aba-${c.id}`}
            role="tab"
            type="button"
            aria-selected={i === atual}
            aria-controls={`painel-${c.id}`}
            tabIndex={i === atual ? 0 : -1}
            onClick={() => setAtual(i)}
            className={`flex min-h-16 cursor-pointer flex-col justify-center border px-4 py-2.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ouro) ${
              i === atual ? "border-(--ouro) bg-(--ouro) text-(--noite)" : "border-(--creme)/25 text-(--creme) hover:border-(--ouro)/70 hover:bg-(--creme)/5"
            }`}
          >
            <span className="font-(family-name:--font-titulo) text-[1.1875rem] leading-tight font-semibold">{c.rotulo}</span>
            <span className={`mt-0.5 text-[0.8125rem] leading-snug ${i === atual ? "text-(--noite)/80" : "text-(--creme)/70"}`}>{c.sub}</span>
          </button>
        ))}
      </div>

      {cardapios.map((c, i) => (
        <div
          key={c.id}
          id={`painel-${c.id}`}
          role="tabpanel"
          aria-labelledby={`aba-${c.id}`}
          hidden={i !== atual}
          tabIndex={0}
          className="animate-in fade-in-0 slide-in-from-bottom-2 bg-(--creme) p-1.5 text-(--texto) duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--ouro) motion-reduce:animate-none sm:p-2"
        >
          <div className="border border-(--ouro-escuro)/55 px-5 py-8 sm:px-10 sm:py-10">
            <Rotulo>Cardápio {c.numero} · capítulo 10</Rotulo>
            <h3 className="mt-3 font-(family-name:--font-titulo) text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.1] font-semibold text-(--verde) text-balance">{c.titulo}</h3>
            <p className="mt-3 max-w-[56ch] text-[1.0625rem] text-(--texto-2) italic text-pretty">{c.perfil}</p>
            <p className="mt-4 max-w-[62ch] text-pretty">{c.intro}</p>

            <div className="mt-8">
              <Rotulo>O que vai à mesa</Rotulo>
              <dl className="mt-3 border-t border-(--filete)">
                {agrupar(c.pratos).map((g) => (
                  <div key={g.papel + g.pratos[0].nome} className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-(--filete) py-3 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
                    <dt className="text-[0.9375rem] text-(--texto-2)">{g.papel}</dt>
                    <dd>
                      <ul className="space-y-1">
                        {g.pratos.map((p) => (
                          <li key={p.nome} className="text-pretty">
                            <span className="font-(family-name:--font-titulo) text-[1.125rem] font-medium text-(--verde)">{p.nome}</span>
                            <span className="ml-2 text-[0.8125rem] whitespace-nowrap text-(--texto-2)">cap. {p.cap}</span>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[0.9375rem] text-(--texto-2) text-pretty">Cada prato traz a quantidade a fazer para este número de pessoas.</p>
            </div>

            <div className="mt-8">
              <Rotulo>Trecho da lista de compras</Rotulo>
              <p className="mt-3 text-pretty">
                <span className="font-semibold text-(--verde)">{c.compras.cat}.</span> {c.compras.itens}
              </p>
              <p className="mt-2 text-[0.9375rem] text-(--texto-2) text-pretty">A lista completa vem somada por categoria de mercado, com as quantidades já arredondadas para cima.</p>
            </div>

            <div className="mt-8">
              <Rotulo>O dia 24, hora a hora</Rotulo>
              <p className="mt-2 text-[0.9375rem] text-(--texto-2) text-pretty">Horários em relação à hora em que a ceia será servida.</p>
              <ol className="mt-3 border-t border-(--filete)">
                {c.dia24.map((d, n) => (
                  <li key={`${n}-${d.texto}`} className="grid grid-cols-1 gap-x-6 border-b border-(--filete) py-2.5 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
                    <span className="text-[0.9375rem] font-semibold text-(--vinho)">{d.quando}</span>
                    <span className="text-pretty">{d.texto}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[0.9375rem] text-(--texto-2) text-pretty">
                Antes do dia 24, o cronograma traz o que comprar 7 e 3 dias antes e {c.vespera} tarefas para a véspera.
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
