import Link from "next/link";
import { Marca } from "@/components/site/marca";

export default function NaoEncontrada() {
  return (
    <div className="min-h-dvh bg-(--papel) px-5 py-8 font-(family-name:--font-texto) text-(--tinta)">
      <div className="mx-auto max-w-6xl"><Marca /></div>
      <div className="mx-auto mt-24 max-w-xl">
        <h1 className="font-(family-name:--font-display) text-[clamp(2.2rem,6vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.02em]">Página não encontrada</h1>
        <p className="mt-4 text-[1.125rem] text-(--tinta-2)">O endereço que você abriu não existe ou o e-book saiu do ar.</p>
        <Link href="/" className="mt-8 inline-flex min-h-12 items-center bg-(--terracota) px-7 font-semibold text-(--papel) hover:bg-(--terracota-escura)">Ver os e-books</Link>
      </div>
    </div>
  );
}
