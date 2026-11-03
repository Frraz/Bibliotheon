"use client";

import { ArrowLeft, ArrowRight, FileText, ImagePlus, Lock, Plus, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// Envio de arquivos do editor. Valem na hora (não esperam o "Salvar" do texto) e atualizam a tela em seguida.

const base = (id: string) => `/api/painel/ebooks/${id}`;

function useEnvio() {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  async function chamar(url: string, init: RequestInit, aoTerminar?: (j: Record<string, unknown>) => string) {
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetch(url, init);
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) setMsg({ ok: false, texto: String(j.erro ?? "Não foi possível enviar. Tente de novo.") });
      else {
        setMsg(aoTerminar ? { ok: true, texto: aoTerminar(j) } : null);
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, texto: "Sem conexão com o servidor. Tente de novo." });
    }
    setOcupado(false);
  }
  const enviar = (url: string, arquivos: File[], aoTerminar?: (j: Record<string, unknown>) => string) => {
    const f = new FormData();
    arquivos.forEach((a) => f.append("arquivo", a));
    return chamar(url, { method: "POST", body: f }, aoTerminar);
  };
  return { ocupado, msg, chamar, enviar };
}

const Mensagem = ({ msg }: { msg: { ok: boolean; texto: string } | null }) =>
  msg ? <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-sm ${msg.ok ? "text-(--salvia)" : "text-(--perigo)"}`}>{msg.texto}</p> : null;

const IMAGENS = "image/jpeg,image/png,image/webp";

export function UploadCapa({ id, capa, alt }: { id: string; capa: string | null; alt: string }) {
  const { ocupado, msg, enviar } = useEnvio();
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="mb-1.5 text-[0.9375rem] font-medium">Capa</p>
      <div className="flex flex-col gap-5 border border-dashed border-(--filete) bg-(--papel-3) p-5 sm:flex-row sm:items-center">
        {capa ? (
          <Image src={capa} alt={alt || "Capa atual"} width={1600} height={2560} sizes="96px" className="h-auto w-24 shrink-0 shadow-[0_2px_6px_rgb(0_0_0/.25)]" />
        ) : (
          <div className="grid aspect-[1600/2560] w-24 shrink-0 place-items-center bg-(--papel-2) text-sm text-(--tinta-2)">Sem capa</div>
        )}
        <div className="min-w-0">
          <p className="text-sm text-(--tinta-2) text-pretty">JPG, PNG ou WebP, com pelo menos 1200 px de largura e até 10 MB. A capa vale na hora.</p>
          <input ref={entrada} type="file" accept={IMAGENS} className="sr-only" tabIndex={-1} aria-label="Arquivo da capa" onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(`${base(id)}/capa`, [f], (j) => `Capa enviada (${j.largura}×${j.altura} px, ${j.kb} KB).`); e.target.value = ""; }} />
          <Button type="button" variant="outline" className="mt-3" disabled={ocupado} onClick={() => entrada.current?.click()}><ImagePlus /> {ocupado ? "Enviando…" : capa ? "Trocar capa" : "Enviar capa"}</Button>
          <Mensagem msg={msg} />
        </div>
      </div>
    </div>
  );
}

export type AmostraLinha = { id: string; src: string; alt: string };

export function AmostrasEditor({ id, amostras, limite }: { id: string; amostras: AmostraLinha[]; limite: number }) {
  const { ocupado, msg, chamar, enviar } = useEnvio();
  const entrada = useRef<HTMLInputElement>(null);
  const reordenar = (n: number, passo: number) => {
    const ids = amostras.map((a) => a.id);
    [ids[n], ids[n + passo]] = [ids[n + passo], ids[n]];
    return chamar(`${base(id)}/amostras`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ordem: ids }) });
  };
  return (
    <div>
      <p className="mb-2 text-[0.9375rem] font-medium">Páginas de amostra</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {amostras.map((a, i) => (
          <li key={a.id}>
            <div className="relative">
              <Image src={a.src} alt={a.alt} width={800} height={1280} sizes="(min-width:640px) 180px, 45vw" className="h-auto w-full ring-1 ring-(--filete)" />
              <span className="absolute bottom-1.5 left-1.5 grid size-6 place-items-center bg-(--tinta) text-xs text-(--papel)">{i + 1}</span>
            </div>
            <div className="flex justify-between">
              <Button type="button" variant="ghost" size="icon" aria-label={`Mover página ${i + 1} para trás`} disabled={ocupado || i === 0} onClick={() => reordenar(i, -1)}><ArrowLeft /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remover página ${i + 1}`} disabled={ocupado} onClick={() => chamar(`${base(id)}/amostras?amostra=${a.id}`, { method: "DELETE" })}><X /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Mover página ${i + 1} para a frente`} disabled={ocupado || i === amostras.length - 1} onClick={() => reordenar(i, 1)}><ArrowRight /></Button>
            </div>
          </li>
        ))}
        {amostras.length < limite && (
          <li>
            <input ref={entrada} type="file" accept={IMAGENS} multiple className="sr-only" tabIndex={-1} aria-label="Arquivos das páginas de amostra" onChange={(e) => { const fs = [...(e.target.files ?? [])]; if (fs.length) enviar(`${base(id)}/amostras`, fs, () => `${fs.length === 1 ? "Página enviada" : `${fs.length} páginas enviadas`}.`); e.target.value = ""; }} />
            <button type="button" disabled={ocupado} onClick={() => entrada.current?.click()} className="grid aspect-[800/1280] w-full cursor-pointer place-items-center border border-dashed border-(--filete) text-sm text-(--tinta-2) transition-colors hover:border-(--tinta) hover:text-(--tinta) disabled:opacity-50">
              <span className="grid justify-items-center gap-1"><Plus className="size-5" />{ocupado ? "Enviando…" : "Adicionar"}</span>
            </button>
          </li>
        )}
      </ul>
      <p className="mt-2 text-sm text-(--tinta-2)">De 3 a {limite} páginas, JPG, PNG ou WebP com pelo menos 600 px de largura. Mostre páginas que ajudem a decidir.</p>
      <Mensagem msg={msg} />
    </div>
  );
}

export function PdfDoLivro({ id, nome }: { id: string; nome: string | null }) {
  const { ocupado, msg, enviar } = useEnvio();
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="mb-1.5 text-[0.9375rem] font-medium">Arquivo do livro (PDF)</p>
      <div className="flex flex-col gap-4 border border-dashed border-(--filete) bg-(--papel-3) p-5 sm:flex-row sm:items-center">
        <FileText className="size-8 shrink-0 text-(--tinta-2)" aria-hidden />
        <div className="min-w-0 sm:flex-1">
          {nome ? <p className="font-medium break-words">{nome}</p> : <p className="text-(--tinta-2)">Nenhum PDF enviado.</p>}
          <p className="mt-0.5 text-sm text-(--tinta-2)">Até 25 MB.</p>
          <p className="mt-2 flex items-start gap-2 text-sm text-(--salvia)"><Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Privado: não aparece na página de vendas. Só você e o administrador conseguem baixar.</p>
          <Mensagem msg={msg} />
        </div>
        <div className="flex flex-wrap gap-2 sm:self-start">
          <input ref={entrada} type="file" accept="application/pdf" className="sr-only" tabIndex={-1} aria-label="Arquivo PDF do livro" onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(`${base(id)}/pdf`, [f], (j) => `PDF enviado (${j.kb} KB).`); e.target.value = ""; }} />
          <Button type="button" variant="outline" disabled={ocupado} onClick={() => entrada.current?.click()}>{ocupado ? "Enviando…" : nome ? "Trocar PDF" : "Enviar PDF"}</Button>
          {nome && <Button variant="ghost" render={<a href={`${base(id)}/pdf`} download />}>Baixar</Button>}
        </div>
      </div>
    </div>
  );
}

export function AmostraPdf({ id, url }: { id: string; url: string | null }) {
  const { ocupado, msg, chamar, enviar } = useEnvio();
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="mb-1.5 text-[0.9375rem] font-medium">Amostra em PDF (opcional)</p>
      <p className="mb-3 text-sm text-(--tinta-2) text-pretty">A pessoa recebe em troca do e-mail. Este arquivo é público: coloque só as páginas de amostra, nunca o livro inteiro. Até 15 MB.</p>
      <input ref={entrada} type="file" accept="application/pdf" className="sr-only" tabIndex={-1} aria-label="Arquivo PDF da amostra" onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(`${base(id)}/amostra-pdf`, [f], () => "Amostra enviada."); e.target.value = ""; }} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={ocupado} onClick={() => entrada.current?.click()}><Plus /> {url ? "Trocar amostra em PDF" : "Enviar amostra em PDF"}</Button>
        {url && <Button variant="ghost" render={<a href={url} target="_blank" rel="noopener" />}>Ver amostra</Button>}
        {url && <Button type="button" variant="ghost" disabled={ocupado} onClick={() => chamar(`${base(id)}/amostra-pdf`, { method: "DELETE" })}>Remover</Button>}
      </div>
      <Mensagem msg={msg} />
    </div>
  );
}
