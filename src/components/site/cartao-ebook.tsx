import Image from "next/image";
import Link from "next/link";
import type { CartaoEbook } from "@/lib/catalogo";
import { brl } from "@/lib/preco";

/** Cartão do catálogo: capa, tema, título e preço vigente. Selo "Lançamento" só com oferta real em andamento. */
export function CartaoEbookLink({ c, nivel = 3 }: { c: CartaoEbook; nivel?: 2 | 3 }) {
  const Titulo = nivel === 2 ? "h2" : "h3"; // a hierarquia de títulos da página não pode pular nível
  return (
    <Link href={`/${c.slug}`} prefetch={false} className="group flex h-full flex-col focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--terracota)">
      {/* Caixa de proporção fixa (2:3, a proporção clássica de livro: aproxima as capas 001/002 (5:8) e a do 003 (cerca de 1:1,41) sem aparar demais nenhuma): capa de outra proporção é aparada pelo centro em vez de deixar o cartão mais baixo ou mais alto. */}
      <div className="relative">
        <div className="aspect-[2/3] overflow-hidden bg-(--papel-2) shadow-[0_2px_3px_rgb(0_0_0/.12),0_18px_36px_-14px_rgb(31_42_41/.45)] transition-transform duration-300 ease-out group-hover:-translate-y-1.5">
          {c.capa && (
            <Image
              src={c.capa}
              alt={c.capaAlt || `Capa de ${c.titulo}`}
              width={1600}
              height={2560}
              sizes="(min-width:1024px) 280px, 45vw"
              className="size-full object-cover"
            />
          )}
        </div>
        {c.vigente.emOferta && <span className="absolute top-3 left-0 bg-(--terracota) px-2.5 py-1 text-xs font-semibold text-(--papel)">Lançamento</span>}
      </div>
      {c.tema && <p className="mt-5 text-sm text-(--salvia)">{c.tema}</p>}
      <Titulo className="mt-1 font-(family-name:--font-display) text-lg leading-snug font-medium text-balance">{c.titulo}</Titulo>
      {/* O preço desce até o pé do cartão: na mesma linha da grade, os preços ficam alinhados mesmo com títulos de 1 e 2 linhas. */}
      <p className="mt-auto pt-2 font-medium">{c.vigente.valor != null ? brl(c.vigente.valor) : <span className="text-(--tinta-2)">Em breve</span>}</p>
    </Link>
  );
}
