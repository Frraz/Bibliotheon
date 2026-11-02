import Link from "next/link";
import { Consentimento } from "@/components/site/rastreio";
import { Marca } from "@/components/site/marca";
import { CONTATO_EMAIL } from "@/lib/site";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-(--papel) font-(family-name:--font-texto) text-(--tinta)">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Marca />
        <Link href="/" className="text-[0.9375rem] text-(--tinta-2) underline-offset-4 transition-colors hover:text-(--tinta) hover:underline">Todos os e-books</Link>
      </header>
      <main className="border-t border-(--filete)">{children}</main>
      <footer className="border-t border-(--filete) px-5 py-12 text-center text-sm text-(--tinta-2)">
        <Marca />
        <p className="mx-auto mt-3 max-w-md text-pretty">Biblioteca de e-books práticos. Pagamento, entrega e reembolso são feitos pela plataforma onde você comprar.</p>
        <p className="mt-3">
          <Link href="/termos" className="inline-block px-1 py-2 underline-offset-4 hover:underline">Termos</Link> · <Link href="/privacidade" className="inline-block px-1 py-2 underline-offset-4 hover:underline">Privacidade</Link>
          {CONTATO_EMAIL && <> · <a href={`mailto:${CONTATO_EMAIL}`} className="inline-block px-1 py-2 underline-offset-4 hover:underline">{CONTATO_EMAIL}</a></>}
        </p>
      </footer>
      <Consentimento />
    </div>
  );
}
