"use client";

import { useState } from "react";
import type { MARINA } from "./conteudo";

const BOTAO = "min-h-12 cursor-pointer border border-(--noite) px-2 font-semibold transition-colors hover:bg-(--noite) hover:text-(--marmore) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ouro-texto)";

/** A tabela de duas colunas do capítulo 2, feita na página: a pessoa separa e a tabela se monta. Fica só no navegador: nada é enviado. */
export function ALinha({ marina }: { marina: typeof MARINA }) {
  const [feitos, setFeitos] = useState(0);
  const [aviso, setAviso] = useState("");
  const atual = marina.itens[feitos];
  const coluna = (depende: boolean) => marina.itens.slice(0, feitos).filter((i) => i.depende === depende);

  function responder(depende: boolean) {
    setAviso(atual.depende === depende ? "" : atual.depende ? `“${atual.texto}” depende dela.` : `“${atual.texto}” não depende dela.`);
    setFeitos(feitos + 1);
  }

  const lista = (depende: boolean) => (
    <ul className="mt-3 space-y-2.5">
      {coluna(depende).map((i) => (
        <li key={i.texto} className="leading-snug text-pretty transition-[opacity,translate] duration-200 starting:translate-y-1 starting:opacity-0 motion-reduce:transition-none">{i.texto}</li>
      ))}
    </ul>
  );

  return (
    <div className="mt-10 max-w-3xl">
      {atual && (
        <div className="min-h-44">
          <p key={atual.texto} className="font-(family-name:--font-inscricao) text-[clamp(1.5rem,4vw,2.25rem)] leading-tight font-medium text-balance">{atual.texto}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
            <button type="button" onClick={() => responder(true)} className={BOTAO}>Depende dela</button>
            <button type="button" onClick={() => responder(false)} className={BOTAO}>Não depende</button>
          </div>
          <p aria-live="polite" className="mt-3 min-h-7 text-[1rem] text-(--ouro-texto)">{aviso}</p>
        </div>
      )}

      <div className="grid grid-cols-2 border-t-2 border-(--ouro-texto) pt-4">
        <div className="min-h-56 pr-4 sm:pr-8">
          <p className="font-semibold">Depende dela</p>
          {lista(true)}
        </div>
        <div className="min-h-56 border-l-2 border-(--ouro-texto) pl-4 sm:pl-8">
          <p className="font-semibold">Não depende</p>
          {lista(false)}
        </div>
      </div>

      {!atual && (
        <div className="mt-6 max-w-[60ch]">
          <p className="text-[1.3125rem] leading-[1.45] font-semibold text-pretty">{marina.percebe}</p>
          <p className="mt-3 text-(--tinta-2) text-pretty">{marina.colunas}</p>
          <p className="mt-3 text-(--tinta-2) text-pretty">{marina.limite}</p>
          <button type="button" onClick={() => { setFeitos(0); setAviso(""); }} className="mt-2 inline-flex min-h-11 cursor-pointer items-center text-[1rem] text-(--ouro-texto) underline underline-offset-4">Separar de novo</button>
        </div>
      )}
    </div>
  );
}
