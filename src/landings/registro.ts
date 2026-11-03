import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { CartaoEbook, EbookPublico } from "@/lib/catalogo";

/** O que uma página personalizada recebe: os mesmos dados do banco que a landing padrão. */
export type PropsLanding = { e: EbookPublico; relacionados: CartaoEbook[]; previa: boolean };
export type Registro = ReadonlyMap<string, ComponentType<PropsLanding>>;

/**
 * Páginas de vendas personalizadas: slug do e-book → componente com o CORPO da página (só as seções).
 * O molde (preço vigente e contagem da campanha, dados estruturados, visita) é aplicado por fora, em `PaginaDeVendas`,
 * e o texto, o preço, as lojas e a campanha continuam vindo do painel: mudar preço ou link não exige novo deploy.
 * Quem não está aqui usa a landing padrão. Receita completa em docs/03-tecnico.md ("Landing personalizada").
 *
 * Com `dynamic`: as fontes e o CSS de uma página personalizada não pesam nas outras.
 */
export const personalizadas: Registro = new Map<string, ComponentType<PropsLanding>>([
  ["a-mente-inabalavel", dynamic(() => import("./a-mente-inabalavel/pagina").then((m) => m.PaginaAMenteInabalavel))],
  ["natal-a-mesa", dynamic(() => import("./natal-a-mesa/pagina").then((m) => m.PaginaNatalAMesa))],
  ["criar-sistemas-com-ia", dynamic(() => import("./criar-sistemas-com-ia/pagina").then((m) => m.PaginaCriarSistemas))],
]);

/** Map e não objeto: um slug como "constructor" ou "__proto__" nunca pode casar com uma propriedade herdada. */
export const temPersonalizada = (slug: string, registro: Registro = personalizadas) => registro.has(slug);
