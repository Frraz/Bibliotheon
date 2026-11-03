import Link from "next/link";
import { CONTATO_EMAIL } from "@/lib/site";
import { Marca } from "./marca";

// Cabeçalho e rodapé do site, em duas versões:
// - padrão: o do layout, com os tokens da marca (creme);
// - discreto: para landing personalizada. Não tem cor própria: herda a da faixa onde está (currentColor + opacidade), então
//   serve a qualquer paleta. Leva `data-moldura-propria`, e o CSS (globals.css) esconde o do layout enquanto essa landing
//   está na tela. A landing o põe como primeiro filho (cabeçalho) e último (rodapé) da sua raiz colorida.

export function CabecalhoSite({ discreto = false, className = "" }: { discreto?: boolean; className?: string }) {
  if (!discreto) {
    return (
      <header data-cabecalho-site className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Marca />
        <Link href="/" className="text-[0.9375rem] text-(--tinta-2) underline-offset-4 transition-colors hover:text-(--tinta) hover:underline">Todos os e-books</Link>
      </header>
    );
  }
  return (
    <header data-moldura-propria className={`border-b border-current/10 ${className}`}>
      <div className="mx-auto flex min-h-12 max-w-6xl items-center justify-between px-5">
        <Marca herdarCor pequena className="opacity-85" />
        <Link href="/" className="inline-flex min-h-11 items-center text-sm underline-offset-4 opacity-70 transition-opacity hover:underline hover:opacity-100">Todos os e-books</Link>
      </div>
    </header>
  );
}

const Contato = ({ className }: { className: string }) => (
  <>
    <Link href="/termos" className={className}>Termos</Link> · <Link href="/privacidade" className={className}>Privacidade</Link>
    {CONTATO_EMAIL && <> · <a href={`mailto:${CONTATO_EMAIL}`} className={className}>{CONTATO_EMAIL}</a></>}
  </>
);

export function RodapeSite({ discreto = false }: { discreto?: boolean }) {
  if (!discreto) {
    return (
      <footer data-rodape-site className="border-t border-(--filete) px-5 py-12 text-center text-sm text-(--tinta-2)">
        <Marca />
        <p className="mx-auto mt-3 max-w-md text-pretty">Biblioteca de e-books práticos. Pagamento, entrega e reembolso são feitos pela plataforma onde você comprar.</p>
        <p className="mt-3"><Contato className="inline-block px-1 py-2 underline-offset-4 hover:underline" /></p>
      </footer>
    );
  }
  return (
    <footer className="border-t border-current/10 px-5 py-10 text-center text-sm">
      <Marca herdarCor pequena className="opacity-85" />
      <p className="mx-auto mt-3 max-w-md text-pretty opacity-70">Biblioteca de e-books práticos. Pagamento, entrega e reembolso são feitos pela plataforma onde você comprar.</p>
      <p className="mt-2 opacity-70"><Contato className="inline-block px-1 py-2 underline-offset-4 hover:underline" /></p>
    </footer>
  );
}
