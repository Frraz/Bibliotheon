import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { join } from "node:path";

/** Aplica as migrações pendentes. Usado na partida do servidor (instrumentation.ts), no seed e no banco em memória do build. */
export function migrar(banco: BetterSQLite3Database<Record<string, unknown>>) {
  migrate(banco, { migrationsFolder: join(/*turbopackIgnore: true*/ process.cwd(), "drizzle") });
}
