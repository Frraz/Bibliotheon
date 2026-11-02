"use client";

import { useSyncExternalStore } from "react";

const PASSO = 30_000;

function assinar(avisar: () => void) {
  const id = setInterval(avisar, PASSO);
  return () => clearInterval(id);
}
// O relógio é arredondado ao passo para o valor ser estável entre leituras (exigência do React).
const agoraNoCliente = () => Math.floor(Date.now() / PASSO) * PASSO;
// No servidor (e na hidratação) não há "agora": mostra traços, para não haver diferença entre os dois.
const agoraNoServidor = () => null;

function restante(ate: string, agora: number) {
  const ms = Math.max(0, new Date(ate).getTime() - agora);
  const m = Math.floor(ms / 60000);
  return { d: Math.floor(m / 1440), h: Math.floor((m % 1440) / 60), m: m % 60, fim: ms === 0 };
}

/** Contagem real até `ate`. Some sozinha quando o prazo acaba. */
export function Contagem({ ate, className }: { ate: string; className?: string }) {
  const agora = useSyncExternalStore(assinar, agoraNoCliente, agoraNoServidor);

  // Mesmo tamanho do valor real (algarismos tabulares), invisível: a página não se mexe ao hidratar.
  if (agora === null)
    return (
      <span className={className} style={{ fontVariantNumeric: "tabular-nums", visibility: "hidden" }}>
        00 d 00 h 00 min
      </span>
    );
  const t = restante(ate, agora);
  if (t.fim) return null;
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {t.d} d {String(t.h).padStart(2, "0")} h {String(t.m).padStart(2, "0")} min
    </span>
  );
}
