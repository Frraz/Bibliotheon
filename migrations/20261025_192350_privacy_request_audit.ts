import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_privacy_request_audit_action" AS ENUM('export', 'delete', 'correct');
  CREATE TYPE "public"."enum_privacy_request_audit_outcome" AS ENUM('completed', 'not_found', 'pending', 'failed');
  CREATE TABLE "privacy_request_audit" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"subject_fingerprint" varchar NOT NULL,
  	"action" "enum_privacy_request_audit_action" NOT NULL,
  	"outcome" "enum_privacy_request_audit_outcome" NOT NULL,
  	"counts" jsonb NOT NULL,
  	"actor_id" uuid NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "privacy_request_audit_id" uuid;
  ALTER TABLE "privacy_request_audit" ADD CONSTRAINT "privacy_request_audit_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "privacy_request_audit_subject_fingerprint_idx" ON "privacy_request_audit" USING btree ("subject_fingerprint");
  CREATE INDEX "privacy_request_audit_actor_idx" ON "privacy_request_audit" USING btree ("actor_id");
  CREATE INDEX "privacy_request_audit_updated_at_idx" ON "privacy_request_audit" USING btree ("updated_at");
  CREATE INDEX "privacy_request_audit_created_at_idx" ON "privacy_request_audit" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_privacy_request_audit_fk" FOREIGN KEY ("privacy_request_audit_id") REFERENCES "public"."privacy_request_audit"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_privacy_request_audit_id_idx" ON "payload_locked_documents_rels" USING btree ("privacy_request_audit_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const result = await db.execute(sql`SELECT count(*)::int AS total FROM "privacy_request_audit"`)
  if (Number((result as unknown as { rows?: Array<{ total: number }> }).rows?.[0]?.total ?? 0) > 0) throw new Error('Migration down recusada: auditorias de privacidade seriam perdidas.')
  await db.execute(sql`
   ALTER TABLE "privacy_request_audit" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "privacy_request_audit" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_privacy_request_audit_fk";
  
  DROP INDEX "payload_locked_documents_rels_privacy_request_audit_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "privacy_request_audit_id";
  DROP TYPE "public"."enum_privacy_request_audit_action";
  DROP TYPE "public"."enum_privacy_request_audit_outcome";`)
}
