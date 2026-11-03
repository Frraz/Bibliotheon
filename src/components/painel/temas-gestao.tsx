"use client";

import { Plus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { alterarTema, criarTema, salvarTema, type RetornoTema } from "@/app/painel/(menu)/temas/acoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type TemaLinha = { id: string; nome: string; slug: string; descricao: string; ebooks: number; publicado: boolean };

function Formulario({ tema, aoFechar }: { tema?: TemaLinha; aoFechar: () => void }) {
  const acao = tema ? salvarTema.bind(null, tema.id) : criarTema;
  const [r, enviar, enviando] = useActionState<RetornoTema | null, FormData>(async (anterior, dados) => {
    const res = await acao(anterior, dados);
    if (res.ok) aoFechar();
    return res;
  }, null);
  return (
    <form action={enviar} className="mt-4 grid grid-cols-1 gap-4 border border-(--filete) bg-(--papel-3) p-4 sm:p-5">
      <div>
        <Label htmlFor={`nome-${tema?.id ?? "novo"}`} className="mb-1.5 text-[0.9375rem] font-medium">Nome</Label>
        <Input id={`nome-${tema?.id ?? "novo"}`} name="nome" defaultValue={tema?.nome} required maxLength={60} autoFocus />
      </div>
      <div>
        <Label htmlFor={`desc-${tema?.id ?? "novo"}`} className="mb-1.5 text-[0.9375rem] font-medium">Descrição (aparece na página do tema e no Google)</Label>
        <Textarea id={`desc-${tema?.id ?? "novo"}`} name="descricao" defaultValue={tema?.descricao} maxLength={400} className="min-h-24" />
        <p className="mt-1.5 text-sm text-(--tinta-2) text-pretty">Escreva o que quem procura esse assunto quer resolver.</p>
      </div>
      {r?.erro && <p role="alert" className="text-[0.9375rem] text-(--perigo)">{r.erro}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando}>{enviando ? "Salvando…" : tema ? "Salvar tema" : "Criar tema"}</Button>
        <Button type="button" variant="ghost" onClick={aoFechar}>Cancelar</Button>
      </div>
    </form>
  );
}

export function TemasGestao({ temas }: { temas: TemaLinha[] }) {
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-(family-name:--font-display) text-[2rem] leading-none font-medium tracking-[-0.01em]">Temas</h1>
        <Button size="lg" onClick={() => setNovo(true)}><Plus /> Novo tema</Button>
      </div>
      <p className="mt-3 max-w-2xl text-(--tinta-2) text-pretty">Temas agrupam os e-books na Home e em páginas próprias. <strong className="font-medium text-(--tinta)">Tema fora do ar esconde os e-books dele</strong>, mesmo os publicados.</p>
      {novo && <Formulario aoFechar={() => setNovo(false)} />}
      {temas.length === 0 && !novo && <p className="mt-8 text-(--tinta-2)">Nenhum tema ainda. E-books sem tema aparecem normalmente.</p>}
      <ul className="mt-8 border-t border-(--filete)">
        {temas.map((t) => (
          <li key={t.id} className="border-b border-(--filete) py-5">
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <div className="min-w-0">
                <p className="font-(family-name:--font-display) text-[1.1875rem] leading-snug font-medium">{t.nome}</p>
                <p className="mt-0.5 text-sm break-words text-(--tinta-2)">/tema/{t.slug} · {t.ebooks === 1 ? "1 e-book" : `${t.ebooks} e-books`}</p>
              </div>
              <label className="flex min-h-11 items-center gap-2.5 text-sm">
                <Switch checked={t.publicado} disabled={ocupado} aria-label={`${t.nome} no ar`} onCheckedChange={(v) => iniciar(async () => { await alterarTema(t.id, v); })} />
                {t.publicado ? "No ar" : "Fora do ar"}
              </label>
              <Button type="button" variant="outline" onClick={() => setEditando(editando === t.id ? null : t.id)}>Editar</Button>
            </div>
            {editando === t.id && <Formulario tema={t} aoFechar={() => setEditando(null)} />}
          </li>
        ))}
      </ul>
    </>
  );
}
