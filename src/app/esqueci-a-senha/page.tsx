import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { FormEsqueci } from "@/components/painel/form-esqueci";
import { Marca } from "@/components/site/marca";
import { emailConfigurado } from "@/lib/email";

export const metadata: Metadata = { title: "Esqueci a senha", robots: { index: false, follow: false } };

// Se o e-mail está configurado só se sabe na execução (o .env do servidor), então esta parte nunca é pré-renderizada.
async function Conteudo() {
  await connection();
  if (!emailConfigurado()) {
    return <p className="mt-6 text-[0.9375rem] text-(--tinta-2) text-pretty">A recuperação por e-mail ainda não está ligada. Fale com o administrador: ele cria uma senha temporária para você.</p>;
  }
  return (
    <>
      <p className="mt-4 text-[0.9375rem] text-(--tinta-2) text-pretty">Digite o e-mail da sua conta. Se ele estiver cadastrado, você recebe um link para criar uma senha nova.</p>
      <FormEsqueci />
    </>
  );
}

export default function EsqueciASenha() {
  return (
    <main className="grid min-h-dvh place-items-center bg-(--papel) px-5 py-12 font-(family-name:--font-texto) text-(--tinta)">
      <div className="w-full max-w-sm">
        <Marca />
        <h1 className="mt-10 font-(family-name:--font-display) text-[2rem] leading-none font-medium tracking-[-0.01em]">Esqueci a senha</h1>
        <Suspense fallback={null}>
          <Conteudo />
        </Suspense>
        <p className="mt-6 text-sm"><Link href="/entrar" className="underline underline-offset-4">Voltar para entrar</Link></p>
      </div>
    </main>
  );
}
