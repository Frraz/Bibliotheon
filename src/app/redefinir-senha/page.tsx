import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormRedefinir } from "@/components/painel/form-redefinir";
import { Marca } from "@/components/site/marca";

export const metadata: Metadata = { title: "Senha nova", robots: { index: false, follow: false }, referrer: "no-referrer" };

// O token chega na URL (vem do link do e-mail): a página é dinâmica e não manda o endereço adiante como referência.
async function Conteudo({ searchParams }: { searchParams: PageProps<"/redefinir-senha">["searchParams"] }) {
  const { token } = await searchParams;
  const valor = typeof token === "string" ? token : "";
  if (!valor) {
    return (
      <p role="alert" className="mt-6 text-[0.9375rem] text-pretty">
        Este link venceu ou já foi usado. <Link href="/esqueci-a-senha" className="underline underline-offset-4">Peça um novo</Link>.
      </p>
    );
  }
  return <FormRedefinir token={valor} />;
}

export default function RedefinirSenha({ searchParams }: PageProps<"/redefinir-senha">) {
  return (
    <main className="grid min-h-dvh place-items-center bg-(--papel) px-5 py-12 font-(family-name:--font-texto) text-(--tinta)">
      <div className="w-full max-w-sm">
        <Marca />
        <h1 className="mt-10 font-(family-name:--font-display) text-[2rem] leading-none font-medium tracking-[-0.01em]">Senha nova</h1>
        <Suspense fallback={null}>
          <Conteudo searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
