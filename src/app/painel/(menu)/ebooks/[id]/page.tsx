import { notFound } from "next/navigation";
import { EditorEbook } from "@/components/painel/editor-ebook";
import { exigirUsuario } from "@/lib/acesso";
import { campanhaViva, dateParaDataLocal, reais } from "@/lib/editor";
import { carregarEbook, estadoParaPublicar, LIMITE_AMOSTRAS } from "@/lib/ebooks";
import { ehOwner, podeEditar } from "@/lib/permissoes";
import { paraVenderMelhor } from "@/lib/editor";

export default async function EditarEbook({ params }: PageProps<"/painel/ebooks/[id]">) {
  const u = await exigirUsuario();
  const { id } = await params;
  const d = carregarEbook(id);
  // Quem não é dono vê "não encontrada", igual a um endereço que não existe.
  if (!d || !podeEditar(u, d.e)) notFound();
  const { e } = d;

  const tema = d.temas.find((t) => t.id === e.temaId) ?? null;
  const checklist = estadoParaPublicar(e, tema);
  const viva = campanhaViva(e);
  // Campanha vencida ou preço sem prazo: o preço normal é o que está valendo.
  const precoNormal = viva ? e.precoDe : e.ofertaAte && e.precoDe != null ? e.precoDe : e.preco;
  const lojasAtivas = d.ofertas.filter((o) => o.ativa).length;

  return (
    <EditorEbook
      id={e.id}
      slug={e.slug}
      slugTravado={!!e.publicadoEm}
      status={e.status}
      dono={ehOwner(u) ? (d.dono ?? "sem dono") : null}
      euSouOwner={ehOwner(u)}
      inicial={{
        titulo: e.titulo, temaId: e.temaId ?? "", capaAlt: e.capaAlt ?? "", autorExibido: e.autorExibido ?? "", formatos: e.formatos.join(", "), headline: e.headline ?? "",
        subtitulo: e.subtitulo ?? "", resumo: e.resumo ?? "", problema: e.problema ?? "", descricao: e.descricao ?? "", dores: e.dores, beneficios: e.beneficios,
        diferenciais: e.diferenciais, paraQuem: e.paraQuem, naoEPara: e.naoEPara, incluido: e.incluido, observacoes: e.observacoes ?? "", sumario: e.sumario, faq: e.faq,
        seoTitle: e.seoTitle ?? "", seoDescription: e.seoDescription ?? "",
      }}
      preco={{
        precoNormal: reais(precoNormal), garantiaDias: String(e.garantiaDias), parcelamento: e.parcelamento ?? "", campanha: viva,
        campanhaNome: viva ? (e.ofertaNome ?? "") : "", campanhaPreco: viva ? reais(e.preco) : "", campanhaFim: viva ? dateParaDataLocal(e.ofertaAte) : "",
      }}
      lojas={d.ofertas.map((o) => ({ id: o.id, plataforma: o.plataforma, url: o.url, urlPromo: o.urlPromo ?? "", ativa: o.ativa }))}
      temas={d.temas.map((t) => ({ id: t.id, nome: t.nome, publicado: t.publicado }))}
      capa={e.capa ? `/m/${e.capa}` : null}
      amostras={d.amostras.map((a) => ({ id: a.id, src: `/m/${a.imagem}`, alt: a.alt ?? "" }))}
      limiteAmostras={LIMITE_AMOSTRAS}
      pdfNome={e.pdfPrivado ? (e.pdfNome ?? "livro.pdf") : null}
      amostraPdf={e.amostraPdf ? `/m/${e.amostraPdf}` : null}
      checklist={checklist.itens}
      melhorar={paraVenderMelhor({ ...e, amostras: d.amostras.length, lojasAtivas })}
      google={{ titulo: e.seoTitle?.trim() || `${e.titulo} | E-book`, descricao: e.seoDescription?.trim() || e.resumo || e.subtitulo || "" }}
    />
  );
}
