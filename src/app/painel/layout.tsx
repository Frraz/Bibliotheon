import type { Metadata } from "next";

// Tudo em /painel fica fora do Google (a prévia dos livros também). O menu lateral está em (menu)/layout.tsx.
export const metadata: Metadata = { title: "Painel", robots: { index: false, follow: false } };

export default function PainelRaiz({ children }: LayoutProps<"/painel">) {
  return children;
}
