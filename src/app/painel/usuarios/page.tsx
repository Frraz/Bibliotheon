import { UsuariosGestao } from "@/components/painel/usuarios-gestao";
import { exigirOwner } from "@/lib/acesso";
import { listarUsuarios } from "@/lib/usuarios";

export default async function Usuarios() {
  await exigirOwner();
  const usuarios = listarUsuarios().map((u) => ({ ...u, administrador: u.papel === "owner" }));
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-12">
      <UsuariosGestao usuarios={usuarios} />
    </div>
  );
}
