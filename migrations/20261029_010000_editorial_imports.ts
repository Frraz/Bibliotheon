import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Internal service tables, deliberately excluded from Payload REST and schema push.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE editorial_links (
      source_key text PRIMARY KEY,
      ebook_id uuid NOT NULL UNIQUE REFERENCES ebooks(id) ON DELETE RESTRICT,
      base jsonb NOT NULL, offers jsonb NOT NULL,
      cover_hash text NOT NULL, cover_id uuid REFERENCES media(id) ON DELETE RESTRICT,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE editorial_operations (
      id text PRIMARY KEY, actor_id uuid NOT NULL,
      source_key text NOT NULL REFERENCES editorial_links(source_key) ON DELETE RESTRICT,
      result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
    );
  `)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  const rows = await db.execute(sql`SELECT 1 FROM editorial_links LIMIT 1`)
  if (rows.rows.length) throw new Error('Importações existentes impedem rollback destrutivo; preserve os vínculos e recibos.')
  await db.execute(sql`DROP TABLE editorial_operations; DROP TABLE editorial_links;`)
}
