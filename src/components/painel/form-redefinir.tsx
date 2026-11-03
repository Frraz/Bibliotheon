"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { SENHA_MINIMA } from "@/lib/regras-senha";

export function FormRedefinir({ token }: { token: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const nova = String(d.get("nova"));
    if (nova.length < SENHA_MINIMA) return setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
    if (nova !== d.get("confirmar")) return setErro("A confirmação não é igual à senha.");
    setErro(null);
    setEnviando(true);
    const { error } = await authClient.resetPassword({ newPassword: nova, token });
    if (error) {
      setEnviando(false);
      return setErro(error.status === 400 ? "Este link venceu ou já foi usado. Peça um novo." : "Não foi possível salvar agora. Tente de novo.");
    }
    router.push("/entrar?senha=nova");
  }

  return (
    <form onSubmit={enviar} className="mt-6 space-y-5">
      <div>
        <Label htmlFor="nova" className="mb-1.5 text-[0.9375rem] font-medium">Senha nova</Label>
        <Input id="nova" name="nova" type="password" required minLength={SENHA_MINIMA} autoComplete="new-password" />
        <p className="mt-1.5 text-sm text-(--tinta-2)">Pelo menos {SENHA_MINIMA} caracteres.</p>
      </div>
      <div>
        <Label htmlFor="confirmar" className="mb-1.5 text-[0.9375rem] font-medium">Repita a senha</Label>
        <Input id="confirmar" name="confirmar" type="password" required autoComplete="new-password" />
      </div>
      {erro && <p role="alert" className="text-[0.9375rem] text-(--perigo) text-pretty">{erro}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={enviando}>{enviando ? "Salvando…" : "Salvar senha"}</Button>
    </form>
  );
}
