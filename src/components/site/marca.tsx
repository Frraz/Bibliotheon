import Link from "next/link";

export function Marca({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`font-(family-name:--font-display) text-[1.375rem] leading-none font-semibold tracking-[-0.01em] text-(--tinta) ${className}`}
    >
      Bibliotheon
    </Link>
  );
}
