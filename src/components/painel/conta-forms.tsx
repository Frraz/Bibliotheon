"use client";

import { useActionState, useState } from "react";
import { salvarNome, type ResultadoConta } from "@/app/painel/(menu)/conta/acoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { SENHA_MINIMA } from "@/lib/regras-senha";

const rotulo = "mb-1.5 text-[0.9375rem] font-medium";

export function FormNome({ nome }: { nome: string }) {
  const [r, acao, salvando] = useActionState<ResultadoConta | null, FormData>(salvarNome, null);
  return (
    <form action={acao} className="space-y-4">
      <div>
        <Label htmlFor="nome" className={rotulo}>Nome</Label>
        <Input id="nome" name="nome" defaultValue={nome} required autoComplete="name" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar nome"}</Button>
        {r?.ok && <p role="status" className="text-sm text-(--salvia)">Nome salvo.</p>}
        {r?.erro && <p role="alert" className="text-sm text-(--perigo)">{r.erro}</p>}
      </div>
    </form>
  );
}

export function FormSenha() {
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    const nova = String(d.get("nova"));
    if (nova.length < SENHA_MINIMA) return setMsg({ ok: false, texto: `A senha nova precisa ter pelo menos ${SENHA_MINIMA} caracteres.` });
    if (nova !== d.get("confirmar")) return setMsg({ ok: false, texto: "A confirmação não é igual à senha nova." });
    setEnviando(true);
    const { error } = await authClient.changePassword({ currentPassword: String(d.get("atual")), newPassword: nova, revokeOtherSessions: true });
    setEnviando(false);
    if (error) return setMsg({ ok: false, texto: error.status === 400 ? "A senha atual não confere." : "Não foi possível trocar a senha. Tente de novo." });
    form.reset();
    setMsg({ ok: true, texto: "Senha trocada. Em outros aparelhos você precisará entrar de novo." });
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div>
        <Label htmlFor="atual" className={rotulo}>Senha atual</Label>
        <Input id="atual" name="atual" type="password" required autoComplete="current-password" />
      </div>
      <div>
        <Label htmlFor="nova" className={rotulo}>Senha nova</Label>
        <Input id="nova" name="nova" type="password" required minLength={SENHA_MINIMA} autoComplete="new-password" />
        <p className="mt-1.5 text-sm text-(--tinta-2)">Pelo menos {SENHA_MINIMA} caracteres.</p>
      </div>
      <div>
        <Label htmlFor="confirmar" className={rotulo}>Repita a senha nova</Label>
        <Input id="confirmar" name="confirmar" type="password" required autoComplete="new-password" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={enviando}>{enviando ? "Trocando…" : "Trocar senha"}</Button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-(--salvia)" : "text-(--perigo)"}`}>{msg.texto}</p>}
      </div>
    </form>
  );
}
