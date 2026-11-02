import { LogOut } from "lucide-react";
import { Marca } from "@/components/site/marca";
import { PainelNav, type ItemNav } from "@/components/painel/nav";

const itens: ItemNav[] = [
  { href: "/prototipo/painel", rotulo: "E-books", icone: "livros" },
  { href: "#", rotulo: "Temas", icone: "temas" },
  { href: "/prototipo/painel/usuarios", rotulo: "Usuários", icone: "usuarios" },
  { href: "#", rotulo: "Conta", icone: "conta" },
];

export default function PainelLayout({ children }: LayoutProps<"/prototipo/painel">) {
  return (
    <div className="min-h-dvh bg-(--papel) font-(family-name:--font-texto) text-[1rem] leading-[1.55] text-(--tinta) lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-(--filete) bg-(--papel-2) lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-5 py-4 lg:py-6">
          <Marca />
        </div>
        <PainelNav itens={itens} />
        <div className="mt-auto hidden px-5 py-5 lg:block">
          <p className="text-[0.9375rem] font-medium">Warley Ferraz</p>
          <p className="text-sm text-(--tinta-2)">Administrador</p>
          <a href="#" className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm text-(--tinta-2) hover:text-(--tinta)">
            <LogOut className="size-4" aria-hidden /> Sair
          </a>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
