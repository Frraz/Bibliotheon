"use client";

import { Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { despublicarEbook, salvarEbook, type Retorno } from "@/app/painel/(menu)/ebooks/acoes";
import { CampoContado } from "@/components/painel/contador";
import { FaqEditavel } from "@/components/painel/faq-editavel";
import { ListaEditavel } from "@/components/painel/lista-editavel";
import { PrecoELojas, type LojaInicial, type PrecoInicial } from "@/components/painel/preco-e-lojas";
import { AmostraPdf, AmostrasEditor, PdfDoLivro, UploadCapa, type AmostraLinha } from "@/components/painel/uploads-ebook";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type EditorProps = {
  id: string;
  slug: string;
  slugTravado: boolean;
  status: "rascunho" | "revisao" | "publicado";
  dono: string | null;
  inicial: {
    titulo: string; temaId: string; capaAlt: string; autorExibido: string; formatos: string; headline: string; subtitulo: string; resumo: string; problema: string;
    descricao: string; dores: string[]; beneficios: string[]; diferenciais: string[]; paraQuem: string[]; naoEPara: string[]; incluido: string[]; observacoes: string;
    sumario: string[]; faq: { p: string; r: string }[]; seoTitle: string; seoDescription: string;
  };
  preco: PrecoInicial;
  lojas: LojaInicial[];
  temas: { id: string; nome: string; publicado: boolean }[];
  euSouOwner: boolean;
  capa: string | null;
  amostras: AmostraLinha[];
  limiteAmostras: number;
  pdfNome: string | null;
  amostraPdf: string | null;
  checklist: { t: string; ok: boolean }[];
  melhorar: string[];
  google: { titulo: string; descricao: string };
};

const SECOES = [
  { id: "essencial", n: 1, nome: "Essencial" },
  { id: "vendas", n: 2, nome: "Página de vendas" },
  { id: "conteudo", n: 3, nome: "Conteúdo" },
  { id: "preco", n: 4, nome: "Preço e onde comprar" },
  { id: "seo", n: 5, nome: "Google (SEO)" },
] as const;

const AVISO_HONESTO = "Ao publicar, a página vai ao ar na hora. Nada de promessa de renda ou cura, depoimento inventado ou preço “de” que você não pratica.";
const selectCls = "h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";
const sub = "mb-2 text-[0.9375rem] font-medium";

function Campo({ id, rotulo, dica, children, className = "" }: { id: string; rotulo: string; dica?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 text-[0.9375rem] font-medium">{rotulo}</Label>
      {children}
      {dica && <p className="mt-1.5 text-sm text-(--tinta-2) text-pretty">{dica}</p>}
    </div>
  );
}

function Secao({ id, n, nome, children }: { id: string; n: number; nome: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-(--filete) pt-8 pb-12">
      <h2 className="flex items-baseline gap-3 font-(family-name:--font-display) text-[1.625rem] leading-none font-medium">
        <span className="text-(--terracota) [font-variant-numeric:tabular-nums]">{n}</span>
        {nome}
      </h2>
      <div className="mt-7 space-y-7">{children}</div>
    </section>
  );
}

export function EditorEbook(p: EditorProps) {
  const router = useRouter();
  const [estado, acao, salvando] = useActionState<Retorno | null, FormData>(salvarEbook.bind(null, p.id), null);
  const [sujo, setSujo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [tirando, setTirando] = useState(false);
  const [msgDespublicar, setMsgDespublicar] = useState<string | null>(null);
  const publicado = p.status === "publicado";
  const faltam = p.checklist.filter((c) => !c.ok);

  // Depois de um envio que deu certo, nada está pendente (ajuste de estado durante a renderização, como o React recomenda).
  const [estadoVisto, setEstadoVisto] = useState(estado);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    if (estado?.ok) setSujo(false);
  }
  useEffect(() => {
    if (!sujo) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sujo]);

  // Sem `action` no <form>: o React 19 limparia os campos depois de cada envio, e uma mensagem de erro apagaria o que a pessoa digitou.
  function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const dados = new FormData(ev.currentTarget, (ev.nativeEvent as SubmitEvent).submitter);
    startTransition(() => acao(dados));
  }

  async function despublicar() {
    setTirando(true);
    const r = await despublicarEbook(p.id);
    setTirando(false);
    setConfirmando(false);
    setMsgDespublicar(r.ok ? r.mensagem ?? null : (r.erros ?? []).join(" "));
    router.refresh();
  }

  const botoes = (
    <>
      {publicado ? (
        <Button type="submit" name="acao" value="salvar" size="lg" disabled={salvando} className="flex-[1.4] lg:w-full lg:flex-none">{salvando ? "Salvando…" : "Salvar alterações"}</Button>
      ) : (
        <>
          <Button type="submit" name="acao" value="salvar" variant="outline" size="lg" disabled={salvando} className="flex-1 lg:order-2 lg:w-full lg:flex-none">Salvar rascunho</Button>
          <Button type="submit" name="acao" value="publicar" size="lg" disabled={salvando} className="flex-[1.4] lg:order-1 lg:w-full lg:flex-none">{salvando ? "Salvando…" : "Publicar"}</Button>
        </>
      )}
    </>
  );

  return (
    <form onSubmit={enviar} onInput={() => setSujo(true)} onChange={() => setSujo(true)} onClick={(e) => { if ((e.target as HTMLElement).closest("button[type=button]")) setSujo(true); }} className="mx-auto grid max-w-6xl grid-cols-1 gap-x-12 px-5 pt-8 pb-32 lg:grid-cols-[minmax(0,1fr)_17rem] lg:px-10 lg:pt-12 lg:pb-16">
      <div className="min-w-0">
        <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-(family-name:--font-display) text-[2rem] leading-none font-medium tracking-[-0.01em]">Editar e-book</h1>
          <Badge className={`rounded-sm border-0 px-2 ${publicado ? "bg-(--salvia)/15 text-(--salvia)" : "bg-(--tinta)/8 text-(--tinta-2)"}`}>{publicado ? "Publicado" : "Rascunho"}</Badge>
          {p.dono && <span className="text-sm text-(--tinta-2)">de {p.dono}</span>}
        </div>

        {/* Mensagens do último envio (fixas no topo, no celular e no desktop) */}
        <div aria-live="polite">
          {estado?.erros?.length ? (
            <div role="alert" className="mb-8 border border-(--perigo)/40 bg-(--papel-3) p-4 text-[0.9375rem]">
              <p className="font-medium text-(--perigo)">Não salvei ainda:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-pretty">{estado.erros.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          ) : estado?.mensagem ? (
            <div role="status" className="mb-8 bg-(--salvia)/12 p-4 text-[0.9375rem]">
              <p className="font-medium text-(--salvia)">{estado.mensagem}</p>
              {estado.aviso?.map((a) => <p key={a} className="mt-1 text-pretty">{a}</p>)}
              {estado.url && <Link href={estado.url} target="_blank" className="mt-2 inline-flex min-h-10 items-center gap-1.5 font-medium text-(--terracota) underline underline-offset-4">Ver a página <ExternalLink className="size-4" aria-hidden /></Link>}
            </div>
          ) : msgDespublicar ? (
            <p role="status" className="mb-8 bg-(--salvia)/12 p-4 text-[0.9375rem] font-medium text-(--salvia)">{msgDespublicar}</p>
          ) : null}
        </div>

        {/* No celular: resumo do checklist em vez da coluna lateral */}
        <div className="mb-8 lg:hidden">
          {faltam.length === 0 ? (
            <p className="flex items-center gap-2 bg-(--salvia)/12 px-4 py-3 text-[0.9375rem] text-(--salvia)"><Check className="size-4 shrink-0" aria-hidden /> {publicado ? "Página no ar" : "Tudo pronto para publicar"}</p>
          ) : (
            <p className="bg-(--terracota)/10 px-4 py-3 text-[0.9375rem] text-(--terracota-escura) text-pretty">Falta para publicar: {faltam.map((f) => f.t).join(", ")}.</p>
          )}
          {!publicado && <p className="mt-3 text-sm text-(--tinta-2) text-pretty">{AVISO_HONESTO}</p>}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="outline" render={<Link href={`/painel/ebooks/${p.id}/previa`} target="_blank" />}><ExternalLink /> Ver prévia</Button>
            {publicado && <Button variant="outline" render={<Link href={`/${p.slug}`} target="_blank" />}><ExternalLink /> Ver página no ar</Button>}
          </div>
        </div>

        <Secao id="essencial" n={1} nome="Essencial">
          <Campo id="titulo" rotulo="Título do livro"><Input id="titulo" name="titulo" defaultValue={p.inicial.titulo} required maxLength={140} /></Campo>
          <Campo id="slug" rotulo="Endereço da página" dica={p.slugTravado ? "O endereço não muda depois de publicado: links e buscas continuam funcionando." : "Use palavras que as pessoas buscam. Depois de publicar, o endereço não muda mais."}>
            <div className="flex min-w-0">
              <span className="grid shrink-0 place-items-center rounded-l-lg border border-r-0 border-input bg-(--papel-2) px-2 text-[0.8125rem] text-(--tinta-2) sm:px-3 sm:text-sm">bibliotheon.com.br/</span>
              <Input id="slug" name="slug" defaultValue={p.slug} readOnly={p.slugTravado} autoCapitalize="none" spellCheck={false} className={`min-w-0 rounded-l-none ${p.slugTravado ? "bg-(--papel-2) text-(--tinta-2)" : ""}`} />
            </div>
          </Campo>
          <Campo id="temaId" rotulo="Tema" className="sm:max-w-xs" dica={p.euSouOwner ? undefined : "Precisa de um tema novo? Peça ao administrador."}>
            <select id="temaId" name="temaId" className={selectCls} defaultValue={p.inicial.temaId}>
              <option value="">Sem tema</option>
              {p.temas.map((t) => <option key={t.id} value={t.id}>{t.nome}{t.publicado ? "" : " (fora do ar)"}</option>)}
            </select>
          </Campo>

          <UploadCapa id={p.id} capa={p.capa} alt={p.inicial.capaAlt} />
          <Campo id="capaAlt" rotulo="Descrição da capa" dica="Lida por leitores de tela e usada pelo Google. Ex.: “Capa de Título, de Autor”."><Input id="capaAlt" name="capaAlt" defaultValue={p.inicial.capaAlt} maxLength={200} /></Campo>
          <PdfDoLivro id={p.id} nome={p.pdfNome} />
          <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
            <Campo id="autorExibido" rotulo="Autor exibido"><Input id="autorExibido" name="autorExibido" defaultValue={p.inicial.autorExibido} /></Campo>
            <Campo id="formatos" rotulo="Formatos" dica="Separe por vírgula."><Input id="formatos" name="formatos" defaultValue={p.inicial.formatos} placeholder="PDF, EPUB" /></Campo>
          </div>
        </Secao>

        <Secao id="vendas" n={2} nome="Página de vendas">
          <Campo id="headline" rotulo="Headline" dica="Diga o resultado que a pessoa vai ter, não o assunto do livro."><CampoContado id="headline" inicial={p.inicial.headline} ideal={70} /></Campo>
          <Campo id="subtitulo" rotulo="Subtítulo"><Textarea id="subtitulo" name="subtitulo" defaultValue={p.inicial.subtitulo} className="min-h-20" /></Campo>
          <Campo id="resumo" rotulo="Resumo" dica="Uma ou duas frases. É o texto que aparece no Google se você não escrever outro em Google (SEO)."><Textarea id="resumo" name="resumo" defaultValue={p.inicial.resumo} className="min-h-20" /></Campo>
          <Campo id="problema" rotulo="O problema do leitor, em uma frase" dica="Escreva como o próprio leitor diria."><Input id="problema" name="problema" defaultValue={p.inicial.problema} /></Campo>
          <div><p className={sub}>Situações que ele reconhece</p><ListaEditavel nome="dores" rotulo="Situação" itens={p.inicial.dores} adicionar="Adicionar situação" longo /></div>
          <Campo id="descricao" rotulo="Descrição" dica="Separe os parágrafos com uma linha em branco."><Textarea id="descricao" name="descricao" defaultValue={p.inicial.descricao} className="min-h-48" /></Campo>
          <div><p className={sub}>O que a pessoa vai aprender</p><ListaEditavel nome="beneficios" rotulo="Benefício" itens={p.inicial.beneficios} adicionar="Adicionar benefício" /><p className="mt-1 text-sm text-(--tinta-2)">Pelo menos 3. Comece com um verbo e diga o que a pessoa terá em mãos.</p></div>
          <div><p className={sub}>Por que este caminho</p><ListaEditavel nome="diferenciais" rotulo="Diferença" itens={p.inicial.diferenciais} adicionar="Adicionar diferença" longo /><p className="mt-1 text-sm text-(--tinta-2)">Diferenças reais frente às alternativas, sem citar marcas.</p></div>
          <div><p className={sub}>É para quem</p><ListaEditavel nome="paraQuem" rotulo="Para quem" itens={p.inicial.paraQuem} adicionar="Adicionar" /></div>
          <div><p className={sub}>Não é para quem</p><ListaEditavel nome="naoEPara" rotulo="Não é para" itens={p.inicial.naoEPara} adicionar="Adicionar" /><p className="mt-1 text-sm text-(--tinta-2)">Inclua o esforço exigido. Ser claro aqui reduz pedidos de reembolso.</p></div>
          <div><p className={sub}>O que está incluído</p><ListaEditavel nome="incluido" rotulo="Incluído" itens={p.inicial.incluido} adicionar="Adicionar item" /><p className="mt-1 text-sm text-(--tinta-2)">Só o que a loja realmente entrega.</p></div>
          <Campo id="observacoes" rotulo="Antes de comprar" dica="Requisitos e limites. Ser claro aqui reduz pedidos de reembolso."><Textarea id="observacoes" name="observacoes" defaultValue={p.inicial.observacoes} className="min-h-32" /></Campo>
        </Secao>

        <Secao id="conteudo" n={3} nome="Conteúdo">
          <div><p className={sub}>Capítulos</p><ListaEditavel nome="sumario" rotulo="Capítulo" itens={p.inicial.sumario} adicionar="Adicionar capítulo" /></div>
          <div><p className={sub}>Perguntas frequentes</p><FaqEditavel itens={p.inicial.faq} /></div>
          <AmostrasEditor id={p.id} amostras={p.amostras} limite={p.limiteAmostras} />
          <AmostraPdf id={p.id} url={p.amostraPdf} />
        </Secao>

        <Secao id="preco" n={4} nome="Preço e onde comprar"><PrecoELojas preco={p.preco} lojas={p.lojas} /></Secao>

        <Secao id="seo" n={5} nome="Google (SEO)">
          <details className="group border border-(--filete)">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[0.9375rem] font-medium marker:content-none [&::-webkit-details-marker]:hidden">
              Como a página aparece no Google <span className="text-sm font-normal text-(--tinta-2) group-open:hidden">Preenchido automaticamente</span>
            </summary>
            <div className="space-y-5 border-t border-(--filete) p-4">
              <div className="bg-white p-4 text-left">
                <p className="text-sm break-words text-[#3c4043]">bibliotheon.com.br › {p.slug}</p>
                <p className="text-xl leading-snug text-[#1a0dab]">{p.google.titulo}</p>
                <p className="mt-1 text-sm text-[#4d5156]">{p.google.descricao || "Escreva o resumo para aparecer aqui."}</p>
              </div>
              <p className="text-sm text-(--tinta-2) text-pretty">A prévia mostra o que está salvo. Deixe os campos abaixo em branco para usar o título e o resumo da página.</p>
              <Campo id="seoTitle" rotulo="Título para o Google"><Input id="seoTitle" name="seoTitle" defaultValue={p.inicial.seoTitle} maxLength={120} /></Campo>
              <Campo id="seoDescription" rotulo="Descrição para o Google"><Textarea id="seoDescription" name="seoDescription" defaultValue={p.inicial.seoDescription} className="min-h-20" maxLength={300} /></Campo>
            </div>
          </details>
        </Secao>

        {publicado && (
          <section className="border-t border-(--filete) pt-8 pb-4">
            <h2 className="font-(family-name:--font-display) text-[1.375rem] leading-none font-medium">Tirar do ar</h2>
            <p className="mt-3 max-w-prose text-sm text-(--tinta-2) text-pretty">A página sai do ar e o e-book volta a ser rascunho. O endereço e os dados continuam guardados.</p>
            {confirmando ? (
              <div role="alertdialog" aria-label="Confirmar" className="mt-4 flex flex-wrap items-center gap-2">
                <Button type="button" variant="destructive" disabled={tirando} onClick={despublicar}>{tirando ? "Tirando…" : "Sim, tirar do ar"}</Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmando(false)}>Cancelar</Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="mt-4" onClick={() => setConfirmando(true)}>Despublicar</Button>
            )}
          </section>
        )}
      </div>

      {/* Coluna lateral (desktop): ações primeiro, para nunca ficarem abaixo da dobra; rola por dentro se a tela for baixa */}
      <aside className="hidden lg:block">
        <div className="sticky top-8 max-h-[calc(100dvh-4rem)] space-y-7 overflow-y-auto pr-1 pb-2">
          <div className="flex flex-col gap-2">
            {botoes}
            {!publicado && <p className="pt-1 text-sm text-(--tinta-2) text-pretty">{AVISO_HONESTO}</p>}
            {sujo && <p className="text-sm text-(--terracota-escura)">Há alterações não salvas.</p>}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-(--tinta-2)">Pronto para publicar?</p>
            <ul className="space-y-1.5 text-[0.9375rem]">
              {p.checklist.map((c) => (
                <li key={c.t} className="flex items-start gap-2.5">
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${c.ok ? "bg-(--salvia) text-white" : "border border-(--filete)"}`}>{c.ok && <Check className="size-3" aria-hidden />}</span>
                  <span className={c.ok ? "" : "text-(--terracota-escura)"}>{c.t}</span>
                </li>
              ))}
            </ul>
            {p.melhorar.length > 0 && (
              <>
                <p className="mt-4 text-sm font-medium text-(--tinta-2)">Para vender melhor</p>
                <ul className="mt-1 space-y-1 text-sm text-(--tinta-2)">{p.melhorar.map((t) => <li key={t} className="text-pretty">{t}</li>)}</ul>
              </>
            )}
            <p className="mt-3 text-xs text-(--tinta-2)">O checklist mostra o que está salvo.</p>
          </div>
          <div className="-mx-2 grid">
            <Button variant="ghost" className="justify-start px-2" render={<Link href={`/painel/ebooks/${p.id}/previa`} target="_blank" />}><ExternalLink /> Ver prévia</Button>
            {publicado && <Button variant="ghost" className="justify-start px-2" render={<Link href={`/${p.slug}`} target="_blank" />}><ExternalLink /> Ver página no ar</Button>}
          </div>
          <nav aria-label="Nesta página">
            <p className="mb-2 text-sm font-medium text-(--tinta-2)">Nesta página</p>
            <ol className="border-l border-(--filete)">
              {SECOES.map((s) => (
                <li key={s.id}><a href={`#${s.id}`} className="-ml-px flex min-h-9 items-center gap-3 border-l-2 border-transparent pl-4 text-[0.9375rem] text-(--tinta-2) transition-colors hover:border-(--terracota) hover:text-(--tinta)"><span className="w-3 [font-variant-numeric:tabular-nums]">{s.n}</span>{s.nome}</a></li>
              ))}
            </ol>
          </nav>
        </div>
      </aside>

      {/* Celular: barra de ação fixa */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-(--filete) bg-(--papel) p-3 lg:hidden">{botoes}</div>
    </form>
  );
}
