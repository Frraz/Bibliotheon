"use client";

import { useActionState, useState } from "react";
import { criarEbook, importarManifesto, type Retorno } from "@/app/painel/(menu)/ebooks/acoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function FormNovoEbook() {
  const [r, acao, criando] = useActionState<Retorno | null, FormData>(criarEbook, null);
  return (
    <>
    <form action={acao} className="mt-8 space-y-5">
      <div>
        <Label htmlFor="titulo" className="mb-1.5 text-[0.9375rem] font-medium">Título do livro</Label>
        <Input id="titulo" name="titulo" required minLength={2} maxLength={140} autoFocus autoComplete="off" defaultValue="" />
        <p className="mt-1.5 text-sm text-(--tinta-2) text-pretty">Pode mudar depois. O endereço da página nasce do título e fica editável até a primeira publicação.</p>
      </div>
      {r?.erros && <p role="alert" className="text-[0.9375rem] text-(--perigo)">{r.erros[0]}</p>}
      <Button type="submit" size="lg" disabled={criando}>{criando ? "Criando…" : "Criar e continuar"}</Button>
    </form>
    <ImportarManifesto />
    </>
  );
}

// Para quem produz no ../ebooks: o manifest.json traz textos, tema, preço e lojas, e o editor já nasce preenchido.
function ImportarManifesto() {
  const [r, acao, importando] = useActionState<Retorno | null, FormData>(importarManifesto, null);
  // Controlado: o React 19 limpa os campos depois de cada action, e quem colou o manifesto não pode perdê-lo por causa de um erro.
  const [texto, setTexto] = useState("");
  return (
    <details className="mt-10 border-t border-(--filete) pt-6" open={!!r?.erros}>
      <summary className="cursor-pointer text-[0.9375rem] font-medium">Já tenho o manifesto do livro (manifest.json)</summary>
      <form action={acao} className="mt-4 space-y-4">
        <p className="text-sm text-(--tinta-2) text-pretty">Gerado pelo <code>./livro manifesto</code>. Cria um rascunho já preenchido; a capa e as amostras você envia na próxima tela.</p>
        <div>
          <Label htmlFor="manifest" className="mb-1.5 text-[0.9375rem] font-medium">Cole o conteúdo do arquivo</Label>
          <Textarea id="manifest" name="manifest" rows={6} spellCheck={false} value={texto} onChange={(e) => setTexto(e.target.value)} className="font-mono text-sm" />
        </div>
        <div>
          <Label htmlFor="arquivo" className="mb-1.5 text-[0.9375rem] font-medium">…ou escolha o arquivo</Label>
          <Input id="arquivo" name="arquivo" type="file" accept=".json,application/json" />
        </div>
        {r?.erros && (
          <ul role="alert" className="space-y-1 text-[0.9375rem] text-(--perigo)">
            {r.erros.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
        <Button type="submit" variant="outline" disabled={importando}>{importando ? "Importando…" : "Importar e continuar"}</Button>
      </form>
    </details>
  );
}
