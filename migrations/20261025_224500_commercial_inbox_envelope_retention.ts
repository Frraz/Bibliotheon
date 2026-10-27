import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "commercial_inbox" ALTER COLUMN "envelope" DROP NOT NULL`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const result = await db.execute(sql`SELECT count(*)::int AS total FROM "commercial_inbox" WHERE "envelope" IS NULL`)
  if (Number((result as unknown as { rows?: Array<{ total: number }> }).rows?.[0]?.total ?? 0) > 0) throw new Error('Migration down recusada: envelopes de inbox expirados não podem ser reconstruídos sem o ledger correspondente.')
  await db.execute(sql`ALTER TABLE "commercial_inbox" ALTER COLUMN "envelope" SET NOT NULL`)
}
