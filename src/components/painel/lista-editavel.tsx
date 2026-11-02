"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Item = { id: number; texto: string };

/** Lista de textos curtos: adicionar, remover e ordenar com setas (funcionam no toque e no teclado). */
export function ListaEditavel({
  rotulo,
  itens,
  adicionar = "Adicionar item",
  longo = false,
}: {
  rotulo: string;
  itens: readonly string[];
  adicionar?: string;
  longo?: boolean;
}) {
  const prox = useRef(itens.length);
  const [lista, setLista] = useState<Item[]>(() => itens.map((texto, id) => ({ id, texto })));
  const base = useId();
  const Campo = longo ? Textarea : Input;

  const mover = (n: number, passo: number) =>
    setLista((l) => {
      const nova = [...l];
      [nova[n], nova[n + passo]] = [nova[n + passo], nova[n]];
      return nova;
    });

  return (
    <fieldset>
      <legend className="sr-only">{rotulo}</legend>
      <ul className="space-y-3 sm:space-y-2">
        {lista.map((it, n) => (
          <li key={it.id} className="flex flex-wrap items-start gap-x-1 sm:flex-nowrap">
            <Campo
              id={`${base}-${it.id}`}
              aria-label={`${rotulo} ${n + 1}`}
              value={it.texto}
              onChange={(e) => setLista((l) => l.map((x) => (x.id === it.id ? { ...x, texto: e.target.value } : x)))}
              className={`w-full min-w-0 sm:flex-1 ${longo ? "min-h-20" : ""}`}
            />
            <div className="ml-auto flex shrink-0">
              <Button type="button" variant="ghost" size="icon" aria-label={`Subir ${rotulo.toLowerCase()} ${n + 1}`} disabled={n === 0} onClick={() => mover(n, -1)}><ArrowUp /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Descer ${rotulo.toLowerCase()} ${n + 1}`} disabled={n === lista.length - 1} onClick={() => mover(n, 1)}><ArrowDown /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${rotulo.toLowerCase()} ${n + 1}`} onClick={() => setLista((l) => l.filter((x) => x.id !== it.id))}><X /></Button>
            </div>
          </li>
        ))}
      </ul>
      <Button type="button" variant="ghost" size="sm" className="mt-2 text-(--terracota) hover:text-(--terracota-escura)" onClick={() => setLista((l) => [...l, { id: prox.current++, texto: "" }])}>
        <Plus /> {adicionar}
      </Button>
    </fieldset>
  );
}
