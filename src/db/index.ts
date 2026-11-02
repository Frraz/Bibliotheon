import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrar } from "./migrar";
import * as schema from "./schema";

const caminho = process.env.DATABASE_PATH ?? "data/bibliotheon.db";

function abrir() {
  if (caminho !== ":memory:") mkdirSync(dirname(caminho), { recursive: true });
  const sqlite = new Database(caminho);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const banco = drizzle(sqlite, { schema });
  // Banco em memória (build do Docker): nasce com as tabelas, vazio, para as páginas estáticas poderem ser geradas.
  if (caminho === ":memory:") migrar(banco as never);
  return banco;
}

// Uma conexão por processo (sobrevive ao hot reload em desenvolvimento).
const g = globalThis as unknown as { __bibliotheonDb?: ReturnType<typeof abrir> };
export const db = (g.__bibliotheonDb ??= abrir());
export { schema };
