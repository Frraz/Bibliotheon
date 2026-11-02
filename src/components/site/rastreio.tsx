"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";

// Medição com consentimento (LGPD). Sem ID de pixel/GA configurado, nada é carregado e o banner nem aparece.
// Os contadores próprios (/api/v1/v e /ir) não usam cookie nem dado pessoal e funcionam sempre.

const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GA = process.env.NEXT_PUBLIC_GA4_ID;
const CHAVE = "bibliotheon:consentimento";
const EVENTO = "bibliotheon:consentimento-mudou";

type W = Window & { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; dataLayer?: unknown[] };
type Escolha = "aceito" | "recusado" | null;

const ler = (): Escolha => {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === "aceito" || v === "recusado" ? v : null;
  } catch {
    return null;
  }
};
const assinar = (cb: () => void) => {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
};
// "carregando" no servidor/hidratação evita o banner piscar para quem já escolheu.
const useEscolha = () => useSyncExternalStore<Escolha | "carregando">(assinar, ler, () => "carregando");

/** Dispara um evento de conversão se o visitante consentiu e o pixel está carregado. Nunca lança erro. */
export function evento(nome: "ViewContent" | "InitiateCheckout", dados: { nome: string; valor?: number | null }) {
  const w = window as W;
  try {
    const valor = dados.valor != null ? dados.valor / 100 : undefined;
    w.fbq?.("track", nome, { content_name: dados.nome, ...(valor != null ? { value: valor, currency: "BRL" } : {}) });
    const ga = nome === "ViewContent" ? "view_item" : "begin_checkout";
    w.gtag?.("event", ga, { items: [{ item_name: dados.nome, price: valor }], currency: "BRL" });
  } catch {
    // medir nunca pode atrapalhar a página
  }
}

function carregar() {
  const w = window as W;
  if (PIXEL && !w.fbq) {
    const fbq = function (...a: unknown[]) {
      (fbq as unknown as { fila: unknown[] }).fila.push(a);
    };
    (fbq as unknown as { fila: unknown[] }).fila = [];
    w.fbq = fbq;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
    w.fbq("init", PIXEL);
    w.fbq("track", "PageView");
  }
  if (GA && !w.gtag) {
    w.dataLayer = w.dataLayer ?? [];
    w.gtag = function (...a: unknown[]) {
      w.dataLayer!.push(a);
    };
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA}`;
    document.head.appendChild(s);
    w.gtag("js", new Date());
    w.gtag("config", GA);
  }
}

export function Consentimento() {
  const escolha = useEscolha();
  const caminho = usePathname();
  const primeira = useRef(true);

  useEffect(() => {
    if (escolha === "aceito") carregar();
  }, [escolha]);

  // Navegação entre páginas não recarrega o site: registra a visualização manualmente (a primeira já foi no carregamento).
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    if (escolha !== "aceito") return;
    const w = window as W;
    w.fbq?.("track", "PageView");
    w.gtag?.("event", "page_view");
  }, [caminho, escolha]);

  if (!PIXEL && !GA) return null;
  if (escolha !== null) return null;

  const escolher = (v: "aceito" | "recusado") => {
    try {
      localStorage.setItem(CHAVE, v);
    } catch {
      /* navegação privada: a escolha vale só nesta página */
    }
    window.dispatchEvent(new Event(EVENTO));
  };

  return (
    <div role="dialog" aria-label="Cookies de medição" className="fixed inset-x-0 bottom-0 z-50 border-t border-(--filete) bg-(--papel) p-4 shadow-[0_-8px_24px_-12px_rgb(0_0_0/.25)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center">
        <p className="text-sm text-(--tinta-2) text-pretty">
          Usamos cookies de medição para saber quais páginas ajudam as pessoas e melhorar os anúncios. Você pode recusar e usar o site normalmente.{" "}
          <Link href="/privacidade" className="underline underline-offset-4">Política de privacidade</Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => escolher("recusado")} className="min-h-11 border border-(--filete) px-5 text-sm font-medium hover:border-(--tinta)">Recusar</button>
          <button type="button" onClick={() => escolher("aceito")} className="min-h-11 bg-(--tinta) px-5 text-sm font-medium text-(--papel) hover:bg-black">Aceitar</button>
        </div>
      </div>
    </div>
  );
}

/** Conta a visita (uma vez por e-book por sessão) e dispara ViewContent. Sem cookie nem dado pessoal. */
export function Visita({ slug, titulo, valor }: { slug: string; titulo: string; valor: number | null }) {
  useEffect(() => {
    try {
      const chave = `visita:${slug}`;
      if (!sessionStorage.getItem(chave)) {
        sessionStorage.setItem(chave, "1");
        const origem = new URLSearchParams(location.search).get("utm_source") ?? "";
        navigator.sendBeacon?.("/api/v1/v", JSON.stringify({ s: slug, o: origem }));
      }
    } catch {
      /* sem sessionStorage: não conta, não quebra */
    }
    evento("ViewContent", { nome: titulo, valor });
  }, [slug, titulo, valor]);
  return null;
}
