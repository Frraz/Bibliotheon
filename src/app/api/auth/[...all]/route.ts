import { auth } from "@/lib/auth";

// Entrar, sair e trocar a senha (cliente do Better Auth). O cadastro público está desligado em src/lib/auth.ts.
const tratar = (req: Request) => auth().handler(req);
export { tratar as GET, tratar as POST };
