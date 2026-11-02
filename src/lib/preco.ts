// Regra de preço e urgência (docs/03-tecnico.md, "Regras de negócio", nº 1).
// `preco` = preço de lançamento · `precoDe` = preço normal · `ofertaAte` = fim real da promoção.
// Tudo em centavos. Função pura: o "agora" entra como argumento para ser testável.

export type EntradaPreco = {
  preco: number | null;
  precoDe: number | null;
  ofertaAte: Date | string | number | null;
  emBreve?: boolean;
};

export type PrecoVigente = {
  /** Preço a cobrar agora; null quando o livro ainda não tem preço ou está "em breve". */
  valor: number | null;
  /** Preço normal para mostrar riscado; só existe enquanto a oferta vale ou se o autor o definiu sem prazo. */
  riscado: number | null;
  /** Fim da oferta, só enquanto ela está valendo (alimenta a contagem regressiva). */
  ate: Date | null;
  emOferta: boolean;
};

export function precoVigente(e: EntradaPreco, agora: Date): PrecoVigente {
  if (e.emBreve || e.preco == null) return { valor: null, riscado: null, ate: null, emOferta: false };

  const fim = e.ofertaAte == null ? null : new Date(e.ofertaAte);
  if (fim && !Number.isNaN(fim.getTime())) {
    if (fim.getTime() > agora.getTime()) {
      return { valor: e.preco, riscado: e.precoDe, ate: fim, emOferta: true };
    }
    // Prazo vencido: o preço volta ao normal sozinho, sem faixa nem preço riscado.
    return { valor: e.precoDe ?? e.preco, riscado: null, ate: null, emOferta: false };
  }

  // Sem prazo: preço fixo. O "de" só aparece se o autor o definiu (o painel avisa que deve ser um preço real).
  return { valor: e.preco, riscado: e.precoDe, ate: null, emOferta: false };
}

export const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Conta do relatório. Taxa pública da Hotmart em 02/11/2026 (a página oficial mostra R$ 2,49 e R$ 1; usa-se a maior até
// conferir no painel). A comissão de afiliado é a sugerida na estratégia (docs/04) e sua base de cálculo é uma estimativa.
const TAXA_PERCENTUAL = 0.099;
const TAXA_FIXA = 249;
const COMISSAO_AFILIADO = 0.4;

/** Quanto sobra de uma venda, em centavos, antes de impostos e reembolsos. */
export function liquidoPorVenda(valor: number, comAfiliado = false) {
  const semTaxa = valor - Math.round(valor * TAXA_PERCENTUAL) - TAXA_FIXA;
  return comAfiliado ? Math.round(semTaxa * (1 - COMISSAO_AFILIADO)) : semTaxa;
}
