// Capa ilustrativa (só protótipo): mesma gramática da capa real, para testar o catálogo com vários livros.
export function CapaExemplo({ titulo, cor }: { titulo: string; cor: string }) {
  return (
    <div className="flex aspect-[1600/2560] w-full flex-col bg-[#F7F1E6] p-[9%] [container-type:inline-size] shadow-[0_2px_3px_rgb(0_0_0/.1),0_18px_36px_-14px_rgb(31_42_41/.4)]" aria-hidden>
      <div className="h-px w-full" style={{ background: cor }} />
      <p className="mt-[14%] font-(family-name:--font-display) text-[11cqw] leading-[1.05] font-semibold text-(--tinta)">{titulo}</p>
      <div className="mt-auto mb-[18%] size-[38%] self-center" style={{ background: cor, clipPath: "polygon(50% 0, 100% 28%, 100% 72%, 50% 100%, 0 72%, 0 28%)" }} />
      <div className="h-px w-full" style={{ background: cor }} />
    </div>
  );
}
