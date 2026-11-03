"use client";

import { useEffect, useRef, useState } from "react";
import { CHAVE_ESTADO, INTERVALO_MS, VERSICULO_INICIAL, lerEstado, proximoQueCabe, type Estado, type Versiculo } from "@/lib/versiculos";

const novaSemente = () => Math.floor(Math.random() * 2 ** 31);
const SAIDA_MS = 300;
const BUSCA_MS = 6000; // bem depois do carregamento: o arquivo não compete com a página, e o versículo inicial já está na tela

function guardar(e: Estado) {
  try {
    localStorage.setItem(CHAVE_ESTADO, JSON.stringify(e));
  } catch {
    // navegação privada ou armazenamento cheio: só perde a continuação na próxima visita
  }
}

/**
 * Faixa de versículos, logo abaixo do cabeçalho. Altura fixa (nenhuma troca empurra a página).
 * O arquivo com os versículos só é buscado alguns segundos depois de a página abrir; se falhar, o versículo inicial fica.
 * A troca para com a aba oculta, com o mouse ou o foco de teclado sobre a faixa e no botão de pausa. Só mouse e teclado: no toque, o
 * "hover" fica grudado depois de tocar no botão, e a troca não voltaria.
 * Fora da troca nada se move: o brilho e o fio (keyframes em globals.css) só existem durante ela.
 */
export function FaixaVersiculos() {
  const [atual, setAtual] = useState<Versiculo>(VERSICULO_INICIAL);
  const [trocas, setTrocas] = useState(0);
  const [saindo, setSaindo] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [emFoco, setEmFoco] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const lista = useRef<Versiculo[]>([]);
  const estado = useRef<Estado | null>(null);

  useEffect(() => {
    let ativo = true;
    const buscar = () => {
      fetch("/versiculos.json")
        .then((r) => (r.ok ? r.json() : []))
        .then((v: Versiculo[]) => {
          if (!ativo || !Array.isArray(v) || !v.length) return;
          lista.current = v;
          let guardado: string | null = null;
          try {
            guardado = localStorage.getItem(CHAVE_ESTADO);
          } catch {}
          estado.current = lerEstado(guardado, v.length, novaSemente);
          setCarregado(true);
        })
        .catch(() => {});
    };
    const id = setTimeout(buscar, BUSCA_MS);
    return () => {
      ativo = false;
      clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    if (!carregado || pausado || emFoco) return;
    let relogio: ReturnType<typeof setInterval> | undefined;
    let saida: ReturnType<typeof setTimeout> | undefined;

    const trocar = () => {
      const r = proximoQueCabe(lista.current, estado.current!, window.innerWidth, novaSemente);
      if (!r) return;
      estado.current = r.estado;
      guardar(r.estado);
      const aplicar = () => {
        setAtual(r.versiculo);
        setTrocas((n) => n + 1);
        setSaindo(false);
      };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return aplicar();
      setSaindo(true);
      saida = setTimeout(aplicar, SAIDA_MS);
    };
    const ligar = () => {
      clearInterval(relogio);
      if (!document.hidden) relogio = setInterval(trocar, INTERVALO_MS);
    };

    ligar();
    document.addEventListener("visibilitychange", ligar);
    return () => {
      clearInterval(relogio);
      clearTimeout(saida);
      document.removeEventListener("visibilitychange", ligar);
    };
  }, [carregado, pausado, emFoco]);

  return (
    <aside
      data-versiculos
      aria-label="Versículo bíblico"
      onPointerEnter={(ev) => ev.pointerType === "mouse" && setEmFoco(true)}
      onPointerLeave={(ev) => ev.pointerType === "mouse" && setEmFoco(false)}
      onFocus={(ev) => ev.target.matches(":focus-visible") && setEmFoco(true)}
      onBlur={() => setEmFoco(false)}
      className="relative overflow-hidden bg-(--tinta) text-(--papel)"
    >
      {trocas > 0 && (
        <span key={`luz-${trocas}`} aria-hidden className="faixa-versiculos-efeito pointer-events-none absolute inset-0">
          <span className="faixa-versiculos-luz absolute top-1/2 left-1/2 h-[14rem] w-[min(46rem,120%)] rounded-[50%]" />
          <span className="faixa-versiculos-fio absolute inset-x-0 bottom-0 h-px bg-(--ouro-versiculo)" />
        </span>
      )}
      <div className="relative mx-auto flex h-[4.5rem] max-w-6xl items-center gap-1 pr-1 pl-4 sm:h-[3.25rem] sm:px-5">
        {/* aria-live desligado: um leitor de tela não pode ser interrompido a cada 10 segundos. */}
        <p
          key={`texto-${trocas}`}
          aria-live="off"
          className={`min-w-0 flex-1 text-center font-(family-name:--font-display) text-[0.84375rem] leading-[1.4] text-pretty sm:text-[0.90625rem] ${saindo ? "faixa-versiculos-sai" : trocas > 0 ? "faixa-versiculos-entra" : ""}`}
        >
          <span>{atual.t}</span> <cite className="whitespace-nowrap text-(--ouro-versiculo) not-italic">{atual.r}</cite>
        </p>
        <button
          type="button"
          onClick={() => setPausado((p) => !p)}
          aria-pressed={pausado}
          aria-label={pausado ? "Continuar a troca de versículos" : "Pausar a troca de versículos"}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center text-(--papel)/55 transition-colors duration-150 hover:text-(--ouro-versiculo) focus-visible:text-(--ouro-versiculo) focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-(--ouro-versiculo)"
        >
          <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden>
            {pausado ? <path d="M4 2.5v11l9-5.5z" /> : <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" />}
          </svg>
        </button>
      </div>
    </aside>
  );
}
