import Link from "next/link";

const direcoes = [
  { href: "/prototipo/a", nome: "A · Livraria", texto: "Editorial e calma. Papel, serifa e a capa como protagonista." },
  { href: "/prototipo/b", nome: "B · Oficina", texto: "Escura e confiante. Cores da capa invertidas, ritmo de produto." },
  { href: "/prototipo/c", nome: "C · Direta", texto: "Grande e clara. Preço e botão em primeiro plano, bloco de cor cheio." },
];

export default function Indice() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 font-sans">
      <h1 className="text-2xl font-semibold">Três direções para a landing</h1>
      <p className="mt-2 text-neutral-600">Mesmo conteúdo real do e-book 001, em três mundos visuais.</p>
      <ul className="mt-8 space-y-3">
        {direcoes.map((d) => (
          <li key={d.href}>
            <Link href={d.href} className="block rounded-lg border border-neutral-300 p-5 hover:border-neutral-900">
              <span className="font-medium">{d.nome}</span>
              <span className="mt-1 block text-neutral-600">{d.texto}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
