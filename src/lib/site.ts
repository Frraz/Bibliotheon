// SITE_URL é lido no build (metadados, sitemap, JSON-LD). Em produção vem do build arg do Docker.
export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const SITE_NOME = "Bibliotheon";
export const SITE_DESCRICAO = "E-books práticos para resolver problemas reais. Folheie uma amostra e compre na plataforma que preferir.";
export const CONTATO_EMAIL = process.env.NEXT_PUBLIC_CONTATO_EMAIL ?? "";
