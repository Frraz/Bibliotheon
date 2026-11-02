"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { brl, precoVigente } from "@/lib/preco";

// Preço e urgência no navegador. O servidor entrega o estado do momento em que o cache foi preenchido
// (`inicial`); depois de abrir, o navegador recalcula com a hora real. Assim, quando a oferta vence, a
// faixa some e o preço sobe sozinho mesmo com a página em cache.

type Vigente = { valor: number | null; riscado: number | null; ate: string | null; emOferta: boolean };
export type DadosOferta = { preco: number | null; precoDe: number | null; ofertaAte: string | null; ofertaNome: string | null; emBreve: boolean; inicial: Vigente };

const PASSO = 30_000;
const assinar = (avisar: () => void) => {
  const id = setInterval(avisar, PASSO);
  return () => clearInterval(id);
};
// Arredondado ao passo para o valor ser estável entre leituras (exigência do React).
const agoraNoCliente = () => Math.floor(Date.now() / PASSO) * PASSO;
const agoraNoServidor = () => null;

type Estado = { vigente: Vigente; agora: number | null; nome: string };
const Contexto = createContext<Estado | null>(null);

export function OfertaProvider({ dados, children }: { dados: DadosOferta; children: React.ReactNode }) {
  const agora = useSyncExternalStore(assinar, agoraNoCliente, agoraNoServidor);
  const estado = useMemo<Estado>(() => {
    const nome = dados.ofertaNome?.trim() || "Preço promocional";
    if (agora === null) return { vigente: dados.inicial, agora, nome };
    const v = precoVigente(dados, new Date(agora));
    return { vigente: { ...v, ate: v.ate ? v.ate.toISOString() : null }, agora, nome };
  }, [agora, dados]);
  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

function useOferta() {
  const e = useContext(Contexto);
  if (!e) throw new Error("Use dentro de <OfertaProvider>");
  return e;
}

export function PrecoAtual({ className }: { className?: string }) {
  const { vigente } = useOferta();
  return vigente.valor == null ? null : <span className={className}>{brl(vigente.valor)}</span>;
}

export function PrecoDe({ className }: { className?: string }) {
  const { vigente } = useOferta();
  return vigente.riscado == null ? null : (
    <s className={className}>
      <span className="sr-only">Preço normal: </span>
      {brl(vigente.riscado)}
    </s>
  );
}

function restante(ate: string, agora: number) {
  const m = Math.max(0, Math.floor((new Date(ate).getTime() - agora) / 60000));
  return `${Math.floor(m / 1440)} d ${String(Math.floor((m % 1440) / 60)).padStart(2, "0")} h ${String(m % 60).padStart(2, "0")} min`;
}

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const horaCurta = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(":", "h").replace(/h00$/, "h");

/** Faixa de urgência. Só existe com data real de fim; some sozinha quando o prazo acaba. */
export function FaixaUrgencia({ className = "" }: { className?: string }) {
  const { vigente, agora, nome } = useOferta();
  if (!vigente.emOferta || !vigente.ate) return null;
  return (
    <div className={`flex min-h-[3.75rem] items-center justify-center px-5 py-2.5 text-center text-sm sm:min-h-10 ${className}`}>
      <p>
        {nome} até <span className="whitespace-nowrap">{dataCurta(vigente.ate)}</span>
        <span className="mx-2 opacity-40" aria-hidden>|</span>
        faltam{" "}
        {/* Antes de hidratar, reserva o mesmo espaço (algarismos tabulares) para a página não se mexer */}
        <span className="font-semibold whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums", visibility: agora === null ? "hidden" : undefined }}>
          {agora === null ? "00 d 00 h 00 min" : restante(vigente.ate, agora)}
        </span>
      </p>
    </div>
  );
}

/** "Black Friday até 30/11" para o bloco de compra; nada fora da oferta. */
export function PrazoOferta({ className }: { className?: string }) {
  const { vigente, nome } = useOferta();
  return vigente.emOferta && vigente.ate ? <span className={className}>{nome} até {dataCurta(vigente.ate)}</span> : null;
}

/** A consequência do prazo, sempre ao lado do preço: "Até 30/11 às 23h59. Depois, R$ 64,99." Sem campanha, não existe. */
export function AvisoPrazo({ className }: { className?: string }) {
  const { vigente } = useOferta();
  if (!vigente.emOferta || !vigente.ate) return null;
  const hora = horaCurta(vigente.ate);
  return (
    <p className={className}>
      Até {dataCurta(vigente.ate)} às <span className="whitespace-nowrap">{hora}.</span>
      {vigente.riscado != null && vigente.riscado !== vigente.valor && <> Depois, <span className="whitespace-nowrap">{brl(vigente.riscado)}.</span></>}
    </p>
  );
}

/** "até 30/11" para a barra fixa do celular, onde cabe pouco. */
export function PrazoCurto({ className }: { className?: string }) {
  const { vigente } = useOferta();
  return vigente.emOferta && vigente.ate ? <span className={className}>até {dataCurta(vigente.ate)}</span> : null;
}
