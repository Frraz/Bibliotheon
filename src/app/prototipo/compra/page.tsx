import { brl, livro } from "@/lib/prototipo";

// Compara o bloco de compra da landing com um e com vários links. Mesmas classes da landing real.
const BOTAO =
  "inline-flex min-h-14 w-full items-center justify-center bg-(--terracota) px-8 text-[1.0625rem] font-semibold text-(--papel) shadow-[0_1px_0_rgb(0_0_0/.15),0_10px_20px_-12px_rgb(0_0_0/.55)] transition-[background-color] duration-150 hover:bg-(--terracota-escura) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--terracota)";
const PRECO = 64.99;

function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="mx-auto max-w-3xl px-5 pt-10 pb-3 text-sm font-medium text-(--tinta-2)">{children}</p>;
}

function Bloco({ lojas }: { lojas: { nome: string; preco?: number }[] }) {
  return (
    <section className="bg-(--tinta) text-(--papel)">
      <div className="mx-auto max-w-3xl px-5 py-16 text-center lg:py-20">
        <h2 className="font-(family-name:--font-display) text-[clamp(2rem,5vw,3.25rem)] leading-[1.08] font-medium text-balance">{livro.headline}</h2>
        <p className="mt-8 font-(family-name:--font-display) text-6xl leading-tight font-medium">{brl(PRECO)}</p>
        <p className="text-sm text-(--papel)/70">Pagamento único · acesso imediato</p>
        {lojas.length > 1 && <p className="mt-8 font-medium">Escolha onde prefere comprar</p>}
        <div className={`mx-auto grid w-full max-w-sm grid-cols-1 gap-3 ${lojas.length > 1 ? "mt-3" : "mt-8"}`}>
          {lojas.map((l) => (
            <a key={l.nome} href="#" className={BOTAO}>
              {`Comprar na ${l.nome}`}
              {l.preco && l.preco !== PRECO ? ` · ${brl(l.preco)}` : ""}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Compra() {
  return (
    <main className="bg-(--papel) pb-16 font-(family-name:--font-texto) text-(--tinta)">
      <Rotulo>Com 2 ou mais lojas: todas com o mesmo peso. O botão do topo e a barra fixa trazem para cá.</Rotulo>
      <Bloco lojas={[{ nome: "Hotmart" }, { nome: "Kiwify" }, { nome: "Cakto", preco: 59.9 }]} />

      <Rotulo>Botão do topo e barra fixa com 2 ou mais lojas</Rotulo>
      <div className="mx-auto max-w-3xl px-5">
        <a href="#" className={`${BOTAO} sm:w-auto`}>Escolher onde comprar</a>
        <div className="mt-4 flex items-center gap-4 border-y border-(--filete) py-3">
          <p className="font-(family-name:--font-display) text-2xl leading-none font-medium">{brl(PRECO)}</p>
          <a href="#" className="ml-auto inline-flex min-h-12 items-center justify-center bg-(--terracota) px-6 font-semibold text-(--papel) hover:bg-(--terracota-escura)">Escolher loja</a>
        </div>
      </div>

      <Rotulo>Com 1 loja (o 001 hoje): continua como está, e o botão vai direto ao checkout</Rotulo>
      <Bloco lojas={[{ nome: "Hotmart" }]} />
    </main>
  );
}
