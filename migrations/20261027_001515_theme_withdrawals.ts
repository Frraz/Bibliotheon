import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "theme_withdrawals" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"subject_fingerprint" varchar NOT NULL,
  	"theme_id" varchar NOT NULL,
  	"withdrawn_at" timestamp(3) with time zone NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "theme_withdrawals_id" uuid;
  CREATE UNIQUE INDEX "theme_withdrawals_key_idx" ON "theme_withdrawals" USING btree ("key");
  CREATE INDEX "theme_withdrawals_subject_fingerprint_idx" ON "theme_withdrawals" USING btree ("subject_fingerprint");
  CREATE INDEX "theme_withdrawals_theme_id_idx" ON "theme_withdrawals" USING btree ("theme_id");
  CREATE INDEX "theme_withdrawals_updated_at_idx" ON "theme_withdrawals" USING btree ("updated_at");
  CREATE INDEX "theme_withdrawals_created_at_idx" ON "theme_withdrawals" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_theme_withdrawals_fk" FOREIGN KEY ("theme_withdrawals_id") REFERENCES "public"."theme_withdrawals"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_theme_withdrawals_id_idx" ON "payload_locked_documents_rels" USING btree ("theme_withdrawals_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const rows = await db.execute(sql`SELECT count(*)::int AS count FROM "theme_withdrawals"`)
  if (rows.rows[0]?.count) throw new Error('Descadastros temáticos existentes impedem rollback.')
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_theme_withdrawals_fk";
    DROP INDEX "payload_locked_documents_rels_theme_withdrawals_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "theme_withdrawals_id";
    DROP TABLE "theme_withdrawals";
  `)
}
