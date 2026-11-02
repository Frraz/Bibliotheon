"use client";

import { BookOpen, Layers, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONES = { livros: BookOpen, temas: Layers, usuarios: Users, conta: UserRound } as const;

export type ItemNav = { href: string; rotulo: string; icone: keyof typeof ICONES };

/** Máximo de 4 itens (regra do painel). Lateral no desktop, grade no celular. O item ativo é o de href mais específico. */
export function PainelNav({ itens }: { itens: ItemNav[] }) {
  const caminho = usePathname();
  const ativoHref = itens
    .filter((i) => i.href !== "#" && (caminho === i.href || caminho.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="Painel" className={`grid gap-1 px-3 pb-3 lg:flex lg:flex-col lg:pb-0 ${itens.length === 4 ? "grid-cols-4" : itens.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {itens.map(({ href, rotulo, icone }) => {
        const Icone = ICONES[icone];
        const ativo = href === ativoHref;
        return (
          <Link
            key={rotulo}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded px-1 text-[0.8125rem] lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-[0.9375rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-(--terracota) ${
              ativo ? "bg-(--papel) text-(--tinta) shadow-[inset_3px_0_0_var(--terracota)]" : "text-(--tinta-2) hover:bg-(--papel)/60 hover:text-(--tinta)"
            }`}
          >
            <Icone className="size-[1.125rem]" aria-hidden />
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
