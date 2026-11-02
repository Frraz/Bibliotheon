import Link from "next/link";

export const metadata = {
  title: "Protótipo visual",
  robots: { index: false, follow: false },
};

const direcoes = [
  { href: "/prototipo/a", rotulo: "A · Livraria" },
  { href: "/prototipo/b", rotulo: "B · Oficina" },
  { href: "/prototipo/c", rotulo: "C · Direta" },
];

export default function PrototipoLayout({ children }: LayoutProps<"/prototipo">) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 bg-neutral-900 px-4 py-2 text-xs text-neutral-300">
        <span className="text-neutral-400">
          Protótipo · preço, prazo e plataformas são de demonstração
        </span>
        <nav className="flex gap-4" aria-label="Direções">
          {direcoes.map((d) => (
            <Link key={d.href} href={d.href} className="font-medium text-white underline-offset-4 hover:underline">
              {d.rotulo}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </>
  );
}
