import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Protótipo visual",
  robots: { index: false, follow: false },
};

const telas = [
  { href: "/prototipo/entrar", rotulo: "Entrar" },
  { href: "/prototipo/painel", rotulo: "E-books" },
  { href: "/prototipo/painel/editor", rotulo: "Editor" },
  { href: "/prototipo/painel/editor/lojas", rotulo: "Outras lojas" },
  { href: "/prototipo/painel/usuarios", rotulo: "Usuários" },
  { href: "/prototipo/compra", rotulo: "Compra" },
];

export default function PrototipoLayout({ children }: LayoutProps<"/prototipo">) {
  // Os protótipos do painel (Etapa 1) não vão para produção; viram o painel de verdade na Etapa 3.
  if (process.env.NODE_ENV === "production" && !process.env.PROTOTIPO) notFound();
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 bg-neutral-900 px-4 py-2 text-xs text-neutral-300">
        <span className="text-neutral-400">Protótipo do painel · números e e-books de demonstração</span>
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1" aria-label="Telas do protótipo">
          {telas.map((d) => (
            <Link key={d.href} href={d.href} className="font-medium text-white underline-offset-4 hover:underline">{d.rotulo}</Link>
          ))}
        </nav>
      </div>
      {children}
    </>
  );
}
