// Orientação para o título e a descrição do Google no editor. Sem dependências: roda também no navegador.

export const IDEAL_TITULO_SEO = 60;
export const IDEAL_DESCRICAO_SEO = 155;

/** O que pode atrapalhar a página de ser encontrada ou clicada. Só avisa: nada aqui impede de salvar ou publicar. */
export function avisosDeSeo(titulo: string, descricao: string): string[] {
  const t = titulo.trim();
  const d = descricao.trim();
  const a: string[] = [];
  if (!t) a.push("Sem título próprio: o Google mostra o nome do livro, e quase ninguém busca por ele.");
  else if (t.length > IDEAL_TITULO_SEO) a.push("Título longo: o Google pode cortar o final.");
  if (!d) a.push("Sem descrição própria: o Google usa o resumo da página, que pode ser cortado.");
  else if (d.length > IDEAL_DESCRICAO_SEO) a.push("Descrição longa: o Google pode cortar o final.");
  if (d && d.toLowerCase() === t.toLowerCase()) a.push("A descrição repete o título: use-a para dizer o que a pessoa recebe.");
  if (/R\$\s*\d/.test(d)) a.push("Evite preço na descrição: ele fica desatualizado quando uma campanha acaba.");
  return a;
}
