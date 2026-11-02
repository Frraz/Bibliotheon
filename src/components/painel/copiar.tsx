"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** Copia um texto e confirma no próprio botão por 2 s. */
export function Copiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function copiar() {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <Button type="button" variant="outline" onClick={copiar} aria-label={`Copiar ${rotulo}`}>
      {copiado ? <Check className="text-(--salvia)" /> : <Copy />}
      <span aria-live="polite">{copiado ? "Copiado" : "Copiar"}</span>
    </Button>
  );
}
