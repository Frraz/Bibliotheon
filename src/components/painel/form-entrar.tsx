"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

// Cada erro tem a sua mensagem: dizer "senha incorreta" quando o servidor falhou esconde o problema de quem opera o site.
function mensagemDeErro(erro: { status: number; code?: string }) {
  if (erro.status === 429) return "Muitas tentativas. Espere alguns segundos e tente de novo.";
  if (erro.code === "ACESSO_DESATIVADO") return "Seu acesso está desativado. Fale com o administrador.";
  if (erro.status === 401) return "E-mail ou senha incorretos.";
  return `Não foi possível entrar agora (erro ${erro.status || "de rede"}). Tente de novo; se continuar, avise o administrador.`;
}

function mensagemDoCodigo(erro: { status: number; code?: string }) {
  if (erro.status === 429) return "Muitas tentativas. Espere alguns segundos e tente de novo.";
  if (erro.code === "ACESSO_DESATIVADO") return "Seu acesso está desativado. Fale com o administrador.";
  if (erro.status === 401 || erro.status === 400) return "Código incorreto ou vencido. Confira o código atual no aplicativo ou, se passaram 10 minutos, volte e entre de novo.";
  if (erro.status === 403) return "Muitos códigos errados. Espere alguns minutos e tente de novo.";
  return `Não foi possível conferir o código (erro ${erro.status || "de rede"}). Tente de novo.`;
}

export function FormEntrar() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [segundaEtapa, setSegundaEtapa] = useState(false);
  const [reserva, setReserva] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    setErro(null);
    setEnviando(true);
    const { data, error } = await authClient.signIn.email({ email: String(dados.get("email")).trim(), password: String(dados.get("senha")) });
    if (error) {
      setErro(mensagemDeErro(error));
      setEnviando(false);
      return;
    }
    if ((data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
      setSegundaEtapa(true);
      setEnviando(false);
      return;
    }
    router.push("/painel");
    router.refresh();
  }

  async function conferirCodigo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const codigo = String(new FormData(e.currentTarget).get("codigo")).replace(/\s/g, "");
    setErro(null);
    setEnviando(true);
    const { error } = reserva ? await authClient.twoFactor.verifyBackupCode({ code: codigo }) : await authClient.twoFactor.verifyTotp({ code: codigo });
    if (error) {
      setErro(mensagemDoCodigo(error));
      setEnviando(false);
      return;
    }
    router.push("/painel");
    router.refresh();
  }

  if (segundaEtapa) {
    return (
      <form onSubmit={conferirCodigo} className="mt-8 space-y-5" key={reserva ? "reserva" : "app"}>
        <p className="text-[0.9375rem] text-(--tinta-2) text-pretty">
          {reserva ? "Digite um dos códigos de reserva que você guardou. Cada um vale uma vez." : "Abra o aplicativo autenticador e digite o código de 6 números do Bibliotheon."}
        </p>
        <div>
          <Label htmlFor="codigo" className="mb-1.5 text-[0.9375rem] font-medium">{reserva ? "Código de reserva" : "Código do aplicativo"}</Label>
          <Input id="codigo" name="codigo" inputMode={reserva ? "text" : "numeric"} autoComplete="one-time-code" autoFocus required />
        </div>
        {erro && <p role="alert" className="text-[0.9375rem] text-(--perigo) text-pretty">{erro}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={enviando}>{enviando ? "Conferindo…" : "Confirmar"}</Button>
        <div className="flex flex-wrap gap-x-5 text-sm">
          <button type="button" className="min-h-11 underline underline-offset-4" onClick={() => { setReserva(!reserva); setErro(null); }}>
            {reserva ? "Usar o código do aplicativo" : "Usar um código de reserva"}
          </button>
          <button type="button" className="min-h-11 underline underline-offset-4" onClick={() => { setSegundaEtapa(false); setReserva(false); setErro(null); }}>Voltar</button>
        </div>
      </form>
    );
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
