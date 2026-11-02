"use client";

import { GripVertical, Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Item = { id: number; texto: string };

/** Lista de textos curtos: adicionar, remover (arrastar para ordenar entra na Etapa 3). */
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

  return (
    <fieldset>
      <legend className="sr-only">{rotulo}</legend>
      <ul className="space-y-2">
        {lista.map((it, n) => (
          <li key={it.id} className="flex items-start gap-1">
            <span className="mt-3 text-(--tinta-2)/60" aria-hidden><GripVertical className="size-5" /></span>
            <Campo
              id={`${base}-${it.id}`}
              aria-label={`${rotulo} ${n + 1}`}
              value={it.texto}
              onChange={(e) => setLista((l) => l.map((x) => (x.id === it.id ? { ...x, texto: e.target.value } : x)))}
              className={longo ? "min-h-20" : ""}
            />
            <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${rotulo.toLowerCase()} ${n + 1}`} onClick={() => setLista((l) => l.filter((x) => x.id !== it.id))}>
              <X />
            </Button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="ghost" size="sm" className="mt-2 text-(--terracota) hover:text-(--terracota-escura)" onClick={() => setLista((l) => [...l, { id: prox.current++, texto: "" }])}>
        <Plus /> {adicionar}
      </Button>
    </fieldset>
  );
}
