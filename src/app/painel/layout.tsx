import type { Metadata } from "next";
import { Suspense } from "react";
import { BotaoSair } from "@/components/painel/botao-sair";
import { PainelNav, type ItemNav } from "@/components/painel/nav";
import { Marca } from "@/components/site/marca";
import { exigirUsuario } from "@/lib/acesso";
import { ehOwner } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Painel", robots: { index: false, follow: false } };

// A sessão é lida dentro de componentes com <Suspense> (Cache Components): o layout não espera pelo banco.
async function Menu() {
  const u = await exigirUsuario();
  const itens: ItemNav[] = [
    { href: "/painel", rotulo: "E-books", icone: "livros" },
    ...(ehOwner(u) ? [{ href: "/painel/usuarios", rotulo: "Usuários", icone: "usuarios" } as const] : []),
    { href: "/painel/conta", rotulo: "Conta", icone: "conta" },
  ];
  return <PainelNav itens={itens} />;
}

async function Quem() {
  const u = await exigirUsuario();
  return (
    <>
      <p className="text-[0.9375rem] font-medium">{u.nome}</p>
      <p className="text-sm text-(--tinta-2)">{ehOwner(u) ? "Administrador" : "Publicador"}</p>
    </>
  );
}

const Esqueleto = () => <div aria-hidden className="mx-auto max-w-5xl animate-pulse space-y-4 px-5 py-12 lg:px-10"><div className="h-9 w-48 bg-(--papel-2)" /><div className="h-24 bg-(--papel-2)" /></div>;

export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <div className="min-h-dvh bg-(--papel) font-(family-name:--font-texto) text-[1rem] leading-[1.55] text-(--tinta) lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-(--filete) bg-(--papel-2) lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-5 py-4 lg:py-6">
          <Marca className="inline-block py-2.5" />
          <div className="lg:hidden"><BotaoSair /></div>
        </div>
        <Suspense fallback={<div aria-hidden className="h-14 lg:h-40" />}>
          <Menu />
        </Suspense>
        <div className="mt-auto hidden px-5 py-5 lg:block">
          <Suspense fallback={<div aria-hidden className="h-10" />}>
            <Quem />
          </Suspense>
          <div className="mt-3"><BotaoSair /></div>
        </div>
      </aside>
      <main className="min-w-0">
        <Suspense fallback={<Esqueleto />}>{children}</Suspense>
      </main>
    </div>
  );
}
