import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "marketing_suppression_tombstones" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"fingerprint" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "marketing_suppression_tombstones_id" uuid;
  CREATE UNIQUE INDEX "marketing_suppression_tombstones_fingerprint_idx" ON "marketing_suppression_tombstones" USING btree ("fingerprint");
  CREATE INDEX "marketing_suppression_tombstones_updated_at_idx" ON "marketing_suppression_tombstones" USING btree ("updated_at");
  CREATE INDEX "marketing_suppression_tombstones_created_at_idx" ON "marketing_suppression_tombstones" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_marketing_suppression_tombs_fk" FOREIGN KEY ("marketing_suppression_tombstones_id") REFERENCES "public"."marketing_suppression_tombstones"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_marketing_suppression_tomb_idx" ON "payload_locked_documents_rels" USING btree ("marketing_suppression_tombstones_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const result = await db.execute(sql`SELECT count(*)::int AS total FROM "marketing_suppression_tombstones"`)
  if (Number((result as unknown as { rows?: Array<{ total: number }> }).rows?.[0]?.total ?? 0) > 0) throw new Error('Migration down recusada: tombstones de supressão seriam perdidos.')
  await db.execute(sql`
   ALTER TABLE "marketing_suppression_tombstones" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "marketing_suppression_tombstones" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_marketing_suppression_tombs_fk";
  
  DROP INDEX "payload_locked_documents_rels_marketing_suppression_tomb_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "marketing_suppression_tombstones_id";`)
}
