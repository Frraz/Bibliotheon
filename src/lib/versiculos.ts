// Regras puras da faixa de versículos (src/components/site/faixa-versiculos.tsx). O texto vem de public/versiculos.json.

export type Versiculo = { t: string; r: string };

/** Mostrado antes de o arquivo chegar: vem no HTML, igual no servidor e no navegador, para não haver erro de hidratação. */
export const VERSICULO_INICIAL: Versiculo = { t: "Tua palavra é lâmpada para meus pés e luz para meu caminho.", r: "Salmos 119:105" };

export const INTERVALO_MS = 10_000;
export const CHAVE_ESTADO = "bibliotheon:versiculos";

/** Abaixo desta largura a faixa tem altura para 3 linhas estreitas, e os versículos mais longos não entram. */
export const LARGURA_COMPLETA = 768;
export const MAXIMO_ESTREITO = 104;

export type Estado = { semente: number; pos: number; total: number };

/** Gerador simples com semente (mulberry32): a mesma semente dá sempre a mesma ordem. */
function aleatorio(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ordem embaralhada (Fisher-Yates) dos índices de 0 a total-1: passa por todos antes de repetir. */
export function ordemEmbaralhada(total: number, semente: number): number[] {
  const ordem = Array.from({ length: total }, (_, i) => i);
  const sorteio = aleatorio(semente);
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(sorteio() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }
  return ordem;
}

/** Lê o que foi guardado no navegador. Vazio, inválido ou de uma lista de outro tamanho: começa uma ordem nova. */
export function lerEstado(guardado: string | null, total: number, novaSemente: () => number): Estado {
  try {
    const e = JSON.parse(guardado ?? "null") as Partial<Estado> | null;
    if (e && e.total === total && Number.isInteger(e.semente) && Number.isInteger(e.pos) && e.pos! >= 0 && e.pos! < total) {
      return { semente: e.semente!, pos: e.pos!, total };
    }
  } catch {
    // conteúdo corrompido: segue para a ordem nova
  }
  return { semente: novaSemente(), pos: 0, total };
}

/** Passa para o próximo. Terminada a lista, recomeça em outra ordem. */
export function avancar(e: Estado, novaSemente: () => number): Estado {
  return e.pos + 1 < e.total ? { ...e, pos: e.pos + 1 } : { semente: novaSemente(), pos: 0, total: e.total };
}

/** Telas menores que 360 px (celular pequeno ou página muito ampliada) têm menos espaço por linha. */
export const MAXIMO_MINIMO = 90;

export const cabeNaLargura = (v: Versiculo, largura: number) => {
  if (largura >= LARGURA_COMPLETA) return true;
  return v.t.length + v.r.length <= (largura < 360 ? MAXIMO_MINIMO : MAXIMO_ESTREITO);
};

/**
 * Próximo versículo que cabe nesta tela, e o estado depois dele. Pula o que não cabe, sem perder a vez dos outros.
 * Devolve null se nada couber (lista vazia), e a faixa simplesmente mantém o que está mostrando.
 */
export function proximoQueCabe(lista: Versiculo[], e: Estado, largura: number, novaSemente: () => number): { versiculo: Versiculo; estado: Estado } | null {
  if (!lista.length) return null;
  let estado = e;
  for (let tentativas = 0; tentativas <= lista.length; tentativas++) {
    const v = lista[ordemEmbaralhada(lista.length, estado.semente)[estado.pos]];
    estado = avancar(estado, novaSemente);
    if (cabeNaLargura(v, largura)) return { versiculo: v, estado };
  }
  return null;
}
