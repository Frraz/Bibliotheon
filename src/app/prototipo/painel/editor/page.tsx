import { Check, ExternalLink, GripVertical, ImagePlus, Plus, X } from "lucide-react";
import Image from "next/image";
import { CampoContado } from "@/components/painel/contador";
import { ListaEditavel } from "@/components/painel/lista-editavel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { livro } from "@/lib/prototipo";

const secoes = [
  { id: "essencial", n: 1, nome: "Essencial" },
  { id: "vendas", n: 2, nome: "Página de vendas" },
  { id: "conteudo", n: 3, nome: "Conteúdo" },
  { id: "preco", n: 4, nome: "Preço e onde comprar" },
  { id: "seo", n: 5, nome: "Google (SEO)" },
] as const;

const checklist = [
  { ok: true, t: "Capa" },
  { ok: true, t: "Título" },
  { ok: true, t: "Headline" },
  { ok: true, t: "Pelo menos 3 benefícios" },
  { ok: true, t: "Uma oferta de compra" },
];

const selectCls =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

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

export default function Editor() {
  return (
    <form className="mx-auto grid max-w-6xl gap-x-12 px-5 pt-8 pb-32 lg:grid-cols-[minmax(0,1fr)_17rem] lg:px-10 lg:pt-12 lg:pb-16">
      <div className="min-w-0">
        <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-(family-name:--font-display) text-[2rem] leading-none font-medium tracking-[-0.01em]">Editar e-book</h1>
          <Badge className="rounded-sm border-0 bg-(--tinta)/8 px-2 text-(--tinta-2)">Rascunho</Badge>
        </div>

        {/* No celular: resumo do checklist em vez da coluna lateral */}
        <p className="mb-8 flex items-center gap-2 bg-(--salvia)/12 px-4 py-3 text-[0.9375rem] text-(--salvia) lg:hidden">
          <Check className="size-4" aria-hidden /> Tudo pronto para publicar
        </p>

        <Secao id="essencial" n={1} nome="Essencial">
          <Campo id="titulo" rotulo="Título do livro">
            <Input id="titulo" defaultValue={livro.titulo} />
          </Campo>
          <Campo id="slug" rotulo="Endereço da página" dica="Quanto mais parecido com o que as pessoas buscam, melhor.">
            <div className="flex">
              <span className="grid place-items-center rounded-l-lg border border-r-0 border-input bg-(--papel-2) px-3 text-sm text-(--tinta-2)">bibliotheon.com.br/</span>
              <Input id="slug" defaultValue={livro.slug} className="rounded-l-none" />
            </div>
          </Campo>
          <Campo id="tema" rotulo="Tema" className="sm:max-w-xs">
            <select id="tema" className={selectCls} defaultValue="dev">
              <option value="dev">Desenvolvimento de software</option>
              <option value="saude">Saúde</option>
              <option>+ Criar tema</option>
            </select>
          </Campo>

          <div>
            <p className="mb-1.5 text-[0.9375rem] font-medium">Capa</p>
            <div className="flex flex-col gap-5 border border-dashed border-(--filete) bg-(--papel-3) p-5 sm:flex-row sm:items-center">
              <Image src={livro.capa} alt="Capa atual" width={1600} height={2560} sizes="96px" className="h-auto w-24 shrink-0 shadow-[0_2px_6px_rgb(0_0_0/.25)]" />
              <div className="min-w-0">
                <p className="font-medium">capa.jpg</p>
                <p className="mt-0.5 text-sm text-(--tinta-2)">1600 × 2560 px · 258 KB. Use JPG ou PNG com pelo menos 1200 px de largura.</p>
                <Button type="button" variant="outline" className="mt-3"><ImagePlus /> Trocar capa</Button>
              </div>
            </div>
          </div>
          <Campo id="capa-alt" rotulo="Descrição da capa (para leitores de tela)">
            <Input id="capa-alt" defaultValue={livro.capaAlt} />
          </Campo>
          <div className="grid gap-7 sm:grid-cols-2">
            <Campo id="autor" rotulo="Autor exibido"><Input id="autor" defaultValue={livro.autor} /></Campo>
            <Campo id="formatos" rotulo="Formatos"><Input id="formatos" defaultValue="PDF, EPUB, Caderno de prática" /></Campo>
          </div>
        </Secao>

        <Secao id="vendas" n={2} nome="Página de vendas">
          <Campo id="headline" rotulo="Headline" dica="Diga o resultado que a pessoa vai ter, não o assunto do livro.">
            <CampoContado id="headline" inicial={livro.headline} ideal={70} />
          </Campo>
          <Campo id="subtitulo" rotulo="Subtítulo"><Textarea id="subtitulo" defaultValue={livro.subtitulo} className="min-h-20" /></Campo>
          <Campo id="problema" rotulo="O problema do leitor, em uma frase"><Input id="problema" defaultValue={livro.problema} /></Campo>
          <Campo id="descricao" rotulo="Descrição"><Textarea id="descricao" defaultValue={livro.descricao.join("\n\n")} className="min-h-48" /></Campo>
          <div><p className="mb-2 text-[0.9375rem] font-medium">O que a pessoa vai aprender</p><ListaEditavel rotulo="Benefício" itens={livro.beneficios} adicionar="Adicionar benefício" /></div>
          <div><p className="mb-2 text-[0.9375rem] font-medium">É para quem</p><ListaEditavel rotulo="Para quem" itens={livro.paraQuem} adicionar="Adicionar" /></div>
          <div><p className="mb-2 text-[0.9375rem] font-medium">Não é para quem</p><ListaEditavel rotulo="Não é para" itens={livro.naoEPara} adicionar="Adicionar" /></div>
          <div><p className="mb-2 text-[0.9375rem] font-medium">O que está incluído</p><ListaEditavel rotulo="Incluído" itens={livro.incluido} adicionar="Adicionar item" /></div>
          <Campo id="antes" rotulo="Antes de comprar" dica="Requisitos e limites. Ser claro aqui reduz pedidos de reembolso.">
            <Textarea id="antes" defaultValue="Computador e internet. Planos de IA, VPS e domínio são custos externos. Sem promessa de renda ou de prazo." />
          </Campo>
          <Campo id="autor-bio" rotulo="Sobre o autor"><Textarea id="autor-bio" defaultValue={livro.sobreAutor} /></Campo>
        </Secao>

        <Secao id="conteudo" n={3} nome="Conteúdo">
          <div><p className="mb-2 text-[0.9375rem] font-medium">Capítulos</p><ListaEditavel rotulo="Capítulo" itens={livro.sumario.slice(0, 6)} adicionar="Adicionar capítulo" /><p className="mt-1 text-sm text-(--tinta-2)">Mostrando 6 de {livro.capitulos}.</p></div>
          <div>
            <p className="mb-2 text-[0.9375rem] font-medium">Perguntas frequentes</p>
            <ul className="space-y-3">
              {livro.faq.slice(0, 2).map((f) => (
                <li key={f.p} className="flex items-start gap-1">
                  <span className="mt-3 text-(--tinta-2)/60" aria-hidden><GripVertical className="size-5" /></span>
                  <div className="w-full space-y-2"><Input aria-label="Pergunta" defaultValue={f.p} className="font-medium" /><Textarea aria-label="Resposta" defaultValue={f.r} className="min-h-20" /></div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remover pergunta"><X /></Button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="ghost" size="sm" className="mt-2 text-(--terracota)"><Plus /> Adicionar pergunta</Button>
          </div>
          <div>
            <p className="mb-2 text-[0.9375rem] font-medium">Páginas de amostra</p>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {livro.amostras.map((a, i) => (
                <li key={a.src} className="group relative">
                  <Image src={a.src} alt={a.alt} width={800} height={1280} sizes="(min-width:640px) 160px, 30vw" className="h-auto w-full ring-1 ring-(--filete)" />
                  <span className="absolute bottom-1.5 left-1.5 grid size-6 place-items-center bg-(--tinta) text-xs text-(--papel)">{i + 1}</span>
                  <button type="button" aria-label={`Remover página ${i + 1}`} className="absolute top-1.5 right-1.5 grid size-8 place-items-center bg-(--papel) text-(--tinta) opacity-100 shadow sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"><X className="size-4" /></button>
                </li>
              ))}
              <li><button type="button" className="grid aspect-[800/1280] w-full place-items-center border border-dashed border-(--filete) text-sm text-(--tinta-2) transition-colors hover:border-(--tinta) hover:text-(--tinta)"><span className="grid justify-items-center gap-1"><Plus className="size-5" />Adicionar</span></button></li>
            </ul>
            <p className="mt-2 text-sm text-(--tinta-2)">De 3 a 8 páginas. Arraste para ordenar.</p>
          </div>
        </Secao>

        <Secao id="preco" n={4} nome="Preço e onde comprar">
          <div className="grid gap-7 sm:grid-cols-2">
            <Campo id="preco-in" rotulo="Preço (R$)"><Input id="preco-in" inputMode="decimal" defaultValue="79,00" /></Campo>
            <Campo id="preco-de" rotulo="Preço “de” (opcional)" dica="Só use se for um preço que você realmente pratica."><Input id="preco-de" inputMode="decimal" defaultValue="99,00" /></Campo>
            <Campo id="fim" rotulo="Fim da oferta (opcional)" dica="Com uma data aqui, a página mostra a contagem. Quando acabar, o preço volta ao normal sozinho."><Input id="fim" type="datetime-local" defaultValue="2026-11-30T23:59" /></Campo>
            <Campo id="garantia" rotulo="Garantia (dias)"><Input id="garantia" inputMode="numeric" defaultValue="7" /></Campo>
          </div>
          <div>
            <p className="mb-2 text-[0.9375rem] font-medium">Onde comprar</p>
            <ul className="space-y-3">
              {livro.ofertas.map((o) => (
                <li key={o.plataforma} className="grid gap-3 border border-(--filete) bg-(--papel-3) p-4 sm:grid-cols-[9rem_1fr_auto] sm:items-center">
                  <select aria-label="Plataforma" className={selectCls} defaultValue={o.plataforma}><option>Kiwify</option><option>Cakto</option><option>Hotmart</option><option>Outra</option></select>
                  <Input aria-label="Link do checkout" defaultValue={`https://pay.exemplo.com/${o.plataforma.toLowerCase()}`} />
                  <div className="flex items-center gap-4">
                    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="principal" defaultChecked={o.principal} className="size-4 accent-(--terracota)" /> Principal</label>
                    <label className="flex min-h-11 items-center gap-2 text-sm"><Switch defaultChecked aria-label="Ativa" /> Ativa</label>
                    <Button type="button" variant="ghost" size="icon" aria-label="Testar link"><ExternalLink /></Button>
                  </div>
                </li>
              ))}
            </ul>
            <Button type="button" variant="ghost" size="sm" className="mt-2 text-(--terracota)"><Plus /> Adicionar plataforma</Button>
          </div>
        </Secao>

        <Secao id="seo" n={5} nome="Google (SEO)">
          <details className="group border border-(--filete)">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[0.9375rem] font-medium marker:content-none [&::-webkit-details-marker]:hidden">
              Como a página aparece no Google <span className="text-sm font-normal text-(--tinta-2) group-open:hidden">Preenchido automaticamente</span>
            </summary>
            <div className="space-y-5 border-t border-(--filete) p-4">
              <div className="bg-white p-4 text-left">
                <p className="text-sm text-[#3c4043]">bibliotheon.com.br › {livro.slug}</p>
                <p className="text-xl leading-snug text-[#1a0dab]">Como criar sistemas com IA sem saber programar | E-book</p>
                <p className="mt-1 text-sm text-[#4d5156]">E-book prático: do requisito ao sistema no ar, com VPS e domínio. PDF e EPUB por R$ 79,00.</p>
              </div>
              <Campo id="seo-t" rotulo="Título para o Google"><Input id="seo-t" defaultValue="Como criar sistemas com IA sem saber programar | E-book" /></Campo>
              <Campo id="seo-d" rotulo="Descrição para o Google"><Textarea id="seo-d" defaultValue="E-book prático: do requisito ao sistema no ar, com VPS e domínio. PDF e EPUB por R$ 79,00." className="min-h-20" /></Campo>
            </div>
          </details>
        </Secao>
      </div>

      {/* Coluna lateral (desktop): navegação, checklist e ações */}
      <aside className="hidden lg:block">
        <div className="sticky top-8 space-y-8">
          <nav aria-label="Nesta página">
            <p className="mb-2 text-sm font-medium text-(--tinta-2)">Nesta página</p>
            <ol className="border-l border-(--filete)">
              {secoes.map((s) => (
                <li key={s.id}><a href={`#${s.id}`} className="-ml-px flex min-h-9 items-center gap-3 border-l-2 border-transparent pl-4 text-[0.9375rem] text-(--tinta-2) transition-colors hover:border-(--terracota) hover:text-(--tinta)"><span className="w-3 [font-variant-numeric:tabular-nums]">{s.n}</span>{s.nome}</a></li>
              ))}
            </ol>
          </nav>
          <div>
            <p className="mb-2 text-sm font-medium text-(--tinta-2)">Pronto para publicar?</p>
            <ul className="space-y-1.5 text-[0.9375rem]">
              {checklist.map((c) => (
                <li key={c.t} className="flex items-center gap-2.5"><span className="grid size-5 place-items-center rounded-full bg-(--salvia) text-white"><Check className="size-3" aria-hidden /></span>{c.t}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <Button type="button" size="lg" className="w-full">Publicar</Button>
            <Button type="button" variant="outline" size="lg" className="w-full">Salvar rascunho</Button>
            <Button type="button" variant="ghost" className="w-full"><ExternalLink /> Ver prévia</Button>
          </div>
        </div>
      </aside>

      {/* Celular: barra de ação fixa */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-(--filete) bg-(--papel) p-3 lg:hidden">
        <Button type="button" variant="outline" size="lg" className="flex-1">Salvar</Button>
        <Button type="button" size="lg" className="flex-[1.4]">Publicar</Button>
      </div>
    </form>
  );
}
