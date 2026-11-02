"use client";

import { BookOpen, Layers, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const itens = [
  { href: "/prototipo/painel", rotulo: "E-books", Icone: BookOpen, dono: false },
  { href: "#", rotulo: "Temas", Icone: Layers, dono: true },
  { href: "#", rotulo: "Parceiros", Icone: Users, dono: true },
  { href: "#", rotulo: "Conta", Icone: UserRound, dono: false },
];

/** Máximo de 4 itens (regra do painel). Lateral no desktop, faixa rolável no celular. */
export function PainelNav() {
  const caminho = usePathname();
  return (
    <nav aria-label="Painel" className="grid grid-cols-4 gap-1 px-3 pb-3 lg:flex lg:flex-col lg:pb-0">
      {itens.map(({ href, rotulo, Icone }) => {
        const ativo = rotulo === "E-books" && caminho.startsWith("/prototipo/painel");
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
