"use client";

import { useSearchParams } from "next/navigation";

// Depois de criar a senha nova, /redefinir-senha leva a /entrar?senha=nova.
export function AvisoSenhaNova() {
  if (useSearchParams().get("senha") !== "nova") return null;
  return <p role="status" className="mt-4 text-[0.9375rem] text-(--salvia) text-pretty">Senha nova salva. Entre com ela.</p>;
}
