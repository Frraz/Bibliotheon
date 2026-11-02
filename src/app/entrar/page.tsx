import type { Metadata } from "next";
import { FormEntrar } from "@/components/painel/form-entrar";
import { Marca } from "@/components/site/marca";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

export default function Entrar() {
  return (
    <main className="grid min-h-dvh place-items-center bg-(--papel) px-5 py-12 font-(family-name:--font-texto) text-(--tinta)">
      <div className="w-full max-w-sm">
        <Marca />
        <h1 className="mt-10 font-(family-name:--font-display) text-[2rem] leading-none font-medium tracking-[-0.01em]">Entrar</h1>
        <FormEntrar />
        <p className="mt-6 text-sm text-(--tinta-2) text-pretty">Esqueceu a senha? Fale com o administrador. O acesso é só para quem publica e-books aqui.</p>
      </div>
    </main>
  );
}
