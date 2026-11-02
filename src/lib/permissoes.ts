import type { Papel } from "@/db/schema";

// Regra de acesso, pura e testada. Toda Server Action e rota do painel passa por ela, no servidor.

export type Quem = { id: string; papel: Papel };

/** O owner edita tudo; o parceiro, só o que é dele. E-book sem dono (importado) é só do owner. */
export function podeEditar(quem: Quem, ebook: { ownerId: string | null }) {
  return quem.papel === "owner" || (ebook.ownerId !== null && ebook.ownerId === quem.id);
}

/** Quem pode baixar o PDF do livro: o mesmo critério da edição. */
export const podeBaixarPdf = podeEditar;

export const ehOwner = (quem: Quem) => quem.papel === "owner";
