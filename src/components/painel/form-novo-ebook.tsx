"use client";

import { useActionState } from "react";
import { criarEbook, type Retorno } from "@/app/painel/(menu)/ebooks/acoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FormNovoEbook() {
  const [r, acao, criando] = useActionState<Retorno | null, FormData>(criarEbook, null);
  return (
    <form action={acao} className="mt-8 space-y-5">
      <div>
        <Label htmlFor="titulo" className="mb-1.5 text-[0.9375rem] font-medium">Título do livro</Label>
        <Input id="titulo" name="titulo" required minLength={2} maxLength={140} autoFocus autoComplete="off" defaultValue="" />
        <p className="mt-1.5 text-sm text-(--tinta-2) text-pretty">Pode mudar depois. O endereço da página nasce do título e fica editável até a primeira publicação.</p>
      </div>
      {r?.erros && <p role="alert" className="text-[0.9375rem] text-(--perigo)">{r.erros[0]}</p>}
      <Button type="submit" size="lg" disabled={criando}>{criando ? "Criando…" : "Criar e continuar"}</Button>
    </form>
  );
}
