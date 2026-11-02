import { UsuariosLista } from "@/components/painel/usuarios-lista";

// Marina e Rafael são pessoas de demonstração.
const usuarios = [
  { id: "1", nome: "Warley Ferraz", email: "warley@exemplo.com", ebooks: 2, publicados: 1, ativo: true, admin: true },
  { id: "2", nome: "Marina Souza", email: "marina@exemplo.com", ebooks: 3, publicados: 2, ativo: true },
  { id: "3", nome: "Rafael Lima", email: "rafael@exemplo.com", ebooks: 1, publicados: 0, ativo: false },
];

export default function Usuarios() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-12">
      <UsuariosLista iniciais={usuarios} />
    </div>
  );
}
