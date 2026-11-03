"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Item = { id: number; texto: string };

/**
 * Lista de textos curtos: adicionar, remover e ordenar com setas (funcionam no toque e no teclado).
 * Com `nome`, o formulário recebe a lista inteira, na ordem da tela, como JSON num campo oculto.
 */
export function ListaEditavel({
  nome,
  rotulo,
  itens,
  adicionar = "Adicionar item",
  longo = false,
}: {
  nome?: string;
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

  // Colar várias linhas (ex.: de um guia de publicação) cria um item por linha, a partir do campo atual.
  const colar = (ev: React.ClipboardEvent, id: number) => {
    const linhas = ev.clipboardData.getData("text").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (linhas.length < 2) return;
    ev.preventDefault();
    setLista((l) => {
      const i = l.findIndex((x) => x.id === id);
      const novos = linhas.map((texto, n) => ({ id: n === 0 ? id : prox.current++, texto }));
      return [...l.slice(0, i), ...novos, ...l.slice(i + 1)];
    });
  };

  return (
    <fieldset>
      <legend className="sr-only">{rotulo}</legend>
      {nome && <input type="hidden" name={nome} value={JSON.stringify(lista.map((x) => x.texto))} />}
      <ul className="space-y-3 sm:space-y-2">
        {lista.map((it, n) => (
          <li key={it.id} className="flex flex-wrap items-start gap-x-1 sm:flex-nowrap">
            <Campo
              id={`${base}-${it.id}`}
              aria-label={`${rotulo} ${n + 1}`}
              value={it.texto}
              onPaste={(ev) => colar(ev, it.id)}
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
      <Button type="button" variant="ghost" size="sm" className="mt-2 min-h-11 text-(--terracota) hover:text-(--terracota-escura)" onClick={() => setLista((l) => [...l, { id: prox.current++, texto: "" }])}>
        <Plus /> {adicionar}
      </Button>
    </fieldset>
  );
}
