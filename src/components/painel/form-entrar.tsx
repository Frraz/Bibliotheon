"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function FormEntrar() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    setErro(null);
    setEnviando(true);
    const { error } = await authClient.signIn.email({ email: String(dados.get("email")).trim(), password: String(dados.get("senha")) });
    if (error) {
      setErro(error.status === 429 ? "Muitas tentativas. Espere alguns segundos e tente de novo." : "E-mail ou senha incorretos, ou o acesso foi desativado.");
      setEnviando(false);
      return;
    }
    router.push("/painel");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="mt-8 space-y-5">
      <div>
        <Label htmlFor="email" className="mb-1.5 text-[0.9375rem] font-medium">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="senha" className="mb-1.5 text-[0.9375rem] font-medium">Senha</Label>
        <Input id="senha" name="senha" type="password" autoComplete="current-password" required />
      </div>
      {erro && <p role="alert" className="text-[0.9375rem] text-(--perigo) text-pretty">{erro}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</Button>
    </form>
  );
}
