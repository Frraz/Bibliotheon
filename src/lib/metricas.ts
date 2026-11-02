import { sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { metricaDiaria } = schema;

/** Data de hoje no fuso do negócio (AAAA-MM-DD). */
export const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** Pré-visualizadores de link e robôs não contam como visita nem como clique. */
export const ehBot = (userAgent: string | null) =>
  !userAgent || /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|curl|wget|headless|lighthouse/i.test(userAgent);

/** Soma 1 ao contador do dia. `ofertaId` vazio = visita; preenchido = clique naquela oferta. Sem IP, sem cookie. */
export function contar(ebookId: string, origem: string, ofertaId = "") {
  db.insert(metricaDiaria)
    .values({ ebookId, data: hojeSP(), ofertaId, origem, contagem: 1 })
    .onConflictDoUpdate({
      target: [metricaDiaria.ebookId, metricaDiaria.data, metricaDiaria.ofertaId, metricaDiaria.origem],
      set: { contagem: sql`${metricaDiaria.contagem} + 1` },
    })
    .run();
}
