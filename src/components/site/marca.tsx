import Link from "next/link";

/** `herdarCor`: usa a cor do texto ao redor (landing com paleta própria). `pequena`: versão do cabeçalho discreto. */
export function Marca({ className = "", herdarCor = false, pequena = false }: { className?: string; herdarCor?: boolean; pequena?: boolean }) {
  return (
    <Link
      href="/"
      className={`font-(family-name:--font-display) ${pequena ? "text-[1.125rem]" : "text-[1.375rem]"} leading-none font-semibold tracking-[-0.01em] ${herdarCor ? "text-inherit" : "text-(--tinta)"} ${className}`}
    >
      Bibliotheon
    </Link>
  );
}
