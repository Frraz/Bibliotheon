"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Par = { id: number; p: string; r: string };

/** Perguntas e respostas. Vão ao formulário como JSON, na ordem da tela, no campo oculto `faq`. */
export function FaqEditavel({ itens }: { itens: { p: string; r: string }[] }) {
  const prox = useRef(itens.length);
  const [lista, setLista] = useState<Par[]>(() => itens.map((x, id) => ({ id, ...x })));
  const mover = (n: number, passo: number) =>
    setLista((l) => {
      const nova = [...l];
      [nova[n], nova[n + passo]] = [nova[n + passo], nova[n]];
      return nova;
    });
  const mudar = (id: number, campo: "p" | "r", valor: string) => setLista((l) => l.map((x) => (x.id === id ? { ...x, [campo]: valor } : x)));

  return (
    <fieldset>
      <legend className="sr-only">Perguntas frequentes</legend>
      <input type="hidden" name="faq" value={JSON.stringify(lista.map(({ p, r }) => ({ p, r })))} />
      <ul className="space-y-5">
        {lista.map((f, n) => (
          <li key={f.id}>
            <div className="space-y-2">
              <Input aria-label={`Pergunta ${n + 1}`} value={f.p} onChange={(e) => mudar(f.id, "p", e.target.value)} className="font-medium" />
              <Textarea aria-label={`Resposta ${n + 1}`} value={f.r} onChange={(e) => mudar(f.id, "r", e.target.value)} className="min-h-20" />
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="icon" aria-label={`Subir pergunta ${n + 1}`} disabled={n === 0} onClick={() => mover(n, -1)}><ArrowUp /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Descer pergunta ${n + 1}`} disabled={n === lista.length - 1} onClick={() => mover(n, 1)}><ArrowDown /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remover pergunta ${n + 1}`} onClick={() => setLista((l) => l.filter((x) => x.id !== f.id))}><X /></Button>
            </div>
          </li>
        ))}
      </ul>
      <Button type="button" variant="ghost" size="sm" className="mt-2 min-h-11 text-(--terracota) hover:text-(--terracota-escura)" onClick={() => setLista((l) => [...l, { id: prox.current++, p: "", r: "" }])}>
        <Plus /> Adicionar pergunta
      </Button>
    </fieldset>
  );
}
