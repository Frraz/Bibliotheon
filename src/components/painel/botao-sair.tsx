"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function BotaoSair() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push("/entrar");
        router.refresh(); // esquece as páginas do painel guardadas no navegador
      }}
      className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-(--tinta-2) hover:text-(--tinta)"
    >
      <LogOut className="size-4" aria-hidden /> Sair
    </button>
  );
}
