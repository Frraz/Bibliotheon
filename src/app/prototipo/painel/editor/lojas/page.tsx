import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { Copiar } from "@/components/painel/copiar";
import { Button } from "@/components/ui/button";
import { brl, livro } from "@/lib/prototipo";

const lista = (itens: readonly string[]) => itens.map((i) => `- ${i}`).join("\n");

const campos = [
  { nome: "Título", texto: livro.titulo },
  { nome: "Subtítulo", texto: livro.subtitulo },
  { nome: "Descrição curta", texto: livro.resumo },
  { nome: "Descrição completa", texto: livro.descricao.join("\n\n") },
  { nome: "O que a pessoa vai aprender", texto: lista(livro.beneficios) },
  { nome: "Para quem é", texto: lista(livro.paraQuem) },
  { nome: "O que está incluído", texto: lista(livro.incluido) },
  { nome: "Preço", texto: brl(livro.preco) },
  { nome: "Garantia", texto: `${livro.garantiaDias} dias` },
  { nome: "Autor", texto: livro.autor },
];

const pacote = ["Ficha com todos os textos (ficha.md)", "Dados do e-book (dados.json)", "Capa", "Páginas de amostra", "PDF de amostra, se houver", "PDF completo do livro"];

export default function OutrasLojas() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-10 lg:py-12">
      <Link href="/prototipo/painel/editor" className="-ml-1 inline-flex min-h-11 items-center gap-2 text-sm text-(--tinta-2) hover:text-(--tinta)">
        <ArrowLeft className="size-4" aria-hidden /> Voltar ao e-book
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-(family-name:--font-display) text-[2rem] leading-none font-medium tracking-[-0.01em]">Publicar em outras lojas</h1>
        <Button size="lg" className="w-full sm:w-auto"><Download /> Baixar pacote</Button>
      </div>
      <p className="mt-4 text-(--tinta-2) text-pretty">
        Copie os textos ao cadastrar o livro na Hotmart, Kiwify, Cakto ou outra loja. Depois volte ao e-book e cole o link em “Onde comprar”.
      </p>

      <ul className="mt-8 border-t border-(--filete)">
        {campos.map((c) => (
          <li key={c.nome} className="border-b border-(--filete) py-5">
            <div className="flex items-center justify-between gap-4">
              <p className="min-w-0">
                <span className="block text-[0.9375rem] font-medium">{c.nome}</span>
                <span className="block text-sm text-(--tinta-2) [font-variant-numeric:tabular-nums]">{c.texto.length.toLocaleString("pt-BR")} caracteres</span>
              </p>
              <Copiar texto={c.texto} rotulo={c.nome.toLowerCase()} />
            </div>
            <p className="mt-3 text-[0.9375rem] whitespace-pre-line text-pretty text-(--tinta-2)">{c.texto}</p>
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <h2 className="font-(family-name:--font-display) text-[1.375rem] leading-none font-medium">O que vem no pacote</h2>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-[0.9375rem] text-(--tinta-2)">
          {pacote.map((p) => <li key={p}>{p}</li>)}
        </ul>
        <p className="mt-4 text-sm text-(--tinta-2) text-pretty">O pacote traz o PDF completo. Só você e o administrador conseguem baixá-lo.</p>
      </section>
    </div>
  );
}
