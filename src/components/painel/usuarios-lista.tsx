"use client";

import { KeyRound, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Copiar } from "./copiar";

export type UsuarioLinha = { id: string; nome: string; email: string; ebooks: number; publicados: number; ativo: boolean; admin?: boolean };

const SENHA_DEMO = "demo-k7Pq-29xL";

function SenhaTemporaria({ nome, aoFechar }: { nome: string; aoFechar: () => void }) {
  return (
    <div role="status" className="mt-4 bg-(--salvia)/12 p-4">
      <p className="text-[0.9375rem] font-medium">Senha temporária de {nome}</p>
      <p className="mt-1 text-sm text-(--tinta-2) text-pretty">Ela aparece só agora. Envie à pessoa e peça que troque em Conta no primeiro acesso.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 bg-(--papel-3) px-3 py-2.5 text-[0.9375rem] break-all">{SENHA_DEMO}</code>
        <Copiar texto={SENHA_DEMO} rotulo="senha temporária" />
        <Button type="button" variant="ghost" onClick={aoFechar}>Fechar</Button>
      </div>
    </div>
  );
}

/** Lista de usuários: Novo usuário é a ação principal; desativar pede confirmação na própria linha. */
export function UsuariosLista({ iniciais }: { iniciais: UsuarioLinha[] }) {
  const prox = useRef(iniciais.length);
  const [usuarios, setUsuarios] = useState(iniciais);
  const [novo, setNovo] = useState(false);
  const [senhaDe, setSenhaDe] = useState<string | null>(null);
  const [desativando, setDesativando] = useState<string | null>(null);
  const [tirarDoAr, setTirarDoAr] = useState(false);

  function criar(form: FormData) {
    const nome = String(form.get("nome") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    if (!nome || !email) return;
    const id = `novo-${prox.current++}`;
    setUsuarios((u) => [...u, { id, nome, email, ebooks: 0, publicados: 0, ativo: true }]);
    setNovo(false);
    setSenhaDe(id);
  }

  function confirmarDesativar(id: string) {
    setUsuarios((u) => u.map((x) => (x.id === id ? { ...x, ativo: false, publicados: tirarDoAr ? 0 : x.publicados } : x)));
    setDesativando(null);
    setTirarDoAr(false);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-(family-name:--font-display) text-[2rem] leading-none font-medium tracking-[-0.01em]">Usuários</h1>
        <Button size="lg" onClick={() => setNovo(true)}><Plus /> Novo usuário</Button>
      </div>
      <p className="mt-3 max-w-2xl text-(--tinta-2) text-pretty">Só quem você cadastrar consegue entrar. Usuário ativo publica os próprios e-books direto, sem passar por você.</p>

      {novo && (
        <form action={criar} className="mt-8 grid grid-cols-1 items-end gap-4 border border-(--filete) bg-(--papel-3) p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:p-5">
          <div>
            <Label htmlFor="novo-nome" className="mb-1.5 text-[0.9375rem] font-medium">Nome</Label>
            <Input id="novo-nome" name="nome" required autoComplete="off" autoFocus />
          </div>
          <div>
            <Label htmlFor="novo-email" className="mb-1.5 text-[0.9375rem] font-medium">E-mail</Label>
            <Input id="novo-email" name="email" type="email" required autoComplete="off" />
          </div>
          <Button type="submit">Criar e gerar senha</Button>
          <Button type="button" variant="ghost" onClick={() => setNovo(false)}>Cancelar</Button>
        </form>
      )}

      <ul className="mt-8 border-t border-(--filete)">
        {usuarios.map((u) => (
          <li key={u.id} className="border-b border-(--filete) py-5">
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <div className="min-w-0">
                <p className="font-(family-name:--font-display) text-[1.1875rem] leading-snug font-medium">{u.nome}</p>
                <p className="mt-0.5 text-sm break-words text-(--tinta-2)">{u.email}</p>
                <p className="mt-1 text-sm text-(--tinta-2)">
                  {u.ebooks === 1 ? "1 e-book" : `${u.ebooks} e-books`}, {u.publicados} no ar
                </p>
              </div>
              {u.admin ? (
                <p className="text-sm font-medium text-(--tinta-2) sm:col-span-2 sm:text-right">Administrador</p>
              ) : (
                <>
                  <label className="flex min-h-11 items-center gap-2.5 text-sm">
                    <Switch
                      checked={u.ativo}
                      aria-label={`${u.nome} ativo`}
                      onCheckedChange={(ligar) => {
                        if (ligar) setUsuarios((l) => l.map((x) => (x.id === u.id ? { ...x, ativo: true } : x)));
                        else setDesativando(u.id);
                      }}
                    />
                    {u.ativo ? "Ativo" : "Desativado"}
                  </label>
                  <Button type="button" variant="outline" onClick={() => setSenhaDe(u.id)}><KeyRound /> Redefinir senha</Button>
                </>
              )}
            </div>

            {desativando === u.id && (
              <div role="alertdialog" aria-label={`Desativar ${u.nome}`} className="mt-4 border border-(--perigo)/40 bg-(--papel-3) p-4">
                <p className="text-[0.9375rem] font-medium">Desativar {u.nome}?</p>
                <p className="mt-1 text-sm text-(--tinta-2) text-pretty">A pessoa perde o acesso na hora.</p>
                {u.publicados > 0 && (
                  <label className="mt-3 flex min-h-11 items-center gap-3 text-[0.9375rem]">
                    <input type="checkbox" checked={tirarDoAr} onChange={(e) => setTirarDoAr(e.target.checked)} className="size-5 shrink-0 accent-(--terracota)" />
                    Tirar do ar também os {u.publicados} e-books dessa pessoa
                  </label>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="destructive" onClick={() => confirmarDesativar(u.id)}>Desativar</Button>
                  <Button type="button" variant="ghost" onClick={() => { setDesativando(null); setTirarDoAr(false); }}>Cancelar</Button>
                </div>
              </div>
            )}
            {senhaDe === u.id && <SenhaTemporaria nome={u.nome} aoFechar={() => setSenhaDe(null)} />}
          </li>
        ))}
      </ul>
    </>
  );
}
