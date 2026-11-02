import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SITE_URL } from "@/lib/site";

// Redirecionamento otimista: sem cookie de sessão, /painel vai para /entrar. Não valida a sessão (isso é feito perto dos
// dados, em src/lib/acesso.ts). O destino usa SITE_URL: atrás do nginx a origem da requisição é a interna.
export function proxy(req: NextRequest) {
  if (!getSessionCookie(req)) return NextResponse.redirect(new URL("/entrar", SITE_URL));
  return NextResponse.next();
}

export const config = { matcher: ["/painel", "/painel/:path*"] };
