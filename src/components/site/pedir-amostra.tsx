"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

/** Troca o e-mail pela amostra em PDF. O link aparece na própria tela, sem depender de envio de e-mail. */
export function PedirAmostra({ slug }: { slug: string }) {
  const [estado, setEstado] = useState<"aberto" | "enviando" | "erro">("aberto");
  const [pdf, setPdf] = useState<string | null>(null);

  async function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setEstado("enviando");
    const dados = new FormData(ev.currentTarget);
    try {
      const r = await fetch("/api/v1/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          email: dados.get("email"),
          aceite: dados.get("aceite") === "on",
          site: dados.get("site"), // campo isca: pessoas não veem, robôs preenchem
          origem: new URLSearchParams(location.search).get("utm_source"),
        }),
      });
      if (!r.ok) throw new Error();
      setPdf(((await r.json()) as { pdf: string }).pdf);
    } catch {
      setEstado("erro");
    }
  }

  if (pdf) {
    return (
      <div role="status" className="mt-10 max-w-xl border-t border-(--papel)/25 pt-6">
        <p className="font-medium">Sua amostra está pronta.</p>
        <a href={pdf} className="mt-3 inline-flex min-h-12 items-center border border-(--papel)/40 px-6 font-medium transition-colors hover:border-(--papel) hover:bg-(--papel)/10">
          Baixar amostra (PDF)
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-10 max-w-xl border-t border-(--papel)/25 pt-6">
      <p className="font-medium">Quer ler mais antes de decidir? Receba a amostra em PDF.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="amostra-email">Seu e-mail</label>
        <input id="amostra-email" name="email" type="email" required autoComplete="email" placeholder="seu@email.com" className="min-h-12 w-full min-w-0 flex-1 border border-(--papel)/40 bg-transparent px-4 text-(--papel) placeholder:text-(--papel)/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--papel)" />
        <button type="submit" disabled={estado === "enviando"} className="inline-flex min-h-12 items-center justify-center border border-(--papel)/40 px-6 font-medium transition-colors hover:border-(--papel) hover:bg-(--papel)/10 disabled:opacity-60">
          {estado === "enviando" ? "Enviando…" : "Quero a amostra"}
        </button>
      </div>
      <input name="site" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-px" />
      <label className="mt-3 flex items-start gap-3 py-1 text-sm text-(--papel)/75">
        <input name="aceite" type="checkbox" required className="mt-0.5 size-5 shrink-0 accent-(--terracota)" />
        <span>Aceito receber a amostra e avisos sobre este livro por e-mail. Posso sair quando quiser. <Link href="/privacidade" className="underline underline-offset-4">Privacidade</Link></span>
      </label>
      {estado === "erro" && <p role="alert" className="mt-2 text-sm">Não foi possível enviar. Confira o e-mail e tente de novo.</p>}
    </form>
  );
}
