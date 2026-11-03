"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { Copiar } from "./copiar";

type Passo =
  | { nome: "repouso" }
  | { nome: "senha"; acao: "ligar" | "desligar" | "codigos" }
  | { nome: "configurar"; uri: string; qr: string; chave: string; codigos: string[] }
  | { nome: "codigos"; codigos: string[]; novos: boolean };

const rotulo = "mb-1.5 text-[0.9375rem] font-medium";

function erroDaSenha(status: number) {
  if (status === 400 || status === 401) return "A senha não confere.";
  if (status === 429) return "Muitas tentativas. Espere alguns segundos e tente de novo.";
  return "Não foi possível agora. Tente de novo.";
}

function Codigos({ codigos }: { codigos: string[] }) {
  return (
    <div className="mt-4 bg-(--papel-3) p-4">
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[0.9375rem]">
        {codigos.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <div className="mt-3"><Copiar texto={codigos.join("\n")} rotulo="códigos de reserva" /></div>
    </div>
  );
}

/** Verificação em duas etapas, opcional: app autenticador (TOTP) + códigos de reserva. Sempre pede a senha para ligar, desligar ou trocar os códigos. */
export function DuasEtapas({ ativada }: { ativada: boolean }) {
  const [ativa, setAtiva] = useState(ativada);
  const [passo, setPasso] = useState<Passo>({ nome: "repouso" });
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cancelar = () => { setPasso({ nome: "repouso" }); setErro(null); };

  async function conferirSenha(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (passo.nome !== "senha") return;
    const password = String(new FormData(e.currentTarget).get("senha"));
    setErro(null);
    setOcupado(true);
    try {
      if (passo.acao === "ligar") {
        const { data, error } = await authClient.twoFactor.enable({ password, method: "totp" });
        if (error || data?.method !== "totp") return setErro(erroDaSenha(error?.status ?? 0));
        const { toDataURL } = await import("qrcode");
        const qr = await toDataURL(data.totpURI, { margin: 1, width: 192 });
        const chave = new URL(data.totpURI).searchParams.get("secret") ?? "";
        setPasso({ nome: "configurar", uri: data.totpURI, qr, chave, codigos: data.backupCodes });
      } else if (passo.acao === "desligar") {
        const { error } = await authClient.twoFactor.disable({ password });
        if (error) return setErro(erroDaSenha(error.status));
        setAtiva(false);
        setPasso({ nome: "repouso" });
      } else {
        const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });
        if (error || !data) return setErro(erroDaSenha(error?.status ?? 0));
        setPasso({ nome: "codigos", codigos: data.backupCodes, novos: true });
      }
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarCodigo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (passo.nome !== "configurar") return;
    const code = String(new FormData(e.currentTarget).get("codigo")).replace(/\s/g, "");
    setErro(null);
    setOcupado(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setOcupado(false);
    if (error) return setErro(error.status === 429 ? "Muitas tentativas. Espere alguns segundos." : "Esse código não confere. Confira o código atual do aplicativo e se o relógio do celular está certo.");
    setAtiva(true);
    setPasso({ nome: "codigos", codigos: passo.codigos, novos: false });
  }

  if (passo.nome === "senha") {
    const texto = { ligar: "Para ligar, confirme a sua senha.", desligar: "Para desligar, confirme a sua senha.", codigos: "Para gerar códigos de reserva novos, confirme a sua senha. Os códigos antigos deixam de valer." }[passo.acao];
    return (
      <form onSubmit={conferirSenha} className="space-y-4">
        <p className="text-[0.9375rem] text-(--tinta-2) text-pretty">{texto}</p>
        <div>
          <Label htmlFor="senha-2fa" className={rotulo}>Sua senha</Label>
          <Input id="senha-2fa" name="senha" type="password" required autoComplete="current-password" autoFocus />
        </div>
        {erro && <p role="alert" className="text-sm text-(--perigo)">{erro}</p>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={ocupado}>{ocupado ? "Conferindo…" : "Continuar"}</Button>
          <Button type="button" variant="ghost" onClick={cancelar}>Cancelar</Button>
        </div>
      </form>
    );
  }

  if (passo.nome === "configurar") {
    return (
      <form onSubmit={confirmarCodigo} className="space-y-4">
        <p className="text-[0.9375rem] text-(--tinta-2) text-pretty">
          1. No celular, abra um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy, 1Password…) e leia o QR code.
        </p>
        <div className="flex flex-wrap items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada na hora; não há o que otimizar */}
          <img src={passo.qr} alt="QR code para o aplicativo autenticador" width={192} height={192} className="bg-white" />
          <div className="min-w-0 text-sm text-(--tinta-2)">
            <p>Sem câmera? Digite esta chave no aplicativo:</p>
            <code className="mt-1.5 block bg-(--papel-3) px-3 py-2 text-[0.9375rem] break-all text-(--tinta)">{passo.chave}</code>
          </div>
        </div>
        <p className="text-[0.9375rem] text-(--tinta-2) text-pretty">2. Digite o código de 6 números que o aplicativo mostra agora.</p>
        <div>
          <Label htmlFor="codigo-2fa" className={rotulo}>Código do aplicativo</Label>
          <Input id="codigo-2fa" name="codigo" inputMode="numeric" autoComplete="one-time-code" required className="max-w-48" />
        </div>
        {erro && <p role="alert" className="text-sm text-(--perigo) text-pretty">{erro}</p>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={ocupado}>{ocupado ? "Conferindo…" : "Ligar a verificação"}</Button>
          <Button type="button" variant="ghost" onClick={cancelar}>Cancelar</Button>
        </div>
      </form>
    );
  }

  if (passo.nome === "codigos") {
    return (
      <div>
        <p role="status" className="text-[0.9375rem] font-medium text-(--salvia)">{passo.novos ? "Códigos novos gerados." : "Verificação em duas etapas ligada."}</p>
        <p className="mt-3 text-[0.9375rem] text-(--tinta-2) text-pretty">
          Guarde estes códigos de reserva num lugar seguro (gerenciador de senhas ou papel). Se você perder o celular, cada um deixa entrar uma vez. Eles aparecem só agora.
        </p>
        <Codigos codigos={passo.codigos} />
        <Button type="button" className="mt-5" onClick={cancelar}>Já guardei</Button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[0.9375rem] text-(--tinta-2) text-pretty">
        {ativa
          ? "Ligada. Ao entrar, além da senha, você digita o código do aplicativo autenticador."
          : "Desligada. É opcional: com ela, só entra quem tem a senha e o seu celular."}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {ativa ? (
          <>
            <Button type="button" variant="outline" onClick={() => setPasso({ nome: "senha", acao: "codigos" })}>Gerar códigos de reserva novos</Button>
            <Button type="button" variant="outline" onClick={() => setPasso({ nome: "senha", acao: "desligar" })}>Desligar</Button>
          </>
        ) : (
          <Button type="button" onClick={() => setPasso({ nome: "senha", acao: "ligar" })}>Ligar a verificação em duas etapas</Button>
        )}
      </div>
    </div>
  );
}
