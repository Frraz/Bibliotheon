import Database from "better-sqlite3";

// Semeia, no banco do servidor de teste, os livros que têm landing personalizada (src/landings/registro.ts). Só insere se ainda não
// existir, então qualquer spec pode chamar antes de abrir a página, em qualquer ordem.

export const SLUG_MENTE = "a-mente-inabalavel";
export const SLUG_SISTEMAS = "criar-sistemas-com-ia";

/** Devolve o id da oferta criada ("" se o livro já existia). */
export function semearMente(): string {
  let ofertaId = "";
  const banco = new Database(".e2e/data/bibliotheon.db");
  banco.pragma("busy_timeout = 5000");
  if (banco.prepare("SELECT 1 FROM ebook WHERE slug = ?").get(SLUG_MENTE)) { banco.close(); return ""; }
  const id = crypto.randomUUID();
  ofertaId = crypto.randomUUID();
  const agora = Date.now();
  const j = JSON.stringify;
  banco
    .prepare(
      `INSERT INTO ebook (id, slug, status, titulo, headline, resumo, problema, descricao, dores, beneficios, diferenciais, para_quem, nao_e_para, incluido, sumario, faq, formatos, preco, publicado_em, criadoEm, atualizadoEm)
       VALUES (?, ?, 'publicado', 'A Mente Inabalável', 'Treine uma mente mais firme', 'Resumo do livro para a página.', 'Eu li frases de estoicismo.', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4799, ?, ?, ?)`,
    )
    .run(id, SLUG_MENTE, "Primeiro parágrafo.\n\nSegundo parágrafo.", j(["Dor um"]), j(["Benefício um", "Benefício dois", "Benefício três"]), j(["Diferença um"]), j(["Para quem um"]), j(["Não é para um"]), j(["Livro em PDF"]), j(Array.from({ length: 22 }, (_, n) => `Capítulo ${n + 1}`)), j([{ p: "Isso substitui terapia?", r: "Não." }]), j(["PDF", "EPUB"]), agora, agora, agora);
  banco.prepare("INSERT INTO oferta (id, ebook_id, plataforma, url, principal, ativa, ordem) VALUES (?, ?, 'hotmart', 'https://pay.example.com/mente', 1, 1, 0)").run(ofertaId, id);
  banco.close();
  return ofertaId;
}

export function semearSistemas() {
  const banco = new Database(".e2e/data/bibliotheon.db");
  banco.pragma("busy_timeout = 5000");
  if (!banco.prepare("SELECT 1 FROM ebook WHERE slug = ?").get(SLUG_SISTEMAS)) {
    const id = crypto.randomUUID();
    const agora = Date.now();
    const j = JSON.stringify;
    banco
      .prepare(
        `INSERT INTO ebook (id, slug, status, titulo, headline, subtitulo, problema, dores, beneficios, diferenciais, para_quem, nao_e_para, incluido, sumario, faq, formatos, preco, garantia_dias, publicado_em, criadoEm, atualizadoEm)
         VALUES (?, ?, 'publicado', 'Crie Sistemas com IA e Ganhe Dinheiro', 'Crie seu primeiro sistema com IA', 'Do zero ao sistema no ar.', 'Você consegue imaginar a solução, mas não sabe programar.', ?, ?, ?, ?, ?, ?, ?, ?, ?, 6499, 7, ?, ?, ?)`,
      )
      .run(id, SLUG_SISTEMAS, j(["Dor um", "Dor dois"]), j(["Benefício um", "Benefício dois", "Benefício três"]), j(["Diferença um"]), j(["Para quem um"]), j(["Não é para um"]), j(["Livro em PDF"]), j(["Capítulo um", "Capítulo dois"]), j([{ p: "Preciso saber programar?", r: "Não para começar." }]), j(["PDF", "EPUB"]), agora, agora, agora);
    banco.prepare("INSERT INTO oferta (id, ebook_id, plataforma, url, principal, ativa, ordem) VALUES (?, ?, 'hotmart', 'https://pay.example.com/sistemas', 1, 1, 0)").run(crypto.randomUUID(), id);
  }
  banco.close();
}

export const SLUG_NATAL = "natal-a-mesa";

export function semearNatal() {
  const banco = new Database(".e2e/data/bibliotheon.db");
  banco.pragma("busy_timeout = 5000");
  if (!banco.prepare("SELECT 1 FROM ebook WHERE slug = ?").get(SLUG_NATAL)) {
    const id = crypto.randomUUID();
    const agora = Date.now();
    const j = JSON.stringify;
    banco
      .prepare(
        `INSERT INTO ebook (id, slug, status, titulo, headline, resumo, problema, dores, beneficios, diferenciais, para_quem, nao_e_para, incluido, sumario, faq, formatos, preco, garantia_dias, publicado_em, criadoEm, atualizadoEm)
         VALUES (?, ?, 'publicado', 'Natal à Mesa', 'Ceia de Natal planejada', 'Resumo do livro para a página.', 'Todo ano eu deixo a ceia para a última hora.', ?, ?, ?, ?, ?, ?, ?, ?, ?, 3990, 7, ?, ?, ?)`,
      )
      .run(id, SLUG_NATAL, j(["Dor um"]), j(["Benefício um", "Benefício dois", "Benefício três"]), j(["Diferença um"]), j(["Para quem um"]), j(["Não é para um"]), j(["Livro em PDF (215 páginas)", "Planilha de orçamento da ceia (.xlsx)"]), j(["Capítulo um", "Capítulo dois"]), j([{ p: "Tem foto de todos os pratos?", r: "Não." }]), j(["PDF", "EPUB"]), agora, agora, agora);
    banco.prepare("INSERT INTO oferta (id, ebook_id, plataforma, url, principal, ativa, ordem) VALUES (?, ?, 'cakto', 'https://pay.example.com/natal', 1, 1, 0)").run(crypto.randomUUID(), id);
  }
  banco.close();
}
