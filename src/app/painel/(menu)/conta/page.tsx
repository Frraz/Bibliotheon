import { FormNome, FormSenha } from "@/components/painel/conta-forms";
import { exigirUsuario } from "@/lib/acesso";

export default async function Conta() {
  const u = await exigirUsuario();
  return (
    <div className="mx-auto max-w-xl px-5 py-8 lg:px-10 lg:py-12">
      <h1 className="font-(family-name:--font-display) text-[2rem] leading-none font-medium tracking-[-0.01em]">Conta</h1>
      <p className="mt-3 text-(--tinta-2) break-words">{u.email}</p>
      <section className="mt-10"><FormNome nome={u.nome} /></section>
      <section className="mt-12 border-t border-(--filete) pt-8">
        <h2 className="mb-5 font-(family-name:--font-display) text-[1.375rem] leading-none font-medium">Trocar a senha</h2>
        <FormSenha />
      </section>
    </div>
  );
}
