import { FormNovoEbook } from "@/components/painel/form-novo-ebook";
import { exigirUsuario } from "@/lib/acesso";

export default async function NovoEbook() {
  await exigirUsuario();
  return (
    <div className="mx-auto max-w-xl px-5 py-8 lg:px-10 lg:py-12">
      <h1 className="font-(family-name:--font-display) text-[2rem] leading-none font-medium tracking-[-0.01em]">Novo e-book</h1>
      <p className="mt-3 text-(--tinta-2) text-pretty">Comece pelo título. A capa, os textos e as lojas você completa na próxima tela, e só vai ao ar quando você publicar.</p>
      <FormNovoEbook />
    </div>
  );
}
