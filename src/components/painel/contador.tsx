"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

/** Campo com contador de caracteres e aviso suave ao passar do ideal (não bloqueia). */
export function CampoContado({ id, inicial, ideal }: { id: string; inicial: string; ideal: number }) {
  const [v, setV] = useState(inicial);
  const passou = v.length > ideal;
  return (
    <div>
      <Input id={id} value={v} onChange={(e) => setV(e.target.value)} aria-describedby={`${id}-n`} />
      <p id={`${id}-n`} className={`mt-1.5 text-sm ${passou ? "text-(--terracota-escura)" : "text-(--tinta-2)"}`}>
        {v.length} de {ideal} caracteres{passou ? ": títulos longos são cortados no Google e no celular" : ""}
      </p>
    </div>
  );
}
