export function Prosa({ titulo, atualizado, children }: { titulo: string; atualizado: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mx-auto max-w-[42rem] px-5 py-14 lg:py-20">
        <h1 className="font-(family-name:--font-display) text-[clamp(2.2rem,5.5vw,3.25rem)] leading-[1.05] font-medium tracking-[-0.02em] text-balance">{titulo}</h1>
        <p className="mt-3 text-sm text-(--tinta-2)">Atualizado em {atualizado}</p>
        <div className="mt-10 space-y-5 text-[1.0625rem] leading-[1.7] text-pretty [&_h2]:mt-12 [&_h2]:font-(family-name:--font-display) [&_h2]:text-2xl [&_h2]:font-medium [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2 [&_a]:underline [&_a]:underline-offset-4">{children}</div>
      </div>
    </section>
  );
}
