"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function FormEsqueci() {
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    setEstado(null);
    setEnviando(true);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/redefinir-senha" });
    setEnviando(false);
    if (error?.status === 429) return setEstado({ ok: false, texto: "Muitos pedidos. Espere um minuto e tente de novo." });
    if (error) return setEstado({ ok: false, texto: "Não foi possível pedir agora. Tente de novo; se continuar, avise o administrador." });
    // A resposta é a mesma exista a conta ou não: a tela não revela quem tem cadastro.
    setEstado({ ok: true, texto: "Pronto. Se esse e-mail estiver cadastrado, o link chega em alguns minutos. Olhe também o spam." });
  }

  return (
    <form onSubmit={enviar} className="mt-6 space-y-5">
      <div>
        <Label htmlFor="email" className="mb-1.5 text-[0.9375rem] font-medium">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {estado && <p role={estado.ok ? "status" : "alert"} className={`text-[0.9375rem] text-pretty ${estado.ok ? "text-(--salvia)" : "text-(--perigo)"}`}>{estado.texto}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={enviando}>{enviando ? "Enviando…" : "Enviar link"}</Button>
    </form>
  );
}
