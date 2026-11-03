"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { avisosDeSeo, IDEAL_DESCRICAO_SEO, IDEAL_TITULO_SEO } from "@/lib/seo";

/** Campo com contador de caracteres e aviso suave ao passar do ideal (não bloqueia). */
export function CampoContado({ id, inicial, ideal }: { id: string; inicial: string; ideal: number }) {
  const [v, setV] = useState(inicial);
  const passou = v.length > ideal;
  return (
    <div>
      <Input id={id} name={id} value={v} onChange={(e) => setV(e.target.value)} aria-describedby={`${id}-n`} />
      <p id={`${id}-n`} className={`mt-1.5 text-sm ${passou ? "text-(--terracota-escura)" : "text-(--tinta-2)"}`}>
        {v.length} de {ideal} caracteres{passou ? ": títulos longos são cortados no Google e no celular" : ""}
      </p>
    </div>
  );
}

/** Título e descrição para o Google, com contador e avisos ao digitar. Os avisos orientam e nunca impedem de salvar. */
export function CamposDoGoogle({ titulo, descricao }: { titulo: string; descricao: string }) {
  const [t, setT] = useState(titulo);
  const [d, setD] = useState(descricao);
  const avisos = avisosDeSeo(t, d);
  return (
    <>
      <div>
        <Label htmlFor="seoTitle" className="mb-1.5 text-[0.9375rem] font-medium">Título para o Google</Label>
        <Input id="seoTitle" name="seoTitle" value={t} onChange={(e) => setT(e.target.value)} maxLength={120} aria-describedby="seoTitle-n" />
        <p id="seoTitle-n" className="mt-1.5 text-sm text-(--tinta-2)">{t.trim().length} de {IDEAL_TITULO_SEO} caracteres</p>
      </div>
      <div>
        <Label htmlFor="seoDescription" className="mb-1.5 text-[0.9375rem] font-medium">Descrição para o Google</Label>
        <Textarea id="seoDescription" name="seoDescription" value={d} onChange={(e) => setD(e.target.value)} className="min-h-20" maxLength={300} aria-describedby="seoDescription-n" />
        <p id="seoDescription-n" className="mt-1.5 text-sm text-(--tinta-2)">{d.trim().length} de {IDEAL_DESCRICAO_SEO} caracteres</p>
      </div>
      {avisos.length > 0 && (
        <ul aria-live="polite" className="space-y-1.5 text-sm text-(--terracota-escura) text-pretty">
          {avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}
    </>
  );
}
